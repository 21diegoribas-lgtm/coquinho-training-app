import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDurationsToTotal } from '../src/services/durationUtils';
import { allocatePlayers } from '../src/services/playerAccounting';
import { generateTrainingSession, regenerateSingleExercise } from '../src/services/sessionGenerator';
import { sanitizeGeminiPlan, sanitizeTrainingSession } from '../src/services/planValidation';
import { getSavedSessions, saveSessionToStorage } from '../src/services/storageService';
import { mapGeminiPlanToSession } from '../src/services/trainingPlanService';

test('normalization handles severe overshoot, tiny, invalid and huge durations', () => {
 for (const total of [60,75,90]) for (const ds of [[90,90,90,90,90],[1,1,1,1,1],[NaN,Infinity,-3,0,20],[1e308,1e308,5,5,5]]) {
  const result=normalizeDurationsToTotal(ds.map(duration=>({duration})),total);
  assert.equal(result.reduce((s,p)=>s+p.duration,0),total);
  assert.ok(result.every(p=>Number.isInteger(p.duration)&&p.duration>=5));
 }
});
test('all squad sizes are accounted for in every local phase',()=>{
 for(let n=4;n<=50;n++) for(const kind of ['warm_up','technical','skill','small_sided','match'] as const){
  const a=allocatePlayers(n,kind); assert.equal(a.groups*a.playersPerGroup+a.leftover,n);
 }
});
test('repeated local variations do not immediately repeat',()=>{
 const s=generateTrainingSession('1v1',17,75); let drill=s.blocks[0];
 for(let seed=1;seed<12;seed++){const next=regenerateSingleExercise(drill,'1v1',17,seed);assert.notEqual(next.exerciseName,drill.exerciseName);assert.equal(next.duration,drill.duration);drill=next;}
});
test('storage rejects corruption, preserves edited totals and strips unsafe optional diagrams',()=>{
 let raw=''; Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}}});
 for(const v of ['{','null','{}','[null,{},42]']){raw=v;assert.deepEqual(getSavedSessions(),[]);}
 const s=generateTrainingSession('1v1',17,75);s.blocks[0].duration+=7;s.totalDuration+=7;
 assert.ok(saveSessionToStorage(s).success);assert.equal(getSavedSessions()[0].totalDuration,82);
 const bad={...s,blocks:s.blocks.map(b=>({...b,pitchDiagram:{players:[null]}}))};
 assert.equal(sanitizeTrainingSession(bad)?.blocks[0].pitchDiagram,undefined);
});
test('requested API flows renderable, exact totals and complete allocations',async()=>{
 for(const [players,trainingFocus,duration] of [[16,'Nhận bóng mở thân người',90],[17,'1v1',75],[12,'Chuyền và nhận bóng',60]] as const){
  const response=await fetch('http://localhost:3000/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players,trainingFocus,duration})});
  assert.equal(response.status,200);const plan=await response.json();
  assert.ok(plan.generationSource === 'gemini' || plan.generationSource === 'fallback');assert.equal(plan.phases.reduce((s:number,p:any)=>s+p.duration,0),duration);
  for(const p of plan.phases)assert.equal(p.playerOrganization.groups*p.playerOrganization.playersPerGroup+p.playerOrganization.leftover,players);
  const session=mapGeminiPlanToSession(plan,trainingFocus);assert.equal(session.blocks[0].progression,plan.phases[0].progression);
  assert.ok(sanitizeTrainingSession(session));
  const duplicate=structuredClone(plan);duplicate.phases[1].id=duplicate.phases[0].id;
  assert.equal(sanitizeGeminiPlan(duplicate,{players,topic:trainingFocus,duration}),null);
  plan.duration=90;plan.players=40;plan.phases.forEach((p:any)=>p.duration=90);
  const fixed=sanitizeGeminiPlan(plan,{players,topic:trainingFocus,duration})!;
  assert.equal(fixed.duration,duration);assert.equal(fixed.players,players);assert.equal(fixed.phases.reduce((s,p)=>s+p.duration,0),duration);
 }
 const invalid=await fetch('http://localhost:3000/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players:17.5,trainingFocus:'1v1',duration:75})});assert.equal(invalid.status,400);
});
