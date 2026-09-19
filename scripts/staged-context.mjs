import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cases } from '../fixtures/cases.mjs';
import { callJev, MODEL } from '../src/evaluation.mjs';
import { buildStagedRequests, personas } from '../src/personas.mjs';

if (!process.env.TYPESAFE_API_KEY?.trim()) { console.error('TYPESAFE_API_KEY is missing'); process.exit(1); }
const model=process.env.TYPESAFE_MODEL || MODEL;
const dir=fileURLToPath(new URL(`../results/staged-context-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url));
await mkdir(dir,{recursive:true});
await writeFile(`${dir}manifest.json`,JSON.stringify({model,repeats:3,caseIds:cases.map(c=>c.id),plannedRequests:330,version:'staged-context-v1',threshold:0.7,design:'Progressive context disclosure: elementary+middle utterance only; high short first sentence of scene; university full scene; adult full scene plus relationship; Kyoto full scene plus relationship and social_context. Each group is a separate request because TypeSafe questions in one request share one state.'},null,2));
const records=[];
let failure=false;
outer:for(let repeat=1;repeat<=3;repeat++){
  for(const example of cases){
    for(const group of buildStagedRequests(example,model)){
      try{
        const result=await callJev(group.request,{apiKey:process.env.TYPESAFE_API_KEY});
        const row={id:example.id,kind:example.kind,repeat,group:group.group,roles:group.roles,context:group.context,request:group.request,...result};
        records.push(row);
        await appendFile(`${dir}responses.jsonl`,JSON.stringify(row)+'\n');
        const values=group.roles.map(id=>`${id}=${result.response.answers[id].probabilities.hostile.toFixed(2)}`).join(' ');
        console.log(`${example.id} [${repeat}] ${group.group} ${values}`);
      }catch(error){
        await appendFile(`${dir}errors.jsonl`,JSON.stringify({id:example.id,repeat,group:group.group,message:error.message})+'\n');
        console.error(error.message); failure=true; break outer;
      }
    }
  }
}
const candidateIds=new Set(cases.filter(c=>c.expectedEligible!==false).map(c=>c.id));
const roles=personas;
const allRows=role=>records.filter(r=>r.roles.includes(role.id));
function roleRows(role,idSet=null){return records.filter(r=>r.roles.includes(role.id)&&(!idSet||idSet.has(r.id)));}
function metrics(role,idSet){const rows=roleRows(role,idSet);const answer=r=>r.response.answers[role.id];return {id:role.id,label:role.label,n:rows.length,meanHostility:rows.length?rows.reduce((s,r)=>s+answer(r).probabilities.hostile,0)/rows.length:null,caught:rows.filter(r=>answer(r).choice==='hostile'&&answer(r).probabilities.hostile>=0.7).length,fooled:rows.filter(r=>answer(r).choice==='benevolent'&&answer(r).probabilities.benevolent>=0.7).length};}
const byCase=cases.map(c=>({id:c.id,kind:c.kind,utterance:c.utterance,hostility:Object.fromEntries(roles.map(role=>{const rows=roleRows(role,new Set([c.id]));return [role.id,rows.length?rows.reduce((s,r)=>s+r.response.answers[role.id].probabilities.hostile,0)/rows.length:null];}))}));
const summary={failure,requests:records.length,modelIds:[...new Set(records.map(r=>r.response.model))],candidateMetrics:roles.map(role=>metrics(role,candidateIds)),controlMetrics:roles.map(role=>metrics(role,new Set(cases.filter(c=>c.expectedEligible===false).map(c=>c.id)))),byCase};
await writeFile(`${dir}summary.json`,JSON.stringify(summary,null,2));
console.log(`Saved ${dir}`);
if(failure)process.exitCode=1;
