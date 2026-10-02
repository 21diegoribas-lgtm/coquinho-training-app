import {
  BlockType,
  DiagramBall,
  DiagramCone,
  DiagramGoal,
  DiagramPath,
  DiagramPlayer,
  DiagramTeam,
  ExercisePlayerOrganization,
  StructuredDrillDiagram,
} from '../types/session';

export interface DrillDiagramStructureInput {
  blockType: BlockType;
  exerciseName: string;
  playerCount: number;
  organization?: string;
  execution?: string | string[];
  equipment?: string[];
  playerOrganization?: ExercisePlayerOrganization;
  coachingPoints?: string[];
}

const VALID_TEAMS: Set<DiagramTeam> = new Set(['blue', 'red', 'neutral', 'goalkeeper']);
const VALID_PATH_TYPES = new Set(['pass', 'movement', 'dribble']);

export interface DiagramValidationResult {
  valid: boolean;
  errors: string[];
}

function isNumberBetween(val: unknown, min: number, max: number): boolean {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

/**
 * Validates a structured drill diagram according to TASK D1 rules:
 * - coordinates within 0–100
 * - unique player IDs
 * - valid team values (blue, red, neutral, goalkeeper)
 * - path references to existing player IDs
 * - diagram players not exceeding available players
 */
export function validateStructuredDiagram(
  diagram: unknown,
  availablePlayers: number
): DiagramValidationResult {
  const errors: string[] = [];

  if (!diagram || typeof diagram !== 'object') {
    return { valid: false, errors: ['Diagram must be a non-null object'] };
  }

  const d = diagram as Record<string, unknown>;

  // 1. Pitch
  if (!d.pitch || typeof d.pitch !== 'object') {
    errors.push('Diagram missing pitch object');
  } else {
    const pitch = d.pitch as Record<string, unknown>;
    if (typeof pitch.width !== 'number' || pitch.width <= 0) {
      errors.push('Pitch width must be a positive number');
    }
    if (typeof pitch.height !== 'number' || pitch.height <= 0) {
      errors.push('Pitch height must be a positive number');
    }
  }

  // 2. Players
  if (!Array.isArray(d.players)) {
    errors.push('Diagram players must be an array');
  } else {
    const players = d.players as unknown[];

    if (players.length === 0) {
      errors.push('Diagram must contain at least one player');
    }

    if (players.length > availablePlayers) {
      errors.push(
        `Diagram player count (${players.length}) exceeds available players (${availablePlayers})`
      );
    }

    const playerIds = new Set<string>();

    players.forEach((p, idx) => {
      if (!p || typeof p !== 'object') {
        errors.push(`Player[${idx}] must be an object`);
        return;
      }
      const player = p as Record<string, unknown>;
      const id = typeof player.id === 'string' ? player.id.trim() : '';

      if (!id) {
        errors.push(`Player[${idx}] missing id`);
      } else if (playerIds.has(id)) {
        errors.push(`Duplicate player id: ${id}`);
      } else {
        playerIds.add(id);
      }

      const team = player.team as DiagramTeam;
      if (!VALID_TEAMS.has(team)) {
        errors.push(`Player[${idx}] (${id}) has invalid team: '${String(player.team)}'`);
      }

      if (!isNumberBetween(player.x, 0, 100)) {
        errors.push(`Player[${idx}] (${id}) x coordinate ${String(player.x)} outside 0-100`);
      }

      if (!isNumberBetween(player.y, 0, 100)) {
        errors.push(`Player[${idx}] (${id}) y coordinate ${String(player.y)} outside 0-100`);
      }
    });

    // 3. Paths references to existing player IDs
    if (!Array.isArray(d.paths)) {
      errors.push('Diagram paths must be an array');
    } else {
      (d.paths as unknown[]).forEach((p, idx) => {
        if (!p || typeof p !== 'object') {
          errors.push(`Path[${idx}] must be an object`);
          return;
        }
        const path = p as Record<string, unknown>;
        const pType = String(path.type || '');
        if (!VALID_PATH_TYPES.has(pType)) {
          errors.push(`Path[${idx}] has invalid type: '${pType}'`);
        }

        const fromId = String(path.fromPlayerId || '');
        if (!fromId) {
          errors.push(`Path[${idx}] missing fromPlayerId`);
        } else if (!playerIds.has(fromId)) {
          errors.push(`Path[${idx}] fromPlayerId '${fromId}' references non-existent player`);
        }

        if (path.toPlayerId !== undefined && path.toPlayerId !== null && path.toPlayerId !== '') {
          const toId = String(path.toPlayerId);
          if (!playerIds.has(toId)) {
            errors.push(`Path[${idx}] toPlayerId '${toId}' references non-existent player`);
          }
        }
      });
    }
  }

  // 4. Balls coordinates
  if (Array.isArray(d.balls)) {
    (d.balls as unknown[]).forEach((b, idx) => {
      if (b && typeof b === 'object') {
        const ball = b as Record<string, unknown>;
        if (!isNumberBetween(ball.x, 0, 100) || !isNumberBetween(ball.y, 0, 100)) {
          errors.push(`Ball[${idx}] coordinates outside 0-100`);
        }
      }
    });
  }

  // 5. Cones coordinates
  if (Array.isArray(d.cones)) {
    (d.cones as unknown[]).forEach((c, idx) => {
      if (c && typeof c === 'object') {
        const cone = c as Record<string, unknown>;
        if (!isNumberBetween(cone.x, 0, 100) || !isNumberBetween(cone.y, 0, 100)) {
          errors.push(`Cone[${idx}] coordinates outside 0-100`);
        }
      }
    });
  }

  // 6. Goals coordinates
  if (Array.isArray(d.goals)) {
    (d.goals as unknown[]).forEach((g, idx) => {
      if (g && typeof g === 'object') {
        const goal = g as Record<string, unknown>;
        if (!isNumberBetween(goal.x, 0, 100) || !isNumberBetween(goal.y, 0, 100)) {
          errors.push(`Goal[${idx}] coordinates outside 0-100`);
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function clamp(value: number, min = 5, max = 95): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

/**
 * Builds a deterministic, logical structured drill diagram for any phase/exercise.
 * Exactly corresponds to the drill organization and does NOT exceed available player count.
 */
export function buildStructuredDrillDiagram(
  input: DrillDiagramStructureInput
): StructuredDrillDiagram {
  const total = Math.max(4, Math.min(50, Math.round(input.playerCount || 16)));
  const org = input.playerOrganization;

  const players: DiagramPlayer[] = [];
  const balls: DiagramBall[] = [];
  const cones: DiagramCone[] = [];
  const goals: DiagramGoal[] = [];
  const paths: DiagramPath[] = [];

  const addPlayer = (
    id: string,
    team: DiagramTeam,
    role: string,
    x: number,
    y: number
  ) => {
    players.push({
      id,
      team,
      role,
      x: clamp(x),
      y: clamp(y),
    });
  };

  // 1. WARM-UP (Khởi động)
  if (input.blockType === 'warm_up') {
    const pairCount = Math.floor(total / 2);
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(pairCount))));
    const rows = Math.ceil(pairCount / cols);

    let pIdx = 1;
    for (let p = 0; p < pairCount; p += 1) {
      const col = p % cols;
      const row = Math.floor(p / cols);
      const cx = 18 + (cols === 1 ? 0 : (col * 64) / Math.max(1, cols - 1));
      const cy = 20 + (rows === 1 ? 20 : (row * 48) / Math.max(1, rows - 1));

      const pAId = `p${pIdx}`;
      const pBId = `p${pIdx + 1}`;
      pIdx += 2;

      addPlayer(pAId, 'blue', 'passer', cx - 5, cy);
      addPlayer(pBId, 'blue', 'receiver', cx + 5, cy);

      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx), y: clamp(cy - 4) });
      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx), y: clamp(cy + 4) });

      balls.push({ id: `b${balls.length + 1}`, x: clamp(cx - 3), y: clamp(cy) });

      paths.push({
        id: `path${paths.length + 1}`,
        type: 'pass',
        fromPlayerId: pAId,
        toPlayerId: pBId,
      });
    }

    // Remaining odd player if any
    while (pIdx <= total) {
      addPlayer(`p${pIdx}`, 'neutral', 'neutral', 50, 30 + (pIdx - pairCount * 2) * 5);
      pIdx += 1;
    }

    return {
      pitch: { width: 100, height: 60 },
      players,
      balls,
      cones,
      goals,
      zones: [],
      paths,
    };
  }

  // 2. TECHNICAL (Kỹ thuật)
  if (input.blockType === 'technical') {
    const groups = Math.max(1, Math.min(4, org?.groups ?? Math.max(1, Math.round(total / 4))));
    const basePerGroup = Math.max(2, org?.playersPerGroup ?? Math.floor(total / groups));
    const cols = Math.min(2, groups);
    const rows = Math.ceil(groups / cols);

    let pIdx = 1;
    for (let g = 0; g < groups; g += 1) {
      const col = g % cols;
      const row = Math.floor(g / cols);
      const cx = 25 + col * 50;
      const cy = 22 + row * 34;

      const groupPlayers = Math.min(basePerGroup, total - pIdx + 1);
      const groupPlayerIds: string[] = [];

      // Cones marking diamond station
      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx - 10), y: clamp(cy) });
      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx + 10), y: clamp(cy) });
      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx), y: clamp(cy - 8) });
      cones.push({ id: `c${cones.length + 1}`, x: clamp(cx), y: clamp(cy + 8) });

      for (let i = 0; i < groupPlayers; i += 1) {
        const id = `p${pIdx}`;
        groupPlayerIds.push(id);
        pIdx += 1;

        const angle = (Math.PI * 2 * i) / Math.max(3, groupPlayers) - Math.PI / 2;
        const px = cx + Math.cos(angle) * 7.5;
        const py = cy + Math.sin(angle) * 6.5;
        const role = i === 0 ? 'server' : i === 1 ? 'receiver' : 'support';
        addPlayer(id, 'blue', role, px, py);
      }

      if (groupPlayerIds.length >= 2) {
        balls.push({ id: `b${balls.length + 1}`, x: clamp(cx - 6), y: clamp(cy) });
        paths.push({
          id: `path${paths.length + 1}`,
          type: 'pass',
          fromPlayerId: groupPlayerIds[0],
          toPlayerId: groupPlayerIds[1],
        });
      }
      if (groupPlayerIds.length >= 3) {
        paths.push({
          id: `path${paths.length + 1}`,
          type: 'pass',
          fromPlayerId: groupPlayerIds[1],
          toPlayerId: groupPlayerIds[2],
        });
      }
    }

    while (pIdx <= total) {
      addPlayer(`p${pIdx}`, 'neutral', 'neutral', 50, 30 + (pIdx - total / 2) * 5);
      pIdx += 1;
    }

    return {
      pitch: { width: 100, height: 60 },
      players,
      balls,
      cones,
      goals,
      zones: [],
      paths,
    };
  }

  // 3. SKILL (Phát triển kỹ năng / Opposed)
  if (input.blockType === 'skill') {
    const half = Math.floor(total / 2);
    const blueCount = half;
    const redCount = total - half;

    let pIdx = 1;
    const blueIds: string[] = [];
    const redIds: string[] = [];

    // Blue attackers
    for (let i = 0; i < blueCount; i += 1) {
      const id = `p${pIdx}`;
      pIdx += 1;
      blueIds.push(id);
      const x = 18 + (i % 3) * 18;
      const y = 15 + Math.floor(i / 3) * 18;
      addPlayer(id, 'blue', 'attacker', x, y);
    }

    // Red defenders
    for (let i = 0; i < redCount; i += 1) {
      const id = `p${pIdx}`;
      pIdx += 1;
      redIds.push(id);
      const x = 50 + (i % 3) * 16;
      const y = 16 + Math.floor(i / 3) * 18;
      addPlayer(id, 'red', 'defender', x, y);
    }

    cones.push({ id: 'c1', x: 10, y: 10 });
    cones.push({ id: 'c2', x: 90, y: 10 });
    cones.push({ id: 'c3', x: 90, y: 50 });
    cones.push({ id: 'c4', x: 10, y: 50 });

    balls.push({ id: 'b1', x: clamp(players[0]?.x ? players[0].x + 3 : 20), y: clamp(players[0]?.y ?? 20) });

    if (blueIds.length >= 2) {
      paths.push({
        id: 'path1',
        type: 'pass',
        fromPlayerId: blueIds[0],
        toPlayerId: blueIds[1],
      });
    }
    if (redIds.length >= 1) {
      paths.push({
        id: 'path2',
        type: 'movement',
        fromPlayerId: redIds[0],
      });
    }

    return {
      pitch: { width: 100, height: 60 },
      players,
      balls,
      cones,
      goals,
      zones: [],
      paths,
    };
  }

  // 4. SMALL-SIDED (Trò chơi đối kháng)
  if (input.blockType === 'small_sided') {
    const half = Math.floor(total / 2);
    const blueCount = half;
    const redCount = total - half;

    let pIdx = 1;
    const blueIds: string[] = [];
    const redIds: string[] = [];

    // 4 mini goals at corners
    goals.push({ id: 'g1', type: 'mini', x: 6, y: 15, orientation: 'left' });
    goals.push({ id: 'g2', type: 'mini', x: 6, y: 45, orientation: 'left' });
    goals.push({ id: 'g3', type: 'mini', x: 94, y: 15, orientation: 'right' });
    goals.push({ id: 'g4', type: 'mini', x: 94, y: 45, orientation: 'right' });

    // Blue team attacking right
    for (let i = 0; i < blueCount; i += 1) {
      const id = `p${pIdx}`;
      pIdx += 1;
      blueIds.push(id);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 20 + col * 14;
      const y = 14 + row * 16;
      const role = col === 0 ? 'defender' : col === 1 ? 'midfielder' : 'attacker';
      addPlayer(id, 'blue', role, x, y);
    }

    // Red team attacking left
    for (let i = 0; i < redCount; i += 1) {
      const id = `p${pIdx}`;
      pIdx += 1;
      redIds.push(id);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 54 + col * 14;
      const y = 14 + row * 16;
      const role = col === 0 ? 'attacker' : col === 1 ? 'midfielder' : 'defender';
      addPlayer(id, 'red', role, x, y);
    }

    cones.push({ id: 'c1', x: 50, y: 10 });
    cones.push({ id: 'c2', x: 50, y: 50 });

    balls.push({ id: 'b1', x: 34, y: 30 });

    if (blueIds.length >= 2) {
      paths.push({
        id: 'path1',
        type: 'pass',
        fromPlayerId: blueIds[0],
        toPlayerId: blueIds[1],
      });
    }
    if (blueIds.length >= 3) {
      paths.push({
        id: 'path2',
        type: 'movement',
        fromPlayerId: blueIds[2],
      });
    }

    return {
      pitch: { width: 100, height: 60 },
      players,
      balls,
      cones,
      goals,
      zones: [],
      paths,
    };
  }

  // 5. MATCH (Thi đấu thực chiến)
  // Two standard goals, goalkeepers + balanced outfield teams
  goals.push({ id: 'g1', type: 'standard', x: 2, y: 30, orientation: 'left' });
  goals.push({ id: 'g2', type: 'standard', x: 98, y: 30, orientation: 'right' });

  let pIdx = 1;
  // Goalkeepers
  const blueGKId = `p${pIdx}`;
  pIdx += 1;
  addPlayer(blueGKId, 'goalkeeper', 'goalkeeper', 6, 30);

  const redGKId = `p${pIdx}`;
  pIdx += 1;
  addPlayer(redGKId, 'goalkeeper', 'goalkeeper', 94, 30);

  const outfieldTotal = total - 2;
  const blueOutfield = Math.floor(outfieldTotal / 2);
  const redOutfield = outfieldTotal - blueOutfield;

  const blueIds: string[] = [blueGKId];
  const redIds: string[] = [redGKId];

  // Blue outfield
  for (let i = 0; i < blueOutfield; i += 1) {
    const id = `p${pIdx}`;
    pIdx += 1;
    blueIds.push(id);
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 18 + col * 11;
    const y = 14 + row * 16;
    const role = col === 0 ? 'defender' : col === 1 ? 'midfielder' : 'attacker';
    addPlayer(id, 'blue', role, x, y);
  }

  // Red outfield
  for (let i = 0; i < redOutfield; i += 1) {
    const id = `p${pIdx}`;
    pIdx += 1;
    redIds.push(id);
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 56 + col * 11;
    const y = 14 + row * 16;
    const role = col === 0 ? 'attacker' : col === 1 ? 'midfielder' : 'defender';
    addPlayer(id, 'red', role, x, y);
  }

  balls.push({ id: 'b1', x: 38, y: 30 });

  if (blueIds.length >= 3) {
    paths.push({
      id: 'path1',
      type: 'pass',
      fromPlayerId: blueIds[1],
      toPlayerId: blueIds[2],
    });
  }
  if (blueIds.length >= 4) {
    paths.push({
      id: 'path2',
      type: 'dribble',
      fromPlayerId: blueIds[3],
    });
  }

  return {
    pitch: { width: 100, height: 60 },
    players,
    balls,
    cones,
    goals,
    zones: [],
    paths,
  };
}

/**
 * Ensures a diagram is completely valid. If diagram from upstream is valid, returns it;
 * otherwise builds a fully conforming structured diagram.
 */
export function sanitizeStructuredDiagram(
  rawDiagram: unknown,
  availablePlayers: number,
  fallbackInput: DrillDiagramStructureInput
): StructuredDrillDiagram {
  const result = validateStructuredDiagram(rawDiagram, availablePlayers);
  if (result.valid && rawDiagram && typeof rawDiagram === 'object') {
    const d = rawDiagram as Record<string, unknown>;
    const pitch = d.pitch as Record<string, unknown>;
    return {
      pitch: {
        width: typeof pitch?.width === 'number' ? pitch.width : 100,
        height: typeof pitch?.height === 'number' ? pitch.height : 60,
      },
      players: (d.players as DiagramPlayer[]).map((p) => ({
        id: String(p.id).trim(),
        team: p.team,
        role: p.role ? String(p.role).trim() : undefined,
        x: clamp(Number(p.x)),
        y: clamp(Number(p.y)),
      })),
      balls: Array.isArray(d.balls)
        ? (d.balls as DiagramBall[]).map((b) => ({
            id: String(b.id || 'b1').trim(),
            x: clamp(Number(b.x)),
            y: clamp(Number(b.y)),
          }))
        : [{ id: 'b1', x: 50, y: 30 }],
      cones: Array.isArray(d.cones)
        ? (d.cones as DiagramCone[]).map((c) => ({
            id: String(c.id || 'c1').trim(),
            x: clamp(Number(c.x)),
            y: clamp(Number(c.y)),
          }))
        : [],
      goals: Array.isArray(d.goals)
        ? (d.goals as DiagramGoal[]).map((g) => ({
            id: String(g.id || 'g1').trim(),
            type: g.type ? String(g.type).trim() : 'mini',
            x: clamp(Number(g.x)),
            y: clamp(Number(g.y)),
            orientation: g.orientation ? String(g.orientation).trim() : 'top',
          }))
        : [],
      zones: Array.isArray(d.zones) ? (d.zones as StructuredDrillDiagram['zones']) : [],
      paths: Array.isArray(d.paths)
        ? (d.paths as DiagramPath[]).map((p) => ({
            id: String(p.id || 'path1').trim(),
            type: p.type,
            fromPlayerId: String(p.fromPlayerId).trim(),
            toPlayerId: p.toPlayerId ? String(p.toPlayerId).trim() : undefined,
          }))
        : [],
    };
  }

  return buildStructuredDrillDiagram(fallbackInput);
}
