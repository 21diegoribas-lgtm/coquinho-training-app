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
  DiagramCone,
  DiagramCoordinate,
  DiagramGoal,
  DiagramPath,
  DiagramPitch,
  DiagramPlayer,
  DiagramTeam,
  DiagramZone,
  ExercisePlayerOrganization,
  GameFormat,
  PlayerMoveAction,
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
 * Calculates current visual presentation phase and continuous easing factors for camera, text, and highlight.
 * Timing allocation within coachingMoment.duration:
 * - enter: ~25% (progress 0.00 -> 0.25)
 * - hold:  ~50% (progress 0.25 -> 0.75)
 * - exit:  ~25% (progress 0.75 -> 1.00)
 */
export function getCoachingPhaseState(
  elapsed: number,
  duration: number
): CoachingPhaseState {
  const safeDuration = Math.max(0.1, duration);
  const progress = Math.max(0, Math.min(1, elapsed / safeDuration));

  const ENTER_END = 0.25;
  const HOLD_END = 0.75;

  if (progress < ENTER_END) {
    const phaseProgress = progress / ENTER_END;
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

  if (progress <= HOLD_END) {
    const phaseProgress = (progress - ENTER_END) / (HOLD_END - ENTER_END);
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

  // Exit phase (0.75 -> 1.00)
  const phaseProgress = (progress - HOLD_END) / (1 - HOLD_END);
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

    seenIds.add(id);
    valid.push({
      id,
      time,
      duration,
      playerId,
      title,
      text,
      focus: { zoom },
      highlight,
      orientation,
    });
  }

  return valid;
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
  const moments: DiagramCoachingMoment[] = [];
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

  // Find pass actions to place the coaching moment on the receiver
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];
    const passAction = step.actions.find((a) => a.type === 'ballPass') as BallPassAction | undefined;
    if (passAction && passAction.toPlayerId) {
      const receivingPlayerId = passAction.toPlayerId;
      const receiverPlayer = playerMap.get(receivingPlayerId);
      const receiverPos = receiverPlayer ? { x: receiverPlayer.x, y: receiverPlayer.y } : { x: 50, y: 30 };

      // Trigger ~75% through the pass travel (shortly before ball reaches receiver)
      const targetTrigger = Math.round((step.start + step.duration * 0.75) * 10) / 10;
      const maxMomentDuration = Math.max(0.5, Math.round((animDuration - targetTrigger) * 10) / 10);
      const momentDuration = Math.min(2.5, maxMomentDuration);
      const triggerTime = Math.min(targetTrigger, Math.max(0, Math.round((animDuration - momentDuration) * 10) / 10));

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

      // 3. Compute geometric orientation toward next target or use existing sensible fallback (45°)
      let orientation = 45;
      if (nextTargetPos) {
        orientation = calculateOrientationFromNextAction(receiverPos, nextTargetPos);
      }

      let title = 'Mở thân người';
      let text = 'Kiểm tra vai trước khi nhận và mở thân người về hướng tấn công.';

      if (/bước một|định hướng|không gian trống/i.test(textContext)) {
        title = 'Chạm bước một định hướng';
        text = 'Mở góc đón bóng bằng chân xa, định hướng bóng về không gian trống phía trước.';
      } else if (/quan sát|kiểm tra vai|scan/i.test(textContext)) {
        title = 'Kiểm tra vai & Mở thân';
        text = 'Quay đầu kiểm tra vai trước khi nhận bóng để chọn hướng mở thân người thuận lợi.';
      }

      if (triggerTime + momentDuration <= animDuration) {
        moments.push({
          id: `coach-${moments.length + 1}`,
          time: triggerTime,
          duration: momentDuration,
          playerId: receivingPlayerId,
          title,
          text,
          focus: { zoom: 1.8 },
          highlight: true,
          orientation,
        });
      }

      if (moments.length >= 2) break;
    }
  }

  // Fallback demo coaching moment if no ballPass found but players exist
  if (moments.length === 0 && Array.isArray(diagram.players) && diagram.players.length >= 2) {
    const p1 = diagram.players[0];
    const p2 = diagram.players[1];
    const momentDuration = Math.min(2.5, Math.max(0.5, Math.round(animDuration * 0.35 * 10) / 10));
    const triggerTime = Math.min(1.0, Math.max(0, Math.round((animDuration - momentDuration) * 10) / 10));
    const orientation = calculateOrientationFromNextAction(p2, { x: Math.min(90, p2.x + 20), y: p2.y });

    moments.push({
      id: 'coach-1',
      time: triggerTime,
      duration: momentDuration,
      playerId: p2.id,
      title: 'Mở thân người',
      text: 'Kiểm tra vai trước khi nhận và mở thân người về hướng tấn công.',
      focus: { zoom: 1.8 },
      highlight: true,
      orientation,
    });
  }

  // Enforce no overlaps and chronological spacing (TASK D6)
  return resolveCoachingMomentOverlaps(moments, 1.5);
}

/**
 * Interpolates player and ball positions at any time t (in seconds) during playback.
 * At currentTime <= 0 or when stopped/reset: returns exact initial positions from diagram.players & diagram.balls.
 * Only action types playerMove, ballPass, and ballDribble are evaluated.
 */
export function interpolateAnimationState(
  diagram: StructuredDrillDiagram,
  currentTime: number
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
  const playerPositions = new Map<string, { x: number; y: number }>();
  basePlayers.forEach((p) => {
    playerPositions.set(p.id, { x: p.x, y: p.y });
  });

  const ballPositions = new Map<string, { x: number; y: number }>();
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
    const progress = isFinished ? 1 : Math.max(0, Math.min(1, (t - stepStart) / stepDuration));

    const snapshotPlayers = new Map(playerPositions);
    const snapshotBalls = new Map(ballPositions);

    if (Array.isArray(step.actions)) {
      for (const action of step.actions) {
        if (action.type === 'playerMove') {
          const startPos = snapshotPlayers.get(action.playerId);
          if (startPos && action.to) {
            const currX = startPos.x + (action.to.x - startPos.x) * progress;
            const currY = startPos.y + (action.to.y - startPos.y) * progress;
            playerPositions.set(action.playerId, { x: currX, y: currY });
          }
        } else if (action.type === 'ballPass') {
          const fromPos = snapshotPlayers.get(action.fromPlayerId);
          const toPos = snapshotPlayers.get(action.toPlayerId);
          if (fromPos && toPos) {
            const currX = fromPos.x + (toPos.x - fromPos.x) * progress;
            const currY = fromPos.y + (toPos.y - fromPos.y) * progress;
            ballPositions.set(action.ballId, { x: currX, y: currY });
          }
        } else if (action.type === 'ballDribble') {
          const startPos = snapshotPlayers.get(action.playerId);
          if (startPos && action.to) {
            const currX = startPos.x + (action.to.x - startPos.x) * progress;
            const currY = startPos.y + (action.to.y - startPos.y) * progress;
            playerPositions.set(action.playerId, { x: currX, y: currY });
            ballPositions.set(action.ballId, { x: currX, y: currY });
          }
        }
      }
    }
  }

  const updatedPlayers = basePlayers.map((p) => {
    const pos = playerPositions.get(p.id);
    let orientation = p.orientation;
    if (anim.coachingMoments && Array.isArray(anim.coachingMoments)) {
      for (const m of anim.coachingMoments) {
        if (m.playerId === p.id && m.orientation !== undefined && currentTime >= m.time) {
          orientation = m.orientation;
        }
      }
    }
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

/**
 * Builds a clear, semantically grounded demonstration animation sequence
 * from the diagram's action paths, players, and balls.
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

  // Translate paths into ordered demonstration animation steps
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

  const duration = Math.max(2, Math.round(currentTime * 10) / 10);
  const coachingMoments = buildSemanticCoachingMoments(
    { ...diagram, animation: { duration, steps } },
    execution
  );
  return { duration, steps, coachingMoments };
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
}

export interface SemanticValidationOptions {
  playerCount: number;
  playerOrganization?: ExercisePlayerOrganization;
  equipment?: string[];
  organization?: string;
  execution?: string;
  blockType?: BlockType;
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
  const expectedTotal = options.playerCount;
  if (players.length !== expectedTotal) {
    errors.push(
      `Diagram player count (${players.length}) does not match exercise player allocation (${expectedTotal})`
    );
  }

  // 2. Player grouping consistency
  const pOrg = options.playerOrganization;
  if (pOrg && pOrg.groups > 0 && pOrg.playersPerGroup > 0) {
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

  let pIdx = 1;
  let coneIdx = 1;
  let ballIdx = 1;
  let pathIdx = 1;

  // Row 1: spacing pairs with dy=14 within pair, dx >= 22 between pairs
  for (let i = 0; i < row1Count; i++) {
    const cx = Math.round(16 + (i * 68) / Math.max(1, row1Count - 1));
    const cy = numPairs > 4 ? 24 : 50;

    const idA = `p${pIdx++}`;
    const idB = `p${pIdx++}`;

    players.push(
      { id: idA, team: 'blue', role: 'passer', x: cx, y: cy - 7 },
      { id: idB, team: 'blue', role: 'receiver', x: cx, y: cy + 7 }
    );

    cones.push(
      { id: `c${coneIdx++}`, x: cx - 6, y: cy },
      { id: `c${coneIdx++}`, x: cx + 6, y: cy }
    );

    balls.push({ id: `b${ballIdx++}`, x: cx, y: cy - 3 });

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: idA,
      toPlayerId: idB,
    });
  }

  // Row 2
  for (let i = 0; i < row2Count; i++) {
    const cx = Math.round(16 + (i * 68) / Math.max(1, row2Count - 1));
    const cy = 76;

    const idA = `p${pIdx++}`;
    const idB = `p${pIdx++}`;

    players.push(
      { id: idA, team: 'blue', role: 'passer', x: cx, y: cy - 7 },
      { id: idB, team: 'blue', role: 'receiver', x: cx, y: cy + 7 }
    );

    cones.push(
      { id: `c${coneIdx++}`, x: cx - 6, y: cy },
      { id: `c${coneIdx++}`, x: cx + 6, y: cy }
    );

    balls.push({ id: `b${ballIdx++}`, x: cx, y: cy - 3 });

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: idA,
      toPlayerId: idB,
    });
  }

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

  // 1. Match phase takes precedence for match
  let diag: StructuredDrillDiagram;
  if (options.blockType === 'match' || /thi đấu \d+v\d+|trận đấu \d+v\d+/i.test(orgText)) {
    diag = buildMatchDiagram(count, options);
  } else if (options.blockType === 'small_sided') {
    // 2. Small-sided game takes precedence for small_sided
    diag = buildSmallSidedDiagram(count, options);
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
    diag = buildPairDiagram(count, options);
  } else if (options.blockType === 'technical') {
    if (pOrg?.playersPerGroup === 2) diag = buildPairDiagram(count, options);
    else if (pOrg?.playersPerGroup === 3) diag = buildTrioStationDiagram(count, options);
    else diag = buildQuadStationDiagram(count, options);
  } else {
    diag = buildQuadStationDiagram(count, options);
  }

  return {
    ...diag,
    animation: diag.animation || buildSemanticAnimation(diag, options.execution),
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
              coachingMoments: d.animation.coachingMoments
                ? filterValidCoachingMoments(
                    d.animation.coachingMoments,
                    new Set(d.players.map((p) => p.id)),
                    d.animation.duration
                  )
                : undefined,
            }
          : buildSemanticAnimation(d, fallbackOptions.execution),
      };
    }
  }

  return buildDefaultStructuredDiagram(fallbackOptions);
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
