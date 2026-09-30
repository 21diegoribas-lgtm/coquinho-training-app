import { BlockType, ExercisePlayerOrganization } from '../types/session';

export interface PlayerAllocation extends ExercisePlayerOrganization {
  leftover: number;
  leftoverRole: 'none' | 'joker' | 'rotation';
  accounted: number;
}

/**
 * Split a squad so every player is assigned: groups, leftover jokers, or rotation.
 * Always: groups * playersPerGroup + leftover === total.
 */
export function allocatePlayers(total: number, blockType: BlockType = 'technical'): PlayerAllocation {
  const n = Math.max(4, Math.round(Number(total) || 4));

  if (blockType === 'warm_up') {
    if (n % 2 === 0) {
      return {
        groups: n / 2,
        playersPerGroup: 2,
        leftover: 0,
        leftoverRole: 'none',
        accounted: n,
      };
    }
    // Odd: pairs + one trio that rotates
    const pairs = (n - 3) / 2;
    return {
      groups: pairs,
      playersPerGroup: 2,
      leftover: 3,
      leftoverRole: 'rotation',
      accounted: pairs * 2 + 3,
    };
  }

  if (blockType === 'technical') {
    if (n % 4 === 0) {
      return {
        groups: n / 4,
        playersPerGroup: 4,
        leftover: 0,
        leftoverRole: 'none',
        accounted: n,
      };
    }
    if (n % 3 === 0) {
      return {
        groups: n / 3,
        playersPerGroup: 3,
        leftover: 0,
        leftoverRole: 'none',
        accounted: n,
      };
    }
    const groupsOfFour = Math.floor(n / 4);
    const leftover = n % 4;
    if (groupsOfFour >= 1) {
      return {
        groups: groupsOfFour,
        playersPerGroup: 4,
        leftover,
        leftoverRole: leftover > 0 ? 'joker' : 'none',
        accounted: groupsOfFour * 4 + leftover,
      };
    }
  }

  // Two-sided games: equal teams + joker(s) when odd
  const perSide = Math.floor(n / 2);
  const leftover = n - perSide * 2;
  return {
    groups: 2,
    playersPerGroup: perSide,
    leftover,
    leftoverRole: leftover > 0 ? 'joker' : 'none',
    accounted: perSide * 2 + leftover,
  };
}

export function leftoverLabel(allocation: PlayerAllocation): string {
  if (allocation.leftover <= 0) return '';
  if (allocation.leftoverRole === 'rotation') {
    return allocation.leftover === 3
      ? ' + 1 nhóm 3 xoay tua'
      : ` + ${allocation.leftover} cầu thủ xoay tua`;
  }
  if (allocation.leftover === 1) {
    return ' + 1 joker';
  }
  return ` + ${allocation.leftover} joker`;
}

export function formatPlayerDistribution(total: number, blockType: BlockType): string {
  const n = Math.max(4, Math.round(Number(total) || 4));
  const alloc = allocatePlayers(n, blockType);

  switch (blockType) {
    case 'warm_up':
      if (alloc.leftover === 0) {
        return `${n} Cầu thủ (${alloc.groups} cặp chuyền bóng cùng lúc)`;
      }
      return `${n} Cầu thủ (${alloc.groups} cặp${leftoverLabel(alloc)})`;

    case 'technical':
      if (alloc.leftover === 0) {
        if (alloc.playersPerGroup === 4) {
          return `${n} Cầu thủ (${alloc.groups} nhóm 4 tại các trạm kỹ thuật)`;
        }
        if (alloc.playersPerGroup === 3) {
          return `${n} Cầu thủ (${alloc.groups} nhóm 3 phối hợp tam giác)`;
        }
      }
      return `${n} Cầu thủ (${alloc.groups} nhóm ${alloc.playersPerGroup}${leftoverLabel(alloc)})`;

    case 'skill':
      return `${n} Cầu thủ (${alloc.playersPerGroup}v${alloc.playersPerGroup}${leftoverLabel(alloc)} kiểm soát định hướng)`;

    case 'small_sided':
      return `${n} Cầu thủ (${alloc.playersPerGroup}v${alloc.playersPerGroup}${leftoverLabel(alloc)} đối kháng cầu môn nhỏ)`;

    case 'match':
      return `${n} Cầu thủ (${alloc.playersPerGroup}v${alloc.playersPerGroup}${leftoverLabel(alloc)} thi đấu tự do)`;
  }
}

export function toPlayerOrganization(total: number, blockType: BlockType): ExercisePlayerOrganization {
  const alloc = allocatePlayers(total, blockType);
  return {
    groups: alloc.groups,
    playersPerGroup: alloc.playersPerGroup,
    leftover: alloc.leftover,
    leftoverRole: alloc.leftoverRole,
  };
}

export function formatFromOrganization(
  players: number,
  org?: ExercisePlayerOrganization | null
): string {
  if (!org || org.groups <= 0 || org.playersPerGroup <= 0) {
    return `${players} Cầu thủ`;
  }
  const leftover = org.leftover ?? org.restingPlayers ?? 0;
  const role = org.leftoverRole ?? (leftover > 0 ? 'joker' : 'none');
  const label = leftoverLabel({
    groups: org.groups,
    playersPerGroup: org.playersPerGroup,
    leftover,
    leftoverRole: role,
    accounted: org.groups * org.playersPerGroup + leftover,
  });
  return `${players} Cầu thủ (${org.groups} nhóm ${org.playersPerGroup}${label})`;
}

/** Validate the allocation itself, rather than trusting a session-level total. */
export function validPlayerOrganization(value: unknown, players: number): value is ExercisePlayerOrganization {
  if (!value || typeof value !== 'object') return false;
  const org = value as ExercisePlayerOrganization;
  const extra = org.leftover ?? org.restingPlayers ?? 0;
  return Number.isInteger(org.groups) && org.groups > 0 &&
    Number.isInteger(org.playersPerGroup) && org.playersPerGroup > 0 &&
    Number.isInteger(extra) && extra >= 0 &&
    (org.restingPlayers === undefined || (Number.isInteger(org.restingPlayers) && org.restingPlayers >= 0 &&
      (org.leftover === undefined || org.restingPlayers === 0 || org.restingPlayers === org.leftover))) &&
    (extra === 0 ? org.leftoverRole === undefined || org.leftoverRole === 'none' :
      org.leftoverRole === 'joker' || org.leftoverRole === 'rotation' ||
      (org.leftover === undefined && org.restingPlayers === extra)) &&
    org.groups * org.playersPerGroup + extra === players;
}

/** Detect explicit equal-group/parallel-field claims that contradict structured data.
 * This deliberately does not attempt to interpret arbitrary natural language.
 */
export function organizationMatchesStructure(text: string, org: ExercisePlayerOrganization): boolean {
  const groups = /\b(\d+)\s*(?:groups?\s*(?:of\s*)?|nhóm\s*)(\d+)\b/gi;
  const fields = /\b(\d+)\s*(?:(?:parallel\s+)?(?:fields?\s*(?:of\s*)?)?|[x×]\s*)(\d+)\s*v\s*(\d+)(?:\s*(?:fields?|sân))?/gi;
  for (const match of text.matchAll(groups)) {
    // The warm-up allocation can contain pairs plus one rotating trio.
    if (+match[1] === 1 && +match[2] === 3 &&
      (org.leftover ?? org.restingPlayers) === 3 && org.leftoverRole === 'rotation' &&
      /^\s*xoay tua/.test(text.slice(match.index! + match[0].length))) continue;
    if (+match[1] !== org.groups || +match[2] !== org.playersPerGroup) return false;
  }
  for (const match of text.matchAll(fields)) {
    if (+match[1] !== org.groups || +match[2] + +match[3] !== org.playersPerGroup) return false;
  }
  const extras = /\+\s*(\d+)\s*(?:(?:rotating|resting)\s+)?(?:jokers?|neutrals?|servers?|rotating players?|resting players?|cầu thủ xoay tua)\b/gi;
  for (const match of text.matchAll(extras)) {
    if (+match[1] !== (org.leftover ?? org.restingPlayers ?? 0)) return false;
  }
  return true;
}

export function explicitOrganization(text: string, players: number, org: ExercisePlayerOrganization): string {
  const allocation = formatFromOrganization(players, org);
  if (text.includes(allocation)) return text;
  return `${allocation}. ${text}`;
}
