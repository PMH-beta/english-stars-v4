// src/modules/game.js
import { QPERROUND, EXAM_QUESTIONS, calcGrade, gradeText, UV_LVL } from './config.js';
import { effectivePct, isMastered, statKeyFor, getVocabStat, SP_TEILE, spWort, spKurz, spellingStand, wortScore } from './stats.js';
import { activeDeck, syncMirrorFromActiveDeck } from './decks.js';
import { showScreen, showMenu, hideFeedback, showFeedback } from './ui.js';
import { ensureMicStream, releaseMicStream, voskStop, stopVisualizer, speakWord, speakWordOnce, startVoskRecognition, startRecording, _shouldUseVosk, warmAudio, warmIosMic, micZustand, gehoert } from './speech.js';
import { persist } from './storage.js';
import { markDirty, saveExam, saveProbetest } from './sync.js';
import { commitDirty } from './dialog.js';
import { IRREGULAR_PRESET_ID, formDistractors, UV_TRAIN_SUF } from './irregular-verbs.js';
import { iconHTML } from './pixel-icons.js';
import { setGrundton } from './screen-shell.js';

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
window.isProbetest = false;                // ephemerer Misch-Test (bis 2 Decks), kein Deck/kein Speichern
window.isUV = false;                       // Gestaltwandler-Modus (Verben), kein Deck

// ── Pool Utilities ──
function shuffle(a) {
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
  return b;
}

function pick(a, n) { return shuffle(a).slice(0,n); }

export function weightedPickUnique(items, getStatFn, n) {
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
// de/instr tragen die Aufgabe fürs Pastell-Layout (4.3, 4.6, 4.7): Kürzel „DE"
// vor dem Wort, darüber bei Rechtschreibung die Anweisung.
function bVocabMC(item) {
  return {type:'mc',badge:'vocab',statKey:statKeyFor(item.de, item.en, '_mc', item._presetId||null),_presetId:item._presetId||null,
    question:`🇩🇪 ${item.de}`,de:item.de,hint:'',
    choices:shuffle([item.en,...wrongVocab(item,3)]),answer:item.en};
}
function bVocabType(item) {
  return {type:'type',badge:'spelling',statKey:statKeyFor(item.de, item.en, '_sp', item._presetId||null),_presetId:item._presetId||null,
    question:`✏️ Schreibe auf Englisch:\n🇩🇪 ${item.de}`,de:item.de,instr:'Schreibe auf Englisch',hint:'',
    vorsatz:_spTo(spWort(item.en)).vor,answer:item.en};
}
// „to" vor Verben steht fest vor dem Wort (Wunsch des Nutzers, 08.10.2026): es
// wird nicht getippt (mitgetippt zählt es trotzdem), nicht sortiert und ist nie
// die Lücke. vor = „to" wie geschrieben, rest = was das Kind schreibt.
function _spTo(w){
  const m=/^(to)\s+(?=\S)/i.exec(w);
  return m ? {vor:m[1], rest:w.slice(m[0].length)} : {vor:'', rest:w};
}
// Vergleich beim Tippen: steht „to" schon davor, zählt die Antwort mit und ohne.
const spOhneTo=q=>s=>q&&q.vorsatz ? s.replace(/^to\s+/i,'') : s;
// Rechtschreibung (F-71–F-75): drei Aufgaben je Wort — Buchstabe einsetzen,
// Buchstaben sortieren, Wort schreiben. Gezogen wird zufällig, gleich oft, unter
// den Aufgaben, die beim Wort noch offen sind; ist das Wort abgeschlossen, unter
// allen (kurze Wörter: nur Schreiben). Leerzeichen bleiben fest an ihrem Platz.
function bVocabGap(item) {
  const w=spWort(item.en), {vor,rest}=_spTo(w);
  // Jedes Mal ein zufälliger Buchstabe (F-77), nicht immer der erste Vokal —
  // nie ein Leerzeichen, Bindestrich oder Apostroph.
  const stellen=rest.split('').map((ch,i)=>/\p{L}/u.test(ch)?i:-1).filter(i=>i>=0);
  const idx=stellen.length ? stellen[Math.floor(Math.random()*stellen.length)] : 0;
  return {type:'type',badge:'spelling',gap:true,gapWord:rest,gapIdx:idx,vorsatz:vor,hint:'',speak:w,
    statKey:statKeyFor(item.de, item.en, '_sp_lu', item._presetId||null),_presetId:item._presetId||null,
    de:item.de,instr:'Welcher Buchstabe fehlt?',answer:rest[idx]||''};
}
function bVocabOrder(item) {
  const w=spWort(item.en), {vor,rest}=_spTo(w);
  const letters=rest.replace(/\s+/g,'').split('');
  // Nach welchem Feld eine Lücke zwischen zwei Wörtern steht.
  const luecken=[]; let n=0;
  for(const ch of rest){ if(/\s/.test(ch)){ if(n && luecken[luecken.length-1]!==n-1) luecken.push(n-1); } else n++; }
  return {type:'order',orderKind:'letters',badge:'spelling',vorsatz:vor,
    statKey:statKeyFor(item.de, item.en, '_sp_so', item._presetId||null),_presetId:item._presetId||null,
    de:item.de,instr:'Leg die Buchstaben in die richtige Reihenfolge',
    slotLabels:letters.map(()=>''),solution:letters,tiles:_scramble(letters),luecken,answer:w};
}
function bVocabSpelling(item) {
  const ws=item._presetId ? window.SD?.globalPresetStats?.wordStats : window.SD?.wordStats;
  const stand=spellingStand(ws, item, item._presetId||null);
  const teile=spKurz(item.en) ? ['_sp'] : (stand.fertig ? SP_TEILE : stand.offen);
  const t=teile[Math.floor(Math.random()*teile.length)];
  const q=t==='_sp_lu' ? bVocabGap(item) : t==='_sp_so' ? bVocabOrder(item) : bVocabType(item);
  q._spFertig=stand.fertig;   // abgeschlossene Wörter fallen wie gemeisterte aus der Runde
  return q;
}
// Gewicht für die Wortauswahl: abgeschlossen = selten, sonst wie ein neues Wort.
const _spGewicht=v=>{
  const ws=v._presetId ? window.SD?.globalPresetStats?.wordStats : window.SD?.wordStats;
  return spellingStand(ws, v, v._presetId||null).fertig ? {asked:3,correct:3} : undefined;
};

function bVocabPronounce(item) {
  return {type:'pronounce',badge:'pronounce',statKey:statKeyFor(item.de, item.en, '_pr', item._presetId||null),_presetId:item._presetId||null,
    question:`🎙️ Sprich auf Englisch:\n🇩🇪 ${item.de}`,de:item.de,hint:'',answer:item.en};
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
// Plakette je Form wie 5.6–5.11: Simple Past hellblau, Past Participle gold,
// alle drei Formen flieder — mit Hammer bzw. dem Reihenfolge-Symbol.
const _FORM_BADGE={
  grund:['Present','var(--p-blau)','hammer'],
  past: ['Simple Past','var(--p-blau)','hammer'],
  pp:   ['Past Participle','var(--p-gold)','hammer'],
  all:  ['Alle drei Formen','var(--p-lila)','order'],
};
function _uvBadge(key){ const b=_FORM_BADGE[key]||_FORM_BADGE.past;
  return `<div class="badge uv-badge" style="background:${b[1]}">${iconHTML(b[2],14)}${b[0]}</div>`; }
// Anweisung unter der Plakette (800 13px, 5.6–5.11).
function _uvInstr(t){ return `<div class="q-instr uv-instr">${t}</div>`; }
// Deutsches Wort als Vorgabe: „haben → Simple Past" (5.9/5.10), bei allen drei
// Formen nur das Wort (5.6).
function _uvWord(de,key){
  const f=_FORM_BADGE[key];
  return key==='all'
    ? `<div class="uv-wort uv-wort--klein">${window.escHtml(de)}</div>`
    : `<div class="uv-wort">${window.escHtml(de)}${f?' → '+f[0]:''}</div>`;
}
// Aufgaben-Zusatz (Buchstabenlücke, falsche Form …) unter dem Wort.
function _uvTask(t){ return `<div class="uv-aufgabe">${t}</div>`; }
// UV-Fragekopf in fester Reihenfolge: Form-Plakette → (Anweisung) → deutsches Wort
// → (englische Aufgabe). Anweisung/Aufgabe optional.
function _uvHead(de,key,instr,task){
  return _uvBadge(key)+(instr?_uvInstr(instr):'')+_uvWord(de,key)+(task?_uvTask(task):'');
}
// Falsche Form in der rosa Fläche (5.7).
function _uvFalsch(w){ return `<div class="uv-falsch">${window.escHtml(w)}</div>`; }

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
// Zielform mit EINER ausgeblendeten Stelle (erster Vokal). Liefert die Anzeige
// „w _ n t" UND den fehlenden Buchstaben separat — so muss nur dieser eine
// Buchstabe getippt werden, nicht das ganze Wort.
function _gapLetter(w){
  w=_firstForm(w);
  const i=w.search(/[aeiou]/i);
  const idx=i>=0?i:Math.floor(w.length/2);
  const arr=w.split(''); const letter=arr[idx]; arr[idx]='_';
  return {display:arr.join(' '), word:w, idx, letter};
}

// 🔍 Erkennen (MC, lesen) — immer Grundform → Form; je Stufe schwerere
// Distraktoren (leicht: erfundene Formen → schwer: echte Fremdformen).
function bErkennen(item, which, lvl, suf){
  // Reines MC-Erkennen. „Formen ordnen" (D&D) ist jetzt ein EIGENER Schmiede-
  // Schritt (bUV) mit eigenem Suffix — darum hier keine zufällige Beimischung mehr.
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item)); const inf=_firstForm(item.en);
  const base={type:'mc',badge:'vocab',statKey:statKeyFor(item.de,item.en,suf||mt.suf.mc,item._presetId||null),_presetId:item._presetId||null,
    question:_uvHead(item.de,which,'',''),answer:target};
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
function bRufen(item, which, lvl, suf){
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item)); const inf=_firstForm(item.en);
  const base={type:'pronounce',badge:'pronounce',statKey:statKeyFor(item.de,item.en,suf||mt.suf.pr,item._presetId||null),_presetId:item._presetId||null,hint:''};
  if(lvl===3){ // schwer: ganze Reihe sprechen
    const chain=`${inf} ${_firstForm(item.forms.past)} ${_firstForm(item.forms.participle)}`;
    return {...base,question:_uvBadge('all')+_uvInstr('Sprich alle drei Formen')+_uvWord(item.de,'all'),answer:chain};
  }
  // leicht/mittel: nur das deutsche Wort, Zielform aus dem Kopf sprechen
  return {...base,question:_uvHead(item.de,which,'Sprich die Form',''),answer:target};
}

// 🔨 Schmieden (Tippen, schreiben)
function bSchmieden(item, which, lvl, suf){
  // Reines Tippen. „Buchstaben ordnen" (D&D) ist jetzt ein EIGENER Schritt (bUV).
  const mt=_verbMeta(which); const full=mt.get(item); const target=_firstForm(full); const inf=_firstForm(item.en);
  const base={type:'type',badge:'spelling',statKey:statKeyFor(item.de,item.en,suf||mt.suf.sp,item._presetId||null),_presetId:item._presetId||null,hint:''};
  if(lvl===1){ // leicht: nur den EINEN fehlenden Buchstaben ergänzen
    const g=_gapLetter(target);
    // speak = das GANZE Wort (TTS soll nicht nur den einen Buchstaben vorlesen).
    return {...base,gap:true,speak:target,question:_uvHead(item.de,which,'Welcher Buchstabe fehlt?',g.display),answer:g.letter};
  }
  if(lvl===2){ // mittel: falsche Form korrigieren
    const wrong=(formDistractors(item,which)[0])||target;
    return {...base,ph:mt.label+' tippen…',question:_uvHead(item.de,which,'Diese Form ist falsch — verbessere sie','')+_uvFalsch(wrong),answer:full};
  }
  // schwer: frei tippen — nur das deutsche Wort als Vorgabe
  return {...base,ph:mt.label+' tippen…',question:_uvHead(item.de,which,mt.label+' bilden',''),answer:full};
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
function bErkennenOrder(item, which, suf){
  const present=_firstForm(item.en), past=_firstForm(item.forms.past), pp=_firstForm(item.forms.participle);
  const sol=[present, past, pp];
  return {
    type:'order', orderKind:'forms', badge:'vocab', _presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,suf||_verbMeta(which).suf.mc,item._presetId||null),
    question:_uvBadge('all')+_uvInstr('Zieh die Formen in die richtige Reihenfolge')+_uvWord(item.de,'all'),
    slotLabels:['Present','Simple Past','Past Participle'],
    solution:sol, tiles:_scramble(sol),
    answer:`${present} · ${past} · ${pp}`,
  };
}

// 🔨 Schmieden · Drag&Drop: die Buchstaben der Zielform in die richtige
// Reihenfolge ziehen. Zählt auf das aktive Schmieden-Suffix (sp).
function bSchmiedenOrder(item, which, suf){
  const mt=_verbMeta(which); const full=mt.get(item); const target=_firstForm(full);
  const letters=target.split('');
  return {
    type:'order', orderKind:'letters', badge:'spelling', _presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,suf||mt.suf.sp,item._presetId||null),
    question:_uvHead(item.de,which,'Leg die Buchstaben in die richtige Reihenfolge'),
    slotLabels:letters.map(()=>''), solution:letters, tiles:_scramble(letters),
    answer:full,
  };
}

// 🔍 Erkennen · Falsche Form korrigieren (MC): eine falsche Form steht da, die
// richtige auswählen. Auswahl-Aufgabe (kein Tippen), zählt aufs Erkennen-Slot.
function bErkennenFix(item, which, suf){
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item));
  const wrong=(formDistractors(item,which)[0])||_firstForm(item.en);
  // Distraktoren OHNE die oben gezeigte falsche Form — die darf NICHT zur Auswahl stehen.
  const pool=[...formDistractors(item,which), ..._otherForms(item,which,4,target)]
    .filter(d=>d && d.toLowerCase()!==wrong.toLowerCase() && d.toLowerCase()!==target.toLowerCase());
  const distract=[...new Set(pool)].slice(0,3);
  // KEIN deutsches Wort — die falsche englische Form steht groß oben in der rosa
  // Fläche aus 5.7 (kein Durchstreichen, Entscheidung vom Juni — Frage F-52).
  const head=_uvBadge(which)
    +_uvInstr('Diese Form ist falsch — welche stimmt?')
    +_uvFalsch(wrong);
  return {type:'mc',badge:'vocab',_presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,suf,item._presetId||null),
    question:head, answer:target, choices:shuffle([target,...distract])};
}

// 🔨 Schmieden · fehlender Buchstabe (Lücke). speak = ganzes Wort (TTS).
function bSchmiedenGap(item, which, suf){
  const mt=_verbMeta(which); const target=_firstForm(mt.get(item));
  const g=_gapLetter(target);
  return {type:'type',badge:'spelling',gap:true,speak:target,hint:'',_presetId:item._presetId||null,
    gapWord:g.word, gapIdx:g.idx,
    statKey:statKeyFor(item.de,item.en,suf,item._presetId||null),
    question:_uvHead(item.de,which,'Welcher Buchstabe fehlt?',''),answer:g.letter};
}

// 🔨 Schmieden · ganzes Wort tippen (nur deutsches Wort als Vorgabe).
function bSchmiedenType(item, which, suf){
  const mt=_verbMeta(which); const full=mt.get(item);
  return {type:'type',badge:'spelling',hint:'',ph:mt.label+' tippen…',_presetId:item._presetId||null,
    statKey:statKeyFor(item.de,item.en,suf,item._presetId||null),
    question:_uvHead(item.de,which,mt.label+' bilden',''),answer:full};
}

// Eine Schmiede-Frage für eine Disziplin — Aufgabentyp je Frage ZUFÄLLIG.
//  🔍 Erkennen   → MC · Wörter stapeln (3 Formen) · falsche Form korrigieren
//  🔨 Schmieden  → fehlender Buchstabe · Buchstaben sortieren · ganzes Wort tippen
//  🪄 Verzaubern → Aussprache (deutsches Wort als Vorgabe)
function bDisc(item, which, disc, suf){
  const lvl=uvLevel(statKeyFor(item.de,item.en,suf,IRREGULAR_PRESET_ID));
  if(disc==='erkennen'){
    const r=Math.random();
    if(r<0.34) return bErkennen(item,which,lvl,suf);
    if(r<0.67) return bErkennenOrder(item,which,suf);
    return bErkennenFix(item,which,suf);
  }
  if(disc==='schmieden'){
    const r=Math.random();
    if(r<0.34) return bSchmiedenGap(item,which,suf);
    if(r<0.67) return bSchmiedenOrder(item,which,suf);
    return bSchmiedenType(item,which,suf);
  }
  return bRufen(item,which,1,suf);   // verzaubern: einzelne Form sprechen
}

// Partizip schaltet erst frei, wenn die Vergangenheit derselben Disziplin sitzt
// (§6: „Vergangenheit zuerst"). Stabile Schwelle ohne Interleaving-Zufall:
// ≥3 Versuche und EMA ≥ up2.
function _ppUnlocked(v, pastSuffix){
  const s=window.SD?.globalPresetStats?.wordStats?.[statKeyFor(v.de,v.en,pastSuffix,IRREGULAR_PRESET_ID)];
  return !!s && Math.floor(s.asked||0)>=3 && effectivePct(s)>=UV_LVL.up2;
}

// Vollwandlung (§3/Phase 5): ein Verb ist „voll", wenn ALLE 10 Form-Suffixe
// (past+pp × Erkennen/Formen/Schmieden/Buchstaben/Aussprache) gemeistert sind.
// Erst dann darf es in den gemischten Boss (Kampagne).
const UV_FORM_SUFFIXES=['_past_mc','_past_fo','_past_sp','_past_lo','_past_pr','_pp_mc','_pp_fo','_pp_sp','_pp_lo','_pp_pr'];

// Schritt-Suffixe je Modus × Form (muss zu UV_STARS/SUF in irregular-game.js passen).
// Jeder Modus ist ein eigener „aufleuchtbarer" Schmiede-Schritt mit eigenem Stat.
const SUF_ALL={
  vocab:    {past:'_past_mc', pp:'_pp_mc'},
  forms:    {past:'_past_fo', pp:'_pp_fo'},
  spelling: {past:'_past_sp', pp:'_pp_sp'},
  letters:  {past:'_past_lo', pp:'_pp_lo'},
  pronounce:{past:'_past_pr', pp:'_pp_pr'},
};
// Einen Schmiede-Schritt bauen: jeder Modus ruft seinen Builder mit SEINEM Suffix.
function bUV(item, mode, which, lvl){
  const suf=SUF_ALL[mode] && SUF_ALL[mode][which];
  let q;
  switch(mode){
    case 'forms':     q=bErkennenOrder(item, which, suf); break;
    case 'letters':   q=bSchmiedenOrder(item, which, suf); break;
    case 'spelling':  q=bSchmieden(item, which, lvl, suf); break;
    case 'pronounce': q=bRufen(item, which, lvl, suf); break;
    default:          q=bErkennen(item, which, lvl, suf); break;   // 'vocab'
  }
  q._uvMode=mode;   // Modus dieses Teils → In-Game-Fortschritt des aktuellen Teils
  return q;
}
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
  // Trainingsplatz-Runde: EINE Disziplin über alle Deck-Verben, beide Formen,
  // eigene _tr_-Suffixe (der Schmiede-Stationsfortschritt bleibt unberührt).
  if(m==='uvtrain' && window._uvTrain && UV_TRAIN_SUF[window._uvTrain.disc]){
    const disc=window._uvTrain.disc, sufs=UV_TRAIN_SUF[disc];
    const forms=window._uvTrain.forms||['past','pp'];   // deck.uvForms: 'past' = nur Simple Past
    window.VOCAB.forEach(v=>{
      if(!v.forms) return;
      forms.forEach(w=>all.push(bDisc(v,w,disc,sufs[w])));
    });
    const getS=q=>window.SD?.globalPresetStats?.wordStats?.[q.statKey];
    return weightedPickUnique(all, getS, limit);
  }
  // Slot-Runde (EIN Teil einer Waffe): window._uvStar = {which, slot, discipline, suf}.
  // Eine Runde übt GENAU diese Disziplin auf dem Teil-Suffix; der Aufgabentyp wird
  // je Frage zufällig gewählt (bDisc). Mastery-Filter (buildPool) lässt schon
  // gemeisterte Verben weg → die Runde fokussiert die noch offenen.
  if(m==='uvslot' && window._uvStar && window._uvStar.suf){
    const {which, discipline, suf}=window._uvStar;
    window.VOCAB.forEach(v=>{ if(v.forms) all.push(bDisc(v, which, discipline, suf)); });
    const getS=q=>window.SD?.globalPresetStats?.wordStats?.[q.statKey];
    return weightedPickUnique(all, getS, limit);
  }
  return [];   // anderen UV-Modus gibt es nicht mehr
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
    // Probetest prüft weiter nur das Schreiben (F-75), sonst die drei Aufgaben.
    if(window.isExamMode) weightedPickUnique(vocab, v=>getVocabStat(v,'_sp'), limit).forEach(v=>qs.push(bVocabType(v)));
    else weightedPickUnique(vocab, _spGewicht, limit).forEach(v=>qs.push(bVocabSpelling(v)));
  }
  if(m==='pronounce'){
    weightedPickUnique(vocab, v=>getVocabStat(v,'_pr'), limit).forEach(v=>qs.push(bVocabPronounce(v)));
  }
  if(m==='mixed_vocab'){
    if(window.isSchnellModus&&!window.isExamMode){
      vocab.forEach(v=>{qs.push(bVocabMC(v));qs.push(bVocabSpelling(v));qs.push(bVocabPronounce(v));});
    } else {
      const n1=Math.round(examLimit/3), n2=Math.round(examLimit/3), n3=examLimit-n1-n2;
      weightedPickUnique(vocab, v=>getVocabStat(v,'_mc'), n1).forEach(v=>qs.push(bVocabMC(v)));
      if(window.isExamMode) weightedPickUnique(vocab, v=>getVocabStat(v,'_sp'), n2).forEach(v=>qs.push(bVocabType(v)));
      else weightedPickUnique(vocab, _spGewicht, n2).forEach(v=>qs.push(bVocabSpelling(v)));
      weightedPickUnique(vocab, v=>getVocabStat(v,'_pr'), n3).forEach(v=>qs.push(bVocabPronounce(v)));
    }
  }
  }
  if(window._skipMasteryFilter||window.isExamMode) return shuffle(qs).slice(0, limit);
  const filtered=qs.filter(q=>q._spFertig!==undefined ? !q._spFertig : !isMastered(q));
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
  // Chip im Pastell-Design: eingeschaltet golden, ausgeschaltet cremefarben.
  btn.textContent = on ? 'Schnell: An' : 'Schnell: Aus';
  btn.classList.toggle('p-chip--gold', on);
  btn.classList.toggle('on', on);
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

// Rückfrage vor dem Einschalten (Fragment 2.10, F-29). Zurück-Taste bzw.
// Schließen = Abbrechen (das Promise bleibt dann einfach offen).
function _schnellFragen() {
  return new Promise((resolve) => {
    const flamme = (d, px) => iconHTML('flame', px)
      .replace('<canvas ', `<canvas data-ui="swap" data-seq="flame,flameR,flame,flameL" data-d="${d}" `);
    const ov = document.createElement('div');
    ov.className = 'p-dlg-grund p-sm-grund';
    ov.innerHTML = `<div class="p-dlg-karte p-sm-karte">
      <div class="p-sm-emblem">${flamme(0, 42)}</div>
      <div class="p-sm-titel">Schnellmodus</div>
      <div class="p-sm-text">Nur zum schnellen Üben — zählt <strong>nicht</strong> in die Statistik und bringt keine Taler.</div>
      <div class="p-sm-knoepfe"><button class="p-sm-btn p-sm-btn--ab">Abbrechen</button><button class="p-sm-btn p-sm-btn--an">${flamme(2, 14)}Einschalten</button></div>
    </div>`;
    ov.querySelector('.p-sm-btn--ab').onclick = () => { ov.remove(); resolve(false); };
    ov.querySelector('.p-sm-btn--an').onclick = () => { ov.remove(); resolve(true); };
    document.body.appendChild(ov);
  });
}

export function toggleSchnell() {
  const sd=window.SD; if(!sd) return;
  const mode = sd.activeMode||'free';
  if(!window.schnellByMode) window.schnellByMode={};
  if(!window._schnellBackup || typeof window._schnellBackup!=='object') window._schnellBackup={};
  const btnId = mode==='student' ? 'student-schnell-toggle' : 'schnell-toggle';

  if(!window.schnellByMode[mode]){
    // → AN (nur dieser Modus), erst nach der Rückfrage 2.10: echten Stand der
    // Modus-Decks sichern + auf 0.
    _schnellFragen().then((ja)=>{
      if(!ja) return;
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
      showMenu();
    });
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
  const hasPronounce=(m==='pronounce'||m==='mixed_vocab'||(m==='uvslot'&&window._uvStar?.discipline==='verzaubern')||(m==='uvtrain'&&window._uvTrain?.disc==='verzaubern'));
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
  const opts = window.isProbetest
    ? { icon:'⚠️', title:'Probetest abbrechen?', body:'Der Probetest wird beendet. Dein Fortschritt in dieser Runde geht verloren und wird nicht gespeichert.', ok:'Abbrechen', cancel:'Weiter testen', danger:true }
    : { icon:'🏠', title:'Zurück zum Menü?', body:'Der Lernfortschritt dieser Runde wird gespeichert.', ok:'Zum Menü', cancel:'Bleiben' };
  window.esConfirm(opts).then(ok => {
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
    if(!window.isUV&&!window.isFreePlay&&!window.isRetryPhase&&!window.isExamMode&&window.wrongQueue.length>0){
      window.isRetryPhase=true;
      window.questionPool=window.wrongQueue.slice();
      window.wrongQueue=[];
      window.questionIndex=0;
      // Zwischenkarte nach 4.4; sie verdeckt Warte-Kasten und Fortschritt.
      // Weiter geht es mit „Los" (F-46) — das Kind bestimmt das Tempo.
      const card=document.getElementById('game-card');
      const n=window.questionPool.length;
      card.innerHTML=`<div class="sp-nochmal">
        <div class="sp-nochmal-kachel">${iconHTML('refresh',42)}</div>
        <div class="sp-nochmal-titel">Jetzt nochmal die ${n} ${n===1?'falsche Frage':'falschen Fragen'}!</div>
        <div class="sp-nochmal-chip"><span class="p-chip p-chip--icon p-chip--gold">${iconHTML('starInk',14)}Punkte zählen halb</span></div>
        <div class="sp-nochmal-text">Nur was daneben ging, läuft noch einmal — danach ist die Runde fertig.</div>
        <button class="p-btn p-btn--primaer sp-los">Los</button>
      </div>`;
      document.getElementById('game-screen')?.classList.add('is-nochmal');
      card.querySelector('.sp-los')?.addEventListener('click',()=>showQuestion(),{once:true});
      return;
    }
    showEnd();return;
  }
  document.getElementById('game-screen')?.classList.remove('is-nochmal');
  document.getElementById('progress-fill').style.width=(window.questionIndex/window.questionPool.length*100)+'%';
  window.currentQ=window.questionPool[window.questionIndex];
  renderQuestion(window.currentQ);
  if(window.isUV) updateModeProgress(false);   // Balken auf das aktuelle Teil (Frage-Modus)
}

// Modusname, Pixelsymbol, Grundton und Plakette gehoeren zusammen — hier an
// einer Stelle, damit Kopfzeile, Screen-Farbe und Karte nie auseinanderlaufen.
const MODUS = {
  vocab:     { titel:'Vokabeln',        chip:'Vokabeln',            icon:'book',   ton:'mint' },
  spelling:  { titel:'Rechtschreibung', chip:'Rechtschreibung',     icon:'pencil', ton:'lila' },
  pronounce: { titel:'Aussprache',      chip:'Sprich auf Englisch', icon:'mic',    ton:'rosa' },
};

function renderQuestion(q) {
  const card=document.getElementById('game-card');
  const m = MODUS[q.badge];
  // Kopfzeile und Grundton des Screens folgen dem Modus. UV (Gestaltwandler)
  // bringt seinen eigenen Kopf mit und behaelt darum Pfirsich. Der Probetest
  // heißt im Kopf „Probetest" (4.12), die Plakette zeigt die Aufgabe.
  const titleEl=document.getElementById('game-title');
  if(titleEl) titleEl.textContent = window.isUV ? 'Formen' : window.isExamMode ? 'Probetest' : (m ? m.titel : 'Übung');
  setGrundton(window.isUV ? 'pfirsich' : (m ? m.ton : 'mint'), document.getElementById('game-screen'));
  // UV hat eigenen Kopf (Form-Plakette etc.) — die generische Plakette entfaellt dort.
  let head = window.isUV || !m ? '' : `<div class="badge ${q.badge}">${iconHTML(m.icon,14)}${m.chip}</div>`;
  // Aufgabe wie im Entwurf: Kürzel „DE" vor dem Wort, bei Rechtschreibung die
  // Anweisung darüber. UV bringt sein eigenes HTML in q.question mit.
  const frage = q.de != null
    ? (q.instr ? `<div class="q-instr">${q.instr}</div>` : '')
      + `<div class="question-text${q.instr ? ' mit-instr' : ''}"><span class="q-lang">DE</span>${window.escHtml(q.de)}</div>`
    : window.isUV
      ? `<div class="uv-kopf">${q.question||''}</div>`
      : `<div class="question-text">${(q.question||'').replace(/\n/g,'<br>')}</div>`;
  let html='';
  if(q.type==='mc'){
    // Antworten liegen in der Fragekarte (4.3, 4.5, 4.12).
    html+=`<div class="p-fragekarte">${head}${frage}<div class="choices">`;
    q.choices.forEach(c=>{
      html+=`<button class="choice-btn" onclick="checkMC(this,'${esc(c)}')">${c}</button>`;
    });
    html+=`</div></div>`;
  } else if(q.type==='type'){
    // Bei „type" liegen Eingabe und Pruefen-Knopf MIT in der Fragekarte.
    html+=`<div class="p-fragekarte">${head}${frage}`;
    // „to" vor Verben steht klein vor Lücke, Eingabe und Ablage (08.10.2026).
    const vor=q.vorsatz ? `<span class="sp-vorsatz">${window.escHtml(q.vorsatz)}</span>` : '';
    if(q.gap){
      // Lücke wie 5.10: das Wort als Buchstaben-Kacheln, die fehlende Stelle
      // gestrichelt. Getippt wird direkt in die Lücke (Wunsch des Nutzers,
      // 08.10.2026): der Buchstabe steht so im Wort, und weil es nur EIN Buchstabe
      // ist, wird gleich geprüft — ohne Feld darunter und ohne „Prüfen".
      // Ein Wort = eine Gruppe: umgebrochen wird nur zwischen Wörtern (_passeFelder).
      const w=q.gapWord||''; let cells=`<span class="sp-wortgruppe">${vor}`;
      for(let k=0;k<w.length;k++){
        cells += (k===q.gapIdx)
          ? `<input class="gap-kachel is-luecke gap-eingabe" id="type-input" type="text" maxlength="1"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Fehlender Buchstabe"
              oninput="if(this.value.trim())submitType()">`
          : /\s/.test(w[k]) ? (/\s/.test(w[k-1]) ? '' : `</span><span class="sp-wortgruppe">`)
          : `<span class="gap-kachel">${window.escHtml(w[k])}</span>`;
      }
      if(w) html+=`<div class="gap-reihe">${cells}</span></div>`;
    } else {
      html+=`<div class="type-input-wrap${vor?' mit-vorsatz':''}">${vor}
        <input class="type-input" id="type-input" type="text" placeholder="${q.ph||'Englisch tippen…'}"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          onkeydown="if(event.key==='Enter')submitType()">
      </div>`;
    }
    // Formen (5.6–5.10): Prüfen in Gold, Haken vorn. Vokabeln (4.6): Haken hinten.
    // Die Lücke prüft sich selbst (siehe oben), sie hat keinen Knopf.
    html+=q.gap ? `</div>` : window.isUV
      ? `<button class="submit-btn uv-pruefen" onclick="submitType()">${iconHTML('check',14)}Prüfen</button></div>`
      : `<button class="submit-btn" onclick="submitType()">Prüfen${iconHTML('check',14)}</button></div>`;
  } else if(q.type==='pronounce'){
    // Aussprache nach 4.7–4.10: runder Mikrofon-Knopf (Ringe beim Zuhören),
    // Zustand darunter, Pegel als 9 Balken (echte Lautstärke, F-21), Kasten „Gehört".
    html+=`<div class="p-fragekarte">${head}${frage}
      <div class="mic-rund-platz"><button class="mic-btn" id="mic-btn" onclick="startRecording()" data-ui="pulse" data-a="4">`
      +`<span class="mic-ring mic-ring--1" data-ui="ring" data-a="9" data-d="0"></span>`
      +`<span class="mic-ring mic-ring--2" data-ui="ring" data-a="7" data-d="6"></span>${iconHTML('mic',56)}</button></div>
      <div class="mic-label" id="pronounce-tip">Tippen und sprechen</div>
      <div class="mic-balken" id="mic-balken">${'<span></span>'.repeat(9)}</div>
      <div class="pronounce-result" id="pronounce-result"></div>
    </div>`;
  } else if(q.type==='order'){
    // Ordnen wie 5.6 (Formen: Beschriftung links, Ablage rechts) und 5.9
    // (Buchstaben: Kacheln nebeneinander) — alles in der Fragekarte.
    html+=`<div class="p-fragekarte">${head}${frage}`;
    const isL=q.orderKind==='letters';
    html+=`<div class="order-slots${isL?' letters':''}" id="order-slots">`;
    // Buchstaben: ein Wort = eine Gruppe, umgebrochen wird nur zwischen Wörtern (_passeFelder).
    if(isL) html+=`<span class="sp-wortgruppe">`+(q.vorsatz ? `<span class="sp-vorsatz">${window.escHtml(q.vorsatz)}</span>` : '');
    q.slotLabels.forEach((lab,i)=>{
      html+=`<div class="order-slot" data-slot="${i}">${lab?`<span class="slot-label">${lab}</span>`:''}</div>`;
      if(isL && q.luecken?.includes(i)) html+=`</span><span class="sp-wortgruppe">`;   // nächstes Wort
    });
    html+=isL ? `</span></div>` : `</div>`;
    html+=`<div class="order-tray${isL?' letters':''}" id="order-tray">`;
    q.tiles.forEach(t=>{ html+=`<div class="order-tile" data-val="${t}">${t}</div>`; });
    html+=`</div>`;
    html+=`<button class="submit-btn uv-pruefen" id="order-check" onclick="checkOrder()" disabled>${iconHTML('check',14)}Prüfen</button></div>`;
  }
  card.innerHTML=html;
  card.classList.remove('mic-hoert','mic-pegel');
  // Aussprache zeigt keinen Warte-Kasten (4.7–4.10), nur Vondus Hinweis bei 4.11.
  document.getElementById('game-screen')?.classList.toggle('ist-aussprache', q.type==='pronounce');
  document.getElementById('game-screen')?.classList.toggle('ist-formen', !!window.isUV);
  // Schnellmodus (4.5, F-45): Chip unter dem Titel, Hinweis statt Warten/Fortschritt.
  document.getElementById('game-screen')?.classList.toggle('ist-schnell', !!(window.isSchnellModus && !window.isExamMode));
  document.getElementById('game-screen')?.classList.toggle('ist-pruefung', !!window.isExamMode);
  if(q.type==='pronounce') gehoert(document.getElementById('pronounce-result'), '—', 'wort');
  if(q.type==='type') setTimeout(()=>document.getElementById('type-input')?.focus(),120);
  if(q.type==='order') initOrderDnD();
  if(q.gap || q.orderKind==='letters') _passeFelder(card);
}

// Lange Wörter (Vorschlag vom 08.10.2026, Vorbild Wortleiste des Buchstabensturms):
// die Felder werden schmaler (50 → höchstens 16 px), bis das längste Wort in eine
// Zeile passt; Höhe, Ecken und Schrift ziehen mit (style.css, --fw/--fs). Mehr als
// 6 Steine im Vorrat liegen in höchstens 2 Reihen, jeder aber mindestens 44 px breit.
function _passeFelder(card){
  const reihe=card.querySelector('.gap-reihe, #order-slots.letters');
  const breite=reihe?.clientWidth||0;
  if(!breite) return;
  let fw=50;
  for(const g of reihe.querySelectorAll('.sp-wortgruppe')){
    const n=g.querySelectorAll('.gap-kachel, .order-slot').length; if(!n) continue;
    const vor=g.querySelector('.sp-vorsatz');
    fw=Math.min(fw, Math.floor((breite-(vor ? vor.offsetWidth+8 : 0)-(n-1)*8)/n));
  }
  fw=Math.max(16, fw);
  if(fw<50){
    reihe.style.setProperty('--fw', fw+'px');
    reihe.style.setProperty('--fs', (fw>=38 ? 22 : fw>=26 ? 18 : 16)+'px');
  }
  const vorrat=card.querySelector('#order-tray.letters'), n=vorrat?.children.length||0;
  if(n>6){
    const proReihe=Math.ceil(n/2);
    vorrat.style.setProperty('--tw', Math.max(44, Math.min(86, Math.floor((vorrat.clientWidth-(proReihe-1)*10)/proReihe)))+'px');
  }
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
  let drag=null;        // aktives Ziehen (Kachel ist abgehoben)
  let pending=null;     // pointerdown – noch offen, ob Tap oder Ziehen

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
  // Tap (ohne Ziehen): Kachel im Tray → in den nächsten freien Slot; Kachel in
  // einem Slot → zurück ins Tray (rückwärts). So geht Sortieren auch per Klick.
  function tapPlace(tile){
    if(tile.parentElement && tile.parentElement.classList.contains('order-slot')){
      tray.appendChild(tile);
    } else {
      const slot=slots.find(s=>!s.querySelector('.order-tile'));
      if(!slot) return;
      placeTile(tile, slot);
    }
    updateCheck();
  }
  function targetUnder(x,y){
    const el=document.elementFromPoint(x,y); if(!el) return null;
    const slot=el.closest('.order-slot'); if(slot) return slot;
    if(el===tray || tray.contains(el)) return tray;
    return null;
  }
  // Kachel abheben (fixed an <body>: die .game-card behält durch `bounce-in`
  // ein transform und wäre sonst Containing-Block → Finger-Versatz).
  function liftTile(x,y){
    const tile=pending.tile, r=tile.getBoundingClientRect();
    drag={tile, dx:x-r.left, dy:y-r.top, home:pending.home};
    tile.classList.add('dragging');
    tile.style.width=r.width+'px'; tile.style.height=r.height+'px';
    tile.style.position='fixed'; tile.style.left=r.left+'px'; tile.style.top=r.top+'px';
    tile.style.zIndex=9999; tile.style.pointerEvents='none';
    document.body.appendChild(tile);
  }
  function onMove(e){
    if(pending && !drag){
      if(Math.hypot(e.clientX-pending.startX, e.clientY-pending.startY)<=6) return;
      liftTile(e.clientX,e.clientY);   // Schwelle überschritten → echtes Ziehen
    }
    if(!drag) return;
    drag.tile.style.left=(e.clientX-drag.dx)+'px';
    drag.tile.style.top=(e.clientY-drag.dy)+'px';
    const t=targetUnder(e.clientX,e.clientY);
    slots.forEach(s=>s.classList.toggle('drop-hover', s===t));
    tray.classList.toggle('drop-hover', t===tray);
  }
  function cleanup(){
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',onUp);
    document.removeEventListener('pointercancel',onUp);
  }
  function onUp(e){
    if(drag){
      const tile=drag.tile;
      const t=targetUnder(e.clientX,e.clientY) || drag.home || tray;
      tile.style.position=''; tile.style.left=''; tile.style.top='';
      tile.style.width=''; tile.style.height=''; tile.style.zIndex=''; tile.style.pointerEvents='';
      tile.classList.remove('dragging');
      slots.forEach(s=>s.classList.remove('drop-hover')); tray.classList.remove('drop-hover');
      placeTile(tile, t);
      drag=null; pending=null; cleanup(); return;
    }
    if(pending){ const tile=pending.tile; pending=null; cleanup(); tapPlace(tile); return; }
    cleanup();
  }
  function onDown(e){
    if(window.answered) return;
    e.preventDefault();
    pending={tile:e.currentTarget, startX:e.clientX, startY:e.clientY, home:e.currentTarget.parentElement};
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
  // Wie 4.3: richtige Kachel mint mit Haken (Pop), gewählte falsche rosa mit
  // Kreuz (Wackeln).
  const markRichtig=b=>{ b.classList.add('correct'); b.insertAdjacentHTML('afterbegin', iconHTML('check',14).replace('<canvas ','<canvas data-ui="pop" data-c="24" data-d="6" ')); };
  if(ok) markRichtig(btn);
  else {
    btn.classList.add('wrong');
    btn.insertAdjacentHTML('afterbegin', iconHTML('close',14));
    btn.dataset.c='24'; btn.dataset.d='20'; btn.dataset.ui='shake';
    document.querySelectorAll('.choice-btn').forEach(b=>{
      if(b.textContent.trim().toLowerCase()===window.currentQ.answer.toLowerCase()) markRichtig(b);
    });
  }
  ok?handleCorrect():handleWrong();
}

export function submitType() {
  if(window.answered)return;
  const inp=document.getElementById('type-input');if(!inp)return;
  const val=inp.value.trim();if(!val)return;
  window.answered=true;inp.disabled=true;
  const ohneTo=spOhneTo(window.currentQ);
  const corrects=window.currentQ.answer.split('/').map(x=>ohneTo(x.trim().toLowerCase()));
  const ok=corrects.includes(ohneTo(val.toLowerCase()));
  inp.classList.add(ok?'correct':'wrong');
  // Wackeln wie die falsche Kachel in 4.3 (8 Takte, dann Ruhe).
  if(!ok){ inp.dataset.c='24'; inp.dataset.d='20'; inp.dataset.ui='shake'; }
  ok?handleCorrect():handleWrong();
}

export function showSelfRateButtons() {
  if(window.answered) return;
  const card=document.getElementById('game-card');
  if(!card) return;
  const old=document.getElementById('self-rate-wrap');
  if(old) old.remove();
  const ans=window.currentQ.answer;
  // Aussehen nach 4.11: „Lösung anhören" hellblau, Hinweis, zwei große Knöpfe —
  // in der Fragekarte; darunter erklärt Vondu, warum das Kind selbst entscheidet.
  const wrap=document.createElement('div');
  wrap.id='self-rate-wrap';
  wrap.innerHTML=`<div class="sr-hoeren-platz"><button class="sr-hoeren">${iconHTML('speaker',28)}Lösung anhören</button></div>
    <div class="sr-hinweis">Hör dir die Aussprache an und entscheide:</div>
    <div class="sr-knoepfe"><button class="sr-knopf sr-knopf--ja">${iconHTML('check',28)}Hatte ich richtig</button><button class="sr-knopf sr-knopf--nein">${iconHTML('close',28)}Daneben</button></div>`;
  const listenBtn=wrap.querySelector('.sr-hoeren');
  listenBtn.onclick=()=>{
    try{ voskStop(); }catch(e){}
    if(window._activeVoskTimeout){ clearTimeout(window._activeVoskTimeout); window._activeVoskTimeout=null; }
    try{ stopVisualizer(); }catch(e){}
    try{ speakWord(ans); }catch(e){ console.warn('speakWord:',e); }
    window._spokenForQuestion=true;
    const micBtn=document.getElementById('mic-btn');
    if(micBtn){
      micBtn.disabled=true;micBtn.onclick=null;
      micZustand(micBtn,'gehoert');
    }
  };
  wrap.querySelector('.sr-knopf--ja').onclick=()=>selfRate(true);
  wrap.querySelector('.sr-knopf--nein').onclick=()=>selfRate(false);
  (card.querySelector('.p-fragekarte')||card).appendChild(wrap);
  document.getElementById('feedback')?.classList.add('is-selbst');
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
  // Erster Fehlversuch (F-48, Fragment 4.10): noch nicht werten — das Kind
  // bekommt „Nochmal versuchen", gewertet wird erst der zweite Versuch.
  if(!ok && !window._pronounceAttempts){
    if(document.getElementById('nochmal-versuchen')) return;   // Nachzügler desselben Versuchs
    setMicFinalStatus(false);
    _zeigeNochmalVersuchen();
    return;
  }
  window.answered=true;
  setMicFinalStatus(ok);
  if(ok) handlePronounceCorrect();
  else handleWrong();
}

// Knopf „Nochmal versuchen" in der Fragekarte (4.10). Tippen setzt den Kasten
// „Gehört" zurück und hört noch einmal zu (retryPronounce zählt den Versuch).
function _zeigeNochmalVersuchen() {
  const card=document.getElementById('game-card');
  const ziel=card&&(card.querySelector('.p-fragekarte')||card);
  if(!ziel) return;
  const b=document.createElement('button');
  b.id='nochmal-versuchen';
  b.className='p-btn sp-nochmal-versuchen';
  b.innerHTML=iconHTML('refresh',14)+'Nochmal versuchen';
  b.onclick=()=>{
    b.remove();
    const res=document.getElementById('pronounce-result');
    if(res){ res.classList.remove('is-falsch','is-richtig'); delete res.dataset.ui; }
    retryPronounce();
  };
  ziel.appendChild(b);
}

export function setMicFinalStatus(ok) {
  const btn=document.getElementById('mic-btn');
  if(!btn) return;
  btn.disabled=true;btn.onclick=null;
  micZustand(btn, ok?'richtig':'falsch');
  // Kasten „Gehört" wie 4.9 (mint, Haken ploppt) bzw. 4.10 (rosa, Kreuz, wackelt).
  const res=document.getElementById('pronounce-result');
  if(res && res.classList.contains('heard')){
    res.classList.add(ok?'is-richtig':'is-falsch');
    const ic=res.querySelector('canvas');
    if(ic) ic.outerHTML = ok
      ? iconHTML('check',14).replace('<canvas ','<canvas data-ui="pop" data-c="32" data-d="3" ')
      : iconHTML('close',14);
    if(!ok){ res.dataset.c='24'; res.dataset.d='20'; res.dataset.ui='shake'; }
  }
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
    // Texte ohne Emoji wie im Entwurf („Top! +10 Punkte", 4.2).
    const correctTexts={
      first:['Richtig!','Super!','Top!','Klasse!','Genau!'],
      streak3:['Dreierpack!','Auf der Welle!','Stark!'],
      streak5:['Fünfer-Combo!','Unaufhaltsam!','Genial!'],
      streak7:['Sieben am Stück!','Du bist unschlagbar!','Perfekt!'],
      streak10:['ZEHN am Stück! WOW!','Unglaublich!','Legendär!']
    };
    function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
    let baseMsg;
    if(window.streak>=10) baseMsg=pick(correctTexts.streak10);
    else if(window.streak>=7) baseMsg=pick(correctTexts.streak7);
    else if(window.streak>=5) baseMsg=pick(correctTexts.streak5);
    else if(window.streak>=3) baseMsg=pick(correctTexts.streak3);
    else baseMsg=pick(correctTexts.first);
    const msg=window.isRetryPhase?baseMsg+' +'+bonus+' Punkte (Wiederholung)':baseMsg+' +'+bonus+' Punkte';
    showFeedback(true,msg,'');
    if(window.currentQ&&window.currentQ.type==='pronounce') setMicFinalStatus(true);
    try{ playSfx(window.streak>=3?'streak':'correct'); }catch(e){}
    if(window.currentQ&&(window.currentQ.speak||window.currentQ.answer)){
      // speak überschreibt answer (z. B. Buchstaben-Lücke: ganzes Wort statt 1 Buchstabe).
      const w=window.currentQ.speak||window.currentQ.answer;
      setTimeout(()=>{ try{ speakWordOnce(w); }catch(e){} }, 150);
    }
    if(window.streak===5||window.streak===10) window.spawnConfetti();
  }catch(e){
    console.error('handleCorrect:',e);
    try{ showFeedback(true,'Richtig!',''); }catch(e2){}
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
    if(window.currentQ&&window.currentQ.type==='pronounce') setMicFinalStatus(false);
    let headline='Nicht ganz!';
    let close=false;
    if(window.currentQ&&window.currentQ.type==='type'){
      const inp=document.getElementById('type-input');
      const ohneTo=spOhneTo(window.currentQ);
      const val=ohneTo(inp?(inp.value||'').toLowerCase().trim():'');
      const target=ohneTo((window.currentQ.answer.split('/')[0]||'').toLowerCase().trim());
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
      close:['Knapp daneben!','Fast hattest du es!','So nah dran!'],
      normal:['Nicht ganz!','Daneben!','Üben hilft!','Gleich nochmal!']
    };
    function pickW(arr){return arr[Math.floor(Math.random()*arr.length)];}
    headline=pickW(close?wrongTexts.close:wrongTexts.normal);
    const isPronounce=window.currentQ&&window.currentQ.type==='pronounce';
    // Eine Zeile wie 4.3: „Üben hilft! Richtige Antwort: **brown**".
    const subText=isPronounce?'Hör dir die richtige Aussprache an':('Richtige Antwort: <strong>'+window.escHtml(window.currentQ&&window.currentQ.answer||'?')+'</strong>');
    showFeedback(false,headline,subText);
    try{ playSfx('wrong'); }catch(e){}
    if(window.currentQ&&window.currentQ.answer){
      const w=window.currentQ.answer;
      setTimeout(()=>{ try{ speakWordOnce(w); }catch(e){} }, 200);
    }
  }catch(e){
    console.error('handleWrong:',e);
    try{ showFeedback(false,'Nicht ganz!',''); }catch(e2){}
  }
}

function updateScoreBar() {
  // Pixelsymbol statt Emoji — textContent wuerde das Canvas wegwerfen.
  // Flamme flackert im Takt (swap flame/flameR/flame/flameL wie im Entwurf).
  document.getElementById('streak-display').innerHTML=iconHTML('flame',14).replace('<canvas ','<canvas data-ui="swap" data-seq="flame,flameR,flame,flameL" data-d="0" ')+window.streak;
  document.getElementById('points-display').innerHTML=iconHTML('starInk',14)+window.points;
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
    // Slot-Runde: Fortschritt + Titel beziehen sich auf das AKTUELLE Teil (Disziplin).
    const star=window._uvStar;
    const discTitles={erkennen:['Erkennen','lupe'],schmieden:['Schmieden','hammer'],verzaubern:['Verzaubern','wand']};
    const [title, icon] = (star && discTitles[star.discipline]) || ['Schmiede','hammer'];
    return {...window._uvProgress(), title, icon};
  }
  const presetWs = window.SD?.globalPresetStats?.wordStats || {};
  const deckWs = window.SD?.wordStats || {};
  function pf(suffix) {
    let score=0, mastered=0;
    window.VOCAB.forEach(v=>{
      const w=wortScore(v._presetId ? presetWs : deckWs, v, suffix, v._presetId||null);
      score+=w.score; if(w.mastered) mastered+=1;
    });
    return {score,mastered,total:window.VOCAB.length};
  }
  // Titel ohne Emoji, das Symbol steht daneben (Fortschrittskarte 4.7, 4.12).
  if(window.mode==='vocab')    return {...pf('_mc'),title:'Vokabeln',icon:'book'};
  if(window.mode==='spelling') return {...pf('_sp'),title:'Rechtschreibung',icon:'pencil'};
  if(window.mode==='pronounce')return {...pf('_pr'),title:'Aussprache',icon:'mic'};
  if(window.mode==='mixed_vocab'){
    const a=pf('_mc'),b=pf('_sp'),c=pf('_pr');
    return {score:Math.min(a.score,b.score,c.score),
            mastered:Math.min(a.mastered,b.mastered,c.mastered),
            total:window.VOCAB.length,title:'Alle gemischt',icon:'target'};
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
    if(titleEl) titleEl.innerHTML=iconHTML('chart',14)+'Prüfung';
    if(pctEl) pctEl.textContent=barPct+'%';
    // Ohne laufende Note (F-47, Fragment 4.12): beantwortet/gesamt und woraus
    // der Test gemischt ist. Die Note kommt erst am Ende (4.14).
    if(subEl){
      const n=(window.isProbetest&&window._probetestDecks||[]).length;
      const woher=n>1 ? ' · gemischt aus '+n+' Sammlungen' : n===1 ? ' · aus 1 Sammlung' : '';
      subEl.textContent=answered+'/'+totalQ+woher;
    }
    if(barEl) barEl.style.width=barPct+'%';
    window._lastModePct=barPct;
    return;
  }

  const p=progressForCurrentMode();
  const pct=Math.min(100,Math.round((p.score/p.total)*100));
  if(titleEl){ titleEl.textContent=p.title; if(p.icon) titleEl.insertAdjacentHTML('afterbegin', iconHTML(p.icon,14)); }
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
    if(window.isProbetest) return;   // Probetest: ephemer — kein Score, kein Sync, kein lastExam
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
    } else if(window.isProbetest){
      // Probetest: kein Deck, aber Verlaufseintrag (Sammlungs-Namen, Note, %, Fragen/richtig).
      const entry={ decks: window._probetestDecks||[], grade, percent, questions: totalQ, correct: window.totalCorrect, date: Date.now() };
      if(!Array.isArray(window.SD.probetests)) window.SD.probetests=[];
      window.SD.probetests.unshift(entry);
      if(window.SD.probetests.length>50) window.SD.probetests.length=50;
      persist(window.SD);
      // Cloud-id am lokalen Eintrag merken, damit „Löschen" auch die Cloud-Zeile trifft.
      if(window.currentUser) saveProbetest(entry, window.currentUser.id)
        .then(id=>{ if(id){ entry.id=id; persist(window.SD); } }).catch(()=>{});
    }
    const newHS=window.points>=window.SD.highscore&&window.points>0;
    showScreen('end-screen');
    _endeVorbereiten(true);
    { const rb=document.getElementById('end-restart-btn'); if(rb) rb.style.display=window.isProbetest?'none':''; }
    _endeZahlen(window.points, window.totalCorrect+'/'+totalQ, window.bestStreak, true);
    document.getElementById('end-hs-msg').innerHTML=newHS?_hsChip():'';
    // Bei der Pruefung steht die Note im Kreis statt eines Pokals (4.14).
    document.getElementById('end-emoji').innerHTML='<span class="p-pokal-note">'+grade+'</span>';
    document.getElementById('end-title').textContent=window.isUV?('Vollwandlung — '+gradeText(grade)):gradeText(grade);
    document.getElementById('end-title').insertAdjacentHTML('beforeend', iconHTML('flag',28));
    const dateStr=new Date(deck&&deck.lastExam?deck.lastExam.date:Date.now()).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    document.getElementById('end-stars').innerHTML='<span class="p-endsub">'+percent+' % richtig · '+dateStr+'</span>';
    if(grade<=2) _endKonfetti();
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
    // Letztes Teil eines Gefährten fertig → der taucht JETZT erstmals in der
    // Ausrüstung auf (vorher unsichtbar) — das feiern statt der Modus-Meldung.
    const comp = window.isUV && window._uvStar && window._uvStar.unlocksCompanion;
    setTimeout(()=>{
      const msg = comp
        ? { icon:'🐾', title:'Gefährte freigespielt!', body:'Alle 5 Teile geschafft! Dein Gefährte wartet jetzt im Profil unter 🧰 Ausrüstung.', ok:'Super!' }
        : { icon:'🏆', title:'100% erreicht!', body:'Du hast den Modus "'+(mp.title||window.mode)+'" gemeistert!', ok:'Weiter' };
      window.esAlert(msg).then(()=>showMenu());
    }, 400);
    return;
  }
  showScreen('end-screen');
  _endeVorbereiten(false);
  { const rb=document.getElementById('end-restart-btn'); if(rb) rb.style.display=''; }
  _endeZahlen(window.points, window.totalCorrect, window.bestStreak, false);
  document.getElementById('end-hs-msg').innerHTML=newHS?_hsChip():'';
  const pct=window.totalCorrect/Math.max(1,window.questionIndex);
  // Pokal und Sterne als Pixelgrafik. Die Zahl der Sterne traegt die Aussage,
  // das Symbol im Kreis bleibt dasselbe — so wie im Entwurf.
  let sym,title,sterne;
  if(pct>=.9){sym='trophy';title='Absolut fantastisch!';sterne=3;}
  else if(pct>=.7){sym='trophy';title='Sehr gut gemacht!';sterne=2;}
  else if(pct>=.5){sym='target';title='Gut versucht!';sterne=1;}
  else{sym='book';title='Weiter üben!';sterne=0;}
  // 4.13: Symbol wippt, drei Funkel-Sterne, die Sterne ploppen nacheinander.
  document.getElementById('end-emoji').innerHTML=iconHTML(sym,56).replace('<canvas ','<canvas data-ui="bob" data-a="2" ')+_FUNKELN;
  document.getElementById('end-title').textContent=title;
  document.getElementById('end-stars').innerHTML=
    Array.from({length:sterne},(_,i)=>`<span class="p-sternfach" data-ui="pop" data-c="48" data-d="${3+3*i}">${iconHTML('star',28)}</span>`).join('');
  if(pct>=.8) window.spawnConfetti();
}

// ── Rundenende-Helfer (4.13 / 4.14) ──
const _FUNKELN =
  '<canvas data-ui="sparkle" data-d="0" width="7" height="7" style="position:absolute;right:-22px;top:-8px;width:21px;height:21px;image-rendering:pixelated"></canvas>'
  + '<canvas data-ui="sparkle" data-d="6" width="7" height="7" style="position:absolute;left:-24px;top:14px;width:21px;height:21px;image-rendering:pixelated"></canvas>'
  + '<canvas data-ui="sparkle" data-d="11" width="7" height="7" style="position:absolute;right:-14px;bottom:-12px;width:14px;height:14px;image-rendering:pixelated"></canvas>';

function _hsChip(){
  return `<span class="p-hs-chip" data-ui="pulse" data-a="4">${iconHTML('starInk',14)}Neuer Highscore!</span>`;
}

// Probetest-Ende (4.14) als Karte mit Notenkreis; normales Ende (4.13) ohne.
function _endeVorbereiten(note){
  const scr=document.getElementById('end-screen');
  if(!scr) return;
  scr.classList.toggle('is-note', note);
  scr.querySelector('.sp-konfetti')?.remove();
  const kreis=document.getElementById('end-emoji');
  if(kreis){ if(note){ kreis.dataset.c='48'; kreis.dataset.d='2'; kreis.dataset.ui='pop'; } else { delete kreis.dataset.ui; kreis.style.transform=''; kreis.style.opacity=''; } }
  const lbl=document.getElementById('stat-streak')?.parentElement?.querySelector('.stat-label');
  if(lbl) lbl.textContent = note ? 'Serie' : 'Streak';
}

// Zahlen neu anlegen: ui-anim merkt sich den Startwert von data-ui="count" am
// Element — ein wiederverwendetes Element zählte sonst zum alten Wert.
function _endeZahlen(punkte, richtig, serie, zaehlen){
  [['stat-points',punkte],['stat-correct',richtig],['stat-streak',serie]].forEach(([id,wert])=>{
    const alt=document.getElementById(id); if(!alt) return;
    const neu=alt.cloneNode(false);
    neu.removeAttribute('style');
    neu.textContent=wert;
    if(zaehlen){ neu.dataset.c='48'; neu.dataset.d='44'; neu.dataset.ui='count'; }
    else delete neu.dataset.ui;
    alt.replaceWith(neu);
  });
}

// Konfetti hinter der Notenkarte (4.14): Plättchen fallen im Takt, bis das
// nächste Rundenende es ersetzt.
function _endKonfetti(){
  const scr=document.getElementById('end-screen');
  const buehne=scr?.querySelector('.p-buehne');
  if(!buehne) return;
  const farben=['#FFBBC1','#BCE3FF','#C9B8FF','#B7E3C2','#FFD6A5'];
  const w=buehne.clientWidth||402, h=buehne.clientHeight||840;
  let html='';
  for(let i=0;i<17;i++){
    const x=Math.round(Math.random()*(w-14)), y=Math.round(Math.random()*(h-17));
    const dreh=Math.round(Math.random()*70-35);
    html+=`<span style="position:absolute;left:${x}px;top:${y}px;background:${farben[i%farben.length]};transform:rotate(${dreh}deg);z-index:${i%3===0?3:1}"></span>`;
  }
  const box=document.createElement('div');
  box.className='sp-konfetti';
  box.innerHTML=html;
  box.dataset.ui='confetti';
  buehne.prepend(box);
}
