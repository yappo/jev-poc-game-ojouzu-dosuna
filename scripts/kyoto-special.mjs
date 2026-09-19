import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cases } from '../fixtures/cases.mjs';
import { callJev, MODEL } from '../src/evaluation.mjs';
import { buildKyotoSpecialRequest, KYOTO_SPECIAL_HINT } from '../src/personas.mjs';

if (!process.env.TYPESAFE_API_KEY?.trim()) { console.error('TYPESAFE_API_KEY is missing'); process.exit(1); }
const model=process.env.TYPESAFE_MODEL || MODEL;
const dir=fileURLToPath(new URL(`../results/kyoto-special-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url));
await mkdir(dir,{recursive:true});
await writeFile(`${dir}manifest.json`,JSON.stringify({model,repeats:3,caseIds:cases.map(c=>c.id),plannedRequests:66,version:'kyoto-special-v1',includeScene:false,threshold:0.7,hint:KYOTO_SPECIAL_HINT,design:'One Kyoto-reading role with explicit linguistic cues: euphemistic criticism, excessive or incongruous honorifics, oddly selected praise, and unfavorable comparison. No scene or private intent. Exploratory authored fixtures, not held-out validation.'},null,2));
const records=[];
let failure=false;
outer:for(let repeat=1;repeat<=3;repeat++){
  for(const example of cases){
    try{
      const request=buildKyotoSpecialRequest(example,model);
      const result=await callJev(request,{apiKey:process.env.TYPESAFE_API_KEY});
      const row={id:example.id,kind:example.kind,repeat,request,...result};
      records.push(row);
      await appendFile(`${dir}responses.jsonl`,JSON.stringify(row)+'\n');
      const a=result.response.answers.reading;
      console.log(`${example.id} [${repeat}] ${a.choice} hostile=${a.probabilities.hostile.toFixed(2)} benevolent=${a.probabilities.benevolent.toFixed(2)}`);
    }catch(error){
      await appendFile(`${dir}errors.jsonl`,JSON.stringify({id:example.id,repeat,message:error.message})+'\n');
      console.error(error.message); failure=true; break outer;
    }
  }
}
const candidateIds=new Set(cases.filter(c=>c.expectedEligible!==false).map(c=>c.id));
const controls=records.filter(r=>!candidateIds.has(r.id));
const candidates=records.filter(r=>candidateIds.has(r.id));
const mean=rows=>rows.length?rows.reduce((s,r)=>s+r.response.answers.reading.probabilities.hostile,0)/rows.length:null;
const count=(rows,pred)=>rows.filter(pred).length;
const isCaught=r=>{const a=r.response.answers.reading;return a.choice==='hostile'&&a.probabilities.hostile>=0.7;};
const isFooled=r=>{const a=r.response.answers.reading;return a.choice==='benevolent'&&a.probabilities.benevolent>=0.7;};
const byCase=cases.map(c=>{const rows=records.filter(r=>r.id===c.id);return {id:c.id,kind:c.kind,utterance:c.utterance,n:rows.length,meanHostility:mean(rows),caught:count(rows,isCaught),fooled:count(rows,isFooled),choices:Object.fromEntries(['benevolent','hostile','unclear'].map(x=>[x,count(rows,r=>r.response.answers.reading.choice===x)]))};});
const summary={failure,requests:records.length,modelIds:[...new Set(records.map(r=>r.response.model))],candidates:{n:candidates.length,meanHostility:mean(candidates),caught:count(candidates,isCaught),fooled:count(candidates,isFooled)},controls:{n:controls.length,meanHostility:mean(controls),caught:count(controls,isCaught),fooled:count(controls,isFooled)},byCase};
await writeFile(`${dir}summary.json`,JSON.stringify(summary,null,2));
console.log(`Saved ${dir}`);
if(failure)process.exitCode=1;
