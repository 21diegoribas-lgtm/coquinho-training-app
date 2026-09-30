/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiTrainingPlan, TrainingPhase } from '../types/trainingPlan';
import {
  BlockType,
  Exercise,
  SessionDuration,
  TrainingSession,
} from '../types/session';
import { formatFromOrganization, formatPlayerDistribution, toPlayerOrganization } from './playerAccounting';
import { sanitizeGeminiPlan } from './planValidation';
import { normalizeDurationsToTotal } from './durationUtils';
import { buildDrillDiagram } from './drillDiagramService';

/**
 * Validates inputs prior to calling the Gemini API
 */
export function validatePlanInput(
  players: number,
  trainingFocus: string,
  duration: number
): string | null {
  if (!Number.isInteger(players) || players < 4) {
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

const GEMINI_REQUEST_TIMEOUT_MS = 30000;

function durationSplit(duration: number): [number, number, number, number, number] {
  if (duration === 60) return [10, 10, 15, 10, 15];
  if (duration === 75) return [10, 15, 15, 15, 20];
  return [15, 15, 20, 20, 20];
}

function buildLocalFallbackPlan(params: {
  players: number;
  trainingFocus: string;
  duration: number;
}): GeminiTrainingPlan {
  const durations = durationSplit(params.duration);
  const topic = params.trainingFocus.trim();
  const blockTypes: BlockType[] = ['warm_up', 'technical', 'skill', 'small_sided', 'match'];
  const phaseNames = ['Khởi động', 'Kỹ thuật', 'Phát triển kỹ năng', 'Tình huống đối kháng', 'Thi đấu'];

  return {
    sessionTitle: `Chuyên đề: ${topic}`,
    mainObjective: `Phát triển kỹ năng ${topic} cho ${params.players} cầu thủ trong buổi tập ${params.duration} phút.`,
    players: params.players,
    duration: params.duration,
    ageGroup: 'Bóng đá cộng đồng / Phong trào',
    sessionOverview: `Buổi tập ${params.duration} phút gồm 5 giai đoạn liên hoàn chuẩn đào tạo, đảm bảo tất cả cầu thủ đều được vận động liên tục.`,
    generationSource: 'fallback',
    phases: phaseNames.map((phase, idx) => {
      const blockType = blockTypes[idx];
      const org = toPlayerOrganization(params.players, blockType);
      return {
        id: `phase-${idx + 1}`,
        phase,
        exerciseName:
          idx === 0
            ? `Khởi động luân chuyển bóng & ${topic}`
            : idx === 1
              ? `Bài tập trạm kỹ thuật chuyên sâu: ${topic}`
              : idx === 2
                ? `Bài tập có định hướng đối kháng: ${topic}`
                : idx === 3
                  ? `Đối kháng nhóm nhỏ ghi điểm cầu môn mini`
                  : `Trận đấu tự do thực chiến có áp dụng ${topic}`,
        duration: durations[idx],
        players: params.players,
        area: ['25 × 20 m', '20 × 20 m', '35 × 25 m', '40 × 30 m', 'Sân 7 người tiêu chuẩn'][idx],
        equipment: ['Bóng', 'Cọc tiêu', 'Áo bib'],
        organization: `${formatPlayerDistribution(params.players, blockType)}. Bóng luân chuyển liên tục, hạn chế đứng chờ.`,
        execution: `Cầu thủ thực hiện các bài tập ${phase.toLowerCase()} kết hợp chủ đề ${topic}.`,
        coachingPoints: [
          'Kiểm tra vai quan sát không gian trước khi nhận bóng.',
          'Mở thân người về hướng tấn công tiếp theo.',
          'Chạm bước một êm và chủ động.',
        ],
        progression: 'Giới hạn 2 chạm để tăng tốc độ xử lý; đổi hướng luân chuyển để dùng cả hai chân.',
        playerOrganization: org,
      };
    }),
  };
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

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        players: params.players,
        trainingFocus: params.trainingFocus.trim(),
        duration: params.duration,
      }),
    });

    if (response.ok) {
      const data: unknown = await response.json();
      const sanitized = sanitizeGeminiPlan(data, {
        topic: params.trainingFocus.trim(),
        players: params.players,
        duration: params.duration as SessionDuration,
      });
      if (sanitized) {
        const source =
          (data as GeminiTrainingPlan).generationSource === 'gemini' ? 'gemini' : 'fallback';
        return { ...sanitized, generationSource: source };
      }
    } else {
      const errorData = await response.json().catch(() => null);
      console.error('[generate-plan] server error', {
        status: response.status,
        error: errorData?.error ?? 'unknown',
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message && (message.includes('tối thiểu') || message.includes('trống'))) {
      throw err;
    }
    console.warn('Fetch to /api/generate-plan failed, using local fallback plan:', message);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  return buildLocalFallbackPlan(params);
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
 * Builds a drill-specific static diagram from the generated drill data.
 * Shared with the local session generator so fallback and Gemini plans render consistently.
 */
function generatePitchDiagramForPhase(
  phase: TrainingPhase,
  blockType: BlockType
) {
  return buildDrillDiagram({
    blockType,
    exerciseName: phase.exerciseName,
    playerCount: phase.players,
    organization: phase.organization,
    execution: phase.execution,
    equipment: phase.equipment,
    playerOrganization: phase.playerOrganization,
    coachingPoints: phase.coachingPoints,
  });
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
function formatPlayersCount(phase: TrainingPhase, blockType: BlockType): string {
  const leftover = phase.playerOrganization?.leftover ?? phase.playerOrganization?.restingPlayers ?? 0;
  if (phase.playerOrganization && phase.playerOrganization.groups * phase.playerOrganization.playersPerGroup + leftover === phase.players) {
    return formatFromOrganization(phase.players, phase.playerOrganization);
  }
  return formatPlayerDistribution(phase.players, blockType);
}

/**
 * Maps Gemini structured training plan into the UI's TrainingSession model
 */
export function mapGeminiPlanToSession(
  plan: GeminiTrainingPlan,
  topic: string
): TrainingSession {
  const sanitized = sanitizeGeminiPlan(plan, {
    topic,
    players: plan.players,
    duration: plan.duration as SessionDuration,
  });
  if (!sanitized) throw new Error('Giáo án không hợp lệ.');
  const safePlan = sanitized;
  const sessionId = `session_${Date.now()}`;

  const phases = normalizeDurationsToTotal(safePlan.phases, safePlan.duration);

  const blocks: Exercise[] = phases.map((phase, idx) => {
    const blockType = inferBlockType(phase.phase, idx);
    const howItWorks = parseExecutionSteps(phase.execution);
    const org = phase.playerOrganization
      ? {
          groups: phase.playerOrganization.groups,
          playersPerGroup: phase.playerOrganization.playersPerGroup,
          leftover: phase.playerOrganization.leftover ?? phase.playerOrganization.restingPlayers ?? 0,
          leftoverRole: phase.playerOrganization.leftoverRole,
        }
      : toPlayerOrganization(phase.players, blockType);
    const playersCount = formatPlayersCount({ ...phase, playerOrganization: org }, blockType);
    const pitchDiagram = generatePitchDiagramForPhase(phase, blockType);

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
      playerOrganization: org,
      pitchDiagram,
    };
  });

  return {
    id: sessionId,
    title: safePlan.sessionTitle || `Giáo án: ${topic}`,
    objective: safePlan.mainObjective || `Phát triển kỹ năng bóng đá chuyên đề ${topic}`,
    topic,
    playerCount: safePlan.players,
    totalDuration: safePlan.duration,
    selectedDuration: safePlan.duration as SessionDuration,
    createdAt: new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    blocks,
    generationSource: plan.generationSource ?? safePlan.generationSource,
  };
}
