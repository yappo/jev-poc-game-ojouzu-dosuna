import {mkdir,appendFile} from 'node:fs/promises';
import {GAME_STAGES,GAME_ROUNDS,buildGameRequests} from '../src/game.mjs';
import {evaluateRound} from '../src/game-evaluation.mjs';
import {cases} from '../fixtures/cases.mjs';
const alternatives=[
 [0,'ご自分の信念を大切にしてはって、ほんま頼もしいお方やねぇ。'],
 [0,'お考えに一本芯が通ってはりますなぁ。いつお会いしても変わらへん安心感がありますわ。'],
 [0,'ご自分の世界をお持ちで、ほんま素敵どすなぁ。'],
 [1,'ええお手本の良さを、よう生かしてはりますなぁ。お上手やわぁ。'],
 [1,'ええものをそのまま残すお力があって、感心しますわぁ。'],
 [1,'お手本の持ち味がよう伝わってきて、素敵な仕上がりどすなぁ。'],
 [2,'一つお願いしただけで、こんなにお返しいただけるやなんて。ほんま、気前のええお方やわぁ。'],
 [2,'ようけお話ししてくれはって、たいそう丁寧なお方ですなぁ。'],
 [2,'お話に花が咲いて、一日でも楽しめそうやわぁ。']
];
const jobs=alternatives.map(([index,prompt])=>({suite:'adult',stage:'adult',index,round:{...GAME_ROUNDS.adult[index],prompt}}));
for(const c of cases.filter(c=>c.expectedEligible!==false))jobs.push({suite:'kyoto-reference',stage:'kyoto',id:c.id,round:{scene:c.scene,intent:c.intent,prompt:c.utterance}});
const dir=new URL(`../results/endgame-probe-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url);await mkdir(dir,{recursive:true});
let cursor=0;async function worker(){while(cursor<jobs.length){const job=jobs[cursor++],stage=GAME_STAGES.find(s=>s.id===job.stage);const requests=buildGameRequests(stage,job.round);const row={...job,requests,...await evaluateRound(requests,{apiKey:process.env.TYPESAFE_API_KEY})};await appendFile(new URL('responses.jsonl',dir),JSON.stringify(row)+'\n');console.log(JSON.stringify({suite:job.suite,index:job.index,id:job.id,text:job.round.prompt,...row.assessment}));}}
await Promise.all([worker(),worker()]);console.log(dir.pathname);
