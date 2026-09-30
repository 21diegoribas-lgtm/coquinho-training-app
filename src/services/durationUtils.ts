import { Exercise, SessionDuration, TrainingSession } from '../types/session';

export const SESSION_DURATIONS: SessionDuration[] = [60, 75, 90];

export function isSessionDuration(value: unknown): value is SessionDuration {
  return value === 60 || value === 75 || value === 90;
}

export function sumBlockDurations(blocks: Pick<Exercise, 'duration'>[]): number {
  return blocks.reduce((sum, b) => sum + (Number(b.duration) || 0), 0);
}

/** Allocate integer minutes proportionally with a five-minute minimum. */
export function normalizeDurationsToTotal<T extends { duration: number }>(phases: T[], targetTotal: number): T[] {
  if (!isSessionDuration(targetTotal) || !phases.length || phases.length * 5 > targetTotal) {
    throw new Error('Invalid phase count or target duration');
  }
  const weights = phases.map(p => Number.isFinite(p.duration) && p.duration > 0 ? Math.max(5, Math.round(p.duration)) : 5);
  if (weights.reduce((a,b) => a+b, 0) === targetTotal) return phases.map((p,i) => ({...p, duration: weights[i]}));
  const max = Math.max(...weights);
  const scaled = weights.map(w => w / max);
  const sum = scaled.reduce((a,b) => a+b, 0);
  const remaining = targetTotal - phases.length * 5;
  const shares = scaled.map(w => remaining * w / sum);
  const minutes = shares.map(v => 5 + Math.floor(v));
  let extra = targetTotal - minutes.reduce((a,b) => a+b, 0);
  const order = shares.map((v,i) => ({i, fraction: v-Math.floor(v)})).sort((a,b) => b.fraction-a.fraction);
  for (let i=0; i<extra; i++) minutes[order[i % order.length].i]++;
  return phases.map((p,i) => ({...p, duration: minutes[i]}));
}

/** Keep the selected session length exact when one exercise duration is edited. */
export function applyExerciseDurationChange(
  blocks: Exercise[],
  updated: Exercise,
  targetTotal: SessionDuration
): Exercise[] {
  const editedDuration = Math.max(5, Math.min(targetTotal - 5 * Math.max(0, blocks.length - 1), Math.round(Number(updated.duration) || 5)));

  const next = blocks.map((b) =>
    b.id === updated.id ? { ...updated, duration: editedDuration } : { ...b }
  );

  let diff = targetTotal - sumBlockDurations(next);
  if (diff === 0) return next;

  const otherIndexes = next
    .map((_, i) => i)
    .filter((i) => next[i].id !== updated.id);

  if (diff > 0) {
    const i = otherIndexes[otherIndexes.length - 1] ?? 0;
    next[i] = { ...next[i], duration: next[i].duration + diff };
    return next;
  }

  let remaining = -diff;
  for (let k = otherIndexes.length - 1; k >= 0 && remaining > 0; k--) {
    const i = otherIndexes[k];
    const reducible = next[i].duration - 5;
    const take = Math.min(reducible, remaining);
    if (take > 0) {
      next[i] = { ...next[i], duration: next[i].duration - take };
      remaining -= take;
    }
  }

  if (remaining > 0) {
    const editedIdx = next.findIndex((b) => b.id === updated.id);
    if (editedIdx >= 0) {
      next[editedIdx] = {
        ...next[editedIdx],
        duration: Math.max(5, next[editedIdx].duration - remaining),
      };
    }
  }

  return next;
}
