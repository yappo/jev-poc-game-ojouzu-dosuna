import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequests, validateResponse, assess, callJev } from '../src/evaluation.mjs';

test('opponent receives scene and utterance but no private intent or fixture label', () => {
  const request = buildRequests({ id:'secret-label', kind:'sarcasm', scene:'scene', utterance:'words', intent:'PRIVATE_SENTINEL' });
  assert.deepEqual(request.opponent.state, { scene:'scene', utterance:'words' });
  assert.ok(!JSON.stringify(request.opponent).includes('PRIVATE_SENTINEL'));
  assert.ok(!JSON.stringify(request.opponent).includes('secret-label'));
  assert.equal(request.judge.state.intended_subtext, 'PRIVATE_SENTINEL');
});

const judge = (link=0.9, praise=0.9, direct=0.1, coherent=0.9) => ({ answers: {
  target_link:{noul:link}, praise_facade:{noul:praise}, direct_attack:{noul:direct}, coherent:{noul:coherent}
} });
const opponent = (choice='benevolent', probabilities={benevolent:0.8, hostile:0.1, unclear:0.1}) => ({ answers:{reading:{choice, probabilities}} });

test('ordinary praise, open insults, nonsense and opponent uncertainty never count as successful hidden sarcasm', () => {
  assert.equal(assess(judge(0.1),opponent()).result,'invalid');
  assert.equal(assess(judge(0.9,0.1,0.9),opponent()).result,'invalid');
  assert.equal(assess(judge(0.9,0.9,0.1,0.1),opponent()).result,'invalid');
  assert.equal(assess(judge(),opponent('benevolent',{benevolent:0.4,hostile:0.3,unclear:0.3})).result,'uncertain');
  assert.equal(assess(judge(),opponent()).result,'success');
  assert.equal(assess(judge(),opponent('hostile',{benevolent:0.1,hostile:0.8,unclear:0.1})).result,'caught');
});

test('invalid or missing model outputs fail instead of producing a game result', () => {
  const {judge:request, opponent:other} = buildRequests({scene:'x',utterance:'y',intent:'z'});
  assert.throws(()=>validateResponse(request,{model:'test',answers:{}}));
  const response = {model:'test',answers:{reading:{type:'choice',choice:'benevolent',confidence:0.8,probabilities:{benevolent:0.8,hostile:0.8,unclear:0.1}}}};
  assert.throws(()=>validateResponse(other,response));
});

test('transport sends authentication only in headers and sanitizes upstream errors', async () => {
  const request=buildRequests({scene:'x',utterance:'y',intent:'z'}).opponent;
  await assert.rejects(callJev(request,{apiKey:'TEST_SECRET',fetchImpl:async(url,init)=>{
    assert.equal(url,'https://api.typesafe.ai/v1/systemone');
    assert.equal(init.headers.Authorization,'Bearer TEST_SECRET');
    assert.ok(!init.body.includes('TEST_SECRET'));
    return {ok:false,status:401,json:async()=>({echo:'TEST_SECRET'})};
  }}),{message:'TypeSafe HTTP 401; request stopped without automatic retry'});
  await assert.rejects(callJev(request,{apiKey:'TEST_SECRET',fetchImpl:async()=>{throw new Error('TEST_SECRET');}}),{message:'TypeSafe connection failed or timed out; no result recorded'});
});
