import {resultCopy} from './result-copy.js';
const screens = [...document.querySelectorAll('.screen')];
const $ = id => document.getElementById(id);
const state = { config:null, sessionId:null, stageIndex:0, roundIndex:0, wins:0, stage:null };

function show(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  window.scrollTo({ top:0, behavior:'smooth' });
}

function safePattern(pattern) { return String(pattern || '').replace(/[^a-z0-9-]/gi, ''); }

function setPortrait(element, pattern) {
  element.className = `opponent-portrait ${element.classList.contains('large') ? 'large' : ''} portrait-${safePattern(pattern)}`;
  element.dataset.character = state.stage.id;
  const img = document.createElement('img');
  img.src = `/assets/characters/${state.stage.id}.png`;
  img.alt = state.stage.label;
  img.width = 512;
  img.height = 512;
  img.decoding = 'async';
  element.replaceChildren(img);
}

async function loadGame() {
  const response = await fetch('/api/game', { cache:'no-store' });
  if (!response.ok) throw new Error('ゲームサーバーに接続できません。');
  state.config = await response.json();
  state.sessionId = state.config.sessionId;
  $('boot-status').textContent = '対戦台の準備ができました。';
  $('start-button').disabled = false;
}

function stageAt(index = state.stageIndex) { return state.config.stages[index]; }

function showIntro(index) {
  state.stageIndex = index;
  state.stage = stageAt(index);
  document.body.dataset.stage = state.stage.id;
  state.roundIndex = 0;
  state.wins = 0;
  const stage = state.stage;
  $('intro-number').textContent = `STAGE ${stage.number}`;
  $('intro-title').textContent = stage.title;
  $('intro-label').textContent = stage.label;
  $('intro-description').textContent = stage.intro;
  $('intro-quote').textContent = `「${stage.entrance}」`;
  setPortrait($('intro-portrait'), stage.id);
  show('intro-screen');
}

function renderBattle() {
  const stage = state.stage;
  const round = stage.rounds[state.roundIndex];
  $('battle-stage').textContent = `STAGE ${stage.number}`;
  $('battle-title').textContent = stage.title;
  $('opponent-name').textContent = stage.label;
  $('opponent-role').textContent = stage.intro;
  $('situation').textContent = round.scene;
  $('win-count').textContent = state.wins;
  $('utterance').value = '';
  $('character-count').textContent = '0 / 300';
  $('battle-status').textContent = '';
  $('round-pips').replaceChildren(...[0,1,2].map(index => { const pip=document.createElement('span'); pip.className = index < state.roundIndex ? 'done' : index === state.roundIndex ? 'active' : ''; pip.setAttribute('aria-label',`ラウンド${index+1}`); return pip; }));
  setPortrait($('battle-portrait'), stage.id);
  show('battle-screen');
  $('utterance').focus();
}

function showRoundResult(result) {
  const won = result.roundWon;
  const mark = $('round-result-mark');
  mark.className = `result-mark ${won ? 'win' : 'lose'}`;
  mark.querySelector('span').textContent = won ? '○' : '×';
  $('round-result-kicker').textContent = `ROUND ${result.round} ${won ? 'WIN' : 'LOSS'}`;
  const copy=resultCopy(result);
  $('round-result-title').textContent = copy.title;
  $('round-result-detail').textContent = copy.detail + (result.reaction.selectionSource==='fallback'?' 相手のコメント選択に接続できなかったため、既定の反応を表示しています。':'');
  $('round-reaction').textContent = result.reaction.text;
  setPortrait($('round-reaction-portrait'), result.reaction.imagePattern);
  $('round-next-button').textContent = result.match ? '対戦結果を見る' : '次のラウンドへ';
  show('round-screen');
}

function showMatchResult(match) {
  const mark = $('match-result-mark');
  mark.className = `result-mark ${match.won ? 'win' : 'lose'}`;
  mark.querySelector('span').textContent = match.won ? '○' : '×';
  $('match-result-title').textContent = match.won ? 'ステージクリア' : 'ステージ失敗';
  $('match-score').textContent = `${match.wins} / 3 勝利`;
  $('match-status').textContent = match.reaction.selectionSource==='fallback'?'相手のコメント選択に接続できなかったため、既定の反応を表示しています。':'';
  $('match-reaction').textContent = match.reaction.text;
  setPortrait($('match-reaction-portrait'), match.reaction.imagePattern);
  const button = $('match-next-button');
  button.textContent = match.allComplete ? 'エンディングへ' : match.won ? '次の相手へ' : 'もう一度この相手に挑む';
  show('match-screen');
}

async function submitUtterance(event) {
  event.preventDefault();
  const button = $('submit-button');
  if(button.disabled)return;
  const utterance = $('utterance').value.trim();
  if (!utterance) return;
  button.disabled = true;
  $('utterance').disabled = true;
  $('battle-status').textContent = '相手が言葉の裏を読んでいます…';
  try {
    const response = await fetch('/api/round', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ sessionId:state.sessionId, stageId:state.stage.id, roundIndex:state.roundIndex, utterance }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '判定に失敗しました。');
    state.wins += result.roundWon ? 1 : 0;
    state.roundIndex += 1;
    state.lastResult = result;
    showRoundResult(result);
  } catch (error) {
    $('battle-status').textContent = error.message;
  } finally { button.disabled = false; $('utterance').disabled=false; }
}

function nextFromRound() {
  if (state.lastResult?.match) return showMatchResult(state.lastResult.match);
  renderBattle();
}

async function nextFromMatch() {
  const button=$('match-next-button');
  if(button.disabled)return;
  button.disabled=true;
  try{
  const match = state.lastResult.match;
  if (match.allComplete) return show('ending-screen');
  if (!match.won) {
    const response=await fetch('/api/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:state.sessionId})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'再挑戦できませんでした。');
    return showIntro(data.stageIndex);
  }
  state.stageIndex += 1;
  return showIntro(state.stageIndex);
  }catch(error){$('match-status').textContent=error.message;}finally{button.disabled=false;}
}

async function startNewSession() {
  const response = await fetch('/api/game', { cache:'no-store' });
  if (!response.ok) throw new Error('ゲームを再開できません。');
  state.config = await response.json();
  state.sessionId = state.config.sessionId;
  state.stageIndex = 0;
  state.roundIndex = 0;
  state.wins = 0;
  state.stage = stageAt(state.stageIndex);
}

$('start-button').disabled = true;
$('start-button').addEventListener('click', () => showIntro(0));
$('enter-button').addEventListener('click', renderBattle);
$('utterance-form').addEventListener('submit', submitUtterance);
$('round-next-button').addEventListener('click', nextFromRound);
$('match-next-button').addEventListener('click', nextFromMatch);
$('restart-button').addEventListener('click', async () => { await startNewSession(); showIntro(0); });
$('utterance').addEventListener('input', event => { $('character-count').textContent = `${event.target.value.length} / 300`; });

loadGame().catch(error => { $('boot-status').textContent = error.message; });
