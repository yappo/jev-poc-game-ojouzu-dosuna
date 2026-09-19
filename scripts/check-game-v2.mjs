import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {GAME_STAGES,GAME_ROUNDS,buildGameRequests} from '../src/game.mjs';
import {buildGameJudgeRequests,evaluateRound,ELIGIBILITY} from '../src/game-evaluation.mjs';
import {cases} from '../fixtures/cases.mjs';
const extras=[
  ['kyoto',0,'お子さん、お茶会の主役みたいで、皆さんのお目を集めてはりますなぁ。'],
  ['kyoto',0,'ええ声どすなぁ。奥のお席までよう届いております。'],
  ['kyoto',0,'お子さん、どのお席でもすぐ覚えていただけそうで、ええことどすなぁ。'],
  ['kyoto',0,'ご家族のにぎわいが、離れていてもよう伝わりますなぁ。'],
  ['kyoto',1,'そのお時計、大切にしてもろて幸せどすなぁ。'],
  ['kyoto',1,'お時計には、惜しまずお気持ちを注いではるんやねぇ。'],
  ['kyoto',1,'お時計のお話になると、ほんま楽しそうなお顔にならはりますなぁ。'],
  ['kyoto',1,'お時計のこと、もうすっかり覚えてしまいましたわ。お話がお上手どすなぁ。'],
  ['kyoto',2,'お話しぶりを聞いているだけで、こちらまで安心してしまいそうやわぁ。'],
  ['kyoto',2,'すぐにお返事くださるお気持ち、ほんま頼もしいことどすなぁ。'],
  ['kyoto',2,'ご自分のお考えを、ほんま大事にしてはるんやねぇ。'],
  ['kyoto',2,'お返事に迷いがあらへんのは、ほんま得なご性分やねぇ。']
];
const jobs=GAME_STAGES.flatMap(stage=>GAME_ROUNDS[stage.id].map((round,index)=>({stage:stage.id,index,kind:'shipped',round})));
for(const [stage,index,prompt] of extras)jobs.push({stage,index,kind:'candidate',round:{...GAME_ROUNDS[stage][index],prompt}});
for(const c of cases.filter(c=>c.expectedEligible===false))jobs.push({stage:'elementary',index:0,kind:'control',id:c.id,round:{scene:c.scene,intent:c.intent,prompt:c.utterance}});
const dir=new URL(`../results/game-v2-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url);
await mkdir(dir,{recursive:true});
await writeFile(new URL('manifest.json',dir),JSON.stringify({jobs,thresholds:ELIGIBILITY},null,2));
let cursor=0; const rows=[];
async function worker(){while(cursor<jobs.length){const job=jobs[cursor++],stage=GAME_STAGES.find(s=>s.id===job.stage);
const requests={...buildGameRequests(stage,job.round),...buildGameJudgeRequests(job.round)};
const row={...job,requests,...await evaluateRound(requests,{apiKey:process.env.TYPESAFE_API_KEY})};rows.push(row);await appendFile(new URL('responses.jsonl',dir),JSON.stringify(row)+'\n');
const a=row.assessment;console.log(JSON.stringify({stage:job.stage,index:job.index,kind:job.kind,id:job.id,text:job.round.prompt,result:a.result,reasons:a.reasons,hostility:a.hostility,target:row.results.judge.response.answers.target_link.noul,praise:row.results.surface.response.answers.praise_facade.noul}));}}
await Promise.all([worker(),worker()]);console.log(dir.pathname);
