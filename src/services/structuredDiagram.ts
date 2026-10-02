/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BlockType,
  DiagramBall,
  DiagramCone,
  DiagramGoal,
  DiagramPath,
  DiagramPitch,
  DiagramPlayer,
  DiagramTeam,
  DiagramZone,
  ExercisePlayerOrganization,
  StructuredDrillDiagram,
} from '../types/session';

export interface DiagramValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_TEAMS = new Set<DiagramTeam>(['blue', 'red', 'neutral', 'goalkeeper']);
const VALID_PATH_TYPES = new Set(['pass', 'movement', 'dribble']);

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

  return { ok: errors.length === 0, errors };
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
export function detectEquipmentGoals(
  equipment?: string[],
  organization?: string,
  execution?: string
): DetectedEquipmentGoals {
  const text = [
    ...(Array.isArray(equipment) ? equipment : []),
    organization || '',
    execution || '',
  ]
    .join(' ')
    .toLowerCase();

  const miniRegex = /(\d+)\s*(?:cầu môn mini|khung thành mini|cầu môn nhỏ|khung thành nhỏ|mini goal|small goal)/i;
  const miniMatch = text.match(miniRegex);

  const matchRegex = /(\d+)\s*(?:khung thành sân \d+|khung thành futsal|khung thành tiêu chuẩn|khung thành lớn|cầu môn tiêu chuẩn|khung thành|cầu môn)/i;
  const matchMatch = text.match(matchRegex);

  const hasMiniKeyword = /cầu môn mini|khung thành mini|cầu môn nhỏ|khung thành nhỏ|mini goal/i.test(text);
  const hasMatchKeyword = /khung thành sân|khung thành futsal|khung thành có thủ môn|khung thành 7|khung thành 9|khung thành 11/i.test(text);
  const hasAnyGoal = hasMiniKeyword || hasMatchKeyword || /khung thành|cầu môn|bàn thắng|goal/i.test(text);

  if (!hasAnyGoal) {
    return { hasGoals: false, isMini: false, miniGoals: 0, matchGoals: 0, totalExpected: 0 };
  }

  if (hasMiniKeyword) {
    const count = miniMatch ? parseInt(miniMatch[1], 10) : 4;
    return { hasGoals: true, isMini: true, miniGoals: count, matchGoals: 0, totalExpected: count };
  }

  if (hasMatchKeyword) {
    const count = matchMatch ? parseInt(matchMatch[1], 10) : 2;
    return { hasGoals: true, isMini: false, miniGoals: 0, matchGoals: count, totalExpected: count };
  }

  return { hasGoals: true, isMini: false, miniGoals: 0, matchGoals: 2, totalExpected: 2 };
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

  if (/đối kháng|tranh cướp|hậu vệ|áp sát|cướp bóng|presser|defender|rondo/i.test(text)) {
    return true;
  }

  if (/không đối kháng|unopposed|chuyền đôi|cặp đối diện|phối hợp không có người kèm/i.test(text)) {
    return false;
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
      if (clusters.length < 6 || clusters.some((c) => c.length >= 4)) {
        errors.push(
          `Drill organization specifies 8 groups of 2, but diagram does not show 8 distinct pairs (found ${clusters.length} clusters)`
        );
      }
    } else if (pOrg.groups === 4 && pOrg.playersPerGroup === 4) {
      const clusters = clusterDiagramPlayers(players, 20);
      if (clusters.length !== 4) {
        errors.push(
          `Drill organization specifies 4 groups of 4, but diagram does not show 4 distinct groups (found ${clusters.length} clusters)`
        );
      }
    } else if (pOrg.groups === 2 && options.blockType === 'match') {
      const blueTeam = players.filter((p) => p.team === 'blue');
      const redTeam = players.filter((p) => p.team === 'red');
      if (blueTeam.length === 0 || redTeam.length === 0) {
        errors.push('Match diagram must separate players into two distinct teams');
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

  const numPairs = Math.floor(count / 2);
  const remainder = count % 2;

  const row1Count = numPairs > 4 ? Math.ceil(numPairs / 2) : numPairs;
  const row2Count = numPairs > 4 ? numPairs - row1Count : 0;

  let pIdx = 1;
  let coneIdx = 1;
  let ballIdx = 1;
  let pathIdx = 1;

  // Row 1
  for (let i = 0; i < row1Count; i++) {
    const cx = Math.round(18 + (i * 64) / Math.max(1, row1Count - 1));
    const cy = numPairs > 4 ? 28 : 50;

    const idA = `p${pIdx++}`;
    const idB = `p${pIdx++}`;

    players.push(
      { id: idA, team: 'blue', role: 'passer', x: cx, y: cy - 9 },
      { id: idB, team: 'blue', role: 'receiver', x: cx, y: cy + 9 }
    );

    cones.push(
      { id: `c${coneIdx++}`, x: cx - 7, y: cy },
      { id: `c${coneIdx++}`, x: cx + 7, y: cy }
    );

    balls.push({ id: `b${ballIdx++}`, x: cx, y: cy - 5 });

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: idA,
      toPlayerId: idB,
    });
  }

  // Row 2
  for (let i = 0; i < row2Count; i++) {
    const cx = Math.round(18 + (i * 64) / Math.max(1, row2Count - 1));
    const cy = 72;

    const idA = `p${pIdx++}`;
    const idB = `p${pIdx++}`;

    players.push(
      { id: idA, team: 'blue', role: 'passer', x: cx, y: cy - 9 },
      { id: idB, team: 'blue', role: 'receiver', x: cx, y: cy + 9 }
    );

    cones.push(
      { id: `c${coneIdx++}`, x: cx - 7, y: cy },
      { id: `c${coneIdx++}`, x: cx + 7, y: cy }
    );

    balls.push({ id: `b${ballIdx++}`, x: cx, y: cy - 5 });

    paths.push({
      id: `path${pathIdx++}`,
      type: 'pass',
      fromPlayerId: idA,
      toPlayerId: idB,
    });
  }

  // Remainder player if odd
  for (let i = 0; i < remainder; i++) {
    players.push({
      id: `p${pIdx++}`,
      team: 'blue',
      role: 'rotation',
      x: 90,
      y: 50,
    });
  }

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(4, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i < 2 ? 10 : 90,
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

  const stations = [
    { cx: 26, cy: 26 },
    { cx: 74, cy: 26 },
    { cx: 26, cy: 74 },
    { cx: 74, cy: 74 },
  ];

  let pIdx = 1;
  let coneIdx = 1;
  let pathIdx = 1;

  stations.forEach((st, sIdx) => {
    // 4 cones for quadrant
    cones.push(
      { id: `c${coneIdx++}`, x: st.cx - 14, y: st.cy - 14 },
      { id: `c${coneIdx++}`, x: st.cx + 14, y: st.cy - 14 },
      { id: `c${coneIdx++}`, x: st.cx + 14, y: st.cy + 14 },
      { id: `c${coneIdx++}`, x: st.cx - 14, y: st.cy + 14 }
    );

    balls.push({ id: `b${sIdx + 1}`, x: st.cx, y: st.cy - 6 });

    const p1 = `p${pIdx++}`;
    const p2 = `p${pIdx++}`;
    const p3 = `p${pIdx++}`;
    const p4 = `p${pIdx++}`;

    players.push(
      { id: p1, team: 'blue', role: 'server', x: st.cx, y: st.cy - 10 },
      { id: p2, team: 'blue', role: 'receiver', x: st.cx + 11, y: st.cy },
      { id: p3, team: 'blue', role: 'target', x: st.cx, y: st.cy + 10 },
      { id: p4, team: 'blue', role: 'support', x: st.cx - 11, y: st.cy }
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

  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    for (let i = 0; i < Math.min(4, eqGoals.miniGoals); i++) {
      goals.push({
        id: `g${i + 1}`,
        type: 'mini',
        x: i < 2 ? 10 : 90,
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

  const jokers = options.playerOrganization?.leftoverRole === 'joker' && options.playerOrganization.leftover
    ? options.playerOrganization.leftover
    : (count % 2 === 1 ? 1 : 0);
  const outfield = count - jokers;
  const teamSize = Math.floor(outfield / 2);

  // Boundary grid cones
  cones.push(
    { id: 'c1', x: 20, y: 15 },
    { id: 'c2', x: 80, y: 15 },
    { id: 'c3', x: 80, y: 85 },
    { id: 'c4', x: 20, y: 85 }
  );

  balls.push({ id: 'b1', x: 48, y: 50 });

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];

  // Blue team (possession / attackers around grid)
  for (let i = 0; i < teamSize; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 24 + Math.round((i * 52) / Math.max(1, teamSize - 1));
    const y = i % 2 === 0 ? 25 : 75;
    players.push({ id, team: 'blue', role: 'possession', x, y });
  }

  // Red team (defenders / pressers inside grid)
  for (let i = 0; i < teamSize; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 34 + Math.round((i * 32) / Math.max(1, teamSize - 1));
    const y = 46 + (i % 2 === 0 ? -9 : 9);
    players.push({ id, team: 'red', role: 'presser', x, y });
  }

  // Jokers (neutral)
  for (let i = 0; i < jokers; i++) {
    const id = `p${pIdx++}`;
    players.push({ id, team: 'neutral', role: 'joker', x: 50, y: 50 });
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
          x: i < 2 ? 14 : 86,
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

  const jokers = count % 2 === 1 ? 1 : 0;
  const perTeam = Math.floor((count - jokers) / 2);

  // Synchronize goals from equipment
  const eqGoals = detectEquipmentGoals(options.equipment, options.organization, options.execution);
  if (eqGoals.hasGoals && eqGoals.isMini) {
    const gCount = eqGoals.miniGoals >= 4 ? 4 : eqGoals.miniGoals;
    if (gCount === 4) {
      goals.push(
        { id: 'g1', type: 'mini', x: 12, y: 22, orientation: 'left' },
        { id: 'g2', type: 'mini', x: 12, y: 78, orientation: 'left' },
        { id: 'g3', type: 'mini', x: 88, y: 22, orientation: 'right' },
        { id: 'g4', type: 'mini', x: 88, y: 78, orientation: 'right' }
      );
    } else {
      goals.push(
        { id: 'g1', type: 'mini', x: 12, y: 50, orientation: 'left' },
        { id: 'g2', type: 'mini', x: 88, y: 50, orientation: 'right' }
      );
    }
  } else if (eqGoals.hasGoals && !eqGoals.isMini) {
    goals.push(
      { id: 'g1', type: 'standard', x: 5, y: 50, orientation: 'left' },
      { id: 'g2', type: 'standard', x: 95, y: 50, orientation: 'right' }
    );
  }

  // Pitch boundary cones
  cones.push(
    { id: 'c1', x: 15, y: 10 },
    { id: 'c2', x: 85, y: 10 },
    { id: 'c3', x: 15, y: 90 },
    { id: 'c4', x: 85, y: 90 }
  );

  balls.push({ id: 'b1', x: 50, y: 50 });

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];

  for (let i = 0; i < perTeam; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 20 + Math.round((i * 26) / Math.max(1, perTeam - 1));
    const y = 20 + Math.round((i * 60) / Math.max(1, perTeam - 1));
    players.push({ id, team: 'blue', role: i === 0 ? 'defender' : 'attacker', x, y });
  }

  for (let i = 0; i < perTeam; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 54 + Math.round((i * 26) / Math.max(1, perTeam - 1));
    const y = 20 + Math.round((i * 60) / Math.max(1, perTeam - 1));
    players.push({ id, team: 'red', role: i === perTeam - 1 ? 'defender' : 'attacker', x, y });
  }

  if (jokers > 0) {
    players.push({ id: `p${pIdx++}`, team: 'neutral', role: 'joker', x: 50, y: 50 });
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

  goals.push(
    { id: 'g1', type: 'standard', x: 4, y: 50, orientation: 'left' },
    { id: 'g2', type: 'standard', x: 96, y: 50, orientation: 'right' }
  );

  balls.push({ id: 'b1', x: 50, y: 50 });

  cones.push(
    { id: 'c1', x: 50, y: 5 },
    { id: 'c2', x: 50, y: 95 }
  );

  let pIdx = 1;
  const blueIds: string[] = [];
  const redIds: string[] = [];

  // 2 GKs
  players.push({ id: `p${pIdx++}`, team: 'goalkeeper', role: 'goalkeeper', x: 8, y: 50 });
  players.push({ id: `p${pIdx++}`, team: 'goalkeeper', role: 'goalkeeper', x: 92, y: 50 });

  const outfield = count - 2;
  const jokers = outfield % 2 === 1 ? 1 : 0;
  const perSide = Math.floor((outfield - jokers) / 2);

  // Blue outfield
  for (let i = 0; i < perSide; i++) {
    const id = `p${pIdx++}`;
    blueIds.push(id);
    const x = 20 + Math.round((i * 26) / Math.max(1, perSide - 1));
    const y = 15 + Math.round((i * 70) / Math.max(1, perSide - 1));
    players.push({ id, team: 'blue', role: i < perSide / 2 ? 'defender' : 'midfielder', x, y });
  }

  // Red outfield
  for (let i = 0; i < perSide; i++) {
    const id = `p${pIdx++}`;
    redIds.push(id);
    const x = 54 + Math.round((i * 26) / Math.max(1, perSide - 1));
    const y = 15 + Math.round((i * 70) / Math.max(1, perSide - 1));
    players.push({ id, team: 'red', role: i >= perSide / 2 ? 'defender' : 'attacker', x, y });
  }

  if (jokers > 0) {
    players.push({ id: `p${pIdx++}`, team: 'neutral', role: 'joker', x: 50, y: 50 });
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
    (pOrg && pOrg.playersPerGroup === 2 && pOrg.groups >= 3) ||
    /8 nhóm 2|nhóm 2 người|chia thành \d+ cặp|8 cặp|từng cặp|8 groups of 2/i.test(orgText);

  const isExplicitQuads =
    (pOrg && pOrg.playersPerGroup === 4 && pOrg.groups >= 3) ||
    /4 nhóm 4|4 groups of 4|4 trạm/i.test(orgText);

  if (options.blockType === 'match') {
    return buildMatchDiagram(count, options);
  }

  if (options.blockType === 'small_sided') {
    return buildSmallSidedDiagram(count, options);
  }

  if (isExplicitPairs) {
    return buildPairDiagram(count, options);
  }

  if (isExplicitQuads) {
    return buildQuadStationDiagram(count, options);
  }

  if (options.blockType === 'skill') {
    return buildSkillDiagram(count, options);
  }

  if (options.blockType === 'warm_up') {
    return buildPairDiagram(count, options);
  }

  return buildQuadStationDiagram(count, options);
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
