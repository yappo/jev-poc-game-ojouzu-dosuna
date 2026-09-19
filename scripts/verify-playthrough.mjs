import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {createGameServer} from '../src/http-server.mjs';
import {GAME_STAGES} from '../src/game.mjs';
import {walkthrough} from '../fixtures/walkthrough.mjs';
import {GAME_RULE_VERSION} from '../src/game-evaluation.mjs';

if(!process.env.TYPESAFE_API_KEY)throw new Error('TYPESAFE_API_KEY is required');
const directory=new URL(`../results/playthrough-${new Date().toISOString().replaceAll(':','-')}/`,import.meta.url);
await mkdir(directory,{recursive:true});
const server=createGameServer({apiKey:process.env.TYPESAFE_API_KEY,model:process.env.TYPESAFE_MODEL});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const matches=[];
try{
  const game=await (await fetch(base+'/api/game')).json();
  await writeFile(new URL('manifest.json',directory),JSON.stringify({ruleVersion:GAME_RULE_VERSION,model:game.model,inputs:walkthrough},null,2));
  for(const stage of GAME_STAGES){
    for(let roundIndex=0;roundIndex<3;roundIndex++){
      const input={sessionId:game.sessionId,stageId:stage.id,roundIndex,utterance:walkthrough[stage.id][roundIndex]};
      const response=await fetch(base+'/api/round',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      const body=await response.json();
      await appendFile(new URL('responses.jsonl',directory),JSON.stringify({input,response:body,status:response.status})+'\n');
      assert.equal(response.status,200,JSON.stringify(body));
      assert.equal(body.reaction.selectionSource,'jev');
      console.log(`${stage.id} ${roundIndex+1}: ${body.result} / ${body.reaction.text}`);
      if(roundIndex===2){
        assert.equal(body.match.reaction.selectionSource,'jev');
        matches.push({stage:stage.id,...body.match});
        assert.equal(body.match.won,true,`${stage.id} did not clear`);
      }
    }
  }
  assert.equal(matches.at(-1).allComplete,true);
  await writeFile(new URL('summary.json',directory),JSON.stringify({passed:true,matches},null,2));
  console.log(`Ending reached. Results: ${directory.pathname}`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
