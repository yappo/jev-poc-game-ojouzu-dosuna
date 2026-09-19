import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGameRequests,GAME_STAGES,findGameRound,matchReactionCandidates,buildMatchReactionRequest} from '../src/game.mjs';
import {assessRound} from '../src/game-evaluation.mjs';
import {resultCopy} from '../web/result-copy.js';

const n=noul=>({type:'noul',noul});
const judge={answers:{scene_support:n(.9),target_link:n(.85)}};
const surface={answers:{praise_facade:n(.9),coherent:n(.9),direct_attack:n(.05)}};
function opponent(choice,hostile){return {answers:{reading:{choice,probabilities:{hostile,benevolent:(1-hostile)/2,unclear:(1-hostile)/2}}}};}
test('valid ambiguity wins, actual detection loses, and invalid input cannot win',()=>{
  assert.equal(assessRound(judge,surface,opponent('unclear',.4)).result,'success');
  assert.equal(assessRound(judge,surface,opponent('hostile',.7)).result,'caught');
  assert.equal(assessRound(judge,surface,opponent('hostile',.69)).result,'success');
  for(const [key,value,reason] of [['praise_facade',.1,'praise'],['direct_attack',.9,'direct'],['coherent',.1,'coherence']]){
    const result=assessRound(judge,{answers:{...surface.answers,[key]:n(value)}},opponent('benevolent',.01));
    assert.equal(result.result,'invalid');assert.ok(result.reasons.includes(reason));
  }
  assert.deepEqual(assessRound({answers:{scene_support:n(.1),target_link:n(.9)}},surface,opponent('benevolent',.01)).reasons,['scene']);
});
test('all opponents use identical judges and only the opponent gets role context',()=>{
  const round=findGameRound('elementary',0).round;
  const requests=GAME_STAGES.map(stage=>buildGameRequests(stage,round));
  for(const req of requests){assert.deepEqual(req.judge,requests[0].judge);assert.deepEqual(req.surface,requests[0].surface);assert.deepEqual(req.surface.state,{utterance:round.prompt});assert.ok(!JSON.stringify(req.opponent).includes(round.intent));}
  assert.throws(()=>buildGameRequests(GAME_STAGES[0],{prompt:'test'}),/場面/);
});
test('invalid input is never described as detected hostility and advice reflects failure',()=>{
  const copy=resultCopy({result:'invalid',reasons:['meaning','praise']});
  assert.match(copy.title,/成立しません/);assert.doesNotMatch(copy.title,/見抜/);assert.match(copy.detail,/困りごと/);assert.match(copy.detail,/褒め言葉/);
  assert.match(resultCopy({result:'caught'}).detail,/裏の意味/);
});
test('match reaction distinguishes invalid losses and carries all actual judgments',()=>{
  const stage=GAME_STAGES[0];
  const history=[{round:1,result:'success',scene:'scene',intended_subtext:'private',utterance:'text',assessment:{reasons:[]},opponent:{choice:'unclear'}},{round:2,result:'invalid'},{round:3,result:'invalid'}];
  assert.ok(matchReactionCandidates(stage,history,false).every(c=>c.id.includes('neutral')));
  const req=buildMatchReactionRequest(stage,history,false);assert.equal(req.state.rounds[0].intended_subtext,'private');assert.equal(req.state.rounds[0].opponent.choice,'unclear');assert.equal(req.state.player_wins,1);assert.equal(req.state.played,3);
});
