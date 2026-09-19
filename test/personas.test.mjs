import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonaRequest, buildKyotoSpecialRequest, buildStagedRequests, buildTargetedContextRequests, KYOTO_SPECIAL_HINT, personas } from '../src/personas.mjs';
import { validateResponse } from '../src/evaluation.mjs';

test('seven roles share public context and criteria, omit private intent, and differ only by character label',()=>{
  const r=buildPersonaRequest({scene:'scene',utterance:'words',intent:'PRIVATE_INTENT',kind:'sarcasm'});
  assert.deepEqual(r.state,{scene:'scene',utterance:'words'});
  assert.ok(!JSON.stringify(r).includes('PRIVATE_INTENT'));
  assert.equal(Object.keys(r.questions).length,7);
  const normalized=personas.map(p=>r.questions[p.id].instructions.replace(p.label,'PERSONA'));
  assert.equal(new Set(normalized).size,1);
  for(const p of personas)assert.deepEqual(r.questions[p.id].criteria,r.questions.elementary.criteria);
  const rotated=buildPersonaRequest({scene:'scene',utterance:'words'},2);
  assert.notDeepEqual(Object.keys(rotated.questions),Object.keys(r.questions));
  for(const p of personas)assert.deepEqual(rotated.questions[p.id],r.questions[p.id]);
});

test('rounded probability sum of 0.99 is accepted without normalizing raw values',()=>{
  const request={questions:{reading:{type:'choice',criteria:{benevolent:'',hostile:'',unclear:''}}}};
  const response={model:'test',answers:{reading:{type:'choice',choice:'benevolent',confidence:0.2,probabilities:{benevolent:0.5,hostile:0.3,unclear:0.19}}}};
  assert.equal(validateResponse(request,response),response);
  response.answers.reading.probabilities.unclear=0.15;
  assert.throws(()=>validateResponse(request,response),/Invalid probability sum/);
});

test('situation-free request sends only the utterance and says not to invent context',()=>{
  const r=buildPersonaRequest({scene:'SECRET_SCENE',utterance:'words',intent:'PRIVATE_INTENT'},0,undefined,{includeScene:false});
  assert.deepEqual(r.state,{utterance:'words'});
  assert.ok(!JSON.stringify(r).includes('SECRET_SCENE'));
  assert.ok(!JSON.stringify(r).includes('PRIVATE_INTENT'));
  for(const p of personas)assert.match(r.questions[p.id].instructions,/without being told any surrounding situation/);
  assert.ok(!r.questions.kyoto.instructions.includes('生粋の京都人'));
});

test('role-specific hints are present and increase only the fictional reading guidance',()=>{
  const r=buildPersonaRequest({scene:'SECRET_SCENE',utterance:'words'},0,undefined,{includeScene:false,progressiveHints:true});
  for(const p of personas)assert.ok(r.questions[p.id].instructions.includes(p.hint));
  assert.ok(r.questions.kyoto.instructions.includes('生粋の京都人'));
  assert.ok(!r.questions.kyoto.instructions.includes('PRIVATE_INTENT'));
});

test('Kyoto-special request contains only utterance and explicit linguistic reading cues',()=>{
  const r=buildKyotoSpecialRequest({scene:'SECRET_SCENE',utterance:'words',intent:'PRIVATE_INTENT'});
  assert.deepEqual(r.state,{utterance:'words'});
  assert.ok(r.questions.reading.instructions.includes(KYOTO_SPECIAL_HINT));
  assert.ok(!JSON.stringify(r).includes('SECRET_SCENE'));
  assert.ok(!JSON.stringify(r).includes('PRIVATE_INTENT'));
});

test('staged context is progressively disclosed and never leaks private intent',()=>{
  const groups=buildStagedRequests({scene:'one。two。',utterance:'words',intent:'PRIVATE'});
  assert.deepEqual(groups.map(g=>g.group),['basic','short','full','relation','social']);
  assert.deepEqual(groups[0].request.state,{utterance:'words'});
  assert.deepEqual(groups[1].request.state,{situation:'one。',utterance:'words'});
  assert.equal(groups[2].request.state.situation,'one。two。');
  assert.deepEqual(groups[3].request.state.relationship,'ユーザーは相手に直接話しかけている。');
  assert.ok(groups[4].request.state.social_context);
  assert.ok(!JSON.stringify(groups).includes('PRIVATE'));
  assert.deepEqual(groups.flatMap(g=>g.roles),['elementary','middle','high','university','adult','kyoto']);
});

test('targeted context keeps the first five roles utterance-only and gives Kyoto the full scene',()=>{
  const groups=buildTargetedContextRequests({scene:'one。two。',utterance:'words',intent:'PRIVATE'});
  assert.deepEqual(groups.map(g=>g.group),['utterance-only','kyoto-full-context']);
  assert.deepEqual(groups[0].request.state,{utterance:'words'});
  assert.equal(groups[1].request.state.situation,'one。two。');
  assert.deepEqual(groups[0].roles,['elementary','middle','high','university','adult']);
  assert.deepEqual(groups[1].roles,['kyoto']);
  assert.ok(!JSON.stringify(groups).includes('PRIVATE'));
});
