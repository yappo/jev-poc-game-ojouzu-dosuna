import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGameServer} from '../src/http-server.mjs';
import {GAME_STAGES} from '../src/game.mjs';

function fakeCall(request){
  const answers={};
  for(const [id,q] of Object.entries(request.questions)){
    if(q.type==='noul')answers[id]={type:'noul',noul:id==='direct_attack'?.01:.95};
    else {const keys=Object.keys(q.criteria),choice=id==='reading'?'benevolent':keys[0];answers[id]={type:'choice',choice,confidence:.99,probabilities:Object.fromEntries(keys.map(k=>[k,k===choice?1:0]))};}
  }
  return Promise.resolve({response:{model:'test-double',answers},latencyMs:0});
}
async function fixture(t,call=fakeCall){
  const server=createGameServer({apiKey:'TEST_KEY',call});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,data){const res=await fetch(base+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:undefined);return {status:res.status,body:await res.json()};}
  const {body:game}=await request('/api/game?stage=5');return {request,game};
}
test('all six matches require three rounds and two wins; no stage skipping or private leakage',async t=>{
  const {request,game}=await fixture(t);assert.equal(game.startStageIndex,0);assert.ok(!JSON.stringify(game).includes('intended_subtext'));
  let last;
  for(const stage of GAME_STAGES){
    const skipped=await request('/api/round',{sessionId:game.sessionId,stageId:stage.id,roundIndex:2,utterance:'test'});assert.equal(skipped.status,409);
    for(let i=0;i<3;i++){
      last=await request('/api/round',{sessionId:game.sessionId,stageId:stage.id,roundIndex:i,utterance:'test'});assert.equal(last.status,200);assert.equal(last.body.wins,i+1);
      assert.ok(!JSON.stringify(last.body).includes('intended_subtext'));
      if(i<2)assert.equal(last.body.match,null);else {assert.equal(last.body.match.won,true);assert.equal(last.body.match.allComplete,stage.id==='kyoto');}
    }
  }
  assert.equal(last.body.match.allComplete,true);
});
test('two wins and one caught round advance only after the third round',async t=>{
  let round=0;
  const {request,game}=await fixture(t,async req=>{
    const result=await fakeCall(req);
    if(req.questions.reading&&round===1)result.response.answers.reading={type:'choice',choice:'hostile',confidence:.99,probabilities:{hostile:.9,benevolent:.05,unclear:.05}};
    return result;
  });
  let last;
  for(round=0;round<3;round++){
    last=await request('/api/round',{sessionId:game.sessionId,stageId:'elementary',roundIndex:round,utterance:'test'});
    assert.equal(last.body.result,round===1?'caught':'success');
    if(round<2)assert.equal(last.body.match,null);
  }
  assert.equal(last.body.match.wins,2);assert.equal(last.body.match.won,true);assert.equal(last.body.match.nextStage.id,'middle');
});
test('in-flight duplicates are locked and a completed identical retry does not evaluate again',async t=>{
  let calls=0,release,notify;const entered=new Promise(r=>notify=r),gate=new Promise(r=>release=r);
  const {request,game}=await fixture(t,async req=>{calls++;if(req.questions.target_link){notify();await gate;}return fakeCall(req);});
  const input={sessionId:game.sessionId,stageId:'elementary',roundIndex:0,utterance:'test'};
  const pending=request('/api/round',input);await entered;
  assert.equal((await request('/api/round',input)).status,409);release();const first=await pending;assert.equal(first.status,200);
  const before=calls;const again=await request('/api/round',input);assert.deepEqual(again.body,first.body);assert.equal(calls,before);
  assert.equal((await request('/api/round',{...input,utterance:'different'})).status,409);
});
test('API errors consume no round, reaction failures cannot change a victory, and losses can retry',async t=>{
  let fail=true,lose=false,failReaction=false;
  const {request,game}=await fixture(t,async req=>{
    if(req.questions.target_link&&fail)throw new Error('TEST_KEY');
    if(req.questions.reaction&&failReaction)throw new Error('TEST_KEY');
    const r=await fakeCall(req);if(lose&&req.questions.praise_facade)r.response.answers.praise_facade.noul=.01;return r;
  });
  const input={sessionId:game.sessionId,stageId:'elementary',roundIndex:0,utterance:'test'};
  const failed=await request('/api/round',input);assert.equal(failed.status,502);assert.ok(!JSON.stringify(failed).includes('TEST_KEY'));
  fail=false;failReaction=true;const first=await request('/api/round',input);assert.equal(first.body.round,1);assert.equal(first.body.roundWon,true);assert.equal(first.body.reaction.selectionSource,'fallback');
  lose=true;
  await request('/api/round',{...input,roundIndex:1});const last=await request('/api/round',{...input,roundIndex:2});assert.equal(last.body.match.won,false);assert.equal(last.body.match.wins,1);assert.ok(last.body.match.reaction.id.includes('neutral'));
  assert.equal((await request('/api/round',{...input,stageId:'middle'})).status,409);
  const retry=await request('/api/retry',{sessionId:game.sessionId});assert.equal(retry.status,200);assert.equal(retry.body.stageIndex,0);
  lose=false;assert.equal((await request('/api/round',input)).body.wins,1);
});
