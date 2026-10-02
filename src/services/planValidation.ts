import { explicitOrganization, organizationMatchesStructure, validPlayerOrganization } from './playerAccounting';
import { GeminiTrainingPlan, TrainingPhase } from '../types/trainingPlan';
import { Exercise, GameFormat, SessionDuration, TrainingSession } from '../types/session';
import { isSessionDuration, normalizeDurationsToTotal } from './durationUtils';
import { validatePlanConsistency, validateTrainingSessionConsistency } from './sessionConsistency';
import { safeStructuredDiagram, validateStructuredDiagram } from './structuredDiagram';

export const GENERIC_PROGRESSION =
  'Điều chỉnh độ khó: giới hạn số lần chạm bóng (1-2 chạm), thu hẹp hoặc mở rộng diện tích sân, hoặc bổ sung cầu thủ phòng ngự áp sát để tăng tính thực chiến.';

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean);
    if (items.length > 0) return items;
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...fallback];
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function uniqueId(id: string, used: Set<string>, fallback: string): string {
  let next = id.trim() || fallback;
  if (!used.has(next)) {
    used.add(next);
    return next;
  }
  let i = 2;
  while (used.has(`${next}-${i}`)) i += 1;
  const unique = `${next}-${i}`;
  used.add(unique);
  return unique;
}

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateGeminiPlan(plan: unknown): PlanValidationResult {
  const errors: string[] = [];
  if (!plan || typeof plan !== 'object') {
    return { ok: false, errors: ['Plan is empty'] };
  }
  const p = plan as Record<string, unknown>;

  if (!asNonEmptyString(p.sessionTitle, '')) errors.push('sessionTitle');
  const players = Number(p.players);
  if (!Number.isInteger(players) || players < 4 || players > 50) errors.push('players');
  if (!isSessionDuration(Number(p.duration))) errors.push('duration');
  if (!Array.isArray(p.phases) || (p.phases.length < 4 || p.phases.length > 6)) errors.push('phases');

  const ids = new Set<string>();
  if (Array.isArray(p.phases)) {
    p.phases.forEach((phase, idx) => {
      const ph = (phase || {}) as Record<string, unknown>;
      const id = asNonEmptyString(ph.id, '');
      if (!id) errors.push(`phase[${idx}].id`);
      else if (ids.has(id)) errors.push(`phase[${idx}].id duplicate`);
      else ids.add(id);

      if (!Number.isFinite(Number(ph.duration)) || Number(ph.duration) <= 0) {
        errors.push(`phase[${idx}].duration`);
      }
      if (!asNonEmptyString(ph.exerciseName, '')) errors.push(`phase[${idx}].exerciseName`);
      if (!asNonEmptyString(ph.organization, '')) errors.push(`phase[${idx}].organization`);
      if (!Number.isInteger(ph.players) || Number(ph.players) < 4 || Number(ph.players) > 50) errors.push(`phase[${idx}].players`);
      if (!validPlayerOrganization(ph.playerOrganization, Number(ph.players))) {
        errors.push(`phase[${idx}].playerOrganization total/roles`);
      } else if (!organizationMatchesStructure(String(ph.organization || ''), ph.playerOrganization)) {
        errors.push(`phase[${idx}].organization contradicts playerOrganization`);
      }
      if (!asNonEmptyString(ph.execution, '')) errors.push(`phase[${idx}].execution`);
      const points = ph.coachingPoints;
      if (!Array.isArray(points) || points.length === 0 || points.some(v => typeof v !== 'string' || !v.trim())) {
        errors.push(`phase[${idx}].coachingPoints`);
      }
      if (ph.diagram !== undefined) {
        const diagramRes = validateStructuredDiagram(ph.diagram, Number(ph.players));
        if (!diagramRes.ok) {
          errors.push(...diagramRes.errors.map(err => `phase[${idx}].diagram ${err}`));
        }
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

export function sanitizeGeminiPlan(
  plan: unknown,
  fallbacks: { topic: string; players: number; duration: SessionDuration; gameFormat?: GameFormat }
): GeminiTrainingPlan | null {
  if (!plan || typeof plan !== 'object') return null;
  const raw = plan as Record<string, unknown>;
  const phasesRaw = Array.isArray(raw.phases) ? raw.phases : [];
  if (!validateGeminiPlan(plan).ok) return null;
  if (phasesRaw.some(ph => ph.players !== fallbacks.players)) return null;
  if (fallbacks.gameFormat && raw.gameFormat && raw.gameFormat !== fallbacks.gameFormat) return null;

  const usedIds = new Set<string>();
  const phases: TrainingPhase[] = phasesRaw.map((phase, idx) => {
    const ph = (phase || {}) as Record<string, unknown>;
    const blockType = (['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const)[Math.min(idx, 4)];
    const playerOrg = normalizeOrganization(ph.playerOrganization, fallbacks.players);
    return {
      id: uniqueId(asNonEmptyString(ph.id, ''), usedIds, `phase-${idx + 1}`),
      phase: asNonEmptyString(ph.phase, `Giai đoạn ${idx + 1}`),
      exerciseName: asNonEmptyString(ph.exerciseName, `Bài tập ${idx + 1}`),
      duration: asPositiveNumber(ph.duration, 10),
      players: fallbacks.players,
      area: asNonEmptyString(ph.area, '25 × 20 m'),
      equipment: asStringArray(ph.equipment, ['Bóng', 'Cọc tiêu', 'Áo bib']),
      organization: explicitOrganization(String(ph.organization), fallbacks.players, playerOrg),
      execution: asNonEmptyString(ph.execution, 'Cầu thủ thực hiện các bài tập chuyền và di chuyển.'),
      coachingPoints: asStringArray(ph.coachingPoints, [
        'Quan sát trước khi nhận bóng.',
        'Mở thân người về hướng tấn công.',
      ]),
      progression: typeof ph.progression === 'string' && ph.progression.trim()
        ? ph.progression.trim()
        : undefined,
      playerOrganization: playerOrg,
      diagram: safeStructuredDiagram(ph.diagram, fallbacks.players, {
        blockType,
        playerCount: fallbacks.players,
        playerOrganization: playerOrg,
        exerciseName: asNonEmptyString(ph.exerciseName, `Bài tập ${idx + 1}`),
        topic: fallbacks.topic,
      }),
    };
  });

  const duration = fallbacks.duration;

  const normalized = normalizeDurationsToTotal(phases, duration);

  const sessionTitle = asNonEmptyString(raw.sessionTitle, `Giáo án: ${fallbacks.topic}`);
  const players = fallbacks.players;

  if (!sessionTitle || players < 4 || !normalized.length) return null;

  const gameFormat: GameFormat = ['Futsal 5v5', '7v7', '9v9', '11v11'].includes(raw.gameFormat as string)
    ? (raw.gameFormat as GameFormat)
    : (fallbacks.gameFormat || '7v7');

  const sanitized: GeminiTrainingPlan = {
    sessionTitle,
    mainObjective: asNonEmptyString(raw.mainObjective, `Phát triển kỹ năng ${fallbacks.topic}`),
    players,
    duration,
    gameFormat,
    ageGroup: typeof raw.ageGroup === 'string' ? raw.ageGroup : undefined,
    sessionOverview: typeof raw.sessionOverview === 'string' ? raw.sessionOverview : undefined,
    phases: normalized,
    generationSource: raw.generationSource === 'gemini' || raw.generationSource === 'fallback'
      ? raw.generationSource
      : undefined,
  };
  return validatePlanConsistency(sanitized).length ? null : sanitized;
}

export function sanitizeTrainingSession(session: unknown): TrainingSession | null {
  if (!session || typeof session !== 'object') return null;
  const raw = session as Record<string, unknown>;
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (!blocksRaw.length || blocksRaw.length > 60 || blocksRaw.some(b => !b || typeof b !== 'object' ||
    typeof b.exerciseName !== 'string' || !b.exerciseName.trim() ||
    typeof b.organization !== 'string' || !b.organization.trim() ||
    !Number.isInteger(b.duration) || b.duration <= 0 ||
    !Array.isArray(b.howItWorks) || !b.howItWorks.length || b.howItWorks.some((v: unknown) => typeof v !== 'string' || !v.trim()) ||
    !Array.isArray(b.coachingPoints) || !b.coachingPoints.length || b.coachingPoints.some((v: unknown) => typeof v !== 'string' || !v.trim()))) return null;

  const usedIds = new Set<string>();
  const blocks: Exercise[] = blocksRaw.map((block, idx) => {
    const b = (block || {}) as Record<string, unknown>;
    const howItWorks = asStringArray(b.howItWorks, ['Thực hiện bài tập theo hướng dẫn của huấn luyện viên.']);
    const coachingPoints = asStringArray(b.coachingPoints, [
      'Quan sát trước khi nhận bóng.',
      'Mở thân người về hướng tấn công.',
    ]);
    return {
      id: uniqueId(asNonEmptyString(b.id, ''), usedIds, `drill-${idx + 1}`),
      blockType: (['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const).includes(
        b.blockType as Exercise['blockType']
      )
        ? (b.blockType as Exercise['blockType'])
        : 'technical',
      blockName: asNonEmptyString(b.blockName, `Giai đoạn ${idx + 1}`),
      exerciseName: asNonEmptyString(b.exerciseName, `Bài tập ${idx + 1}`),
      duration: asPositiveNumber(b.duration, 10),
      playersCount: asNonEmptyString(b.playersCount, ''),
      areaSize: asNonEmptyString(b.areaSize, '25 × 20 m'),
      equipment: asStringArray(b.equipment, ['Bóng', 'Cọc tiêu', 'Áo bib']),
      organization: asNonEmptyString(b.organization, 'Bố trí sân bãi và chia nhóm cầu thủ đồng đều.'),
      howItWorks,
      coachingPoints,
      pitchDiagram: safeDiagram(b.pitchDiagram),
      diagram: safeStructuredDiagram(b.diagram, asPositiveNumber(raw.playerCount, 16), {
        blockType: (['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const)[Math.min(idx, 4)],
        playerCount: asPositiveNumber(raw.playerCount, 16),
        playerOrganization:
          b.playerOrganization && typeof b.playerOrganization === 'object'
            ? (b.playerOrganization as Exercise['playerOrganization'])
            : undefined,
        exerciseName: asNonEmptyString(b.exerciseName, `Bài tập ${idx + 1}`),
        topic: asNonEmptyString(raw.title, 'Bóng đá'),
      }),
      progression: typeof b.progression === 'string' && b.progression.trim() ? b.progression.trim() : undefined,
      playerOrganization:
        b.playerOrganization && typeof b.playerOrganization === 'object'
          ? (b.playerOrganization as Exercise['playerOrganization'])
          : undefined,
    };
  });

  const title = asNonEmptyString(raw.title, '');
  const playerCount = asPositiveNumber(raw.playerCount, 0);
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);

  if (!title || !Number.isInteger(playerCount) || playerCount < 4 || playerCount > 50 || !Number.isFinite(raw.totalDuration) || Number(raw.totalDuration) <= 0 || !totalDuration) return null;
  if (blocks.some(b => b.playerOrganization &&
    (!validPlayerOrganization(b.playerOrganization, playerCount) ||
      !organizationMatchesStructure(b.organization, b.playerOrganization)))) return null;
  if (blocks.some((b) => !b.exerciseName || !b.organization || !b.howItWorks.length || !b.coachingPoints.length)) {
    return null;
  }

  const normalizedBlocks = blocks;

  const sanitized: TrainingSession = {
    id: asNonEmptyString(raw.id, `session_${Date.now()}`),
    title,
    objective: asNonEmptyString(raw.objective, title),
    topic: asNonEmptyString(raw.topic, title),
    playerCount,
    totalDuration,
    selectedDuration: isSessionDuration(raw.selectedDuration) ? raw.selectedDuration : isSessionDuration(raw.totalDuration) ? raw.totalDuration : 90,
    gameFormat: ['Futsal 5v5', '7v7', '9v9', '11v11'].includes(raw.gameFormat as string)
      ? (raw.gameFormat as 'Futsal 5v5' | '7v7' | '9v9' | '11v11')
      : '7v7',
    createdAt: asNonEmptyString(raw.createdAt, new Date().toLocaleDateString('vi-VN')),
    blocks: normalizedBlocks,
    generationSource:
      raw.generationSource === 'gemini' || raw.generationSource === 'fallback'
        ? raw.generationSource
        : undefined,
  };
  return validateTrainingSessionConsistency(sanitized).length ? null : sanitized;
}

export function isUsableTrainingSession(session: TrainingSession | null): session is TrainingSession {
  return Boolean(session && session.title && session.blocks.length > 0);
}

function normalizeOrganization(value: any, total: number) {
  if (!validPlayerOrganization(value, total)) throw new Error('Invalid player organization');
  const leftover = value.leftover ?? value.restingPlayers ?? 0;
  return { groups: value.groups, playersPerGroup: value.playersPerGroup, leftover,
    leftoverRole: value.leftoverRole ?? (leftover ? 'rotation' as const : 'none' as const) };
}

// Discard malformed optional diagrams on load; rendering/generation remains unchanged.
function safeDiagram(value: any): Exercise['pitchDiagram'] {
  if (!value || typeof value !== 'object') return undefined;
  const point = (p: any) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!Array.isArray(value.players) || !value.players.every((p: any) => point(p) && ['teamA','teamB','neutral','gk'].includes(p.role) && (p.label === undefined || typeof p.label === 'string'))) return undefined;
  for (const key of ['cones','goals']) if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].every(point))) return undefined;
  if (value.arrows !== undefined && (!Array.isArray(value.arrows) || !value.arrows.every((a: any) => a && ['pass','run','dribble'].includes(a.type) && [a.from,a.to].every(v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))))) return undefined;
  if (value.ball !== undefined && !point(value.ball)) return undefined;
  if (value.coachingCueOverlay !== undefined && typeof value.coachingCueOverlay !== 'string') return undefined;
  return value;
}
