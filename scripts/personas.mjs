import { mkdir, appendFile, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cases } from '../fixtures/cases.mjs';
import { callJev, MODEL } from '../src/evaluation.mjs';
import { buildPersonaRequest, personas } from '../src/personas.mjs';

if (!process.env.TYPESAFE_API_KEY?.trim()) { console.error('TYPESAFE_API_KEY is missing'); process.exit(1); }
const model=process.env.TYPESAFE_MODEL || MODEL;
const includeScene=!process.argv.includes('--no-scene');
const progressiveHints=process.argv.includes('--progressive-hints');
const version=progressiveHints?'personas-progressive-hints-v1':includeScene?'personas-v1':'personas-no-scene-v1';
const prefix=progressiveHints?'personas-progressive-hints':includeScene?'personas':'personas-no-scene';
const resume = process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
const dir=resume || fileURLToPath(new URL(`../results/${prefix}-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url));
await mkdir(dir,{recursive:true});
if (!resume) await writeFile(`${dir}manifest.json`,JSON.stringify({model,personas,repeats:3,caseIds:cases.map(c=>c.id),plannedRequests:66,version,includeScene,progressiveHints,threshold:0.7,design:progressiveHints?'Identical utterance only for seven independent persona questions. Scene and private intent omitted. Each role receives progressively stronger guidance about considering indirect meaning; Kyoto role receives the user-proposed fictional role text.':'Identical scene and utterance for seven independent persona questions. Private intent omitted. Labels only; no prescribed ordering or suspicion levels. Rotate question order on repetition. Exploratory authored fixtures, not held-out validation.'},null,2));
const records=resume ? (await readFile(`${dir}responses.jsonl`,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse) : [];
if(resume){const manifest=JSON.parse(await readFile(`${dir}manifest.json`,'utf8'));if(manifest.model!==model||manifest.version!==version)throw new Error('Resume configuration mismatch');}
let failure=false;
outer:for(let repeat=0;repeat<3;repeat++){
  for(const example of cases){
    if(records.some(r=>r.id===example.id&&r.repeat===repeat+1))continue;
    const request=buildPersonaRequest(example,(repeat*2)%personas.length,model,{includeScene,progressiveHints});
    try{
      const result=await callJev(request,{apiKey:process.env.TYPESAFE_API_KEY});
      const row={id:example.id,kind:example.kind,repeat:repeat+1,request,...result};
      records.push(row);
      await appendFile(`${dir}responses.jsonl`,JSON.stringify(row)+'\n');
      console.log(`${example.id} [${repeat+1}] hostility: ${personas.map(p=>result.response.answers[p.id].probabilities.hostile.toFixed(2)).join(' / ')}`);
    }catch(error){
      await appendFile(`${dir}errors.jsonl`,JSON.stringify({id:example.id,repeat:repeat+1,message:error.message})+'\n');
      console.error(error.message); failure=true;break outer;
    }
  }
}
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const candidateIds=cases.filter(c=>c.expectedEligible!==false).map(c=>c.id);
const benignIds=['ai-unrelated-praise','child-healthy','watch-genuine','ai-confidence-benign'];
const subset=ids=>records.filter(r=>ids.includes(r.id));
const metrics=rows=>personas.map(p=>({id:p.id,label:p.label,n:rows.length,meanHostility:mean(rows.map(r=>r.response.answers[p.id].probabilities.hostile)),caught:rows.filter(r=>{const a=r.response.answers[p.id];return a.choice==='hostile'&&a.probabilities.hostile>=0.7;}).length,fooled:rows.filter(r=>{const a=r.response.answers[p.id];return a.choice==='benevolent'&&a.probabilities.benevolent>=0.7;}).length}));
const byCase=cases.map(c=>({id:c.id,utterance:c.utterance,kind:c.kind,n:subset([c.id]).length,hostility:personas.map(p=>mean(subset([c.id]).map(r=>r.response.answers[p.id].probabilities.hostile)))}));
const complete=byCase.filter(c=>c.n===3);
const candidateRows=complete.filter(c=>candidateIds.includes(c.id));
const inversions=personas.slice(0,-1).map((p,i)=>({from:p.label,to:personas[i+1].label,candidateCount:candidateRows.length,meanDelta:mean(candidateRows.map(c=>c.hostility[i+1]-c.hostility[i])),decreasingCases:candidateRows.filter(c=>c.hostility[i+1]<c.hostility[i]-1e-8).map(c=>c.id)}));
const summary={failure,requests:records.length,modelIds:[...new Set(records.map(r=>r.response.model))],sarcasm:metrics(subset(candidateIds)),benignControls:metrics(subset(benignIds)),directInsult:metrics(subset(['ai-direct-insult'])),byCase,inversions,monotonicCandidateCases:candidateRows.filter(c=>c.hostility.every((v,i)=>!i||v>=c.hostility[i-1]-1e-8)).map(c=>c.id)};
await writeFile(`${dir}summary.json`,JSON.stringify(summary,null,2));
console.log(`Saved ${dir}`);
if(failure)process.exitCode=1;
