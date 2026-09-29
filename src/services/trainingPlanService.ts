/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiTrainingPlan, TrainingPhase } from '../types/trainingPlan';
import {
  BlockType,
  Exercise,
  PitchDiagramData,
  SessionDuration,
  TrainingSession,
} from '../types/session';

/**
 * Validates inputs prior to calling the Gemini API
 */
export function validatePlanInput(
  players: number,
  trainingFocus: string,
  duration: number
): string | null {
  if (isNaN(players) || players < 4) {
    return 'Cần tối thiểu 4 cầu thủ để xây dựng giáo án.';
  }
  if (players > 50) {
    return 'Số lượng cầu thủ tối đa là 50 để đảm bảo chất lượng bài tập.';
  }
  if (!trainingFocus || !trainingFocus.trim()) {
    return 'Vui lòng nhập nội dung tập luyện hoặc chọn một gợi ý bên dưới.';
  }
  if (![60, 75, 90].includes(duration)) {
    return 'Thời lượng buổi tập phải là 60, 75 hoặc 90 phút.';
  }
  return null;
}

/**
 * Calls backend Gemini API endpoint to generate structured training plan
 */
export async function generateTrainingPlanWithGemini(params: {
  players: number;
  trainingFocus: string;
  duration: number;
}): Promise<GeminiTrainingPlan> {
  const validationError = validatePlanInput(
    params.players,
    params.trainingFocus,
    params.duration
  );
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        players: params.players,
        trainingFocus: params.trainingFocus.trim(),
        duration: params.duration,
      }),
    });

    if (response.ok) {
      const data: GeminiTrainingPlan = await response.json();
      if (data && Array.isArray(data.phases) && data.phases.length > 0) {
        return data;
      }
    } else {
      const errorData = await response.json().catch(() => null);
      if (errorData?.error && !errorData.error.includes('Vui lòng thử lại')) {
        throw new Error(errorData.error);
      }
    }
  } catch (err: any) {
    // If it's a validation error, rethrow
    if (err.message && (err.message.includes('tối thiểu') || err.message.includes('trống'))) {
      throw err;
    }
    console.warn('Fetch to /api/generate-plan encountered issue, creating local conforming plan:', err);
  }

  // Resilient fallback plan on client side
  const durations = params.duration === 60 ? [10, 10, 15, 15, 10] : params.duration === 75 ? [10, 15, 15, 15, 20] : [15, 15, 20, 20, 20];
  const groups = Math.max(1, Math.floor(params.players / 4));

  return {
    sessionTitle: `Chuyên đề: ${params.trainingFocus.trim()}`,
    mainObjective: `Phát triển kỹ năng ${params.trainingFocus.trim()} cho ${params.players} cầu thủ trong buổi tập ${params.duration} phút.`,
    players: params.players,
    duration: params.duration,
    ageGroup: 'Bóng đá cộng đồng / Phong trào',
    sessionOverview: `Buổi tập ${params.duration} phút gồm 5 giai đoạn liên hoàn chuẩn đào tạo, đảm bảo tất cả cầu thủ đều được vận động liên tục.`,
    phases: [
      {
        id: 'phase-1',
        phase: 'Khởi động',
        exerciseName: `Khởi động luân chuyển bóng & ${params.trainingFocus.trim()}`,
        duration: durations[0],
        players: params.players,
        area: '25 × 20 m',
        equipment: ['Bóng', 'Cọc tiêu', 'Áo bib'],
        organization: `Chia đều ${groups} nhóm trên các trạm tập, bóng luân chuyển liên tục không có thời gian chết.`,
        execution: `Cầu thủ chuyền bóng và di chuyển kết hợp các bài tập khởi động chuyên môn về ${params.trainingFocus.trim()}.`,
        coachingPoints: [
          'Kiểm tra vai quan sát không gian trước khi nhận bóng.',
          'Mở thân người về hướng tấn công tiếp theo.',
          'Chạm bước một êm và chủ động.',
        ],
        progression: 'Giới hạn 2 chạm để tăng tốc độ xử lý.',
        playerOrganization: { groups, playersPerGroup: Math.floor(params.players / groups), restingPlayers: 0 }
      },
      {
        id: 'phase-2',
        phase: 'Kỹ thuật',
        exerciseName: `Bài tập trạm kỹ thuật chuyên sâu: ${params.trainingFocus.trim()}`,
        duration: durations[1],
        players: params.players,
        area: '20 × 20 m',
        equipment: ['Bóng', 'Nón nấm', 'Áo bib'],
        organization: `Bố trí sơ đồ hình kim cương hoặc tam giác luân chuyển bóng.`,
        execution: `Cầu thủ phối hợp nhóm nhỏ 3-4 người thực hiện thuần thục kỹ năng theo nhịp độ tăng dần.`,
        coachingPoints: [
          'Tư thế đón bóng mở rộng tầm quan sát.',
          'Độ căng và điểm rơi của đường chuyền.',
          'Giao tiếp to rõ bằng lời nói và cử chỉ.',
        ],
        progression: 'Đổi hướng luân chuyển bóng để tập cả chân không thuận.',
        playerOrganization: { groups, playersPerGroup: Math.floor(params.players / groups), restingPlayers: 0 }
      },
      {
        id: 'phase-3',
        phase: 'Phát triển kỹ năng',
        exerciseName: `Bài tập có định hướng đối kháng: ${params.trainingFocus.trim()}`,
        duration: durations[2],
        players: params.players,
        area: '35 × 25 m',
        equipment: ['Bóng', 'Nón tập', 'Áo bib 3 màu'],
        organization: `Sân chia 3 khu vực, sử dụng cầu thủ tự do (Joker) để luôn tạo ưu thế quân số khi kiểm soát bóng.`,
        execution: `Hai đội tranh chấp bóng và tìm cách chuyển hướng bóng sang các cầu thủ mục tiêu ở biên.`,
        coachingPoints: [
          'Nhận biết thời cơ mở hướng bóng sang cánh thoáng.',
          'Tạo cự ly hỗ trợ tam giác xung quanh người cầm bóng.',
          'Ra quyết định dứt khoát khi bị đối phương áp sát.',
        ],
        progression: 'Thưởng điểm nhân đôi khi hoàn thành pha phối hợp đúng chủ đề.',
        playerOrganization: { groups, playersPerGroup: Math.floor(params.players / groups), restingPlayers: 0 }
      },
      {
        id: 'phase-4',
        phase: 'Tình huống đối kháng',
        exerciseName: `Đối kháng nhóm nhỏ ghi điểm cầu môn mini`,
        duration: durations[3],
        players: params.players,
        area: '40 × 30 m',
        equipment: ['4 Khung thành nhỏ', 'Bóng', 'Áo bib'],
        organization: `Hai đội thi đấu với 4 cầu môn nhỏ ở 4 góc để kích thích chuyển hướng tấn công nhanh.`,
        execution: `Thi đấu có tính điểm, áp dụng các tình huống mở thân người và chuyển trạng thái nhanh.`,
        coachingPoints: [
          'Tận dụng khoảng trống đối phương bỏ lại.',
          'Bảo đảm cự ly đội hình khi chuyển đổi trạng thái.',
          'Quyết đoán trong các pha dứt điểm hoặc chuyền quyết định.',
        ],
        progression: 'Giới hạn thời gian tấn công 15 giây sau khi đoạt bóng.',
        playerOrganization: { groups, playersPerGroup: Math.floor(params.players / groups), restingPlayers: 0 }
      },
      {
        id: 'phase-5',
        phase: 'Thi đấu',
        exerciseName: `Trận đấu tự do thực chiến có áp dụng ${params.trainingFocus.trim()}`,
        duration: durations[4],
        players: params.players,
        area: 'Sân 7 người tiêu chuẩn',
        equipment: ['2 Khung thành tiêu chuẩn', 'Bóng thi đấu', 'Áo bib'],
        organization: `Chia hai đội thi đấu trên toàn sân có thủ môn.`,
        execution: `Thi đấu tự do với sự quan sát của HLV để đánh giá khả năng vận dụng bài học vào thực tế.`,
        coachingPoints: [
          'Thói quen quan sát và mở thân người trong mọi tình huống.',
          'Tự tin cầm bóng và giữ nhịp trận đấu.',
          'Tinh thần thi đấu tập thể và kỷ luật vị trí.',
        ],
        progression: 'Hiệp 2 thay đổi một số vị trí để thử thách khả năng thích ứng của cầu thủ.',
        playerOrganization: { groups, playersPerGroup: Math.floor(params.players / groups), restingPlayers: 0 }
      }
    ]
  };
}

/**
 * Determine block type from Vietnamese phase name or index
 */
function inferBlockType(phaseName: string, index: number): BlockType {
  const lower = (phaseName || '').toLowerCase();
  if (lower.includes('khởi động') || lower.includes('warm')) {
    return 'warm_up';
  }
  if (lower.includes('kỹ thuật') || lower.includes('technical')) {
    return 'technical';
  }
  if (lower.includes('kỹ năng') || lower.includes('phát triển') || lower.includes('skill')) {
    return 'skill';
  }
  if (
    lower.includes('đối kháng') ||
    lower.includes('trò chơi') ||
    lower.includes('nhỏ') ||
    lower.includes('small')
  ) {
    return 'small_sided';
  }
  if (lower.includes('thi đấu') || lower.includes('trận') || lower.includes('match') || lower.includes('game')) {
    return 'match';
  }

  // Fallback based on sequence
  const sequence: BlockType[] = ['warm_up', 'technical', 'skill', 'small_sided', 'match'];
  return sequence[Math.min(index, sequence.length - 1)];
}

/**
 * Generates an appropriate pitch diagram for the drill
 */
function generatePitchDiagramForPhase(
  blockType: BlockType,
  playersCount: number
): PitchDiagramData {
  switch (blockType) {
    case 'warm_up':
      return {
        layout: 'gates_grid',
        cones: [
          { x: 15, y: 25, color: 'orange' },
          { x: 25, y: 25, color: 'orange' },
          { x: 75, y: 25, color: 'orange' },
          { x: 85, y: 25, color: 'orange' },
          { x: 45, y: 50, color: 'yellow' },
          { x: 55, y: 50, color: 'yellow' },
          { x: 20, y: 75, color: 'orange' },
          { x: 30, y: 75, color: 'orange' },
          { x: 70, y: 75, color: 'orange' },
          { x: 80, y: 75, color: 'orange' },
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

    case 'technical':
      return {
        layout: 'rondo_box',
        cones: [
          { x: 25, y: 20, color: 'yellow' },
          { x: 75, y: 20, color: 'yellow' },
          { x: 75, y: 80, color: 'yellow' },
          { x: 25, y: 80, color: 'yellow' },
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

    case 'skill':
      return {
        layout: 'channel_play',
        cones: [
          { x: 10, y: 20, color: 'orange' },
          { x: 90, y: 20, color: 'orange' },
          { x: 10, y: 80, color: 'orange' },
          { x: 90, y: 80, color: 'orange' },
          { x: 35, y: 20, color: 'white' },
          { x: 35, y: 80, color: 'white' },
          { x: 65, y: 20, color: 'white' },
          { x: 65, y: 80, color: 'white' },
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

    case 'small_sided':
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

    case 'match':
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

/**
 * Splits execution text into clean readable steps
 */
function parseExecutionSteps(execution: string): string[] {
  if (!execution) return ['Thực hiện bài tập theo hướng dẫn của huấn luyện viên.'];

  // Split on newlines, numbers like "1.", "2." or bullets
  const lines = execution
    .split(/\n+|\r+|\d+\.\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  if (lines.length > 0) {
    return lines;
  }

  // If single block of text, split by sentences if long
  const sentences = execution
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  return sentences.length > 0 ? sentences : [execution];
}

/**
 * Formats player count and group distribution for display
 */
function formatPlayersCount(phase: TrainingPhase): string {
  if (phase.playerOrganization) {
    const { groups, playersPerGroup, restingPlayers } = phase.playerOrganization;
    if (groups > 0 && playersPerGroup > 0) {
      const restText = restingPlayers > 0 ? ` + ${restingPlayers} dự bị/luân phiên` : '';
      return `${phase.players} Cầu thủ (${groups} nhóm ${playersPerGroup}${restText})`;
    }
  }
  return `${phase.players} Cầu thủ`;
}

/**
 * Maps Gemini structured training plan into the UI's TrainingSession model
 */
export function mapGeminiPlanToSession(
  plan: GeminiTrainingPlan,
  topic: string
): TrainingSession {
  const sessionId = `session_${Date.now()}`;

  const blocks: Exercise[] = plan.phases.map((phase, idx) => {
    const blockType = inferBlockType(phase.phase, idx);
    const howItWorks = parseExecutionSteps(phase.execution);
    const playersCount = formatPlayersCount(phase);
    const pitchDiagram = generatePitchDiagramForPhase(blockType, phase.players);

    return {
      id: phase.id || `drill_${sessionId}_${idx + 1}`,
      blockType,
      blockName: phase.phase || `Giai đoạn ${idx + 1}`,
      exerciseName: phase.exerciseName,
      duration: phase.duration,
      playersCount,
      areaSize: phase.area || '25 × 20 m',
      equipment: phase.equipment || ['Bóng', 'Cọc tiêu', 'Áo bib'],
      organization: phase.organization,
      howItWorks,
      coachingPoints: phase.coachingPoints || [],
      progression: phase.progression,
      pitchDiagram,
    };
  });

  return {
    id: sessionId,
    title: plan.sessionTitle || `Giáo án: ${topic}`,
    objective: plan.mainObjective || `Phát triển kỹ năng bóng đá chuyên đề ${topic}`,
    topic,
    playerCount: plan.players,
    totalDuration: plan.duration as SessionDuration,
    createdAt: new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    blocks,
  };
}
