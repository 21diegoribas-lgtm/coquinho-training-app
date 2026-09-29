import { Exercise, SessionDuration, TrainingSession, PitchDiagramData } from '../types/session';

interface DurationSplit {
  warm_up: number;
  technical: number;
  skill: number;
  small_sided: number;
  match: number;
}

const DURATION_SPLITS: Record<SessionDuration, DurationSplit> = {
  90: {
    warm_up: 15,
    technical: 15,
    skill: 20,
    small_sided: 20,
    match: 20,
  },
  75: {
    warm_up: 10,
    technical: 15,
    skill: 15,
    small_sided: 15,
    match: 20,
  },
  60: {
    warm_up: 10,
    technical: 10,
    skill: 15,
    small_sided: 10,
    match: 15,
  },
};

// Định dạng phân chia quân số theo thuật ngữ bóng đá Việt Nam
export function formatPlayerDistribution(total: number, blockType: Exercise['blockType']): string {
  if (total < 4) total = 4;
  
  switch (blockType) {
    case 'warm_up':
      if (total % 2 === 0) {
        return `${total} Cầu thủ (${total / 2} cặp chuyền bóng cùng lúc)`;
      }
      return `${total} Cầu thủ (Chia cặp + 1 nhóm 3 xoay tua)`;

    case 'technical':
      if (total >= 12 && total % 4 === 0) {
        return `${total} Cầu thủ (${total / 4} nhóm 4 tại các trạm kỹ thuật)`;
      } else if (total % 3 === 0) {
        return `${total} Cầu thủ (${total / 3} nhóm 3 phối hợp tam giác)`;
      } else {
        const half = Math.floor(total / 2);
        return `${total} Cầu thủ (2 nhóm ${half}${total % 2 !== 0 ? ' + 1 cầu thủ tự do' : ''})`;
      }

    case 'skill':
      if (total % 2 === 0) {
        const half = total / 2;
        return `${total} Cầu thủ (${half}v${half} kiểm soát định hướng)`;
      } else {
        const teamSize = Math.floor(total / 2);
        return `${total} Cầu thủ (${teamSize}v${teamSize} + 1 tiền vệ tự do)`;
      }

    case 'small_sided':
      if (total >= 14) {
        const half = Math.floor(total / 2);
        return `${total} Cầu thủ (${half}v${half} đối kháng cầu môn nhỏ)`;
      } else {
        const teamSize = Math.floor(total / 2);
        const remainder = total % 2;
        return `${total} Cầu thủ (${teamSize}v${teamSize}${remainder > 0 ? ' + 1 tự do' : ''} sân hẹp)`;
      }

    case 'match':
      if (total % 2 === 0) {
        const perSide = total / 2;
        return `${total} Cầu thủ (${perSide}v${perSide} thi đấu tự do)`;
      } else {
        const perSide = Math.floor(total / 2);
        return `${total} Cầu thủ (${perSide}v${perSide} + 1 tự do thi đấu luật chuẩn)`;
      }
  }
}

// Tạo dữ liệu sơ đồ sân chiến thuật
function generatePitchDiagram(
  layout: PitchDiagramData['layout'],
  playerCount: number
): PitchDiagramData {
  switch (layout) {
    case 'gates_grid':
      return {
        layout: 'gates_grid',
        cones: [
          { x: 15, y: 25, color: 'orange' }, { x: 25, y: 25, color: 'orange' },
          { x: 75, y: 25, color: 'orange' }, { x: 85, y: 25, color: 'orange' },
          { x: 45, y: 50, color: 'yellow' }, { x: 55, y: 50, color: 'yellow' },
          { x: 20, y: 75, color: 'orange' }, { x: 30, y: 75, color: 'orange' },
          { x: 70, y: 75, color: 'orange' }, { x: 80, y: 75, color: 'orange' },
        ],
        players: [
          { x: 20, y: 35, role: 'teamA', label: '1', targetX: 20, targetY: 22, rotation: 0 },
          { x: 20, y: 15, role: 'teamA', label: '2', targetX: 30, targetY: 20, rotation: 45 },
          { x: 80, y: 35, role: 'teamB', label: '3', targetX: 75, targetY: 25, rotation: 180 },
          { x: 80, y: 15, role: 'teamB', label: '4', targetX: 70, targetY: 18, rotation: 220 },
          { x: 50, y: 40, role: 'neutral', label: 'N', targetX: 50, targetY: 55, rotation: 90, highlight: true },
          { x: 50, y: 65, role: 'teamA', label: '5', targetX: 45, targetY: 72, rotation: 90 },
          { x: 25, y: 85, role: 'teamB', label: '6', targetX: 35, targetY: 80, rotation: 315 },
          { x: 75, y: 85, role: 'teamA', label: '7', targetX: 65, targetY: 80, rotation: 270 },
        ],
        ball: { x: 23, y: 28 },
        arrows: [
          { from: [20, 35], to: [20, 18], type: 'pass' },
          { from: [20, 35], to: [32, 45], type: 'run' },
          { from: [50, 40], to: [50, 60], type: 'pass' },
        ],
      };

    case 'rondo_box':
      return {
        layout: 'rondo_box',
        cones: [
          { x: 25, y: 20, color: 'yellow' }, { x: 75, y: 20, color: 'yellow' },
          { x: 75, y: 80, color: 'yellow' }, { x: 25, y: 80, color: 'yellow' },
        ],
        players: [
          { x: 50, y: 20, role: 'teamA', label: 'A1', targetX: 55, targetY: 20, rotation: 90 },
          { x: 75, y: 50, role: 'teamA', label: 'A2', targetX: 75, targetY: 42, rotation: 180 },
          { x: 50, y: 80, role: 'teamA', label: 'A3', targetX: 45, targetY: 80, rotation: 270 },
          { x: 25, y: 50, role: 'teamA', label: 'A4', targetX: 25, targetY: 58, rotation: 0 },
          { x: 42, y: 46, role: 'teamB', label: 'D1', targetX: 52, targetY: 35, rotation: 45, highlight: true },
          { x: 58, y: 54, role: 'teamB', label: 'D2', targetX: 60, targetY: 60, rotation: 135 },
          { x: 50, y: 50, role: 'neutral', label: 'N', targetX: 48, targetY: 48, rotation: 0 },
        ],
        ball: { x: 50, y: 24 },
        arrows: [
          { from: [50, 24], to: [72, 48], type: 'pass' },
          { from: [42, 46], to: [60, 48], type: 'run' },
          { from: [50, 80], to: [50, 65], type: 'run' },
        ],
      };

    case 'channel_play':
      return {
        layout: 'channel_play',
        cones: [
          { x: 10, y: 20, color: 'orange' }, { x: 90, y: 20, color: 'orange' },
          { x: 10, y: 80, color: 'orange' }, { x: 90, y: 80, color: 'orange' },
          { x: 35, y: 20, color: 'white' }, { x: 35, y: 80, color: 'white' },
          { x: 65, y: 20, color: 'white' }, { x: 65, y: 80, color: 'white' },
        ],
        goals: [
          { x: 50, y: 15, width: 20, orientation: 'top', isMini: false },
          { x: 50, y: 85, width: 20, orientation: 'bottom', isMini: false },
        ],
        players: [
          { x: 50, y: 18, role: 'gk', label: 'TM' },
          { x: 20, y: 35, role: 'teamA', label: 'C1', targetX: 20, targetY: 45 },
          { x: 50, y: 40, role: 'teamA', label: 'T1', targetX: 50, targetY: 55 },
          { x: 80, y: 35, role: 'teamA', label: 'C2', targetX: 80, targetY: 45 },
          { x: 38, y: 48, role: 'teamB', label: 'H1', targetX: 38, targetY: 40 },
          { x: 62, y: 48, role: 'teamB', label: 'H2', targetX: 62, targetY: 40 },
          { x: 50, y: 62, role: 'teamB', label: 'T2', targetX: 50, targetY: 50 },
          { x: 50, y: 82, role: 'gk', label: 'TM' },
        ],
        ball: { x: 50, y: 43 },
        arrows: [
          { from: [50, 43], to: [24, 37], type: 'pass' },
          { from: [20, 35], to: [20, 55], type: 'dribble' },
          { from: [50, 40], to: [50, 58], type: 'run' },
        ],
      };

    case 'half_pitch':
      return {
        layout: 'half_pitch',
        goals: [
          { x: 50, y: 12, width: 26, orientation: 'top', isMini: false },
          { x: 25, y: 88, width: 14, orientation: 'bottom', isMini: true },
          { x: 75, y: 88, width: 14, orientation: 'bottom', isMini: true },
        ],
        players: [
          { x: 50, y: 15, role: 'gk', label: 'TM' },
          { x: 35, y: 30, role: 'teamB', label: 'TV1' },
          { x: 65, y: 30, role: 'teamB', label: 'TV2' },
          { x: 20, y: 45, role: 'teamB', label: 'HV1' },
          { x: 80, y: 45, role: 'teamB', label: 'HV2' },
          { x: 50, y: 42, role: 'teamB', label: 'HV3' },
          { x: 38, y: 55, role: 'teamA', label: 'TĐ1' },
          { x: 62, y: 55, role: 'teamA', label: 'TĐ2' },
          { x: 50, y: 68, role: 'teamA', label: 'TĐ3' },
          { x: 22, y: 65, role: 'teamA', label: 'C1' },
          { x: 78, y: 65, role: 'teamA', label: 'C2' },
        ],
        ball: { x: 38, y: 58 },
        arrows: [
          { from: [38, 58], to: [50, 66], type: 'pass' },
          { from: [78, 65], to: [68, 45], type: 'run' },
        ],
      };

    case 'full_pitch':
    default:
      return {
        layout: 'full_pitch',
        goals: [
          { x: 50, y: 8, width: 24, orientation: 'top' },
          { x: 50, y: 92, width: 24, orientation: 'bottom' },
        ],
        players: [
          { x: 50, y: 12, role: 'gk', label: 'TM1' },
          { x: 30, y: 25, role: 'teamA', label: 'HV' },
          { x: 70, y: 25, role: 'teamA', label: 'HV' },
          { x: 20, y: 40, role: 'teamA', label: 'TV' },
          { x: 50, y: 38, role: 'teamA', label: 'TV' },
          { x: 80, y: 40, role: 'teamA', label: 'TV' },
          { x: 50, y: 48, role: 'teamA', label: 'TĐ' },
          { x: 50, y: 54, role: 'teamB', label: 'TĐ' },
          { x: 20, y: 60, role: 'teamB', label: 'TV' },
          { x: 50, y: 62, role: 'teamB', label: 'TV' },
          { x: 80, y: 60, role: 'teamB', label: 'TV' },
          { x: 30, y: 75, role: 'teamB', label: 'HV' },
          { x: 70, y: 75, role: 'teamB', label: 'HV' },
          { x: 50, y: 88, role: 'gk', label: 'TM2' },
        ],
        ball: { x: 50, y: 41 },
        arrows: [
          { from: [50, 41], to: [80, 40], type: 'pass' },
          { from: [80, 40], to: [75, 28], type: 'run' },
        ],
      };
  }
}

// Danh mục chủ đề mẫu chuẩn tiếng Việt cho HLV cộng đồng
interface TopicPreset {
  keywords: string[];
  title: string;
  objective: string;
  blocks: {
    blockType: Exercise['blockType'];
    blockName: string;
    exerciseNameVariations: string[];
    areaSize: string;
    equipment: string[];
    organization: string;
    howItWorks: string[];
    coachingPoints: string[];
    diagramLayout: PitchDiagramData['layout'];
  }[];
}

const TOPIC_PRESETS_VI: TopicPreset[] = [
  {
    keywords: ['nhận bóng', 'tư thế mở', 'quan sát', 'open body', 'receiving', 'chạm bước một', 'nửa thân người'],
    title: 'Nhận bóng với tư thế mở & Quan sát không gian',
    objective:
      'Rèn luyện cho cầu thủ thói quen xoay đầu quan sát vai trước khi nhận bóng, mở thân người góc 45 độ về hướng tấn công và thực hiện chạm bước một vào khoảng trống để đẩy nhanh nhịp độ lên bóng.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Chuyền bóng qua cổng nón & Đổi hướng bước một',
          'Khởi động cặp đôi phối hợp kiểm tra vai',
          'Chuyền bóng tam giác kết hợp quan sát điểm mù',
        ],
        areaSize: '25 × 20 m (6 cổng nón)',
        equipment: ['12 Nón tập (2 màu)', '1 Bóng / cặp', 'Áo bib phân đội'],
        organization:
          'Bố trí 6 cổng nón rải đều trên sân 25 × 20 m. Cầu thủ chia cặp chuyền bóng liên tục và tìm các cổng nón còn trống.',
        howItWorks: [
          'Cầu thủ A chuyền bóng qua cổng nón cho cầu thủ B.',
          'Trước khi bóng tới, cầu thủ B phải quan sát qua vai, gọi tên màu cổng nón trống phía sau và chạm bóng mở hướng qua cổng.',
          'Cầu thủ B tăng tốc vào khoảng trống rồi chuyền ngược lại hoặc luân chuyển sang đồng đội khác.',
          'Nâng cao: Không cặp nào được dùng một cổng nón 2 lần liên tiếp.',
        ],
        coachingPoints: [
          'Quan sát vai trước khi nhận bóng (kiểm tra khoảng trống phía sau).',
          'Mở thân người ở góc 45 độ về hướng tấn công để nhìn thấy cả bóng lẫn không gian.',
          'Nhận bóng bằng chân xa (chân thuận lợi để đẩy bóng lên phía trước).',
          'Chạm bước một êm vào khoảng trống, không hãm chết bóng tại chỗ.',
          'Chuyền bóng rồi tiếp tục di chuyển hỗ trợ đồng đội.',
        ],
        diagramLayout: 'gates_grid',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Tổ hợp hình kim cương nhận bóng nửa thân người',
          'Phối hợp chữ Y nhận bóng chân xa',
          'Vòng tròn luân chuyển bóng mở góc liên tục',
        ],
        areaSize: '20 × 20 m hình kim cương',
        equipment: ['5 Nón nấm', '6 Quả bóng', 'Đội hình xoay tua liên tục'],
        organization:
          'Đặt 4 nón ở 4 góc (Bắc, Nam, Đông, Tây) và 1 nón/hình nhân ở trung tâm. Chia đều cầu thủ đứng ở 4 trạm biên.',
        howItWorks: [
          'Bóng xuất phát từ Trạm 1 chuyền vào tiền vệ trung tâm ở nón giữa.',
          'Tiền vệ giả vờ giật lùi thoát kèm, mở góc thân người và nhận bóng qua người bằng chân xa.',
          'Tiền vệ chuyền ngay cho cầu thủ ở trạm cánh tiếp theo.',
          'Người chuyền chạy theo bóng để hoán đổi vị trí liên tục theo chiều kim đồng hồ và ngược lại.',
        ],
        coachingPoints: [
          'Giật thoát khỏi đối phương trước khi quay lại nhận bóng.',
          'Xoay hông về hướng định chuyền tiếp theo trước khi bóng đến chân.',
          'Đường chuyền sệt, căng và đúng vào chân thuận của đồng đội.',
          'Giao tiếp to rõ: hô "Mở!", "Quay!" hoặc "Chân thuận!".',
        ],
        diagramLayout: 'rondo_box',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Kiểm soát bóng 4v4 (+2 tự do) chuyển hướng sang khu vực đích',
          'Đấu kiểm soát 5v5 thoát áp lực về hai biên',
          'Chuyển trạng thái 3 khu vực chú trọng mở người vượt tuyến',
        ],
        areaSize: '35 × 25 m chia 3 khu vực',
        equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu + 2 áo tự do'],
        organization:
          'Sân chia làm 3 khu vực ngang. Hai đội tranh chấp ở giữa cùng với 2 cầu thủ tự do đứng ở hai biên làm điểm đến.',
        howItWorks: [
          'Hai đội tranh chấp bóng và tìm cách chuyển bóng từ biên này sang biên đối diện.',
          'Tính điểm khi một cầu thủ nhận đường chuyền trong khu trung tâm với tư thế mở người và chuyền thành công sang đích đối diện.',
          'Cầu thủ đích chỉ được khống chế tối đa 2 chạm để duy trì nhịp độ nhanh.',
          'Khi phòng ngự đoạt được bóng, phải mở góc chuyền bóng đầu tiên hướng lên phía trước.',
        ],
        coachingPoints: [
          'Căn thời điểm di chuyển vào khoảng trống khi người chuyền ngẩng đầu.',
          'Không bao giờ đứng vuông góc với bóng; luôn giữ ngực hướng về phía mục tiêu.',
          'Quan sát trong khoảnh khắc bóng đang lăn trên đường chuyền.',
          'Nếu bị áp sát rát từ phía sau: nhả bóng 1 chạm; nếu có khoảng trống: quay người tiến lên.',
        ],
        diagramLayout: 'channel_play',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Đối kháng 5v5 / 6v6 ghi điểm cầu môn nhỏ nhân đôi điểm',
          'Đấu đối kháng chuyển hướng tấn công nhanh',
          'Trận đấu nhỏ giới hạn chạm với thưởng điểm mở thân người',
        ],
        areaSize: '40 × 30 m (4 cầu môn nhỏ ở 4 góc)',
        equipment: ['4 Khung thành nhỏ', '10 Quả bóng', 'Áo bib 2 đội'],
        organization:
          'Sân đặt 2 cầu môn nhỏ ở mỗi đầu biên để khuyến khích các đường chuyền đổi cánh chéo góc.',
        howItWorks: [
          'Hai đội thi đấu đối kháng có tính điểm, áp dụng luật ném biên và đá phạt bình thường.',
          'Điều kiện thưởng: Bàn thắng ghi được ngay sau một pha chạm bước một mở góc tiến lên được tính 2 điểm.',
          'Khuyến khích các tiền vệ nhận bóng hướng về khung thành đối phương thay vì quay lưng.',
          'Thi đấu 3 hiệp, mỗi hiệp 5 phút, nghỉ 1 phút để HLV đúc kết nhanh.',
        ],
        coachingPoints: [
          'Nhận biết khoảng trống phía sau hậu vệ đang áp sát.',
          'Chạy theo đường vòng cung thay vì chạy thẳng để tự nhiên tạo tư thế mở người.',
          'Khống chế chân xa giúp mở rộng tầm nhìn về cả hai khung thành mục tiêu.',
          'Cung cấp các góc hỗ trợ chéo, tránh đứng trên cùng một đường thẳng với bóng.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu tự do có can thiệp chiến thuật của HLV',
          'Thi đấu 8v8 / 9v9 kiểm tra thói quen nhận bóng',
          'Trận đấu tự do toàn đội với mục tiêu giữ bóng tiến lên',
        ],
        areaSize: '60 × 40 m (Cầu môn lớn có thủ môn)',
        equipment: ['2 Khung thành lớn', 'Bóng thi đấu', 'Găng thủ môn', 'Áo bib'],
        organization:
          'Chia 2 đội đá đủ vị trí theo quân số thực tế (7v7, 8v8 hoặc 9v9 có thủ môn). Áp dụng luật bóng đá thực tế.',
        howItWorks: [
          'Thi đấu tự do không gò bó điều kiện.',
          'HLV đứng ngoài quan sát xem cầu thủ có tự giác xoay đầu kiểm tra vai và mở thân người khi thi đấu thực chiến không.',
          'HLV nhắc nhở trực tiếp ngay khi tình huống diễn ra mà không ngắt quãng nhịp độ trận đấu.',
        ],
        coachingPoints: [
          'Chuyển hóa các bài tập kỹ thuật vào trận đấu thực tế.',
          'Tiền vệ chủ động tạo khoảng cách với đối phương trước khi xin bóng.',
          'Bước một dứt khoát giúp loại bỏ ngay một hậu vệ theo kèm.',
          'Đánh giá sau trận: Đội đã chơi bóng hướng lên phía trước tốt chưa?',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
  {
    keywords: ['phòng ngự', '1v1', 'tắc bóng', 'kìm hãm', 'defending', 'bọc lót', 'kèm người'],
    title: 'Phòng ngự cá nhân & Nhóm đôi: Kìm hãm, Đè góc & Đoạt bóng',
    objective:
      'Huấn luyện hậu vệ kỹ năng áp sát nhanh, giảm tốc độ khi cách đối phương 2m, đứng nghiêng người 45 độ kìm hãm hướng di chuyển và chọn thời điểm chuẩn xác để tắc bóng hoặc can thiệp.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Di chuyển bước thủ chân gương & Bứt tốc phản xạ',
          'Bài tập chân nhanh 1v1 qua cổng cọc tiêu',
          'Khởi động giảm tốc và chuyển hướng góc nghiêng',
        ],
        areaSize: '20 × 15 m hành lang nón',
        equipment: ['10 Nón tập', '1 Bóng / cặp'],
        organization: 'Cầu thủ chia cặp đối diện nhau cách 3m trong hành lang nón song song.',
        howItWorks: [
          'Tiền đạo di chuyển dích dắc tiến lùi; hậu vệ bước lùi nghiêng người theo dạng gương.',
          'Khi HLV hô "BẮT ĐẦU!", tiền đạo bứt tốc, hậu vệ giảm trọng tâm đổi hướng bám theo.',
          'Đổi vai sau mỗi 4 lần thực hiện. Sang giai đoạn 2 thêm bóng rê nhẹ.',
        ],
        coachingPoints: [
          'Hạ thấp trọng tâm, nhón gót trên nửa bàn chân trước.',
          'Đứng nghiêng người: Ép đối phương về chân không thuận hoặc hướng ra đường biên.',
          'Tiếp cận nhanh, giảm tốc chậm khi cách bóng 2m.',
          'Kiên nhẫn, không vội vàng lao vào khi đối phương đang khống chế bóng chắc.',
        ],
        diagramLayout: 'gates_grid',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Đối đầu 1v1 bảo vệ hai cổng cầu môn nhỏ',
          'Áp sát góc nghiêng và khóa đường chuyền trung lộ',
          'Đua tốc độ thu hồi bóng và tranh chấp 1v1',
        ],
        areaSize: '20 × 12 m hành lang hẹp',
        equipment: ['8 Nón', '2 Khung thành nhỏ', 'Bóng tập'],
        organization: 'Hành lang với hậu vệ ở đáy sân, tiền đạo cách 15m. Tiền đạo tìm cách rê qua 1 trong 2 cổng đích.',
        howItWorks: [
          'Hậu vệ chuyền bóng lên cho tiền đạo rồi lập tức lao ra áp sát.',
          'Hậu vệ phải ghìm hướng chạy của đối phương ra phía biên.',
          'Nếu hậu vệ đoạt được bóng, chuyền ngay về phía HLV để ghi điểm phản công.',
        ],
        coachingPoints: [
          'Chạy theo đường cong để bịt kín đường dẫn bóng vào trung lộ.',
          'Góc đứng nghiêng 45 độ, chân dẫn hướng định đoạt lối đi của đối phương.',
          'Khoảng cách cánh tay: Không để đối phương đẩy bóng dài vượt qua.',
          'Mắt nhìn chăm chú vào quả bóng, không bị đánh lừa bởi động tác giả của hông.',
        ],
        diagramLayout: 'rondo_box',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Sóng đối kháng 2v2: Áp sát và Bọc lót',
          'Phòng ngự 3v2 cản phá xâm nhập trung lộ',
          'Đối kháng 2v2 (+1) chuyển trạng thái bảo vệ khung thành',
        ],
        areaSize: '30 × 20 m có khung thành phản công',
        equipment: ['12 Nón', '4 Khung thành nhỏ', 'Áo bib'],
        organization: 'Hai hậu vệ phối hợp phòng ngự chống lại 2 tiền đạo tấn công về 2 cầu môn nhỏ.',
        howItWorks: [
          'Tiền đạo cầm bóng ở giữa sân. Hậu vệ 1 lao lên gây áp lực gắt gao ("Tôi áp sát!").',
          'Hậu vệ 2 lùi chéo góc 45 độ bọc lót phía sau ("Có tôi lót phía sau!").',
          'Khi bóng chuyền sang tiền đạo thứ 2, hai hậu vệ đổi vai tức thì (người bọc lót chuyển thành người áp sát).',
        ],
        coachingPoints: [
          'Giao tiếp to rõ giữa cặp hậu vệ ("Lên!", "Ép ra biên!", "Lùi lại!").',
          'Hậu vệ bọc lót phải quan sát được cả tiền đạo thứ hai lẫn quả bóng.',
          'Giữ cự ly hợp lý: Không để hở khe nách cho đường chọc khe xuyên tuyến.',
          'Kiên trì, chờ đối phương chạm bóng lỗi là lập tức can thiệp.',
        ],
        diagramLayout: 'channel_play',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Trận đấu đối kháng khối phòng ngự chặt chẽ',
          'Đấu đối kháng 5v5 thưởng điểm đoạt bóng trên phần sân nhà',
          'Sân hẹp cự ly đội hình với điểm thưởng tắc bóng sạch',
        ],
        areaSize: '40 × 30 m',
        equipment: ['2 Khung thành', 'Bóng tập', 'Áo bib'],
        organization: 'Hai đội thi đấu đối kháng. Thưởng 1 điểm cộng cho mỗi pha tắc bóng sạch hoặc cắt bóng thành công.',
        howItWorks: [
          'Thi đấu theo luật bóng đá nhỏ.',
          'Tập trung vào khối phòng ngự di chuyển đồng bộ như một chiếc đàn xếp.',
          'Bóng ở cánh trái thì hậu vệ cánh phải phải bó vào trung lộ hỗ trợ.',
        ],
        coachingPoints: [
          'Phòng ngự theo khối: Thu hẹp khoảng cách giữa các tuyến.',
          'Ưu tiên bịt kín khu vực nguy hiểm ở trung lộ trước.',
          'Phản áp sát tức thì khi mất bóng: 3 giây đầu tiên của quá trình chuyển trạng thái.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu đối kháng thực tế: Thách thức giữ sạch lưới',
          'Đấu tự do 8v8 / 9v9 chú trọng tranh chấp 1v1',
          'Trận đấu hoàn chỉnh kiểm tra ý thức vị trí phòng ngự',
        ],
        areaSize: 'Nửa sân lớn hoặc sân phù hợp lứa tuổi',
        equipment: ['Cầu môn lớn', 'Bóng', 'Nón'],
        organization: 'Thi đấu đủ thủ môn và áp dụng luật thi đấu chính thức.',
        howItWorks: [
          'Trận đấu tự do giữa hai đội.',
          'HLV theo dõi tư thế phòng ngự cá nhân và tốc độ lui về hỗ trợ của toàn đội.',
        ],
        coachingPoints: [
          'Thắng trong các pha tranh chấp tay đôi mà không phạm lỗi nguy hiểm gần vòng cấm.',
          'Chuyển trạng thái tức thì ngay khi giành lại được quyền kiểm soát bóng.',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
  {
    keywords: ['pressing', 'áp sát', 'chặn bóng', 'gài bẫy', 'bẫy việt vị', 'press', 'tầm cao'],
    title: 'Kích hoạt Pressing tầm cao & Cự ly đội hình đồng bộ',
    objective:
      'Tổ chức phối hợp giữa hàng tiền đạo và tiền vệ nhận diện thời điểm kích hoạt pressing (chạm bóng lỗi, chuyền về, ép vào biên) để quây bắt bóng tập thể và đoạt lại quyền kiểm soát ở 1/3 sân đối phương.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Đá ma săn bóng nhóm đôi: Rondo 4v2',
          'Khởi động phản xạ tín hiệu kích hoạt pressing',
          'Di chuyển khối trượt ngang và che chắn góc chuyền',
        ],
        areaSize: '15 × 15 m các ô vuông rondo',
        equipment: ['Nón tập', 'Bóng', 'Áo bib'],
        organization: 'Chia thành các ô rondo 4v2. 4 cầu thủ bên ngoài giữ bóng, 2 cầu thủ bên trong săn bóng.',
        howItWorks: [
          'Cầu thủ bên ngoài đá 1-2 chạm.',
          'Hai cầu thủ bên trong phối hợp ăn ý để cắt bóng hoặc ép bóng bay ra ngoài biên.',
          'Khi cướp được bóng, chuyền ngay ra ngoài hoặc giữ bóng trong 3 giây.',
        ],
        coachingPoints: [
          'Pressing cùng nhau: Người thứ nhất áp sát bóng, người thứ hai cắt đường chuyền gần nhất.',
          'Chạy theo đường cong để ép hướng bóng theo ý muốn.',
          'Phản ứng tức thì ngay khi bóng bắt đầu lăn.',
        ],
        diagramLayout: 'rondo_box',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Kích hoạt bẫy biên: Chạy vòng cung khóa đường chuyền về',
          'Sóng gây áp lực khi đối phương chuyền ngược về',
          'Khóa không gian trung lộ và giăng bẫy cướp bóng',
        ],
        areaSize: '30 × 25 m',
        equipment: ['Nón', 'Áo bib', 'Bóng'],
        organization: 'Hàng thủ 4 người đối đầu 3 tiền đạo pressing.',
        howItWorks: [
          'Hàng thủ đối phương chuyền bóng qua lại.',
          'Khi có tín hiệu kích hoạt (đường chuyền ngang chậm hoặc chuyền cho hậu vệ biên), 3 tiền đạo đồng loạt dâng lên siết chặt vòng vây.',
          'Tiền đạo cánh chạy vòng cung để chặn đường chuyền ngược về cho trung vệ.',
        ],
        coachingPoints: [
          'Nhận diện thời cơ: Cầu thủ đối phương quay lưng, bóng nảy bổng, đường chuyền chậm.',
          'Dùng bóng che người (cover shadow) để bịt hướng chuyền sau lưng.',
          'Tăng tốc 100% khi thời điểm kích hoạt xuất hiện.',
        ],
        diagramLayout: 'channel_play',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Tình huống 6v5: Phát triển bóng từ sân nhà đấu Pressing tầm cao',
          'Thử thách pressing khu vực với luật ghi bàn 6 giây',
          'Đấu kiểm soát chuyển đổi phản công nhanh sau khi đoạt bóng',
        ],
        areaSize: '45 × 35 m (nửa sân)',
        equipment: ['1 Cầu môn lớn', '3 Cầu môn nhỏ', 'Bóng', 'Áo bib'],
        organization: 'Thủ môn + 4 hậu vệ triển khai bóng đối đầu 5 tiền đạo pressing tầm cao.',
        howItWorks: [
          'Thủ môn phát bóng lên.',
          'Đội pressing tìm cách đoạt bóng ở 1/3 sân đối phương.',
          'Nếu cướp được bóng, có 6 giây để dứt điểm vào cầu môn lớn.',
          'Nếu đội thoát pressing thành công, họ chuyền vào bất kỳ khung thành nhỏ nào để ghi điểm.',
        ],
        coachingPoints: [
          'Khóa đối phương vào một hành lang cánh, không cho chuyền đổi hướng sang cánh kia.',
          'Thu hẹp khoảng trống phía sau cầu thủ pressing đầu tiên.',
          'Chuyền thẳng về phía khung thành ngay khi đoạt được bóng.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Trận đấu đối kháng bẫy bóng nhân đôi điểm số',
          'Đấu đối kháng nửa sân giành quyền kiểm soát bóng nhanh',
          'Đối kháng cường độ cao với luật bàn thắng chuyển trạng thái',
        ],
        areaSize: '40 × 30 m',
        equipment: ['2 Cầu môn', 'Bóng', 'Áo bib'],
        organization: '6v6 hoặc 7v7 có vạch kẻ chia đôi sân.',
        howItWorks: [
          'Thi đấu luật bình thường.',
          'Bàn thắng ghi được trong vòng 8 giây sau khi đoạt bóng bên phần sân đối phương được tính 2 điểm.',
        ],
        coachingPoints: [
          'Dịch chuyển cự ly cả khối: Bỏ vị trí cầu thủ ở xa nhất, cô lập khu vực có bóng.',
          'Chủ động bước lên đánh chặn, không lùi sâu bị động.',
          'Dứt khoát khi có cơ hội chuyển trạng thái.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu toàn đội: Áp dụng Pressing tầm cao thực chiến',
          'Trận đấu tự do đánh giá hiệu quả bẫy cướp bóng',
          'Mô phỏng thi đấu thực tế với điều chỉnh chiến thuật',
        ],
        areaSize: 'Sân tiêu chuẩn phù hợp lứa tuổi',
        equipment: ['Cầu môn lớn', 'Bóng', 'Áo bib'],
        organization: 'Thi đấu đầy đủ 2 hiệp với thủ môn.',
        howItWorks: [
          'Hai đội thi đấu tự do.',
          'HLV theo dõi độ gắn kết khi pressing tầm cao và cự ly của hàng thủ.',
        ],
        coachingPoints: [
          'Khi nào nên pressing tầm cao và khi nào nên lùi về khối trung tuyến.',
          'Thủ môn và trung vệ phải hò hét đẩy hàng thủ dâng cao đồng bộ.',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
  {
    keywords: ['chuyền bóng', 'phối hợp', 'người thứ 3', 'tam giác', 'passing', 'bật tường', 'tiki-taka'],
    title: 'Phối hợp chuyền bóng & Chạy chỗ người thứ ba',
    objective:
      'Nâng cao độ chính xác, lực chuyền bóng và thời điểm chạy chỗ từ điểm mù của người thứ ba để xé toang các khối phòng ngự co cụm.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Tổ hợp chuyền bóng Nhả - Đập - Xuyên tuyến',
          'Khởi động chuyền bóng tam giác tốc độ cao',
          'Phối hợp 1-2 bật tường rồi tăng tốc đón bóng',
        ],
        areaSize: '20 × 20 m',
        equipment: ['8 Nón', '6 Quả bóng'],
        organization: 'Chia nhóm 3 hoặc 4 người phối hợp theo chuỗi: Chuyền lên - Trả về - Chọc khe.',
        howItWorks: [
          'Cầu thủ 1 chuyền lên cho cầu thủ 2 (Chuyền lên).',
          'Cầu thủ 2 nhả bóng 1 chạm về cho cầu thủ 1 (Trả về).',
          'Cầu thủ 1 chọc khe cho cầu thủ 3 băng lên cắt mặt (Xuyên tuyến).',
          'Xoay vòng vị trí liên tục.',
        ],
        coachingPoints: [
          'Lực chuyền bóng: Chuyền mạnh vào chân thuận, nhưng nhả bóng thì phải êm.',
          'Góc độ và thời điểm chạy chỗ của người thứ ba: Không xuất phát quá sớm để tránh việt vị.',
          'Tư thế thân người luôn mở để nhận bóng trong khi đang di chuyển.',
          'Chuyền bóng rồi tiếp tục di chuyển hỗ trợ đồng đội.',
        ],
        diagramLayout: 'rondo_box',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Tổ hợp phối hợp chữ Y và chồng biên người thứ ba',
          'Hoán đổi vị trí trung tuyến và chọc khe chéo góc',
          'Bài tập đập nhả 1-2 liên hoàn qua cọc tiêu',
        ],
        areaSize: '30 × 25 m có hình nhân',
        equipment: ['4 Hình nhân / nón cao', '10 Quả bóng', 'Áo bib'],
        organization: 'Đặt 2 hình nhân đại diện cho trung vệ đối phương.',
        howItWorks: [
          'Tiền vệ trung tâm chuyền cho tiền đạo đang quay lưng.',
          'Tiền đạo cánh chạy chéo góc ra sau lưng hình nhân.',
          'Tiền đạo nhả bóng lại cho tiền vệ tấn công chọc khe chuẩn xác cho cầu thủ cánh băng xuống dứt điểm.',
        ],
        coachingPoints: [
          'Nhả bóng 1 chạm chuẩn để giữ thế bất ngờ trước hàng thủ.',
          'Đánh lừa đối phương bằng ánh mắt và hướng mở hông.',
          'Người thứ ba phải bứt tốc với tốc độ tối đa vào khoảng trống.',
        ],
        diagramLayout: 'channel_play',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Kiểm soát 5v5 (+2 tự do) tìm người thứ ba xâm nhập',
          'Đấu đối kháng chia khu vực với điều kiện chạy chỗ đón bóng',
          'Tổ hợp kiểm soát thoát áp lực qua cửa trung gian',
        ],
        areaSize: '35 × 30 m có vạch việt vị',
        equipment: ['12 Nón', '2 Cầu môn nhỏ', 'Bóng', 'Áo bib'],
        organization: 'Sân có khu trung tâm và hai hành lang đích.',
        howItWorks: [
          'Hai đội kiểm soát bóng ở giữa.',
          'Để ghi điểm, bóng phải được chuyền cho một cầu thủ băng vào khu vực đích từ một pha phối hợp người thứ ba.',
          'Không được rê bóng vào khu đích; bắt buộc phải nhận bóng khi đang trên đà chạy.',
        ],
        coachingPoints: [
          'Kiên nhẫn kiểm soát bóng cho đến khi khoảng trống xuyên tuyến lộ ra.',
          'Xác định rõ vai trò: Người chuyền, Người làm tường, Người chạy chỗ.',
          'Căn thời điểm di chuyển khôn ngoan để không rơi vào bẫy việt vị.',
        ],
        diagramLayout: 'channel_play',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Trận đấu đối kháng 6v6 phối hợp đập nhả',
          'Đối kháng tính điểm thưởng cho pha bóng phối hợp 1 chạm',
          'Đấu đối kháng có tiền đạo làm tường trung tâm',
        ],
        areaSize: '45 × 32 m',
        equipment: ['2 Khung thành', 'Bóng', 'Áo bib'],
        organization: 'Hai đội thi đấu đối kháng trực diện.',
        howItWorks: [
          'Luật chuẩn. Bàn thắng đến từ pha đập nhả 1 chạm hoặc chạy chỗ người thứ ba được tính 2 điểm.',
          'Khuyến khích các pha bật tường và chồng biên tốc độ.',
        ],
        coachingPoints: [
          'Chơi bóng với tốc độ luân chuyển bóng nhanh.',
          'Hỗ trợ cả phía dưới và phía sau lưng bóng.',
          'Tự tin tung ra đường chuyền xuyên tuyến khi có khoảng trống.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu tự do tập trung phối hợp trung lộ',
          'Trận đấu đối kháng phát triển bóng từ tuyến dưới',
          'Trận đấu hoàn chỉnh đánh giá khả năng sáng tạo',
        ],
        areaSize: 'Sân kích thước chuẩn',
        equipment: ['Khung thành', 'Bóng thi đấu'],
        organization: 'Thi đấu tự do luật chính thức.',
        howItWorks: [
          'Cầu thủ tự do thể hiện trên sân.',
          'Tìm kiếm các pha phối hợp ăn ý ở 1/3 sân cuối cùng.',
        ],
        coachingPoints: [
          'Tận dụng triệt để những giây phút đối phương mất cự ly đội hình.',
          'Chất lượng xử lý kỹ thuật khi thể lực bắt đầu đi xuống.',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
  {
    keywords: ['chuyển trạng thái', 'phản công', 'transition', 'đoạt bóng', 'cướp bóng', 'tấn công nhanh'],
    title: 'Chuyển trạng thái thần tốc từ Phòng ngự sang Tấn công',
    objective:
      'Huấn luyện cầu thủ khai thác triệt để 5 giây đầu tiên ngay sau khi đoạt được bóng: ngẩng đầu quan sát ngay, di chuyển không bóng tốc độ cao và tung ra đường chuyền chọc khe hướng thẳng về cầu môn đối phương.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Phản xạ chuyển trạng thái & Chuyền bóng bứt phá',
          'Bài tập 3 đội đoạt bóng phản công tốc độ',
          'Khởi động cắt bóng & Tăng tốc bứt phá',
        ],
        areaSize: '25 × 20 m',
        equipment: ['Nón', 'Bóng', '3 Màu áo bib'],
        organization: '3 đội có quân số bằng nhau trong ô vuông.',
        howItWorks: [
          'Hai đội chuyền bóng giữ quyền kiểm soát, đội thứ ba săn bóng.',
          'Khi đội săn đoạt được bóng, lập tức tung đường chuyền dài hướng thẳng về cầu thủ mục tiêu được chỉ định trước.',
        ],
        coachingPoints: [
          'Ngẩng đầu quan sát ngay trong tích tắc đầu tiên chạm bóng.',
          'Cầu thủ xung quanh lập tức bứt tốc mở ra các phương án nhận bóng.',
          'Đường chuyền dọc sân loại bỏ hậu vệ nhanh hơn đường chuyền ngang.',
        ],
        diagramLayout: 'gates_grid',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Sóng phản công nhanh dứt điểm về khung thành',
          'Đoạt bóng và phản công 3v2 tốc độ cao',
          'Chuyển trạng thái đánh biên quá tải quân số',
        ],
        areaSize: '40 × 30 m',
        equipment: ['1 Cầu môn lớn có thủ môn', 'Nón', 'Bóng'],
        organization: 'HLV chuyền bóng lập bập vào cho hậu vệ. Hai cầu thủ cánh và 1 tiền đạo sẵn sàng bứt phá.',
        howItWorks: [
          'Hậu vệ cắt bóng của HLV rồi lập tức chuyền quả bóng đầu tiên hướng thẳng lên cho tiền đạo hoặc cầu thủ cánh băng lên.',
          'Nhóm tiền đạo có 8 giây để hoàn thành cú sút về phía khung thành.',
        ],
        coachingPoints: [
          'Đường chuyền đầu tiên luôn ưu tiên hướng về phía trước nếu có thể.',
          'Dãn rộng biên và kéo giãn hàng thủ đối phương.',
          'Ra quyết định dứt điểm dứt khoát ở tốc độ cao.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Sóng đối kháng chuyển trạng thái liên hoàn 4v3',
          'Đấu đối kháng hai ô vuông tính giây phản công',
          'Đoạt bóng và xuyên thủng phòng tuyến 5v5',
        ],
        areaSize: '45 × 35 m',
        equipment: ['2 Cầu môn', 'Bóng', 'Áo bib'],
        organization: 'Sân có 2 vòng cấm. Các đợt tấn công và phòng ngự đổi chiều liên tục.',
        howItWorks: [
          'Đội A tấn công 4v3 với Đội B.',
          'Nếu Đội B đoạt được bóng, 2 cầu thủ Đội B đang đợi ở ngoài lập tức nhập cuộc để tạo pha phản công 5v4 ngược về khung thành đối diện.',
        ],
        coachingPoints: [
          'Nhận diện sự sơ hở của đối phương ngay thời khắc họ vừa mất bóng.',
          'Cầu thủ hỗ trợ phải chạy vượt lên phía trước quả bóng.',
          'Quyết định sắc bén: Khi nào nên chuyền và khi nào nên tự mình dẫn bóng.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Đối kháng chuyển đổi trạng thái với đồng hồ 8 giây',
          'Trận chiến đoạt bóng thay người con thoi',
          'Đấu đối kháng tính cấp số nhân cho bàn thắng phản công',
        ],
        areaSize: '45 × 30 m',
        equipment: ['2 Cầu môn có thủ môn', 'Bóng', 'Áo bib'],
        organization: 'Thi đấu đối kháng có HLV đếm ngược thời gian.',
        howItWorks: [
          'Luật chuẩn, nhưng đội giành được bóng bên phần sân nhà phải tung ra cú sút trong vòng 8 giây mới được tính bàn thắng.',
        ],
        coachingPoints: [
          'Không chần chừ, không chuyền về nếu không thực sự bị ép gắt gao.',
          'Bình tĩnh và lạnh lùng ở pha xử lý cuối cùng.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu tự do phản công chớp nhoáng',
          'Trận đấu kiểm tra phản xạ chuyển đổi trạng thái',
          'Đấu đối kháng toàn sân tốc độ cao',
        ],
        areaSize: 'Sân tiêu chuẩn',
        equipment: ['Cầu môn lớn', 'Bóng thi đấu'],
        organization: 'Luật thi đấu chính thức.',
        howItWorks: [
          'Thi đấu đối kháng tự do.',
          'HLV theo dõi tốc độ chuyển trạng thái từ khối thủ sang khối công của toàn đội.',
        ],
        coachingPoints: [
          'Bật công tắc tâm lý ngay thời khắc quyền kiểm soát bóng đổi chủ.',
          'Duy trì sự bọc lót phía sau khi đội nhà đang mải dâng cao tấn công.',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
  {
    keywords: ['tạt cánh', 'dứt điểm', 'đánh đầu', 'sút bóng', 'crossing', 'finishing', 'cắt mặt', 'vòng cấm'],
    title: 'Tạt cánh từ hai biên & Dứt điểm trong Vòng cấm',
    objective:
      'Cải thiện chất lượng quả tạt từ hành lang cánh và phối hợp các hướng di chuyển cắt mặt cột gần, cột xa và tuyến hai để dứt điểm thành bàn.',
    blocks: [
      {
        blockType: 'warm_up',
        blockName: 'Khởi động',
        exerciseNameVariations: [
          'Khởi động phối hợp biên & Dứt điểm một chạm',
          'Căn thời điểm di chuyển cắt mặt vòng cấm',
          'Kỹ thuật tạt bóng & Khởi động thủ môn',
        ],
        areaSize: '30 × 25 m có 1 cầu môn lớn',
        equipment: ['1 Cầu môn lớn', '12 Quả bóng', 'Nón tập'],
        organization: 'Hai trạm tạt bóng ở cánh và hai hàng dứt điểm ở trung lộ.',
        howItWorks: [
          'Cầu thủ đẩy bóng ra cánh cho cầu thủ biên tạt bóng tầm thấp/căng ngang.',
          'Hai cầu thủ ở giữa di chuyển nhịp nhàng (1 người cột gần, 1 người cột xa) dứt điểm một chạm.',
        ],
        coachingPoints: [
          'Người tạt: Ngước nhìn mục tiêu, khóa cổ chân, tiếp xúc đúng tâm bóng.',
          'Tiền đạo: Di chuyển so le, không chạy cùng một hướng với đồng đội.',
          'Chạy đà dứt khoát, không dừng lại trước khi bóng tới.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'technical',
        blockName: 'Kỹ thuật',
        exerciseNameVariations: [
          'Sóng tạt bóng 3 hướng: Cột gần, Cột xa và Tuyến hai',
          'Chồng biên tạt bóng căng sệt vào nách hàng thủ',
          'Tạt bóng sớm từ vị trí chếch ngoài vòng cấm',
        ],
        areaSize: 'Vòng cấm + 20m phía trên',
        equipment: ['1 Cầu môn lớn có thủ môn', '12 Quả bóng', 'Hình nhân trong vòng cấm'],
        organization: 'Đặt hình nhân đóng vai trò trung vệ đối phương trong vòng cấm.',
        howItWorks: [
          'Hậu vệ biên phối hợp bật tường với tiền vệ cánh để thoát xuống đáy biên.',
          'Cầu thủ cánh tạt bóng chuẩn xác vào trong.',
          '3 tiền đạo đồng loạt băng vào 3 điểm nóng: 1) Cột gần, 2) Cột xa, 3) Tuyến hai đón bóng bật ra.',
        ],
        coachingPoints: [
          'Căn thời gian chuẩn: Đến cùng lúc với bóng, không đứng chết đợi bóng trong vòng cấm.',
          'Bóng căng sệt giữa chấm phạt đền và khu 5m50 là hiểm hóc nhất.',
          'Dứt điểm một chạm lái bóng vào các góc xa khung thành.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'skill',
        blockName: 'Phát triển kỹ năng',
        exerciseNameVariations: [
          'Đua bóng bổng 4v3 trong vòng cấm với hành lang cánh tự do',
          'Đấu tạt cánh có hậu vệ tranh chấp trực tiếp',
          'Tình huống 3v2 vòng cấm đón bóng tạt liên hoàn',
        ],
        areaSize: 'Chiều rộng vòng cấm × 40m chiều dài',
        equipment: ['1 Cầu môn lớn có thủ môn', '2 Khung thành nhỏ', 'Bóng', 'Áo bib'],
        organization: 'Cầu thủ cánh có 2 chạm ở hành lang biên để tạt bóng vào cho pha tranh chấp 3v2 trong vòng cấm.',
        howItWorks: [
          'Tuyến giữa phân phối bóng ra cánh.',
          'Hậu vệ trong vòng cấm áp sát tranh chấp phá bóng ra ngoài hoặc chuyền vào khung thành nhỏ phản công.',
        ],
        coachingPoints: [
          'Động tác giả trước khi chạy chỗ để thoát khỏi sự đeo bám của hậu vệ.',
          'Dũng cảm và quyết đoán trong các pha không chiến.',
          'Giao tiếp to rõ giữa các tiền đạo khi băng vào.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'small_sided',
        blockName: 'Trò chơi đối kháng',
        exerciseNameVariations: [
          'Trận đấu đối kháng nhân đôi điểm cho bàn thắng từ tạt cánh',
          'Đấu đối kháng ưu tiên bóng bổng và vô-lê',
          'Đối kháng 6v6 với các đường căng ngang đáy biên',
        ],
        areaSize: '45 × 35 m',
        equipment: ['2 Cầu môn lớn có thủ môn', 'Bóng', 'Áo bib'],
        organization: 'Sân có đánh dấu hai hành lang cánh.',
        howItWorks: [
          'Bàn thắng xuất phát từ quả tạt hoặc căng ngang từ hành lang cánh được tính 2 điểm.',
          'Khuyến khích các đội mở bóng rộng ra biên để tạo cơ hội tạt bóng.',
        ],
        coachingPoints: [
          'Luân chuyển bóng nhanh để cô lập tình huống 1v1 ở cánh.',
          'Đông đảo quân số ùa vào vòng cấm khi đồng đội chuẩn bị tạt bóng.',
        ],
        diagramLayout: 'half_pitch',
      },
      {
        blockType: 'match',
        blockName: 'Thi đấu',
        exerciseNameVariations: [
          'Thi đấu đối kháng hoàn chỉnh: Đánh biên thực chiến',
          'Trận đấu tự do đánh giá chất lượng quả tạt',
          'Đấu tự do 8v8 / 9v9 đầy đủ thủ môn',
        ],
        areaSize: 'Sân tiêu chuẩn',
        equipment: ['Khung thành lớn', 'Bóng thi đấu'],
        organization: 'Thi đấu chính thức.',
        howItWorks: [
          'Khuyến khích cầu thủ tích cực chồng biên và dứt điểm đa dạng từ các quả tạt.',
        ],
        coachingPoints: [
          'Chất lượng đường tạt bóng quyết định 80% cơ hội ghi bàn.',
          'Các tiền đạo di chuyển so le tạo khoảng trống cho nhau.',
        ],
        diagramLayout: 'full_pitch',
      },
    ],
  },
];

// Hàm tạo giáo án buổi tập tiếng Việt hoàn chỉnh
export function generateTrainingSession(
  topicInput: string,
  playerCount: number,
  duration: SessionDuration = 90,
  seedVariation: number = 0
): TrainingSession {
  const cleanTopic = topicInput.trim() || 'Nhận bóng với tư thế mở & Quan sát không gian';
  const lower = cleanTopic.toLowerCase();
  const split = DURATION_SPLITS[duration];

  // Tìm chủ đề phù hợp trong kho giáo án tiếng Việt
  const matchedPreset = TOPIC_PRESETS_VI.find(preset =>
    preset.keywords.some(kw => lower.includes(kw.toLowerCase()))
  );

  const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (matchedPreset) {
    const blocks: Exercise[] = matchedPreset.blocks.map((blockTemplate, idx) => {
      const variationIndex = (seedVariation + idx) % blockTemplate.exerciseNameVariations.length;
      const exerciseName = blockTemplate.exerciseNameVariations[variationIndex];
      const blockDuration = split[blockTemplate.blockType];

      return {
        id: `drill_${sessionId}_${blockTemplate.blockType}`,
        blockType: blockTemplate.blockType,
        blockName: blockTemplate.blockName,
        exerciseName,
        duration: blockDuration,
        playersCount: formatPlayerDistribution(playerCount, blockTemplate.blockType),
        areaSize: blockTemplate.areaSize,
        equipment: blockTemplate.equipment,
        organization: blockTemplate.organization,
        howItWorks: blockTemplate.howItWorks,
        coachingPoints: blockTemplate.coachingPoints,
        pitchDiagram: generatePitchDiagram(blockTemplate.diagramLayout, playerCount),
      };
    });

    return {
      id: sessionId,
      title: matchedPreset.title,
      objective: matchedPreset.objective,
      topic: cleanTopic,
      playerCount,
      totalDuration: duration,
      createdAt: new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      blocks,
    };
  }

  // Nếu là chủ đề tự nhập, tự động thiết lập giáo án bóng đá chuẩn 5 giai đoạn bằng tiếng Việt
  const capitalizedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
  const customTitle = `Chuyên đề: ${capitalizedTopic}`;
  const customObjective = `Nâng cao kỹ năng và tư duy chiến thuật của toàn đội về ${cleanTopic}, phát triển tuần tự từ thói quen kỹ thuật không áp lực đến khả năng ra quyết định nhanh trong trận đấu thực tế.`;

  const blocks: Exercise[] = [
    {
      id: `drill_${sessionId}_warm_up`,
      blockType: 'warm_up',
      blockName: 'Khởi động',
      exerciseName: `Khởi động kích hoạt & Nguyên tắc cơ bản: ${capitalizedTopic}`,
      duration: split.warm_up,
      playersCount: formatPlayerDistribution(playerCount, 'warm_up'),
      areaSize: '25 × 20 m có cổng nón',
      equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
      organization: `Bố trí khu vực 25 × 20 m với các nón phân chia làn chuyền. Chia ${playerCount} cầu thủ thành từng cặp có bóng di chuyển liên tục.`,
      howItWorks: [
        `Cầu thủ di chuyển chuyền bóng linh hoạt trong sân, tập trung vào nguyên tắc ${cleanTopic}.`,
        'Cứ sau mỗi 90 giây, HLV thổi còi thực hiện các động tác giãn cơ động (mở khớp háng, nâng cao đùi, giảm tốc đổi hướng).',
        `Nâng cao: Hoàn thành chuỗi 6 đường chuyền chuẩn áp dụng ${cleanTopic} trước khi chuyển sang ô tiếp theo.`,
      ],
      coachingPoints: [
        'Quan sát vai và chuẩn bị tư thế trước khi nhận bóng.',
        'Mở thân người đón hướng di chuyển tiếp theo.',
        'Giao tiếp to rõ bằng lời nói và cử chỉ với đồng đội.',
        'Duy trì cường độ và năng lượng tích cực ngay từ phút đầu tiên.',
      ],
      pitchDiagram: generatePitchDiagram('gates_grid', playerCount),
    },
    {
      id: `drill_${sessionId}_technical`,
      blockType: 'technical',
      blockName: 'Kỹ thuật',
      exerciseName: `Lặp lại kỹ thuật định vị & Định hình thói quen: ${capitalizedTopic}`,
      duration: split.technical,
      playersCount: formatPlayerDistribution(playerCount, 'technical'),
      areaSize: '30 × 25 m trạm tam giác',
      equipment: ['10 Nón', '10 Quả bóng', '4 Cọc tiêu kỹ thuật'],
      organization: `Thiết lập 2 trạm kỹ thuật song song để toàn bộ ${playerCount} cầu thủ đều được chạm bóng tối đa, không phải xếp hàng chờ đợi lâu.`,
      howItWorks: [
        `Cầu thủ thực hiện chuỗi phối hợp chuyền và chạy chỗ được thiết kế riêng cho ${cleanTopic}.`,
        'Bóng xuất phát từ tuyến dưới, chuyền vào vị trí xoay xở trung tâm rồi mở bóng ra cánh chính xác.',
        'Cầu thủ chuyền bóng xong lập tức chạy theo bóng để luân chuyển vị trí liên tục.',
        'Sau 6 phút, đưa hậu vệ thụ động vào gây áp lực nhẹ để tăng khả năng quan sát.',
      ],
      coachingPoints: [
        'Chi tiết đường chuyền: Lực chuyền chuẩn, bóng đi sệt và đúng chân thuận đồng đội.',
        'Di chuyển dứt khoát để tách khỏi sự theo kèm của đối phương.',
        `Kiên trì và tập trung rèn luyện đúng kỹ thuật ${cleanTopic}.`,
        'Chuyền bóng rồi tiếp tục di chuyển hỗ trợ đồng đội.',
      ],
      pitchDiagram: generatePitchDiagram('rondo_box', playerCount),
    },
    {
      id: `drill_${sessionId}_skill`,
      blockType: 'skill',
      blockName: 'Phát triển kỹ năng',
      exerciseName: `Tình huống đối kháng có điều kiện: ${capitalizedTopic}`,
      duration: split.skill,
      playersCount: formatPlayerDistribution(playerCount, 'skill'),
      areaSize: '35 × 28 m có khu vực chuyển đổi',
      equipment: ['14 Nón', '10 Quả bóng', 'Áo bib phân đội'],
      organization: `Sân chia làm 3 khu vực với tỷ lệ quá tải quân số để cầu thủ vận dụng ${cleanTopic} dưới áp lực tranh chấp trực tiếp.`,
      howItWorks: [
        `Hai đội thi đấu tranh chấp quyền kiểm soát với yêu cầu áp dụng ${cleanTopic}.`,
        'Đội cầm bóng phải thực hiện thành công giải pháp chiến thuật trước khi tìm cách ghi điểm qua khung thành mục tiêu.',
        'Đội phòng ngự khi cướp được bóng có 8 giây để chuyển trạng thái phản công nhanh.',
      ],
      coachingPoints: [
        'Khả năng đọc tình huống và ra quyết định nhanh dưới áp lực đối phương.',
        'Tận dụng triệt để lợi thế hơn người ở khu vực có bóng.',
        'Khoảng cách hỗ trợ hợp lý: không đứng quá gần hoặc quá xa người cầm bóng.',
      ],
      pitchDiagram: generatePitchDiagram('channel_play', playerCount),
    },
    {
      id: `drill_${sessionId}_small_sided`,
      blockType: 'small_sided',
      blockName: 'Trò chơi đối kháng',
      exerciseName: `Đối kháng sân nhỏ có thưởng điểm chuyên đề: ${capitalizedTopic}`,
      duration: split.small_sided,
      playersCount: formatPlayerDistribution(playerCount, 'small_sided'),
      areaSize: '40 × 30 m có khung thành',
      equipment: ['Khung thành mini hoặc tiêu chuẩn', '10 Quả bóng', 'Áo bib 2 đội'],
      organization: `Chia 2 đội thi đấu đối kháng trực diện trên sân 40 × 30 m với các điều kiện thúc đẩy ${cleanTopic}.`,
      howItWorks: [
        'Hai đội thi đấu tính điểm theo luật bóng đá nhỏ.',
        `Bàn thắng ghi được sau một tình huống áp dụng thành công ${cleanTopic} được cộng 2 điểm.`,
        'Thi đấu 3 hiệp, mỗi hiệp 5 phút với nhịp độ thi đấu cao.',
      ],
      coachingPoints: [
        'Nhận biết thời điểm để tăng tốc và thời điểm cần giữ nhịp kiểm soát.',
        'Bảo đảm cự ly đội hình cân bằng cả khi tấn công lẫn khi phòng ngự.',
        'Tinh thần thi đấu quyết tâm, tranh chấp công bằng.',
      ],
      pitchDiagram: generatePitchDiagram('half_pitch', playerCount),
    },
    {
      id: `drill_${sessionId}_match`,
      blockType: 'match',
      blockName: 'Thi đấu',
      exerciseName: `Thi đấu tự do toàn đội: Đánh giá thực chiến ${capitalizedTopic}`,
      duration: split.match,
      playersCount: formatPlayerDistribution(playerCount, 'match'),
      areaSize: 'Sân phù hợp với số lượng cầu thủ',
      equipment: ['2 Cầu môn lớn có thủ môn', 'Bóng thi đấu', 'Áo bib'],
      organization: 'Thi đấu bóng đá thực tế với đầy đủ luật thi đấu (ném biên, việt vị, đá phạt).',
      howItWorks: [
        'Cầu thủ thi đấu hoàn toàn tự do, không bị gò bó bởi các điều kiện nhân tạo.',
        `HLV đứng ngoài quan sát mức độ tiến bộ của cầu thủ trong việc vận dụng ${cleanTopic}.`,
        'HLV nhắc nhở chiến thuật nhanh trong các thời điểm bóng chết.',
      ],
      coachingPoints: [
        'Chủ động phát huy các thói quen tốt đã được rèn luyện ở các phần trước.',
        'Tinh thần đồng đội và sự hỗ trợ bọc lót lẫn nhau trên sân.',
        'Họp đúc kết nhanh sau trận: Đội đã làm tốt điều gì và cần cải thiện gì?',
      ],
      pitchDiagram: generatePitchDiagram('full_pitch', playerCount),
    },
  ];

  return {
    id: sessionId,
    title: customTitle,
    objective: customObjective,
    topic: cleanTopic,
    playerCount,
    totalDuration: duration,
    createdAt: new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    blocks,
  };
}

// Hàm đổi biến thể cho 1 bài tập đơn lẻ
export function regenerateSingleExercise(
  current: Exercise,
  topic: string,
  playerCount: number,
  seed: number
): Exercise {
  const session = generateTrainingSession(topic, playerCount, 90, seed);
  const matched = session.blocks.find(b => b.blockType === current.blockType);
  if (matched) {
    return {
      ...matched,
      id: current.id,
      duration: current.duration, // Giữ nguyên thời lượng đã cấu hình
    };
  }
  return current;
}
