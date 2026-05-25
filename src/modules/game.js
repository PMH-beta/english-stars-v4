// src/modules/game.js
import { QPERROUND, EXAM_QUESTIONS, calcGrade, gradeText } from './config.js';
import { effectivePct, isMastered, statKeyFor } from './stats.js';
import { activeDeck, syncMirrorFromActiveDeck } from './decks.js';
import { showScreen, showMenu, hideFeedback, showFeedback } from './ui.js';
import { ensureMicStream, releaseMicStream, voskStop, stopVisualizer, speakWord, speakWordOnce, startVoskRecognition, startRecording } from './speech.js';
import { persist } from './storage.js';
import { markDirty, flushPendingSync, saveExam } from './sync.js';

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
window.isExamMode = false;

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
  return {type:'mc',badge:'vocab',statKey:statKeyFor(item.de, item.en, '_mc'),
    question:`🇩🇪 ${item.de}`,hint:'',
    choices:shuffle([item.en,...wrongVocab(item,3)]),answer:item.en};
}
function bVocabType(item) {
  return {type:'type',badge:'spelling',statKey:statKeyFor(item.de, item.en, '_sp'),
    question:`✏️ Schreibe auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}
function bVocabPronounce(item) {
  return {type:'pronounce',badge:'pronounce',statKey:statKeyFor(item.de, item.en, '_pr'),
    question:`🎙️ Sprich auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}

export function buildPool(m) {
  const vocab=window.VOCAB;
  const sd=window.SD;
  let qs=[];
  const examLimit=window.isExamMode ? Math.min(EXAM_QUESTIONS, vocab.length*3) : QPERROUND;
  const limit=window.isSchnellModus&&!window.isExamMode ? vocab.length : examLimit;
  if(m==='vocab'){
    weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_mc')], limit).forEach(v=>qs.push(bVocabMC(v)));
  }
  if(m==='spelling'){
    weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_sp')], limit).forEach(v=>qs.push(bVocabType(v)));
  }
  if(m==='pronounce'){
    weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_pr')], limit).forEach(v=>qs.push(bVocabPronounce(v)));
  }
  if(m==='mixed_vocab'){
    if(window.isSchnellModus&&!window.isExamMode){
      vocab.forEach(v=>{qs.push(bVocabMC(v));qs.push(bVocabType(v));qs.push(bVocabPronounce(v));});
    } else {
      const n1=Math.round(examLimit/3), n2=Math.round(examLimit/3), n3=examLimit-n1-n2;
      weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_mc')], n1).forEach(v=>qs.push(bVocabMC(v)));
      weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_sp')], n2).forEach(v=>qs.push(bVocabType(v)));
      weightedPickUnique(vocab, v=>sd.wordStats[statKeyFor(v.de,v.en,'_pr')], n3).forEach(v=>qs.push(bVocabPronounce(v)));
    }
  }
  if(window._skipMasteryFilter||window.isExamMode) return shuffle(qs).slice(0, limit);
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
  window.isExamMode=(m==='mixed_vocab');
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
  updateScoreBar();
  window._lastModePct=0;
  updateModeProgress(false);
  showQuestion();
}

export function confirmHome() {
  if(confirm('Zurück zum Menü?\nDer Lernfortschritt dieser Runde wird gespeichert.')){
    saveProgress();
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
    if(!window.isFreePlay&&!window.isRetryPhase&&!window.isExamMode&&window.wrongQueue.length>0){
      window.isRetryPhase=true;
      window.questionPool=window.wrongQueue.slice();
      window.wrongQueue=[];
      window.questionIndex=0;
      const card=document.getElementById('game-card');
      card.innerHTML='<div style="padding:20px;font-size:1.1rem;font-weight:700;color:var(--orange)">'+
        '🔄 Jetzt nochmal die '+window.questionPool.length+' falschen Fragen!<br><span style="font-size:.85rem;color:#888;font-weight:600">Punkte zählen halb.</span></div>';
      setTimeout(()=>showQuestion(),2000);return;
    }
    showEnd();return;
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

// ── Answer Handlers ──
export function checkMC(btn, chosen) {
  if(window.answered)return;window.answered=true;
  document.querySelectorAll('.choice-btn').forEach(b=>b.disabled=true);
  const ok=chosen.toLowerCase()===window.currentQ.answer.toLowerCase();
  btn.classList.add(ok?'correct':'wrong');
  if(!ok) document.querySelectorAll('.choice-btn').forEach(b=>{
    if(b.textContent.trim().toLowerCase()===window.currentQ.answer.toLowerCase()) b.classList.add('correct');
  });
  ok?handleCorrect():handleWrong();
}

export function submitType() {
  if(window.answered)return;
  const inp=document.getElementById('type-input');if(!inp)return;
  const val=inp.value.trim();if(!val)return;
  window.answered=true;inp.disabled=true;
  const corrects=window.currentQ.answer.split('/').map(x=>x.trim().toLowerCase());
  const ok=corrects.includes(val.toLowerCase());
  inp.classList.add(ok?'correct':'wrong');
  if(!ok)inp.classList.add('shake');
  ok?handleCorrect():handleWrong();
}

export function showSelfRateButtons() {
  if(window.answered) return;
  const card=document.getElementById('game-card');
  if(!card) return;
  const old=document.getElementById('self-rate-wrap');
  if(old) old.remove();
  const ans=window.currentQ.answer;
  const wrap=document.createElement('div');
  wrap.id='self-rate-wrap';
  wrap.style.cssText='margin-top:14px;display:flex;flex-direction:column;gap:10px;align-items:center;';
  const listenBtn=document.createElement('button');
  listenBtn.textContent='🔊 Lösung anhören';
  listenBtn.style.cssText="font-family:'Fredoka One',cursive;font-size:.9rem;padding:10px 22px;background:#fff;color:var(--purple);border:2px solid var(--purple);border-radius:50px;cursor:pointer;";
  listenBtn.onclick=()=>{
    try{ voskStop(); }catch(e){}
    if(window._activeVoskTimeout){ clearTimeout(window._activeVoskTimeout); window._activeVoskTimeout=null; }
    try{ stopVisualizer(); }catch(e){}
    try{ speakWord(ans); }catch(e){ console.warn('speakWord:',e); }
    window._spokenForQuestion=true;
    const micBtn=document.getElementById('mic-btn');
    if(micBtn){
      micBtn.disabled=true;micBtn.onclick=null;micBtn.style.opacity='0.5';
      micBtn.style.cursor='not-allowed';micBtn.className='mic-btn';micBtn.textContent='🔇 Lösung gehört';
    }
  };
  const hint=document.createElement('div');
  hint.style.cssText='font-size:.78rem;color:#666;text-align:center;';
  hint.textContent='Hör dir die Aussprache an und entscheide:';
  const btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';
  const okBtn=document.createElement('button');
  okBtn.textContent='✓ Hatte ich richtig';
  okBtn.style.cssText="font-family:'Fredoka One',cursive;font-size:.9rem;padding:10px 18px;background:linear-gradient(135deg,#06d6a0,#3a9b45);color:#fff;border:none;border-radius:11px;cursor:pointer;box-shadow:0 4px 0 #2a7a35;";
  okBtn.onclick=()=>selfRate(true);
  btnRow.appendChild(okBtn);
  const noBtn=document.createElement('button');
  noBtn.textContent='✗ Daneben';
  noBtn.style.cssText="font-family:'Fredoka One',cursive;font-size:.9rem;padding:10px 18px;background:linear-gradient(135deg,#ff6b6b,#c0001a);color:#fff;border:none;border-radius:11px;cursor:pointer;box-shadow:0 4px 0 #800010;";
  noBtn.onclick=()=>selfRate(false);
  btnRow.appendChild(noBtn);
  wrap.appendChild(listenBtn);wrap.appendChild(hint);wrap.appendChild(btnRow);
  card.appendChild(wrap);
}

export function retryPronounce() {
  window._pronounceAttempts++;
  const wrap=document.getElementById('self-rate-wrap');
  if(wrap) wrap.remove();
  const result=document.getElementById('pronounce-result');
  const btn=document.getElementById('mic-btn');
  try{ releaseMicStream(); }catch(e){}
  try{ stopVisualizer(); }catch(e){}
  try{ voskStop(); }catch(e){}
  if(window._voskModel || window._voskStatus==='ready'){
    if(result){ result.style.display='block'; result.className='pronounce-result'; result.textContent='🎤 Sprich jetzt – Offline-Erkennung läuft…'; }
    if(btn){ btn.disabled=false; }
    startVoskRecognition(window.currentQ.answer, result, btn);
  } else {
    if(result){ result.style.display='none'; }
    if(btn){ btn.disabled=false; btn.onclick=startRecording; }
    startRecording();
  }
}

function selfRate(ok) {
  if(window.answered) return;
  window.answered=true;
  try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
  try{ stopVisualizer(); }catch(e){}
  const wrap=document.getElementById('self-rate-wrap');
  if(wrap) wrap.remove();
  setMicFinalStatus(ok);
  if(ok) handleCorrect();
  else handleWrong();
}

export async function evaluateWithClaude(recognizedText, targetWord) {
  const target=targetWord.toLowerCase().replace(/^to /,'').trim();
  const alts=recognizedText.split('|').map(a=>a.trim()).filter(a=>a);
  function lev(a,b){
    const m=a.length,n=b.length;
    if(!m) return n; if(!n) return m;
    const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>j===0?i:0));
    for(let j=1;j<=n;j++) dp[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  }
  function phon(w){
    if(!w) return '';
    let s=w.toLowerCase().replace(/[^a-zäöüß]/g,'');
    s=s.replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'s')
       .replace(/ph/g,'f').replace(/ck/g,'k').replace(/qu/g,'kw').replace(/x/g,'ks')
       .replace(/sch/g,'sh').replace(/tsch/g,'ch')
       .replace(/^kn/,'n').replace(/^wr/,'r').replace(/^ps/,'s').replace(/th/g,'t')
       .replace(/[aeiouy]+/g,'a')
       .replace(/[bp]/g,'b').replace(/[dt]/g,'d').replace(/[gk]/g,'g')
       .replace(/[fv]/g,'f').replace(/[sz]/g,'s').replace(/[mn]/g,'n')
       .replace(/(.)\1+/g,'$1');
    return s;
  }
  const ok=alts.some(a=>{
    const c=a.replace(/^to /,'').trim();
    if(c===target) return true;
    const tW=target.split(/\s+/), cW=c.split(/\s+/);
    if(tW.length>1){
      const content=tW.filter(w=>w.length>2);
      if(content.length>0 && content.every(w=>c.includes(w))) return true;
      const cP=phon(c.replace(/\s+/g,'')), tP=phon(target.replace(/\s+/g,''));
      if(cP===tP) return true;
      if(tP.length>=4 && lev(cP,tP)/tP.length<=0.18) return true;
      return false;
    }
    if(cW.includes(target)) return true;
    if(target.length>=4){ for(const w of cW) if(w.length>=target.length && w.includes(target)) return true; }
    for(const x of [c,...cW]){
      if(!x) continue;
      const d=lev(x,target);
      if(target.length>=8 && d<=2) return true;
      if(target.length>=5 && d<=1) return true;
      if(target.length>=3 && d===0) return true;
    }
    const tP=phon(target);
    if(!tP || tP.length<3) return false;
    for(const x of [...cW, c.replace(/\s+/g,'')]){
      const cP=phon(x);
      if(!cP || cP.length<2) continue;
      const ratio=Math.min(cP.length,tP.length)/Math.max(cP.length,tP.length);
      if(ratio<0.6) continue;
      if(cP===tP) return true;
      if(1-(lev(cP,tP)/Math.max(tP.length,cP.length))>=0.85) return true;
    }
    return false;
  });
  if(window.answered) return;
  window.answered=true;
  setMicFinalStatus(ok);
  if(ok) handlePronounceCorrect();
  else handleWrong();
}

export function setMicFinalStatus(ok) {
  const btn=document.getElementById('mic-btn');
  if(!btn) return;
  btn.disabled=true;btn.onclick=null;
  if(ok){ btn.className='mic-btn done-correct'; btn.textContent='✨ Klasse!'; }
  else  { btn.className='mic-btn done-wrong';   btn.textContent='💭 Knapp daneben!'; }
}

function handlePronounceCorrect() { handleCorrect(); }

// ── Stat Recording ──
function recordStatSchnell(q) {
  if(!q||!q.statKey) return;
  if(!window.SD.wordStats[q.statKey]) window.SD.wordStats[q.statKey]={asked:0,correct:0,wrong:0};
  const s=window.SD.wordStats[q.statKey];
  if(Math.floor(s.asked)<3){s.asked=3;s.correct=3;}
  else{s.asked+=1;s.correct+=1;}
  try{persist();}catch(e){}
}

function recordStat(q, ok) {
  if(!q||!q.statKey) return;
  const inc=window.isRetryPhase?0.5:1;
  if(!window.SD.wordStats[q.statKey]) window.SD.wordStats[q.statKey]={asked:0,correct:0,wrong:0,recent:''};
  const s=window.SD.wordStats[q.statKey];
  s.asked+=inc;
  if(ok) s.correct+=inc; else s.wrong+=inc;
  if(!s.recent) s.recent='';
  s.recent=(s.recent+(ok?'1':'0')).slice(-8);
  try{persist();}catch(e){}
}

// ── Correct / Wrong ──
function handleCorrect() {
  try{
    window.streak++;window.totalCorrect++;
    if(window.streak>window.bestStreak) window.bestStreak=window.streak;
    const baseBonus=window.streak>=5?30:window.streak>=3?20:10;
    const bonus=window.isFreePlay?0:(window.isRetryPhase?Math.floor(baseBonus/2):baseBonus);
    window.points+=bonus;
    if(!window.isFreePlay&&!window.isExamMode){
      if(window.isSchnellModus){ recordStatSchnell(window.currentQ); }
      else { recordStat(window.currentQ,true); }
    }
    if(window.isSchnellModus&&window.currentQ.statKey) window.schnellDone.add(window.currentQ.statKey);
    updateScoreBar();
    updateModeProgress(true);
    const correctTexts={
      first:['🎯 Richtig!','✨ Super!','👍 Top!','💫 Klasse!','🌟 Genau!'],
      streak3:['🔥 Dreierpack!','🔥 Auf der Welle!','🔥 Stark!'],
      streak5:['⚡ Fünfer-Combo!','🚀 Unaufhaltsam!','💥 Genial!'],
      streak7:['🏆 Sieben am Stück!','👑 Du bist unschlagbar!','💎 Perfekt!'],
      streak10:['🎆 ZEHN am Stück! WOW!','🦾 Unglaublich!','🌠 Legendär!']
    };
    function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
    let baseMsg;
    if(window.streak>=10) baseMsg=pick(correctTexts.streak10);
    else if(window.streak>=7) baseMsg=pick(correctTexts.streak7);
    else if(window.streak>=5) baseMsg=pick(correctTexts.streak5);
    else if(window.streak>=3) baseMsg=pick(correctTexts.streak3);
    else baseMsg=pick(correctTexts.first);
    const msg=window.isRetryPhase?baseMsg+' +'+bonus+' Pkt (Wiederholung)':baseMsg+' +'+bonus+' Pkt';
    showFeedback(true,msg,'');
    if(window.currentQ&&window.currentQ.type==='pronounce') setMicFinalStatus(true);
    try{ playSfx(window.streak>=3?'streak':'correct'); }catch(e){}
    if(window.currentQ&&window.currentQ.answer){
      const w=window.currentQ.answer;
      setTimeout(()=>{ try{ speakWordOnce(w); }catch(e){} }, 150);
    }
    if(window.streak===5||window.streak===10) window.spawnConfetti();
  }catch(e){
    console.error('handleCorrect:',e);
    try{ showFeedback(true,'✅ Richtig!',''); }catch(e2){}
  }
}

function handleWrong() {
  try{
    window.streak=0;
    if(!window.isRetryPhase&&!window.isFreePlay&&!window.isExamMode) window.wrongQueue.push({...window.currentQ});
    if(!window.isFreePlay&&!window.isExamMode) recordStat(window.currentQ,false);
    updateScoreBar();
    updateModeProgress(true);
    const c=document.getElementById('game-card');
    if(c){c.classList.add('shake');setTimeout(()=>c.classList.remove('shake'),280);}
    if(window.currentQ&&window.currentQ.type==='pronounce') setMicFinalStatus(false);
    let headline='❌ Nicht ganz!';
    let close=false;
    if(window.currentQ&&window.currentQ.type==='type'){
      const inp=document.getElementById('type-input');
      const val=inp?(inp.value||'').toLowerCase().trim():'';
      const target=(window.currentQ.answer.split('/')[0]||'').toLowerCase().trim();
      if(val&&target){
        const m=val.length,n=target.length;
        if(m&&n){
          const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>j===0?i:0));
          for(let j=1;j<=n;j++) dp[0][j]=j;
          for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
            dp[i][j]=val[i-1]===target[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
          if(dp[m][n]<=2 && Math.max(m,n)>=4) close=true;
        }
      }
    }
    const wrongTexts={
      close:['😬 Knapp daneben!','💭 Fast hattest du es!','🎯 So nah dran!'],
      normal:['❌ Nicht ganz!','🤔 Daneben!','📝 Üben hilft!','💪 Gleich nochmal!']
    };
    function pickW(arr){return arr[Math.floor(Math.random()*arr.length)];}
    headline=pickW(close?wrongTexts.close:wrongTexts.normal);
    const isPronounce=window.currentQ&&window.currentQ.type==='pronounce';
    const subText=isPronounce?'🔊 Hör dir die richtige Aussprache an':('Richtige Antwort: '+(window.currentQ&&window.currentQ.answer||'?'));
    showFeedback(false,headline,subText);
    try{ playSfx('wrong'); }catch(e){}
    if(window.currentQ&&window.currentQ.answer){
      const w=window.currentQ.answer;
      setTimeout(()=>{ try{ speakWordOnce(w); }catch(e){} }, 200);
    }
  }catch(e){
    console.error('handleWrong:',e);
    try{ showFeedback(false,'❌ Nicht ganz!',''); }catch(e2){}
  }
}

function updateScoreBar() {
  document.getElementById('streak-display').textContent='🔥 '+window.streak;
  document.getElementById('points-display').textContent='⭐ '+window.points;
}

// ── SFX ──
let _sfxCtx=null;
export function _sfx() {
  if(!_sfxCtx){
    try{ _sfxCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){return null;}
  }
  return _sfxCtx;
}
export function playSfx(type) {
  const ctx=_sfx(); if(!ctx) return;
  if(ctx.state==='suspended') ctx.resume();
  const t=ctx.currentTime;
  const out=ctx.createGain();
  out.gain.value=1.0;
  out.connect(ctx.destination);
  if(type==='click'){
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(800,t); o.frequency.exponentialRampToValueAtTime(1400,t+0.05);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.4,t+.005); g.gain.exponentialRampToValueAtTime(.001,t+.08);
    o.connect(g); g.connect(out); o.start(t); o.stop(t+.1);
  } else if(type==='correct'){
    [880,1320].forEach((f,i)=>{
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.type='triangle'; o.frequency.value=f;
      const s=t+i*0.09;
      g.gain.setValueAtTime(0,s); g.gain.linearRampToValueAtTime(.35,s+.01); g.gain.exponentialRampToValueAtTime(.001,s+.12);
      o.connect(g); g.connect(out); o.start(s); o.stop(s+.15);
    });
  } else if(type==='wrong'){
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(110,t+.18);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.25,t+.02); g.gain.exponentialRampToValueAtTime(.001,t+.22);
    o.connect(g); g.connect(out); o.start(t); o.stop(t+.25);
  } else if(type==='streak'){
    [1200,1500,1800].forEach((f,i)=>{
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.type='sine'; o.frequency.value=f;
      const s=t+i*0.05;
      g.gain.setValueAtTime(0,s); g.gain.linearRampToValueAtTime(.3,s+.005); g.gain.exponentialRampToValueAtTime(.001,s+.1);
      o.connect(g); g.connect(out); o.start(s); o.stop(s+.12);
    });
  } else if(type==='end'){
    [523,659,784,1047].forEach((f,i)=>{
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.type='triangle'; o.frequency.value=f;
      const s=t+i*0.08;
      g.gain.setValueAtTime(0,s); g.gain.linearRampToValueAtTime(.3,s+.01); g.gain.exponentialRampToValueAtTime(.001,s+.3);
      o.connect(g); g.connect(out); o.start(s); o.stop(s+.32);
    });
  }
}

// ── Progress + End ──
function progressForCurrentMode() {
  function pf(suffix){
    let score=0, mastered=0;
    window.VOCAB.forEach(v=>{
      const s=window.SD.wordStats[statKeyFor(v.de,v.en,suffix)];
      if(!s||!s.asked) return;
      const asked=s.asked;
      const pct=effectivePct(s);
      if(Math.floor(asked)>=3 && pct>=0.9){ score+=1; mastered+=1; }
      else if(asked>=1){
        const conf=Math.min(asked/3,1);
        score+=Math.max(0,(pct-0.5)*2)*conf*0.85;
      }
    });
    return {score,mastered,total:window.VOCAB.length};
  }
  if(window.mode==='vocab')    return {...pf('_mc'),title:'🔤 Vokabeln'};
  if(window.mode==='spelling') return {...pf('_sp'),title:'📝 Rechtschreibung'};
  if(window.mode==='pronounce')return {...pf('_pr'),title:'🎙️ Aussprache'};
  if(window.mode==='mixed_vocab'){
    const a=pf('_mc'),b=pf('_sp'),c=pf('_pr');
    return {score:Math.min(a.score,b.score,c.score),
            mastered:Math.min(a.mastered,b.mastered,c.mastered),
            total:window.VOCAB.length,title:'🎯 Alle gemischt'};
  }
  return {score:0,mastered:0,total:window.VOCAB.length,title:'Modus'};
}

function updateModeProgress(animate) {
  const wrap=document.getElementById('mode-progress');
  if(!wrap) return;
  const titleEl=document.getElementById('mode-progress-title');
  const pctEl=document.getElementById('mode-progress-pct');
  const barEl=document.getElementById('mode-progress-bar');
  const subEl=document.getElementById('mode-progress-sub');

  if(window.isExamMode){
    // answered = how many questions have been responded to so far
    // window.answered is true only while within a handler (after user answered current question)
    const answered=window.answered ? window.questionIndex+1 : window.questionIndex;
    const totalQ=window.questionPool.length;
    const barPct=totalQ>0 ? Math.round(answered/totalQ*100) : 0;
    if(titleEl) titleEl.textContent='📊 Prüfung';
    if(pctEl) pctEl.textContent=barPct+'%';
    if(subEl){
      if(answered===0){
        subEl.textContent='0/0 · –';
      } else {
        const liveGrade=calcGrade(window.totalCorrect/answered);
        subEl.textContent=window.totalCorrect+'/'+answered+' richtig · Note '+liveGrade;
      }
    }
    if(barEl) barEl.style.width=barPct+'%';
    window._lastModePct=barPct;
    return;
  }

  const p=progressForCurrentMode();
  const pct=Math.min(100,Math.round((p.score/p.total)*100));
  if(titleEl) titleEl.textContent=p.title;
  if(pctEl) pctEl.textContent=pct+'%';
  if(subEl) subEl.textContent=p.mastered+'/'+p.total+' gemeistert';
  if(barEl){
    barEl.style.width=pct+'%';
    if(animate && pct>window._lastModePct){
      const diff=pct-window._lastModePct;
      if(diff>=1){
        const pop=document.createElement('span');
        pop.className='mode-progress-pop';
        pop.textContent='+'+diff+'%';
        pop.style.right='14px'; pop.style.top='30px';
        wrap.appendChild(pop);
        setTimeout(()=>pop.remove(),1300);
      }
    }
  }
  window._lastModePct=pct;
}

function saveProgress() {
  if(window._progressSaved||window.isFreePlay||window.isSchnellModus)return;
  window._progressSaved=true;
  const deck = activeDeck();
  if(window.isExamMode){
    window.SD.totalPoints+=window.points;
    if(window.points>window.SD.highscore) window.SD.highscore=window.points;
    persist();
    if(window.currentUser && deck) {
      markDirty('word_stats', deck.id);
      markDirty('profile');
    }
    return;
  }
  const cp=window.SD.categoryProgress[window.mode];
  if(cp&&window.questionIndex>0){
    cp.played+=window.questionIndex;
    cp.correct+=window.totalCorrect;
    if(window.bestStreak>cp.bestStreak) cp.bestStreak=window.bestStreak;
    window.SD.totalPoints+=window.points;
    if(window.points>window.SD.highscore) window.SD.highscore=window.points;
    persist();
    if(window.currentUser && deck) {
      markDirty('word_stats', deck.id);
      markDirty('profile');
    }
  }
}

function showEnd() {
  hideFeedback();saveProgress();
  if(window.isExamMode){
    const totalQ=window.questionPool.length;
    const pct=window.totalCorrect/Math.max(1,totalQ);
    const grade=calcGrade(pct);
    const percent=Math.round(pct*100);
    const deck=activeDeck();
    if(deck){
      deck.lastExam={grade,percent,date:Date.now()};
      persist(window.SD);
      if(window.currentUser) {
        saveExam({ deckId: deck.id, grade, percent }, window.currentUser.id).catch(()=>{});
        markDirty('deck', deck.id);
        flushPendingSync().catch(()=>{});
      }
    }
    const newHS=window.points>=window.SD.highscore&&window.points>0;
    showScreen('end-screen');
    document.getElementById('stat-points').textContent=window.points;
    document.getElementById('stat-correct').textContent=window.totalCorrect+'/'+totalQ;
    document.getElementById('stat-streak').textContent=window.bestStreak;
    document.getElementById('end-hs-msg').textContent=newHS?'🎉 Neuer Highscore!':'';
    document.getElementById('end-emoji').textContent='📊 Note '+grade;
    document.getElementById('end-title').textContent=gradeText(grade);
    const dateStr=new Date(deck&&deck.lastExam?deck.lastExam.date:Date.now()).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    document.getElementById('end-stars').textContent=percent+'% richtig · '+dateStr;
    if(grade<=2) window.spawnConfetti();
    try{playSfx('end');}catch(e){}
    return;
  }
  const newHS=window.points>=window.SD.highscore&&window.points>0;
  persist();
  if(window.currentUser) flushPendingSync().catch(()=>{});
  const mp=progressForCurrentMode();
  if(mp && mp.total>0 && mp.mastered>=mp.total){
    window.spawnConfetti();
    try{ playSfx('end'); }catch(e){}
    setTimeout(()=>{
      alert('🏆 100% erreicht! Du hast den Modus "'+(mp.title||window.mode)+'" gemeistert!');
      showMenu();
    }, 400);
    return;
  }
  showScreen('end-screen');
  document.getElementById('stat-points').textContent=window.points;
  document.getElementById('stat-correct').textContent=window.totalCorrect;
  document.getElementById('stat-streak').textContent=window.bestStreak;
  document.getElementById('end-hs-msg').textContent=newHS?'🎉 Neuer Highscore!':'';
  const pct=window.totalCorrect/Math.max(1,window.questionIndex);
  let emoji,title,stars;
  if(pct>=.9){emoji='🏆';title='Absolut fantastisch!';stars='⭐⭐⭐';}
  else if(pct>=.7){emoji='😊';title='Sehr gut gemacht!';stars='⭐⭐';}
  else if(pct>=.5){emoji='💪';title='Gut versucht!';stars='⭐';}
  else{emoji='📚';title='Weiter üben!';stars='';}
  document.getElementById('end-emoji').textContent=emoji;
  document.getElementById('end-title').textContent=title;
  document.getElementById('end-stars').textContent=stars;
  if(pct>=.8) window.spawnConfetti();
}
