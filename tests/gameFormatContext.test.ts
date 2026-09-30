import test from 'node:test';
import assert from 'node:assert/strict';
import { GameFormat } from '../src/types/session';
import { GeminiTrainingPlan } from '../src/types/trainingPlan';
import { validateGeminiPlan } from '../src/services/planValidation';
import { validPlayerOrganization } from '../src/services/playerAccounting';
import { mapGeminiPlanToSession } from '../src/services/trainingPlanService';

// C2.1: exactly one generation per requested format, with the same topic and squad.
const cases: Array<{ format: GameFormat; technical: RegExp; opposed: RegExp; decision: RegExp }> = [
  { format: 'Futsal 5v5', technical: /bật tường/, opposed: /Mất bóng.*áp sát ngay/, decision: /lưng bị khóa.*nhả một chạm/ },
  { format: '7v7', technical: /tam giác/, opposed: /cầu thủ biên.*trung tâm/, decision: /hướng trước mở.*bị khóa.*biên/ },
  { format: '9v9', technical: /chiều sâu/, opposed: /phía sau.*phía trước/, decision: /đổi cánh/ },
  { format: '11v11', technical: /người thứ ba/, opposed: /tuyến dưới.*tuyến giữa/, decision: /xoay nối tuyến trên hoặc nhả/ },
];
const generated: GeminiTrainingPlan[] = [];

for (const scenario of cases) {
  test(`16 players, Nhận bóng mở thân người, 90 min: ${scenario.format}`, async () => {
    assert.ok(process.env.C2_API_URL, 'Set C2_API_URL to the isolated fallback test server');
    const response = await fetch(`${process.env.C2_API_URL}/api/generate-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players: 16, trainingFocus: 'Nhận bóng mở thân người', duration: 90, gameFormat: scenario.format }),
    });
    assert.equal(response.status, 200);
    const plan: GeminiTrainingPlan = await response.json();
    assert.equal(plan.generationSource, 'fallback');
    assert.equal(plan.gameFormat, scenario.format);
    assert.equal(plan.players, 16);
    assert.equal(plan.phases.reduce((sum, phase) => sum + phase.duration, 0), 90);
    assert.deepEqual(validateGeminiPlan(plan).errors, []);
    for (const phase of plan.phases) {
      assert.equal(phase.players, 16);
      assert.ok(validPlayerOrganization(phase.playerOrganization, 16));
      assert.ok(!('spatialSetup' in phase), 'Internal context must not extend the output schema');
    }
    assert.deepEqual(plan.phases.map(p => p.playerOrganization), [
      { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      { groups: 4, playersPerGroup: 4, leftover: 0, leftoverRole: 'none' },
      ...Array.from({ length: 3 }, () => ({ groups: 2, playersPerGroup: 8, leftover: 0, leftoverRole: 'none' })),
    ]);
    assert.match(plan.phases[1].execution, scenario.technical);
    assert.match(plan.phases[2].execution, scenario.opposed);
    assert.match(plan.phases[1].execution + ' ' + plan.phases[2].execution, scenario.decision);
    assert.match(plan.phases[1].execution, /mỗi nhóm nhỏ/);
    assert.match(plan.phases[1].execution, /luân phiên|đổi vai/i);
    assert.match(plan.phases[3].execution, /hai điểm/);
    assert.match(plan.phases[4].execution, /hai điểm/);
    const session = mapGeminiPlanToSession(plan, 'Nhận bóng mở thân người');
    assert.equal(session.gameFormat, scenario.format);
    assert.equal(session.totalDuration, 90);
    generated.push(plan);
    console.log(JSON.stringify({ format: scenario.format, exercise: plan.phases[1].exerciseName,
      execution: plan.phases[1].execution, accounting: '8×2; 4×4; 2×8; 2×8; 2×8 = 16 per phase' }));
  });
}

test.after(() => {
  assert.equal(generated.length, 4);
  for (let phase = 0; phase < 5; phase++) {
    assert.equal(new Set(generated.map(plan => plan.phases[phase].execution)).size, 4,
      `Phase ${phase + 1} must differ in behavior, independently of dimensions and title`);
  }
});
