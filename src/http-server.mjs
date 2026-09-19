import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {callJev,MODEL} from './evaluation.mjs';
import {evaluateRound} from './game-evaluation.mjs';
import {GAME_STAGES,buildGameRequests,buildRoundReactionRequest,buildMatchReactionRequest,roundReactionCandidates,matchReactionCandidates,findGameRound,publicGameConfig} from './game.mjs';

const publicDir=fileURLToPath(new URL('../web/',import.meta.url));
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20000)throw new Error('発言が長すぎます。');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export function createGameServer({apiKey,model=MODEL,call=callJev}={}){
  const sessions=new Map();
  async function reaction(request,candidates){
    try{const r=await call(request,{apiKey});const selected=candidates.find(c=>c.id===r.response.answers.reaction.choice);if(!selected)throw new Error('Invalid reaction');return {...selected,selectionSource:'jev'};}
    catch{return {...candidates[0],selectionSource:'fallback'};}
  }
  async function handleRound(input,res){
    const session=sessions.get(input.sessionId);
    if(!session)return json(res,404,{error:'ゲームが見つかりません。タイトルから始め直してください。'});
    const utterance=typeof input.utterance==='string'?input.utterance.trim():'';
    if(!utterance||utterance.length>300)return json(res,400,{error:'発言を1〜300文字で入力してください。'});
    const key=`${input.stageId}:${input.roundIndex}`;
    const previous=session.receipts.get(key);
    if(previous)return previous.utterance===utterance?json(res,200,previous.response):json(res,409,{error:'このラウンドは判定済みです。'});
    if(session.busy)return json(res,409,{error:'現在の発言を判定中です。しばらくお待ちください。'});
    const stage=GAME_STAGES[session.stageIndex];
    if(session.finished||session.lost||!stage||stage.id!==input.stageId||input.roundIndex!==session.history.length||!Number.isInteger(input.roundIndex))return json(res,409,{error:'現在のラウンドと一致しません。'});
    const {round}=findGameRound(stage.id,input.roundIndex);
    session.busy=true;
    try{
      const requests=buildGameRequests(stage,{...round,prompt:utterance},model);
      const {results,assessment}=await evaluateRound(requests,{apiKey,call});
      const current={round:input.roundIndex+1,scene:round.scene,intended_subtext:round.intent,utterance,result:assessment.result,assessment,judge:results.judge.response.answers,surface:results.surface.response.answers,opponent:results.opponent.response.answers.reading};
      const history=[...session.history,current];
      const roundReaction=await reaction(buildRoundReactionRequest(stage,history,current,model),roundReactionCandidates(stage,assessment.result));
      current.reaction=roundReaction;
      const wins=history.filter(r=>r.result==='success').length;
      const response={stage:{id:stage.id,label:stage.label},round:current.round,roundWon:assessment.result==='success',result:assessment.result,reasons:assessment.reasons,hostility:assessment.hostility,reaction:roundReaction,wins,match:null};
      if(history.length===3){
        const won=wins>=2;
        const matchReaction=await reaction(buildMatchReactionRequest(stage,history,won,model),matchReactionCandidates(stage,history,won));
        const next=GAME_STAGES[session.stageIndex+1];
        response.match={won,wins,reaction:matchReaction,allComplete:won&&!next,nextStage:won&&next?{id:next.id,number:next.number,label:next.label}:null};
        session.matches.push({stageId:stage.id,history,won,wins});
        if(won){session.stageIndex++;session.history=[];session.finished=!next;}
        else {session.history=history;session.lost=true;}
      }else session.history=history;
      session.receipts.set(key,{utterance,response});
      return json(res,200,response);
    }catch{
      // No round is consumed on transport/validation failure. Do not echo secrets.
      return json(res,502,{error:'Jevの判定を取得できませんでした。このラウンドは消費していません。再送してください。'});
    }finally{session.busy=false;}
  }
  return createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'別のサイトからの操作は受け付けません。'});
      if(req.method==='GET'&&url.pathname==='/api/game'){
        const sessionId=randomUUID();sessions.set(sessionId,{stageIndex:0,history:[],matches:[],receipts:new Map(),busy:false,lost:false,finished:false});
        return json(res,200,{sessionId,startStageIndex:0,model,...publicGameConfig()});
      }
      if(req.method==='POST'&&url.pathname.startsWith('/api/')){
        let input;try{input=await readBody(req);}catch{return json(res,400,{error:'入力を読み取れませんでした。'});}
        if(!input||typeof input!=='object')return json(res,400,{error:'入力が不正です。'});
        if(url.pathname==='/api/round')return await handleRound(input,res);
        if(url.pathname==='/api/retry'){
          const session=sessions.get(input.sessionId);
          if(!session)return json(res,404,{error:'ゲームが見つかりません。'});
          if(session.busy||!session.lost)return json(res,409,{error:'まだ再挑戦できません。'});
          session.history=[];session.lost=false;
          for(const key of session.receipts.keys())if(key.startsWith(GAME_STAGES[session.stageIndex].id+':'))session.receipts.delete(key);
          return json(res,200,{stageIndex:session.stageIndex});
        }
        return json(res,404,{error:'Not found'});
      }
      if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
      const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
      const file=resolve(publicDir,'.'+name);
      if(!file.startsWith(resolve(publicDir)+sep))return json(res,404,{error:'Not found'});
      try{const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}
      catch{return json(res,404,{error:'Not found'});}
    }catch{if(!res.headersSent)json(res,500,{error:'サーバーでエラーが発生しました。'});else res.end();}
  });
}
