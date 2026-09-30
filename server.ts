import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { toPlayerOrganization, formatFromOrganization } from './src/services/playerAccounting.ts';
import { normalizeDurationsToTotal } from './src/services/durationUtils.ts';
import { sanitizeGeminiPlan, validateGeminiPlan } from './src/services/planValidation.ts';
import { BlockType, SessionDuration } from './src/types/session.ts';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn(
    '[gemini] GEMINI_API_KEY is missing. Training plans will use the local fallback generator. The API key is never sent to the browser.'
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const GEMINI_MODEL_TIMEOUT_MS = 8000;

app.use(express.json());

// Initialize GoogleGenAI client on the server side only (never expose the key to the frontend)
const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function logGeminiError(model: string, err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  console.error(
    `[gemini] model=${model} status=${e?.status ?? e?.code ?? 'unknown'} message=${e?.message ?? String(err)}`
  );
}

const TRAINING_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sessionTitle: {
      type: Type.STRING,
      description: 'Tiêu đề buổi tập bóng đá, chuyên nghiệp, hấp dẫn và súc tích',
    },
    mainObjective: {
      type: Type.STRING,
      description: 'Mục tiêu chính của buổi tập đối với các cầu thủ',
    },
    players: {
      type: Type.INTEGER,
      description: 'Số lượng cầu thủ tham gia buổi tập',
    },
    duration: {
      type: Type.INTEGER,
      description: 'Tổng thời lượng buổi tập tính bằng phút (chính xác 60, 75, hoặc 90)',
    },
    ageGroup: {
      type: Type.STRING,
      description: 'Độ tuổi / Nhóm đối tượng (vd: Bóng đá cộng đồng / Phong trào / Thiếu niên)',
    },
    sessionOverview: {
      type: Type.STRING,
      description: 'Tóm tắt tổng quan cách tổ chức buổi tập và luân chuyển',
    },
    phases: {
      type: Type.ARRAY,
      description: 'Danh sách từ 4 đến 6 giai đoạn bài tập. TỔNG duration của tất cả phases PHẢI BẰNG CHÍNH XÁC thời lượng buổi tập.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Mã định danh giai đoạn (vd: phase-1, phase-2, phase-3)',
          },
          phase: {
            type: Type.STRING,
            description: 'Tên giai đoạn bài tập (vd: Khởi động, Kỹ thuật, Phát triển kỹ năng, Tình huống đối kháng, Trò chơi nhỏ, Thi đấu)',
          },
          exerciseName: {
            type: Type.STRING,
            description: 'Tên bài tập chuyên môn cụ thể',
          },
          duration: {
            type: Type.INTEGER,
            description: 'Thời lượng của bài tập tính bằng phút',
          },
          players: {
            type: Type.INTEGER,
            description: 'Số lượng cầu thủ tham gia bài tập này',
          },
          area: {
            type: Type.STRING,
            description: 'Kích thước khu vực tập thực tế (vd: 25 x 20 m, 30 x 25 m, Nửa sân, Toàn sân)',
          },
          equipment: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Danh sách dụng cụ thực tế (vd: Bóng, Cọc tiêu, Áo bib, Khung thành mini)',
          },
          organization: {
            type: Type.STRING,
            description: 'Tổ chức & bố trí sân bãi, phân chia nhóm, vị trí cầu thủ cụ thể để hạn chế tối đa đứng chờ',
          },
          execution: {
            type: Type.STRING,
            description: 'Cách vận hành chi tiết, luật chơi, tiến trình luân chuyển bóng',
          },
          coachingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-5 điểm huấn luyện then chốt liên quan trực tiếp đến chủ đề bằng thuật ngữ bóng đá tự nhiên',
          },
          progression: {
            type: Type.STRING,
            description: 'Biến thể phát triển bài tập nâng cao hoặc hạ thấp độ khó cho HLV',
          },
          playerOrganization: {
            type: Type.OBJECT,
            description: 'Cách phân chia nhóm cầu thủ thực tế để không ai phải đứng ngoài',
            properties: {
              groups: {
                type: Type.INTEGER,
                description: 'Số lượng nhóm',
              },
              playersPerGroup: {
                type: Type.INTEGER,
                description: 'Số lượng cầu thủ mỗi nhóm',
              },
              leftover: {
                type: Type.INTEGER,
                description: 'Số cầu thủ còn lại sau khi chia nhóm (joker / xoay tua), không được bỏ sót',
              },
              leftoverRole: {
                type: Type.STRING,
                description: 'none | joker | rotation',
              },
              restingPlayers: {
                type: Type.INTEGER,
                description: 'Legacy field; prefer leftover. Use 0 unless leftover is modeled as rotation.',
              },
            },
            required: ['groups', 'playersPerGroup'],
          },
        },
        required: [
          'id',
          'phase',
          'exerciseName',
          'duration',
          'players',
          'area',
          'equipment',
          'organization',
          'execution',
          'coachingPoints',
        ],
      },
    },
  },
  required: [
    'sessionTitle',
    'mainObjective',
    'players',
    'duration',
    'phases',
  ],
};

const SYSTEM_INSTRUCTION = `Bạn là trợ lý xây dựng giáo án bóng đá cho huấn luyện viên bóng đá cộng đồng.

Nhiệm vụ của bạn là tạo buổi tập thực tế, dễ tổ chức và phù hợp với số lượng cầu thủ.

Ưu tiên:
- nhiều thời gian cầu thủ tiếp xúc với bóng
- ít thời gian đứng chờ
- tổ chức đơn giản
- progression hợp lý
- coaching points rõ ràng
- bài tập phù hợp mục tiêu buổi tập

Mỗi giáo án phải thích ứng với:
- số lượng cầu thủ
- chủ đề tập luyện
- thời lượng

Sử dụng tiếng Việt chuyên môn bóng đá tự nhiên.

Không thêm giải thích ngoài JSON được yêu cầu.`;

/**
 * Intelligent Community Football Plan Generator
 * Used when upstream API encounters temporary rate limits (429) or high demand spikes (503).
 * Follows all 10 coaching rules:
 * 1. Exact total duration match (60, 75, 90 mins).
 * 2. 5 progressive phases (Warm-up, Technical, Skill, Small-sided, Match).
 * 3. Dynamic player organization (groups, players per group, zero waiting players).
 * 4. Realistic area sizes and equipment.
 * 5. Coaching points strictly tailored to topic.
 */
function generateRealisticFootballPlan(
  players: number,
  topic: string,
  duration: number
) {
  const cleanTopic = topic.trim();
  const lower = cleanTopic.toLowerCase();

  // Phase duration breakdown
  let durations: [number, number, number, number, number];
  if (duration === 60) {
    durations = [10, 10, 15, 10, 15];
  } else if (duration === 75) {
    durations = [10, 15, 15, 15, 20];
  } else {
    durations = [15, 15, 20, 20, 20];
  }

  const blockTypes: BlockType[] = ['warm_up', 'technical', 'skill', 'small_sided', 'match'];

  // Domain-specific customization based on topic keywords
  const isOpenBody = lower.includes('nhận bóng') || lower.includes('mở') || lower.includes('quan sát');
  const isDefending = lower.includes('phòng ngự') || lower.includes('1v1') || lower.includes('tắc bóng') || lower.includes('kìm hãm');
  const isPressing = lower.includes('pressing') || lower.includes('áp sát') || lower.includes('cự ly');
  const isPassing = lower.includes('chuyền') || lower.includes('người thứ 3') || lower.includes('phối hợp');
  const isTransition = lower.includes('chuyển trạng thái') || lower.includes('đoạt bóng') || lower.includes('phản công');
  const isFinishing = lower.includes('dứt điểm') || lower.includes('sút') || lower.includes('tạt');

  let title = `Giáo án: ${cleanTopic}`;
  let objective = `Nâng cao năng lực chuyên môn và thói quen chiến thuật về ${cleanTopic} cho ${players} cầu thủ trong buổi tập ${duration} phút.`;

  let phasesData: Array<{
    phase: string;
    exerciseName: string;
    area: string;
    equipment: string[];
    organization: string;
    execution: string;
    coachingPoints: string[];
    progression: string;
  }>;

  if (isOpenBody) {
    title = `Chuyên đề: Nhận bóng với tư thế mở & Quan sát không gian`;
    objective = `Rèn luyện cho cầu thủ thói quen kiểm tra vai trước khi nhận bóng, mở thân người góc 45 độ về hướng tấn công và chạm bước một vào khoảng trống để đẩy nhanh nhịp độ luân chuyển bóng.`;
    phasesData = [
      {
        phase: 'Khởi động',
        exerciseName: 'Chuyền bóng qua cổng nón & Kiểm tra vai đổi hướng',
        area: '25 × 20 m (6 cổng nón)',
        equipment: ['12 Nón tập (2 màu)', '1 Bóng / cặp', 'Áo bib 2 màu'],
        organization: `Bố trí 6 cổng nón rải đều trên sân 25 × 20 m. `,
        execution: 'Cầu thủ A chuyền bóng qua cổng nón cho cầu thủ B. Trước khi nhận bóng, B phải quay đầu quan sát vai gọi tên màu cổng trống phía sau, chạm bước một mở hướng qua cổng rồi chuyền tiếp cho đồng đội khác. Luân chuyển liên tục.',
        coachingPoints: [
          'Quan sát vai trước khi bóng tới (kiểm tra khoảng trống phía sau).',
          'Mở thân người ở góc 45 độ về hướng tấn công để nhìn thấy cả bóng lẫn không gian.',
          'Nhận bóng bằng chân xa (chân thuận lợi để đẩy bóng lên phía trước).',
          'Chạm bước một êm vào khoảng trống, không hãm chết bóng tại chỗ.',
        ],
        progression: 'Giới hạn tối đa 2 chạm; thêm 2 cầu thủ đóng vai trò vật cản di chuyển nhẹ để tăng áp lực quan sát.',
      },
      {
        phase: 'Kỹ thuật',
        exerciseName: 'Tổ hợp kim cương luân chuyển bóng nửa thân người',
        area: '20 × 20 m hình kim cương',
        equipment: ['5 Cọc tiêu', '6 Quả bóng', 'Áo bib phân nhóm'],
        organization: `Đặt 4 cọc tiêu ở 4 góc và 1 nón trung tâm. Cầu thủ đứng chia đều ở các góc. `,
        execution: 'Bóng chuyền từ đáy vào trung tâm. Tiền vệ giả vờ giật lùi thoát kèm, mở góc thân người nhận bóng bằng chân xa và mở bóng ngay sang cánh tiếp theo. Cầu thủ chuyền xong di chuyển tiếp nối vị trí theo chiều kim đồng hồ.',
        coachingPoints: [
          'Giật lùi tạo khoảng trống trước khi quay lại đón bóng.',
          'Xoay hông về hướng định chuyền tiếp theo trước khi bóng chạm chân.',
          'Đường chuyền sệt, căng và đúng vào chân thuận của đồng đội.',
          'Giao tiếp to rõ: hô "Mở!", "Quay!" hoặc "Chân thuận!".',
        ],
        progression: 'Đổi hướng luân chuyển bóng ngược chiều kim đồng hồ để cầu thủ tập thuần thục cả hai chân.',
      },
      {
        phase: 'Phát triển kỹ năng',
        exerciseName: 'Kiểm soát bóng 4v4 (+2 Joker tự do) chuyển hướng sang khu vực đích',
        area: '35 × 25 m chia 3 khu vực',
        equipment: ['10 Nón tập', '8 Quả bóng', 'Áo bib 3 màu'],
        organization: `Sân chia làm 3 khu vực. Hai đội tranh chấp ở giữa, cầu thủ tự do đứng ở hai đầu biên. `,
        execution: 'Hai đội phối hợp kiểm soát bóng. Điểm được tính khi nhận bóng ở trung tâm với tư thế mở người và chuyền thành công sang cầu thủ đích đối diện. Cầu thủ đích khống chế 2 chạm và chuyền lại cho đội kiểm soát.',
        coachingPoints: [
          'Căn thời điểm di chuyển vào khoảng trống khi người chuyền ngẩng đầu.',
          'Không bao giờ đứng vuông góc với bóng; luôn giữ ngực hướng về phía mục tiêu.',
          'Quan sát trong khoảnh khắc bóng đang lăn trên đường chuyền.',
          'Nếu bị áp sát rát từ phía sau: nhả bóng 1 chạm; nếu có khoảng trống: quay người tiến lên.',
        ],
        progression: 'Cầu thủ tự do chỉ được chạm 1 lần; nếu chuyền bóng xuyên tuyến thành công được cộng 2 điểm.',
      },
      {
        phase: 'Tình huống đối kháng',
        exerciseName: 'Đối kháng chuyển hướng tấn công nhanh ghi điểm 4 cầu môn nhỏ',
        area: '40 × 30 m (4 cầu môn nhỏ ở 4 góc)',
        equipment: ['4 Khung thành nhỏ', '10 Quả bóng', 'Áo bib 2 đội'],
        organization: `Sân 40 × 30 m với 4 cầu môn nhỏ ở 4 góc. Chia 2 đội thi đấu cân bằng, cầu thủ dư làm joker tấn công. `,
        execution: 'Mỗi đội tấn công 2 cầu môn đối diện. Khi nhận bóng mở thân người và chuyển hướng thành công từ biên này sang biên kia trước khi ghi bàn, bàn thắng được tính 2 điểm.',
        coachingPoints: [
          'Kiểm tra vai để nhận diện cánh đối diện có khoảng trống thoáng hơn.',
          'Tiếp bóng hướng lên phía trước ngay từ chạm đầu tiên.',
          'Hỗ trợ cự ly tam giác quanh người cầm bóng để luôn có ít nhất 2 hướng chuyền mở.',
          'Tận dụng tốc độ khi đối phương dồn ép một bên sân.',
        ],
        progression: 'Giới hạn thời gian tấn công trong 15 giây sau khi đoạt bóng để thúc đẩy nhịp độ chuyền.',
      },
      {
        phase: 'Thi đấu',
        exerciseName: 'Trận đấu 7v7 / 8v8 áp dụng tư thế mở & Giao tiếp trên sân',
        area: '55 × 38 m (Sân 7 tiêu chuẩn)',
        equipment: ['2 Khung thành tiêu chuẩn', 'Bóng thi đấu', 'Áo bib phân biệt rõ ràng'],
        organization: `Thi đấu 2 đội trên toàn sân, có thủ môn. Áp dụng toàn bộ luật bóng đá thực chiến. `,
        execution: 'Trận đấu tự do. Huấn luyện viên dừng trận đấu ngắn (Freeze) 1-2 lần để nhấn mạnh các tình huống cầu thủ mở thân người thoát pressing xuất sắc.',
        coachingPoints: [
          'Thói quen quan sát xung quanh liên tục kể cả khi không có bóng.',
          'Mở góc thân người trước mọi pha nhận bóng trên toàn mặt sân.',
          'Tự tin cầm bóng tịnh tiến lên phía trước khi có khoảng trống.',
          'Tổ chức cự ly đội hình cân bằng cả khi tấn công lẫn phòng ngự.',
        ],
        progression: 'Đội ghi bàn sau một chuỗi 4 đường chuyền mở hướng liên tiếp được tính gấp đôi điểm số.',
      },
    ];
  } else if (isDefending) {
    title = `Chuyên đề: Kỹ năng phòng ngự 1v1, kìm hãm & Tắc bóng đúng thời điểm`;
    objective = `Rèn luyện tư thế phòng ngự trọng tâm thấp, góc tiếp cận hợp lý để kìm hãm tốc độ đối phương và phán đoán thời điểm tắc bóng chính xác.`;
    phasesData = [
      {
        phase: 'Khởi động',
        exerciseName: 'Gương phản xạ & Di chuyển bước phòng ngự ziczac',
        area: '20 × 15 m',
        equipment: ['12 Nón nấm', 'Bóng tập', 'Áo bib'],
        organization: `Chia cặp cầu thủ đứng đối diện nhau cách 3m. `,
        execution: 'Cầu thủ A đóng vai trò dẫn dắt di chuyển thân người, cầu thủ B hạ thấp trọng tâm di chuyển bước chân phòng ngự bắt chước tương ứng. Đổi vai sau mỗi 2 phút.',
        coachingPoints: [
          'Hạ thấp trọng tâm, đứng trên nửa trước bàn chân.',
          'Tư thế chân trước chân sau, thân người hơi nghiêng 45 độ.',
          'Mắt tập trung vào bóng, không nhìn vào động tác giả của đối phương.',
        ],
        progression: 'Thêm bóng cho cầu thủ tấn công rê dắt tự do, người phòng ngự kìm hãm không để bị vượt qua.',
      },
      {
        phase: 'Kỹ thuật',
        exerciseName: 'Đấu tay đôi 1v1 trực diện qua cổng hẹp',
        area: '15 × 10 m (3 làn song song)',
        equipment: ['12 Nón tập', '1 Bóng / làn', 'Cổng nón 2m'],
        organization: `Thiết lập 3 làn tập song song để toàn bộ cầu thủ hoạt động cùng lúc. `,
        execution: 'Hậu vệ chuyền bóng cho tiền đạo đối diện rồi nhanh chóng lao lên áp sát, kìm hãm hướng di chuyển của tiền đạo và thực hiện tắc bóng khi đối thủ chạm bóng dài.',
        coachingPoints: [
          'Tăng tốc áp sát nhanh khi bóng đang lăn, hãm đà khi cách đối thủ 1.5m.',
          'Dẫn dụ đối phương vào chân không thuận hoặc hướng ra biên.',
          'Kiên nhẫn không vồ vập lao vào trước; chớp thời cơ khi bóng rời chân đối thủ.',
        ],
        progression: 'Giới hạn thời gian tiền đạo phải vượt qua cổng trong vòng 8 giây.',
      },
      {
        phase: 'Phát triển kỹ năng',
        exerciseName: 'Tình huống 2v2 (+1 Hậu vệ bọc lót)',
        area: '25 × 20 m có 2 khung thành nhỏ',
        equipment: ['8 Nón tập', '2 Cầu môn nhỏ', 'Áo bib 2 màu'],
        organization: `Bố trí sân với 2 khung thành nhỏ. Hai tiền đạo tấn công 2 hậu vệ phòng ngự. `,
        execution: 'Hậu vệ gần bóng áp sát gây áp lực (Pressure), hậu vệ thứ hai lùi lại góc 45 độ để bọc lót (Cover). Khi bóng được chuyền, hai hậu vệ lập tức hoán đổi vai trò.',
        coachingPoints: [
          'Giao tiếp rõ ràng giữa 2 hậu vệ: ai lao vào, ai bọc lót.',
          'Cự ly bọc lót hợp lý (khoảng 3-4 mét phía sau).',
          'Ngăn chặn đường chuyền xuyên tuyến giữa hai người.',
        ],
        progression: 'Nếu hậu vệ cướp được bóng, phản công ghi bàn vào cổng nón đáy sân đối diện.',
      },
      {
        phase: 'Tình huống đối kháng',
        exerciseName: 'Trò chơi nhỏ 4v4 + Khối phòng ngự kìm hãm khu vực',
        area: '35 × 25 m',
        equipment: ['4 Cầu môn mini', 'Bóng', 'Áo bib 2 màu'],
        organization: `Sân chia 2 nửa. Hai đội thi đấu 4v4 với nhiệm vụ bảo vệ 2 cầu môn mini. `,
        execution: 'Đội phòng ngự phải giữ khối cự ly chặt chẽ, ép đối phương chơi bóng ra biên và cô lập cầu thủ cầm bóng để tranh chấp tay đôi.',
        coachingPoints: [
          'Cả khối dịch chuyển đồng bộ theo hướng bóng.',
          'Quyết đoán trong các pha tranh chấp 50-50.',
          'Chuyển trạng thái phản công nhanh ngay sau khi đoạt bóng.',
        ],
        progression: 'Đội phòng ngự cướp bóng thành công và ghi bàn trong vòng 10 giây được tính 2 điểm.',
      },
      {
        phase: 'Thi đấu',
        exerciseName: 'Thi đấu đối kháng thực chiến đánh giá kỹ năng phòng ngự',
        area: '50 × 35 m',
        equipment: ['2 Cầu môn', 'Bóng thi đấu', 'Áo bib'],
        organization: `Thi đấu có thủ môn, áp dụng đầy đủ luật thi đấu. `,
        execution: 'Trận đấu 2 hiệp. Huấn luyện viên tập trung quan sát hành vi phòng thủ 1v1 của các cầu thủ trên từng tuyến.',
        coachingPoints: [
          'Áp dụng tư thế phòng ngự chuẩn xác trong mọi tình huống tranh chấp.',
          'Hỗ trợ bọc lót cho đồng đội khi bị đối phương qua người.',
          'Giữ kỷ luật vị trí, không phạm lỗi nguy hiểm trước vòng cấm.',
        ],
        progression: 'Hiệp 2 áp dụng luật: mỗi pha xoạc bóng sạch hoặc cắt bóng thành công được thưởng điểm tinh thần.',
      },
    ];
  } else if (isPressing) {
    title = `Chuyên đề: Pressing tầm cao & Duy trì cự ly đội hình`;
    objective = `Xây dựng thói quen kích hoạt pressing đồng bộ khi có tín hiệu, khép góc chuyền bóng của đối thủ và bóp nghẹt không gian chơi bóng.`;
    phasesData = [
      {
        phase: 'Khởi động',
        exerciseName: 'Khởi động phản xạ kích hoạt áp sát theo tín hiệu còi/màu áo',
        area: '20 × 20 m',
        equipment: ['Nón tập 4 màu', 'Bóng', 'Áo bib'],
        organization: `Cầu thủ chuyền bóng tự do trong khu vực. `,
        execution: 'Khi HLV hô màu nón hoặc bấm còi, cả đội ngay lập tức chuyển từ chuyền bóng sang tăng tốc áp sát cầu thủ cầm bóng trong 3 giây.',
        coachingPoints: [
          'Phản xạ nhanh với tín hiệu kích hoạt.',
          'Tốc độ áp sát quyết liệt nhưng có bước hãm phanh kiểm soát.',
          'Khép góc chuyền bóng nguy hiểm nhất.',
        ],
        progression: 'Tăng tốc độ di chuyển và rút ngắn thời gian phản ứng xuống 2 giây.',
      },
      {
        phase: 'Kỹ thuật',
        exerciseName: 'Rondo 4v2 / 5v2 ép hướng bóng và cắt đường chuyền',
        area: '12 × 12 m (chia 2-3 ô)',
        equipment: ['Nón nấm', 'Bóng', 'Áo bib'],
        organization: `Chia các ô vuông 12 × 12 m để phân tán toàn bộ cầu thủ. `,
        execution: 'Nhóm ngoài kiểm soát bóng, 2 cầu thủ giữa sân pressing quyết liệt. Cầu thủ thứ nhất áp sát trực diện, cầu thủ thứ hai phán đoán cắt đường chuyền.',
        coachingPoints: [
          'Hai người phòng ngự phải phối hợp: người ép bóng, người bắt bài.',
          'Che chắn đường chuyền xuyên tuyến giữa 2 người.',
          'Tận dụng lúc đối phương chạm bóng lỗi để ập vào cướp bóng.',
        ],
        progression: 'Người ngoài chỉ được chạm bóng 1-2 lần; nếu 2 người trong cắt được 3 bóng sẽ được đổi ra ngoài.',
      },
      {
        phase: 'Phát triển kỹ năng',
        exerciseName: 'Tình huống phát bóng lên: 4 Hậu vệ vs 3 Tiền đạo pressing',
        area: 'Nửa sân',
        equipment: ['Cầu môn lớn + 2 cầu môn nhỏ', 'Bóng', 'Áo bib'],
        organization: `Đội phòng ngự phát bóng từ thủ môn, đội tấn công bố trí 3-4 cầu thủ pressing ngay rìa vòng cấm. `,
        execution: 'Thủ môn chuyền ngắn cho trung vệ. Ngay khi bóng rời chân, khối tiền đạo đồng loạt dâng cao ép đối thủ ra biên hoặc cướp bóng dứt điểm ngay.',
        coachingPoints: [
          'Tín hiệu pressing: đường chuyền nhẹ, bóng nảy hoặc đối thủ quay lưng.',
          'Khóa chặt phương án chuyền vào trung lộ.',
          'Thủ môn và các tuyến sau phải dâng cao thu hẹp khoảng cách với khối phía trên.',
        ],
        progression: 'Nếu đội phát bóng thoát được pressing qua vạch giữa sân được 1 điểm; nếu pressing cướp bóng ghi bàn được 2 điểm.',
      },
      {
        phase: 'Tình huống đối kháng',
        exerciseName: 'Trận đấu nhỏ 3 khu vực với luật pressing 5 giây',
        area: '40 × 30 m',
        equipment: ['4 Khung thành nhỏ', 'Bóng', 'Áo bib 2 màu'],
        organization: `Sân chia 3 phần. Hai đội thi đấu cân bằng quân số. `,
        execution: 'Khi mất bóng ở phần sân đối phương, đội mất bóng phải lập tức pressing giành lại bóng trong vòng 5 giây.',
        coachingPoints: [
          'Chuyển trạng thái cực nhanh từ tấn công sang phòng ngự.',
          'Áp sát ngay lập tức người gần bóng nhất.',
          'Giao tiếp hô hào toàn đội đồng loạt đẩy cao.',
        ],
        progression: 'Giành lại bóng trong 5 giây và ghi bàn được cộng 3 điểm.',
      },
      {
        phase: 'Thi đấu',
        exerciseName: 'Đấu tập toàn diện áp dụng bẫy pressing',
        area: 'Sân 7 người tiêu chuẩn',
        equipment: ['2 Cầu môn', 'Bóng thi đấu', 'Áo bib'],
        organization: `Thi đấu 2 đội, HLV chỉ đạo chiến thuật pressing khu vực. `,
        execution: 'Trận đấu thi đấu tự do với mục tiêu thực hiện thành công ít nhất 3 pha đoạt bóng tầm cao trong trận.',
        coachingPoints: [
          'Duy trì cự ly giữa các tuyến không quá 12-15 mét.',
          'Đồng bộ nhịp dâng lên của hàng thủ khi tuyến trên pressing.',
          'Bảo toàn thể lực: pressing thông minh theo thời điểm chứ không đuổi bóng vô ích.',
        ],
        progression: 'Hiệp 2 thử nghiệm pressing nửa sân (Mid-block) để so sánh hiệu quả.',
      },
    ];
  } else {
    // General football topic tailored dynamically
    title = `Giáo án: ${cleanTopic}`;
    objective = `Phát triển kỹ năng ${cleanTopic}, củng cố sự gắn kết chiến thuật và tính thực chiến cho toàn bộ ${players} cầu thủ.`;
    phasesData = [
      {
        phase: 'Khởi động',
        exerciseName: `Khởi động chuyên biệt kết hợp kiểm soát & ${cleanTopic}`,
        area: '25 × 20 m',
        equipment: ['12 Nón tập', '1 Bóng / cặp', 'Áo bib'],
        organization: `Sân 25 × 20 m. `,
        execution: `Cầu thủ thực hiện các bài tập chuyền và di chuyển có trọng tâm về ${cleanTopic}, kết hợp các động tác giãn cơ động và tăng tốc ngắn.`,
        coachingPoints: [
          'Nâng cao sự tập trung và cường độ ngay từ những phút đầu.',
          'Kỹ thuật tiếp bóng và chuyền bóng chuẩn xác.',
          'Quan sát không gian và đồng đội trước mỗi pha chạm bóng.',
        ],
        progression: 'Tăng nhịp độ chuyền bóng và giới hạn số chạm xuống còn 2 chạm.',
      },
      {
        phase: 'Kỹ thuật',
        exerciseName: `Bài tập trạm kỹ thuật chuyên sâu về ${cleanTopic}`,
        area: '20 × 20 m',
        equipment: ['8 Cọc tiêu', 'Bóng tập', 'Áo bib'],
        organization: `Bố trí sơ đồ luân chuyển bóng theo nhóm nhỏ. `,
        execution: `Cầu thủ thực hiện các tình huống phối hợp lặp đi lặp lại nhằm định hình phản xạ chuẩn về ${cleanTopic}.`,
        coachingPoints: [
          'Tư thế thân người và bước đà hợp lý.',
          'Lực chuyền bóng và độ chuẩn xác của điểm tiếp xúc.',
          'Chạy chỗ hỗ trợ ngay sau khi thực hiện động tác.',
        ],
        progression: 'Tăng khoảng cách chuyền và bổ sung chướng ngại vật cản trở.',
      },
      {
        phase: 'Phát triển kỹ năng',
        exerciseName: `Bài tập có đối kháng có định hướng về ${cleanTopic}`,
        area: '30 × 25 m',
        equipment: ['Nón tập', 'Cầu môn nhỏ', 'Bóng'],
        organization: `Sân chia khu vực có mục tiêu cụ thể. `,
        execution: `Tổ chức thi đấu kiểm soát bóng hoặc triển khai bóng có điều kiện nhằm tạo ra tối đa các tình huống ứng dụng ${cleanTopic}.`,
        coachingPoints: [
          'Nhận biết thời điểm thuận lợi để ra quyết định xử lý.',
          'Giao tiếp to rõ và chỉ dẫn cho đồng đội.',
          'Giữ cự ly đội hình hình tam giác/kim cương xung quanh bóng.',
        ],
        progression: 'Giới hạn thời gian khống chế bóng hoặc thêm cầu thủ phòng ngự áp sát nhanh.',
      },
      {
        phase: 'Tình huống đối kháng',
        exerciseName: `Trò chơi đối kháng nhỏ áp dụng ${cleanTopic}`,
        area: '35 × 30 m',
        equipment: ['4 Cầu môn mini', 'Bóng', 'Áo bib 2 màu'],
        organization: `Hai đội thi đấu với mục tiêu khai thác các khoảng trống liên quan đến ${cleanTopic}. `,
        execution: `Trận đấu nhỏ có thưởng điểm cho các pha phối hợp hoặc xử lý thành công theo đúng chủ đề ${cleanTopic}.`,
        coachingPoints: [
          'Quyết đoán và tự tin thực hiện kỹ năng trong không gian hẹp.',
          'Khả năng chuyển đổi trạng thái khi có bóng và mất bóng.',
          'Phối hợp ăn ý giữa các tuyến.',
        ],
        progression: 'Đội hoàn thành chuỗi phối hợp đúng yêu cầu được tính gấp đôi số điểm bàn thắng.',
      },
      {
        phase: 'Thi đấu',
        exerciseName: `Trận đấu tự do kiểm tra & Đánh giá năng lực thực chiến`,
        area: 'Sân tiêu chuẩn',
        equipment: ['2 Cầu môn', 'Bóng thi đấu', 'Áo bib'],
        organization: `Hai đội thi đấu trên toàn sân với thủ môn. `,
        execution: `Thi đấu tự do với sự quan sát của HLV. Huấn luyện viên động viên cầu thủ chủ động áp dụng các bài học từ các giai đoạn trước vào trận đấu.`,
        coachingPoints: [
          'Thực hiện đúng các nguyên tắc chuyên môn đã rèn luyện.',
          'Tinh thần đồng đội và nỗ lực thi đấu hết mình.',
          'Tự tin giải quyết tình huống trên sân.',
        ],
        progression: 'Tổng kết và nhận xét rút kinh nghiệm cùng toàn đội sau trận đấu.',
      },
    ];
  }

  // Construct final conforming phases
  const phases = phasesData.map((p, idx) => ({
    id: `phase-${idx + 1}`,
    phase: p.phase,
    exerciseName: p.exerciseName,
    duration: durations[idx],
    players: players,
    area: p.area,
    equipment: p.equipment,
    organization: `${p.organization} ${formatFromOrganization(players, toPlayerOrganization(players, blockTypes[idx]))}.`,
    execution: p.execution,
    coachingPoints: p.coachingPoints,
    progression: p.progression,
    playerOrganization: toPlayerOrganization(players, blockTypes[idx]),
  }));

  return {
    sessionTitle: title,
    mainObjective: objective,
    players,
    duration,
    ageGroup: 'Bóng đá cộng đồng / Phong trào',
    sessionOverview: `Buổi tập ${duration} phút gồm 5 giai đoạn liên hoàn dành cho ${players} cầu thủ, tối ưu hóa thời gian tiếp xúc bóng và hạn chế tối đa đứng chờ.`,
    phases,
  };
}

// API endpoint to generate football training plan with Gemini + resilient fallback
app.post('/api/generate-plan', async (req: Request, res: Response) => {
  try {
    const { players, trainingFocus, duration } = req.body ?? {};

    // 1. Validation before calling API
    const playerCount = Number(players);
    if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 50) {
      return res.status(400).json({
        error: 'Số lượng cầu thủ phải từ 4 đến 50 cầu thủ.',
      });
    }

    if (!trainingFocus || typeof trainingFocus !== 'string' || !trainingFocus.trim()) {
      return res.status(400).json({
        error: 'Nội dung tập luyện không được để trống.',
      });
    }

    const durationNum = Number(duration);
    if (![60, 75, 90].includes(durationNum)) {
      return res.status(400).json({
        error: 'Thời lượng buổi tập phải là 60, 75 hoặc 90 phút.',
      });
    }

    const cleanFocus = trainingFocus.trim();

    const prompt = `Số lượng cầu thủ: ${playerCount}
Nội dung tập luyện: ${cleanFocus}
Thời lượng: ${durationNum} phút

Hãy tạo một giáo án bóng đá phù hợp với các thông tin trên và trả về đúng JSON theo cấu trúc được yêu cầu.`;

    let parsedPlan: any = null;

    // 2. Attempt Gemini generation with fast fallback
    const modelsToTry = [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.8-flash"
];

    for (const model of ai ? modelsToTry : []) {
      try {
        const response = await ai!.models.generateContent({
          model,
          contents: prompt,
          config: {
            abortSignal: AbortSignal.timeout(GEMINI_MODEL_TIMEOUT_MS),
            httpOptions: { timeout: GEMINI_MODEL_TIMEOUT_MS },
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: TRAINING_PLAN_SCHEMA,
          },
        });

        if (response && response.text) {
          const raw = JSON.parse(response.text);
          if (validateGeminiPlan(raw).ok) {
            parsedPlan = { ...raw, generationSource: 'gemini' };
            console.log(`Successfully generated training plan with model: ${model}`);
            break;
          }
          console.warn(`[gemini] Invalid response from ${model}`, validateGeminiPlan(raw).errors);
        }
      } catch (err: any) {
        console.warn(`[gemini] Model ${model} failed`, { status: err?.status, name: err?.name });
        // Continue to next model without long blocking
      }
    }

    // 3. Resilient fallback generator if upstream AI models encounter quota exhaustion or temporary spikes
    if (!parsedPlan) {
      console.log('Using resilient community football plan generator for request.');
      parsedPlan = { ...generateRealisticFootballPlan(playerCount, cleanFocus, durationNum), generationSource: 'fallback' };
    }

    const safePlan = sanitizeGeminiPlan(parsedPlan, { topic: cleanFocus, players: playerCount, duration: durationNum as SessionDuration });
    if (!safePlan) throw new Error('Invalid generated plan');
    return res.json(safePlan);
  } catch (error: any) {
    console.error('[generate-plan] Failed to generate plan', { name: error?.name });
    return res.status(500).json({ error: 'Không thể tạo giáo án lúc này. Vui lòng thử lại.' });
  }
});

app.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[api] Request failed', { status: error?.status, name: error?.name });
  res.status(error?.status === 400 ? 400 : 500).json({ error: 'Yêu cầu không hợp lệ. Vui lòng thử lại.' });
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
