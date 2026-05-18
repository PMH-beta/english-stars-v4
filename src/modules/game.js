// src/modules/game.js
import { QPERROUND } from './config.js';
import { effectivePct, isMastered } from './stats.js';
import { activeDeck, syncMirrorFromActiveDeck } from './decks.js';
import { showScreen, showMenu, hideFeedback } from './ui.js';
import { ensureMicStream, releaseMicStream } from './speech.js';

// Game state – all on window.* so Commit B functions (still in index.html) can read them as globals
window.isSchnellModus = false;
window.schnellDone = new Set();
window._schnellBackup = null;
window.currentQ = null;
window.mode = 'vocab';
window.questionPool = [];
window.questionIndex = 0;
window.answered = false;
window.points = 0;
window.streak = 0;
window.bestStreak = 0;
window.totalCorrect = 0;
window.wrongQueue = [];
window.isRetryPhase = false;
window.isFreePlay = false;
window._progressSaved = false;
window._pronounceAttempts = 0;
window._lastModePct = 0;

// ── Pool Utilities ──
function shuffle(a) {
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
  return b;
}

function pick(a, n) { return shuffle(a).slice(0,n); }

function weightedPickUnique(items, getStatFn, n) {
  const scored=items.map(item=>{
    const s=getStatFn(item);
    let w;
    if(!s||s.asked<3) w=3;
    else {
      const ep=effectivePct(s);
      if(ep>=0.9) w=1;
      else if(ep>=0.7) w=3;
      else if(ep>=0.4) w=4;
      else w=5;
    }
    return {item, key:-Math.pow(Math.random(),1/w)};
  });
  scored.sort((a,b)=>a.key-b.key);
  return scored.slice(0,n).map(x=>x.item);
}

function wrongVocab(correct, n=3) {
  return pick(window.VOCAB.filter(x=>x!==correct), n).map(x=>x.en);
}

// ── Question Builders ──
function bVocabMC(item) {
  return {type:'mc',badge:'vocab',statKey:item.de+'_mc',
    question:`🇩🇪 ${item.de}`,hint:'',
    choices:shuffle([item.en,...wrongVocab(item,3)]),answer:item.en};
}
function bVocabType(item) {
  return {type:'type',badge:'spelling',statKey:item.de+'_sp',
    question:`✏️ Schreibe auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}
function bVocabPronounce(item) {
  return {type:'pronounce',badge:'pronounce',statKey:item.de+'_pr',
    question:`🎙️ Sprich auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}

export function buildPool(m) {
  const vocab=window.VOCAB;
  const sd=window.SD;
  let qs=[];
  const limit=window.isSchnellModus ? vocab.length : QPERROUND;
  if(m==='vocab'){
    weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_mc'], limit).forEach(v=>qs.push(bVocabMC(v)));
  }
  if(m==='spelling'){
    weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_sp'], limit).forEach(v=>qs.push(bVocabType(v)));
  }
  if(m==='pronounce'){
    weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_pr'], limit).forEach(v=>qs.push(bVocabPronounce(v)));
  }
  if(m==='mixed_vocab'){
    if(window.isSchnellModus){
      vocab.forEach(v=>{qs.push(bVocabMC(v));qs.push(bVocabType(v));qs.push(bVocabPronounce(v));});
    } else {
      const n1=Math.round(QPERROUND/3), n2=Math.round(QPERROUND/3), n3=QPERROUND-n1-n2;
      weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_mc'], n1).forEach(v=>qs.push(bVocabMC(v)));
      weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_sp'], n2).forEach(v=>qs.push(bVocabType(v)));
      weightedPickUnique(vocab, v=>sd.wordStats[v.de+'_pr'], n3).forEach(v=>qs.push(bVocabPronounce(v)));
    }
  }
  if(window._skipMasteryFilter) return shuffle(qs).slice(0, limit);
  const filtered=qs.filter(q=>!isMastered(q));
  if(filtered.length===0) return qs.slice(0, limit);
  return shuffle(filtered).slice(0, limit);
}

// ── Schnell-Modus ──
export function toggleSchnell() {
  window.isSchnellModus = !window.isSchnellModus;
  const btn=document.getElementById('schnell-toggle');
  if(window.isSchnellModus){
    window._schnellBackup={wordStats:JSON.parse(JSON.stringify(activeDeck().wordStats))};
    activeDeck().wordStats={};
    syncMirrorFromActiveDeck();
    btn.textContent='⚡ Schnell: AN';
    btn.style.background='var(--orange)';btn.style.color='white';btn.style.boxShadow='0 3px 0 #cc4a1a';
    showMenu();
  } else {
    if(window._schnellBackup){
      activeDeck().wordStats=window._schnellBackup.wordStats;
      syncMirrorFromActiveDeck();
      window._schnellBackup=null;
    }
    btn.textContent='⚡ Schnell: AUS';
    btn.style.background='#eee';btn.style.color='#888';btn.style.boxShadow='0 3px 0 #ccc';
    showMenu();
  }
}

// ── Game Flow ──
export function startGame(m) {
  window.mode=m;
  window.points=0;window.streak=0;window.bestStreak=0;window.totalCorrect=0;
  window.questionPool=buildPool(m);
  window.questionIndex=0;window.answered=false;
  window.wrongQueue=[];window.isRetryPhase=false;window.isFreePlay=false;window._progressSaved=false;
  window.schnellDone=new Set();
  if(window.questionPool.length===0){
    if(!confirm('🏆 Modus gemeistert!\n\nNoch eine Runde ohne Wertung?'))return;
    window._skipMasteryFilter=true;
    window.questionPool=shuffle(buildPool(m)).slice(0,10);
    window._skipMasteryFilter=false;
    window.isFreePlay=true;
  }
  const hasPronounce=(m==='pronounce'||m==='mixed_vocab');
  if(hasPronounce&&navigator.mediaDevices){
    ensureMicStream();
    if(window._voskLoad && !window._voskModel && window._voskStatus!=='loading'){
      window._voskLoad().catch(()=>{});
    }
  }
  hideFeedback();
  showScreen('game-screen');
  window.updateScoreBar();
  window._lastModePct=0;
  window.updateModeProgress(false);
  showQuestion();
}

export function confirmHome() {
  if(confirm('Zurück zum Menü?\nDer Lernfortschritt dieser Runde wird gespeichert.')){
    window.saveProgress();
    hideFeedback();
    try{ releaseMicStream(); }catch(e){}
    try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
    showMenu();
  }
}

function showQuestion() {
  window.answered=false;
  hideFeedback();
  window._spokenForQuestion=false;
  window._pronounceAttempts=0;
  if(window.isSchnellModus){
    while(window.questionIndex<window.questionPool.length){
      const q=window.questionPool[window.questionIndex];
      if(q.statKey&&window.schnellDone.has(q.statKey)) window.questionIndex++;
      else break;
    }
  }
  if(window.questionIndex>=window.questionPool.length){
    if(!window.isFreePlay&&!window.isRetryPhase&&window.wrongQueue.length>0){
      window.isRetryPhase=true;
      window.questionPool=window.wrongQueue.slice();
      window.wrongQueue=[];
      window.questionIndex=0;
      const card=document.getElementById('game-card');
      card.innerHTML='<div style="padding:20px;font-size:1.1rem;font-weight:700;color:var(--orange)">'+
        '🔄 Jetzt nochmal die '+window.questionPool.length+' falschen Fragen!<br><span style="font-size:.85rem;color:#888;font-weight:600">Punkte zählen halb.</span></div>';
      setTimeout(()=>showQuestion(),2000);return;
    }
    window.showEnd();return;
  }
  document.getElementById('progress-fill').style.width=(window.questionIndex/window.questionPool.length*100)+'%';
  window.currentQ=window.questionPool[window.questionIndex];
  renderQuestion(window.currentQ);
}

function renderQuestion(q) {
  const card=document.getElementById('game-card');
  const bLabels={vocab:'🔤 Vokabeln',spelling:'✏️ Rechtschreibung',pronounce:'🎙️ Aussprache'};
  let html=`<div class="badge ${q.badge}">${bLabels[q.badge]||'📝'}</div>`;
  if(q.type==='mc'){
    html+=`<div class="question-text">${(q.question||'').replace(/\n/g,'<br>')}</div>`;
    html+=`<div class="choices">`;
    q.choices.forEach(c=>{
      html+=`<button class="choice-btn" onclick="checkMC(this,'${esc(c)}')">${c}</button>`;
    });
    html+=`</div>`;
  } else if(q.type==='type'){
    html+=`<div class="question-text">${(q.question||'').replace(/\n/g,'<br>')}</div>`;
    html+=`<div class="type-input-wrap">
      <input class="type-input" id="type-input" type="text" placeholder="Englisch tippen..."
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        onkeydown="if(event.key==='Enter')submitType()">
    </div>
    <button class="submit-btn" onclick="submitType()">Prüfen ✓</button>`;
  } else if(q.type==='pronounce'){
    html+=`<div class="question-text">${(q.question||'').replace(/\n/g,'<br>')}</div>`;
    html+=`<div class="pronounce-tip" id="pronounce-tip">Drücke den Mikrofon-Button und sprich das Wort auf Englisch!</div>`;
    html+=`<canvas id="viz-canvas" width="300" height="60" style="display:block;margin:10px auto;border-radius:10px;background:#f5f0ff;"></canvas>`;
    html+=`<button class="mic-btn" id="mic-btn" onclick="startRecording()">🎙️ Sprechen</button>`;
    html+=`<div class="pronounce-result" id="pronounce-result" style="display:none"></div>`;
  }
  card.innerHTML=html;
  card.classList.remove('bounce-in');void card.offsetWidth;card.classList.add('bounce-in');
  if(q.type==='type') setTimeout(()=>document.getElementById('type-input')?.focus(),120);
}

function esc(s) { return(s+'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

export function nextQuestion() {
  try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
  window.questionIndex++;
  showQuestion();
}

export function restartSame() { startGame(window.mode); }
