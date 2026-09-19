import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMENT_BANKS } from '../src/comments.mjs';
import { GAME_STAGES, GAME_ROUNDS, buildGameRequests, buildMatchReactionRequest, buildRoundReactionRequest, findGameRound, publicGameConfig } from '../src/game.mjs';

test('each opponent has 50 varied prewritten match comments',()=>{
  for(const stage of GAME_STAGES){
    assert.equal(COMMENT_BANKS[stage.id].win.length,25);
    assert.equal(COMMENT_BANKS[stage.id].lose.length,25);
    assert.equal(new Set([...COMMENT_BANKS[stage.id].win,...COMMENT_BANKS[stage.id].lose].map(c=>c.text)).size,50);
  }
});

test('public game config never exposes hidden subtext',()=>{
  const config=publicGameConfig();
  assert.equal(config.stages.length,6);
  assert.ok(!JSON.stringify(config).includes('intent'));
  assert.ok(!JSON.stringify(config).includes('身の丈に合わない'));
  assert.ok(!JSON.stringify(config).includes('元気そうなおこさん'));
  assert.equal(config.stages.every(stage=>stage.rounds.length===3),true);
});

test('game opponent receives stage-specific context while judge keeps private intent',()=>{
  const found=findGameRound('kyoto',0);
  const requests=buildGameRequests(found.stage,found.round);
  assert.ok(JSON.stringify(requests.judge).includes(found.round.intent));
  assert.ok(!JSON.stringify(requests.opponent).includes(found.round.intent));
  assert.equal(requests.opponent.state.situation,found.round.scene);
  const elementary=findGameRound('elementary',0);
  assert.deepEqual(buildGameRequests(elementary.stage,elementary.round).opponent.state,{utterance:elementary.round.prompt});
});

test('reaction selectors receive all played rounds and offer only prewritten choices',()=>{
  const found=findGameRound('adult',0);
  const history=[
    { round:1, scene:'one', utterance:'first', result:'success' },
    { round:2, scene:'two', utterance:'second', result:'caught' },
    { round:3, scene:'three', utterance:'third', result:'success' }
  ];
  const match=buildMatchReactionRequest(found.stage,history,true);
  assert.equal(Object.keys(match.questions.reaction.criteria).length,25);
  assert.equal(match.state.rounds.length,3);
  assert.ok(!JSON.stringify(match).includes('intent'));
  const round=buildRoundReactionRequest(found.stage,history,{round:3,scene:'three',utterance:'third',result:'success'});
  assert.equal(Object.keys(round.questions.reaction.criteria).length,25);
});
