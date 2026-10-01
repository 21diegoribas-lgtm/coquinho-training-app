import test from 'node:test';
import assert from 'node:assert/strict';
import { finalGameTitle, titleMatchesOrganization, validatePlanConsistency, validateTrainingSessionConsistency } from '../src/services/sessionConsistency';
import { GeminiTrainingPlan } from '../src/types/trainingPlan';
import { TrainingSession } from '../src/types/session';

const org8v8 = { groups: 2, playersPerGroup: 8, leftover: 0, leftoverRole: 'none' as const };

function plan(): GeminiTrainingPlan {
  return {
    sessionTitle: 'Test', mainObjective: 'Test', players: 16, duration: 90, gameFormat: '7v7',
    sessionOverview: 'Buổi tập 90 phút gồm 4 giai đoạn.',
    phases: [
      { id:'1',phase:'Khởi động',exerciseName:'Kích hoạt',duration:15,players:16,area:'20x20',equipment:['Bóng'],organization:'8 nhóm 2',execution:'x',coachingPoints:['x'],playerOrganization:{groups:8,playersPerGroup:2,leftover:0,leftoverRole:'none'} },
      { id:'2',phase:'Kỹ thuật',exerciseName:'Kỹ thuật',duration:20,players:16,area:'20x20',equipment:['Bóng'],organization:'4 nhóm 4',execution:'x',coachingPoints:['x'],playerOrganization:{groups:4,playersPerGroup:4,leftover:0,leftoverRole:'none'} },
      { id:'3',phase:'Kỹ năng',exerciseName:'Đối kháng 8v8',duration:20,players:16,area:'30x25',equipment:['Bóng'],organization:'2 nhóm 8, thi đấu 8v8',execution:'x',coachingPoints:['x'],playerOrganization:org8v8 },
      { id:'4',phase:'Trò chơi',exerciseName:finalGameTitle('7v7', org8v8),duration:35,players:16,area:'55x35',equipment:['Bóng'],organization:'2 nhóm 8, thi đấu 8v8',execution:'x',coachingPoints:['x'],playerOrganization:org8v8 },
    ],
  };
}

test('title must match the actual player structure', () => {
  assert.equal(titleMatchesOrganization('Đối kháng 4v2 định hướng', '2 nhóm 8, thi đấu 8v8', org8v8), false);
  assert.equal(titleMatchesOrganization('Đối kháng 8v8 định hướng', '2 nhóm 8, thi đấu 8v8', org8v8), true);
});

test('adapted final-game label is consistent with 7v7 context', () => {
  assert.equal(finalGameTitle('7v7', org8v8), 'Thi đấu 8v8 đại diện điều chỉnh (bối cảnh 7v7)');
  assert.deepEqual(validatePlanConsistency(plan()), []);
  const bad = plan();
  bad.phases[3].exerciseName = 'Trận đấu 7v7 tiêu chuẩn';
  assert.ok(validatePlanConsistency(bad).includes('final regulation label'));
});

test('phase count and timeline contradictions are rejected', () => {
  const wrongCount = plan();
  wrongCount.sessionOverview = 'Buổi tập gồm 5 giai đoạn.';
  assert.ok(validatePlanConsistency(wrongCount).includes('summary phase count'));
  const wrongTime = plan();
  wrongTime.phases[3].duration = 30;
  assert.ok(validatePlanConsistency(wrongTime).includes('session timeline'));
});

test('UI session validation applies the same title/timeline/final-format checks', () => {
  const p = plan();
  const session: TrainingSession = {
    id:'s',title:'Test',objective:'Test',topic:'Test',playerCount:16,totalDuration:90,selectedDuration:90,gameFormat:'7v7',createdAt:'01/10/2026',
    blocks:p.phases.map((phase, i) => ({
      id:phase.id,blockType:i===0?'warm_up':i===1?'technical':i===2?'skill':'small_sided',blockName:phase.phase,
      exerciseName:phase.exerciseName,duration:phase.duration,playersCount:'16 cầu thủ',areaSize:phase.area,equipment:phase.equipment,
      organization:phase.organization,howItWorks:[phase.execution],coachingPoints:phase.coachingPoints,playerOrganization:phase.playerOrganization,
    })),
  };
  assert.deepEqual(validateTrainingSessionConsistency(session), []);
  session.blocks[2].exerciseName = '4v2';
  assert.ok(validateTrainingSessionConsistency(session).some(e => e.includes('title vs player structure')));
});
