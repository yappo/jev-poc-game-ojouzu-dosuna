import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cases } from '../fixtures/cases.mjs';
import { buildRequests, callJev, assess, MODEL, RULE_VERSION } from '../src/evaluation.mjs';

const args = process.argv.slice(2);
if (args.some(a => !['--dry-run'].includes(a) && !a.startsWith('--only=') && !a.startsWith('--repeat='))) throw new Error('Usage: npm run evaluate -- [--dry-run] [--only=id,id] [--repeat=1..3]');
const dryRun = args.includes('--dry-run');
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',');
const repeats = Number(args.find(a => a.startsWith('--repeat='))?.slice(9) ?? 1);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('repeat must be 1..3');
if (only?.some(id => !cases.some(c => c.id === id))) throw new Error('Unknown case id');
const selected = cases.filter(c => !only || only.includes(c.id));
const model = process.env.TYPESAFE_MODEL || MODEL;
if (!dryRun && !process.env.TYPESAFE_API_KEY?.trim()) {
  console.error('TYPESAFE_API_KEY is missing. Load your shell configuration or use node --env-file=.env scripts/evaluate.mjs. Never paste the key into output.');
  process.exit(1);
}
const runId = new Date().toISOString().replaceAll(':', '-');
const dir = fileURLToPath(new URL(`../results/${runId}${dryRun ? '-dry-run' : ''}/`, import.meta.url));
await mkdir(dir, { recursive:true });
await writeFile(`${dir}manifest.json`, JSON.stringify({ runId, dryRun, model, ruleVersion:RULE_VERSION, repeats, caseIds:selected.map(c=>c.id), plannedRequests:dryRun ? 0 : selected.length * repeats * 2, note:'Authored exploratory fixtures, not human-validated ground truth. Thresholds were fixed before first run.' }, null, 2));
const records = [];
let failed = false;
outer: for (let repeat = 1; repeat <= repeats; repeat++) {
  for (const example of selected) {
    const requests = buildRequests(example, model);
    if (dryRun) {
      await appendFile(`${dir}requests.jsonl`, JSON.stringify({ id:example.id, repeat, requests })+'\n');
      continue;
    }
    // Separate states and requests are essential: never batch the private intent
    // and the opponent's questions in a shared Jev state.
    const settled = await Promise.allSettled(Object.entries(requests).map(async ([role, request]) => {
      const result = await callJev(request, { apiKey:process.env.TYPESAFE_API_KEY });
      return { role, ...result };
    }));
    const record = { id:example.id, repeat, example, requests, results:{}, errors:[] };
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') record.results[result.value.role] = result.value;
      else record.errors.push({ role:Object.keys(requests)[index], message:result.reason.message });
    });
    if (!record.errors.length) record.assessment = assess(record.results.judge.response, record.results.opponent.response);
    await appendFile(`${dir}responses.jsonl`, JSON.stringify(record)+'\n');
    records.push(record);
    if (record.errors.length) {
      console.error(`${example.id}: ${record.errors.map(e=>e.message).join('; ')}`);
      failed = true;
      break outer;
    }
    const a = record.results.judge.response.answers;
    const o = record.results.opponent.response.answers.reading;
    console.log(`${example.id} [${repeat}] ${record.assessment.result} | link=${a.target_link.noul.toFixed(3)} praise=${a.praise_facade.noul.toFixed(3)} direct=${a.direct_attack.noul.toFixed(3)} coherent=${a.coherent.noul.toFixed(3)} | ${o.choice} ${JSON.stringify(o.probabilities)}`);
  }
}
const summary = { dryRun, failed, completedCases:records.filter(r=>r.assessment).length, outcomes:{}, controlFalsePasses:[], modelIds:[...new Set(records.flatMap(r=>Object.values(r.results).map(v=>v.response.model)))] };
for (const r of records.filter(r=>r.assessment)) {
  summary.outcomes[r.assessment.result] = (summary.outcomes[r.assessment.result] || 0) + 1;
  if (r.example.expectedEligible === false && r.assessment.eligible) summary.controlFalsePasses.push(r.id);
}
await writeFile(`${dir}summary.json`, JSON.stringify(summary, null, 2));
console.log(`${dryRun ? 'Dry run only; no API calls.' : 'Evaluation saved.'} ${dir}`);
if (failed) process.exitCode = 1;
