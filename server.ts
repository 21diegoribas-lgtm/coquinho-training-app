import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { toPlayerOrganization, formatFromOrganization } from './src/services/playerAccounting.ts';
import { normalizeDurationsToTotal } from './src/services/durationUtils.ts';
import { sanitizeGeminiPlan, validateGeminiPlan } from './src/services/planValidation.ts';
import { BlockType, GameFormat, SessionDuration } from './src/types/session.ts';

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
const GEMINI_MODEL_TIMEOUT_MS = 25000;

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
    gameFormat: {
      type: Type.STRING,
      description: 'Loại hình thi đấu / sân (Futsal 5v5, 7v7, 9v9, hoặc 11v11)',
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
    'gameFormat',
    'phases',
  ],
};

const SYSTEM_INSTRUCTION = `Bạn là Giám đốc kỹ thuật & Chuyên gia đào tạo HLV bóng đá cộng đồng/phong trào chuyên nghiệp.
Nhiệm vụ của bạn là xây dựng giáo án huấn luyện bóng đá chi tiết, có tính sư phạm và giá trị thực chiến cao, tập trung tuyệt đối vào mục tiêu chuyên môn cụ thể của buổi tập.

NGUYÊN TẮC HUẤN LUYỆN CỐT LÕI (CORE COACHING PRINCIPLES):
1. MỤC TIÊU XUYÊN SUỐT: Mọi bài tập từ khởi động đến trận đấu kết thúc đều phải xoay quanh và lặp đi lặp lại hành vi kỹ-chiến thuật của chủ đề, không được biến thành bài tập chung chung.
2. TẦN SUẤT TIẾP XÚC BÓNG CAO (HIGH REPETITIONS): Tối đa hóa số lần chạm bóng và ra quyết định của từng cá nhân. Tuyệt đối tránh để cầu thủ đứng xếp hàng chờ đợi lâu.
3. TIẾN TRÌNH HUẤN LUYỆN LOGIC (PROGRESSION):
   - Giai đoạn 1 (Khởi động / Kích hoạt): Nhận thức không gian, làm quen cảm giác bóng, thói quen quan sát và tư thế cơ thể cơ bản với áp lực thấp.
   - Giai đoạn 2 (Kỹ thuật chuyên biệt): Chia nhiều nhóm nhỏ/trạm song song để tăng số lần lặp lại; nhận bóng từ nhiều góc độ khác nhau; nhấn mạnh tư thế thân người và chạm bước một.
   - Giai đoạn 3 (Kỹ năng có đối kháng): Tình huống đối kháng thực tế có định hướng (ví dụ: 2v1, 3v2, 3v1, nhận bóng giữa các tuyến/between the lines).
   - Giai đoạn 4 (Trò chơi đối kháng nhỏ - Small-sided game): Sân thu nhỏ có thưởng điểm cụ thể khi cầu thủ thực hiện thành công hành vi mục tiêu.
   - Giai đoạn 5 (Trận đấu thực chiến có điều kiện): Trận đấu có luật tính điểm hoặc ràng buộc chiến thuật để kiểm tra xem hành vi mục tiêu có xuất hiện trong thi đấu thực tế không (TUYỆT ĐỐI TRÁNH "thi đấu tự do" vô điều kiện).
4. QUY TẮC LOẠI HÌNH THI ĐẤU (GAME FORMAT INFLUENCE):
   - Kích thước sân tập (Drill dimensions): Phải tương thích với bối cảnh loại hình thi đấu:
     + Futsal 5v5: Không gian cô đọng, hẹp (Khởi động 15-20 × 12-15 m; Kỹ thuật 15-18 × 12-15 m; Kỹ năng 20-25 × 15-18 m; Trò chơi nhỏ 25-30 × 18-20 m; Thi đấu: Sân Futsal 38-40 × 18-20 m). Tránh hoàn toàn kích thước sân cỏ lớn.
     + 7v7: Kích thước vừa phải, định hướng tam giác và góc hỗ trợ (Khởi động 20-25 × 20 m; Kỹ thuật 20-25 × 20-25 m; Kỹ năng 30-35 × 25 m; Trò chơi nhỏ 35-40 × 28-30 m; Thi đấu: Sân 7 người 50-55 × 30-35 m).
     + 9v9: Không gian mở rộng hơn về chiều ngang và chiều sâu (Khởi động 25-30 × 25 m; Kỹ thuật 30-35 × 25-30 m; Kỹ năng 40-45 × 30-35 m; Trò chơi nhỏ 45-50 × 35-40 m; Thi đấu: Sân 9 người 65-70 × 45-50 m).
     + 11v11: Không gian rộng lớn, liên kết giữa các tuyến (Khởi động 30-35 × 30 m; Kỹ thuật 35-40 × 30-35 m; Kỹ năng 45-55 × 40-45 m; Trò chơi nhỏ 55-65 × 45-50 m; Thi đấu: Nửa sân 11 người 60-65 × 45-55 m hoặc sân lớn tùy số lượng cầu thủ).
   - Tổ chức nhóm (Group organization):
     + Trong các giai đoạn kỹ thuật: LUÔN ưu tiên lặp lại nhiều lần bằng các nhóm nhỏ (3-4 người/nhóm) hoặc nhiều trạm kỹ thuật song song, NGAY CẢ KHI chọn loại hình 11v11 (Ví dụ: 16 cầu thủ + 11v11 vẫn phải chia 4 nhóm 4 để tối đa hóa số lần chạm bóng, TUYỆT ĐỐI KHÔNG gom 1 nhóm lớn đứng chờ).
   - Trận đấu cuối cùng (Final game format & Player count rule):
     + QUY TẮC SỐ LƯỢNG CẦU THỦ BẮT BUỘC: gameFormat TUYỆT ĐỐI KHÔNG ĐƯỢC làm sai lệch hoặc bịa thêm số lượng cầu thủ có mặt thực tế. Toàn bộ số cầu thủ tham gia buổi tập PHẢI được sắp xếp đầy đủ.
     + Nếu số lượng cầu thủ ít hơn chuẩn của loại hình (ví dụ 16 cầu thủ chọn 11v11): BẮT BUỘC thiết kế thể thức thu nhỏ đại diện (reduced representative format) như 8v8 hoặc 7v7 + 2 Joker, mô phỏng các mối quan hệ tuyến của 11v11. TUYỆT ĐỐI KHÔNG tự bịa ra 22 cầu thủ!
     + Ví dụ: 10 cầu thủ + Futsal 5v5 -> 5v5; 14 cầu thủ + 7v7 -> 7v7; 18 cầu thủ + 9v9 -> 9v9; 16 cầu thủ + 11v11 -> 8v8 (hoặc 7v7 + 2 Joker).
5. KHÔNG DÙNG TỪ NGỮ CHUNG CHUNG:
   - CẤM các câu mơ hồ như: "Chơi tự do", "Kiểm soát bóng", "Tập chuyền bóng", "Tận dụng khoảng trống".
   - BẮT BUỘC mô tả chi tiết vận hành: Vị trí xuất phát của từng cầu thủ, bóng bắt đầu từ đâu, người nhận bóng làm gì (tư thế, chân nhận, hướng quan sát), luân chuyển tiếp theo thế nào, cơ chế xoay tua vị trí và cách tính điểm/thưởng điểm cụ thể.
6. PHÂN BỔ QUÂN SỐ VÀ CẤU TRÚC NHÓM:
   - Ưu tiên nhóm nhỏ (3-4 người) hoặc chia 2-3 sân mini song song trong các giai đoạn kỹ thuật & đối kháng kỹ năng để không ai phải đứng ngoài.
   - Nếu số lượng cầu thủ không chia đều, bố trí cầu thủ làm Joker (tự do) tham gia cùng đội kiểm soát bóng hoặc quy định xoay tua nhanh theo lượt chuyền.
7. ĐIỂM HUẤN LUYỆN (COACHING POINTS):
   - Phải nêu rõ hành vi cụ thể của cầu thủ (Perception -> Decision -> Action: Cầu thủ quan sát gì? Ra quyết định gì? Thực hiện động tác ra sao?).
   - Không lặp lại nguyên văn một câu chữ qua các giai đoạn; mỗi giai đoạn phải phản ánh độ khó và áp lực tương ứng.
8. NGÔN NGỮ: Sử dụng thuật ngữ bóng đá tiếng Việt tự nhiên, trực quan, dễ hiểu bên đường pitch (ví dụ: "kiểm tra vai", "mở thân người góc 45 độ", "chân xa", "chạm bước một định hướng", "chuyền xuyên tuyến").
9. ĐỊNH DẠNG: Trả về duy nhất dữ liệu JSON hợp lệ theo schema yêu cầu, không thêm bất kỳ văn bản giải thích nào khác.`;

function getGameFormatGuidelines(gameFormat: string, playerCount: number): {
  dimensionsGuideline: string;
  groupOrgGuideline: string;
  finalGameGuideline: string;
} {
  const perSide = Math.floor(playerCount / 2);
  const remainder = playerCount % 2;

  switch (gameFormat) {
    case 'Futsal 5v5': {
      const finalStructure = remainder === 0
        ? (playerCount === 10 ? '5v5 Futsal tiêu chuẩn' : `${perSide}v${perSide} Futsal`)
        : `${perSide}v${perSide} (+1 Joker tự do)`;
      return {
        dimensionsGuideline: `KÍCH THƯỚC KHU VỰC TẬP (FUTSAL 5V5 - KHÔNG GIAN HẸP):
- Đặc trưng: Không gian cô đọng, cự ly hẹp để kích thích phản xạ nhanh và chạm bước một tinh tế.
- Khởi động: 15-20 × 12-15 m
- Kỹ thuật: 15-18 × 12-15 m (chia các trạm nhỏ)
- Kỹ năng / Đối kháng: 20-25 × 15-18 m (có định hướng cự ly ngắn)
- Trò chơi nhỏ (SSG): 25-30 × 18-20 m (4 cầu môn nhỏ hoặc 2 khung thành Futsal)
- Trận đấu cuối: Sân Futsal tiêu chuẩn 38-40 × 18-20 m.
- CẢNH BÁO: TUYỆT ĐỐI TRÁNH kích thước sân cỏ lớn (như 50m hay 60m) không phù hợp với Futsal.`,
        groupOrgGuideline: `TỔ CHỨC NHÓM (FUTSAL 5V5):
- Ưu tiên nhóm rất nhỏ (2-3 cầu thủ), rondo 3v1, 2v1, 4v2 hoặc đối kháng 2v2 / 3v3 nhiều sân mini.
- Tần suất chạm bóng và số lần lặp lại phải cực cao, bóng luân chuyển liên tục, không ai đứng chờ.`,
        finalGameGuideline: `TRẬN ĐẤU CUỐI (FUTSAL 5V5):
- Mô phỏng cấu trúc trận đấu Futsal 5v5 với đúng ${playerCount} cầu thủ có mặt: ${finalStructure} trên sân Futsal (38-40 × 18-20 m).
- TUYỆT ĐỐI KHÔNG bịa thêm cầu thủ. Áp dụng luật Futsal và điều kiện tính điểm chuyên đề.`,
      };
    }
    case '7v7': {
      const finalStructure = remainder === 0
        ? (playerCount === 14 ? '7v7 hoàn chỉnh' : `${perSide}v${perSide}`)
        : `${perSide}v${perSide} (+1 Joker tự do)`;
      return {
        dimensionsGuideline: `KÍCH THƯỚC KHU VỰC TẬP (SÂN 7V7 - CỰ LY ĐỊNH HƯỚNG TAM GIÁC):
- Đặc trưng: Không gian cự ly trung bình, tối ưu hóa các khối tam giác và góc liên kết sân 7.
- Khởi động: 20-25 × 20 m
- Kỹ thuật: 20-25 × 20-25 m (nhiều trạm kim cương/tam giác)
- Kỹ năng / Đối kháng: 30-35 × 25 m (chia làn hoặc khu vực chuyển đổi)
- Trò chơi nhỏ (SSG): 35-40 × 28-30 m (có cầu môn nhỏ hoặc cầu môn sân 7)
- Trận đấu cuối: Sân 7 người tiêu chuẩn 50-55 × 30-35 m.`,
        groupOrgGuideline: `TỔ CHỨC NHÓM (SÂN 7V7):
- Nhóm kỹ thuật: 3-4 cầu thủ (tổ tam giác 3v1, 4v2 hoặc 2 trạm kỹ thuật song song).
- Giai đoạn kỹ năng: 3v2, 4v3, hoặc 2 sân nhỏ 3v3/4v4 để duy trì số lần chạm bóng cao cho toàn bộ ${playerCount} cầu thủ.`,
        finalGameGuideline: `TRẬN ĐẤU CUỐI (SÂN 7V7):
- Phản ánh không gian và cự ly sân 7 người với đúng ${playerCount} cầu thủ: ${finalStructure} trên sân 7 người (50-55 × 30-35 m).
- TUYỆT ĐỐI KHÔNG bịa thêm cầu thủ. Toàn bộ ${playerCount} cầu thủ đều tham gia thi đấu (chia 2 đội cân bằng + Joker nếu lẻ).`,
      };
    }
    case '9v9': {
      const finalStructure = remainder === 0
        ? (playerCount === 18 ? '9v9 hoàn chỉnh' : `${perSide}v${perSide} định hướng 9v9`)
        : `${perSide}v${perSide} (+1 Joker tự do)`;
      return {
        dimensionsGuideline: `KÍCH THƯỚC KHU VỰC TẬP (SÂN 9V9 - MỞ RỘNG CHIỀU NGANG VÀ CHIỀU SÂU):
- Đặc trưng: Mở rộng chiều ngang và chiều sâu để rèn luyện cự ly chuyền trung bình, đổi cánh và khai thác nách trung lộ.
- Khởi động: 25-30 × 25 m
- Kỹ thuật: 30-35 × 25-30 m (tổ hợp mở biên và xuyên tuyến)
- Kỹ năng / Đối kháng: 40-45 × 30-35 m (có chiều sâu chuyển trạng thái)
- Trò chơi nhỏ (SSG): 45-50 × 35-40 m (hai cầu môn có thủ môn)
- Trận đấu cuối: Sân 9 người tiêu chuẩn 65-70 × 45-50 m.`,
        groupOrgGuideline: `TỔ CHỨC NHÓM (SÂN 9V9):
- Giai đoạn kỹ thuật: VẪN PHẢI ƯU TIÊN LẶP LẠI CAO (chia nhóm 3-4 người hoặc nhiều trạm song song), KHÔNG dồn nhóm lớn đứng chờ.
- Giai đoạn kỹ năng: Cho phép mở rộng nhóm 4v4+2, 5v4 hoặc chia 2 sân mini song song để mọi cầu thủ đều hoạt động liên tục.`,
        finalGameGuideline: `TRẬN ĐẤU CUỐI (SÂN 9V9):
- Phản ánh mối quan hệ chiến thuật và chiều sâu của sân 9 người với đúng ${playerCount} cầu thủ: ${finalStructure} trên sân 9 người (65-70 × 45-50 m).
- TUYỆT ĐỐI KHÔNG bịa thêm cầu thủ.`,
      };
    }
    case '11v11': {
      const finalStructure = remainder === 0
        ? `${perSide}v${perSide} (Thể thức thu nhỏ đại diện - Reduced representative format)`
        : `${perSide}v${perSide} (+1 Joker tự do mô phỏng trục giữa 11v11)`;
      return {
        dimensionsGuideline: `KÍCH THƯỚC KHU VỰC TẬP (11V11 - KHÔNG GIAN LỚN & LIÊN KẾT TUYẾN):
- Đặc trưng: Không gian mở rộng, khoảng cách chuyền xa hơn, liên kết giữa các tuyến (hậu vệ - tiền vệ - tiền đạo).
- Khởi động: 30-35 × 30 m (kích hoạt cự ly di chuyển rộng)
- Kỹ thuật: 35-40 × 30-35 m (chia 3-4 trạm nhỏ song song để tối đa hóa số lần chạm bóng)
- Kỹ năng / Đối kháng: 45-55 × 40-45 m (nhận bóng xuyên tuyến, liên kết khối)
- Trò chơi nhỏ (SSG): 55-65 × 45-50 m (đối kháng có chiều sâu)
- Trận đấu cuối: Nửa sân 11 người (60-65 × 45-55 m) hoặc sân lớn có cự ly tổ chức theo tuyến đại diện 11v11.`,
        groupOrgGuideline: `TỔ CHỨC NHÓM (11V11 - ĐẶC BIỆT LƯU Ý):
- NGUYÊN TẮC BẮT BUỘC: Giai đoạn kỹ thuật KHÔNG ĐƯỢC tổ chức thành một nhóm lớn duy nhất chỉ vì là 11v11! PHẢI chia thành các nhóm nhỏ (ví dụ: 16 người chia 4 nhóm 4; 18 người chia 6 nhóm 3 hoặc 4 nhóm 4+2) để đảm bảo tần suất lặp lại kỹ thuật cao nhất.
- Giai đoạn kỹ năng & đối kháng: Tận dụng không gian rộng để rèn luyện thói quen mở thân người, nhận bóng giữa các tuyến và chuyển hướng tấn công.`,
        finalGameGuideline: `TRẬN ĐẤU CUỐI (11V11 - QUY TẮC THỂ THỨC ĐẠI DIỆN):
- QUY TẮC SỐ LƯỢNG CẦU THỦ BẮT BUỘC: Loại hình 11v11 đại diện cho bối cảnh thi đấu, TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA RA 22 CẦU THỦ!
- CHỈ ĐƯỢC SỬ DỤNG ĐÚNG ${playerCount} CẦU THỦ CÓ MẶT để tổ chức thể thức thu nhỏ đại diện (Reduced representative game: ${finalStructure}) trên nửa sân lớn 60-65 × 45-55 m.
- Các cầu thủ được bố trí theo cấu trúc các tuyến (ví dụ: hậu vệ - tiền vệ - tiền đạo thu nhỏ) để trải nghiệm không gian và áp lực chiến thuật của 11v11.`,
      };
    }
    default:
      return getGameFormatGuidelines('7v7', playerCount);
  }
}

function buildCoachingPrompt(
  playerCount: number,
  cleanFocus: string,
  durationNum: number,
  gameFormat: string = '7v7'
): string {
  const lower = cleanFocus.toLowerCase();

  let topicGuidelines = '';
  if (lower.includes('nhận bóng') || lower.includes('mở') || lower.includes('quan sát')) {
    topicGuidelines = `
CHUYÊN ĐỀ "NHẬN BÓNG MỞ THÂN NGƯỜI & QUAN SÁT KHÔNG GIAN":
- Hành vi mong đợi của cầu thủ:
  + Quan sát vai (scan/kiểm tra vai) trước khi bóng đến để nhận biết khoảng trống và áp lực của đối phương.
  + Đứng tư thế mở thân người góc 45 độ (half-turn) để nhìn thấy cả bóng lẫn hướng tấn công.
  + Đón bóng bằng chân xa (back foot) khi có khoảng trống để sẵn sàng tịnh tiến bóng lên phía trước.
  + Chạm bước một có định hướng (directional first touch) vào khoảng trống có lợi thay vì hãm chết bóng tại chỗ.
  + Nhận biết thời điểm có áp lực từ phía sau để nhả bóng 1 chạm hoặc che chắn, và khi có khoảng trống thì xoay người tiến lên.
  + Chơi bóng về phía trước (play forward) ngay khi có cơ hội.
- CẢNH BÁO: KHÔNG ĐƯỢC thiết kế như một bài chuyền bóng rondo ma thụ động thông thường. Buổi tập phải có hướng tịnh tiến bóng rõ ràng từ đầu đến cuối.`;
  } else if (lower.includes('giữa các tuyến') || lower.includes('between lines')) {
    topicGuidelines = `
CHUYÊN ĐỀ "NHẬN BÓNG GIỮA CÁC TUYẾN (RECEIVING BETWEEN THE LINES)":
- Hành vi mong đợi của cầu thủ:
  + Căn thời điểm (timing) di chuyển vào "túi không gian" (pocket of space) giữa hàng tiền vệ và hậu vệ đối phương.
  + Đứng tư thế nửa thân người (half-turn) hướng về phía cầu môn đối phương trước khi bóng tới.
  + Nhận bóng bằng chân xa để sẵn sàng xoay người đột phá hoặc chọc khe tiếp theo.
  + Nhận biết áp lực từ lưng để ra quyết định: xoay người tịnh tiến nếu có khoảng trống, nhả bóng lại 1 chạm (lay-off) nếu bị áp sát.`;
  } else if (lower.includes('pressing') || lower.includes('áp sát') || lower.includes('đoạt bóng')) {
    topicGuidelines = `
CHUYÊN ĐỀ "PRESSING TẦM CAO & VÂY BẮT ĐOẠT BÓNG":
- Hành vi mong đợi của cầu thủ:
  + Nhận diện tín hiệu kích hoạt pressing (pressing trigger): bóng bay bổng, đối thủ quay lưng, đường chuyền non, đối thủ đỡ bóng lỗi.
  + Cầu thủ gần nhất áp sát nhanh, hạ trọng tâm, dùng cơ thể che hướng chuyền nguy hiểm nhất (bẻ hướng đối thủ vào bẫy).
  + Các cầu thủ xung quanh lập tức thu hẹp cự ly đội hình, khóa chặt các lựa chọn chuyền bóng gần nhất của đối thủ.
  + Khi đoạt được bóng: lập tức chuyển đổi trạng thái tấn công nhanh hoặc giữ bóng an toàn thoát áp lực.`;
  } else if (lower.includes('1v1') || lower.includes('qua người') || lower.includes('rê bóng') || lower.includes('dẫn bóng')) {
    topicGuidelines = `
CHUYÊN ĐỀ "1V1 QUA NGƯỜI / ĐẤU TAY ĐÔI TẤN CÔNG":
- Hành vi mong đợi của cầu thủ:
  + Dẫn bóng chủ động tấn công vào khoảng trống trước mặt người phòng ngự.
  + Thay đổi nhịp độ (hãm bóng rồi bứt tốc), hạ thấp trọng tâm khi thực hiện động tác giả.
  + Đọc hướng đứng chân của hậu vệ để khai thác chân trụ yếu của đối thủ.
  + Ra quyết định dứt khoát: vượt qua đối thủ hay che chắn giữ bóng; bứt tốc thoát hẳn sau khi qua người.
- Tổ chức: Chia nhiều làn 1v1 song song (ví dụ: 3-4 làn đối đầu 1v1) để tối đa hóa số lần đối đầu, không để cầu thủ xếp hàng dài.`;
  } else if (lower.includes('chuyền') || lower.includes('di chuyển') || lower.includes('phối hợp')) {
    topicGuidelines = `
CHUYÊN ĐỀ "CHUYỀN BÓNG VÀ DI CHUYỂN HỖ TRỢ":
- Hành vi mong đợi của cầu thủ:
  + Chuyền bóng đúng lực, đúng chân thuận của đồng đội, đường chuyền có thông điệp (chuyền vào chân để giữ hay chuyền vào khoảng trống để chạy).
  + Di chuyển hỗ trợ ngay sau khi chuyền bóng (pass and move), không đứng yên nhìn bóng.
  + Tạo các góc chuyền hình tam giác và hình kim cương; phối hợp người thứ 3 (third-man run).
  + Quan sát không gian trước khi nhận bóng để duy trì nhịp độ luân chuyển nhanh.`;
  } else {
    topicGuidelines = `
CHUYÊN ĐỀ "${cleanFocus}":
- Xây dựng buổi tập xoay quanh hành vi kỹ-chiến thuật cụ thể nhất của "${cleanFocus}".
- Mỗi bài tập phải giải quyết: Cầu thủ quan sát thấy gì? Cần ra quyết định gì? Hành động kỹ thuật nào được kích hoạt?`;
  }

  const formatGuidelines = getGameFormatGuidelines(gameFormat, playerCount);

  return `YÊU CẦU THIẾT KẾ GIÁO ÁN BÓNG ĐÁ CHUYÊN SÂU:
- Số lượng cầu thủ: ${playerCount} cầu thủ (BẮT BUỘC: chỉ sử dụng đúng ${playerCount} cầu thủ, KHÔNG ĐƯỢC thêm bớt)
- Chủ đề trọng tâm: ${cleanFocus}
- Tổng thời lượng buổi tập: ${durationNum} phút (Tổng duration của các phases PHẢI BẰNG CHÍNH XÁC ${durationNum} phút)
- Loại hình thi đấu / sân: ${gameFormat}
${topicGuidelines}

HƯỚNG DẪN LOẠI HÌNH THI ĐẤU (${gameFormat}) & QUÂN SỐ (${playerCount} CẦU THỦ):
1. ${formatGuidelines.dimensionsGuideline}

2. ${formatGuidelines.groupOrgGuideline}

3. ${formatGuidelines.finalGameGuideline}

YÊU CẦU BẮT BUỘC ĐỐI VỚI NỘI DUNG TỪNG BÀI TẬP:
- exerciseName: Tên bài tập cụ thể, thể hiện rõ thể thức và tính chất chuyên môn.
- area: Kích thước sân (dài x rộng m) PHẢI TUÂN THỦ dải kích thước của ${gameFormat} nêu trên, tránh kích thước phi thực tế.
- organization: Ghi rõ số lượng nhóm, bố trí sân bãi, phân chia toàn bộ ${playerCount} cầu thủ không bỏ sót ai. Trong giai đoạn kỹ thuật, ưu tiên nhiều nhóm nhỏ để tối đa số lần lặp lại.
- execution: Hướng dẫn vận hành chi tiết: bóng phát ra từ đâu, di chuyển thế nào, yêu cầu kỹ thuật đối với người nhận bóng, điều kiện ghi điểm, cơ chế luân chuyển xoay tua giữa các cầu thủ.
- coachingPoints: 3-4 câu khẩu lệnh chuyên môn ngắn gọn, chỉ rõ tư thế cơ thể, cách quan sát và xử lý bóng (không lặp lại câu chữ giữa các giai đoạn).
- progression: 1-2 biến thể điều chỉnh độ khó hợp lý (giới hạn chạm, tăng/giảm khoảng cách, bổ sung hậu vệ gây áp lực).
- Giai đoạn cuối cùng (Thi đấu): Bắt buộc có luật thưởng điểm hoặc điều kiện chiến thuật gắn trực tiếp với chủ đề "${cleanFocus}". TUYỆT ĐỐI KHÔNG để thi đấu tự do thông thường.

Hãy tạo giáo án xuất sắc, chuẩn mực sư phạm và trả về đúng định dạng JSON yêu cầu.`;
}

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
  duration: number,
  gameFormat: string = '7v7'
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
        execution: 'Trận đấu có điều kiện mục tiêu: Thi đấu 2 đội trên toàn sân có thủ môn. Áp dụng luật tính điểm: Bàn thắng bình thường tính 1 điểm; bàn thắng xuất phát từ pha nhận bóng mở thân người tịnh tiến qua tuyến đối phương tính 2 điểm.',
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

  // Format-aware dimensions and match adaptations
  let defaultAreas: [string, string, string, string, string];
  let finalGameExerciseName: string;
  let finalGameArea: string;
  const perSide = Math.floor(players / 2);
  const remainder = players % 2;

  if (gameFormat === 'Futsal 5v5') {
    defaultAreas = [
      '18 × 15 m (Không gian hẹp Futsal)',
      '16 × 14 m (Khu vực kỹ thuật cô đọng)',
      '22 × 16 m (Định hướng cự ly ngắn)',
      '28 × 18 m (Đối kháng sân nhỏ Futsal)',
      '38 × 20 m (Sân Futsal tiêu chuẩn)',
    ];
    finalGameExerciseName = remainder === 0
      ? (players === 10 ? 'Trận đấu Futsal 5v5 tiêu chuẩn' : `Thi đấu Futsal ${perSide}v${perSide}`)
      : `Thi đấu Futsal ${perSide}v${perSide} (+1 Joker tự do)`;
    finalGameArea = '38 × 20 m (Sân Futsal tiêu chuẩn)';
  } else if (gameFormat === '9v9') {
    defaultAreas = [
      '28 × 25 m (Khu vực mở rộng cự ly 9v9)',
      '32 × 28 m (Tổ hợp phối hợp trung bình)',
      '42 × 32 m (Liên kết chuyển hướng rộng)',
      '48 × 36 m (Đối kháng mở rộng biên)',
      '68 × 48 m (Sân 9 người tiêu chuẩn)',
    ];
    finalGameExerciseName = remainder === 0
      ? (players === 18 ? 'Trận đấu 9v9 hoàn chỉnh toàn sân' : `Trận đấu 9v9 thu nhỏ: ${perSide}v${perSide}`)
      : `Trận đấu 9v9: ${perSide}v${perSide} (+1 Joker tự do)`;
    finalGameArea = '68 × 48 m (Sân 9 người tiêu chuẩn)';
  } else if (gameFormat === '11v11') {
    defaultAreas = [
      '30 × 30 m (Khu vực cự ly mở rộng 11v11)',
      '35 × 30 m (Chia nhiều trạm kỹ thuật song song)',
      '48 × 40 m (Liên kết cự ly giữa các tuyến)',
      '55 × 45 m (Đối kháng không gian lớn)',
      '65 × 50 m (Nửa sân 11 người tiêu chuẩn)',
    ];
    finalGameExerciseName = remainder === 0
      ? (players >= 22 ? 'Trận đấu 11v11 hoàn chỉnh toàn sân' : `Thi đấu thể thức đại diện 11v11: ${perSide}v${perSide}`)
      : `Thi đấu thể thức đại diện 11v11: ${perSide}v${perSide} (+1 Joker)`;
    finalGameArea = '65 × 50 m (Nửa sân 11 người tiêu chuẩn)';
  } else {
    // 7v7 default
    defaultAreas = [
      '25 × 20 m (Khu vực sân 7)',
      '22 × 20 m (Tổ hợp cự ly ngắn-trung bình)',
      '35 × 25 m (Chia khu vực chuyển đổi)',
      '40 × 30 m (4 cầu môn nhỏ ở 4 góc)',
      '55 × 35 m (Sân 7 người tiêu chuẩn)',
    ];
    finalGameExerciseName = remainder === 0
      ? (players === 14 ? 'Trận đấu 7v7 hoàn chỉnh trên sân 7' : `Trận đấu đối kháng sân 7: ${perSide}v${perSide}`)
      : `Trận đấu đối kháng sân 7: ${perSide}v${perSide} (+1 Joker tự do)`;
    finalGameArea = '55 × 35 m (Sân 7 người tiêu chuẩn)';
  }

  // Construct final conforming phases
  const phases = phasesData.map((p, idx) => ({
    id: `phase-${idx + 1}`,
    phase: p.phase,
    exerciseName: idx === 4 ? finalGameExerciseName : p.exerciseName,
    duration: durations[idx],
    players: players,
    area: idx === 4 ? finalGameArea : defaultAreas[idx],
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
    gameFormat,
    ageGroup: 'Bóng đá cộng đồng / Phong trào',
    sessionOverview: `Buổi tập ${duration} phút gồm 5 giai đoạn liên hoàn dành cho ${players} cầu thủ, tối ưu hóa thời gian tiếp xúc bóng và hạn chế tối đa đứng chờ.`,
    phases,
  };
}

// API endpoint to generate football training plan with Gemini + resilient fallback
app.post('/api/generate-plan', async (req: Request, res: Response) => {
  try {
    const { players, trainingFocus, duration, gameFormat } = req.body ?? {};

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

    const ALLOWED_GAME_FORMATS: GameFormat[] = ['Futsal 5v5', '7v7', '9v9', '11v11'];
    let cleanGameFormat: GameFormat = '7v7';
    if (gameFormat !== undefined && gameFormat !== null && gameFormat !== '') {
      if (!ALLOWED_GAME_FORMATS.includes(gameFormat)) {
        return res.status(400).json({
          error: 'Loại hình thi đấu không hợp lệ. Chỉ chấp nhận: Futsal 5v5, 7v7, 9v9, 11v11.',
        });
      }
      cleanGameFormat = gameFormat;
    }

    const cleanFocus = trainingFocus.trim();
    const prompt = buildCoachingPrompt(playerCount, cleanFocus, durationNum, cleanGameFormat);

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
      parsedPlan = {
        ...generateRealisticFootballPlan(playerCount, cleanFocus, durationNum, cleanGameFormat),
        generationSource: 'fallback',
      };
    }

    const safePlan = sanitizeGeminiPlan(parsedPlan, {
      topic: cleanFocus,
      players: playerCount,
      duration: durationNum as SessionDuration,
      gameFormat: cleanGameFormat,
    });
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
