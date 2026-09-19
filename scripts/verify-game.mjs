import {mkdir,writeFile,appendFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GAME_STAGES,GAME_ROUNDS,buildGameRequests} from '../src/game.mjs';
import {evaluateRound,ELIGIBILITY,GAME_RULE_VERSION} from '../src/game-evaluation.mjs';
import {cases} from '../fixtures/cases.mjs';
import {walkthrough} from '../fixtures/walkthrough.mjs';

const jobs=[];
for(let repeat=1;repeat<=3;repeat++){
  for(const stage of GAME_STAGES)for(let index=0;index<3;index++)jobs.push({suite:'walkthrough',stage:stage.id,index,repeat,round:{...GAME_ROUNDS[stage.id][index],prompt:walkthrough[stage.id][index]}});
  for(const c of cases)jobs.push({suite:c.expectedEligible===false?'control':'kyoto-reference',stage:c.expectedEligible===false?'elementary':'kyoto',id:c.id,repeat,round:{scene:c.scene,intent:c.intent,prompt:c.utterance}});
}
// Same reference set on earlier roles once, to distinguish role tendencies from
// different stage questions. Kyoto is measured three times above.
for(const stage of GAME_STAGES.filter(s=>s.id!=='kyoto'))for(const c of cases.filter(c=>c.expectedEligible!==false))jobs.push({suite:'role-reference',stage:stage.id,id:c.id,repeat:1,round:{scene:c.scene,intent:c.intent,prompt:c.utterance}});
const dir=new URL(`../results/game-verified-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url);await mkdir(dir,{recursive:true});
const hashes={};for(const file of ['src/game.mjs','src/game-evaluation.mjs','src/personas.mjs','src/http-server.mjs','src/comments.mjs'])hashes[file]=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
await writeFile(new URL('manifest.json',dir),JSON.stringify({ruleVersion:GAME_RULE_VERSION,thresholds:ELIGIBILITY,jobs,hashes,notes:'Authored regression examples; not human population win rates. Three repeated live calls, no mocked judgment.'},null,2));
const rows=[];let cursor=0,failed=false;
async function worker(){while(!failed&&cursor<jobs.length){const job=jobs[cursor++],stage=GAME_STAGES.find(s=>s.id===job.stage);const requests=buildGameRequests(stage,job.round);try{const row={...job,requests,...await evaluateRound(requests,{apiKey:process.env.TYPESAFE_API_KEY})};rows.push(row);await appendFile(new URL('responses.jsonl',dir),JSON.stringify(row)+'\n');if(rows.length%15===0)console.log(`${rows.length}/${jobs.length}`);}catch(error){failed=true;await writeFile(new URL('error.json',dir),JSON.stringify({job,message:error.message}));}}}
await Promise.all([worker(),worker(),worker()]);
const summary={failed,completed:rows.length,models:[...new Set(rows.flatMap(r=>Object.values(r.results).map(x=>x.response.model)))],walkthrough:GAME_STAGES.map(stage=>({stage:stage.id,rounds:[0,1,2].map(index=>({index,results:rows.filter(r=>r.suite==='walkthrough'&&r.stage===stage.id&&r.index===index).map(r=>r.assessment.result)})),cleared:[1,2,3].map(repeat=>{const rr=rows.filter(r=>r.suite==='walkthrough'&&r.stage===stage.id&&r.repeat===repeat);return rr.length===3&&rr.filter(r=>r.assessment.result==='success').length>=2;})})),controls:rows.filter(r=>r.suite==='control').map(r=>({id:r.id,repeat:r.repeat,result:r.assessment.result,reasons:r.assessment.reasons})),roles:GAME_STAGES.map(stage=>{const rr=rows.filter(r=>['role-reference','kyoto-reference'].includes(r.suite)&&r.stage===stage.id);return {stage:stage.id,n:rr.length,caught:rr.filter(r=>r.assessment.caught).length,success:rr.filter(r=>r.assessment.result==='success').length,invalid:rr.filter(r=>r.assessment.result==='invalid').length,meanHostility:rr.reduce((s,r)=>s+r.assessment.hostility,0)/rr.length};})};
await writeFile(new URL('summary.json',dir),JSON.stringify(summary,null,2));
console.log(JSON.stringify({directory:dir.pathname,...summary},null,2));
if(failed||summary.walkthrough.some(s=>s.cleared.some(x=>!x))||summary.controls.some(c=>c.result!=='invalid'))process.exitCode=1;
