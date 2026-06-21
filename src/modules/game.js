// src/modules/game.js
import { QPERROUND, EXAM_QUESTIONS, calcGrade, gradeText, UV_LVL } from './config.js';
import { effectivePct, isMastered, statKeyFor, getVocabStat } from './stats.js';
import { activeDeck, syncMirrorFromActiveDeck } from './decks.js';
import { showScreen, showMenu, hideFeedback, showFeedback } from './ui.js';
import { ensureMicStream, releaseMicStream, voskStop, stopVisualizer, speakWord, speakWordOnce, startVoskRecognition, startRecording, _shouldUseVosk, warmAudio, warmIosMic } from './speech.js';
import { persist } from './storage.js';
import { markDirty, saveExam } from './sync.js';
import { commitDirty } from './dialog.js';
import { IRREGULAR_PRESET_ID, formDistractors } from './irregular-verbs.js';

// Game state – all on window.* so Commit B functions (still in index.html) can read them as globals
window.isSchnellModus = false;            // gespiegelter Zustand des AKTIVEN Modus
window.schnellByMode = { free: false, student: false, campaign: false }; // pro Modus
window.schnellDone = new Set();
window._schnellBackup = {};               // pro Modus: { [mode]: {decks, preset} }
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
window.isUV = false;                       // Gestaltwandler-Modus (Verben), kein Deck

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
  return {type:'mc',badge:'vocab',statKey:statKeyFor(item.de, item.en, '_mc', item._presetId||null),_presetId:item._presetId||null,
    question:`🇩🇪 ${item.de}`,hint:'',
    choices:shuffle([item.en,...wrongVocab(item,3)]),answer:item.en};
}
function bVocabType(item) {
  return {type:'type',badge:'spelling',statKey:statKeyFor(item.de, item.en, '_sp', item._presetId||null),_presetId:item._presetId||null,
    question:`✏️ Schreibe auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}
function bVocabPronounce(item) {
  return {type:'pronounce',badge:'pronounce',statKey:statKeyFor(item.de, item.en, '_pr', item._presetId||null),_presetId:item._presetId||null,
    question:`🎙️ Sprich auf Englisch:\n🇩🇪 ${item.de}`,hint:'',answer:item.en};
}

// ── Verb-Transformationsfragen (Gestaltwandler, Spec §3–5) ──
// UV übt NUR die Formen: go → went / gone (keine Basis-Übersetzung — die deutsche
// Bedeutung steht als Kontext über jeder Frage). Suffixe: _past_* / _pp_*. Stats
// laufen über _presetId → globalPresetStats.
//
// METHODEN-LEITER (§4): pro Disziplin drei Methoden leicht→mittel→schwer. Die
// Stufe wird je Frage aus dem EMA abgeleitet (§5, Variante „aus EMA"): <3 Tries
// oder EMA<up2 = leicht, ≥up2 = mittel, ≥up3 = schwer. Kein gespeicherter lvl
// → kein Sync-Umbau. Interleaving: gelegentlich eine leichtere Variante (nie
// „alles schwer"). Alle Methoden nutzen die vorhandenen Render-Typen
// (mc/type/pronounce) — nur Aufgabe/Auswahl/Antwort wechseln.
function _firstForm(s){ return (s||'').split('/')[0].trim(); }
function _verbMeta(which){
  return which==='past'
    ? {label:'Simple Past',    get:i=>i.forms.past, suf:{mc:'_past_mc',sp:'_past_sp',pr:'_past_pr'}}
    : {label:'Past Participle', get:i=>i.forms.participle, suf:{mc:'_pp_mc',sp:'_pp_sp',pr:'_pp_pr'}};
}

// ── Frage-Kopf: macht intuitiv klar, WELCHE Form gefragt ist ──
// Bedeutung (🇩🇪) + farbige Plakette mit Form-Nummer (1./2./3. Form). q.question
// wird in renderQuestion als innerHTML gesetzt → HTML hier ist erlaubt.
const _FORM_BADGE={
  grund:['Present','#4D96FF'],
  past: ['Simple Past','#e8920a'],
  pp:   ['Past Participle','#3aaa5c'],
};
function _uvMeaning(de){ return `<div style="font-size:.82rem;color:#999;font-weight:700;margin-bottom:5px;">🇩🇪 ${de}</div>`; }
function _uvBadge(key,label,bg){ const b=_FORM_BADGE[key]||[label,bg]; return `<div style="display:inline-block;background:${b[1]};color:#fff;font-family:'Fredoka One',cursive;font-size:.72rem;padding:3px 12px;border-radius:20px;margin-bottom:10px;">${b[0]}</div>`; }
function _uvInstr(t){ return `<div style="font-size:.85rem;color:#888;font-weight:700;margin-bottom:6px;">${t}</div>`; }
function _uvTask(t){ return `<div style="font-size:1.45rem;font-weight:800;color:var(--text);letter-spacing:.5px;">${t}</div>`; }
function _uvHead(de,key){ return _uvMeaning(de)+_uvBadge(key); }

// Methodenstufe (1/2/3) aus dem vorhandenen EMA eines Suffix-Stats ableiten.
function uvLevel(statKey){
  const s=window.SD?.globalPresetStats?.wordStats?.[statKey];
  let lvl=1;
  if(s && Math.floor(s.asked||0)>=3){
    const ep=effectivePct(s);
    if(ep>=UV_LVL.up3) lvl=3; else if(ep>=UV_LVL.up2) lvl=2;
  }
  if(lvl>1 && Math.random()<UV_LVL.interleave) lvl=1+Math.floor(Math.random()*lvl); // 1..lvl
  return lvl;
}

// n Distraktoren aus den ECHTEN Formen anderer Verben (für höhere Erkennen-
// Stufen: keine offensichtlich erfundenen Formen wie „goed", sondern echte
// Verbformen — man muss das konkrete Verb wirklich kennen).
function _otherForms(item, which, n, exclude){
  const ex=(exclude||'').toLowerCase();
  const pool=window.VOCAB.filter(v=>v!==item && v.forms)
    .map(v=>_firstForm(which==='past'?v.forms.past:v.forms.participle))
    .filter(f=>f && f.toLowerCase()!==ex);
  return pick([...new Set(pool)], n);
}
// Eine Form mit ausgeblendetem erstem Vokal (Lücken-Buchstaben: went → „w _ n t").
function _scaffold(w){
  w=_firstForm(w);
  const i=w.search(/[aeiou]/i);
  const idx=i>=0?i:Math.floor(w.length/2);
  const arr=w.split(''); arr[idx]='_';
  return arr.join(' ');
}

// 🔍 Erkennen (MC, lesen) — immer Grundform → Form; je Stufe schwerere
// Distraktoren (leicht: erfundene Formen → schwer: echte Fremdformen).
function bErkennen(item, which, lvl){
  // Drag&Drop „alle drei Formen ordnen" erst, wenn beide Formen im Spiel sind:
  // nur im PP-Stern (Past ist dort schon gemeistert). Im Past-Stern wäre die
  // 3. Form (PP) noch ungesehen und per Ausschluss ratbar.
  if(which==='pp' && Math.random()<0.35) return bErkennenOrder(item, which);
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item)); const inf=_firstForm(item.en);
  const base={type:'mc',badge:'vocab',statKey:statKeyFor(item.de,item.en,mt.suf.mc,item._presetId||null),_presetId:item._presetId||null,
    question:_uvHead(item.de,which)+_uvTask(`${inf} → ?`),answer:target};
  if(lvl===3){ // schwer: nur echte Formen anderer Verben
    return {...base,choices:shuffle([target,..._otherForms(item,which,3,target)])};
  }
  if(lvl===2){ // mittel: eine erfundene + zwei echte Fremdformen
    const fake=(formDistractors(item,which)[0]);
    const reals=_otherForms(item,which,fake?2:3,target);
    return {...base,choices:shuffle([target,...(fake?[fake]:[]),...reals])};
  }
  // leicht: verlockend falsche (erfundene) Formen
  return {...base,choices:shuffle([target,...formDistractors(item,which)])};
}

// 🗣️ Rufen (Mikro, sprechen) — Present steht da, die Zielform muss man WISSEN
// und sprechen (kein bloßes Vorlesen mehr). Darum die schwerste Disziplin →
// schaltet im Sternbild erst nach Erkennen+Schmieden frei.
function bRufen(item, which, lvl){
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item)); const inf=_firstForm(item.en);
  const base={type:'pronounce',badge:'pronounce',statKey:statKeyFor(item.de,item.en,mt.suf.pr,item._presetId||null),_presetId:item._presetId||null,hint:''};
  if(lvl===3){ // schwer: ganze Reihe sprechen
    const chain=`${inf} ${_firstForm(item.forms.past)} ${_firstForm(item.forms.participle)}`;
    return {...base,question:_uvMeaning(item.de)+_uvBadge('all','Alle drei Formen','#a86cdb')+_uvInstr('🎙️ Sprich die ganze Reihe')+_uvTask(`${inf} – ? – ?`),answer:chain};
  }
  // leicht/mittel: Present zeigen, Zielform aus dem Kopf sprechen
  return {...base,question:_uvHead(item.de,which)+_uvInstr('🎙️ Sprich die Form')+_uvTask(`${inf} → ?`),answer:target};
}

// 🔨 Schmieden (Tippen, schreiben)
function bSchmieden(item, which, lvl){
  if(lvl<=2 && Math.random()<0.4) return bSchmiedenOrder(item, which);   // Drag&Drop: Buchstaben ordnen
  const mt=_verbMeta(which); const full=mt.get(item); const target=_firstForm(full); const inf=_firstForm(item.en);
  const base={type:'type',badge:'spelling',statKey:statKeyFor(item.de,item.en,mt.suf.sp,item._presetId||null),_presetId:item._presetId||null,hint:''};
  if(lvl===1){ // leicht: Lücken-Buchstaben ergänzen
    return {...base,question:_uvHead(item.de,which)+_uvInstr('✏️ Ergänze die fehlenden Buchstaben')+_uvTask(_scaffold(target)),answer:full};
  }
  if(lvl===2){ // mittel: falsche Form korrigieren
    const wrong=(formDistractors(item,which)[0])||target;
    return {...base,question:_uvHead(item.de,which)+_uvInstr('✏️ Diese Form ist falsch — verbessere sie')+_uvTask(`${wrong} → ?`),answer:full};
  }
  // schwer: frei tippen
  return {...base,question:_uvHead(item.de,which)+_uvInstr('✏️ Schreibe die richtige Form')+_uvTask(`${inf} → ?`),answer:full};
}

// Mischt ein Array so, dass die Reihenfolge möglichst nicht schon der Lösung
// entspricht (sonst wäre die Drag&Drop-Aufgabe sofort gelöst).
function _scramble(arr){
  if(arr.length<2) return arr.slice();
  const target=arr.join(''); let out=arr.slice();
  for(let k=0;k<8;k++){ out=shuffle(arr.slice()); if(out.join('')!==target) break; }
  return out;
}

// 🔍 Erkennen · Drag&Drop: alle drei Formen in die richtige Reihenfolge ziehen
// (Present · Simple Past · Past Participle). Zählt auf das aktive Erkennen-Suffix
// (mc) des Sterns — eine reichere MC-Variante.
function bErkennenOrder(item, which){
  const present=_firstForm(item.en), past=_firstForm(item.forms.past), pp=_firstForm(item.forms.participle);
  const sol=[present, past, pp];
  return {
    type:'order', orderKind:'forms', badge:'vocab', _presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,_verbMeta(which).suf.mc,item._presetId||null),
    question:_uvMeaning(item.de)+_uvBadge('all','Alle drei Formen','#a86cdb')+_uvInstr('🔀 Zieh die Formen in die richtige Reihenfolge'),
    slotLabels:['Present','Simple Past','Past Participle'],
    solution:sol, tiles:_scramble(sol),
    answer:`${present} · ${past} · ${pp}`,
  };
}

// 🔨 Schmieden · Drag&Drop: die Buchstaben der Zielform in die richtige
// Reihenfolge ziehen. Zählt auf das aktive Schmieden-Suffix (sp).
function bSchmiedenOrder(item, which){
  const mt=_verbMeta(which); const full=mt.get(item); const target=_firstForm(full);
  const letters=target.split('');
  return {
    type:'order', orderKind:'letters', badge:'spelling', _presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,mt.suf.sp,item._presetId||null),
    question:_uvHead(item.de,which)+_uvInstr('🔤 Zieh die Buchstaben in die richtige Reihenfolge'),
    slotLabels:letters.map(()=>''), solution:letters, tiles:_scramble(letters),
    answer:full,
  };
}

// Partizip schaltet erst frei, wenn die Vergangenheit derselben Disziplin sitzt
// (§6: „Vergangenheit zuerst"). Stabile Schwelle ohne Interleaving-Zufall:
// ≥3 Versuche und EMA ≥ up2.
function _ppUnlocked(v, pastSuffix){
  const s=window.SD?.globalPresetStats?.wordStats?.[statKeyFor(v.de,v.en,pastSuffix,IRREGULAR_PRESET_ID)];
  return !!s && Math.floor(s.asked||0)>=3 && effectivePct(s)>=UV_LVL.up2;
}

// Vollwandlung (§3/Phase 5): ein Verb ist „voll", wenn alle 6 Form-Suffixe
// (past+pp × lesen/sprechen/schreiben) gemeistert sind. Erst dann darf es in
// den gemischten Boss.
const UV_FORM_SUFFIXES=['_past_mc','_past_sp','_past_pr','_pp_mc','_pp_sp','_pp_pr'];
function _uvVoll(v){
  const ws=window.SD?.globalPresetStats?.wordStats||{};
  return UV_FORM_SUFFIXES.every(suf=>{ const s=ws[statKeyFor(v.de,v.en,suf,IRREGULAR_PRESET_ID)]; return s && Math.floor(s.asked||0)>=3 && effectivePct(s)>=UV_LVL.up3; });
}

// Gestaltwandler-Pool: pro AKTIVEM Verb (window.VOCAB = tier-gefiltert) Vergangen-
// heit + (nach Freischaltung) Partizip, Methode EMA-abgeleitet (§5). Keine Basis-
// Übersetzung mehr. mixed_vocab = Vollwandlung: nur „volle" Verben, Disziplinen
// gemischt (Boss/Prüfung).
function buildUVPool(m, limit){
  const all=[]; const pid=IRREGULAR_PRESET_ID;
  if(m==='mixed_vocab'){
    window.VOCAB.forEach(v=>{
      if(!v.forms || !_uvVoll(v)) return;
      ['past','pp'].forEach(w=>{
        all.push(bErkennen(v,w, uvLevel(statKeyFor(v.de,v.en,_verbMeta(w).suf.mc,pid))));
        all.push(bRufen(v,w,    uvLevel(statKeyFor(v.de,v.en,_verbMeta(w).suf.pr,pid))));
        all.push(bSchmieden(v,w,uvLevel(statKeyFor(v.de,v.en,_verbMeta(w).suf.sp,pid))));
      });
    });
    return shuffle(all).slice(0, limit);   // isExamMode → kein Mastery-Filter (Boss prüft Gemeistertes)
  }
  // Stern-Runde (Sternbild): window._uvStar = {mode, which} grenzt die Runde auf
  // GENAU eine Disziplin × Form ein (Past- vs. Past-Participle-Stern getrennt).
  // Die Past→PP-Reihenfolge regelt jetzt die Stern-Freischaltung (irregular-game),
  // nicht mehr _ppUnlocked.
  const star=window._uvStar;
  const B={vocab:bErkennen,spelling:bSchmieden,pronounce:bRufen}[m];
  const SUF={vocab:{past:'_past_mc',pp:'_pp_mc'},spelling:{past:'_past_sp',pp:'_pp_sp'},pronounce:{past:'_past_pr',pp:'_pp_pr'}}[m];
  window.VOCAB.forEach(v=>{
    if(!v.forms || !B) return;   // Sicherheitsnetz — UV-Set hat immer forms
    if(star){
      all.push(B(v, star.which, uvLevel(statKeyFor(v.de,v.en,SUF[star.which],pid))));
    } else {
      // Fallback ohne Stern (z. B. Lernstand-Gap-Runde): Past + (nach Freischaltung) PP.
      all.push(B(v,'past', uvLevel(statKeyFor(v.de,v.en,SUF.past,pid))));
      if(_ppUnlocked(v,SUF.past)) all.push(B(v,'pp', uvLevel(statKeyFor(v.de,v.en,SUF.pp,pid))));
    }
  });
  const getS=q=>window.SD?.globalPresetStats?.wordStats?.[q.statKey];
  const take=(window.isSchnellModus&&!window.isExamMode) ? all.length : limit;
  return weightedPickUnique(all, getS, take);
}

export function buildPool(m) {
  const vocab=window.VOCAB;
  let qs=[];
  const examLimit=window.isExamMode ? Math.min(EXAM_QUESTIONS, vocab.length*3) : QPERROUND;
  const limit=window.isSchnellModus&&!window.isExamMode ? vocab.length : examLimit;
  if(window.isUV){
    qs=buildUVPool(m, limit);
  } else {
  if(m==='vocab'){
    weightedPickUnique(vocab, v=>getVocabStat(v,'_mc'), limit).forEach(v=>qs.push(bVocabMC(v)));
  }
  if(m==='spelling'){
    weightedPickUnique(vocab, v=>getVocabStat(v,'_sp'), limit).forEach(v=>qs.push(bVocabType(v)));
  }
  if(m==='pronounce'){
    weightedPickUnique(vocab, v=>getVocabStat(v,'_pr'), limit).forEach(v=>qs.push(bVocabPronounce(v)));
  }
  if(m==='mixed_vocab'){
    if(window.isSchnellModus&&!window.isExamMode){
      vocab.forEach(v=>{qs.push(bVocabMC(v));qs.push(bVocabType(v));qs.push(bVocabPronounce(v));});
    } else {
      const n1=Math.round(examLimit/3), n2=Math.round(examLimit/3), n3=examLimit-n1-n2;
      weightedPickUnique(vocab, v=>getVocabStat(v,'_mc'), n1).forEach(v=>qs.push(bVocabMC(v)));
      weightedPickUnique(vocab, v=>getVocabStat(v,'_sp'), n2).forEach(v=>qs.push(bVocabType(v)));
      weightedPickUnique(vocab, v=>getVocabStat(v,'_pr'), n3).forEach(v=>qs.push(bVocabPronounce(v)));
    }
  }
  }
  if(window._skipMasteryFilter||window.isExamMode) return shuffle(qs).slice(0, limit);
  const filtered=qs.filter(q=>!isMastered(q));
  if(filtered.length===0) return qs.slice(0, limit);
  return shuffle(filtered).slice(0, limit);
}

// ── Schnell-Modus (pro Modus, bleibt erhalten) ──
// Jeder Modus (Freier Modus / Schülermodus) hat einen EIGENEN Schnell-Zustand
// (window.schnellByMode) mit eigenem Backup (window._schnellBackup[mode]).
// Aktivieren nullt nur die Decks DIESES Modus (Freier Modus zusätzlich die
// Vorlagen-Stats) → andere Modi behalten ihren echten Stand. Moduswechsel ändert
// den Zustand NICHT; ein versehentlicher Wechsel darf Schnell nicht beenden.
// window.isSchnellModus + Dark-Mode spiegeln den AKTIVEN Modus (syncSchnellForMode).
// Zwei Buttons (#schnell-toggle = Frei, #student-schnell-toggle = Schüler) zeigen
// je ihren eigenen Modus-Zustand.

function _decksOfMode(sd, mode){
  return Object.entries(sd.decks||{}).filter(([id,d]) => ((d.mode||'free')===mode));
}

// Backup-Objekt (alle Modi) dauerhaft sichern → Boot-Recovery (index.html) holt
// den echten Stand zurück, falls Schnell nie sauber beendet wird (Reload/Absturz).
function _persistSchnellBackup(){
  try{
    const any = Object.values(window._schnellBackup||{}).some(Boolean);
    if(any) localStorage.setItem('es_schnell_backup', JSON.stringify(window._schnellBackup));
    else localStorage.removeItem('es_schnell_backup');
  }catch(e){}
}

function _setSchnellBtn(id, on){
  const btn=document.getElementById(id);
  if(!btn) return;
  if(on){ btn.textContent='⚡ Schnell: AN';btn.style.background='var(--orange)';btn.style.color='white';btn.style.boxShadow='0 3px 0 #cc4a1a'; }
  else { btn.textContent='⚡ Schnell: AUS';btn.style.background='#eee';btn.style.color='#888';btn.style.boxShadow='0 3px 0 #ccc'; }
}

// Beim Anzeigen eines Modus: isSchnellModus + Dark-Mode spiegeln DIESEN Modus,
// beide Buttons zeigen je ihren eigenen Zustand. Aus renderModeContent (ui.js).
export function syncSchnellForMode(mode){
  const on = !!(window.schnellByMode && window.schnellByMode[mode]);
  window.isSchnellModus = on;
  document.body.classList.toggle('schnell-active', on);
  _setSchnellBtn('schnell-toggle', !!(window.schnellByMode && window.schnellByMode.free));
  _setSchnellBtn('student-schnell-toggle', !!(window.schnellByMode && window.schnellByMode.student));
}

export function toggleSchnell() {
  const sd=window.SD; if(!sd) return;
  const mode = sd.activeMode||'free';
  if(!window.schnellByMode) window.schnellByMode={};
  if(!window._schnellBackup || typeof window._schnellBackup!=='object') window._schnellBackup={};
  const btnId = mode==='student' ? 'student-schnell-toggle' : 'schnell-toggle';

  if(!window.schnellByMode[mode]){
    // → AN (nur dieser Modus): echten Stand der Modus-Decks sichern + auf 0.
    const backup={decks:{},preset:null};
    for(const [id,d] of _decksOfMode(sd, mode)){
      backup.decks[id]=JSON.parse(JSON.stringify(d.wordStats||{}));
      d.wordStats={};
    }
    if(mode==='free' && sd.globalPresetStats){
      backup.preset=JSON.parse(JSON.stringify(sd.globalPresetStats.wordStats||{}));
      sd.globalPresetStats.wordStats={};
    }
    window._schnellBackup[mode]=backup;
    window.schnellByMode[mode]=true;
    window.isSchnellModus=true;
    _persistSchnellBackup();
    syncMirrorFromActiveDeck();
    _setSchnellBtn(btnId, true);
    document.body.classList.add('schnell-active');
    window.esAlert({ icon:'⚡', title:'Wiederholungsmodus an',
      body:'Nur zum schnellen Üben — zählt NICHT in die Statistik. Eine richtige Antwort genügt für ein Wort, falsche zählen nicht. Beim Beenden wird dieser Fortschritt wieder verworfen.' })
      .then(()=>showMenu());
  } else {
    // → AUS (nur dieser Modus): abbrechbare Warnung; bei „Beenden" echten Stand zurück.
    window.esConfirm({ icon:'⚠️', title:'Wiederholungsmodus beenden?',
      body:'Der Schnell-Fortschritt geht verloren und dein echter Stand kommt zurück.',
      ok:'Beenden', cancel:'Abbrechen', danger:true })
      .then(ok=>{
        if(!ok) return;
        const b=window._schnellBackup[mode];
        if(b){
          for(const [id,ws] of Object.entries(b.decks||{})){ if(sd.decks&&sd.decks[id]) sd.decks[id].wordStats=ws; }
          if(b.preset&&sd.globalPresetStats) sd.globalPresetStats.wordStats=b.preset;
          window._schnellBackup[mode]=null;
        }
        window.schnellByMode[mode]=false;
        window.isSchnellModus=false;
        _persistSchnellBackup();
        syncMirrorFromActiveDeck();
        window.persist();
        _setSchnellBtn(btnId, false);
        document.body.classList.remove('schnell-active');
        showMenu();
      });
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
    // Modus gemeistert → optionale Runde ohne Wertung. Bestätigung asynchron,
    // der eigentliche Start läuft erst im Callback (_launchGame).
    window.esConfirm({ icon:'🏆', title:'Modus gemeistert!', body:'Noch eine Runde ohne Wertung?', ok:'Ja', cancel:'Nein' }).then(ok => {
      if(!ok) return;
      window._skipMasteryFilter=true;
      window.questionPool=shuffle(buildPool(m)).slice(0,10);
      window._skipMasteryFilter=false;
      window.isFreePlay=true;
      _launchGame(m);
    });
    return;
  }
  _launchGame(m);
}

function _launchGame(m) {
  const hasPronounce=(m==='pronounce'||m==='mixed_vocab');
  if(hasPronounce&&navigator.mediaDevices){
    try{ warmAudio(); }catch(e){}   // AudioContext in der User-Geste aufwecken → Visualizer/Erkennung ab Runde 1 warm
    try{ warmIosMic(); }catch(e){}  // iOS: Mic-Prompt/Session jetzt etablieren statt mitten in Runde 1
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

// „Zum Menü"-Aktion ausgelagert, damit der Android-Zurück AM offenen Dialog sie
// direkt auslösen kann (= zweiter Zurück bestätigt „Zum Menü", statt die App zu
// verlassen). Zuverlässig, weil zum-Menü-gehen eine echte Navigation ist und nicht
// von einem (auf Chrome skippable) Re-Push-Wächter abhängt.
export async function goHomeSaving() {
  saveProgress();
  hideFeedback();
  try{ releaseMicStream(); }catch(e){}
  try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
  if(window.currentUser) await commitProgress();   // Regel 2: warten bis bestätigt, DANN Menü
  showMenu();
}

export function confirmHome() {
  window._gameConfirmOpen = true;   // Marker: Android-Zurück am Dialog = „Zum Menü"
  window.esConfirm({ icon:'🏠', title:'Zurück zum Menü?', body:'Der Lernfortschritt dieser Runde wird gespeichert.', ok:'Zum Menü', cancel:'Bleiben' }).then(ok => {
    window._gameConfirmOpen = false;
    if(!ok) return;
    goHomeSaving();
  });
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
  } else if(q.type==='order'){
    html+=`<div class="question-text">${(q.question||'').replace(/\n/g,'<br>')}</div>`;
    const isL=q.orderKind==='letters';
    html+=`<div class="order-slots${isL?' letters':''}" id="order-slots">`;
    q.slotLabels.forEach((lab,i)=>{ html+=`<div class="order-slot" data-slot="${i}">${lab?`<span class="slot-label">${lab}</span>`:''}</div>`; });
    html+=`</div>`;
    html+=`<div class="order-tray${isL?' letters':''}" id="order-tray">`;
    q.tiles.forEach(t=>{ html+=`<div class="order-tile" data-val="${t}">${t}</div>`; });
    html+=`</div>`;
    html+=`<button class="submit-btn" id="order-check" onclick="checkOrder()" disabled>Prüfen ✓</button>`;
  }
  card.innerHTML=html;
  card.classList.remove('bounce-in');void card.offsetWidth;card.classList.add('bounce-in');
  if(q.type==='type') setTimeout(()=>document.getElementById('type-input')?.focus(),120);
  if(q.type==='order') initOrderDnD();
}

// Pointer-basiertes Drag&Drop (touch + Maus): Kacheln aus dem Tray in geordnete
// Slots ziehen. Bewusst KEIN HTML5-draggable (auf Tablets/Handys unzuverlässig).
// Eine Kachel pro Slot; eine belegte Kachel wird beim Ablegen ins Tray verdrängt.
function initOrderDnD(){
  const tray=document.getElementById('order-tray');
  const slotsWrap=document.getElementById('order-slots');
  if(!tray||!slotsWrap) return;
  const slots=[...slotsWrap.querySelectorAll('.order-slot')];
  const checkBtn=document.getElementById('order-check');
  let drag=null;

  function updateCheck(){ if(checkBtn) checkBtn.disabled=!slots.every(s=>s.querySelector('.order-tile')); }
  function placeTile(tile, target){
    if(target && target.classList.contains('order-slot')){
      const occ=target.querySelector('.order-tile');
      if(occ && occ!==tile) tray.appendChild(occ);   // belegten Slot räumen
      target.appendChild(tile);
    } else {
      tray.appendChild(tile);
    }
    updateCheck();
  }
  function targetUnder(x,y){
    const el=document.elementFromPoint(x,y); if(!el) return null;
    const slot=el.closest('.order-slot'); if(slot) return slot;
    if(el===tray || tray.contains(el)) return tray;
    return null;
  }
  function moveTo(x,y){ if(drag){ drag.tile.style.left=(x-drag.dx)+'px'; drag.tile.style.top=(y-drag.dy)+'px'; } }
  function onMove(e){
    if(!drag) return;
    moveTo(e.clientX,e.clientY);
    const t=targetUnder(e.clientX,e.clientY);
    slots.forEach(s=>s.classList.toggle('drop-hover', s===t));
    tray.classList.toggle('drop-hover', t===tray);
  }
  function onUp(e){
    if(!drag) return;
    const tile=drag.tile;
    const t=targetUnder(e.clientX,e.clientY) || drag.home || tray;
    tile.style.position=''; tile.style.left=''; tile.style.top='';
    tile.style.width=''; tile.style.height=''; tile.style.zIndex=''; tile.style.pointerEvents='';
    tile.classList.remove('dragging');
    slots.forEach(s=>s.classList.remove('drop-hover')); tray.classList.remove('drop-hover');
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    document.removeEventListener('pointercancel',onUp);
    placeTile(tile, t);
    drag=null;
  }
  function onDown(e){
    if(window.answered) return;
    const tile=e.currentTarget; e.preventDefault();
    const r=tile.getBoundingClientRect();
    drag={tile, dx:e.clientX-r.left, dy:e.clientY-r.top, home:tile.parentElement};
    tile.classList.add('dragging');
    tile.style.width=r.width+'px'; tile.style.height=r.height+'px';
    tile.style.position='fixed'; tile.style.left=r.left+'px'; tile.style.top=r.top+'px';
    tile.style.zIndex=9999; tile.style.pointerEvents='none';
    // An <body> hängen: die .game-card behält durch `bounce-in` (animation-fill
    // forwards) ein transform:scale(1) und wäre sonst Containing-Block für die
    // fixed-Kachel → Finger-Versatz. body hat kein transform → Viewport-Koordinaten.
    document.body.appendChild(tile);
    document.addEventListener('pointermove',onMove);
    document.addEventListener('pointerup',onUp);
    document.addEventListener('pointercancel',onUp);
  }
  [...document.querySelectorAll('.order-tile')].forEach(t=>t.addEventListener('pointerdown',onDown));
  updateCheck();
}

export function checkOrder(){
  if(window.answered) return;
  const slotsWrap=document.getElementById('order-slots'); if(!slotsWrap) return;
  const slots=[...slotsWrap.querySelectorAll('.order-slot')];
  if(!slots.every(s=>s.querySelector('.order-tile'))) return;   // noch nicht voll
  window.answered=true;
  const q=window.currentQ;
  const vals=slots.map(s=>(s.querySelector('.order-tile').getAttribute('data-val')||''));
  let ok;
  if(q.orderKind==='letters') ok = vals.join('').toLowerCase()===q.solution.join('').toLowerCase();
  else ok = vals.length===q.solution.length && vals.every((v,i)=> v.toLowerCase()===(q.solution[i]||'').toLowerCase());
  slots.forEach((s,i)=>{
    const tile=s.querySelector('.order-tile'); if(!tile) return;
    const good = q.orderKind==='letters' ? ok : (vals[i].toLowerCase()===(q.solution[i]||'').toLowerCase());
    tile.classList.add(good?'correct':'wrong');
  });
  const btn=document.getElementById('order-check'); if(btn) btn.disabled=true;
  ok?handleCorrect():handleWrong();
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
  // Wie startRecording: alle Mobile inkl. iOS → startVoskRecognition (regelt Warten/
  // Status selbst); nur Desktop bleibt im Web-Speech-Pfad.
  if(_shouldUseVosk() || window._webSpeechFailed){
    try{ warmAudio(); }catch(e){}  // AudioContext in der Klick-Geste resumen (iOS-Pflicht für Vosk)
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
  const store = q._presetId ? window.SD.globalPresetStats.wordStats : window.SD.wordStats;
  if(!store[q.statKey]) store[q.statKey]={asked:0,correct:0,wrong:0};
  const s=store[q.statKey];
  if(Math.floor(s.asked)<3){s.asked=3;s.correct=3;}
  else{s.asked+=1;s.correct+=1;}
  // window.persist() (Default = window.SD) statt bare persist() → speichert NICHT
  // versehentlich `undefined`. Der echte Stand liegt im dauerhaften Backup (Key
  // es_schnell_backup), siehe toggleSchnell + Boot-Recovery in index.html.
  try{window.persist();}catch(e){}
}

function recordStat(q, ok) {
  if(!q||!q.statKey) return;
  const inc=window.isRetryPhase?0.5:1;
  const store = q._presetId ? window.SD.globalPresetStats.wordStats : window.SD.wordStats;
  if(!store[q.statKey]) store[q.statKey]={asked:0,correct:0,wrong:0,recent:''};
  const s=store[q.statKey];
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
    // Schnellmodus: falsche Antworten zählen NICHT — sonst reicht später eine
    // richtige Antwort nicht mehr für 100%.
    if(!window.isFreePlay&&!window.isExamMode&&!window.isSchnellModus) recordStat(window.currentQ,false);
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
// SFX-Engine in der User-Geste (Start-Button) entsperren: resume() + stiller Blip.
// Ohne das blieb _sfxCtx nach App-Restart suspended (resume() außerhalb Geste greift
// auf iOS nicht) → Sounds kamen erst nach 1-2 Runden, wenn irgendein Tap ihn weckte.
export function primeSfx() {
  const ctx=_sfx(); if(!ctx) return;
  try{ if(ctx.state==='suspended') ctx.resume(); }catch(e){}
  try{
    const o=ctx.createOscillator(); const g=ctx.createGain();
    g.gain.value=0; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+0.02);
  }catch(e){}
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
  if(window.isUV && window._uvProgress){
    const titles={vocab:'🔍 Erkennen',spelling:'🔨 Schmieden',pronounce:'🗣️ Rufen'};
    return {...window._uvProgress(window.mode), title: titles[window.mode]||'🔁 Gestaltwandler'};
  }
  const presetWs = window.SD?.globalPresetStats?.wordStats || {};
  const deckWs = window.SD?.wordStats || {};
  function pf(suffix) {
    let score=0, mastered=0;
    window.VOCAB.forEach(v=>{
      const s=(v._presetId ? presetWs : deckWs)[statKeyFor(v.de,v.en,suffix,v._presetId||null)];
      if(!s||!s.asked) return;
      const asked=s.asked, pct=effectivePct(s);
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

function _updateGlobalPresetCategoryProgress(deck) {
  if (!deck?.presetCategories?.length || !window.SD.globalPresetStats) return;
  for (const presetId of deck.presetCategories) {
    if (!window.SD.globalPresetStats.categoryProgress[presetId]) {
      window.SD.globalPresetStats.categoryProgress[presetId] = { played: 0, correct: 0, bestStreak: 0 };
    }
    const gcp = window.SD.globalPresetStats.categoryProgress[presetId];
    gcp.played += window.questionIndex;
    gcp.correct += window.totalCorrect;
    if (window.bestStreak > gcp.bestStreak) gcp.bestStreak = window.bestStreak;
  }
}

// Lokalen Rundenfortschritt in window.SD verbuchen + als "muss synchronisiert"
// markieren. Der eigentliche bestätigte Cloud-Write läuft danach gebündelt über
// commitProgress() (sichtbar via withSaving). Kein fire-and-forget hier.
function saveProgress() {
  if(window._progressSaved||window.isFreePlay||window.isSchnellModus)return;
  window._progressSaved=true;
  if(window.isUV){
    // Gestaltwandler hat kein Deck: NICHT in activeDeck()/categoryProgress schreiben.
    // Verb-Stats stehen schon live in globalPresetStats (recordStat). Hier nur
    // Punkte/Highscore + Cloud-Markierung (global_preset, wie andere Vorlagen).
    window.SD.totalPoints+=window.points;
    if(window.points>window.SD.highscore) window.SD.highscore=window.points;
    persist();
    if(window.currentUser){ markDirty('global_preset'); markDirty('profile'); }
    return;
  }
  const deck = activeDeck();
  if(window.isExamMode){
    if(window.questionIndex > 0) _updateGlobalPresetCategoryProgress(deck);
    window.SD.totalPoints+=window.points;
    if(window.points>window.SD.highscore) window.SD.highscore=window.points;
    persist();
    if(window.currentUser && deck) {
      markDirty('word_stats', deck.id);
      if(deck.presetCategories?.length > 0) markDirty('global_preset');
      markDirty('profile');
    }
    return;
  }
  const cp=window.SD.categoryProgress[window.mode];
  if(cp&&window.questionIndex>0){
    _updateGlobalPresetCategoryProgress(deck);
    cp.played+=window.questionIndex;
    cp.correct+=window.totalCorrect;
    if(window.bestStreak>cp.bestStreak) cp.bestStreak=window.bestStreak;
    window.SD.totalPoints+=window.points;
    if(window.points>window.SD.highscore) window.SD.highscore=window.points;
    persist();
    if(window.currentUser && deck) {
      markDirty('word_stats', deck.id);
      if(deck.presetCategories?.length > 0) markDirty('global_preset');
      markDirty('profile');
    }
  }
}

// Bestätigter, SICHTBARER Commit der Runde (Regel 2): "Speichern…"-Balken,
// wartet auf Backend, aktualisiert die Sync-Signatur. Timeout/Fehler → Hinweis,
// Marker bleibt in der Queue (Retry), App blockiert nie.
function commitProgress() {
  return commitDirty();
}

function showEnd() {
  hideFeedback();saveProgress();
  if(window.isExamMode){
    const totalQ=window.questionPool.length;
    const pct=window.totalCorrect/Math.max(1,totalQ);
    const grade=calcGrade(pct);
    const percent=Math.round(pct*100);
    // Vollwandlung (UV) hat KEIN Deck: nicht in deck.lastExam/exams schreiben.
    // saveProgress() (oben) hat den UV-Stand bereits markiert (global_preset).
    // UV (Gestaltwandler) kennt keinen Prüfungs-/Boss-Modus mehr — Prüfungen sind
    // immer Deck-basiert. (UV-Bosse wandern in die Kampagne.)
    const deck=activeDeck();
    if(deck){
      deck.lastExam={grade,percent,date:Date.now()};
      persist(window.SD);
      if(window.currentUser) {
        saveExam({ deckId: deck.id, grade, percent }, window.currentUser.id).catch(()=>{});
        markDirty('deck', deck.id);
        commitProgress();   // sichtbarer Commit (läuft während die End-Karte angezeigt wird)
      }
    }
    const newHS=window.points>=window.SD.highscore&&window.points>0;
    showScreen('end-screen');
    document.getElementById('stat-points').textContent=window.points;
    document.getElementById('stat-correct').textContent=window.totalCorrect+'/'+totalQ;
    document.getElementById('stat-streak').textContent=window.bestStreak;
    document.getElementById('end-hs-msg').textContent=newHS?'🎉 Neuer Highscore!':'';
    document.getElementById('end-emoji').textContent=window.isUV?('🌟 Note '+grade):('📊 Note '+grade);
    document.getElementById('end-title').textContent=window.isUV?('Vollwandlung — '+gradeText(grade)):gradeText(grade);
    const dateStr=new Date(deck&&deck.lastExam?deck.lastExam.date:Date.now()).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    document.getElementById('end-stars').textContent=percent+'% richtig · '+dateStr;
    if(grade<=2) window.spawnConfetti();
    try{playSfx('end');}catch(e){}
    return;
  }
  const newHS=window.points>=window.SD.highscore&&window.points>0;
  persist();
  if(window.currentUser) commitProgress();   // sichtbarer Commit (während End-Karte)
  const mp=progressForCurrentMode();
  if(mp && mp.total>0 && mp.mastered>=mp.total){
    window.spawnConfetti();
    try{ playSfx('end'); }catch(e){}
    setTimeout(()=>{
      window.esAlert({ icon:'🏆', title:'100% erreicht!', body:'Du hast den Modus "'+(mp.title||window.mode)+'" gemeistert!', ok:'Weiter' }).then(()=>showMenu());
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
