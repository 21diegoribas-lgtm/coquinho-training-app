import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultStructuredDiagram,
  buildWavyPath,
  getGoalGeometry,
  getTeamStyle,
  resolvePathCoordinates,
  validateStructuredDiagram,
} from '../src/services/structuredDiagram';
import { generateRealisticFootballPlan } from '../server';
import { buildLocalFallbackPlan } from '../src/services/trainingPlanService';
import { sanitizeGeminiPlan } from '../src/services/planValidation';
import { DiagramPlayer, StructuredDrillDiagram } from '../src/types/session';

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

