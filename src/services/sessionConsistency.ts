import { ExercisePlayerOrganization, GameFormat, TrainingSession } from '../types/session';
import { GeminiTrainingPlan } from '../types/trainingPlan';
import { validPlayerOrganization } from './playerAccounting';

const FORMAT_SIZE: Record<GameFormat, number> = { 'Futsal 5v5': 5, '7v7': 7, '9v9': 9, '11v11': 11 };

function playingFormats(text: string): Array<[number, number, number]> {
  // A context label is not a claim about the on-field team sizes.
  const actual = text.replace(/(?:bối cảnh|context|định hướng)\s*(?:Futsal\s*)?\d+\s*v\s*\d+/gi, '');
  return [...actual.matchAll(/\b(\d+)\s*v\s*(\d+)(?:\s*\(?\s*\+\s*(\d+)\s*(?:jokers?|neutrals?|cầu thủ tự do))?/gi)]
    .map(match => [+match[1], +match[2], +(match[3] || 0)]);
}

export function titleMatchesOrganization(title: string, organization: string, org: ExercisePlayerOrganization): boolean {
  const described = playingFormats(organization);
  const extra = org.leftover ?? org.restingPlayers ?? 0;
  return playingFormats(title).every(([a, b, neutral]) => {
    if (described.length && !described.some(([x, y, n]) => a === x && b === y && neutral === n)) return false;
    // Existing data represents either equal teams, or repeated fields/groups.
    return (org.groups === 2 && a === org.playersPerGroup && b === org.playersPerGroup && neutral === extra) ||
      a + b + neutral === org.playersPerGroup;
  });
}

export function finalGameTitle(format: GameFormat, org: ExercisePlayerOrganization): string {
  const extra = org.leftover ?? org.restingPlayers ?? 0;
  const actual = `${org.playersPerGroup}v${org.playersPerGroup}${extra ? ` + ${extra} ${org.leftoverRole === 'joker' ? 'joker' : 'cầu thủ xoay tua'}` : ''}`;
  return org.playersPerGroup === FORMAT_SIZE[format] && extra === 0
    ? `Trận đấu ${format} tiêu chuẩn`
    : `Thi đấu ${actual} đại diện điều chỉnh (bối cảnh ${format})`;
}

export function validatePlanConsistency(plan: GeminiTrainingPlan): string[] {
  const errors: string[] = [];
  if (plan.phases.length < 4 || plan.phases.length > 6) errors.push('phase count');
  for (const match of (plan.sessionOverview || '').matchAll(/\b(\d+)\s*(?:giai đoạn|phases?)\b/gi)) {
    if (+match[1] !== plan.phases.length) errors.push('summary phase count');
  }
  if (plan.phases.some(phase => !Number.isInteger(phase.duration) || phase.duration <= 0) ||
    plan.phases.reduce((sum, phase) => sum + phase.duration, 0) !== plan.duration) errors.push('session timeline');
  if (plan.gameFormat && !(plan.gameFormat in FORMAT_SIZE)) errors.push('gameFormat');
  plan.phases.forEach((phase, index) => {
    if (phase.players !== plan.players || !validPlayerOrganization(phase.playerOrganization, phase.players)) {
      errors.push(`phase[${index}] player arithmetic`);
    } else if (!titleMatchesOrganization(phase.exerciseName, phase.organization, phase.playerOrganization)) {
      errors.push(`phase[${index}] title vs player structure`);
    }
  });
  const final = plan.phases.at(-1);
  if (final && plan.gameFormat && plan.gameFormat in FORMAT_SIZE) {
    const size = FORMAT_SIZE[plan.gameFormat];
    const formats = playingFormats(final.exerciseName);
    const adapted = /đại diện|điều chỉnh|thu nhỏ|adapted|representative/i.test(final.exerciseName);
    for (const context of final.exerciseName.matchAll(/(?:bối cảnh|context|định hướng)\s*(?:Futsal\s*)?(\d+)\s*v\s*(\d+)/gi)) {
      if (+context[1] !== size || +context[2] !== size) errors.push('final gameFormat label');
    }
    if (!formats.length || formats.some(([a, b, extra]) => (a !== size || b !== size || extra > 0) && !adapted)) {
      errors.push('final gameFormat context');
    }
    if (/tiêu chuẩn|hoàn chỉnh|regulation|standard/i.test(final.exerciseName) &&
      (formats.some(([a, b, extra]) => a !== size || b !== size || extra > 0) ||
        final.playerOrganization?.groups !== 2 || final.playerOrganization?.playersPerGroup !== size ||
        (final.playerOrganization?.leftover ?? final.playerOrganization?.restingPlayers ?? 0) !== 0)) {
      errors.push('final regulation label');
    }
  }
  return errors;
}

export function checkGeneratedSession(session: TrainingSession): TrainingSession {
  const errors = validatePlanConsistency({
    sessionTitle: session.title, mainObjective: session.objective, players: session.playerCount,
    duration: session.totalDuration, gameFormat: session.gameFormat,
    phases: session.blocks.map(block => ({
      id: block.id, phase: block.blockName, exerciseName: block.exerciseName, duration: block.duration,
      players: session.playerCount, area: block.areaSize, equipment: block.equipment,
      organization: block.organization, execution: block.howItWorks.join('\n'),
      coachingPoints: block.coachingPoints, playerOrganization: block.playerOrganization,
    })),
  });
  if (errors.length) throw new Error(`Inconsistent generated session: ${errors.join(', ')}`);
  return session;
}
