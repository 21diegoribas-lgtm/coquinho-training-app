import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePlayers, formatFromOrganization, organizationMatchesStructure, validPlayerOrganization } from '../src/services/playerAccounting';
import { sanitizeGeminiPlan, validateGeminiPlan } from '../src/services/planValidation';
import { generateTrainingPlanWithGemini, mapGeminiPlanToSession } from '../src/services/trainingPlanService';

test('allocations have exact totals and named extra roles for every supported squad size', () => {
  for (let players = 4; players <= 50; players++) {
    for (const kind of ['warm_up', 'technical', 'skill', 'small_sided', 'match'] as const) {
      assert.ok(validPlayerOrganization(allocatePlayers(players, kind), players));
      const org = allocatePlayers(players, kind);
      assert.ok(organizationMatchesStructure(formatFromOrganization(players, org), org));
    }
  }
  for (const org of [
    { groups: 3, playersPerGroup: 4 },
    { groups: 3, playersPerGroup: 4, leftover: -1 },
    { groups: 3, playersPerGroup: 4, leftover: 2, leftoverRole: 'none' },
    { groups: 3, playersPerGroup: 4, leftover: 2, leftoverRole: 'joker', restingPlayers: 3 },
  ]) assert.equal(validPlayerOrganization(org, 14), false);
});

test('obvious group and parallel-field contradictions are rejected', () => {
  assert.equal(organizationMatchesStructure('3 groups of 4', { groups: 2, playersPerGroup: 7 }), false);
  assert.equal(organizationMatchesStructure('3 parallel 3v1 fields', { groups: 3, playersPerGroup: 6 }), false);
  assert.equal(organizationMatchesStructure('3 x 4v2', { groups: 3, playersPerGroup: 6 }), true);
});

test('requested sessions, client fallback and mocked malformed AI responses', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    for (const params of [
      { players: 14, trainingFocus: 'Passing and movement', duration: 75, gameFormat: '7v7' },
      { players: 18, trainingFocus: 'Receiving between lines', duration: 90, gameFormat: '9v9' },
    ] as const) {
      const plan = await generateTrainingPlanWithGemini(params);
      assert.ok(validateGeminiPlan(plan).ok);
      assert.equal(plan.phases.reduce((sum, p) => sum + p.duration, 0), params.duration);
      const mapped = mapGeminiPlanToSession(plan, params.trainingFocus);
      for (const phase of plan.phases) {
        assert.ok(validPlayerOrganization(phase.playerOrganization, params.players));
        assert.ok(organizationMatchesStructure(phase.organization, phase.playerOrganization!));
      }
      assert.equal(mapped.gameFormat, params.gameFormat);
      const bad = structuredClone(plan);
      bad.phases[1].organization = params.players === 14 ? '3 groups of 4' : '3 parallel 3v1 fields';
      bad.phases[1].playerOrganization = { groups: 3, playersPerGroup: 4 };
      assert.equal(sanitizeGeminiPlan(bad, { ...params, topic: params.trainingFocus }), null);
      globalThis.fetch = async () => Response.json(bad);
      assert.equal((await generateTrainingPlanWithGemini(params)).generationSource, 'fallback');
      globalThis.fetch = async () => new Response('{}', { status: 503 });
      const valid = structuredClone(plan);
      valid.phases[1].playerOrganization = { groups: 3, playersPerGroup: params.players === 14 ? 4 : 6,
        leftover: params.players === 14 ? 2 : 0, leftoverRole: params.players === 14 ? 'joker' : 'none' };
      valid.phases[1].organization = params.players === 14 ? '3 groups of 4 + 2 rotating jokers' : '3 parallel 4v2 fields';
      const safe = sanitizeGeminiPlan(valid, { ...params, topic: params.trainingFocus })!;
      assert.ok(safe);
      assert.equal(safe.phases[1].playerOrganization!.leftoverRole, params.players === 14 ? 'joker' : 'none');
      assert.deepEqual(sanitizeGeminiPlan(safe, { ...params, topic: params.trainingFocus }), safe);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('requested API sessions expose each actual phase allocation', { skip: !process.env.C1_API_URL }, async () => {
  for (const params of [
    { players: 14, trainingFocus: 'Passing and movement', duration: 75, gameFormat: '7v7' },
    { players: 18, trainingFocus: 'Receiving between lines', duration: 90, gameFormat: '9v9' },
  ]) {
    const response = await fetch(`${process.env.C1_API_URL}/api/generate-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    });
    assert.equal(response.status, 200);
    const plan = await response.json();
    assert.ok(validateGeminiPlan(plan).ok);
    assert.equal(plan.phases.reduce((sum: number, p: any) => sum + p.duration, 0), params.duration);
    for (const phase of plan.phases) {
      const org = phase.playerOrganization;
      assert.ok(validPlayerOrganization(org, params.players));
      console.log(JSON.stringify({ players: params.players, source: plan.generationSource, phase: phase.phase,
        duration: phase.duration, organization: phase.organization,
        arithmetic: `${org.groups} × ${org.playersPerGroup} + ${org.leftover} = ${params.players}` }));
    }
  }
});
