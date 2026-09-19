import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cases } from '../fixtures/cases.mjs';
import { callJev, MODEL } from '../src/evaluation.mjs';
import { buildTargetedContextRequests, personas } from '../src/personas.mjs';

if (!process.env.TYPESAFE_API_KEY?.trim()) { console.error('TYPESAFE_API_KEY is missing'); process.exit(1); }
const model=process.env.TYPESAFE_MODEL || MODEL;
const dir=fileURLToPath(new URL(`../results/targeted-context-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url));
await mkdir(dir,{recursive:true});
await writeFile(`${dir}manifest.json`,JSON.stringify({model,repeats:3,caseIds:cases.map(c=>c.id),plannedRequests:132,version:'targeted-context-v1',threshold:0.7,design:'Target calibration: elementary through adult receive utterance only with progressively cautious reading guidance; Kyoto receives full scene plus relationship and social context with specific Kyoto-style linguistic cues. New graduate year omitted. Exploratory authored fixtures, not held-out validation.'},null,2));
const records=[];
let failure=false;
outer:for(let repeat=1;repeat<=3;repeat++){
  for(const example of cases){
    for(const group of buildTargetedContextRequests(example,model)){
      try{
        const result=await callJev(group.request,{apiKey:process.env.TYPESAFE_API_KEY});
        const row={id:example.id,kind:example.kind,repeat,group:group.group,roles:group.roles,context:group.context,request:group.request,...result};
        records.push(row);
        await appendFile(`${dir}responses.jsonl`,JSON.stringify(row)+'\n');
        console.log(`${example.id} [${repeat}] ${group.group} ${group.roles.map(id=>`${id}=${result.response.answers[id].probabilities.hostile.toFixed(2)}`).join(' ')}`);
      }catch(error){
        await appendFile(`${dir}errors.jsonl`,JSON.stringify({id:example.id,repeat,group:group.group,message:error.message})+'\n');
        console.error(error.message); failure=true; break outer;
      }
    }
  }
}
const candidateIds=new Set(cases.filter(c=>c.expectedEligible!==false).map(c=>c.id));
const controlsIds=new Set(cases.filter(c=>c.expectedEligible===false).map(c=>c.id));
const roleRows=(idSet,id)=>records.filter(r=>idSet.has(r.id)&&r.roles.includes(id));
const metrics=(idSet,id)=>{const rows=roleRows(idSet,id);return {id,label:personas.find(p=>p.id===id)?.label,n:rows.length,meanHostility:rows.length?rows.reduce((s,r)=>s+r.response.answers[id].probabilities.hostile,0)/rows.length:null,caught:rows.filter(r=>r.response.answers[id].choice==='hostile'&&r.response.answers[id].probabilities.hostile>=0.7).length,fooled:rows.filter(r=>r.response.answers[id].choice==='benevolent'&&r.response.answers[id].probabilities.benevolent>=0.7).length};};
const roleIds=['elementary','middle','high','university','adult','kyoto'];
const byCase=cases.map(c=>({id:c.id,kind:c.kind,utterance:c.utterance,hostility:Object.fromEntries(roleIds.map(id=>{const rows=roleRows(new Set([c.id]),id);return [id,rows.length?rows.reduce((s,r)=>s+r.response.answers[id].probabilities.hostile,0)/rows.length:null];}))}));
const summary={failure,requests:records.length,modelIds:[...new Set(records.map(r=>r.response.model))],candidateMetrics:roleIds.map(id=>metrics(candidateIds,id)),controlMetrics:roleIds.map(id=>metrics(controlsIds,id)),byCase};
await writeFile(`${dir}summary.json`,JSON.stringify(summary,null,2));
console.log(`Saved ${dir}`);
if(failure)process.exitCode=1;
