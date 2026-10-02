/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BallDribbleAction,
  BallPassAction,
  BlockType,
  CoachingMomentFocus,
  DiagramAnimation,
  DiagramAnimationAction,
  DiagramAnimationStep,
  DiagramBall,
  DiagramCoachingMoment,
  DiagramCoachingSequence,
  DiagramCone,
  DiagramCoordinate,
  DiagramGoal,
  DiagramPath,
  DiagramPitch,
  DiagramPlayer,
  DiagramRepresentation,
  DiagramTeam,
  DiagramZone,
  ExercisePlayerOrganization,
  GameFormat,
  PlayerMoveAction,
  SemanticCoachingEvent,
  StructuredDrillDiagram,
} from '../types/session';

export interface DiagramValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_TEAMS = new Set<DiagramTeam>(['blue', 'red', 'neutral', 'goalkeeper']);
const VALID_PATH_TYPES = new Set(['pass', 'movement', 'dribble']);
const VALID_ACTION_TYPES = new Set(['playerMove', 'ballPass', 'ballDribble']);

/**
 * Lightweight validator for structured drill diagrams.
 * Checks:
 * - Logical coordinates within 0–100 for players, balls, cones, goals, zones
 * - Unique player IDs
 * - Valid team values ('blue' | 'red' | 'neutral' | 'goalkeeper')
 * - Path references to existing player IDs
 * - Diagram players not exceeding available players
 */
export function validateStructuredDiagram(
  diagram: unknown,
  availablePlayers?: number
): DiagramValidationResult {
  const errors: string[] = [];

  if (!diagram || typeof diagram !== 'object') {
    return { ok: false, errors: ['Diagram must be a non-null object'] };
  }

  const d = diagram as Record<string, unknown>;

  // 1. Pitch
  if (!d.pitch || typeof d.pitch !== 'object') {
    errors.push('Diagram missing pitch specification');
  } else {
    const pitch = d.pitch as DiagramPitch;
    if (typeof pitch.width !== 'number' || typeof pitch.height !== 'number' || pitch.width <= 0 || pitch.height <= 0) {
      errors.push('Pitch width and height must be positive numbers');
    }
  }

  // 2. Players
  if (!Array.isArray(d.players)) {
    errors.push('Diagram players must be an array');
    return { ok: false, errors };
  }

  if (d.players.length === 0) {
    errors.push('Diagram must contain at least one player');
  }

  if (typeof availablePlayers === 'number' && availablePlayers > 0 && d.players.length > availablePlayers) {
    errors.push(
      `Diagram player count (${d.players.length}) exceeds available players (${availablePlayers})`
    );
  }

  const seenPlayerIds = new Set<string>();

  d.players.forEach((p, idx) => {
    if (!p || typeof p !== 'object') {
      errors.push(`Player at index ${idx} is invalid`);
      return;
    }
    const player = p as Record<string, unknown>;
    const id = typeof player.id === 'string' ? player.id.trim() : '';
    if (!id) {
      errors.push(`Player at index ${idx} missing id`);
    } else if (seenPlayerIds.has(id)) {
      errors.push(`Duplicate player id: '${id}'`);
    } else {
      seenPlayerIds.add(id);
    }

    const team = typeof player.team === 'string' ? player.team.trim() as DiagramTeam : '' as DiagramTeam;
    if (!VALID_TEAMS.has(team)) {
      errors.push(`Player '${id || idx}' has invalid team: '${String(player.team)}'. Allowed: blue, red, neutral, goalkeeper`);
    }

    if (typeof player.x !== 'number' || !Number.isFinite(player.x) || player.x < 0 || player.x > 100) {
      errors.push(`Player '${id || idx}' coordinate x (${player.x}) out of bounds (0-100)`);
    }
    if (typeof player.y !== 'number' || !Number.isFinite(player.y) || player.y < 0 || player.y > 100) {
      errors.push(`Player '${id || idx}' coordinate y (${player.y}) out of bounds (0-100)`);
    }
  });

  // 3. Balls
  const seenBallIds = new Set<string>();
  if (d.balls !== undefined) {
    if (!Array.isArray(d.balls)) {
      errors.push('Balls must be an array');
    } else {
      d.balls.forEach((b, idx) => {
        if (!b || typeof b !== 'object') {
          errors.push(`Ball at index ${idx} is invalid`);
          return;
        }
        const ball = b as Record<string, unknown>;
        if (typeof ball.id === 'string' && ball.id.trim()) {
          seenBallIds.add(ball.id.trim());
        }
        if (typeof ball.x !== 'number' || !Number.isFinite(ball.x) || ball.x < 0 || ball.x > 100) {
          errors.push(`Ball '${ball.id || idx}' coordinate x (${ball.x}) out of bounds (0-100)`);
        }
        if (typeof ball.y !== 'number' || !Number.isFinite(ball.y) || ball.y < 0 || ball.y > 100) {
          errors.push(`Ball '${ball.id || idx}' coordinate y (${ball.y}) out of bounds (0-100)`);
        }
      });
    }
  }

  // 4. Cones
  if (d.cones !== undefined) {
    if (!Array.isArray(d.cones)) {
      errors.push('Cones must be an array');
    } else {
      d.cones.forEach((c, idx) => {
        if (!c || typeof c !== 'object') {
          errors.push(`Cone at index ${idx} is invalid`);
          return;
        }
        const cone = c as Record<string, unknown>;
        if (typeof cone.x !== 'number' || !Number.isFinite(cone.x) || cone.x < 0 || cone.x > 100) {
          errors.push(`Cone '${cone.id || idx}' coordinate x (${cone.x}) out of bounds (0-100)`);
        }
        if (typeof cone.y !== 'number' || !Number.isFinite(cone.y) || cone.y < 0 || cone.y > 100) {
          errors.push(`Cone '${cone.id || idx}' coordinate y (${cone.y}) out of bounds (0-100)`);
        }
      });
    }
  }

  // 5. Goals
  if (d.goals !== undefined) {
    if (!Array.isArray(d.goals)) {
      errors.push('Goals must be an array');
    } else {
      d.goals.forEach((g, idx) => {
        if (!g || typeof g !== 'object') {
          errors.push(`Goal at index ${idx} is invalid`);
          return;
        }
        const goal = g as Record<string, unknown>;
        if (typeof goal.x !== 'number' || !Number.isFinite(goal.x) || goal.x < 0 || goal.x > 100) {
          errors.push(`Goal '${goal.id || idx}' coordinate x (${goal.x}) out of bounds (0-100)`);
        }
        if (typeof goal.y !== 'number' || !Number.isFinite(goal.y) || goal.y < 0 || goal.y > 100) {
          errors.push(`Goal '${goal.id || idx}' coordinate y (${goal.y}) out of bounds (0-100)`);
        }
      });
    }
  }

  // 6. Zones
  if (d.zones !== undefined && !Array.isArray(d.zones)) {
    errors.push('Zones must be an array');
  }

  // 7. Paths
  if (d.paths !== undefined) {
    if (!Array.isArray(d.paths)) {
      errors.push('Paths must be an array');
    } else {
      d.paths.forEach((p, idx) => {
        if (!p || typeof p !== 'object') {
          errors.push(`Path at index ${idx} is invalid`);
          return;
        }
        const path = p as Record<string, unknown>;
        const pType = typeof path.type === 'string' ? path.type.trim() : '';
        if (!VALID_PATH_TYPES.has(pType)) {
          errors.push(`Path '${path.id || idx}' has invalid type: '${pType}'. Allowed: pass, movement, dribble`);
        }

        const fromId = typeof path.fromPlayerId === 'string' ? path.fromPlayerId.trim() : '';
        if (!fromId) {
          errors.push(`Path '${path.id || idx}' missing fromPlayerId`);
        } else if (!seenPlayerIds.has(fromId)) {
          errors.push(`Path '${path.id || idx}' references non-existent fromPlayerId: '${fromId}'`);
        }

        const toId = typeof path.toPlayerId === 'string' ? path.toPlayerId.trim() : undefined;
        if (toId && !seenPlayerIds.has(toId)) {
          errors.push(`Path '${path.id || idx}' references non-existent toPlayerId: '${toId}'`);
        }
      });
    }
  }

  // 8. Animation (optional foundation D4)
  if (d.animation !== undefined) {
    const animRes = validateDiagramAnimation(d.animation, seenPlayerIds, seenBallIds);
    if (!animRes.ok) {
      errors.push(...animRes.errors);
    }
  }

  // 9. Representation (optional foundation REP-A)
  if (d.representation !== undefined) {
    if (!d.representation || typeof d.representation !== 'object') {
      errors.push('Diagram representation must be a non-null object');
    } else {
      const rep = d.representation as Record<string, unknown>;
      if (rep.mode !== 'full' && rep.mode !== 'representative-group') {
        errors.push(`Diagram representation mode must be 'full' or 'representative-group', got '${String(rep.mode)}'`);
      }
      if (typeof rep.totalGroups !== 'number' || !Number.isInteger(rep.totalGroups) || rep.totalGroups <= 0) {
        errors.push('Diagram representation totalGroups must be a positive integer');
      }
      if (typeof rep.playersPerGroup !== 'number' || !Number.isInteger(rep.playersPerGroup) || rep.playersPerGroup <= 0) {
        errors.push('Diagram representation playersPerGroup must be a positive integer');
      }
      if (typeof rep.representedGroups !== 'number' || !Number.isInteger(rep.representedGroups) || rep.representedGroups <= 0) {
        errors.push('Diagram representation representedGroups must be a positive integer');
      }
      if (rep.label !== undefined && typeof rep.label !== 'string') {
        errors.push('Diagram representation label must be a string');
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validates animation data according to TASK D4 rules:
 * - duration > 0
 * - steps array with non-empty id, start >= 0, duration > 0
 * - actions array with allowed types: playerMove, ballPass, ballDribble
 * - playerMove: playerId exists, target 'to' has 0-100 coordinates
 * - ballPass: ballId exists, fromPlayerId exists, toPlayerId exists
 * - ballDribble: ballId exists, playerId exists, target 'to' has 0-100 coordinates
 */
export function validateDiagramAnimation(
  animation: unknown,
  playersOrIds: DiagramPlayer[] | Set<string>,
  ballsOrIds: DiagramBall[] | Set<string>
): DiagramValidationResult {
  const errors: string[] = [];

  if (!animation || typeof animation !== 'object') {
    return { ok: false, errors: ['Animation must be a non-null object'] };
  }

  const anim = animation as Record<string, unknown>;

  if (typeof anim.duration !== 'number' || !Number.isFinite(anim.duration) || anim.duration <= 0) {
    errors.push('Animation duration must be a positive number');
  }

  if (!Array.isArray(anim.steps)) {
    errors.push('Animation steps must be an array');
    return { ok: false, errors };
  }

  const validPlayerIds: Set<string> =
    playersOrIds instanceof Set
      ? playersOrIds
      : new Set(playersOrIds.map((p) => p.id));

  const validBallIds: Set<string> =
    ballsOrIds instanceof Set
      ? ballsOrIds
      : new Set(ballsOrIds.map((b) => b.id));

  anim.steps.forEach((s, stepIdx) => {
    if (!s || typeof s !== 'object') {
      errors.push(`Animation step at index ${stepIdx} is invalid`);
      return;
    }
    const step = s as Record<string, unknown>;
    const stepId = typeof step.id === 'string' ? step.id : `step-${stepIdx}`;

    if (typeof step.start !== 'number' || !Number.isFinite(step.start) || step.start < 0) {
      errors.push(`Step '${stepId}' start must be a non-negative number`);
    }
    if (typeof step.duration !== 'number' || !Number.isFinite(step.duration) || step.duration <= 0) {
      errors.push(`Step '${stepId}' duration must be a positive number`);
    }

    if (!Array.isArray(step.actions)) {
      errors.push(`Step '${stepId}' actions must be an array`);
      return;
    }

    step.actions.forEach((a, actionIdx) => {
      if (!a || typeof a !== 'object') {
        errors.push(`Step '${stepId}' action at index ${actionIdx} is invalid`);
        return;
      }
      const action = a as Record<string, unknown>;
      const actionType = action.type;

      if (!VALID_ACTION_TYPES.has(String(actionType))) {
        errors.push(
          `Step '${stepId}' has unsupported action type '${actionType}'. Allowed: playerMove, ballPass, ballDribble`
        );
        return;
      }

      if (actionType === 'playerMove') {
        const playerId = typeof action.playerId === 'string' ? action.playerId : '';
        if (!playerId) {
          errors.push(`Step '${stepId}' playerMove missing playerId`);
        } else if (validPlayerIds.size > 0 && !validPlayerIds.has(playerId)) {
          errors.push(`Step '${stepId}' playerMove references non-existent playerId: '${playerId}'`);
        }
        const to = action.to as Record<string, unknown> | undefined;
        if (
          !to ||
          typeof to.x !== 'number' ||
          !Number.isFinite(to.x) ||
          to.x < 0 ||
          to.x > 100 ||
          typeof to.y !== 'number' ||
          !Number.isFinite(to.y) ||
          to.y < 0 ||
          to.y > 100
        ) {
          errors.push(`Step '${stepId}' playerMove target coordinates 'to' must be within bounds (0-100)`);
        }
      } else if (actionType === 'ballPass') {
        const ballId = typeof action.ballId === 'string' ? action.ballId : '';
        if (!ballId) {
          errors.push(`Step '${stepId}' ballPass missing ballId`);
        } else if (validBallIds.size > 0 && !validBallIds.has(ballId)) {
          errors.push(`Step '${stepId}' ballPass references non-existent ballId: '${ballId}'`);
        }
        const fromId = typeof action.fromPlayerId === 'string' ? action.fromPlayerId : '';
        if (!fromId) {
          errors.push(`Step '${stepId}' ballPass missing fromPlayerId`);
        } else if (validPlayerIds.size > 0 && !validPlayerIds.has(fromId)) {
          errors.push(`Step '${stepId}' ballPass references non-existent fromPlayerId: '${fromId}'`);
        }
        const toId = typeof action.toPlayerId === 'string' ? action.toPlayerId : '';
        if (!toId) {
          errors.push(`Step '${stepId}' ballPass missing toPlayerId`);
        } else if (validPlayerIds.size > 0 && !validPlayerIds.has(toId)) {
          errors.push(`Step '${stepId}' ballPass references non-existent toPlayerId: '${toId}'`);
        }
      } else if (actionType === 'ballDribble') {
        const ballId = typeof action.ballId === 'string' ? action.ballId : '';
        if (!ballId) {
          errors.push(`Step '${stepId}' ballDribble missing ballId`);
        } else if (validBallIds.size > 0 && !validBallIds.has(ballId)) {
          errors.push(`Step '${stepId}' ballDribble references non-existent ballId: '${ballId}'`);
        }
        const playerId = typeof action.playerId === 'string' ? action.playerId : '';
        if (!playerId) {
          errors.push(`Step '${stepId}' ballDribble missing playerId`);
        } else if (validPlayerIds.size > 0 && !validPlayerIds.has(playerId)) {
          errors.push(`Step '${stepId}' ballDribble references non-existent playerId: '${playerId}'`);
        }
        const to = action.to as Record<string, unknown> | undefined;
        if (
          !to ||
          typeof to.x !== 'number' ||
          !Number.isFinite(to.x) ||
          to.x < 0 ||
          to.x > 100 ||
          typeof to.y !== 'number' ||
          !Number.isFinite(to.y) ||
          to.y < 0 ||
          to.y > 100
        ) {
          errors.push(`Step '${stepId}' ballDribble target coordinates 'to' must be within bounds (0-100)`);
        }
      }
    });
  });

  // 3. Coaching Moments (TASK D5)
  if (anim.coachingMoments !== undefined) {
    if (!Array.isArray(anim.coachingMoments)) {
      errors.push('Animation coachingMoments must be an array');
    } else {
      const seenMomentIds = new Set<string>();
      anim.coachingMoments.forEach((cm, cmIdx) => {
        if (!cm || typeof cm !== 'object') {
          errors.push(`Coaching moment at index ${cmIdx} is invalid`);
          return;
        }
        const m = cm as Record<string, unknown>;
        const mId = typeof m.id === 'string' ? m.id.trim() : `coach-${cmIdx}`;
        if (!mId) {
          errors.push(`Coaching moment at index ${cmIdx} missing id`);
        } else if (seenMomentIds.has(mId)) {
          errors.push(`Duplicate coaching moment id: '${mId}'`);
        } else {
          seenMomentIds.add(mId);
        }

        if (typeof m.time !== 'number' || !Number.isFinite(m.time) || m.time < 0) {
          errors.push(`Coaching moment '${mId}' time must be a non-negative number`);
        }

        if (typeof m.duration !== 'number' || !Number.isFinite(m.duration) || m.duration <= 0) {
          errors.push(`Coaching moment '${mId}' duration must be a positive number`);
        } else if (
          typeof m.time === 'number' &&
          Number.isFinite(m.time) &&
          typeof anim.duration === 'number' &&
          Number.isFinite(anim.duration) &&
          m.time + m.duration > anim.duration
        ) {
          errors.push(
            `Coaching moment '${mId}' (time ${m.time} + duration ${m.duration}) exceeds animation duration (${anim.duration})`
          );
        }

        const pId = typeof m.playerId === 'string' ? m.playerId.trim() : '';
        if (!pId) {
          errors.push(`Coaching moment '${mId}' missing playerId`);
        } else if (validPlayerIds.size > 0 && !validPlayerIds.has(pId)) {
          errors.push(`Coaching moment '${mId}' references non-existent playerId: '${pId}'`);
        }

        if (m.focus !== undefined) {
          if (!m.focus || typeof m.focus !== 'object') {
            errors.push(`Coaching moment '${mId}' focus must be an object`);
          } else {
            const f = m.focus as Record<string, unknown>;
            if (f.zoom !== undefined && (typeof f.zoom !== 'number' || !Number.isFinite(f.zoom) || f.zoom < 1.0 || f.zoom > 3.0)) {
              errors.push(`Coaching moment '${mId}' zoom must be between 1.0 and 3.0`);
            }
          }
        }

        if (m.orientation !== undefined) {
          if (typeof m.orientation !== 'number' || !Number.isFinite(m.orientation) || m.orientation < 0 || m.orientation >= 360) {
            errors.push(`Coaching moment '${mId}' orientation must be between 0 and 359 degrees`);
          }
        }

        if (typeof m.title !== 'string') {
          errors.push(`Coaching moment '${mId}' title must be a string`);
        }
        if (typeof m.text !== 'string') {
          errors.push(`Coaching moment '${mId}' text must be a string`);
        }
      });
    }
  }

  // 4. Coaching Sequence (TASK D7A)
  if (anim.coachingSequence !== undefined) {
    if (!anim.coachingSequence || typeof anim.coachingSequence !== 'object') {
      errors.push('Animation coachingSequence must be a non-null object');
    } else {
      const seq = anim.coachingSequence as Record<string, unknown>;
      if (typeof seq.id !== 'string' || !seq.id.trim()) {
        errors.push('Coaching sequence missing non-empty id');
      }
      if (typeof seq.title !== 'string') {
        errors.push('Coaching sequence title must be a string');
      }
      if (!Array.isArray(seq.momentIds)) {
        errors.push('Coaching sequence momentIds must be an array of moment IDs');
      } else {
        const momentsMap = new Map<string, { time: number }>();
        if (Array.isArray(anim.coachingMoments)) {
          anim.coachingMoments.forEach((cm) => {
            if (cm && typeof cm === 'object') {
              const item = cm as Record<string, unknown>;
              if (typeof item.id === 'string' && item.id.trim()) {
                momentsMap.set(item.id.trim(), { time: Number(item.time) || 0 });
              }
            }
          });
        }
        const seenSeqIds = new Set<string>();
        let prevTime = -Infinity;
        seq.momentIds.forEach((mId, mIdx) => {
          if (typeof mId !== 'string' || !mId.trim()) {
            errors.push(`Coaching sequence momentIds[${mIdx}] must be a non-empty string`);
            return;
          }
          const cleanId = mId.trim();
          if (seenSeqIds.has(cleanId)) {
            errors.push(`Coaching sequence contains duplicate moment ID: '${cleanId}'`);
          } else {
            seenSeqIds.add(cleanId);
          }
          const momentData = momentsMap.get(cleanId);
          if (!momentData) {
            errors.push(`Coaching sequence references non-existent coaching moment ID: '${cleanId}'`);
          } else {
            if (momentData.time < prevTime) {
              errors.push(
                `Coaching sequence momentIds must be in chronological order ('${cleanId}' time ${momentData.time} is earlier than previous ${prevTime})`
              );
            }
            prevTime = momentData.time;
          }
        });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Normalizes an angle in degrees to the range [0, 359].
 */
export function normalizeOrientation(deg: unknown): number | undefined {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return undefined;
  return ((Math.round(deg) % 360) + 360) % 360;
}

export interface CameraViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
  viewBox: string;
}

/**
 * Standard cubic ease-in-out easing curve (deterministic S-curve).
 * Clamped strictly between 0 and 1.
 */
export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Interpolates smoothly between full pitch viewBox and zoomed target viewBox.
 */
export function interpolateViewBox(
  fromBox: { minX: number; minY: number; width: number; height: number },
  toBox: { minX: number; minY: number; width: number; height: number },
  factor: number
): CameraViewBox {
  const f = Math.max(0, Math.min(1, factor));
  const minX = fromBox.minX + (toBox.minX - fromBox.minX) * f;
  const minY = fromBox.minY + (toBox.minY - fromBox.minY) * f;
  const width = fromBox.width + (toBox.width - fromBox.width) * f;
  const height = fromBox.height + (toBox.height - fromBox.height) * f;
  const rMinX = Math.round(minX * 10) / 10;
  const rMinY = Math.round(minY * 10) / 10;
  const rW = Math.round(width * 10) / 10;
  const rH = Math.round(height * 10) / 10;
  return {
    minX: rMinX,
    minY: rMinY,
    width: rW,
    height: rH,
    viewBox: `${rMinX} ${rMinY} ${rW} ${rH}`,
  };
}

export type CoachingPresentationPhase = 'enter' | 'hold' | 'exit';

export interface CoachingPhaseState {
  phase: CoachingPresentationPhase;
  progress: number; // 0 to 1 over total presentation duration
  phaseProgress: number; // 0 to 1 within the specific phase
  cameraEase: number; // 0 (full pitch) to 1 (focused zoom)
  textOpacity: number; // 0 to 1
  highlightOpacity: number; // 0 to 1
  orientationProgress: number; // 0 to 1 (rotates during enter, holds after)
}

/**
 * Standard timing constants for coaching moment presentation (TASK FIX-A).
 */
export const MIN_COACHING_TOTAL_DURATION = 3.5;
export const MAX_COACHING_TOTAL_DURATION = 5.5;
export const COACHING_ENTER_DURATION = 0.7;
export const COACHING_EXIT_DURATION = 0.7;
export const MIN_COACHING_HOLD_DURATION = 2.0;

export interface CoachingPhaseTiming {
  enter: number;
  hold: number;
  exit: number;
  total: number;
}

/**
 * Pure helper that calculates enter, hold, and exit time allocations for a given presentation duration.
 * Ensures enter is ~0.7s, exit is ~0.7s, and hold is at least 2.0s for any effective duration >= 3.5s.
 */
export function getCoachingPhaseTiming(duration: number): CoachingPhaseTiming {
  const total = Math.max(0.1, duration);
  const enter = total >= 1.9 ? COACHING_ENTER_DURATION : Math.min(COACHING_ENTER_DURATION, Math.round(total * 0.25 * 100) / 100);
  const exit = total >= 1.9 ? COACHING_EXIT_DURATION : Math.min(COACHING_EXIT_DURATION, Math.round(total * 0.25 * 100) / 100);
  const hold = Math.max(0, Math.round((total - enter - exit) * 100) / 100);
  return { enter, hold, exit, total };
}

/**
 * Pure helper for calculating the effective coaching presentation duration (TASK FIX-A).
 * Ensures coaching points remain on screen long enough to be comfortably read,
 * scaling deterministically based on title/text length while respecting strict bounds.
 *
 * Rules:
 * - Minimum total duration: 3.5s (enter: 0.7s, hold: >= 2.0s, exit: 0.7s)
 * - Maximum total duration: 5.5s
 * - Short text (<= 45 chars): 3.5s total
 * - Medium text (46–75 chars): 4.0s total; (76–105 chars): 4.5s total
 * - Longer text (106–135 chars): 5.0s total; (> 135 chars): 5.5s total
 * - Does NOT mutate stored coachingMoment.duration
 */
export function getEffectiveCoachingDuration(
  momentOrText?: Partial<Pick<DiagramCoachingMoment, 'title' | 'text' | 'duration'>> | string | null
): number {
  if (!momentOrText) {
    return MIN_COACHING_TOTAL_DURATION;
  }

  let fullText = '';
  if (typeof momentOrText === 'string') {
    fullText = momentOrText.trim();
  } else if (typeof momentOrText === 'object') {
    const title = typeof momentOrText.title === 'string' ? momentOrText.title.trim() : '';
    const text = typeof momentOrText.text === 'string' ? momentOrText.text.trim() : '';
    fullText = [title, text].filter(Boolean).join(' ').trim();
  }

  const charCount = fullText.length;

  let duration: number;
  if (charCount > 135) {
    duration = 5.5;
  } else if (charCount > 105) {
    duration = 5.0;
  } else if (charCount > 75) {
    duration = 4.5;
  } else if (charCount > 45) {
    duration = 4.0;
  } else {
    duration = 3.5;
  }

  return Math.min(MAX_COACHING_TOTAL_DURATION, Math.max(MIN_COACHING_TOTAL_DURATION, duration));
}

export const calculateEffectiveCoachingDuration = getEffectiveCoachingDuration;

/**
 * Calculates current visual presentation phase and continuous easing factors for camera, text, and highlight.
 * Enter phase: ~0.7s camera ease-in and text reveal
 * Hold phase: camera locked, text & highlight at 100% readability (minimum 2.0s hold)
 * Exit phase: ~0.7s text fade-out and camera return to pitch view
 */
export function getCoachingPhaseState(
  elapsed: number,
  duration: number
): CoachingPhaseState {
  const safeDuration = Math.max(0.1, duration);
  const progress = Math.max(0, Math.min(1, elapsed / safeDuration));
  const timing = getCoachingPhaseTiming(safeDuration);

  const enterEnd = timing.enter;
  const holdEnd = timing.enter + timing.hold;

  if (elapsed < enterEnd) {
    const phaseProgress = timing.enter > 0 ? Math.min(1, elapsed / timing.enter) : 1;
    const cameraEase = easeInOutCubic(phaseProgress);
    const highlightOpacity = easeInOutCubic(Math.min(1, phaseProgress * 1.3));
    // Text fades/slides in slightly after camera begins moving (phaseProgress > 0.3)
    const textOpacity = phaseProgress > 0.3 ? easeInOutCubic((phaseProgress - 0.3) / 0.7) : 0;
    const orientationProgress = easeInOutCubic(phaseProgress);

    return {
      phase: 'enter',
      progress,
      phaseProgress,
      cameraEase,
      textOpacity,
      highlightOpacity,
      orientationProgress,
    };
  }

  if (elapsed <= holdEnd) {
    const phaseProgress = timing.hold > 0 ? Math.min(1, (elapsed - enterEnd) / timing.hold) : 1;
    return {
      phase: 'hold',
      progress,
      phaseProgress,
      cameraEase: 1,
      textOpacity: 1,
      highlightOpacity: 1,
      orientationProgress: 1,
    };
  }

  // Exit phase (holdEnd -> safeDuration)
  const exitElapsed = elapsed - holdEnd;
  const phaseProgress = timing.exit > 0 ? Math.min(1, exitElapsed / timing.exit) : 1;
  // Text fades out first during the first half of the exit phase
  const textOpacity = 1 - easeInOutCubic(Math.min(1, phaseProgress * 2));
  // Camera eases out back to full pitch
  const cameraEase = 1 - easeInOutCubic(phaseProgress);
  // Highlight ring fades out
  const highlightOpacity = 1 - easeInOutCubic(phaseProgress);
  // Retain final orientation consistent with D5
  const orientationProgress = 1;

  return {
    phase: 'exit',
    progress,
    phaseProgress,
    cameraEase,
    textOpacity,
    highlightOpacity,
    orientationProgress,
  };
}

/**
 * Calculates geometric orientation in degrees [0, 359] from receiver position toward intended next target.
 * Pitch coordinate system: 0° = right (+X), 90° = down (+Y), 180° = left (-X), 270° = up (-Y).
 */
export function calculateOrientationFromNextAction(
  fromPos: { x: number; y: number },
  nextTargetPos: { x: number; y: number }
): number {
  const dx = nextTargetPos.x - fromPos.x;
  const dy = nextTargetPos.y - fromPos.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return 45; // Default sensible fallback
  }
  const rad = Math.atan2(dy, dx);
  const deg = (rad * 180) / Math.PI;
  return ((Math.round(deg) % 360) + 360) % 360;
}

/**
 * Resolves overlapping coaching moments:
 * - Keeps chronological order
 * - Keeps earlier moment and skips any conflicting overlapping moments
 * - Enforces minimum spacing between coaching moments
 */
export function resolveCoachingMomentOverlaps(
  moments: DiagramCoachingMoment[],
  minSpacingSeconds = 1.0
): DiagramCoachingMoment[] {
  if (!Array.isArray(moments) || moments.length <= 1) return moments || [];
  const sorted = [...moments].sort((a, b) => a.time - b.time);
  const resolved: DiagramCoachingMoment[] = [];
  let lastMomentEndTime = -Infinity;

  for (const m of sorted) {
    if (m.time >= lastMomentEndTime + minSpacingSeconds) {
      resolved.push(m);
      lastMomentEndTime = m.time;
    }
  }
  return resolved;
}

/**
 * Clamps long coaching overlay text for display safety without mutating original data.
 */
export function formatCoachingOverlayText(text: string, maxChars = 140): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars - 3);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.65 ? cut.slice(0, lastSpace) : cut) + '...';
}

/**
 * Calculates SVG camera viewBox coordinates for focusing on a player during coaching moments.
 * Always clamps within the 1000x600 pitch boundaries.
 */
export function calculateCameraViewBox(
  targetX: number,
  targetY: number,
  zoom = 1.8,
  pitchWidth = 1000,
  pitchHeight = 600
): CameraViewBox {
  const safeZoom = Math.max(1.0, Math.min(3.0, typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 1.8));
  const w = pitchWidth / safeZoom;
  const h = pitchHeight / safeZoom;

  const minX = Math.max(0, Math.min(pitchWidth - w, targetX - w / 2));
  const minY = Math.max(0, Math.min(pitchHeight - h, targetY - h / 2));

  return {
    minX: Math.round(minX * 10) / 10,
    minY: Math.round(minY * 10) / 10,
    width: Math.round(w * 10) / 10,
    height: Math.round(h * 10) / 10,
    viewBox: `${Math.round(minX)} ${Math.round(minY)} ${Math.round(w)} ${Math.round(h)}`,
  };
}

/**
 * Filters and sanitizes coaching moments to ensure invalid ones are ignored safely.
 */
export function filterValidCoachingMoments(
  moments: unknown,
  validPlayerIds: Set<string>,
  animationDuration: number
): DiagramCoachingMoment[] {
  if (!Array.isArray(moments)) return [];
  const valid: DiagramCoachingMoment[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < moments.length; idx++) {
    const cm = moments[idx];
    if (!cm || typeof cm !== 'object') continue;
    const m = cm as Record<string, unknown>;
    const id = typeof m.id === 'string' && m.id.trim() ? m.id.trim() : `coach-${idx + 1}`;
    if (seenIds.has(id)) continue;

    if (typeof m.time !== 'number' || !Number.isFinite(m.time) || m.time < 0) continue;
    if (typeof m.duration !== 'number' || !Number.isFinite(m.duration) || m.duration <= 0) continue;
    if (m.time + m.duration > animationDuration) continue;
    const time = m.time;
    const duration = m.duration;

    const playerId = typeof m.playerId === 'string' ? m.playerId.trim() : '';
    if (!playerId || !validPlayerIds.has(playerId)) continue;

    if (typeof m.title !== 'string' || typeof m.text !== 'string') continue;
    const title = m.title.trim();
    const text = m.text.trim();

    let zoom = 1.8;
    if (m.focus && typeof m.focus === 'object') {
      const z = (m.focus as Record<string, unknown>).zoom;
      if (typeof z === 'number' && Number.isFinite(z)) {
        if (z < 1.0 || z > 3.0) continue; // Out of range zoom
        zoom = z;
      }
    }

    if (m.orientation !== undefined && (typeof m.orientation !== 'number' || !Number.isFinite(m.orientation) || m.orientation < 0 || m.orientation >= 360)) {
      continue; // Out of range orientation
    }
    const orientation = m.orientation !== undefined ? Math.round(m.orientation) : undefined;
    const highlight = m.highlight !== undefined ? Boolean(m.highlight) : true;

    const VALID_SEMANTIC_EVENTS = new Set<string>([
      'preReceive',
      'receive',
      'firstTouch',
      'moveAfterReceive',
      'pass',
      'dribble',
      'supportMove',
    ]);
    const event = typeof m.event === 'string' && VALID_SEMANTIC_EVENTS.has(m.event.trim())
      ? (m.event.trim() as SemanticCoachingEvent)
      : undefined;

    seenIds.add(id);
    valid.push({
      id,
      time,
      duration,
      playerId,
      title,
      text,
      event,
      focus: { zoom },
      highlight,
      orientation,
    });
  }

  return valid;
}

export interface ClassifiedSemanticEvent {
  event: SemanticCoachingEvent;
  playerId: string;
  time: number;
  duration?: number;
  stepId: string;
  actionIndex: number;
  receiverId?: string;
  passerId?: string;
  targetCoord?: DiagramCoordinate;
  description?: string;
}

/**
 * Pure helper that classifies useful semantic events from animation steps,
 * ballPass, playerMove, ballDribble, receiver identity, and next actions.
 */
export function classifySemanticEvents(
  animation: DiagramAnimation,
  diagram?: Pick<StructuredDrillDiagram, 'players' | 'paths'>
): ClassifiedSemanticEvent[] {
  const events: ClassifiedSemanticEvent[] = [];
  const steps = Array.isArray(animation?.steps) ? animation.steps : [];
  if (steps.length === 0) return events;

  const passArrivals: Array<{
    passerId: string;
    receiverId: string;
    ballId: string;
    stepStart: number;
    stepDuration: number;
    arrivalSec: number;
    stepId: string;
  }> = [];

  steps.forEach((step, sIdx) => {
    const actions = Array.isArray(step.actions) ? step.actions : [];
    actions.forEach((act, aIdx) => {
      if (act.type === 'ballPass') {
        const arrivalSec = Math.round((step.start + step.duration) * 10) / 10;
        passArrivals.push({
          passerId: act.fromPlayerId,
          receiverId: act.toPlayerId,
          ballId: act.ballId,
          stepStart: step.start,
          stepDuration: step.duration,
          arrivalSec,
          stepId: step.id || `step-${sIdx + 1}`,
        });

        // 1. Passer executes 'pass' event
        events.push({
          event: 'pass',
          playerId: act.fromPlayerId,
          time: step.start,
          duration: step.duration,
          stepId: step.id || `step-${sIdx + 1}`,
          actionIndex: aIdx,
          passerId: act.fromPlayerId,
          receiverId: act.toPlayerId,
          description: `Chuyền bóng cho ${act.toPlayerId}`,
        });

        // 2. Receiver preReceive event (~75% into pass travel)
        const preReceiveTime = Math.max(
          step.start,
          Math.round((step.start + step.duration * 0.75) * 10) / 10
        );
        events.push({
          event: 'preReceive',
          playerId: act.toPlayerId,
          time: preReceiveTime,
          duration: Math.max(0.3, Math.round((arrivalSec - preReceiveTime) * 10) / 10),
          stepId: step.id || `step-${sIdx + 1}`,
          actionIndex: aIdx,
          passerId: act.fromPlayerId,
          receiverId: act.toPlayerId,
          description: `Quan sát và kiểm tra vai trước khi đón bóng từ ${act.fromPlayerId}`,
        });

        // 3. Receiver receive event at arrival
        events.push({
          event: 'receive',
          playerId: act.toPlayerId,
          time: arrivalSec,
          duration: 0.5,
          stepId: step.id || `step-${sIdx + 1}`,
          actionIndex: aIdx,
          passerId: act.fromPlayerId,
          receiverId: act.toPlayerId,
          description: `Đón bóng bằng tư thế mở thân người`,
        });
      }
    });
  });

  steps.forEach((step, sIdx) => {
    const actions = Array.isArray(step.actions) ? step.actions : [];
    actions.forEach((act, aIdx) => {
      if (act.type === 'ballDribble') {
        const priorPass = passArrivals.find(
          (p) => p.receiverId === act.playerId && Math.abs(p.arrivalSec - step.start) <= 1.0
        );
        if (priorPass) {
          events.push({
            event: 'firstTouch',
            playerId: act.playerId,
            time: step.start,
            duration: Math.min(0.8, step.duration),
            stepId: step.id || `step-${sIdx + 1}`,
            actionIndex: aIdx,
            targetCoord: act.to,
            description: `Chạm bước một định hướng`,
          });
          if (step.duration > 1.0) {
            events.push({
              event: 'dribble',
              playerId: act.playerId,
              time: Math.round((step.start + 0.8) * 10) / 10,
              duration: step.duration - 0.8,
              stepId: step.id || `step-${sIdx + 1}`,
              actionIndex: aIdx,
              targetCoord: act.to,
              description: `Dẫn bóng về phía trước`,
            });
          }
        } else {
          events.push({
            event: 'dribble',
            playerId: act.playerId,
            time: step.start,
            duration: step.duration,
            stepId: step.id || `step-${sIdx + 1}`,
            actionIndex: aIdx,
            targetCoord: act.to,
            description: `Dẫn bóng`,
          });
        }
      } else if (act.type === 'playerMove') {
        const priorPass = passArrivals.find(
          (p) => p.receiverId === act.playerId && step.start >= p.arrivalSec - 0.2
        );
        if (priorPass) {
          events.push({
            event: 'moveAfterReceive',
            playerId: act.playerId,
            time: step.start,
            duration: step.duration,
            stepId: step.id || `step-${sIdx + 1}`,
            actionIndex: aIdx,
            targetCoord: act.to,
            description: `Di chuyển sau khi nhận bóng`,
          });
        } else {
          events.push({
            event: 'supportMove',
            playerId: act.playerId,
            time: step.start,
            duration: step.duration,
            stepId: step.id || `step-${sIdx + 1}`,
            actionIndex: aIdx,
            targetCoord: act.to,
            description: `Di chuyển hỗ trợ cự ly và tạo góc chuyền`,
          });
        }
      }
    });
  });

  return events.sort((a, b) => a.time - b.time);
}

export interface PrioritizeMomentsOptions {
  objective?: string;
  minSpacing?: number; // Target: ~0.8–1.2 seconds, default 0.8
  maxMoments?: number; // Maximum 4, default 4
  preferredCount?: number; // Preferred: 2–3
}

/**
 * Calculates domain priority score for a coaching moment candidate.
 */
export function calculateMomentPriority(
  moment: DiagramCoachingMoment,
  objective?: string
): number {
  const obj = (objective || '').toLowerCase();
  let score = 40;

  switch (moment.event) {
    case 'preReceive':
      score = 85;
      break;
    case 'receive':
      score = 80;
      break;
    case 'firstTouch':
      score = 75;
      break;
    case 'moveAfterReceive':
      score = 65;
      break;
    case 'supportMove':
      score = 55;
      break;
    case 'dribble':
      score = 50;
      break;
    case 'pass':
      score = 50;
      break;
    default:
      score = 45;
  }

  const isReceivingTopic = /nhận bóng|mở thân|quan sát|kiểm tra vai|bước một|half-turn|scan/i.test(obj);
  const isPassingTopic = /chuyền bóng|phối hợp|người thứ 3|pass/i.test(obj);
  const isDribbleTopic = /1v1|rê bóng|qua người|dẫn bóng/i.test(obj);
  const isPressingTopic = /pressing|áp sát|đoạt bóng/i.test(obj);

  if (isReceivingTopic) {
    if (moment.event === 'preReceive') score += 50;
    else if (moment.event === 'receive') score += 45;
    else if (moment.event === 'firstTouch') score += 40;
    else if (moment.event === 'moveAfterReceive') score += 20;
  } else if (isPassingTopic) {
    if (moment.event === 'pass') score += 50;
    else if (moment.event === 'supportMove') score += 40;
    else if (moment.event === 'receive') score += 30;
  } else if (isDribbleTopic) {
    if (moment.event === 'dribble') score += 50;
    else if (moment.event === 'firstTouch') score += 40;
  } else if (isPressingTopic) {
    if (moment.event === 'supportMove') score += 40;
  }

  const textContent = `${moment.title} ${moment.text}`.toLowerCase();
  if (/kiểm tra vai|scan/i.test(textContent) && /quan sát|kiểm tra vai|scan/i.test(obj)) {
    score += 15;
  }
  if (/mở thân/i.test(textContent) && /mở/i.test(obj)) {
    score += 15;
  }
  if (/bước một|định hướng/i.test(textContent) && /bước một|định hướng/i.test(obj)) {
    score += 15;
  }

  return score;
}

/**
 * Pure helper that selects the strongest coaching moments based on priority,
 * session objective relevance, deduplication, and minimum spacing.
 * Rules:
 * - Preferred: 2–3 moments
 * - Maximum: 4 moments
 * - Spacing: target ~0.8–1.2 seconds between moments
 * - If moments are too close: keep the higher-priority one
 */
export function prioritizeCoachingMoments(
  candidates: DiagramCoachingMoment[],
  options?: PrioritizeMomentsOptions
): DiagramCoachingMoment[] {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const minSpacing = typeof options?.minSpacing === 'number' && options.minSpacing > 0 ? options.minSpacing : 0.8;
  const maxMoments = typeof options?.maxMoments === 'number' && options.maxMoments > 0 ? options.maxMoments : 4;
  const objective = options?.objective;

  // 1. Calculate priority score for each candidate
  const scored = candidates.map((m, idx) => ({
    moment: m,
    score: calculateMomentPriority(m, objective),
    index: idx,
  }));

  // 2. Sort candidates by score descending, then earlier time
  scored.sort((a, b) => b.score - a.score || a.moment.time - b.moment.time);

  // 3. Greedily select moments enforcing minimum spacing and deduplicating ideas & timestamps
  const selected: typeof scored = [];
  const seenEventsPerPlayer = new Set<string>();

  for (const item of scored) {
    const m = item.moment;

    // Avoid duplicate ideas on the same player
    const eventKey = `${m.playerId}-${m.event || m.title}`;
    if (m.event && seenEventsPerPlayer.has(eventKey)) {
      continue;
    }

    // Check minimum spacing against already accepted higher-priority moments
    const hasConflict = selected.some(
      (accepted) => Math.abs(accepted.moment.time - m.time) < minSpacing
    );

    if (!hasConflict) {
      selected.push(item);
      if (m.event) seenEventsPerPlayer.add(eventKey);
      if (selected.length >= maxMoments) break;
    }
  }

  // 4. Sort selected moments strictly chronologically
  selected.sort((a, b) => a.moment.time - b.moment.time);

  return selected.map((s) => s.moment);
}

/**
 * Sanitizes and validates a coachingSequence reference list.
 * Rules:
 * - momentIds must reference valid coachingMoment IDs
 * - be chronological
 * - contain no duplicates
 * - ignore invalid references safely
 */
export function sanitizeCoachingSequence(
  sequence: unknown,
  validMoments: DiagramCoachingMoment[]
): DiagramCoachingSequence | undefined {
  if (!sequence || typeof sequence !== 'object') return undefined;
  const seq = sequence as Record<string, unknown>;
  const id = typeof seq.id === 'string' && seq.id.trim() ? seq.id.trim() : 'sequence1';
  const title = typeof seq.title === 'string' && seq.title.trim() ? seq.title.trim() : 'Coaching Sequence';

  if (!Array.isArray(seq.momentIds)) return undefined;

  const momentMap = new Map<string, DiagramCoachingMoment>();
  (validMoments || []).forEach((m) => {
    if (m && m.id) momentMap.set(m.id, m);
  });

  const validIds: string[] = [];
  const seenIds = new Set<string>();

  for (const rawId of seq.momentIds) {
    if (typeof rawId !== 'string') continue;
    const cleanId = rawId.trim();
    if (!cleanId || seenIds.has(cleanId) || !momentMap.has(cleanId)) {
      // Ignore invalid references and duplicates safely
      continue;
    }
    seenIds.add(cleanId);
    validIds.push(cleanId);
  }

  if (validIds.length === 0) return undefined;

  // Enforce chronological sequence ordering
  validIds.sort((a, b) => {
    const timeA = momentMap.get(a)?.time ?? 0;
    const timeB = momentMap.get(b)?.time ?? 0;
    return timeA - timeB;
  });

  return {
    id,
    title,
    momentIds: validIds,
  };
}

/**
 * Builds a valid DiagramCoachingSequence from a set of coaching moments.
 */
export function buildCoachingSequence(
  moments: DiagramCoachingMoment[],
  title = 'Coaching Sequence',
  id = 'sequence1'
): DiagramCoachingSequence | undefined {
  if (!Array.isArray(moments) || moments.length === 0) return undefined;
  const sorted = [...moments].sort((a, b) => a.time - b.time);
  return {
    id,
    title,
    momentIds: sorted.map((m) => m.id),
  };
}

export interface CoachingSequenceProgress {
  current: number; // 1-based index (e.g. 1, 2, 3), or 0 if none
  total: number; // Total valid sequence moments
  isSequence: boolean; // True if total >= 2 and current > 0
  activeMomentId?: string;
  momentIds: string[]; // Valid, unique, chronological moment IDs in sequence
}

/**
 * Pure helper to determine current sequence index and total valid sequence moments.
 * Safely filters out missing/invalid/duplicate IDs and orders chronologically.
 * If fewer than 2 valid moments remain, isSequence is false (indicator is hidden).
 */
export function getCoachingSequenceProgress(
  activeMomentId?: string | null,
  sequence?: DiagramCoachingSequence | null,
  moments?: DiagramCoachingMoment[] | null
): CoachingSequenceProgress {
  if (!sequence || !Array.isArray(sequence.momentIds) || sequence.momentIds.length === 0) {
    return {
      current: 0,
      total: 0,
      isSequence: false,
      momentIds: [],
    };
  }

  const hasMoments = Array.isArray(moments) && moments.length > 0;
  const momentMap = new Map<string, DiagramCoachingMoment>();
  if (hasMoments) {
    moments!.forEach((m) => {
      if (m && typeof m.id === 'string' && m.id.trim()) {
        momentMap.set(m.id.trim(), m);
      }
    });
  }

  const validIds: string[] = [];
  const seenIds = new Set<string>();

  for (const rawId of sequence.momentIds) {
    if (typeof rawId !== 'string') continue;
    const cleanId = rawId.trim();
    if (!cleanId || seenIds.has(cleanId)) {
      continue;
    }
    if (hasMoments && !momentMap.has(cleanId)) {
      // Safely ignore references to non-existent coaching moments
      continue;
    }
    seenIds.add(cleanId);
    validIds.push(cleanId);
  }

  // Ensure chronological order if moment time is available
  if (hasMoments) {
    validIds.sort((a, b) => {
      const timeA = momentMap.get(a)?.time ?? 0;
      const timeB = momentMap.get(b)?.time ?? 0;
      return timeA - timeB;
    });
  }

  const total = validIds.length;
  const cleanActiveId = typeof activeMomentId === 'string' ? activeMomentId.trim() : undefined;
  const idx = cleanActiveId ? validIds.indexOf(cleanActiveId) : -1;
  const current = idx >= 0 ? idx + 1 : 0;

  return {
    current,
    total,
    isSequence: total >= 2 && current > 0,
    activeMomentId: cleanActiveId,
    momentIds: validIds,
  };
}

/**
 * Pure helper to determine current sequence index and total valid sequence moments.
 * Supports flexible parameter signatures:
 *   getCoachingSequencePosition(activeMomentId, sequence, moments)
 *   getCoachingSequencePosition(sequence, activeMomentId, moments)
 */
export function getCoachingSequencePosition(
  arg1?: string | DiagramCoachingSequence | null,
  arg2?: string | DiagramCoachingSequence | null,
  moments?: DiagramCoachingMoment[] | null
): CoachingSequenceProgress {
  let activeMomentId: string | undefined;
  let sequence: DiagramCoachingSequence | undefined;

  if (typeof arg1 === 'string') {
    activeMomentId = arg1;
    if (typeof arg2 === 'object' && arg2 !== null) {
      sequence = arg2 as DiagramCoachingSequence;
    }
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    sequence = arg1 as DiagramCoachingSequence;
    if (typeof arg2 === 'string') {
      activeMomentId = arg2;
    }
  } else if (typeof arg2 === 'string') {
    activeMomentId = arg2;
  }

  return getCoachingSequenceProgress(activeMomentId, sequence, moments);
}

/**
 * Pure helper to update triggered moments state during manual scrub.
 * Forward seek marks historical moments as triggered so they don't pop up suddenly.
 * Backward seek restores eligibility for moments after newTime so they can trigger again naturally.
 */
export function updateSeekTriggerState(
  newTime: number,
  moments: DiagramCoachingMoment[],
  triggeredIds: Set<string>
): Set<string> {
  const nextSet = new Set(triggeredIds);
  (moments || []).forEach((m) => {
    if (m.time >= newTime) {
      nextSet.delete(m.id);
    } else {
      nextSet.add(m.id);
    }
  });
  return nextSet;
}

/**
 * Pure helper to check if a coaching moment should trigger during playback tick.
 */
export function shouldTriggerCoachingMoment(
  moment: DiagramCoachingMoment,
  prevTime: number,
  nextTime: number,
  triggeredIds: Set<string>
): boolean {
  if (!moment || typeof moment.time !== 'number') return false;
  if (triggeredIds.has(moment.id)) return false;
  return moment.time >= prevTime - 0.05 && moment.time <= nextTime + 0.05;
}

/**
 * Reconstructs the deterministic orientation for a player at a given animation time.
 * - If no coaching moments for this player before currentTime: returns player's base orientation.
 * - If an active coaching moment is currently focusing this player:
 *   smoothly rotates from the player's previous orientation (prior to this moment) to target angle.
 * - If between coaching moments or during normal playback / scrubbing:
 *   retains the latest completed coaching moment's orientation for this player.
 * - Avoids snapping back to default between consecutive moments on the same player.
 */
export function reconstructPlayerOrientation(
  playerId: string,
  currentTime: number,
  baseOrientation?: number,
  coachingMoments?: DiagramCoachingMoment[],
  activeMoment?: DiagramCoachingMoment | null,
  orientationProgress?: number
): number | undefined {
  if (!coachingMoments || !Array.isArray(coachingMoments) || coachingMoments.length === 0) {
    return baseOrientation;
  }

  // Filter moments for this player that specify orientation, sorted chronologically
  const playerMoments = coachingMoments
    .filter((m) => m && m.playerId === playerId && typeof m.orientation === 'number' && Number.isFinite(m.orientation))
    .sort((a, b) => a.time - b.time);

  if (playerMoments.length === 0) {
    return baseOrientation;
  }

  // 1. If player is the active coaching moment focus
  if (activeMoment && activeMoment.playerId === playerId && typeof activeMoment.orientation === 'number') {
    // Find the latest moment for this player strictly prior to this active moment's trigger time
    const prevMoments = playerMoments.filter(
      (m) => m.id !== activeMoment.id && m.time < activeMoment.time
    );
    const prevMoment = prevMoments.length > 0 ? prevMoments[prevMoments.length - 1] : undefined;
    const startAngle = prevMoment?.orientation ?? baseOrientation ?? 0;
    const targetAngle = activeMoment.orientation;
    const progress = typeof orientationProgress === 'number'
      ? Math.max(0, Math.min(1, orientationProgress))
      : 1;
    return Math.round(startAngle + (targetAngle - startAngle) * progress);
  }

  // 2. Normal playback / post-moment / seek:
  // Find the latest completed moment for this player whose time <= currentTime
  const completedMoments = playerMoments.filter((m) => m.time <= currentTime);
  if (completedMoments.length === 0) {
    return baseOrientation;
  }

  return completedMoments[completedMoments.length - 1].orientation;
}

export interface TimelineMarker {
  id: string;
  time: number;
  pct: number; // 0 to 100
  title: string;
  state: 'future' | 'active' | 'completed';
}

/**
 * Pure helper to compute chronological, unique timeline markers for coaching moments.
 * If coachingSequence is absent, returns [] (preserving D6/D7B compatibility).
 * If coachingSequence is present, maps valid sequence moments to timeline percentage.
 */
export function getSequenceTimelineMarkers(
  animation?: DiagramAnimation | null,
  currentTime: number = 0,
  activeMomentId?: string | null,
  triggeredIds?: Set<string>
): TimelineMarker[] {
  if (!animation || typeof animation.duration !== 'number' || animation.duration <= 0) {
    return [];
  }

  // D7B compatibility: if coachingSequence is absent, do not render markers
  if (!animation.coachingSequence || !Array.isArray(animation.coachingSequence.momentIds)) {
    return [];
  }

  const moments = Array.isArray(animation.coachingMoments) ? animation.coachingMoments : [];
  const momentMap = new Map<string, DiagramCoachingMoment>();
  moments.forEach((m) => {
    if (m && typeof m.id === 'string' && m.id.trim()) {
      momentMap.set(m.id.trim(), m);
    }
  });

  const validMoments: DiagramCoachingMoment[] = [];
  const seenIds = new Set<string>();

  for (const rawId of animation.coachingSequence.momentIds) {
    if (typeof rawId !== 'string') continue;
    const cleanId = rawId.trim();
    if (!cleanId || seenIds.has(cleanId)) continue;
    const found = momentMap.get(cleanId);
    if (!found) continue;
    seenIds.add(cleanId);
    validMoments.push(found);
  }

  if (validMoments.length === 0) {
    return [];
  }

  // Sort chronologically
  validMoments.sort((a, b) => a.time - b.time);

  const duration = animation.duration;
  return validMoments.map((m) => {
    const rawPct = (m.time / duration) * 100;
    const pct = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));

    let state: 'future' | 'active' | 'completed' = 'future';
    if (activeMomentId && activeMomentId === m.id) {
      state = 'active';
    } else if (triggeredIds?.has(m.id) || (!activeMomentId && currentTime > m.time + 0.05)) {
      state = 'completed';
    }

    return {
      id: m.id,
      time: m.time,
      pct,
      title: m.title,
      state,
    };
  });
}

/**
 * Builds semantically grounded coaching moments for an animation sequence.
 * Targets the receiving player immediately before or at reception.
 */
export function buildSemanticCoachingMoments(
  diagram: StructuredDrillDiagram,
  execution?: string | string[],
  coachingPoints?: string[]
): DiagramCoachingMoment[] {
  const candidates: DiagramCoachingMoment[] = [];
  const anim = diagram.animation;
  const steps = anim && Array.isArray(anim.steps) ? anim.steps : [];
  const animDuration = anim && typeof anim.duration === 'number' && anim.duration > 0 ? anim.duration : 8;
  const textContext = [
    ...(Array.isArray(coachingPoints) ? coachingPoints : []),
    ...(Array.isArray(execution) ? execution : [execution || '']),
  ].join(' ').toLowerCase();

  const playerMap = new Map<string, DiagramPlayer>();
  (diagram.players || []).forEach((p) => {
    if (p && p.id) playerMap.set(p.id, p);
  });

  const isReceivingOpenBody = /nhận bóng|mở thân|quan sát|kiểm tra vai|half-turn/i.test(textContext);

  // Find pass actions to place coaching moments on receiver
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];
    const passAction = step.actions.find((a) => a.type === 'ballPass') as BallPassAction | undefined;
    if (passAction && passAction.toPlayerId) {
      const receivingPlayerId = passAction.toPlayerId;
      const receiverPlayer = playerMap.get(receivingPlayerId);
      const receiverPos = receiverPlayer ? { x: receiverPlayer.x, y: receiverPlayer.y } : { x: 50, y: 30 };

      // Trigger preReceive ~75% through the pass travel (shortly before ball reaches receiver)
      const targetTrigger = Math.round((step.start + step.duration * 0.75) * 10) / 10;
      const maxMomentDuration = Math.max(0.5, Math.round((animDuration - targetTrigger) * 10) / 10);
      const momentDuration = Math.min(2.0, maxMomentDuration);

      // Derive orientation from receiver's subsequent action target (TASK D6)
      let nextTargetPos: { x: number; y: number } | null = null;

      // 1. Look in subsequent animation steps for receiver's next action
      for (let sIdx = stepIdx + 1; sIdx < steps.length; sIdx++) {
        const nextStep = steps[sIdx];
        if (Array.isArray(nextStep.actions)) {
          const moveAct = nextStep.actions.find(
            (a) => a.type === 'playerMove' && (a as PlayerMoveAction).playerId === receivingPlayerId
          ) as PlayerMoveAction | undefined;
          if (moveAct && moveAct.to) {
            nextTargetPos = { x: moveAct.to.x, y: moveAct.to.y };
            break;
          }
          const dribbleAct = nextStep.actions.find(
            (a) => a.type === 'ballDribble' && (a as BallDribbleAction).playerId === receivingPlayerId
          ) as BallDribbleAction | undefined;
          if (dribbleAct && dribbleAct.to) {
            nextTargetPos = { x: dribbleAct.to.x, y: dribbleAct.to.y };
            break;
          }
          const nextPassAct = nextStep.actions.find(
            (a) => a.type === 'ballPass' && (a as BallPassAction).fromPlayerId === receivingPlayerId
          ) as BallPassAction | undefined;
          if (nextPassAct && nextPassAct.toPlayerId) {
            const nextReceiver = playerMap.get(nextPassAct.toPlayerId);
            if (nextReceiver) {
              nextTargetPos = { x: nextReceiver.x, y: nextReceiver.y };
              break;
            }
          }
        }
      }

      // 2. If no subsequent step found, look in diagram.paths for receiver's next path
      if (!nextTargetPos && Array.isArray(diagram.paths)) {
        const nextPath = diagram.paths.find((p) => p.fromPlayerId === receivingPlayerId);
        if (nextPath && nextPath.toPlayerId) {
          const nextTarget = playerMap.get(nextPath.toPlayerId);
          if (nextTarget) {
            nextTargetPos = { x: nextTarget.x, y: nextTarget.y };
          }
        }
      }

      // 3. Compute geometric orientation toward next target or fallback (45°)
      let orientation = 45;
      if (nextTargetPos) {
        orientation = calculateOrientationFromNextAction(receiverPos, nextTargetPos);
      }

      if (isReceivingOpenBody) {
        // Moment 1: preReceive (Kiểm tra vai)
        if (targetTrigger + 0.5 <= animDuration) {
          candidates.push({
            id: 'coach1',
            time: targetTrigger,
            duration: Math.min(1.0, momentDuration),
            playerId: receivingPlayerId,
            event: 'preReceive',
            title: 'Kiểm tra vai',
            text: 'Quan sát phía sau trước khi nhận để biết hướng chơi tiếp.',
            focus: { zoom: 1.8 },
            highlight: true,
            orientation: 45,
          });
        }

        // Moment 2: receive (Mở thân người) ~1.0s after preReceive
        const receiveTime = Math.round((targetTrigger + 1.0) * 10) / 10;
        if (receiveTime + 0.5 <= animDuration) {
          candidates.push({
            id: 'coach2',
            time: receiveTime,
            duration: Math.min(1.0, Math.max(0.5, Math.round((animDuration - receiveTime) * 10) / 10)),
            playerId: receivingPlayerId,
            event: 'receive',
            title: 'Mở thân người',
            text: 'Nhận ở góc mở để nhìn thấy bóng và hướng tấn công cùng lúc.',
            focus: { zoom: 1.8 },
            highlight: true,
            orientation,
          });
        }

        // Moment 3: firstTouch (Chạm bước một) ~1.0s after receive (if animation duration supports it)
        const touchTime = Math.round((targetTrigger + 2.0) * 10) / 10;
        if (touchTime + 0.5 <= animDuration) {
          candidates.push({
            id: 'coach3',
            time: touchTime,
            duration: Math.min(1.0, Math.max(0.5, Math.round((animDuration - touchTime) * 10) / 10)),
            playerId: receivingPlayerId,
            event: 'firstTouch',
            title: 'Chạm bước một',
            text: 'Đưa bóng vào khoảng trống giúp hành động tiếp theo nhanh hơn.',
            focus: { zoom: 1.8 },
            highlight: true,
            orientation,
          });
        }
      } else {
        // Standard single / double moments for other topics
        let title = 'Mở thân người';
        let text = 'Kiểm tra vai trước khi nhận và mở thân người về hướng tấn công.';

        if (/bước một|định hướng|không gian trống/i.test(textContext)) {
          title = 'Chạm bước một định hướng';
          text = 'Mở góc đón bóng bằng chân xa, định hướng bóng về không gian trống phía trước.';
        } else if (/quan sát|kiểm tra vai|scan/i.test(textContext)) {
          title = 'Kiểm tra vai & Mở thân';
          text = 'Quay đầu kiểm tra vai trước khi nhận bóng để chọn hướng mở thân người thuận lợi.';
        }

        if (targetTrigger + momentDuration <= animDuration) {
          candidates.push({
            id: `coach${candidates.length + 1}`,
            time: targetTrigger,
            duration: momentDuration,
            playerId: receivingPlayerId,
            event: 'preReceive',
            title,
            text,
            focus: { zoom: 1.8 },
            highlight: true,
            orientation,
          });
        }
      }

      if (candidates.length >= 3) break;
    }
  }

  // Fallback demo coaching moment if no ballPass found but players exist
  if (candidates.length === 0 && Array.isArray(diagram.players) && diagram.players.length >= 2) {
    const p1 = diagram.players[0];
    const p2 = diagram.players[1];
    const momentDuration = Math.min(2.0, Math.max(0.5, Math.round(animDuration * 0.35 * 10) / 10));
    const triggerTime = Math.min(1.0, Math.max(0, Math.round((animDuration - momentDuration) * 10) / 10));
    const orientation = calculateOrientationFromNextAction(p2, { x: Math.min(90, p2.x + 20), y: p2.y });

    candidates.push({
      id: 'coach1',
      time: triggerTime,
      duration: momentDuration,
      playerId: p2.id,
      event: 'preReceive',
      title: 'Kiểm tra vai',
      text: 'Quan sát phía sau trước khi nhận để biết hướng chơi tiếp.',
      focus: { zoom: 1.8 },
      highlight: true,
      orientation,
    });

    const secondTime = Math.round((triggerTime + 1.0) * 10) / 10;
    if (secondTime + 0.5 <= animDuration) {
      candidates.push({
        id: 'coach2',
        time: secondTime,
        duration: Math.min(1.0, Math.round((animDuration - secondTime) * 10) / 10),
        playerId: p2.id,
        event: 'receive',
        title: 'Mở thân người',
        text: 'Nhận ở góc mở để nhìn thấy bóng và hướng tấn công cùng lúc.',
        focus: { zoom: 1.8 },
        highlight: true,
        orientation,
      });
    }
  }

  // Prioritize moments enforcing minimum spacing (~0.8–1.2s) and max 4 (preferred 2-3)
  return prioritizeCoachingMoments(candidates, {
    objective: textContext,
    minSpacing: 0.8,
    maxMoments: 4,
  });
}

/**
 * Pure easing profiles for drill animation actions (TASK D8A).
 */
export function easePlayerMove(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  // Smooth acceleration and deceleration (easeInOutCubic)
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function easeBallPass(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  // Fast flight through mid-flight, clean arrival at receiver (easeInOutQuad)
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

export function easeBallDribble(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  if (clamped <= 0) return 0;
  if (clamped >= 1) return 1;
  // Soft sinusoidal easing (easeInOutSine) for natural, fluid close-control dribbling
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

export function getActionEasing(actionType: string, progress: number): number {
  switch (actionType) {
    case 'playerMove':
      return easePlayerMove(progress);
    case 'ballPass':
      return easeBallPass(progress);
    case 'ballDribble':
      return easeBallDribble(progress);
    default:
      return Math.max(0, Math.min(1, progress));
  }
}

/**
 * Evaluates a quadratic Bézier curve bounded within pitch limits.
 */
export function interpolateQuadraticBezier(
  p0: DiagramCoordinate,
  p1: DiagramCoordinate,
  p2: DiagramCoordinate,
  t: number
): DiagramCoordinate {
  const u = Math.max(0, Math.min(1, t));
  const inv = 1 - u;
  const x = inv * inv * p0.x + 2 * inv * u * p1.x + u * u * p2.x;
  const y = inv * inv * p0.y + 2 * inv * u * p1.y + u * u * p2.y;
  return {
    x: Math.max(0, Math.min(100, Math.round(x * 100) / 100)),
    y: Math.max(0, Math.min(100, Math.round(y * 100) / 100)),
  };
}

/**
 * Pure helper for player movement interpolation with optional subtle curved routes.
 */
export function interpolatePlayerMovement(
  from: DiagramCoordinate,
  to: DiagramCoordinate,
  progress: number,
  curve?: { controlX: number; controlY: number } | 'mild' | 'arc'
): DiagramCoordinate {
  const u = Math.max(0, Math.min(1, progress));
  if (u <= 0) return { x: from.x, y: from.y };
  if (u >= 1) return { x: to.x, y: to.y };

  if (curve) {
    let control: DiagramCoordinate;
    if (typeof curve === 'object' && typeof curve.controlX === 'number' && typeof curve.controlY === 'number') {
      control = { x: curve.controlX, y: curve.controlY };
    } else {
      // Calculate a mild perpendicular control point (mild arc within bounds)
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcScale = curve === 'arc' ? 0.12 : 0.08;
      const nx = dist > 0 ? (-dy / dist) * dist * arcScale : 0;
      const ny = dist > 0 ? (dx / dist) * dist * arcScale : 0;
      control = {
        x: Math.max(2, Math.min(98, midX + nx)),
        y: Math.max(2, Math.min(58, midY + ny)),
      };
    }
    return interpolateQuadraticBezier(from, control, to, u);
  }

  // Fallback: straight-line interpolation
  const x = from.x + (to.x - from.x) * u;
  const y = from.y + (to.y - from.y) * u;
  return {
    x: Math.max(0, Math.min(100, Math.round(x * 100) / 100)),
    y: Math.max(0, Math.min(100, Math.round(y * 100) / 100)),
  };
}

/**
 * Pure helper to compute ball pass flight coordinates with optional subtle readability arc.
 * Reaches receiver's interpolated position cleanly at arrival.
 */
export function calculatePassBallPosition(
  passerPos: DiagramCoordinate,
  receiverPos: DiagramCoordinate,
  progress: number,
  arcHeight: number = 0
): DiagramCoordinate {
  const u = Math.max(0, Math.min(1, progress));
  if (u <= 0) return { x: passerPos.x, y: passerPos.y };
  if (u >= 1) return { x: receiverPos.x, y: receiverPos.y };

  const baseX = passerPos.x + (receiverPos.x - passerPos.x) * u;
  const baseY = passerPos.y + (receiverPos.y - passerPos.y) * u;

  if (arcHeight !== 0) {
    const dx = receiverPos.x - passerPos.x;
    const dy = receiverPos.y - passerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const nx = -dy / dist;
      const ny = dx / dist;
      const arcLift = 4 * u * (1 - u) * arcHeight;
      return {
        x: Math.max(1, Math.min(99, Math.round((baseX + nx * arcLift) * 100) / 100)),
        y: Math.max(1, Math.min(59, Math.round((baseY + ny * arcLift) * 100) / 100)),
      };
    }
  }

  return {
    x: Math.max(0, Math.min(100, Math.round(baseX * 100) / 100)),
    y: Math.max(0, Math.min(100, Math.round(baseY * 100) / 100)),
  };
}

/**
 * Pure helper to calculate ball position during a dribble action.
 * Offsets ball slightly ahead of player in travel direction, settling close upon arrival.
 */
export function calculateDribbleBallPosition(
  playerPos: DiagramCoordinate,
  targetPos: DiagramCoordinate,
  progress: number,
  offsetDistance: number = 1.6,
  startPos?: DiagramCoordinate
): DiagramCoordinate {
  const dx = targetPos.x - playerPos.x;
  const dy = targetPos.y - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let ux = 1;
  let uy = 0;

  if (dist > 0.001) {
    ux = dx / dist;
    uy = dy / dist;
  } else if (startPos) {
    const sDx = targetPos.x - startPos.x;
    const sDy = targetPos.y - startPos.y;
    const sDist = Math.sqrt(sDx * sDx + sDy * sDy);
    if (sDist > 0.001) {
      ux = sDx / sDist;
      uy = sDy / sDist;
    }
  }

  // During active dribbling, keep subtle offset in travel direction (~1.6 units).
  // Approaching destination (progress > 0.75) and upon arrival (progress >= 1), ball settles close to player (~0.8 units).
  const effectiveOffset =
    progress >= 1
      ? offsetDistance * 0.5
      : progress > 0.75
      ? offsetDistance * (1 - 0.5 * ((progress - 0.75) / 0.25))
      : offsetDistance;

  return {
    x: Math.max(1, Math.min(99, Math.round((playerPos.x + ux * effectiveOffset) * 100) / 100)),
    y: Math.max(1, Math.min(59, Math.round((playerPos.y + uy * effectiveOffset) * 100) / 100)),
  };
}

/**
 * Pure helper to avoid visual player marker stacking without altering tactical structure.
 */
export function applyPlayerSpacingSafety(
  positions: Map<string, DiagramCoordinate>,
  minSeparation: number = 2.8,
  pitchBounds: { minX: number; maxX: number; minY: number; maxY: number } = { minX: 2, maxX: 98, minY: 2, maxY: 58 }
): Map<string, DiagramCoordinate> {
  const resolved = new Map(positions);
  const playerIds = Array.from(resolved.keys());

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const idA = playerIds[i];
      const idB = playerIds[j];
      const posA = resolved.get(idA);
      const posB = resolved.get(idB);
      if (!posA || !posB) continue;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minSeparation) {
        const angle = dist > 0.001 ? Math.atan2(dy, dx) : ((i + 1) * Math.PI) / 4;
        const nudge = (minSeparation - dist) / 2;
        const nx = Math.cos(angle) * nudge;
        const ny = Math.sin(angle) * nudge;

        resolved.set(idA, {
          x: Math.max(pitchBounds.minX, Math.min(pitchBounds.maxX, Math.round((posA.x - nx) * 100) / 100)),
          y: Math.max(pitchBounds.minY, Math.min(pitchBounds.maxY, Math.round((posA.y - ny) * 100) / 100)),
        });
        resolved.set(idB, {
          x: Math.max(pitchBounds.minX, Math.min(pitchBounds.maxX, Math.round((posB.x + nx) * 100) / 100)),
          y: Math.max(pitchBounds.minY, Math.min(pitchBounds.maxY, Math.round((posB.y + ny) * 100) / 100)),
        });
      }
    }
  }

  return resolved;
}

/**
 * Pure helper to compute distance-paced duration for animation actions (TASK D8A).
 * Avoids very short moves taking too long or very long moves completing instantly.
 */
export function calculatePacedDuration(
  distance: number,
  actionType: 'playerMove' | 'ballPass' | 'ballDribble',
  defaultDuration: number = 2.0
): number {
  const d = Math.max(0, distance);
  if (d <= 0.001) return defaultDuration;

  let speed: number;
  switch (actionType) {
    case 'ballPass':
      // Passes travel swiftly (~22 pitch units/sec)
      speed = 22;
      break;
    case 'ballDribble':
      // Controlled close ball carry (~10 pitch units/sec)
      speed = 10;
      break;
    case 'playerMove':
    default:
      // Player off-the-ball run (~13 pitch units/sec)
      speed = 13;
      break;
  }

  const rawPaced = d / speed;
  // Blend with defaultDuration for smooth pacing, clamped strictly between 0.8s and 3.5s
  const blended = 0.5 * defaultDuration + 0.5 * rawPaced;
  return Math.max(0.8, Math.min(3.5, Math.round(blended * 100) / 100));
}

/**
 * Pure helper for normalizing step durations to avoid unrealistic speeds.
 */
export function normalizeStepDurations(
  steps: DiagramAnimationStep[],
  totalDuration?: number
): DiagramAnimationStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    return steps || [];
  }

  let currentStart = 0;
  return steps.map((step, idx) => {
    const rawDuration = step.duration > 0 ? step.duration : 2.0;
    const clampedDuration = Math.max(0.8, Math.min(4.0, rawDuration));
    const start = idx === 0 ? step.start : Math.max(step.start, currentStart);
    currentStart = start + clampedDuration;
    return {
      ...step,
      start: Math.round(start * 100) / 100,
      duration: Math.round(clampedDuration * 100) / 100,
    };
  });
}

export interface MotionInterpolationOptions {
  visualDribbleOffset?: boolean;
  passArc?: boolean;
  curvedMovement?: boolean;
  spacingSafety?: boolean;
}

export const DEFAULT_POLISHED_MOTION_OPTIONS: MotionInterpolationOptions = {
  curvedMovement: true,
  passArc: true,
  visualDribbleOffset: true,
  spacingSafety: true,
};

/**
 * Interpolates player and ball positions at any time t (in seconds) during playback.
 * At currentTime <= 0 or when stopped/reset: returns exact initial positions from diagram.players & diagram.balls.
 * Only action types playerMove, ballPass, and ballDribble are evaluated.
 */
export function interpolateAnimationState(
  diagram: StructuredDrillDiagram,
  currentTime: number,
  options?: MotionInterpolationOptions
): {
  players: DiagramPlayer[];
  balls: DiagramBall[];
} {
  const basePlayers = Array.isArray(diagram.players) ? diagram.players : [];
  const baseBalls = Array.isArray(diagram.balls) ? diagram.balls : [];

  const anim = diagram.animation;
  if (!anim || !Array.isArray(anim.steps) || anim.steps.length === 0 || currentTime <= 0) {
    return {
      players: basePlayers.map((p) => ({ ...p })),
      balls: baseBalls.map((b) => ({ ...b })),
    };
  }

  const duration = Math.max(0.1, typeof anim.duration === 'number' ? anim.duration : 8);
  const t = Math.max(0, Math.min(duration, currentTime));

  // Current dynamic positions of players and balls
  const playerPositions = new Map<string, DiagramCoordinate>();
  basePlayers.forEach((p) => {
    playerPositions.set(p.id, { x: p.x, y: p.y });
  });

  const ballPositions = new Map<string, DiagramCoordinate>();
  baseBalls.forEach((b) => {
    ballPositions.set(b.id, { x: b.x, y: b.y });
  });

  // Sort steps chronologically
  const steps = [...anim.steps].sort((a, b) => a.start - b.start);

  for (const step of steps) {
    const stepStart = step.start;
    const stepDuration = Math.max(0.001, step.duration);
    const stepEnd = stepStart + stepDuration;

    if (t < stepStart) {
      continue;
    }

    const isFinished = t >= stepEnd;
    const rawProgress = isFinished ? 1 : Math.max(0, Math.min(1, (t - stepStart) / stepDuration));

    const snapshotPlayers = new Map(playerPositions);
    const snapshotBalls = new Map(ballPositions);

    if (Array.isArray(step.actions)) {
      // First update any player movements in the step so passes synchronize with moving receivers
      for (const action of step.actions) {
        if (action.type === 'playerMove') {
          const startPos = snapshotPlayers.get(action.playerId);
          if (startPos && action.to) {
            const eased = isFinished ? 1 : easePlayerMove(rawProgress);
            const curve = action.curve ?? (options?.curvedMovement ? 'mild' : undefined);
            const newPos = interpolatePlayerMovement(startPos, action.to, eased, curve);
            playerPositions.set(action.playerId, newPos);
          }
        }
      }

      for (const action of step.actions) {
        if (action.type === 'ballPass') {
          const fromPos = snapshotPlayers.get(action.fromPlayerId);
          // If receiver is moving during the pass: target receiver's destination trajectory
          // so ball arrives exactly at receiver position cleanly synchronized
          const receiverMove = step.actions.find(
            (a): a is PlayerMoveAction => a.type === 'playerMove' && a.playerId === action.toPlayerId
          );
          const toPos = receiverMove
            ? receiverMove.to
            : (playerPositions.get(action.toPlayerId) || snapshotPlayers.get(action.toPlayerId));

          if (fromPos && toPos) {
            const eased = isFinished ? 1 : easeBallPass(rawProgress);
            const arcHeight = options?.passArc ? 1.5 : 0;
            const ballPos = calculatePassBallPosition(fromPos, toPos, eased, arcHeight);
            ballPositions.set(action.ballId, ballPos);
          }
        } else if (action.type === 'ballDribble') {
          const startPos = snapshotPlayers.get(action.playerId);
          if (startPos && action.to) {
            const eased = isFinished ? 1 : easeBallDribble(rawProgress);
            const newPlayerPos = interpolatePlayerMovement(startPos, action.to, eased);
            playerPositions.set(action.playerId, newPlayerPos);

            if (options?.visualDribbleOffset) {
              const ballPos = calculateDribbleBallPosition(newPlayerPos, action.to, eased, 1.6, startPos);
              ballPositions.set(action.ballId, ballPos);
            } else {
              ballPositions.set(action.ballId, { x: newPlayerPos.x, y: newPlayerPos.y });
            }
          }
        }
      }
    }
  }

  const finalPlayerPositions = options?.spacingSafety
    ? applyPlayerSpacingSafety(playerPositions)
    : playerPositions;

  const updatedPlayers = basePlayers.map((p) => {
    const pos = finalPlayerPositions.get(p.id);
    const orientation = reconstructPlayerOrientation(
      p.id,
      currentTime,
      p.orientation,
      anim.coachingMoments
    );
    return pos
      ? { ...p, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100, orientation }
      : { ...p, orientation };
  });

  const updatedBalls = baseBalls.map((b) => {
    const pos = ballPositions.get(b.id);
    return pos ? { ...b, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100 } : { ...b };
  });

  return { players: updatedPlayers, balls: updatedBalls };
}

export interface LocalDrillGroup {
  groupId: string;
  playerIds: string[];
  playerPositions: Map<string, DiagramCoordinate>;
  ballIds: string[];
  paths: DiagramPath[];
  center: DiagramCoordinate;
}

/**
 * Derives self-contained local groups / stations from a structured drill diagram.
 * For pair drills, each group contains exactly 2 players with its own local ball and local paths.
 */
export function deriveLocalGroups(diagram: StructuredDrillDiagram): LocalDrillGroup[] {
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const balls = Array.isArray(diagram.balls) ? diagram.balls : [];
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];

  if (players.length === 0) return [];

  const playerMap = new Map<string, DiagramPlayer>();
  players.forEach((p) => playerMap.set(p.id, p));

  const pOrg = diagram.playerOrganization;
  const isExplicitPairDrill = Boolean(pOrg && pOrg.playersPerGroup === 2 && pOrg.groups > 0);

  // Group players by spatial clustering
  const clusterThreshold = isExplicitPairDrill ? 18 : 20;
  const rawClusters = clusterDiagramPlayers(players, clusterThreshold);

  // If 1 or 0 clusters found, treat as single global group
  if (rawClusters.length <= 1) {
    const center = {
      x: Math.round((players.reduce((sum, p) => sum + p.x, 0) / players.length) * 10) / 10,
      y: Math.round((players.reduce((sum, p) => sum + p.y, 0) / players.length) * 10) / 10,
    };
    const playerPositions = new Map<string, DiagramCoordinate>();
    players.forEach((p) => playerPositions.set(p.id, { x: p.x, y: p.y }));
    return [
      {
        groupId: 'group-1',
        playerIds: players.map((p) => p.id),
        playerPositions,
        ballIds: balls.map((b) => b.id),
        paths: [...paths],
        center,
      },
    ];
  }

  const parseNum = (id: string) => {
    const n = parseInt(id.replace(/\D/g, ''), 10);
    return isNaN(n) ? 999 : n;
  };

  // Sort clusters deterministically by lowest player numerical ID
  const sortedClusters = [...rawClusters].sort((cA, cB) => {
    const minA = Math.min(...cA.map((p) => parseNum(p.id)));
    const minB = Math.min(...cB.map((p) => parseNum(p.id)));
    return minA - minB;
  });

  const assignedBallIds = new Set<string>();
  const groups: LocalDrillGroup[] = [];

  sortedClusters.forEach((cluster, idx) => {
    // Sort players in cluster by numerical ID (e.g. p1, p2 or p9, p10)
    const pIds = cluster.map((p) => p.id).sort((a, b) => parseNum(a) - parseNum(b));
    const pPositions = new Map<string, DiagramCoordinate>();
    cluster.forEach((p) => pPositions.set(p.id, { x: p.x, y: p.y }));

    const centerX = Math.round((cluster.reduce((s, p) => s + p.x, 0) / cluster.length) * 10) / 10;
    const centerY = Math.round((cluster.reduce((s, p) => s + p.y, 0) / cluster.length) * 10) / 10;
    const center: DiagramCoordinate = { x: centerX, y: centerY };

    // Select the nearby local ball belonging to this station
    let bestBallId = '';
    let minDist = Infinity;
    balls.forEach((b) => {
      if (assignedBallIds.has(b.id)) return;
      const d = Math.hypot(b.x - centerX, b.y - centerY);
      if (d < minDist) {
        minDist = d;
        bestBallId = b.id;
      }
    });

    const ballIds: string[] = [];
    if (bestBallId) {
      assignedBallIds.add(bestBallId);
      ballIds.push(bestBallId);
    } else {
      const fallbackBall = balls.find((b) => !assignedBallIds.has(b.id)) || balls[0];
      if (fallbackBall) ballIds.push(fallbackBall.id);
      else ballIds.push(`b${idx + 1}`);
    }

    // Filter paths belonging to this group
    const pIdSet = new Set(pIds);
    let groupPaths = paths.filter((path) => pIdSet.has(path.fromPlayerId));

    // Enforce strict local pair mapping for 2-player groups
    if (pIds.length === 2) {
      const [idA, idB] = pIds;
      groupPaths = groupPaths.map((path) => {
        if (path.type === 'pass') {
          const targetTo = path.fromPlayerId === idA ? idB : idA;
          return { ...path, toPlayerId: targetTo };
        }
        return path;
      });
    }

    groups.push({
      groupId: `group-${idx + 1}`,
      playerIds: pIds,
      playerPositions: pPositions,
      ballIds,
      paths: groupPaths,
      center,
    });
  });

  return groups;
}

/**
 * Validates self-contained local groups / stations in a structured diagram.
 * Verifies:
 * - Every grouped pass is inside one group (no cross-group pass)
 * - Every grouped movement is inside that group's local station geometry
 * - No cross-group player reference
 * - Local ball belongs near the group and is not shared across distant stations
 * - No impossible ball teleport between distant stations
 */
export function validateGroupedDiagram(diagram: StructuredDrillDiagram): DiagramValidationResult {
  const errors: string[] = [];
  if (!diagram || typeof diagram !== 'object') {
    return { ok: false, errors: ['Diagram must be a non-null object'] };
  }

  const groups = deriveLocalGroups(diagram);
  if (groups.length <= 1) {
    return { ok: true, errors: [] };
  }

  const playerGroupMap = new Map<string, LocalDrillGroup>();
  const playerCoordsMap = new Map<string, DiagramCoordinate>();
  if (Array.isArray(diagram.players)) {
    diagram.players.forEach((p) => playerCoordsMap.set(p.id, { x: p.x, y: p.y }));
  }

  for (const g of groups) {
    for (const pid of g.playerIds) {
      if (playerGroupMap.has(pid)) {
        errors.push(`Player '${pid}' is assigned to multiple groups: '${playerGroupMap.get(pid)!.groupId}' and '${g.groupId}'`);
      }
      playerGroupMap.set(pid, g);
    }
  }

  // 1. Verify static paths
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];
  for (const path of paths) {
    const fromG = path.fromPlayerId ? playerGroupMap.get(path.fromPlayerId) : undefined;
    const toG = path.toPlayerId ? playerGroupMap.get(path.toPlayerId) : undefined;

    if (fromG && toG && fromG.groupId !== toG.groupId) {
      errors.push(
        `Cross-group player reference in static path '${path.id}': player '${path.fromPlayerId}' in group '${fromG.groupId}' targets player '${path.toPlayerId}' in group '${toG.groupId}'`
      );
    }

    if (path.type === 'movement' && fromG && path.toPlayerId) {
      if (toG && toG.groupId !== fromG.groupId) {
        errors.push(
          `Movement target references different group in path '${path.id}': '${path.fromPlayerId}' to '${path.toPlayerId}'`
        );
      }
    }
  }

  // 2. Local ball ownership: each group must have a ball belonging near the group
  const balls = Array.isArray(diagram.balls) ? diagram.balls : [];
  const ballMap = new Map<string, DiagramBall>();
  balls.forEach((b) => ballMap.set(b.id, b));

  const MAX_BALL_STATION_DISTANCE = 22; // units
  const assignedBallToGroup = new Map<string, string>();

  for (const g of groups) {
    if (g.ballIds.length === 0) {
      errors.push(`Group '${g.groupId}' has no assigned local ball`);
    } else {
      for (const bId of g.ballIds) {
        const ball = ballMap.get(bId);
        if (!ball) {
          errors.push(`Group '${g.groupId}' references non-existent ball '${bId}'`);
          continue;
        }
        const dist = Math.hypot(ball.x - g.center.x, ball.y - g.center.y);
        if (dist > MAX_BALL_STATION_DISTANCE) {
          errors.push(
            `Local ball '${bId}' (at ${ball.x}, ${ball.y}) is too far from group '${g.groupId}' center (${g.center.x}, ${g.center.y}), dist=${dist.toFixed(1)}`
          );
        }
        if (assignedBallToGroup.has(bId)) {
          errors.push(
            `Ball '${bId}' is shared across multiple groups: '${assignedBallToGroup.get(bId)}' and '${g.groupId}'`
          );
        }
        assignedBallToGroup.set(bId, g.groupId);
      }
    }
  }

  // 3. Animation actions: verify passes, movements, and no ball teleportation
  const animation = diagram.animation;
  if (animation && Array.isArray(animation.steps)) {
    const MAX_STATION_MOVEMENT_RADIUS = 22; // movement must remain inside group's local geometry

    const ballLastKnownPos = new Map<string, DiagramCoordinate>();
    balls.forEach((b) => ballLastKnownPos.set(b.id, { x: b.x, y: b.y }));

    animation.steps.forEach((step, sIdx) => {
      const actions = Array.isArray(step.actions) ? step.actions : [];
      const stepBallUsage = new Map<string, string>();

      for (const a of actions) {
        if (a.type === 'ballPass') {
          const fromG = playerGroupMap.get(a.fromPlayerId);
          const toG = playerGroupMap.get(a.toPlayerId);

          if (!fromG) {
            errors.push(`Step ${sIdx + 1} ballPass references unassigned player '${a.fromPlayerId}'`);
          }
          if (!toG) {
            errors.push(`Step ${sIdx + 1} ballPass references unassigned player '${a.toPlayerId}'`);
          }
          if (fromG && toG && fromG.groupId !== toG.groupId) {
            errors.push(
              `Cross-group pass action in step ${sIdx + 1}: player '${a.fromPlayerId}' in group '${fromG.groupId}' passed to '${a.toPlayerId}' in group '${toG.groupId}'`
            );
          }

          // Local ball belongs near the group
          if (fromG && !fromG.ballIds.includes(a.ballId)) {
            const lastPos = ballLastKnownPos.get(a.ballId);
            if (lastPos) {
              const distToGroup = Math.hypot(lastPos.x - fromG.center.x, lastPos.y - fromG.center.y);
              if (distToGroup > MAX_BALL_STATION_DISTANCE) {
                errors.push(
                  `Pass in step ${sIdx + 1} uses ball '${a.ballId}' belonging to a distant station (dist=${distToGroup.toFixed(1)})`
                );
              }
            }
          }

          // Check impossible ball teleportation before pass
          const lastPos = ballLastKnownPos.get(a.ballId);
          const passerPos = playerCoordsMap.get(a.fromPlayerId);
          if (lastPos && passerPos) {
            const distFromLastPos = Math.hypot(lastPos.x - passerPos.x, lastPos.y - passerPos.y);
            if (distFromLastPos > 30) {
              errors.push(
                `Impossible ball teleport: ball '${a.ballId}' jumped ${distFromLastPos.toFixed(1)} units to passer '${a.fromPlayerId}' without travel`
              );
            }
          }

          const receiverPos = playerCoordsMap.get(a.toPlayerId);
          if (receiverPos) {
            ballLastKnownPos.set(a.ballId, { x: receiverPos.x, y: receiverPos.y });
          }

          if (stepBallUsage.has(a.ballId)) {
            errors.push(
              `Step ${sIdx + 1} reuses ball '${a.ballId}' in multiple simultaneous actions (${stepBallUsage.get(a.ballId)} and pass ${a.fromPlayerId}->${a.toPlayerId})`
            );
          }
          stepBallUsage.set(a.ballId, `pass ${a.fromPlayerId}->${a.toPlayerId}`);
        } else if (a.type === 'playerMove') {
          const pGroup = playerGroupMap.get(a.playerId);
          if (pGroup) {
            const distToCenter = Math.hypot(a.to.x - pGroup.center.x, a.to.y - pGroup.center.y);
            if (distToCenter > MAX_STATION_MOVEMENT_RADIUS) {
              errors.push(
                `playerMove for '${a.playerId}' in '${pGroup.groupId}' moves outside local station geometry (target: [${a.to.x}, ${a.to.y}], center: [${pGroup.center.x}, ${pGroup.center.y}], dist=${distToCenter.toFixed(1)})`
              );
            }
          }
        } else if (a.type === 'ballDribble') {
          const pGroup = playerGroupMap.get(a.playerId);
          if (pGroup) {
            const distToCenter = Math.hypot(a.to.x - pGroup.center.x, a.to.y - pGroup.center.y);
            if (distToCenter > MAX_STATION_MOVEMENT_RADIUS) {
              errors.push(
                `ballDribble for '${a.playerId}' in '${pGroup.groupId}' moves outside local station geometry (target: [${a.to.x}, ${a.to.y}], dist=${distToCenter.toFixed(1)})`
              );
            }
          }
          ballLastKnownPos.set(a.ballId, { x: a.to.x, y: a.to.y });
        }
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Builds a clear, semantically grounded demonstration animation sequence
 * from the diagram's action paths, players, and balls.
 * Supports simultaneous multi-group / multi-pair animation where every group
 * operates locally with its own ball and within its own station geometry.
 */
export function buildSemanticAnimation(
  diagram: StructuredDrillDiagram,
  execution?: string | string[]
): DiagramAnimation {
  if (diagram.animation && Array.isArray(diagram.animation.steps) && diagram.animation.steps.length > 0) {
    return diagram.animation;
  }

  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const balls = Array.isArray(diagram.balls) ? diagram.balls : [];
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];

  if (players.length === 0) {
    return { duration: 6, steps: [] };
  }

  const steps: DiagramAnimationStep[] = [];
  let currentTime = 0;
  const playerMap = new Map<string, DiagramPlayer>();
  players.forEach((p) => playerMap.set(p.id, p));

  const primaryBall = balls[0] || { id: 'b1', x: players[0]?.x ?? 50, y: players[0]?.y ?? 50 };

  const groups = deriveLocalGroups(diagram);
  const activeGroups = groups.filter((g) => g.playerIds.length >= 2);

  // If there are multiple self-contained groups/stations: animate groups simultaneously
  if (activeGroups.length > 1) {
    const isAllPairs = activeGroups.every((g) => g.playerIds.length === 2);

    if (isAllPairs) {
      // 1. Step 1: All pairs pass simultaneously A -> B
      const step1Actions: DiagramAnimationAction[] = activeGroups.map((g) => {
        const [idA, idB] = g.playerIds;
        const localBall = g.ballIds[0] || primaryBall.id;
        return {
          type: 'ballPass',
          ballId: localBall,
          fromPlayerId: idA,
          toPlayerId: idB,
        };
      });

      steps.push({
        id: 'step-1-pass',
        start: 0,
        duration: 2.0,
        actions: step1Actions,
      });

      // 2. Step 2: All pairs return pass simultaneously B -> A
      const step2Actions: DiagramAnimationAction[] = activeGroups.map((g) => {
        const [idA, idB] = g.playerIds;
        const localBall = g.ballIds[0] || primaryBall.id;
        return {
          type: 'ballPass',
          ballId: localBall,
          fromPlayerId: idB,
          toPlayerId: idA,
        };
      });

      steps.push({
        id: 'step-2-return-pass',
        start: 2.0,
        duration: 2.0,
        actions: step2Actions,
      });

      currentTime = 4.0;
    } else {
      // Multi-station drills with arbitrary station paths (e.g. 4 quad stations)
      const maxGroupSteps = Math.max(...activeGroups.map((g) => g.paths.length), 2);

      for (let sIdx = 0; sIdx < maxGroupSteps; sIdx++) {
        const stepActions: DiagramAnimationAction[] = [];

        for (const g of activeGroups) {
          const localBallId = g.ballIds[0] || primaryBall.id;
          const p = g.paths[sIdx];

          if (p) {
            const fromP = playerMap.get(p.fromPlayerId);
            const toP = p.toPlayerId ? playerMap.get(p.toPlayerId) : undefined;

            if (p.type === 'pass' && fromP) {
              const targetToId = toP && g.playerIds.includes(toP.id)
                ? toP.id
                : g.playerIds.find((id) => id !== fromP.id) || g.playerIds[1];
              stepActions.push({
                type: 'ballPass',
                ballId: localBallId,
                fromPlayerId: fromP.id,
                toPlayerId: targetToId,
              });
            } else if (p.type === 'movement' && fromP) {
              let targetX: number;
              let targetY: number;
              if (toP && g.playerIds.includes(toP.id)) {
                targetX = Math.round(toP.x + (toP.x > fromP.x ? -5 : (toP.x < fromP.x ? 5 : 0)));
                targetY = toP.y;
              } else {
                const dx = fromP.x >= g.center.x ? -4 : 4;
                const dy = fromP.y >= g.center.y ? -3 : 3;
                targetX = Math.round(fromP.x + dx);
                targetY = Math.round(fromP.y + dy);
              }
              stepActions.push({
                type: 'playerMove',
                playerId: fromP.id,
                to: { x: targetX, y: targetY },
              });
            } else if (p.type === 'dribble' && fromP) {
              let targetX: number;
              let targetY: number;
              if (toP && g.playerIds.includes(toP.id)) {
                targetX = toP.x;
                targetY = toP.y;
              } else {
                const dx = fromP.x >= g.center.x ? -5 : 5;
                const dy = fromP.y >= g.center.y ? -3 : 3;
                targetX = Math.round(fromP.x + dx);
                targetY = Math.round(fromP.y + dy);
              }
              stepActions.push({
                type: 'ballDribble',
                ballId: localBallId,
                playerId: fromP.id,
                to: { x: targetX, y: targetY },
              });
            }
          } else if (g.playerIds.length === 2 && sIdx === 1) {
            // Pair return pass fallback
            stepActions.push({
              type: 'ballPass',
              ballId: localBallId,
              fromPlayerId: g.playerIds[1],
              toPlayerId: g.playerIds[0],
            });
          }
        }

        if (stepActions.length > 0) {
          steps.push({
            id: `step-${sIdx + 1}`,
            start: currentTime,
            duration: 2.0,
            actions: stepActions,
          });
          currentTime += 2.0;
        }
      }
    }
  } else {
    // Single-group or chain drills (e.g. test D4, skill rondo, single 1v1 grid)
    if (paths.length > 0) {
      paths.forEach((p, idx) => {
        const fromP = playerMap.get(p.fromPlayerId);
        const toP = p.toPlayerId ? playerMap.get(p.toPlayerId) : undefined;
        const stepDuration = 2.0;

        if (p.type === 'pass' && fromP && toP) {
          steps.push({
            id: `step-${idx + 1}-pass`,
            start: currentTime,
            duration: stepDuration,
            actions: [
              {
                type: 'ballPass',
                ballId: primaryBall.id,
                fromPlayerId: fromP.id,
                toPlayerId: toP.id,
              },
            ],
          });
          currentTime += stepDuration;

          // For 2-player representative pair with single pass path, add return pass for complete cycle
          if (players.length === 2 && paths.length === 1) {
            steps.push({
              id: `step-${idx + 2}-return-pass`,
              start: currentTime,
              duration: stepDuration,
              actions: [
                {
                  type: 'ballPass',
                  ballId: primaryBall.id,
                  fromPlayerId: toP.id,
                  toPlayerId: fromP.id,
                },
              ],
            });
            currentTime += stepDuration;
          }
        } else if (p.type === 'movement' && fromP) {
          const targetX = toP
            ? Math.round(toP.x + (toP.x > fromP.x ? -6 : 6))
            : Math.min(90, Math.max(10, fromP.x + 10));
          const targetY = toP ? toP.y : fromP.y;
          steps.push({
            id: `step-${idx + 1}-move`,
            start: currentTime,
            duration: stepDuration,
            actions: [
              {
                type: 'playerMove',
                playerId: fromP.id,
                to: { x: targetX, y: targetY },
              },
            ],
          });
          currentTime += stepDuration;
        } else if (p.type === 'dribble' && fromP) {
          const targetX = toP ? toP.x : Math.min(88, Math.max(12, fromP.x + 12));
          const targetY = toP ? toP.y : fromP.y;
          steps.push({
            id: `step-${idx + 1}-dribble`,
            start: currentTime,
            duration: stepDuration,
            actions: [
              {
                type: 'ballDribble',
                ballId: primaryBall.id,
                playerId: fromP.id,
                to: { x: targetX, y: targetY },
              },
            ],
          });
          currentTime += stepDuration;
        }
      });
    }

    // Fallback demo for pairing or group if no paths converted
    if (steps.length === 0 && players.length >= 2) {
      const p1 = players[0];
      const p2 = players[1];
      steps.push(
        {
          id: 'step1',
          start: 0,
          duration: 2.0,
          actions: [
            {
              type: 'ballPass',
              ballId: primaryBall.id,
              fromPlayerId: p1.id,
              toPlayerId: p2.id,
            },
          ],
        },
        {
          id: 'step2',
          start: 2.0,
          duration: 2.0,
          actions: [
            {
              type: 'ballPass',
              ballId: primaryBall.id,
              fromPlayerId: p2.id,
              toPlayerId: p1.id,
            },
          ],
        }
      );
      currentTime = 4.0;
    }
  }

  const duration = Math.max(2, Math.round(currentTime * 10) / 10);
  const coachingMoments = buildSemanticCoachingMoments(
    { ...diagram, animation: { duration, steps } },
    execution
  );
  let coachingSequence: DiagramCoachingSequence | undefined;
  if (coachingMoments.length >= 2) {
    const isReceiving = execution && /nhận bóng|mở thân|quan sát|kiểm tra vai/i.test(String(execution));
    coachingSequence = buildCoachingSequence(
      coachingMoments,
      isReceiving ? 'Nhận bóng mở thân người' : 'Chuỗi huấn luyện kỹ thuật'
    );
  }
  return { duration, steps, coachingMoments, ...(coachingSequence ? { coachingSequence } : {}) };
}

export interface BuildDiagramOptions {
  blockType: BlockType;
  playerCount: number;
  playerOrganization?: ExercisePlayerOrganization;
  exerciseName?: string;
  topic?: string;
  organization?: string;
  execution?: string;
  equipment?: string[];
  area?: string;
  gameFormat?: GameFormat;
  representationMode?: 'full' | 'representative-group';
  preferRepresentative?: boolean;
}

export interface SemanticValidationOptions {
  playerCount: number;
  playerOrganization?: ExercisePlayerOrganization;
  equipment?: string[];
  organization?: string;
  execution?: string;
  blockType?: BlockType;
  representation?: DiagramRepresentation;
}

export interface RepresentativeGroupOptions {
  blockType?: BlockType;
  playerCount?: number;
  playerOrganization?: ExercisePlayerOrganization;
  organization?: string;
  execution?: string;
  topic?: string;
  exerciseName?: string;
  equipment?: string[];
  area?: string;
  gameFormat?: GameFormat;
}

/**
 * Pure helper to detect whether an exercise should use a representative-group diagram (TASK REP-A).
 * Returns true only when:
 * - playerOrganization.groups > 1
 * - groups are independent/repeated
 * - no opposition between groups
 * - no inter-group interaction
 * - drill is technical/unopposed/repeated-station style
 * 
 * Returns false for:
 * - small-sided games
 * - conditioned games
 * - match
 * - opposed drills
 * - rondos with interacting roles
 * - possession games
 * - exercises where groups interact
 */
export function shouldUseRepresentativeGroup(options?: RepresentativeGroupOptions): boolean {
  if (!options) return false;
  const pOrg = options.playerOrganization;
  if (!pOrg || typeof pOrg.groups !== 'number' || pOrg.groups <= 1) {
    return false;
  }
  if (typeof pOrg.playersPerGroup !== 'number' || pOrg.playersPerGroup < 1) {
    return false;
  }

  const blockType = options.blockType;
  // Return false for match and small-sided games
  if (blockType === 'match' || blockType === 'small_sided') {
    return false;
  }

  // Return false for opposed drills
  if (isOpposedExercise(blockType || 'technical', options.organization, options.execution, pOrg)) {
    return false;
  }

  const text = [
    options.organization || '',
    options.execution || '',
    options.exerciseName || '',
    options.topic || '',
  ].join(' ').toLowerCase();

  const isExplicitlyUnopposed = /không đối kháng|unopposed|không có hậu vệ|không người kèm/i.test(text);
  const textWithoutUnopposed = text.replace(/không đối kháng|không có hậu vệ|không người kèm|unopposed/gi, '');

  // Return false for small-sided games, conditioned games, match
  if (/small-sided|small sided|conditioned game|trò chơi nhỏ|trò chơi điều kiện|trận đấu|thi đấu \d+v\d+/i.test(text)) {
    return false;
  }

  // Return false for opposed drills, defenders, rondos with interacting roles, possession games
  if (!isExplicitlyUnopposed && /đối kháng|hậu vệ|defender|presser|áp sát|cướp bóng|đoạt bóng|tranh bóng|tranh cướp|rondo|possession|kiểm soát bóng|chia 2 đội/i.test(textWithoutUnopposed)) {
    return false;
  }
  if (isExplicitlyUnopposed && /rondo|possession|chia 2 đội/i.test(textWithoutUnopposed)) {
    return false;
  }

  // Return false for exercises where groups interact (e.g. inter-station passing or rotating together)
  if (/chuyển sang nhóm khác|đổi nhóm|nhóm này chuyền cho nhóm khác|hai nhóm phối hợp|các nhóm tương tác|đấu giữa các nhóm|xoay vòng giữa các trạm/i.test(text)) {
    return false;
  }

  // Drill is technical/unopposed/repeated-station style
  if (blockType === 'warm_up' || blockType === 'technical' || !blockType) {
    return true;
  }

  if (blockType === 'skill' && !isOpposedExercise('skill', options.organization, options.execution, pOrg)) {
    return true;
  }

  return false;
}

export interface DetectedEquipmentGoals {
  hasGoals: boolean;
  isMini: boolean;
  miniGoals: number;
  matchGoals: number;
  totalExpected: number;
}

/**
 * Parses equipment and drill text to detect explicit goal specifications.
 * Prevents inventing mini goals or match goals when not requested by the drill.
 */
/**
 * Parses equipment and drill text to detect explicit goal specifications.
 * Prevents inventing mini goals or match goals when not requested by the drill.
 * Primary source of truth is the equipment array.
 */
export function detectEquipmentGoals(
  equipment?: string[],
  organization?: string,
  execution?: string
): DetectedEquipmentGoals {
  const hasEquipment = Array.isArray(equipment) && equipment.length > 0;
  const eqText = (hasEquipment ? equipment : []).join(' ').toLowerCase();

  // If equipment is provided, do NOT infer goals from execution or organization unless equipment specifies them.
  // This prevents false positives from execution text mentioning "bàn thắng" or "ghi bàn".
  const textToCheck = hasEquipment ? eqText : [organization || '', execution || ''].join(' ').toLowerCase();

  const miniRegex = /(\d+)\s*(?:cầu môn mini|khung thành mini|cầu môn nhỏ|khung thành nhỏ|mini goal|small goal)/i;
  const matchRegex = /(\d+)\s*(?:khung thành sân \d+|khung thành futsal|khung thành tiêu chuẩn|khung thành lớn|cầu môn tiêu chuẩn|khung thành|cầu môn)/i;

  const hasMiniKeyword = /cầu môn mini|khung thành mini|cầu môn nhỏ|khung thành nhỏ|mini goal|small goal/i.test(textToCheck);
  const hasMatchKeyword = /khung thành sân|khung thành futsal|khung thành có thủ môn|khung thành lớn|khung thành tiêu chuẩn|cầu môn tiêu chuẩn/i.test(textToCheck);
  const hasGenericGoal = /khung thành|cầu môn|goal\b/i.test(textToCheck);

  if (!hasMiniKeyword && !hasMatchKeyword && !hasGenericGoal) {
    return { hasGoals: false, isMini: false, miniGoals: 0, matchGoals: 0, totalExpected: 0 };
  }

  if (hasMiniKeyword) {
    const match = textToCheck.match(miniRegex);
    const count = match ? parseInt(match[1], 10) : 4;
    return { hasGoals: true, isMini: true, miniGoals: count, matchGoals: 0, totalExpected: count };
  }

  if (hasMatchKeyword) {
    const match = textToCheck.match(matchRegex);
    const count = match ? parseInt(match[1], 10) : 2;
    return { hasGoals: true, isMini: false, miniGoals: 0, matchGoals: count, totalExpected: count };
  }

  const numMatch = textToCheck.match(/(\d+)\s*(?:khung thành|cầu môn)/i);
  const count = numMatch ? parseInt(numMatch[1], 10) : 2;
  const isMini = /mini|nhỏ/i.test(textToCheck);
  return {
    hasGoals: true,
    isMini,
    miniGoals: isMini ? count : 0,
    matchGoals: isMini ? 0 : count,
    totalExpected: count,
  };
}

/**
 * Detects tactical zones (e.g. 3 lanes/channels) only when explicitly described in organization/execution.
 */
export function detectTacticalZones(
  organization?: string,
  execution?: string,
  equipment?: string[]
): DiagramZone[] {
  const text = [
    organization || '',
    execution || '',
    ...(Array.isArray(equipment) ? equipment : []),
  ]
    .join(' ')
    .toLowerCase();

  const hasThreeLanes = /3 hành lang|ba hành lang|hành lang biên|3 lanes|channels|3 ô|ba ô/i.test(text);
  if (!hasThreeLanes) {
    return [];
  }

  return [
    {
      id: 'zone-left',
      name: 'Hành lang biên trái',
      x: 5,
      y: 5,
      width: 90,
      height: 28,
    },
    {
      id: 'zone-center',
      name: 'Hành lang trung tâm',
      x: 5,
      y: 33,
      width: 90,
      height: 34,
    },
    {
      id: 'zone-right',
      name: 'Hành lang biên phải',
      x: 5,
      y: 67,
      width: 90,
      height: 28,
    },
  ];
}

/**
 * Checks whether an exercise is opposed (defenders/opposition present) or unopposed.
 */
export function isOpposedExercise(
  blockType: BlockType,
  organization?: string,
  execution?: string,
  playerOrg?: ExercisePlayerOrganization
): boolean {
  if (blockType === 'match' || blockType === 'small_sided') {
    return true;
  }

  const text = [organization || '', execution || ''].join(' ').toLowerCase();

  if (/không đối kháng|unopposed|chuyền đôi|cặp đối diện|phối hợp không có người kèm|không có hậu vệ|không người kèm/i.test(text)) {
    return false;
  }

  if (playerOrg && playerOrg.groups === 2 && playerOrg.playersPerGroup >= 3) {
    return true;
  }

  if (/đối kháng|tranh cướp|hậu vệ|áp sát|cướp bóng|presser|defender|rondo|quá tải|đoạt bóng/i.test(text)) {
    return true;
  }

  if (blockType === 'warm_up' || blockType === 'technical') {
    return false;
  }

  if (blockType === 'skill') {
    return true;
  }

  return false;
}

/**
 * Clusters players by spatial distance to verify group layout consistency.
 */
export function clusterDiagramPlayers(players: DiagramPlayer[], threshold = 18): DiagramPlayer[][] {
  const visited = new Set<string>();
  const clusters: DiagramPlayer[][] = [];

  for (const p of players) {
    if (visited.has(p.id)) continue;
    const cluster: DiagramPlayer[] = [p];
    visited.add(p.id);

    const queue = [p];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const other of players) {
        if (!visited.has(other.id)) {
          const dist = Math.hypot(other.x - current.x, other.y - current.y);
          if (dist <= threshold) {
            visited.add(other.id);
            cluster.push(other);
            queue.push(other);
          }
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Validates semantic consistency between exercise description and diagram.
 */
export function validateSemanticDiagram(
  diagram: StructuredDrillDiagram,
  options: SemanticValidationOptions
): DiagramValidationResult {
  const errors: string[] = [];

  if (!diagram || typeof diagram !== 'object') {
    return { ok: false, errors: ['Diagram must be an object'] };
  }

  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const zones = Array.isArray(diagram.zones) ? diagram.zones : [];
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];

  // 1. Total player count vs exercise allocation
  const rep = diagram.representation || options.representation;
  const isRepGroup = rep?.mode === 'representative-group';

  if (isRepGroup) {
    if (!rep || typeof rep !== 'object') {
      errors.push('Representative diagram missing representation metadata');
    } else {
      if (typeof rep.totalGroups !== 'number' || rep.totalGroups <= 1) {
        errors.push(`Representative diagram totalGroups must be > 1 (got ${rep.totalGroups})`);
      }
      if (typeof rep.playersPerGroup !== 'number' || rep.playersPerGroup < 1) {
        errors.push(`Representative diagram playersPerGroup must be positive (got ${rep.playersPerGroup})`);
      }
      const represented = rep.representedGroups || 1;
      const expectedCount = rep.playersPerGroup * represented;
      if (players.length !== expectedCount) {
        errors.push(
          `Representative diagram player count (${players.length}) does not match represented players (${expectedCount} for ${represented} group(s) of ${rep.playersPerGroup})`
        );
      }
      const leftover = options.playerOrganization?.leftover ?? 0;
      if (typeof rep.totalGroups === 'number' && typeof rep.playersPerGroup === 'number') {
        const accounted = rep.totalGroups * rep.playersPerGroup + leftover;
        if (accounted !== options.playerCount) {
          errors.push(
            `Representative metadata (${rep.totalGroups} groups * ${rep.playersPerGroup} players + ${leftover} leftover = ${accounted}) does not match exercise player count (${options.playerCount})`
          );
        }
      }
      if (options.playerOrganization) {
        if (rep.totalGroups !== options.playerOrganization.groups) {
          errors.push(
            `Representative totalGroups (${rep.totalGroups}) does not match exercise playerOrganization.groups (${options.playerOrganization.groups})`
          );
        }
        if (rep.playersPerGroup !== options.playerOrganization.playersPerGroup) {
          errors.push(
            `Representative playersPerGroup (${rep.playersPerGroup}) does not match exercise playerOrganization.playersPerGroup (${options.playerOrganization.playersPerGroup})`
          );
        }
      }
    }
  } else {
    // Mode is 'full': diagram.players.length must still match full player allocation
    const expectedTotal = options.playerCount;
    if (players.length !== expectedTotal) {
      errors.push(
        `Diagram player count (${players.length}) does not match exercise player allocation (${expectedTotal})`
      );
    }
  }

  // 2. Player grouping consistency
  const pOrg = options.playerOrganization;
  if (pOrg && pOrg.groups > 0 && pOrg.playersPerGroup > 0) {
    if (isRepGroup) {
      if (players.length === pOrg.playersPerGroup && pOrg.playersPerGroup === 2) {
        const clusters = clusterDiagramPlayers(players, 50);
        if (clusters.length !== 1 || clusters[0].length !== 2) {
          errors.push('Representative pair diagram must show exactly 1 pair');
        }
      }
    } else {
      if (pOrg.groups === 8 && pOrg.playersPerGroup === 2) {
        const clusters = clusterDiagramPlayers(players, 18);
        if (clusters.length !== 8 || clusters.some((c) => c.length !== 2)) {
          errors.push(
            `Drill organization specifies 8 groups of 2, but diagram does not show 8 distinct pairs (found ${clusters.length} clusters)`
          );
        }
      } else if (pOrg.groups === 4 && pOrg.playersPerGroup === 4) {
        const clusters = clusterDiagramPlayers(players, 20);
        if (clusters.length !== 4 || clusters.some((c) => c.length !== 4)) {
          errors.push(
            `Drill organization specifies 4 groups of 4, but diagram does not show 4 distinct groups (found ${clusters.length} clusters)`
          );
        }
      } else if (pOrg.groups === 2 && (options.blockType === 'match' || options.blockType === 'small_sided')) {
        const blueTeam = players.filter((p) => p.team === 'blue');
        const redTeam = players.filter((p) => p.team === 'red');
        if (blueTeam.length === 0 || redTeam.length === 0) {
          errors.push('Opposed drill diagram must separate players into two distinct teams');
        }
      }
    }
  }

  // 3. Goal count vs equipment
  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (!eqGoals.hasGoals && goals.length > 0) {
    errors.push(
      `Diagram contains ${goals.length} goal(s), but exercise equipment does not specify any goals`
    );
  } else if (eqGoals.hasGoals) {
    if (goals.length > eqGoals.totalExpected) {
      errors.push(
        `Diagram goal count (${goals.length}) exceeds specified equipment goals (${eqGoals.totalExpected})`
      );
    }
    if (eqGoals.isMini && goals.some((g) => g.type === 'standard')) {
      errors.push('Diagram contains standard match goals when equipment specifies mini goals');
    }
    if (!eqGoals.isMini && eqGoals.matchGoals > 0 && goals.some((g) => g.type === 'mini')) {
      errors.push('Diagram contains mini goals when equipment specifies match goals');
    }
  }

  // 4. Opposed / Unopposed consistency
  const opposed = isOpposedExercise(
    options.blockType || 'technical',
    options.organization,
    options.execution,
    options.playerOrganization
  );

  if (!opposed) {
    const redPlayers = players.filter((p) => p.team === 'red');
    if (redPlayers.length > 0) {
      errors.push('Unopposed exercise contains artificial opposing red players');
    }
  } else {
    const hasOpposition = players.some((p) => p.team === 'red' || p.team === 'neutral');
    if (!hasOpposition && players.length > 1) {
      errors.push(
        'Opposed exercise does not visually distinguish opposing teams (no red or neutral opponents)'
      );
    }
  }

  // 5. Tactical zones consistency
  const text = [options.organization || '', options.execution || ''].join(' ').toLowerCase();
  const mentionsLanes = /3 hành lang|ba hành lang|hành lang biên|channels|3 lanes/i.test(text);
  if (!mentionsLanes && zones.length > 0) {
    errors.push('Diagram contains tactical zones/lanes, but exercise does not describe them');
  }

  // 6. Path references
  const playerIds = new Set(players.map((p) => p.id));
  for (const path of paths) {
    if (!playerIds.has(path.fromPlayerId)) {
      errors.push(`Path '${path.id}' references non-existent fromPlayerId: '${path.fromPlayerId}'`);
    }
    if (path.toPlayerId && !playerIds.has(path.toPlayerId)) {
      errors.push(`Path '${path.id}' references non-existent toPlayerId: '${path.toPlayerId}'`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Builds a single representative pair diagram for repeated independent pair drills (TASK REP-A).
 * Contains only:
 * - 2 representative players (p1, p2)
 * - 1 local ball (b1)
 * - local cones (c1, c2)
 * - local path (p1 -> p2)
 * - representation metadata
 * - animation for that representative pair only
 */
export function buildRepresentativePairDiagram(
  count: number,
  options: BuildDiagramOptions
): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const pOrg = options.playerOrganization;
  const totalGroups = pOrg?.groups ?? Math.floor(count / 2);
  const playersPerGroup = pOrg?.playersPerGroup ?? 2;

  // Place the representative pair centrally and clearly
  const players: DiagramPlayer[] = [
    { id: 'p1', team: 'blue', role: 'passer', x: 32, y: 30 },
    { id: 'p2', team: 'blue', role: 'receiver', x: 68, y: 30 },
  ];

  const balls: DiagramBall[] = [
    { id: 'b1', x: 36, y: 30 },
  ];

  const cones: DiagramCone[] = [
    { id: 'c1', x: 50, y: 22 },
    { id: 'c2', x: 50, y: 38 },
  ];

  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = [];
  const paths: DiagramPath[] = [
    { id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' },
  ];

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(2, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i === 0 ? 10 : 90,
        y: 30,
        orientation: i === 0 ? 'left' : 'right',
      });
    }
  }

  const representation: DiagramRepresentation = {
    mode: 'representative-group',
    totalGroups,
    playersPerGroup,
    representedGroups: 1,
    label: `${totalGroups} cặp thực hiện đồng thời`,
  };

  const diag: StructuredDrillDiagram = {
    pitch,
    players,
    balls,
    cones,
    goals,
    zones,
    paths,
    representation,
    playerOrganization: pOrg || {
      groups: totalGroups,
      playersPerGroup,
      leftover: 0,
      leftoverRole: 'none',
    },
  };

  const contextText = [options.topic, options.exerciseName, options.execution].filter(Boolean).join(' ');
  diag.animation = buildSemanticAnimation(diag, contextText || options.execution);

  return diag;
}

export interface RepresentationDisplayLabel {
  primary: string;
  secondary?: string;
}

/**
 * Pure helper for deriving representation display label (TASK REP-B).
 * Derives:
 * - singular/plural group wording (2 => 'cặp', other => 'nhóm')
 * - representedGroups / totalGroups
 * - optional organization label
 * Prefer Vietnamese output.
 */
export function getRepresentationDisplayLabel(
  representation?: DiagramRepresentation | null
): RepresentationDisplayLabel | null {
  if (!representation || representation.mode !== 'representative-group') {
    return null;
  }

  const totalGroups = typeof representation.totalGroups === 'number' && representation.totalGroups > 0
    ? representation.totalGroups
    : 1;
  const represented = typeof representation.representedGroups === 'number' && representation.representedGroups > 0
    ? representation.representedGroups
    : 1;
  const ppg = typeof representation.playersPerGroup === 'number' && representation.playersPerGroup > 0
    ? representation.playersPerGroup
    : 2;

  const unit = ppg === 2 ? 'cặp' : 'nhóm';
  const primary = `Minh họa ${represented}/${totalGroups} ${unit}`;
  const secondary = representation.label && representation.label.trim().length > 0
    ? representation.label.trim()
    : `${totalGroups} ${unit} thực hiện đồng thời`;

  return {
    primary,
    secondary,
  };
}

/**
 * Builds a pairing diagram (e.g. 8 groups of 2).
 * Visually distinguishes all pairs across the pitch, all players on team 'blue', no artificial red opponents.
 */
function buildPairDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const pOrg = options.playerOrganization;
  const numPairs = pOrg && pOrg.playersPerGroup === 2 && pOrg.groups > 0
    ? pOrg.groups
    : Math.floor(count / 2);
  const remainder = pOrg?.leftover !== undefined
    ? pOrg.leftover
    : (count - numPairs * 2);

  const row1Count = numPairs > 4 ? Math.ceil(numPairs / 2) : numPairs;
  const row2Count = numPairs > 4 ? numPairs - row1Count : 0;

  // Local pair pattern offsets relative to station origin (cx, cy):
  // Upper and lower row share the exact same local pair geometry translated by origin offset
  const LOCAL_PAIR_OFFSETS = {
    passer: { dx: 0, dy: -7 },
    receiver: { dx: 0, dy: 7 },
    coneLeft: { dx: -6, dy: 0 },
    coneRight: { dx: 6, dy: 0 },
    ball: { dx: 0, dy: -3 },
  };

  // Station origins for each row
  const stationOrigins: DiagramCoordinate[] = [];
  for (let i = 0; i < row1Count; i++) {
    const cx = Math.round(16 + (i * 68) / Math.max(1, row1Count - 1));
    const cy = numPairs > 4 ? 24 : 50;
    stationOrigins.push({ x: cx, y: cy });
  }
  for (let i = 0; i < row2Count; i++) {
    const cx = Math.round(16 + (i * 68) / Math.max(1, row2Count - 1));
    const cy = 76;
    stationOrigins.push({ x: cx, y: cy });
  }

  let pIdx = 1;
  let coneIdx = 1;
  let ballIdx = 1;
  let pathIdx = 1;

  stationOrigins.forEach((origin) => {
    const idA = `p${pIdx++}`;
    const idB = `p${pIdx++}`;

    players.push(
      {
        id: idA,
        team: 'blue',
        role: 'passer',
        x: origin.x + LOCAL_PAIR_OFFSETS.passer.dx,
        y: origin.y + LOCAL_PAIR_OFFSETS.passer.dy,
      },
      {
        id: idB,
        team: 'blue',
        role: 'receiver',
        x: origin.x + LOCAL_PAIR_OFFSETS.receiver.dx,
        y: origin.y + LOCAL_PAIR_OFFSETS.receiver.dy,
      }
    );

    cones.push(
      {
        id: `c${coneIdx++}`,
        x: origin.x + LOCAL_PAIR_OFFSETS.coneLeft.dx,
        y: origin.y + LOCAL_PAIR_OFFSETS.coneLeft.dy,
      },
      {
        id: `c${coneIdx++}`,
        x: origin.x + LOCAL_PAIR_OFFSETS.coneRight.dx,
        y: origin.y + LOCAL_PAIR_OFFSETS.coneRight.dy,
      }
    );

    balls.push({
      id: `b${ballIdx++}`,
      x: origin.x + LOCAL_PAIR_OFFSETS.ball.dx,
      y: origin.y + LOCAL_PAIR_OFFSETS.ball.dy,
    });

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: idA,
      toPlayerId: idB,
    });
  });

  // Remainder player if odd or leftover
  for (let i = 0; i < remainder; i++) {
    const id = `p${pIdx++}`;
    const isJoker = pOrg?.leftoverRole === 'joker';
    players.push({
      id,
      team: isJoker ? 'neutral' : 'blue',
      role: isJoker ? 'joker' : 'rotation',
      x: 92,
      y: 50 + (i * 12),
    });
  }

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(4, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i < 2 ? 8 : 92,
        y: i % 2 === 0 ? 25 : 75,
        orientation: i < 2 ? 'left' : 'right',
      });
    }
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds a multi-station diagram for groups of 4 (e.g. 4 groups of 4 in 4 quadrants).
 */
function buildQuadStationDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const pOrg = options.playerOrganization;
  const numStations = pOrg && pOrg.playersPerGroup === 4 && pOrg.groups > 0
    ? pOrg.groups
    : Math.floor(count / 4);
  const remainder = pOrg?.leftover !== undefined
    ? pOrg.leftover
    : (count - numStations * 4);

  let stations: Array<{ cx: number; cy: number }> = [];
  if (numStations === 1) {
    stations = [{ cx: 50, cy: 50 }];
  } else if (numStations === 2) {
    stations = [{ cx: 28, cy: 50 }, { cx: 72, cy: 50 }];
  } else if (numStations === 3) {
    stations = [{ cx: 22, cy: 50 }, { cx: 50, cy: 50 }, { cx: 78, cy: 50 }];
  } else if (numStations === 4) {
    stations = [
      { cx: 26, cy: 26 },
      { cx: 74, cy: 26 },
      { cx: 26, cy: 74 },
      { cx: 74, cy: 74 },
    ];
  } else {
    const row1 = Math.ceil(numStations / 2);
    const row2 = numStations - row1;
    for (let i = 0; i < row1; i++) {
      stations.push({
        cx: Math.round(20 + (i * 60) / Math.max(1, row1 - 1)),
        cy: 28,
      });
    }
    for (let i = 0; i < row2; i++) {
      stations.push({
        cx: Math.round(20 + (i * 60) / Math.max(1, row2 - 1)),
        cy: 72,
      });
    }
  }

  let pIdx = 1;
  let coneIdx = 1;
  let pathIdx = 1;

  const isOpposed = isOpposedExercise(options.blockType, options.organization, options.execution, options.playerOrganization);

  stations.forEach((st, sIdx) => {
    // 4 cones for quadrant
    cones.push(
      { id: `c${coneIdx++}`, x: st.cx - 11, y: st.cy - 11 },
      { id: `c${coneIdx++}`, x: st.cx + 11, y: st.cy - 11 },
      { id: `c${coneIdx++}`, x: st.cx + 11, y: st.cy + 11 },
      { id: `c${coneIdx++}`, x: st.cx - 11, y: st.cy + 11 }
    );

    balls.push({ id: `b${sIdx + 1}`, x: st.cx, y: st.cy - 5 });

    const p1 = `p${pIdx++}`;
    const p2 = `p${pIdx++}`;
    const p3 = `p${pIdx++}`;
    const p4 = `p${pIdx++}`;

    players.push(
      { id: p1, team: 'blue', role: 'server', x: st.cx, y: st.cy - 8 },
      { id: p2, team: 'blue', role: 'receiver', x: st.cx + 8, y: st.cy },
      { id: p3, team: isOpposed ? 'red' : 'blue', role: isOpposed ? 'defender' : 'target', x: st.cx, y: st.cy + 8 },
      { id: p4, team: 'blue', role: 'support', x: st.cx - 8, y: st.cy }
    );

    paths.push(
      {
        id: `path${pathIdx++}`,
        type: 'pass',
        fromPlayerId: p1,
        toPlayerId: p2,
      },
      {
        id: `path${pathIdx++}`,
        type: 'movement',
        fromPlayerId: p2,
        toPlayerId: p3,
      }
    );
  });

  for (let i = 0; i < remainder; i++) {
    const id = `p${pIdx++}`;
    const isJoker = pOrg?.leftoverRole === 'joker';
    players.push({
      id,
      team: isJoker ? 'neutral' : 'blue',
      role: isJoker ? 'joker' : 'rotation',
      x: 50,
      y: 50 + (i * 10),
    });
  }

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(4, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i < 2 ? 8 : 92,
        y: i % 2 === 0 ? 25 : 75,
        orientation: i < 2 ? 'left' : 'right',
      });
    }
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds a multi-station diagram for groups of 3 (e.g. trios/triangles).
 */
function buildTrioStationDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const pOrg = options.playerOrganization;
  const numStations = pOrg && pOrg.playersPerGroup === 3 && pOrg.groups > 0
    ? pOrg.groups
    : Math.floor(count / 3);
  const remainder = pOrg?.leftover !== undefined
    ? pOrg.leftover
    : (count - numStations * 3);

  let stations: Array<{ cx: number; cy: number }> = [];
  if (numStations <= 3) {
    for (let i = 0; i < numStations; i++) {
      stations.push({
        cx: Math.round(24 + (i * 52) / Math.max(1, numStations - 1)),
        cy: 50,
      });
    }
  } else {
    const row1 = Math.ceil(numStations / 2);
    const row2 = numStations - row1;
    for (let i = 0; i < row1; i++) {
      stations.push({
        cx: Math.round(20 + (i * 60) / Math.max(1, row1 - 1)),
        cy: 28,
      });
    }
    for (let i = 0; i < row2; i++) {
      stations.push({
        cx: Math.round(20 + (i * 60) / Math.max(1, row2 - 1)),
        cy: 72,
      });
    }
  }

  let pIdx = 1;
  let coneIdx = 1;
  let pathIdx = 1;

  stations.forEach((st, sIdx) => {
    cones.push(
      { id: `c${coneIdx++}`, x: st.cx, y: st.cy - 10 },
      { id: `c${coneIdx++}`, x: st.cx + 9, y: st.cy + 7 },
      { id: `c${coneIdx++}`, x: st.cx - 9, y: st.cy + 7 }
    );

    balls.push({ id: `b${sIdx + 1}`, x: st.cx, y: st.cy - 4 });

    const p1 = `p${pIdx++}`;
    const p2 = `p${pIdx++}`;
    const p3 = `p${pIdx++}`;

    players.push(
      { id: p1, team: 'blue', role: 'server', x: st.cx, y: st.cy - 7 },
      { id: p2, team: 'blue', role: 'receiver', x: st.cx + 7, y: st.cy + 5 },
      { id: p3, team: 'blue', role: 'support', x: st.cx - 7, y: st.cy + 5 }
    );

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: p1,
      toPlayerId: p2,
    });
  });

  for (let i = 0; i < remainder; i++) {
    const id = `p${pIdx++}`;
    players.push({
      id,
      team: 'blue',
      role: 'rotation',
      x: 92,
      y: 50 + (i * 10),
    });
  }

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(4, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i < 2 ? 8 : 92,
        y: i % 2 === 0 ? 25 : 75,
        orientation: i < 2 ? 'left' : 'right',
      });
    }
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds an opposed skill drill diagram (e.g. Phase 3 rondo / possession).
 * Strictly omits mini goals if equipment does not specify them.
 */
function buildSkillDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const pOrg = options.playerOrganization;
  const isJokerSupported = pOrg?.leftoverRole === 'joker' && (pOrg.leftover ?? 0) > 0;
  const jokers = isJokerSupported && typeof pOrg?.leftover === 'number' ? pOrg.leftover : 0;
  const outfield = count - jokers;
  const teamSize = Math.floor(outfield / 2);
  const extraBlue = outfield % 2;

  // Boundary grid cones
  cones.push(
    { id: 'c1', x: 18, y: 15 },
    { id: 'c2', x: 82, y: 15 },
    { id: 'c3', x: 82, y: 85 },
    { id: 'c4', x: 18, y: 85 }
  );

  balls.push({ id: 'b1', x: 45, y: 50 });

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];

  const blueCount = teamSize + extraBlue;
  const redCount = teamSize;

  // Blue team (possession / attackers around and inside grid)
  for (let i = 0; i < blueCount; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 22 + Math.round((i * 56) / Math.max(1, blueCount - 1));
    const y = i % 2 === 0 ? 24 : 76;
    players.push({ id, team: 'blue', role: 'attacker', x, y });
  }

  // Red team (defenders / pressers inside grid)
  for (let i = 0; i < redCount; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 32 + Math.round((i * 36) / Math.max(1, redCount - 1));
    const y = 44 + (i % 2 === 0 ? -8 : 8);
    players.push({ id, team: 'red', role: 'defender', x, y });
  }

  for (let i = 0; i < jokers; i++) {
    const id = `p${pIdx++}`;
    players.push({ id, team: 'neutral', role: 'joker', x: 50, y: 50 + (i * 10) });
  }

  if (blueIds.length >= 2) {
    paths.push({
      id: 'path1',
      type: 'pass',
      fromPlayerId: blueIds[0],
      toPlayerId: blueIds[1],
    });
  }
  if (redIds.length >= 1 && blueIds.length >= 1) {
    paths.push({
      id: 'path2',
      type: 'movement',
      fromPlayerId: redIds[0],
      toPlayerId: blueIds[0],
    });
  }

  // ONLY add goals if explicitly specified by equipment
  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals) {
    if (eqGoals.isMini) {
      const gCount = Math.min(4, eqGoals.miniGoals);
      for (let i = 0; i < gCount; i++) {
        goals.push({
          id: `g${i + 1}`,
          type: 'mini',
          x: i < 2 ? 10 : 90,
          y: i % 2 === 0 ? 25 : 75,
          orientation: i < 2 ? 'left' : 'right',
        });
      }
    } else {
      goals.push(
        { id: 'g1', type: 'standard', x: 5, y: 50, orientation: 'left' },
        { id: 'g2', type: 'standard', x: 95, y: 50, orientation: 'right' }
      );
    }
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds a small-sided game diagram (e.g. Phase 4).
 * Shows exactly 4 mini goals if specified in equipment, and tactical zones if described.
 */
function buildSmallSidedDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const pOrg = options.playerOrganization;
  const isJokerSupported = pOrg?.leftoverRole === 'joker' && (pOrg.leftover ?? 0) > 0;
  const jokers = isJokerSupported && typeof pOrg?.leftover === 'number' ? pOrg.leftover : 0;
  const outfield = count - jokers;
  const perTeam = Math.floor(outfield / 2);
  const extraBlue = outfield % 2;

  // Synchronize goals from equipment
  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    const gCount = eqGoals.miniGoals >= 4 ? 4 : (eqGoals.miniGoals || 2);
    if (gCount === 4) {
      goals.push(
        { id: 'g1', type: 'mini', x: 8, y: 20, orientation: 'left' },
        { id: 'g2', type: 'mini', x: 8, y: 80, orientation: 'left' },
        { id: 'g3', type: 'mini', x: 92, y: 20, orientation: 'right' },
        { id: 'g4', type: 'mini', x: 92, y: 80, orientation: 'right' }
      );
    } else {
      goals.push(
        { id: 'g1', type: 'mini', x: 8, y: 50, orientation: 'left' },
        { id: 'g2', type: 'mini', x: 92, y: 50, orientation: 'right' }
      );
    }
  } else if (eqGoals.hasGoals && !eqGoals.isMini) {
    goals.push(
      { id: 'g1', type: 'standard', x: 4, y: 50, orientation: 'left' },
      { id: 'g2', type: 'standard', x: 96, y: 50, orientation: 'right' }
    );
  }

  // Pitch boundary cones
  cones.push(
    { id: 'c1', x: 12, y: 10 },
    { id: 'c2', x: 88, y: 10 },
    { id: 'c3', x: 12, y: 90 },
    { id: 'c4', x: 88, y: 90 }
  );

  balls.push({ id: 'b1', x: 50, y: 50 });

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];
  const blueCount = perTeam + extraBlue;
  const redCount = perTeam;

  for (let i = 0; i < blueCount; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 20 + Math.round((i * 26) / Math.max(1, blueCount - 1));
    const y = 18 + Math.round((i * 64) / Math.max(1, blueCount - 1));
    players.push({ id, team: 'blue', role: i === 0 ? 'defender' : 'attacker', x, y });
  }

  for (let i = 0; i < redCount; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 54 + Math.round((i * 26) / Math.max(1, redCount - 1));
    const y = 18 + Math.round((i * 64) / Math.max(1, redCount - 1));
    players.push({ id, team: 'red', role: i === redCount - 1 ? 'defender' : 'attacker', x, y });
  }

  for (let i = 0; i < jokers; i++) {
    players.push({ id: `p${pIdx++}`, team: 'neutral', role: 'joker', x: 50, y: 50 + (i * 10) });
  }

  if (blueIds.length >= 2) {
    paths.push({
      id: 'path1',
      type: 'pass',
      fromPlayerId: blueIds[0],
      toPlayerId: blueIds[1],
    });
  }
  if (redIds.length >= 2) {
    paths.push({
      id: 'path2',
      type: 'movement',
      fromPlayerId: redIds[0],
      toPlayerId: redIds[1],
    });
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds a match diagram (Phase 5).
 * Shows exactly 2 match goals, separates teams, 2 GKs.
 */
function buildMatchDiagram(count: number, options: BuildDiagramOptions): StructuredDrillDiagram {
  const pitch: DiagramPitch = { width: 100, height: 60 };
  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const zones: DiagramZone[] = detectTacticalZones(options.organization, options.execution, options.equipment);
  const paths: DiagramPath[] = [];

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals || options.blockType === 'match') {
    goals.push(
      { id: 'g1', type: 'standard', x: 4, y: 50, orientation: 'left' },
      { id: 'g2', type: 'standard', x: 96, y: 50, orientation: 'right' }
    );
  }

  balls.push({ id: 'b1', x: 50, y: 50 });

  cones.push(
    { id: 'c1', x: 50, y: 5 },
    { id: 'c2', x: 50, y: 95 }
  );

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];

  // 2 GKs
  players.push({ id: `p${pIdx++}`, team: 'goalkeeper', role: 'goalkeeper', x: 7, y: 50 });
  players.push({ id: `p${pIdx++}`, team: 'goalkeeper', role: 'goalkeeper', x: 93, y: 50 });

  const outfield = Math.max(0, count - 2);
  const pOrg = options.playerOrganization;
  const isJokerSupported = pOrg?.leftoverRole === 'joker' && (pOrg.leftover ?? 0) > 0;
  const jokers = isJokerSupported && typeof pOrg?.leftover === 'number' ? pOrg.leftover : (outfield % 2 === 1 ? 1 : 0);
  const perSide = Math.floor((outfield - jokers) / 2);
  const extraBlue = (outfield - jokers) % 2;

  const blueCount = perSide + extraBlue;
  const redCount = perSide;

  // Blue outfield
  for (let i = 0; i < blueCount; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 20 + Math.round((i * 26) / Math.max(1, blueCount - 1));
    const y = 16 + Math.round((i * 68) / Math.max(1, blueCount - 1));
    players.push({ id, team: 'blue', role: i < blueCount / 2 ? 'defender' : 'midfielder', x, y });
  }

  // Red outfield
  for (let i = 0; i < redCount; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 54 + Math.round((i * 26) / Math.max(1, redCount - 1));
    const y = 16 + Math.round((i * 68) / Math.max(1, redCount - 1));
    players.push({ id, team: 'red', role: i >= redCount / 2 ? 'defender' : 'attacker', x, y });
  }

  for (let i = 0; i < jokers; i++) {
    players.push({ id: `p${pIdx++}`, team: 'neutral', role: 'joker', x: 50, y: 50 + (i * 10) });
  }

  if (blueIds.length >= 2) {
    paths.push({
      id: 'path1',
      type: 'pass',
      fromPlayerId: blueIds[0],
      toPlayerId: blueIds[1],
    });
  }
  if (redIds.length >= 2) {
    paths.push({
      id: 'path2',
      type: 'movement',
      fromPlayerId: redIds[0],
      toPlayerId: redIds[1],
    });
  }

  return { pitch, players, balls, cones, goals, zones, paths };
}

/**
 * Builds a semantically consistent StructuredDrillDiagram driven by actual exercise metadata.
 * Does not use a generic hardcoded layout if it contradicts drill organization or equipment.
 */
export function buildDefaultStructuredDiagram(options: BuildDiagramOptions): StructuredDrillDiagram {
  const count = Math.max(4, Math.min(50, Math.round(options.playerCount || 16)));
  const pOrg = options.playerOrganization;
  const orgText = [options.organization || '', options.exerciseName || ''].join(' ').toLowerCase();

  const isExplicitPairs =
    (pOrg && pOrg.playersPerGroup === 2 && pOrg.groups >= 2) ||
    /8 nhóm 2|nhóm 2 người|chia thành \d+ cặp|8 cặp|từng cặp|8 groups of 2|groups of 2|cặp đối diện/i.test(orgText);

  const isExplicitQuads =
    (pOrg && pOrg.playersPerGroup === 4 && pOrg.groups >= 2) ||
    /4 nhóm 4|groups of 4|4 trạm|nhóm 4 người/i.test(orgText);

  const isExplicitTrios =
    (pOrg && pOrg.playersPerGroup === 3 && pOrg.groups >= 2) ||
    /nhóm 3 người|groups of 3|tổ tam giác|trạm 3 người/i.test(orgText);

  const repMode = options.representationMode;
  const isRepresentative =
    repMode === 'representative-group' ||
    (repMode !== 'full' && Boolean(options.preferRepresentative) && shouldUseRepresentativeGroup(options));

  // 1. Match phase takes precedence for match
  let diag: StructuredDrillDiagram;
  if (options.blockType === 'match' || /thi đấu \d+v\d+|trận đấu \d+v\d+/i.test(orgText)) {
    diag = buildMatchDiagram(count, options);
  } else if (options.blockType === 'small_sided') {
    // 2. Small-sided game takes precedence for small_sided
    diag = buildSmallSidedDiagram(count, options);
  } else if (isRepresentative && (isExplicitPairs || (pOrg && pOrg.playersPerGroup === 2))) {
    // Representative pair mode applies
    diag = buildRepresentativePairDiagram(count, options);
  } else if (isExplicitPairs) {
    // 3. Stated grouping takes precedence over default drill layout
    diag = buildPairDiagram(count, options);
  } else if (isExplicitQuads) {
    diag = buildQuadStationDiagram(count, options);
  } else if (isExplicitTrios) {
    diag = buildTrioStationDiagram(count, options);
  } else if (options.blockType === 'skill') {
    // 4. Fallback based on blockType and organization
    diag = buildSkillDiagram(count, options);
  } else if (options.blockType === 'warm_up') {
    diag = isRepresentative ? buildRepresentativePairDiagram(count, options) : buildPairDiagram(count, options);
  } else if (options.blockType === 'technical') {
    if (pOrg?.playersPerGroup === 2) {
      diag = isRepresentative ? buildRepresentativePairDiagram(count, options) : buildPairDiagram(count, options);
    } else if (pOrg?.playersPerGroup === 3) diag = buildTrioStationDiagram(count, options);
    else diag = buildQuadStationDiagram(count, options);
  } else {
    diag = buildQuadStationDiagram(count, options);
  }

  const contextText = [options.topic, options.exerciseName, options.execution].filter(Boolean).join(' ');

  return {
    ...diag,
    animation: diag.animation || buildSemanticAnimation(diag, contextText || options.execution),
  };
}

/**
 * Sanitizes an incoming diagram. If both technical and semantic validation pass, returns cleaned diagram.
 * If technical or semantic validation fails, rebuilds a safe conforming default diagram matching the exercise.
 */
export function safeStructuredDiagram(
  diagram: unknown,
  availablePlayers: number,
  fallbackOptions: BuildDiagramOptions
): StructuredDrillDiagram {
  const technicalRes = validateStructuredDiagram(diagram, availablePlayers);
  if (technicalRes.ok && diagram && typeof diagram === 'object') {
    const d = diagram as StructuredDrillDiagram;
    const semanticRes = validateSemanticDiagram(d, {
      playerCount: availablePlayers,
      playerOrganization: fallbackOptions.playerOrganization,
      equipment: fallbackOptions.equipment,
      organization: fallbackOptions.organization,
      execution: fallbackOptions.execution,
      blockType: fallbackOptions.blockType,
    });

    if (semanticRes.ok) {
      const sanitizedMoments = d.animation?.coachingMoments
        ? filterValidCoachingMoments(
            d.animation.coachingMoments,
            new Set(d.players.map((p) => p.id)),
            d.animation.duration
          )
        : undefined;

      const sanitizedSequence = d.animation?.coachingSequence && sanitizedMoments
        ? sanitizeCoachingSequence(d.animation.coachingSequence, sanitizedMoments)
        : undefined;

      return {
        pitch: {
          width: typeof d.pitch?.width === 'number' && d.pitch.width > 0 ? d.pitch.width : 100,
          height: typeof d.pitch?.height === 'number' && d.pitch.height > 0 ? d.pitch.height : 60,
        },
        players: d.players.map((p, idx) => ({
          id: p.id || `p${idx + 1}`,
          team: p.team,
          role: p.role,
          x: Math.max(0, Math.min(100, p.x)),
          y: Math.max(0, Math.min(100, p.y)),
        })),
        balls: Array.isArray(d.balls)
          ? d.balls.map((b, idx) => ({
              id: b.id || `b${idx + 1}`,
              x: Math.max(0, Math.min(100, b.x)),
              y: Math.max(0, Math.min(100, b.y)),
            }))
          : [],
        cones: Array.isArray(d.cones)
          ? d.cones.map((c, idx) => ({
              id: c.id || `c${idx + 1}`,
              x: Math.max(0, Math.min(100, c.x)),
              y: Math.max(0, Math.min(100, c.y)),
            }))
          : [],
        goals: Array.isArray(d.goals)
          ? d.goals.map((g, idx) => ({
              id: g.id || `g${idx + 1}`,
              type: g.type || 'mini',
              x: Math.max(0, Math.min(100, g.x)),
              y: Math.max(0, Math.min(100, g.y)),
              orientation: g.orientation || 'left',
            }))
          : [],
        zones: Array.isArray(d.zones) ? d.zones : [],
        paths: Array.isArray(d.paths)
          ? d.paths.map((p, idx) => ({
              id: p.id || `path${idx + 1}`,
              type: p.type,
              fromPlayerId: p.fromPlayerId,
              toPlayerId: p.toPlayerId,
            }))
          : [],
        animation: d.animation
          ? {
              duration: d.animation.duration,
              steps: d.animation.steps,
              coachingMoments: sanitizedMoments,
              coachingSequence: sanitizedSequence,
            }
          : buildSemanticAnimation(d, fallbackOptions.execution),
        representation: d.representation
          ? {
              mode: d.representation.mode,
              totalGroups: d.representation.totalGroups,
              playersPerGroup: d.representation.playersPerGroup,
              representedGroups: d.representation.representedGroups,
              label: d.representation.label,
            }
          : undefined,
        playerOrganization: d.playerOrganization
          ? { ...d.playerOrganization }
          : fallbackOptions.playerOrganization
            ? { ...fallbackOptions.playerOrganization }
            : undefined,
      };
    }
  }

  const effectiveFallbackOptions: BuildDiagramOptions = {
    ...fallbackOptions,
    representationMode:
      fallbackOptions.representationMode ??
      ((diagram as any)?.representation?.mode === 'representative-group' ? 'representative-group' : undefined),
  };
  return buildDefaultStructuredDiagram(effectiveFallbackOptions);
}

export interface ResolvedPath {
  id: string;
  type: 'pass' | 'movement' | 'dribble';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Resolves path coordinates by referencing players from the diagram player map.
 * Returns null if player references are missing or invalid.
 */
export function resolvePathCoordinates(
  path: DiagramPath,
  playerMap: Map<string, DiagramPlayer>,
  toX: (pct: number) => number,
  toY: (pct: number) => number,
  playerRadius = 18
): ResolvedPath | null {
  if (!path || typeof path !== 'object') return null;
  const from = playerMap.get(path.fromPlayerId);
  const to = path.toPlayerId ? playerMap.get(path.toPlayerId) : undefined;
  if (!from || !to) return null;
  if (typeof from.x !== 'number' || typeof from.y !== 'number' || typeof to.x !== 'number' || typeof to.y !== 'number') {
    return null;
  }

  const fromX = toX(from.x);
  const fromY = toY(from.y);
  const toXPos = toX(to.x);
  const toYPos = toY(to.y);

  const dx = toXPos - fromX;
  const dy = toYPos - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < playerRadius) {
    return null;
  }

  const offsetStart = playerRadius + 3;
  const offsetEnd = playerRadius + 6;

  const startX = fromX + (dx / dist) * Math.min(offsetStart, dist / 3);
  const startY = fromY + (dy / dist) * Math.min(offsetStart, dist / 3);
  const endX = toXPos - (dx / dist) * Math.min(offsetEnd, dist / 3);
  const endY = toYPos - (dy / dist) * Math.min(offsetEnd, dist / 3);

  const pathType = (['pass', 'movement', 'dribble'] as const).includes(path.type) ? path.type : 'pass';

  return {
    id: path.id,
    type: pathType,
    fromX,
    fromY,
    toX: toXPos,
    toY: toYPos,
    startX,
    startY,
    endX,
    endY,
  };
}

export function buildWavyPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  waveCount = 4,
  amplitude = 5
): string {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) return `M ${startX} ${startY} L ${endX} ${endY}`;

  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;

  const count = Math.max(2, Math.min(8, waveCount));
  let d = `M ${startX.toFixed(1)} ${startY.toFixed(1)}`;

  for (let i = 0; i < count; i++) {
    const tMid = (i + 0.5) / count;
    const tEnd = (i + 1) / count;
    const sign = i % 2 === 0 ? 1 : -1;

    const midX = startX + ux * (dist * tMid) + nx * (amplitude * sign);
    const midY = startY + uy * (dist * tMid) + ny * (amplitude * sign);
    const pEndX = startX + ux * (dist * tEnd);
    const pEndY = startY + uy * (dist * tEnd);

    d += ` Q ${midX.toFixed(1)} ${midY.toFixed(1)}, ${pEndX.toFixed(1)} ${pEndY.toFixed(1)}`;
  }
  return d;
}

export interface GoalGeometry {
  id: string;
  type: string;
  isMini: boolean;
  orientation: 'left' | 'right' | 'top' | 'bottom';
  x: number;
  y: number;
  pathD: string;
  netD: string;
}

export function getGoalGeometry(
  goal: DiagramGoal,
  toX: (pct: number) => number,
  toY: (pct: number) => number
): GoalGeometry {
  const isMini = goal.type === 'mini';
  const width = isMini ? 34 : 76;
  const depth = isMini ? 12 : 20;

  const gx = toX(goal.x);
  const gy = toY(goal.y);

  let orientation: 'left' | 'right' | 'top' | 'bottom' = 'left';
  if (goal.orientation === 'right' || goal.orientation === 'top' || goal.orientation === 'bottom') {
    orientation = goal.orientation;
  }

  let pathD = '';
  let netD = '';

  switch (orientation) {
    case 'left': {
      const topY = gy - width / 2;
      const botY = gy + width / 2;
      const backX = gx - depth;
      pathD = `M ${gx} ${topY} L ${backX} ${topY} L ${backX} ${botY} L ${gx} ${botY}`;
      netD = `M ${backX} ${topY + width * 0.33} L ${gx} ${topY + width * 0.33} M ${backX} ${topY + width * 0.66} L ${gx} ${topY + width * 0.66}`;
      break;
    }
    case 'right': {
      const topY = gy - width / 2;
      const botY = gy + width / 2;
      const backX = gx + depth;
      pathD = `M ${gx} ${topY} L ${backX} ${topY} L ${backX} ${botY} L ${gx} ${botY}`;
      netD = `M ${gx} ${topY + width * 0.33} L ${backX} ${topY + width * 0.33} M ${gx} ${topY + width * 0.66} L ${backX} ${topY + width * 0.66}`;
      break;
    }
    case 'top': {
      const leftX = gx - width / 2;
      const rightX = gx + width / 2;
      const backY = gy - depth;
      pathD = `M ${leftX} ${gy} L ${leftX} ${backY} L ${rightX} ${backY} L ${rightX} ${gy}`;
      netD = `M ${leftX + width * 0.33} ${backY} L ${leftX + width * 0.33} ${gy} M ${leftX + width * 0.66} ${backY} L ${leftX + width * 0.66} ${gy}`;
      break;
    }
    case 'bottom': {
      const leftX = gx - width / 2;
      const rightX = gx + width / 2;
      const backY = gy + depth;
      pathD = `M ${leftX} ${gy} L ${leftX} ${backY} L ${rightX} ${backY} L ${rightX} ${gy}`;
      netD = `M ${leftX + width * 0.33} ${gy} L ${leftX + width * 0.33} ${backY} M ${leftX + width * 0.66} ${gy} L ${leftX + width * 0.66} ${backY}`;
      break;
    }
  }

  return {
    id: goal.id,
    type: goal.type,
    isMini,
    orientation,
    x: gx,
    y: gy,
    pathD,
    netD,
  };
}

export interface TeamStyle {
  fill: string;
  stroke: string;
  text: string;
  label: string;
}

export function getTeamStyle(team: DiagramTeam): TeamStyle {
  switch (team) {
    case 'blue':
      return {
        fill: '#2563eb', // Royal Blue
        stroke: '#ffffff',
        text: '#ffffff',
        label: 'Đội Xanh',
      };
    case 'red':
      return {
        fill: '#dc2626', // Crimson Red
        stroke: '#ffffff',
        text: '#ffffff',
        label: 'Đội Đỏ',
      };
    case 'neutral':
      return {
        fill: '#f59e0b', // Amber / Joker
        stroke: '#78350f',
        text: '#451a03',
        label: 'Tự do / Joker',
      };
    case 'goalkeeper':
      return {
        fill: '#10b981', // Emerald GK
        stroke: '#ffffff',
        text: '#ffffff',
        label: 'Thủ môn',
      };
    default:
      return {
        fill: '#3b82f6',
        stroke: '#ffffff',
        text: '#ffffff',
        label: 'Cầu thủ',
      };
  }
}
