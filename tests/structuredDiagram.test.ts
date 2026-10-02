import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoachingSequence,
  buildDefaultStructuredDiagram,
  buildSemanticAnimation,
  buildSemanticCoachingMoments,
  buildWavyPath,
  calculateCameraViewBox,
  calculateMomentPriority,
  calculateOrientationFromNextAction,
  classifySemanticEvents,
  clusterDiagramPlayers,
  detectEquipmentGoals,
  easeInOutCubic,
  filterValidCoachingMoments,
  formatCoachingOverlayText,
  getCoachingPhaseState,
  getGoalGeometry,
  getTeamStyle,
  interpolateAnimationState,
  interpolateViewBox,
  isOpposedExercise,
  normalizeOrientation,
  prioritizeCoachingMoments,
  resolveCoachingMomentOverlaps,
  resolvePathCoordinates,
  safeStructuredDiagram,
  sanitizeCoachingSequence,
  validateDiagramAnimation,
  validateSemanticDiagram,
  validateStructuredDiagram,
} from '../src/services/structuredDiagram';
import { generateRealisticFootballPlan } from '../server';
import { buildLocalFallbackPlan } from '../src/services/trainingPlanService';
import { sanitizeGeminiPlan } from '../src/services/planValidation';
import {
  DiagramAnimation,
  DiagramCoachingMoment,
  DiagramCoachingSequence,
  DiagramPlayer,
  SemanticCoachingEvent,
  StructuredDrillDiagram,
} from '../src/types/session';

function validSampleDiagram(): StructuredDrillDiagram {
  return {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', role: 'attacker', x: 20, y: 30 },
      { id: 'p2', team: 'red', role: 'defender', x: 40, y: 30 },
    ],
    balls: [{ id: 'b1', x: 22, y: 30 }],
    cones: [{ id: 'c1', x: 10, y: 10 }],
    goals: [{ id: 'g1', type: 'mini', x: 95, y: 30, orientation: 'right' }],
    zones: [],
    paths: [{ id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' }],
  };
}

test('validateStructuredDiagram: accepts valid structured diagram', () => {
  const d = validSampleDiagram();
  const res = validateStructuredDiagram(d, 16);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
});

test('validateStructuredDiagram: rejects coordinates out of bounds (0-100)', () => {
  const d = validSampleDiagram();
  d.players[0].x = 105;
  const res = validateStructuredDiagram(d, 16);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('out of bounds')));

  const d2 = validSampleDiagram();
  d2.balls[0].y = -5;
  const res2 = validateStructuredDiagram(d2, 16);
  assert.equal(res2.ok, false);
  assert.ok(res2.errors.some(e => e.includes('out of bounds')));
});

test('validateStructuredDiagram: rejects duplicate player IDs', () => {
  const d = validSampleDiagram();
  d.players[1].id = 'p1';
  const res = validateStructuredDiagram(d, 16);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('Duplicate player id')));
});

test('validateStructuredDiagram: rejects invalid team values', () => {
  const d = validSampleDiagram();
  // @ts-expect-error test invalid team
  d.players[0].team = 'yellow';
  const res = validateStructuredDiagram(d, 16);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('invalid team')));
});

test('validateStructuredDiagram: rejects path referencing non-existent player ID', () => {
  const d = validSampleDiagram();
  d.paths[0].fromPlayerId = 'p99';
  const res = validateStructuredDiagram(d, 16);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('non-existent fromPlayerId')));

  const d2 = validSampleDiagram();
  d2.paths[0].toPlayerId = 'p100';
  const res2 = validateStructuredDiagram(d2, 16);
  assert.equal(res2.ok, false);
  assert.ok(res2.errors.some(e => e.includes('non-existent toPlayerId')));
});

test('validateStructuredDiagram: rejects diagram players exceeding available players', () => {
  const d = validSampleDiagram();
  const res = validateStructuredDiagram(d, 1);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('exceeds available players')));
});

test('buildDefaultStructuredDiagram: produces valid diagrams for all 5 blocks', () => {
  const blockTypes = ['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const;
  for (const blockType of blockTypes) {
    const diag = buildDefaultStructuredDiagram({
      blockType,
      playerCount: 16,
      exerciseName: `Test ${blockType}`,
      topic: 'Nhận bóng mở thân người',
    });
    const res = validateStructuredDiagram(diag, 16);
    assert.equal(res.ok, true, `Diagram for ${blockType} failed: ${res.errors.join(', ')}`);
    assert.ok(diag.players.length <= 16);
    assert.ok(diag.players.length > 0);
    assert.ok(diag.pitch.width === 100 && diag.pitch.height === 60);
  }
});

test('local fallback plans include valid diagram for each phase (16 players, 90min, 7v7)', () => {
  const plan = buildLocalFallbackPlan({
    players: 16,
    trainingFocus: 'Nhận bóng mở thân người',
    duration: 90,
    gameFormat: '7v7',
  });

  assert.equal(plan.phases.length, 5);
  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    assert.ok(phase.diagram, `Phase ${i + 1} is missing diagram`);
    const val = validateStructuredDiagram(phase.diagram, 16);
    assert.equal(val.ok, true, `Phase ${i + 1} diagram validation failed: ${val.errors.join(', ')}`);
  }
});

test('server fallback generator includes valid diagram for each phase (16 players, 90min, 7v7)', () => {
  const plan = generateRealisticFootballPlan(16, 'Nhận bóng mở thân người', 90, '7v7');
  assert.equal(plan.phases.length, 5);
  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    assert.ok(phase.diagram, `Server phase ${i + 1} is missing diagram`);
    const val = validateStructuredDiagram(phase.diagram, 16);
    assert.equal(val.ok, true, `Server phase ${i + 1} diagram validation failed: ${val.errors.join(', ')}`);
  }
});

test('sanitizeGeminiPlan preserves valid diagram and generates fallback diagram if missing', () => {
  const rawWithDiagram = {
    sessionTitle: 'Chuyên đề: Nhận bóng mở thân người',
    mainObjective: 'Rèn luyện kỹ năng',
    players: 16,
    duration: 90,
    gameFormat: '7v7',
    phases: [
      {
        id: 'phase-1',
        phase: 'Khởi động',
        exerciseName: 'Khởi động chuyền bóng',
        duration: 15,
        players: 16,
        area: '20 x 20 m',
        equipment: ['Bóng', 'Cọc tiêu'],
        organization: '4 nhóm 4',
        playerOrganization: { groups: 4, playersPerGroup: 4, leftover: 0, leftoverRole: 'none' },
        execution: 'Thực hiện bài tập.',
        coachingPoints: ['Kiểm tra vai.'],
        diagram: validSampleDiagram(),
      },
      {
        id: 'phase-2',
        phase: 'Kỹ thuật',
        exerciseName: 'Kỹ thuật mở thân',
        duration: 20,
        players: 16,
        area: '20 x 20 m',
        equipment: ['Bóng', 'Cọc tiêu'],
        organization: '4 nhóm 4',
        playerOrganization: { groups: 4, playersPerGroup: 4, leftover: 0, leftoverRole: 'none' },
        execution: 'Thực hiện bài tập.',
        coachingPoints: ['Mở thân người.'],
      },
      {
        id: 'phase-3',
        phase: 'Kỹ năng',
        exerciseName: 'Đối kháng 8v8',
        duration: 20,
        players: 16,
        area: '30 x 25 m',
        equipment: ['Bóng'],
        organization: '2 nhóm 8, thi đấu 8v8',
        playerOrganization: { groups: 2, playersPerGroup: 8, leftover: 0, leftoverRole: 'none' },
        execution: 'Thực hiện bài tập.',
        coachingPoints: ['Quan sát đối thủ.'],
      },
      {
        id: 'phase-4',
        phase: 'Thi đấu',
        exerciseName: 'Thi đấu 8v8 đại diện điều chỉnh (bối cảnh 7v7)',
        duration: 35,
        players: 16,
        area: '55 x 35 m',
        equipment: ['Bóng', 'Cầu môn'],
        organization: '2 nhóm 8, thi đấu 8v8',
        playerOrganization: { groups: 2, playersPerGroup: 8, leftover: 0, leftoverRole: 'none' },
        execution: 'Thực hiện bài tập.',
        coachingPoints: ['Tự do ra quyết định.'],
      },
    ],
  };

  const sanitized = sanitizeGeminiPlan(rawWithDiagram, {
    topic: 'Nhận bóng mở thân người',
    players: 16,
    duration: 90,
    gameFormat: '7v7',
  });

  assert.ok(sanitized);
  assert.equal(sanitized.phases.length, 4);
  for (const ph of sanitized.phases) {
    assert.ok(ph.diagram);
    const v = validateStructuredDiagram(ph.diagram, 16);
    assert.equal(v.ok, true);
  }
});

test('resolvePathCoordinates: accurately resolves player coordinates with boundary offsets', () => {
  const playerMap = new Map<string, DiagramPlayer>([
    ['p1', { id: 'p1', team: 'blue', role: 'passer', x: 20, y: 30 }],
    ['p2', { id: 'p2', team: 'red', role: 'receiver', x: 40, y: 30 }],
  ]);

  const toX = (pct: number) => pct * 10;
  const toY = (pct: number) => pct * 6;

  // 1. Valid pass path
  const path = { id: 'path1', type: 'pass' as const, fromPlayerId: 'p1', toPlayerId: 'p2' };
  const resolved = resolvePathCoordinates(path, playerMap, toX, toY, 18);

  assert.ok(resolved);
  assert.equal(resolved.id, 'path1');
  assert.equal(resolved.type, 'pass');
  assert.equal(resolved.fromX, 200);
  assert.equal(resolved.fromY, 180);
  assert.equal(resolved.toX, 400);
  assert.equal(resolved.toY, 180);
  // Starts after player marker and ends before target player marker
  assert.ok(resolved.startX > resolved.fromX);
  assert.ok(resolved.endX < resolved.toX);

  // 2. Missing toPlayerId or fromPlayerId
  assert.equal(resolvePathCoordinates({ id: 'p_bad', type: 'pass', fromPlayerId: 'p99' }, playerMap, toX, toY), null);
  assert.equal(resolvePathCoordinates({ id: 'p_bad2', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p99' }, playerMap, toX, toY), null);

  // 3. Wavy path generation for dribble
  const wavy = buildWavyPath(100, 100, 300, 100, 4, 6);
  assert.ok(wavy.startsWith('M 100.0 100.0'));
  assert.ok(wavy.includes('Q'));

  // 4. Goal geometry orientation check
  const leftGoal = getGoalGeometry({ id: 'g1', type: 'mini', x: 10, y: 50, orientation: 'left' }, toX, toY);
  assert.equal(leftGoal.isMini, true);
  assert.equal(leftGoal.orientation, 'left');
  assert.ok(leftGoal.pathD.includes('M'));

  const rightGoal = getGoalGeometry({ id: 'g2', type: 'standard', x: 90, y: 50, orientation: 'right' }, toX, toY);
  assert.equal(rightGoal.isMini, false);
  assert.equal(rightGoal.orientation, 'right');

  // 5. Team styling
  assert.equal(getTeamStyle('blue').fill, '#2563eb');
  assert.equal(getTeamStyle('red').fill, '#dc2626');
  assert.equal(getTeamStyle('goalkeeper').label, 'Thủ môn');
});

// =============================================================================
// TASK D3: SEMANTIC DIAGRAM CONSISTENCY & TEST CASE (16 PLAYERS, 7V7, 90 MIN)
// =============================================================================

test('D3 TEST CASE: 16 players, Nhận bóng mở thân người, 90min, 7v7 semantic diagram verification across phases 1-5', () => {
  const plan = buildLocalFallbackPlan({
    players: 16,
    trainingFocus: 'Nhận bóng mở thân người',
    duration: 90,
    gameFormat: '7v7',
  });

  assert.equal(plan.phases.length, 5);

  // PHASE 1: Warm-up
  // - organization says 8 groups of 2
  // - diagram shows 8 visually distinguishable pairs
  // - no invented opposition (all blue)
  // - no goals (equipment has none)
  const p1 = plan.phases[0];
  assert.match(p1.organization, /8 nhóm 2|8 cặp/i);
  assert.equal(p1.playerOrganization?.groups, 8);
  assert.equal(p1.playerOrganization?.playersPerGroup, 2);
  assert.ok(p1.diagram);
  assert.equal(p1.diagram.players.length, 16);
  assert.ok(p1.diagram.players.every(p => p.team === 'blue'), 'Phase 1 must have no invented red opposition');
  assert.equal(p1.diagram.goals.length, 0, 'Phase 1 must not invent goals when equipment has none');
  assert.equal(p1.diagram.zones.length, 0, 'Phase 1 must not invent tactical lanes');
  const p1Clusters = clusterDiagramPlayers(p1.diagram.players, 18);
  assert.equal(p1Clusters.length, 8, 'Phase 1 diagram must show exactly 8 visually distinguishable pairs');
  assert.ok(p1Clusters.every(c => c.length === 2), 'Each pair cluster in Phase 1 must contain exactly 2 players');

  // PHASE 2: Technical
  // - organization says 4 groups of 4
  // - diagram shows 4 groups of 4
  // - no invented opposition (all blue)
  // - no goals
  const p2 = plan.phases[1];
  assert.match(p2.organization, /4 nhóm 4/i);
  assert.ok(p2.diagram);
  assert.equal(p2.diagram.players.length, 16);
  assert.ok(p2.diagram.players.every(p => p.team === 'blue'), 'Phase 2 must have no invented red opposition');
  assert.equal(p2.diagram.goals.length, 0, 'Phase 2 must not invent goals');
  const p2Clusters = clusterDiagramPlayers(p2.diagram.players, 20);
  assert.equal(p2Clusters.length, 4, 'Phase 2 diagram must show exactly 4 distinct groups');
  assert.ok(p2Clusters.every(c => c.length === 4), 'Each group cluster in Phase 2 must contain exactly 4 players');

  // PHASE 3: Skill (opposed)
  // - diagram structure matches the actual opposed exercise description (8 blue, 8 red)
  // - do NOT show mini goals unless the exercise actually specifies them (equipment has no goals)
  const p3 = plan.phases[2];
  assert.ok(p3.diagram);
  assert.equal(p3.diagram.players.length, 16);
  const p3Blues = p3.diagram.players.filter(p => p.team === 'blue');
  const p3Reds = p3.diagram.players.filter(p => p.team === 'red');
  assert.equal(p3Blues.length, 8, 'Phase 3 must visually distinguish opposing teams (8 attackers)');
  assert.equal(p3Reds.length, 8, 'Phase 3 must visually distinguish opposing teams (8 defenders)');
  assert.equal(p3.diagram.goals.length, 0, 'Phase 3 must not show mini goals because equipment does not specify them');

  // PHASE 4: Small-sided game
  // - specifies 4 mini goals -> show exactly 4 mini goals
  // - tactical lanes described -> render 3 zones
  // - 16 players (8 blue, 8 red)
  const p4 = plan.phases[3];
  assert.ok(p4.diagram);
  assert.equal(p4.diagram.players.length, 16);
  assert.equal(p4.diagram.goals.length, 4, 'Phase 4 must render exactly 4 mini goals');
  assert.ok(p4.diagram.goals.every(g => g.type === 'mini'), 'All 4 goals in Phase 4 must be mini goals');
  assert.equal(p4.diagram.zones.length, 3, 'Phase 4 must render 3 tactical zones since 3 channels are described');

  // PHASE 5: Match (8v8 adapted match)
  // - shows 16 total players
  // - teams are correctly separated (2 GKs, 7 blue outfield, 7 red outfield)
  // - exactly 2 match goals if specified
  const p5 = plan.phases[4];
  assert.ok(p5.diagram);
  assert.equal(p5.diagram.players.length, 16);
  const p5Gks = p5.diagram.players.filter(p => p.team === 'goalkeeper');
  const p5Blues = p5.diagram.players.filter(p => p.team === 'blue');
  const p5Reds = p5.diagram.players.filter(p => p.team === 'red');
  assert.equal(p5Gks.length, 2, 'Phase 5 must show 2 goalkeepers');
  assert.equal(p5Blues.length, 7, 'Phase 5 must show 7 blue outfield players');
  assert.equal(p5Reds.length, 7, 'Phase 5 must show 7 red outfield players');
  assert.equal(p5.diagram.goals.length, 2, 'Phase 5 must render exactly 2 match goals');
  assert.ok(p5.diagram.goals.every(g => g.type === 'standard'), 'Phase 5 goals must be standard match goals');

  // All 5 phases must pass semantic validation
  for (let i = 0; i < 5; i++) {
    const phase = plan.phases[i];
    const sem = validateSemanticDiagram(phase.diagram!, {
      playerCount: 16,
      playerOrganization: phase.playerOrganization,
      equipment: phase.equipment,
      organization: phase.organization,
      execution: phase.execution,
      blockType: (['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const)[i],
    });
    assert.equal(sem.ok, true, `Phase ${i + 1} semantic validation failed: ${sem.errors.join(', ')}`);
  }
});

test('detectEquipmentGoals: strictly respects equipment and avoids false positives from execution text', () => {
  // 1. Equipment with no goals, execution mentioning "bàn thắng" or "ghi bàn"
  const noGoals = detectEquipmentGoals(
    ['12 Nón phân làn', '8 Quả bóng', 'Áo bib 3 màu'],
    'Chia 2 đội thi đấu trong không gian hẹp.',
    'Bàn thắng bình thường được ghi nhận khi đội hoàn thành chuỗi chuyền bóng.'
  );
  assert.equal(noGoals.hasGoals, false);
  assert.equal(noGoals.totalExpected, 0);

  // 2. Equipment with 4 mini goals
  const mini4 = detectEquipmentGoals(['4 Khung thành nhỏ', '10 Quả bóng', 'Áo bib 2 đội']);
  assert.equal(mini4.hasGoals, true);
  assert.equal(mini4.isMini, true);
  assert.equal(mini4.miniGoals, 4);
  assert.equal(mini4.totalExpected, 4);

  // 3. Equipment with 2 match goals
  const match2 = detectEquipmentGoals(['2 Khung thành sân 7', 'Bóng thi đấu tiêu chuẩn']);
  assert.equal(match2.hasGoals, true);
  assert.equal(match2.isMini, false);
  assert.equal(match2.matchGoals, 2);
  assert.equal(match2.totalExpected, 2);
});

test('validateSemanticDiagram: rejects semantic violations and safeStructuredDiagram recovers cleanly', () => {
  const basePairDiag = buildDefaultStructuredDiagram({
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
  });

  // 1. Rejects if 8 groups of 2 is diagrammed as 4 groups of 4
  const quadDiag = buildDefaultStructuredDiagram({
    blockType: 'technical',
    playerCount: 16,
    playerOrganization: { groups: 4, playersPerGroup: 4, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 4 nhóm 4',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
  });

  const mismatchRes = validateSemanticDiagram(quadDiag, {
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
    blockType: 'warm_up',
  });
  assert.equal(mismatchRes.ok, false);
  assert.ok(mismatchRes.errors.some(e => e.includes('does not show 8 distinct pairs')));

  // 2. Rejects invented goals when equipment has none
  const inventedGoalDiag = structuredClone(basePairDiag);
  inventedGoalDiag.goals.push({ id: 'g1', type: 'mini', x: 10, y: 50, orientation: 'left' });
  const goalMismatch = validateSemanticDiagram(inventedGoalDiag, {
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
    blockType: 'warm_up',
  });
  assert.equal(goalMismatch.ok, false);
  assert.ok(goalMismatch.errors.some(e => e.includes('does not specify any goals')));

  // 3. Rejects artificial red defenders in unopposed exercise
  const redOppositionDiag = structuredClone(basePairDiag);
  redOppositionDiag.players[0].team = 'red';
  const oppMismatch = validateSemanticDiagram(redOppositionDiag, {
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2 không đối kháng',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
    blockType: 'warm_up',
  });
  assert.equal(oppMismatch.ok, false);
  assert.ok(oppMismatch.errors.some(e => e.includes('Unopposed exercise contains artificial opposing red players')));

  // 4. safeStructuredDiagram recovers cleanly from semantic mismatch
  const recovered = safeStructuredDiagram(quadDiag, 16, {
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
  });
  const recVal = validateSemanticDiagram(recovered, {
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
    blockType: 'warm_up',
  });
  assert.equal(recVal.ok, true, `Recovered diagram must pass semantic validation: ${recVal.errors.join(', ')}`);
  assert.equal(clusterDiagramPlayers(recovered.players, 18).length, 8);
});

// =============================================================================
// TASK D4 TESTS: ANIMATION FOUNDATION FOR STRUCTURED TRAINING DIAGRAMS
// =============================================================================

test('D4: validateDiagramAnimation accepts spec-conforming animation data model', () => {
  const sample = validSampleDiagram();
  const validAnimation: DiagramAnimation = {
    duration: 8,
    steps: [
      {
        id: 'step1',
        start: 0,
        duration: 2,
        actions: [
          {
            type: 'playerMove',
            playerId: 'p2',
            to: { x: 45, y: 35 },
          },
          {
            type: 'ballPass',
            ballId: 'b1',
            fromPlayerId: 'p1',
            toPlayerId: 'p2',
          },
        ],
      },
      {
        id: 'step2',
        start: 2,
        duration: 2,
        actions: [
          {
            type: 'ballDribble',
            ballId: 'b1',
            playerId: 'p2',
            to: { x: 60, y: 40 },
          },
        ],
      },
    ],
  };

  const res = validateDiagramAnimation(validAnimation, sample.players, sample.balls);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);

  // Also integrated into validateStructuredDiagram
  const fullDiagram: StructuredDrillDiagram = { ...sample, animation: validAnimation };
  const fullRes = validateStructuredDiagram(fullDiagram, 16);
  assert.equal(fullRes.ok, true);
});

test('D4: validateDiagramAnimation rejects unsupported action types or bad coordinates', () => {
  const sample = validSampleDiagram();

  // 1. Rejects unauthorized action type
  const badActionAnim = {
    duration: 6,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2,
        actions: [
          { type: 'playerShoot', playerId: 'p1', target: 'goal' },
        ],
      },
    ],
  };
  const res1 = validateDiagramAnimation(badActionAnim, sample.players, sample.balls);
  assert.equal(res1.ok, false);
  assert.ok(res1.errors.some((e) => e.includes('unsupported action type')));

  // 2. Rejects out-of-bounds coordinates
  const outOfBoundsAnim: DiagramAnimation = {
    duration: 4,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2,
        actions: [
          { type: 'playerMove', playerId: 'p1', to: { x: 105, y: 50 } },
        ],
      },
    ],
  };
  const res2 = validateDiagramAnimation(outOfBoundsAnim, sample.players, sample.balls);
  assert.equal(res2.ok, false);
  assert.ok(res2.errors.some((e) => e.includes('within bounds')));

  // 3. Rejects non-existent player or ball references
  const nonExistentAnim: DiagramAnimation = {
    duration: 4,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2,
        actions: [
          { type: 'ballPass', ballId: 'b99', fromPlayerId: 'p1', toPlayerId: 'p2' },
        ],
      },
    ],
  };
  const res3 = validateDiagramAnimation(nonExistentAnim, sample.players, sample.balls);
  assert.equal(res3.ok, false);
  assert.ok(res3.errors.some((e) => e.includes('non-existent ballId')));
});

test('D4: interpolateAnimationState calculates exact playerMove, ballPass, and ballDribble coordinates', () => {
  const baseDiagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30 },
      { id: 'p2', team: 'blue', x: 60, y: 30 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [],
    animation: {
      duration: 6,
      steps: [
        {
          id: 'step1',
          start: 0,
          duration: 2,
          actions: [
            { type: 'playerMove', playerId: 'p1', to: { x: 40, y: 50 } },
            { type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' },
          ],
        },
        {
          id: 'step2',
          start: 2,
          duration: 2,
          actions: [
            { type: 'ballDribble', ballId: 'b1', playerId: 'p2', to: { x: 80, y: 40 } },
          ],
        },
      ],
    },
  };

  // 1. Initial state at t = 0: exactly matches diagram.players & diagram.balls
  const stateT0 = interpolateAnimationState(baseDiagram, 0);
  assert.equal(stateT0.players[0].x, 20);
  assert.equal(stateT0.players[0].y, 30);
  assert.equal(stateT0.players[1].x, 60);
  assert.equal(stateT0.players[1].y, 30);
  assert.equal(stateT0.balls[0].x, 20);
  assert.equal(stateT0.balls[0].y, 30);

  // 2. Midpoint of Step 1 (t = 1.0):
  // p1 moves from (20, 30) to (40, 50) -> progress 50% => (30, 40)
  // b1 passes from p1 (20, 30) to p2 (60, 30) -> progress 50% => (40, 30)
  const stateT1 = interpolateAnimationState(baseDiagram, 1.0);
  assert.equal(stateT1.players[0].x, 30);
  assert.equal(stateT1.players[0].y, 40);
  assert.equal(stateT1.balls[0].x, 40);
  assert.equal(stateT1.balls[0].y, 30);

  // 3. End of Step 1 / start of Step 2 (t = 2.0):
  // p1 reached (40, 50)
  // b1 reached p2 at (60, 30)
  const stateT2 = interpolateAnimationState(baseDiagram, 2.0);
  assert.equal(stateT2.players[0].x, 40);
  assert.equal(stateT2.players[0].y, 50);
  assert.equal(stateT2.balls[0].x, 60);
  assert.equal(stateT2.balls[0].y, 30);

  // 4. Midpoint of Step 2 (t = 3.0):
  // p2 and b1 dribble from (60, 30) to (80, 40) -> progress 50% => (70, 35)
  const stateT3 = interpolateAnimationState(baseDiagram, 3.0);
  assert.equal(stateT3.players[1].x, 70);
  assert.equal(stateT3.players[1].y, 35);
  assert.equal(stateT3.balls[0].x, 70);
  assert.equal(stateT3.balls[0].y, 35);

  // 5. End of Step 2 (t >= 4.0):
  // p2 and b1 arrived at (80, 40)
  const stateT4 = interpolateAnimationState(baseDiagram, 4.0);
  assert.equal(stateT4.players[1].x, 80);
  assert.equal(stateT4.players[1].y, 40);
  assert.equal(stateT4.balls[0].x, 80);
  assert.equal(stateT4.balls[0].y, 40);

  // 6. Resetting / stopping restores original positions
  const stateReset = interpolateAnimationState(baseDiagram, 0);
  assert.equal(stateReset.players[0].x, 20);
  assert.equal(stateReset.players[0].y, 30);
  assert.equal(stateReset.balls[0].x, 20);
  assert.equal(stateReset.balls[0].y, 30);
});

test('D4: buildSemanticAnimation automatically derives a valid ordered sequence from drill paths', () => {
  const diagWithPaths: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 25, y: 30 },
      { id: 'p2', team: 'blue', x: 50, y: 30 },
      { id: 'p3', team: 'blue', x: 75, y: 50 },
    ],
    balls: [{ id: 'b1', x: 25, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [
      { id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' },
      { id: 'path2', type: 'dribble', fromPlayerId: 'p2', toPlayerId: 'p3' },
    ],
  };

  const anim = buildSemanticAnimation(diagWithPaths);
  assert.ok(anim.duration >= 4);
  assert.equal(anim.steps.length, 2);

  // Step 1: ballPass from p1 to p2
  assert.equal(anim.steps[0].actions[0].type, 'ballPass');
  const passAct = anim.steps[0].actions[0] as { type: 'ballPass'; ballId: string; fromPlayerId: string; toPlayerId: string };
  assert.equal(passAct.fromPlayerId, 'p1');
  assert.equal(passAct.toPlayerId, 'p2');

  // Step 2: ballDribble by p2 towards p3
  assert.equal(anim.steps[1].actions[0].type, 'ballDribble');
  const dribbleAct = anim.steps[1].actions[0] as { type: 'ballDribble'; ballId: string; playerId: string; to: { x: number; y: number } };
  assert.equal(dribbleAct.playerId, 'p2');
  assert.equal(dribbleAct.to.x, 75);
  assert.equal(dribbleAct.to.y, 50);

  // Validate the derived animation
  const val = validateDiagramAnimation(anim, diagWithPaths.players, diagWithPaths.balls);
  assert.equal(val.ok, true, `Derived animation should validate: ${val.errors.join(', ')}`);
});

// =============================================================================
// TASK D5 TESTS: COACHING MOMENTS ON TOP OF ANIMATION ENGINE
// =============================================================================

test('D5: validateDiagramAnimation accepts spec-conforming coaching moments model', () => {
  const sample = validSampleDiagram();
  const validAnimationWithCoaching: DiagramAnimation = {
    duration: 10,
    steps: [
      {
        id: 'step1',
        start: 0,
        duration: 3,
        actions: [
          { type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' },
        ],
      },
      {
        id: 'step2',
        start: 3,
        duration: 3,
        actions: [
          { type: 'playerMove', playerId: 'p2', to: { x: 50, y: 30 } },
        ],
      },
    ],
    coachingMoments: [
      {
        id: 'coach1',
        time: 3.2,
        duration: 2.5,
        playerId: 'p2',
        title: 'Mở thân người',
        text: 'Kiểm tra vai trước khi nhận và mở thân người về hướng tấn công.',
        focus: {
          zoom: 1.8,
        },
        highlight: true,
        orientation: 45,
      },
    ],
  };

  const res = validateDiagramAnimation(validAnimationWithCoaching, sample.players, sample.balls);
  assert.equal(res.ok, true, `Validation should pass: ${res.errors.join(', ')}`);
  assert.deepEqual(res.errors, []);
});

test('D5: validateDiagramAnimation rejects invalid coaching moments', () => {
  const sample = validSampleDiagram();

  // 1. Rejects duplicate coaching moment id
  const dupIdAnim: DiagramAnimation = {
    duration: 10,
    steps: [{ id: 's1', start: 0, duration: 2, actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 30, y: 30 } }] }],
    coachingMoments: [
      { id: 'cm1', time: 1.0, duration: 2.0, playerId: 'p1', title: 'T1', text: 'Text 1' },
      { id: 'cm1', time: 3.5, duration: 2.0, playerId: 'p1', title: 'T2', text: 'Text 2' },
    ],
  };
  const res1 = validateDiagramAnimation(dupIdAnim, sample.players, sample.balls);
  assert.equal(res1.ok, false);
  assert.ok(res1.errors.some((e) => e.includes('Duplicate coaching moment id')));

  // 2. Rejects out-of-range zoom (< 1.0 or > 3.0)
  const badZoomAnim: DiagramAnimation = {
    duration: 8,
    steps: [{ id: 's1', start: 0, duration: 2, actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 30, y: 30 } }] }],
    coachingMoments: [
      { id: 'cm2', time: 1.0, duration: 2.0, playerId: 'p1', title: 'T', text: 'Text', focus: { zoom: 3.5 } },
    ],
  };
  const res2 = validateDiagramAnimation(badZoomAnim, sample.players, sample.balls);
  assert.equal(res2.ok, false);
  assert.ok(res2.errors.some((e) => e.includes('zoom must be between 1.0 and 3.0')));

  // 3. Rejects out-of-range orientation (< 0 or >= 360)
  const badOrientationAnim: DiagramAnimation = {
    duration: 8,
    steps: [{ id: 's1', start: 0, duration: 2, actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 30, y: 30 } }] }],
    coachingMoments: [
      { id: 'cm3', time: 1.0, duration: 2.0, playerId: 'p1', title: 'T', text: 'Text', orientation: 360 },
    ],
  };
  const res3 = validateDiagramAnimation(badOrientationAnim, sample.players, sample.balls);
  assert.equal(res3.ok, false);
  assert.ok(res3.errors.some((e) => e.includes('orientation must be between 0 and 359 degrees')));

  // 4. Rejects time + duration exceeding animation duration
  const exceedDurationAnim: DiagramAnimation = {
    duration: 5,
    steps: [{ id: 's1', start: 0, duration: 2, actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 30, y: 30 } }] }],
    coachingMoments: [
      { id: 'cm4', time: 4.0, duration: 2.0, playerId: 'p1', title: 'T', text: 'Text' },
    ],
  };
  const res4 = validateDiagramAnimation(exceedDurationAnim, sample.players, sample.balls);
  assert.equal(res4.ok, false);
  assert.ok(res4.errors.some((e) => e.includes('exceeds animation duration')));

  // 5. Rejects non-existent playerId
  const badPlayerAnim: DiagramAnimation = {
    duration: 8,
    steps: [{ id: 's1', start: 0, duration: 2, actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 30, y: 30 } }] }],
    coachingMoments: [
      { id: 'cm5', time: 1.0, duration: 2.0, playerId: 'p999', title: 'T', text: 'Text' },
    ],
  };
  const res5 = validateDiagramAnimation(badPlayerAnim, sample.players, sample.balls);
  assert.equal(res5.ok, false);
  assert.ok(res5.errors.some((e) => e.includes('non-existent playerId')));
});

test('D5: filterValidCoachingMoments safely handles invalid or corrupt coaching moments', () => {
  const validPlayerIds = new Set(['p1', 'p2']);
  const rawMoments = [
    { id: 'cm-ok', time: 2.0, duration: 2.0, playerId: 'p1', title: 'Hợp lệ', text: 'Nội dung chuẩn', orientation: 90, focus: { zoom: 2.0 } },
    { id: 'cm-bad-player', time: 1.0, duration: 2.0, playerId: 'p_none', title: 'Lỗi', text: 'Sai ID' },
    { id: 'cm-bad-time', time: 9.0, duration: 2.0, playerId: 'p1', title: 'Lỗi', text: 'Quá giờ' },
    { id: 'cm-bad-duration', time: 2.0, duration: -1, playerId: 'p1', title: 'Lỗi', text: 'Duration âm' },
    { id: 'cm-ok', time: 3.0, duration: 1.0, playerId: 'p2', title: 'Trùng', text: 'Trùng id' },
  ];

  const filtered = filterValidCoachingMoments(rawMoments, validPlayerIds, 8.0);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'cm-ok');
  assert.equal(filtered[0].playerId, 'p1');
  assert.equal(filtered[0].orientation, 90);
  assert.equal(filtered[0].focus?.zoom, 2.0);
});

test('D5: calculateCameraViewBox keeps player centered and clamps within pitch dimensions', () => {
  // Center player (500, 300) with zoom 2.0: pitch is 1000x600, w=500, h=300
  // Centered window: minX = 500 - 250 = 250, minY = 300 - 150 = 150
  const centerBox = calculateCameraViewBox(500, 300, 2.0, 1000, 600);
  assert.equal(centerBox.width, 500);
  assert.equal(centerBox.height, 300);
  assert.equal(centerBox.minX, 250);
  assert.equal(centerBox.minY, 150);
  assert.equal(centerBox.viewBox, '250 150 500 300');

  // Player near top-left corner (20, 20): clamped so minX >= 0, minY >= 0
  const cornerBox = calculateCameraViewBox(20, 20, 2.0, 1000, 600);
  assert.equal(cornerBox.minX, 0);
  assert.equal(cornerBox.minY, 0);
  assert.equal(cornerBox.width, 500);
  assert.equal(cornerBox.height, 300);

  // Player near bottom-right corner (980, 580): clamped to stay strictly within pitch
  const bottomCorner = calculateCameraViewBox(980, 580, 2.0, 1000, 600);
  assert.equal(bottomCorner.minX, 500);
  assert.equal(bottomCorner.minY, 300);
  assert.ok(bottomCorner.minX + bottomCorner.width <= 1000);
  assert.ok(bottomCorner.minY + bottomCorner.height <= 600);
});

test('D5: normalizeOrientation handles valid angles, wraparound, and invalid inputs', () => {
  assert.equal(normalizeOrientation(45), 45);
  assert.equal(normalizeOrientation(360), 0);
  assert.equal(normalizeOrientation(-90), 270);
  assert.equal(normalizeOrientation(720), 0);
  assert.equal(normalizeOrientation('45'), undefined);
  assert.equal(normalizeOrientation(NaN), undefined);
  assert.equal(normalizeOrientation(undefined), undefined);
});

test('D5: interpolateAnimationState updates player orientation during and after coaching moment timestamp', () => {
  const diagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30, orientation: 0 },
      { id: 'p2', team: 'blue', x: 60, y: 30, orientation: 0 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [],
    animation: {
      duration: 8,
      steps: [
        {
          id: 'step1',
          start: 0,
          duration: 3,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
      ],
      coachingMoments: [
        {
          id: 'coach1',
          time: 2.0,
          duration: 2.0,
          playerId: 'p2',
          title: 'Mở thân người',
          text: 'Mở thân người 45 độ',
          orientation: 45,
        },
      ],
    },
  };

  // 1. Before coaching moment (t = 1.0): p2 orientation is 0
  const stateBefore = interpolateAnimationState(diagram, 1.0);
  assert.equal(stateBefore.players.find((p) => p.id === 'p2')?.orientation, 0);

  // 2. At coaching moment trigger (t = 2.0): p2 orientation rotates to 45
  const stateAt = interpolateAnimationState(diagram, 2.0);
  assert.equal(stateAt.players.find((p) => p.id === 'p2')?.orientation, 45);

  // 3. After coaching moment (t = 3.5): p2 retains orientation 45 for next action
  const stateAfter = interpolateAnimationState(diagram, 3.5);
  assert.equal(stateAfter.players.find((p) => p.id === 'p2')?.orientation, 45);
});

test('D5: buildSemanticCoachingMoments grounds coaching moments in pass receiver and drill context', () => {
  const diagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30 },
      { id: 'p2', team: 'blue', x: 60, y: 30 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [{ id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' }],
  };

  const anim = buildSemanticAnimation(diagram, 'Cầu thủ quan sát kiểm tra vai trước khi nhận bóng');
  assert.ok(anim.coachingMoments && anim.coachingMoments.length > 0);

  const cm = anim.coachingMoments[0];
  assert.equal(cm.playerId, 'p2'); // Receiver
  assert.ok(cm.time >= 0);
  assert.ok(cm.duration > 0);
  assert.ok(cm.time + cm.duration <= anim.duration);
  assert.equal(cm.orientation, 45);
  assert.ok(cm.title.includes('Kiểm tra vai') || cm.title.includes('Mở thân'));
});

// =============================================================================
// TASK D6 TESTS: COACHING-MOMENT PRESENTATION POLISH
// =============================================================================

test('D6: easeInOutCubic produces a deterministic smooth S-curve bounded in [0, 1]', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);

  // Boundary clamping
  assert.equal(easeInOutCubic(-0.5), 0);
  assert.equal(easeInOutCubic(1.5), 1);

  // Monotonic progression
  let prev = 0;
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const val = easeInOutCubic(t);
    assert.ok(val >= prev, `Value at ${t} (${val}) must be >= previous (${prev})`);
    assert.ok(val >= 0 && val <= 1);
    prev = val;
  }
});

test('D6: getCoachingPhaseState calculates accurate enter, hold, and exit phase state', () => {
  const duration = 4.0; // 4 seconds presentation time

  // 1. Enter phase (elapsed = 0.5s -> progress = 0.125 / 0.25 => 50% into enter)
  const enterState = getCoachingPhaseState(0.5, duration);
  assert.equal(enterState.phase, 'enter');
  assert.ok(enterState.cameraEase > 0 && enterState.cameraEase < 1);
  assert.ok(enterState.highlightOpacity > 0);
  assert.ok(enterState.orientationProgress > 0 && enterState.orientationProgress < 1);

  // 2. Hold phase (elapsed = 2.0s -> progress = 0.50 => midpoint of hold)
  const holdState = getCoachingPhaseState(2.0, duration);
  assert.equal(holdState.phase, 'hold');
  assert.equal(holdState.cameraEase, 1.0);
  assert.equal(holdState.textOpacity, 1.0);
  assert.equal(holdState.highlightOpacity, 1.0);
  assert.equal(holdState.orientationProgress, 1.0);

  // 3. Exit phase (elapsed = 3.6s -> progress = 0.90 => exit)
  const exitState = getCoachingPhaseState(3.6, duration);
  assert.equal(exitState.phase, 'exit');
  assert.ok(exitState.cameraEase < 1.0);
  assert.ok(exitState.highlightOpacity < 1.0);
  assert.equal(exitState.orientationProgress, 1.0); // Retains orientation

  // 4. Over elapsed clamps gracefully
  const finishedState = getCoachingPhaseState(5.0, duration);
  assert.equal(finishedState.phase, 'exit');
  assert.equal(finishedState.progress, 1.0);
  assert.equal(finishedState.cameraEase, 0);
});

test('D6: interpolateViewBox smoothly blends full-pitch and focused viewBoxes', () => {
  const fullPitch = { minX: 0, minY: 0, width: 1000, height: 600 };
  const targetZoom = { minX: 250, minY: 150, width: 500, height: 300 };

  // Factor 0 = full pitch
  const start = interpolateViewBox(fullPitch, targetZoom, 0);
  assert.equal(start.viewBox, '0 0 1000 600');

  // Factor 1 = target zoom
  const end = interpolateViewBox(fullPitch, targetZoom, 1);
  assert.equal(end.viewBox, '250 150 500 300');

  // Factor 0.5 = exact midpoint
  const mid = interpolateViewBox(fullPitch, targetZoom, 0.5);
  assert.equal(mid.minX, 125);
  assert.equal(mid.minY, 75);
  assert.equal(mid.width, 750);
  assert.equal(mid.height, 450);
  assert.equal(mid.viewBox, '125 75 750 450');
});

test('D6: calculateOrientationFromNextAction derives correct geometric angle from receiver to next target', () => {
  const receiver = { x: 50, y: 30 };

  // 1. Target directly right (+X): 0 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 70, y: 30 }), 0);

  // 2. Target diagonal bottom-right (+X, +Y): 45 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 70, y: 50 }), 45);

  // 3. Target directly down (+Y): 90 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 50, y: 50 }), 90);

  // 4. Target directly left (-X): 180 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 30, y: 30 }), 180);

  // 5. Target directly up (-Y): 270 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 50, y: 10 }), 270);

  // 6. Coincident coordinates: sensible fallback 45 degrees
  assert.equal(calculateOrientationFromNextAction(receiver, { x: 50, y: 30 }), 45);
});

test('D6: resolveCoachingMomentOverlaps drops overlapping coaching moments and preserves chronological order', () => {
  const moments: DiagramCoachingMoment[] = [
    { id: 'cm3', time: 5.0, duration: 2.0, playerId: 'p1', title: 'T3', text: 'Text 3' },
    { id: 'cm1', time: 1.0, duration: 2.0, playerId: 'p1', title: 'T1', text: 'Text 1' },
    { id: 'cm2_conflict', time: 1.5, duration: 2.0, playerId: 'p2', title: 'T2', text: 'Conflict' },
    { id: 'cm4', time: 7.5, duration: 2.0, playerId: 'p2', title: 'T4', text: 'Text 4' },
  ];

  const resolved = resolveCoachingMomentOverlaps(moments, 1.0);
  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].id, 'cm1'); // t = 1.0
  assert.equal(resolved[1].id, 'cm3'); // t = 5.0
  assert.equal(resolved[2].id, 'cm4'); // t = 7.5
  // cm2_conflict (t=1.5) was correctly dropped because it conflicted with cm1 (t=1.0)
});

test('D6: formatCoachingOverlayText bounds text length safely without mutating original source', () => {
  const shortText = 'Kiểm tra vai trước khi nhận bóng.';
  assert.equal(formatCoachingOverlayText(shortText, 140), shortText);

  const longText = 'Đây là một lời giải thích huấn luyện rất dài nhằm kiểm tra tính an toàn của giao diện người dùng để không bao giờ bị tràn layout hoặc tạo ra các thẻ quá lớn trên màn hình điện thoại hoặc máy tính bảng khi hiển thị sơ đồ chiến thuật bóng đá chuyên nghiệp.';
  const formatted = formatCoachingOverlayText(longText, 100);
  assert.ok(formatted.length <= 100);
  assert.ok(formatted.endsWith('...'));
  // Source string remains untouched
  assert.ok(longText.length > 200);

  // Safe against non-string
  assert.equal(formatCoachingOverlayText('' as any, 100), '');
});

test('D6: buildSemanticCoachingMoments grounds pre-reception timing and geometric orientation from next action', () => {
  // Pass from p1 -> p2 (step 1), followed by p2 dribbling towards p3 at (80, 50) (step 2)
  const diagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 20 },
      { id: 'p2', team: 'blue', x: 50, y: 20 },
      { id: 'p3', team: 'blue', x: 80, y: 50 },
    ],
    balls: [{ id: 'b1', x: 20, y: 20 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [
      { id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' },
      { id: 'path2', type: 'dribble', fromPlayerId: 'p2', toPlayerId: 'p3' },
    ],
  };

  const anim = buildSemanticAnimation(diagram, 'Cầu thủ quan sát mở thân người đón bóng');
  assert.ok(anim.coachingMoments && anim.coachingMoments.length > 0);

  const cm = anim.coachingMoments[0];
  // 1. Targets receiver
  assert.equal(cm.playerId, 'p2');

  // 2. Pre-reception timing: step 1 is [0s, 2s]. Trigger is at 75% = 1.5s (before ball arrives at 2.0s)
  assert.equal(cm.time, 1.5);
  assert.ok(cm.time < 2.0, 'Coaching moment must trigger before pass arrival');

  // 3. Orientation calculated geometrically: from p2 (50, 20) toward p3 (80, 50) => dx=30, dy=30 => 45°
  assert.equal(cm.orientation, 45);

  // 4. Overlap resolution is enforced
  const noOverlap = resolveCoachingMomentOverlaps(anim.coachingMoments);
  assert.equal(anim.coachingMoments.length, noOverlap.length);
});

test('D6: TEST CASE: 16 players, Nhận bóng mở thân người, 90 min, 7v7 technical sequence presentation verification', () => {
  const diag = buildDefaultStructuredDiagram({
    blockType: 'technical',
    playerCount: 16,
    exerciseName: 'Bài tập chuyền nhận bóng mở thân người',
    organization: '16 cầu thủ chia thành 4 nhóm 4 tại 4 trạm',
    execution: 'Cầu thủ p1 chuyền bóng cho p2, p2 quan sát kiểm tra vai mở thân người rê bóng về cọc tiêu',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
  });

  assert.ok(diag.animation, 'Must have structured animation');
  const anim = diag.animation!;
  assert.ok(anim.duration >= 4, 'Animation duration must be valid');
  assert.ok(anim.coachingMoments && anim.coachingMoments.length >= 1, 'Must have coaching moments');

  const cm = anim.coachingMoments![0];
  assert.ok(cm.time >= 0 && cm.time + cm.duration <= anim.duration);
  assert.ok(cm.playerId.length > 0);
  assert.ok(diag.players.some((p) => p.id === cm.playerId));
  assert.ok(cm.orientation !== undefined && cm.orientation >= 0 && cm.orientation < 360);

  // Verify presentation phase state progression
  const enterState = getCoachingPhaseState(0.2, cm.duration);
  assert.equal(enterState.phase, 'enter');
  assert.ok(enterState.cameraEase >= 0);

  const holdState = getCoachingPhaseState(cm.duration * 0.5, cm.duration);
  assert.equal(holdState.phase, 'hold');
  assert.equal(holdState.cameraEase, 1.0);
  assert.equal(holdState.textOpacity, 1.0);

  const exitState = getCoachingPhaseState(cm.duration * 0.9, cm.duration);
  assert.equal(exitState.phase, 'exit');
  assert.ok(exitState.cameraEase <= 1.0);

  // Verify camera viewBox clamping at target player
  const targetPlayer = diag.players.find((p) => p.id === cm.playerId)!;
  const targetCam = calculateCameraViewBox((targetPlayer.x / 100) * 1000, (targetPlayer.y / 100) * 600, cm.focus?.zoom || 1.8);
  assert.ok(targetCam.minX >= 0);
  assert.ok(targetCam.minY >= 0);
  assert.ok(targetCam.minX + targetCam.width <= 1000);
  assert.ok(targetCam.minY + targetCam.height <= 600);

  // Verify text safety helper preserves title and text
  const cleanTitle = formatCoachingOverlayText(cm.title, 40);
  const cleanText = formatCoachingOverlayText(cm.text, 140);
  assert.ok(cleanTitle.length <= 40);
  assert.ok(cleanText.length <= 140);
});

// =============================================================================
// TASK D7A TESTS: MULTI-ACTION COACHING SEQUENCES (DATA & SEMANTICS)
// =============================================================================

test('D7A: classifySemanticEvents classifies events from animation steps (pass, preReceive, receive, firstTouch, moveAfterReceive, supportMove, dribble)', () => {
  const animation: DiagramAnimation = {
    duration: 8,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2.0,
        actions: [
          { type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' },
          { type: 'playerMove', playerId: 'p4', to: { x: 30, y: 40 } }, // support move
        ],
      },
      {
        id: 's2',
        start: 2.0,
        duration: 1.5,
        actions: [
          { type: 'ballDribble', ballId: 'b1', playerId: 'p2', to: { x: 70, y: 30 } }, // firstTouch by receiver
        ],
      },
      {
        id: 's3',
        start: 3.5,
        duration: 1.5,
        actions: [
          { type: 'playerMove', playerId: 'p2', to: { x: 80, y: 30 } }, // moveAfterReceive by receiver
        ],
      },
    ],
  };

  const events = classifySemanticEvents(animation);
  assert.ok(events.length >= 5);

  const eventTypes = events.map((e) => e.event);
  assert.ok(eventTypes.includes('pass'));
  assert.ok(eventTypes.includes('preReceive'));
  assert.ok(eventTypes.includes('receive'));
  assert.ok(eventTypes.includes('firstTouch'));
  assert.ok(eventTypes.includes('moveAfterReceive'));
  assert.ok(eventTypes.includes('supportMove'));
});

test('D7A: receiving event detection identifies passer, receiver, pre-arrival scanning, and arrival reception', () => {
  const animation: DiagramAnimation = {
    duration: 6,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2.0,
        actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
      },
    ],
  };

  const events = classifySemanticEvents(animation);
  const passEv = events.find((e) => e.event === 'pass')!;
  assert.equal(passEv.playerId, 'p1');
  assert.equal(passEv.receiverId, 'p2');
  assert.equal(passEv.time, 0);

  const preRecEv = events.find((e) => e.event === 'preReceive')!;
  assert.equal(preRecEv.playerId, 'p2');
  assert.equal(preRecEv.passerId, 'p1');
  assert.equal(preRecEv.time, 1.5); // 75% into the 2s pass travel
  assert.ok(preRecEv.time < 2.0, 'Pre-receive must precede ball arrival');

  const recEv = events.find((e) => e.event === 'receive')!;
  assert.equal(recEv.playerId, 'p2');
  assert.equal(recEv.time, 2.0); // Arrival at 2.0s
});

test('D7A: moment prioritization scores moments based on session objective and domain hierarchy', () => {
  const mPreReceive: DiagramCoachingMoment = {
    id: 'm1',
    time: 1.0,
    duration: 1.0,
    playerId: 'p2',
    event: 'preReceive',
    title: 'Kiểm tra vai',
    text: 'Quan sát phía sau trước khi nhận',
  };

  const mDribble: DiagramCoachingMoment = {
    id: 'm2',
    time: 3.0,
    duration: 1.0,
    playerId: 'p2',
    event: 'dribble',
    title: 'Dẫn bóng',
    text: 'Rê bóng về phía trước',
  };

  // When objective is receiving/open body, preReceive has much higher priority than dribble
  const scoreReceivingPre = calculateMomentPriority(mPreReceive, 'Nhận bóng mở thân người');
  const scoreReceivingDribble = calculateMomentPriority(mDribble, 'Nhận bóng mở thân người');
  assert.ok(scoreReceivingPre > scoreReceivingDribble);

  // When objective is 1v1 dribble, dribble score increases significantly
  const scoreDribbleObjective = calculateMomentPriority(mDribble, '1v1 qua người rê bóng');
  assert.ok(scoreDribbleObjective > scoreReceivingDribble);
});

test('D7A: duplicate removal eliminates duplicate ideas and overlapping timestamps', () => {
  const candidates: DiagramCoachingMoment[] = [
    {
      id: 'c1',
      time: 1.5,
      duration: 1.0,
      playerId: 'p2',
      event: 'preReceive',
      title: 'Kiểm tra vai',
      text: 'Quan sát phía sau',
    },
    {
      id: 'c1_dup',
      time: 1.55, // Identical / overlapping timestamp
      duration: 1.0,
      playerId: 'p2',
      event: 'preReceive', // Duplicate idea on same player
      title: 'Kiểm tra vai lần 2',
      text: 'Trùng lặp ý tưởng',
    },
    {
      id: 'c2',
      time: 2.5,
      duration: 1.0,
      playerId: 'p2',
      event: 'receive',
      title: 'Mở thân người',
      text: 'Đón bóng ở góc mở',
    },
  ];

  const prioritized = prioritizeCoachingMoments(candidates, {
    objective: 'Nhận bóng mở thân người',
    minSpacing: 0.8,
  });

  assert.equal(prioritized.length, 2);
  assert.equal(prioritized[0].id, 'c1');
  assert.equal(prioritized[1].id, 'c2');
  assert.ok(!prioritized.some((m) => m.id === 'c1_dup'));
});

test('D7A: minimum spacing enforces ~0.8–1.2s separation, discarding lower-priority conflicts', () => {
  const candidates: DiagramCoachingMoment[] = [
    {
      id: 'high_priority',
      time: 1.5,
      duration: 1.0,
      playerId: 'p2',
      event: 'preReceive',
      title: 'Kiểm tra vai',
      text: 'Quan sát vai',
    },
    {
      id: 'low_priority_too_close',
      time: 1.9, // Only 0.4s apart (< 0.8s minSpacing)
      duration: 1.0,
      playerId: 'p3',
      event: 'pass',
      title: 'Chuyền bóng',
      text: 'Chuyền thường',
    },
    {
      id: 'well_spaced',
      time: 2.6, // 1.1s apart (> 0.8s)
      duration: 1.0,
      playerId: 'p2',
      event: 'receive',
      title: 'Mở thân người',
      text: 'Mở góc thân người',
    },
  ];

  const selected = prioritizeCoachingMoments(candidates, {
    objective: 'Nhận bóng mở thân người',
    minSpacing: 0.8,
  });

  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'high_priority');
  assert.equal(selected[1].id, 'well_spaced');
  assert.ok(!selected.some((m) => m.id === 'low_priority_too_close'));
});

test('D7A: chronological sequence ordering sorts moments chronologically regardless of candidate order', () => {
  const unorderedCandidates: DiagramCoachingMoment[] = [
    { id: 'm3', time: 3.5, duration: 1.0, playerId: 'p2', event: 'firstTouch', title: 'T3', text: 'Txt3' },
    { id: 'm1', time: 1.5, duration: 1.0, playerId: 'p2', event: 'preReceive', title: 'T1', text: 'Txt1' },
    { id: 'm2', time: 2.5, duration: 1.0, playerId: 'p2', event: 'receive', title: 'T2', text: 'Txt2' },
  ];

  const ordered = prioritizeCoachingMoments(unorderedCandidates, { minSpacing: 0.8 });
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0].id, 'm1');
  assert.equal(ordered[1].id, 'm2');
  assert.equal(ordered[2].id, 'm3');
  assert.ok(ordered[0].time < ordered[1].time);
  assert.ok(ordered[1].time < ordered[2].time);

  const seq = buildCoachingSequence(ordered, 'Chuỗi kỹ thuật', 'seq-ordered');
  assert.ok(seq);
  assert.deepEqual(seq.momentIds, ['m1', 'm2', 'm3']);
});

test('D7A: sanitizeCoachingSequence handles invalid sequence references and drops missing IDs safely', () => {
  const validMoments: DiagramCoachingMoment[] = [
    { id: 'coach1', time: 1.5, duration: 1.0, playerId: 'p2', title: 'T1', text: 'X1' },
    { id: 'coach2', time: 2.5, duration: 1.0, playerId: 'p2', title: 'T2', text: 'X2' },
  ];

  // Sequence containing duplicate, non-existent, and unsorted IDs
  const rawSeq = {
    id: 'seq1',
    title: 'Kiểm tra chuỗi',
    momentIds: ['coach2', 'ghost_id', 'coach1', 'coach2', ''],
  };

  const sanitized = sanitizeCoachingSequence(rawSeq, validMoments);
  assert.ok(sanitized);
  assert.equal(sanitized.id, 'seq1');
  assert.equal(sanitized.title, 'Kiểm tra chuỗi');
  // Drops ghost_id, drops duplicate coach2, and sorts chronologically: ['coach1', 'coach2']
  assert.deepEqual(sanitized.momentIds, ['coach1', 'coach2']);

  // Sequence referencing only invalid IDs returns undefined
  const emptySeq = sanitizeCoachingSequence({ id: 's2', title: 'Trống', momentIds: ['unknown1', 'unknown2'] }, validMoments);
  assert.equal(emptySeq, undefined);
});

test('D7A: maximum 4 moments ceiling is strictly respected even when more candidates exist', () => {
  const manyCandidates: DiagramCoachingMoment[] = [
    { id: 'c1', time: 1.0, duration: 0.5, playerId: 'p1', event: 'preReceive', title: 'C1', text: 'T1' },
    { id: 'c2', time: 2.0, duration: 0.5, playerId: 'p2', event: 'receive', title: 'C2', text: 'T2' },
    { id: 'c3', time: 3.0, duration: 0.5, playerId: 'p2', event: 'firstTouch', title: 'C3', text: 'T3' },
    { id: 'c4', time: 4.0, duration: 0.5, playerId: 'p3', event: 'moveAfterReceive', title: 'C4', text: 'T4' },
    { id: 'c5', time: 5.0, duration: 0.5, playerId: 'p4', event: 'supportMove', title: 'C5', text: 'T5' },
    { id: 'c6', time: 6.0, duration: 0.5, playerId: 'p1', event: 'pass', title: 'C6', text: 'T6' },
  ];

  const selected = prioritizeCoachingMoments(manyCandidates, { minSpacing: 0.8, maxMoments: 4 });
  assert.ok(selected.length <= 4, `Selected moments (${selected.length}) must not exceed maximum 4`);
  assert.equal(selected.length, 4);
});

test('D7A: preferred 2–3 moment selection produces a compact, high-value sequence', () => {
  const diagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30 },
      { id: 'p2', team: 'blue', x: 50, y: 30 },
      { id: 'p3', team: 'blue', x: 80, y: 50 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [
      { id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' },
      { id: 'path2', type: 'movement', fromPlayerId: 'p2', toPlayerId: 'p3' },
    ],
    animation: {
      duration: 6,
      steps: [
        {
          id: 'step1',
          start: 0,
          duration: 2.0,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
        {
          id: 'step2',
          start: 2.0,
          duration: 2.0,
          actions: [{ type: 'playerMove', playerId: 'p2', to: { x: 80, y: 50 } }],
        },
      ],
    },
  };

  const moments = buildSemanticCoachingMoments(
    diagram,
    'Cầu thủ quan sát kiểm tra vai trước khi nhận bóng và mở thân người'
  );

  assert.ok(moments.length >= 2 && moments.length <= 3, `Expected preferred 2-3 moments, got ${moments.length}`);
  const seq = buildCoachingSequence(moments, 'Nhận bóng mở thân người');
  assert.ok(seq);
  assert.equal(seq.momentIds.length, moments.length);
});

test('D7A: receiving-open-body sequence produces candidate sequence (preReceive "Kiểm tra vai", receive "Mở thân người", firstTouch "Chạm bước một")', () => {
  const diagram: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 20 },
      { id: 'p2', team: 'blue', x: 50, y: 20 },
      { id: 'p3', team: 'blue', x: 80, y: 50 },
    ],
    balls: [{ id: 'b1', x: 20, y: 20 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [
      { id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' },
      { id: 'path2', type: 'dribble', fromPlayerId: 'p2', toPlayerId: 'p3' },
    ],
    animation: {
      duration: 8,
      steps: [
        {
          id: 's1',
          start: 0,
          duration: 2.0,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
        {
          id: 's2',
          start: 2.0,
          duration: 3.0,
          actions: [{ type: 'ballDribble', ballId: 'b1', playerId: 'p2', to: { x: 80, y: 50 } }],
        },
      ],
    },
  };

  const moments = buildSemanticCoachingMoments(diagram, 'Nhận bóng mở thân người và kiểm tra vai quan sát');
  assert.equal(moments.length, 3);

  // Moment 1: preReceive
  assert.equal(moments[0].event, 'preReceive');
  assert.equal(moments[0].title, 'Kiểm tra vai');
  assert.equal(moments[0].text, 'Quan sát phía sau trước khi nhận để biết hướng chơi tiếp.');
  assert.equal(moments[0].playerId, 'p2');
  assert.equal(moments[0].time, 1.5);

  // Moment 2: receive
  assert.equal(moments[1].event, 'receive');
  assert.equal(moments[1].title, 'Mở thân người');
  assert.equal(moments[1].text, 'Nhận ở góc mở để nhìn thấy bóng và hướng tấn công cùng lúc.');
  assert.equal(moments[1].playerId, 'p2');
  assert.equal(moments[1].time, 2.5);

  // Moment 3: firstTouch
  assert.equal(moments[2].event, 'firstTouch');
  assert.equal(moments[2].title, 'Chạm bước một');
  assert.equal(moments[2].text, 'Đưa bóng vào khoảng trống giúp hành động tiếp theo nhanh hơn.');
  assert.equal(moments[2].playerId, 'p2');
  assert.equal(moments[2].time, 3.5);

  // Spacing verification
  assert.ok(Math.abs(moments[1].time - moments[0].time) >= 0.8);
  assert.ok(Math.abs(moments[2].time - moments[1].time) >= 0.8);
});

test('D7A: validateDiagramAnimation accepts spec-conforming coachingSequence model and rejects invalid references or out-of-order momentIds', () => {
  const pList: DiagramPlayer[] = [
    { id: 'p1', team: 'blue', x: 20, y: 30 },
    { id: 'p2', team: 'blue', x: 60, y: 30 },
  ];
  const bList = [{ id: 'b1', x: 20, y: 30 }];

  const validAnim: DiagramAnimation = {
    duration: 8,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2.0,
        actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
      },
    ],
    coachingMoments: [
      { id: 'coach1', time: 1.5, duration: 1.0, playerId: 'p2', event: 'preReceive', title: 'T1', text: 'X1' },
      { id: 'coach2', time: 2.5, duration: 1.0, playerId: 'p2', event: 'receive', title: 'T2', text: 'X2' },
    ],
    coachingSequence: {
      id: 'sequence1',
      title: 'Nhận bóng mở thân người',
      momentIds: ['coach1', 'coach2'],
    },
  };

  const res = validateDiagramAnimation(validAnim, pList, bList);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);

  // Reject sequence referencing non-existent moment ID
  const invalidRefAnim = {
    ...validAnim,
    coachingSequence: {
      id: 'sequence1',
      title: 'Nhận bóng mở thân người',
      momentIds: ['coach1', 'nonexistent_moment'],
    },
  };
  const resBadRef = validateDiagramAnimation(invalidRefAnim, pList, bList);
  assert.equal(resBadRef.ok, false);
  assert.ok(resBadRef.errors.some((e) => e.includes('references non-existent coaching moment ID')));

  // Reject duplicate IDs in sequence
  const dupSeqAnim = {
    ...validAnim,
    coachingSequence: {
      id: 'sequence1',
      title: 'Nhận bóng',
      momentIds: ['coach1', 'coach1'],
    },
  };
  const resDup = validateDiagramAnimation(dupSeqAnim, pList, bList);
  assert.equal(resDup.ok, false);
  assert.ok(resDup.errors.some((e) => e.includes('duplicate moment ID')));

  // Reject out-of-order sequence IDs
  const outOfOrderAnim = {
    ...validAnim,
    coachingSequence: {
      id: 'sequence1',
      title: 'Nhận bóng',
      momentIds: ['coach2', 'coach1'],
    },
  };
  const resOrder = validateDiagramAnimation(outOfOrderAnim, pList, bList);
  assert.equal(resOrder.ok, false);
  assert.ok(resOrder.errors.some((e) => e.includes('chronological order')));
});

test('D7A: D6 compatibility: drills without coachingSequence continue to function unchanged with valid coaching moments', () => {
  const pList: DiagramPlayer[] = [
    { id: 'p1', team: 'blue', x: 20, y: 30 },
    { id: 'p2', team: 'blue', x: 60, y: 30 },
  ];
  const bList = [{ id: 'b1', x: 20, y: 30 }];

  // Animation without coachingSequence (pure D6 format)
  const d6Anim: DiagramAnimation = {
    duration: 8,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 2.0,
        actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
      },
    ],
    coachingMoments: [
      { id: 'coach1', time: 1.5, duration: 1.0, playerId: 'p2', title: 'Mở thân người', text: 'Kiểm tra vai' },
    ],
  };

  const res = validateDiagramAnimation(d6Anim, pList, bList);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
  assert.equal(d6Anim.coachingSequence, undefined);
});

test('D7A: TEST CASE: 16 players, Nhận bóng mở thân người, 90 min, 7v7 technical exercise produces valid semantic sequence (coach1=preReceive, coach2=receive, coach3=firstTouch)', () => {
  const diag = buildDefaultStructuredDiagram({
    blockType: 'technical',
    playerCount: 16,
    topic: 'Nhận bóng mở thân người',
    exerciseName: 'Bài tập chuyền nhận bóng mở thân người 4 trạm',
    organization: '16 cầu thủ chia thành 4 nhóm 4 tại 4 trạm',
    execution: 'Cầu thủ p1 chuyền bóng cho p2, p2 quan sát kiểm tra vai mở thân người đón bóng và chạm bước một tịnh tiến về cọc tiêu',
    equipment: ['12 Nón tập', '8 Quả bóng', 'Áo bib 2 màu'],
  });

  assert.ok(diag.animation, 'Diagram must have animation');
  const anim = diag.animation!;
  assert.ok(anim.duration >= 4, 'Animation duration must be valid');
  assert.ok(anim.coachingMoments && anim.coachingMoments.length >= 3, 'Must contain 3 connected coaching moments');

  // Verify semantic candidates
  const [m1, m2, m3] = anim.coachingMoments!;

  // coach1 = preReceive
  assert.equal(m1.id, 'coach1');
  assert.equal(m1.event, 'preReceive');
  assert.equal(m1.title, 'Kiểm tra vai');
  assert.equal(m1.text, 'Quan sát phía sau trước khi nhận để biết hướng chơi tiếp.');

  // coach2 = receive
  assert.equal(m2.id, 'coach2');
  assert.equal(m2.event, 'receive');
  assert.equal(m2.title, 'Mở thân người');
  assert.equal(m2.text, 'Nhận ở góc mở để nhìn thấy bóng và hướng tấn công cùng lúc.');

  // coach3 = firstTouch
  assert.equal(m3.id, 'coach3');
  assert.equal(m3.event, 'firstTouch');
  assert.equal(m3.title, 'Chạm bước một');
  assert.equal(m3.text, 'Đưa bóng vào khoảng trống giúp hành động tiếp theo nhanh hơn.');

  // Verify spacing (~0.8–1.2s)
  const spacing1 = Math.round((m2.time - m1.time) * 10) / 10;
  const spacing2 = Math.round((m3.time - m2.time) * 10) / 10;
  assert.ok(spacing1 >= 0.8 && spacing1 <= 1.2, `Spacing 1 (${spacing1}s) must be in 0.8–1.2s`);
  assert.ok(spacing2 >= 0.8 && spacing2 <= 1.2, `Spacing 2 (${spacing2}s) must be in 0.8–1.2s`);

  // Verify coaching sequence model
  assert.ok(anim.coachingSequence, 'Must have coachingSequence model attached');
  const seq = anim.coachingSequence!;
  assert.equal(seq.id, 'sequence1');
  assert.equal(seq.title, 'Nhận bóng mở thân người');
  assert.deepEqual(seq.momentIds, ['coach1', 'coach2', 'coach3']);

  // Verify validation passes without any errors
  const valRes = validateDiagramAnimation(anim, diag.players, diag.balls);
  assert.equal(valRes.ok, true);
  assert.deepEqual(valRes.errors, []);
});



