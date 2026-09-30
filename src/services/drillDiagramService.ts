import {
  BlockType,
  ExercisePlayerOrganization,
  PitchDiagramData,
  PitchPlayer,
} from '../types/session';

export interface DrillDiagramInput {
  blockType: BlockType;
  exerciseName: string;
  playerCount: number;
  organization?: string;
  execution?: string | string[];
  equipment?: string[];
  playerOrganization?: ExercisePlayerOrganization;
  coachingPoints?: string[];
}

function clamp(value: number, min = 7, max = 93) {
  return Math.max(min, Math.min(max, value));
}

function normalizedText(input: DrillDiagramInput) {
  return [
    input.exerciseName,
    input.organization ?? '',
    Array.isArray(input.execution) ? input.execution.join(' ') : input.execution ?? '',
    ...(input.equipment ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function playerRoleForIndex(index: number, split: number): PitchPlayer['role'] {
  return index < split ? 'teamA' : 'teamB';
}

export function buildDrillDiagram(input: DrillDiagramInput): PitchDiagramData {
  const text = normalizedText(input);
  const total = Math.max(4, Math.min(50, Math.round(input.playerCount || 4)));
  const org = input.playerOrganization;
  const seed = [...input.exerciseName].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const jitter = (value: number, amount = 1.5) => {
    const offset = ((seed % 17) / 16 - 0.5) * amount * 2;
    return clamp(value + offset);
  };

  const players: PitchDiagramData['players'] = [];
  const cones: NonNullable<PitchDiagramData['cones']> = [];
  const goals: NonNullable<PitchDiagramData['goals']> = [];
  const arrows: NonNullable<PitchDiagramData['arrows']> = [];

  const addPlayer = (
    x: number,
    y: number,
    role: PitchPlayer['role'],
    label: string,
    rotation?: number,
  ) => {
    players.push({ x: clamp(x), y: clamp(y, 8, 92), role, label, rotation });
  };

  const isOneVOne = /1v1|1 v 1|đối đầu/.test(text);
  const isRondo = /rondo|giữ bóng|kiểm soát bóng|possession|joker|cầu thủ tự do/.test(text);
  const isReceiving = /nhận bóng|mở thân|tư thế mở|chạm bước một|open body|receiv/.test(text);
  const isPassing = /chuyền|phối hợp|luân chuyển|passing/.test(text) || isReceiving;
  const isDribbling = /dẫn bóng|rê bóng|dribbl/.test(text);
  const hasMiniGoals = /mini|cầu môn nhỏ|khung thành nhỏ/.test(text);
  const hasGoals = hasMiniGoals || /cầu môn|khung thành|dứt điểm|sút|ghi bàn|thi đấu/.test(text);

  // 1) Warm-up: show the real simultaneous pair/trio structure instead of a generic grid.
  if (input.blockType === 'warm_up') {
    const pairCount = Math.floor(total / 2);
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(pairCount))));
    const rows = Math.ceil(pairCount / cols);
    let created = 0;
    for (let p = 0; p < pairCount; p += 1) {
      const col = p % cols;
      const row = Math.floor(p / cols);
      const cx = 16 + (cols === 1 ? 0 : (col * 68) / Math.max(1, cols - 1));
      const cy = 20 + (rows === 1 ? 30 : (row * 60) / Math.max(1, rows - 1));
      addPlayer(cx - 4, cy, 'teamA', String(created + 1), 0);
      created += 1;
      addPlayer(cx + 4, cy, 'teamA', String(created + 1), 180);
      created += 1;
      cones.push({ x: clamp(cx - 7), y: clamp(cy - 6), color: 'orange' });
      cones.push({ x: clamp(cx + 7), y: clamp(cy - 6), color: 'orange' });
      arrows.push({ from: [cx - 3, cy], to: [cx + 3, cy], type: 'pass' });
    }
    if (created < total) {
      addPlayer(50, 50, 'neutral', 'R', 90);
    }
    return {
      layout: 'gates_grid',
      players,
      cones,
      goals,
      arrows,
      ball: players[0] ? { x: clamp(players[0].x + 2), y: players[0].y } : { x: 50, y: 50 },
      coachingCueOverlay: input.coachingPoints?.[0],
    };
  }

  // 2) Technical: visualize separate stations/groups so icon count matches the stated organization.
  if (input.blockType === 'technical') {
    const groups = Math.max(1, Math.min(8, org?.groups ?? Math.max(1, Math.round(total / 4))));
    const basePerGroup = Math.max(2, org?.playersPerGroup ?? Math.floor(total / groups));
    let remaining = total;
    const stationCols = Math.min(4, groups);
    const stationRows = Math.ceil(groups / stationCols);
    let playerIndex = 0;

    for (let g = 0; g < groups; g += 1) {
      const col = g % stationCols;
      const row = Math.floor(g / stationCols);
      const cx = 17 + (stationCols === 1 ? 33 : (col * 66) / Math.max(1, stationCols - 1));
      const cy = 22 + (stationRows === 1 ? 28 : (row * 56) / Math.max(1, stationRows - 1));
      const groupsLeft = groups - g;
      const count = Math.min(remaining, g === groups - 1 ? remaining : Math.min(basePerGroup, remaining - (groupsLeft - 1) * 2));
      remaining -= count;

      const radiusX = 7;
      const radiusY = 9;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / Math.max(3, count) - Math.PI / 2;
        addPlayer(
          cx + Math.cos(angle) * radiusX,
          cy + Math.sin(angle) * radiusY,
          'teamA',
          String(playerIndex + 1),
          (angle * 180) / Math.PI + 90,
        );
        playerIndex += 1;
      }
      cones.push({ x: clamp(cx - 9), y: clamp(cy - 11), color: g % 2 ? 'yellow' : 'orange' });
      cones.push({ x: clamp(cx + 9), y: clamp(cy - 11), color: g % 2 ? 'yellow' : 'orange' });
      if (count >= 2) {
        const start = players[playerIndex - count];
        const end = players[playerIndex - count + 1];
        arrows.push({ from: [start.x, start.y], to: [end.x, end.y], type: 'pass' });
      }
    }

    while (playerIndex < total) {
      addPlayer(50, 50 + (playerIndex - total / 2) * 3, 'neutral', `J${playerIndex + 1}`);
      playerIndex += 1;
    }

    return {
      layout: isReceiving || isPassing ? 'channel_play' : 'gates_grid',
      players,
      cones,
      arrows,
      ball: players[0] ? { x: clamp(players[0].x + 2), y: players[0].y } : { x: 50, y: 50 },
      coachingCueOverlay: input.coachingPoints?.[0],
    };
  }

  // 3) 1v1-specific skill drill: show lanes and every attacker/defender pair.
  if (isOneVOne) {
    const pairs = Math.floor(total / 2);
    for (let i = 0; i < pairs; i += 1) {
      const laneX = 10 + ((i + 1) * 80) / (pairs + 1);
      addPlayer(laneX - 2.5, 76, 'teamA', `A${i + 1}`, 0);
      addPlayer(laneX + 2.5, 42, 'teamB', `D${i + 1}`, 180);
      arrows.push({ from: [laneX - 2.5, 73], to: [laneX, 22], type: 'dribble' });
    }
    if (total % 2) addPlayer(50, 56, 'neutral', 'J', 0);
    goals.push({ x: 50, y: 10, width: 16, orientation: 'top', isMini: true });
    cones.push({ x: 12, y: 18, color: 'orange' }, { x: 88, y: 18, color: 'orange' });
    return {
      layout: 'channel_play',
      players,
      cones,
      goals,
      arrows,
      ball: players[0] ? { x: players[0].x, y: clamp(players[0].y - 3) } : { x: 50, y: 70 },
      coachingCueOverlay: input.coachingPoints?.[0],
    };
  }

  // 4) Skill / possession: two teams + optional joker, all players accounted for.
  if (input.blockType === 'skill' || isRondo) {
    const leftover = Math.max(0, org?.leftover ?? 0);
    const neutralCount = leftover > 0 ? leftover : /joker|tự do/.test(text) ? 1 : 0;
    const competitive = Math.max(2, total - neutralCount);
    const sideA = Math.ceil(competitive / 2);
    for (let i = 0; i < competitive; i += 1) {
      const angle = (Math.PI * 2 * i) / competitive - Math.PI / 2;
      addPlayer(
        50 + Math.cos(angle) * 33,
        50 + Math.sin(angle) * 31,
        playerRoleForIndex(i, sideA),
        String(i + 1),
        i < sideA ? 0 : 180,
      );
    }
    for (let i = 0; i < neutralCount; i += 1) {
      addPlayer(50, 44 + i * 12, 'neutral', `J${i + 1}`, 90);
    }
    cones.push(
      { x: 12, y: 14, color: 'yellow' },
      { x: 88, y: 14, color: 'yellow' },
      { x: 88, y: 86, color: 'yellow' },
      { x: 12, y: 86, color: 'yellow' },
    );
    if (players.length >= 3) {
      arrows.push({ from: [players[0].x, players[0].y], to: [players[1].x, players[1].y], type: 'pass' });
      arrows.push({ from: [players[1].x, players[1].y], to: [players[2].x, players[2].y], type: isDribbling ? 'dribble' : 'run' });
    }
    return {
      layout: 'rondo_box',
      players,
      cones,
      arrows,
      ball: players[0] ? { x: clamp(players[0].x + 2), y: players[0].y } : { x: 50, y: 50 },
      coachingCueOverlay: input.coachingPoints?.[0],
    };
  }

  // 5) Small-sided / match: equal teams + leftover jokers, all icons shown exactly once.
  if (input.blockType === 'small_sided' || input.blockType === 'match' || hasGoals) {
    const leftover = Math.max(0, org?.leftover ?? (total % 2));
    const competitive = total - leftover;
    const sideA = Math.ceil(competitive / 2);
    const sideB = competitive - sideA;

    const placeTeam = (count: number, role: 'teamA' | 'teamB', top: boolean, offset: number) => {
      const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(count * 1.6))));
      const rows = Math.ceil(count / cols);
      for (let i = 0; i < count; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 18 + (cols === 1 ? 32 : (col * 64) / Math.max(1, cols - 1));
        const yStep = rows <= 1 ? 0 : (row * 24) / Math.max(1, rows - 1);
        const y = top ? 22 + yStep : 78 - yStep;
        const isKeeper = input.blockType === 'match' && count >= 5 && i === 0;
        addPlayer(jitter(x), jitter(y), isKeeper ? 'gk' : role, isKeeper ? 'TM' : String(offset + i + 1), top ? 0 : 180);
      }
    };

    placeTeam(sideA, 'teamA', true, 0);
    placeTeam(sideB, 'teamB', false, sideA);
    for (let i = 0; i < leftover; i += 1) addPlayer(50, 46 + i * 8, 'neutral', `J${i + 1}`, 90);

    if (hasMiniGoals || input.blockType === 'small_sided') {
      goals.push(
        { x: 30, y: 8, width: 11, orientation: 'top', isMini: true },
        { x: 70, y: 8, width: 11, orientation: 'top', isMini: true },
        { x: 30, y: 92, width: 11, orientation: 'bottom', isMini: true },
        { x: 70, y: 92, width: 11, orientation: 'bottom', isMini: true },
      );
    } else {
      goals.push(
        { x: 50, y: 7, width: 24, orientation: 'top', isMini: false },
        { x: 50, y: 93, width: 24, orientation: 'bottom', isMini: false },
      );
    }

    if (players.length >= 3) {
      arrows.push({ from: [players[1].x, players[1].y], to: [players[2].x, players[2].y], type: 'pass' });
      const opponent = players[sideA] ?? players[players.length - 1];
      arrows.push({ from: [opponent.x, opponent.y], to: [50, 50], type: 'run' });
    }

    return {
      layout: input.blockType === 'match' ? 'full_pitch' : 'half_pitch',
      players,
      goals,
      cones,
      arrows,
      ball: { x: 50, y: 50 },
      coachingCueOverlay: input.coachingPoints?.[0],
    };
  }

  // Generic fallback: distribute all players but still vary by activity.
  const cols = Math.max(2, Math.ceil(Math.sqrt(total * 1.4)));
  const rows = Math.ceil(total / cols);
  for (let i = 0; i < total; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 14 + (cols === 1 ? 36 : (col * 72) / Math.max(1, cols - 1));
    const y = 18 + (rows === 1 ? 32 : (row * 64) / Math.max(1, rows - 1));
    addPlayer(x, y, i % 2 ? 'teamB' : 'teamA', String(i + 1), i % 2 ? 180 : 0);
  }
  cones.push(
    { x: 10, y: 12, color: 'orange' },
    { x: 90, y: 12, color: 'orange' },
    { x: 90, y: 88, color: 'orange' },
    { x: 10, y: 88, color: 'orange' },
  );
  if (players.length >= 2) {
    arrows.push({
      from: [players[0].x, players[0].y],
      to: [players[1].x, players[1].y],
      type: isDribbling ? 'dribble' : isPassing ? 'pass' : 'run',
    });
  }
  return {
    layout: 'gates_grid',
    players,
    cones,
    goals,
    arrows,
    ball: players[0] ? { x: clamp(players[0].x + 2), y: players[0].y } : { x: 50, y: 50 },
    coachingCueOverlay: input.coachingPoints?.[0],
  };
}
