// Unregelmäßige Verben — vollständiger Datensatz für English Stars (Gestaltwandler)
// ---------------------------------------------------------------------------------
// Felder pro Verb:
//   de     deutsche Bedeutung (Frageseite)
//   en     Grundform / Infinitiv (Anker-Stern)
//   past   Vergangenheit (Past Simple) — mehrere Formen mit "/" erlaubt
//   pp     Partizip (Past Participle)  — mehrere Formen mit "/" erlaubt
//   art    Muster-Familie: einzel | gleich | iau | en | keine
//   tier   Stufe, an GER gekoppelt:  1=A1 · 2=A2 · 3=B1/B1+ · 4=B2 · 5=B2+/C1
//   tricky (optional) true = Schrift-/Aussprache-Falle (read, lead, wound, lie …)
//
// "/"-Alternativen (z. B. burnt/burned) passen zur vorhandenen "/"-Logik beim Tippen.
// Bewusst nur Basisverben — keine Präfix-/Kompositavarianten (overwrite, outgrow …).

export const TIER_CEFR = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1' };

export const IRREGULAR_VERBS = [

  // ── Einzelgänger (völlig eigen / Partizip = Grundform) ──────────────────
  { de: 'sein',             en: 'be',      past: 'was/were', pp: 'been',    art: 'einzel', tier: 1 },
  { de: 'gehen',            en: 'go',      past: 'went',     pp: 'gone',    art: 'einzel', tier: 1 },
  { de: 'tun, machen',      en: 'do',      past: 'did',      pp: 'done',    art: 'einzel', tier: 1 },
  { de: 'kommen',           en: 'come',    past: 'came',     pp: 'come',    art: 'einzel', tier: 1 },
  { de: 'rennen, laufen',   en: 'run',     past: 'ran',      pp: 'run',     art: 'einzel', tier: 1 },
  { de: 'werden',           en: 'become',  past: 'became',   pp: 'become',  art: 'einzel', tier: 2 },

  // ── Gleichmacher (Vergangenheit = Partizip) ─────────────────────────────
  { de: 'haben',            en: 'have',    past: 'had',      pp: 'had',      art: 'gleich', tier: 1 },
  { de: 'machen',           en: 'make',    past: 'made',     pp: 'made',     art: 'gleich', tier: 1 },
  { de: 'sagen',            en: 'say',     past: 'said',     pp: 'said',     art: 'gleich', tier: 1 },
  { de: 'bekommen',         en: 'get',     past: 'got',      pp: 'got',      art: 'gleich', tier: 1 },
  { de: 'finden',           en: 'find',    past: 'found',    pp: 'found',    art: 'gleich', tier: 1 },
  { de: 'erzählen, sagen',  en: 'tell',    past: 'told',     pp: 'told',     art: 'gleich', tier: 1 },
  { de: 'denken',           en: 'think',   past: 'thought',  pp: 'thought',  art: 'gleich', tier: 1 },
  { de: 'kaufen',           en: 'buy',     past: 'bought',   pp: 'bought',   art: 'gleich', tier: 1 },
  { de: 'bringen',          en: 'bring',   past: 'brought',  pp: 'brought',  art: 'gleich', tier: 1 },
  { de: 'stehen',           en: 'stand',   past: 'stood',    pp: 'stood',    art: 'gleich', tier: 1 },
  { de: 'sitzen',           en: 'sit',     past: 'sat',      pp: 'sat',      art: 'gleich', tier: 1 },
  { de: 'halten',           en: 'hold',    past: 'held',     pp: 'held',     art: 'gleich', tier: 1 },
  { de: 'behalten',         en: 'keep',    past: 'kept',     pp: 'kept',     art: 'gleich', tier: 1 },
  { de: 'verlassen',        en: 'leave',   past: 'left',     pp: 'left',     art: 'gleich', tier: 1 },
  { de: 'fühlen',           en: 'feel',    past: 'felt',     pp: 'felt',     art: 'gleich', tier: 1 },
  { de: 'treffen',          en: 'meet',    past: 'met',      pp: 'met',      art: 'gleich', tier: 1 },
  { de: 'bezahlen',         en: 'pay',     past: 'paid',     pp: 'paid',     art: 'gleich', tier: 1 },
  { de: 'hören',            en: 'hear',    past: 'heard',    pp: 'heard',    art: 'gleich', tier: 1 },
  { de: 'lesen',            en: 'read',    past: 'read',     pp: 'read',     art: 'gleich', tier: 1, tricky: true },
  { de: 'verlieren',        en: 'lose',    past: 'lost',     pp: 'lost',     art: 'gleich', tier: 2 },
  { de: 'bedeuten',         en: 'mean',    past: 'meant',    pp: 'meant',    art: 'gleich', tier: 2 },
  { de: 'verkaufen',        en: 'sell',    past: 'sold',     pp: 'sold',     art: 'gleich', tier: 2 },
  { de: 'senden, schicken', en: 'send',    past: 'sent',     pp: 'sent',     art: 'gleich', tier: 2 },
  { de: 'ausgeben',         en: 'spend',   past: 'spent',    pp: 'spent',    art: 'gleich', tier: 2 },
  { de: 'bauen',            en: 'build',   past: 'built',    pp: 'built',    art: 'gleich', tier: 2 },
  { de: 'fangen',           en: 'catch',   past: 'caught',   pp: 'caught',   art: 'gleich', tier: 2 },
  { de: 'lehren',           en: 'teach',   past: 'taught',   pp: 'taught',   art: 'gleich', tier: 2 },
  { de: 'kämpfen',          en: 'fight',   past: 'fought',   pp: 'fought',   art: 'gleich', tier: 2 },
  { de: 'gewinnen',         en: 'win',     past: 'won',      pp: 'won',      art: 'gleich', tier: 2 },
  { de: 'schlafen',         en: 'sleep',   past: 'slept',    pp: 'slept',    art: 'gleich', tier: 2 },
  { de: 'verstehen',        en: 'understand', past: 'understood', pp: 'understood', art: 'gleich', tier: 2 },
  { de: 'führen',           en: 'lead',    past: 'led',      pp: 'led',      art: 'gleich', tier: 3, tricky: true },
  { de: 'leihen',           en: 'lend',    past: 'lent',     pp: 'lent',     art: 'gleich', tier: 2 },
  { de: 'füttern',          en: 'feed',    past: 'fed',      pp: 'fed',      art: 'gleich', tier: 3 },
  { de: 'legen',            en: 'lay',     past: 'laid',     pp: 'laid',     art: 'gleich', tier: 3 },
  { de: 'anzünden',         en: 'light',   past: 'lit',      pp: 'lit',      art: 'gleich', tier: 3 },
  { de: 'schießen',         en: 'shoot',   past: 'shot',     pp: 'shot',     art: 'gleich', tier: 3 },
  { de: 'hängen',           en: 'hang',    past: 'hung',     pp: 'hung',     art: 'gleich', tier: 3 },
  { de: 'graben',           en: 'dig',     past: 'dug',      pp: 'dug',      art: 'gleich', tier: 3 },
  { de: 'kleben, stecken',  en: 'stick',   past: 'stuck',    pp: 'stuck',    art: 'gleich', tier: 3 },
  { de: 'scheinen',         en: 'shine',   past: 'shone',    pp: 'shone',    art: 'gleich', tier: 3 },
  { de: 'biegen, beugen',   en: 'bend',    past: 'bent',     pp: 'bent',     art: 'gleich', tier: 3 },
  { de: 'umgehen, austeilen', en: 'deal',  past: 'dealt',    pp: 'dealt',    art: 'gleich', tier: 3 },
  { de: 'brennen',          en: 'burn',    past: 'burnt/burned',   pp: 'burnt/burned',   art: 'gleich', tier: 3 },
  { de: 'lernen',           en: 'learn',   past: 'learnt/learned', pp: 'learnt/learned', art: 'gleich', tier: 3 },
  { de: 'träumen',          en: 'dream',   past: 'dreamt/dreamed', pp: 'dreamt/dreamed', art: 'gleich', tier: 3 },
  { de: 'suchen',           en: 'seek',    past: 'sought',   pp: 'sought',   art: 'gleich', tier: 4 },
  { de: 'fegen',            en: 'sweep',   past: 'swept',    pp: 'swept',    art: 'gleich', tier: 4 },
  { de: 'binden',           en: 'bind',    past: 'bound',    pp: 'bound',    art: 'gleich', tier: 4 },
  { de: 'wickeln',          en: 'wind',    past: 'wound',    pp: 'wound',    art: 'gleich', tier: 4, tricky: true },
  { de: 'bluten',           en: 'bleed',   past: 'bled',     pp: 'bled',     art: 'gleich', tier: 4 },
  { de: 'fliehen',          en: 'flee',    past: 'fled',     pp: 'fled',     art: 'gleich', tier: 4 },
  { de: 'stechen',          en: 'sting',   past: 'stung',    pp: 'stung',    art: 'gleich', tier: 4 },
  { de: 'schwingen',        en: 'swing',   past: 'swung',    pp: 'swung',    art: 'gleich', tier: 4 },
  { de: 'schlagen',         en: 'strike',  past: 'struck',   pp: 'struck',   art: 'gleich', tier: 4 },
  { de: 'rutschen, gleiten', en: 'slide',  past: 'slid',     pp: 'slid',     art: 'gleich', tier: 4 },
  { de: 'riechen',          en: 'smell',   past: 'smelt/smelled', pp: 'smelt/smelled', art: 'gleich', tier: 4 },
  { de: 'buchstabieren',    en: 'spell',   past: 'spelt/spelled', pp: 'spelt/spelled', art: 'gleich', tier: 4 },
  { de: 'verschütten',      en: 'spill',   past: 'spilt/spilled', pp: 'spilt/spilled', art: 'gleich', tier: 4 },
  { de: 'verderben',        en: 'spoil',   past: 'spoilt/spoiled', pp: 'spoilt/spoiled', art: 'gleich', tier: 4 },
  { de: 'schleudern, werfen', en: 'fling', past: 'flung',    pp: 'flung',    art: 'gleich', tier: 4 },
  { de: 'mahlen',           en: 'grind',   past: 'ground',   pp: 'ground',   art: 'gleich', tier: 5 },
  { de: 'züchten',          en: 'breed',   past: 'bred',     pp: 'bred',     art: 'gleich', tier: 5 },
  { de: 'weinen',           en: 'weep',    past: 'wept',     pp: 'wept',     art: 'gleich', tier: 5 },
  { de: 'spinnen',          en: 'spin',    past: 'spun',     pp: 'spun',     art: 'gleich', tier: 5 },
  { de: 'rasen, eilen',     en: 'speed',   past: 'sped',     pp: 'sped',     art: 'gleich', tier: 5 },
  { de: 'kriechen',         en: 'creep',   past: 'crept',    pp: 'crept',    art: 'gleich', tier: 5 },
  { de: 'sich festklammern', en: 'cling',  past: 'clung',    pp: 'clung',    art: 'gleich', tier: 5 },
  { de: 'auswringen',       en: 'wring',   past: 'wrung',    pp: 'wrung',    art: 'gleich', tier: 5 },
  { de: 'wohnen, verweilen', en: 'dwell',  past: 'dwelt/dwelled', pp: 'dwelt/dwelled', art: 'gleich', tier: 5 },
  { de: 'knien',            en: 'kneel',   past: 'knelt/kneeled', pp: 'knelt/kneeled', art: 'gleich', tier: 5 },
  { de: 'sich lehnen',      en: 'lean',    past: 'leant/leaned',  pp: 'leant/leaned',  art: 'gleich', tier: 5 },
  { de: 'springen, hüpfen', en: 'leap',    past: 'leapt/leaped',  pp: 'leapt/leaped',  art: 'gleich', tier: 5 },
  { de: 'spucken, speien',  en: 'spit',    past: 'spat',     pp: 'spat',     art: 'gleich', tier: 5 },

  // ── i–a–u-Wandler (sing / sang / sung) ──────────────────────────────────
  { de: 'singen',           en: 'sing',    past: 'sang',     pp: 'sung',     art: 'iau', tier: 2 },
  { de: 'klingeln, läuten', en: 'ring',    past: 'rang',     pp: 'rung',     art: 'iau', tier: 2 },
  { de: 'trinken',          en: 'drink',   past: 'drank',    pp: 'drunk',    art: 'iau', tier: 2 },
  { de: 'schwimmen',        en: 'swim',    past: 'swam',     pp: 'swum',     art: 'iau', tier: 2 },
  { de: 'beginnen',         en: 'begin',   past: 'began',    pp: 'begun',    art: 'iau', tier: 2 },
  { de: 'sinken',           en: 'sink',    past: 'sank',     pp: 'sunk',     art: 'iau', tier: 4 },
  { de: 'springen',         en: 'spring',  past: 'sprang',   pp: 'sprung',   art: 'iau', tier: 4 },
  { de: 'schrumpfen',       en: 'shrink',  past: 'shrank',   pp: 'shrunk',   art: 'iau', tier: 5 },
  { de: 'stinken',          en: 'stink',   past: 'stank',    pp: 'stunk',    art: 'iau', tier: 5 },

  // ── -en-Verwandler (eigenes Partizip, oft auf -en/-n) ───────────────────
  { de: 'sehen',            en: 'see',     past: 'saw',      pp: 'seen',     art: 'en', tier: 1 },
  { de: 'essen',            en: 'eat',     past: 'ate',      pp: 'eaten',    art: 'en', tier: 1 },
  { de: 'geben',            en: 'give',    past: 'gave',     pp: 'given',    art: 'en', tier: 1 },
  { de: 'nehmen',           en: 'take',    past: 'took',     pp: 'taken',    art: 'en', tier: 1 },
  { de: 'wissen, kennen',   en: 'know',    past: 'knew',     pp: 'known',    art: 'en', tier: 1 },
  { de: 'schreiben',        en: 'write',   past: 'wrote',    pp: 'written',  art: 'en', tier: 2 },
  { de: 'sprechen',         en: 'speak',   past: 'spoke',    pp: 'spoken',   art: 'en', tier: 2 },
  { de: 'brechen',          en: 'break',   past: 'broke',    pp: 'broken',   art: 'en', tier: 2 },
  { de: 'fahren',           en: 'drive',   past: 'drove',    pp: 'driven',   art: 'en', tier: 2 },
  { de: 'wachsen',          en: 'grow',    past: 'grew',     pp: 'grown',    art: 'en', tier: 2 },
  { de: 'werfen',           en: 'throw',   past: 'threw',    pp: 'thrown',   art: 'en', tier: 2 },
  { de: 'fliegen',          en: 'fly',     past: 'flew',     pp: 'flown',    art: 'en', tier: 2 },
  { de: 'zeichnen, ziehen', en: 'draw',    past: 'drew',     pp: 'drawn',    art: 'en', tier: 2 },
  { de: 'fallen',           en: 'fall',    past: 'fell',     pp: 'fallen',   art: 'en', tier: 2 },
  { de: 'tragen (Kleidung)', en: 'wear',   past: 'wore',     pp: 'worn',     art: 'en', tier: 2 },
  { de: 'zeigen',           en: 'show',    past: 'showed',   pp: 'shown',    art: 'en', tier: 2 },
  { de: 'vergessen',        en: 'forget',  past: 'forgot',   pp: 'forgotten', art: 'en', tier: 2 },
  { de: 'wählen',           en: 'choose',  past: 'chose',    pp: 'chosen',   art: 'en', tier: 3 },
  { de: 'frieren',          en: 'freeze',  past: 'froze',    pp: 'frozen',   art: 'en', tier: 3 },
  { de: 'stehlen',          en: 'steal',   past: 'stole',    pp: 'stolen',   art: 'en', tier: 3 },
  { de: 'reiten, fahren',   en: 'ride',    past: 'rode',     pp: 'ridden',   art: 'en', tier: 3 },
  { de: 'aufsteigen',       en: 'rise',    past: 'rose',     pp: 'risen',    art: 'en', tier: 3 },
  { de: 'aufwachen',        en: 'wake',    past: 'woke',     pp: 'woken',    art: 'en', tier: 3 },
  { de: 'blasen, wehen',    en: 'blow',    past: 'blew',     pp: 'blown',    art: 'en', tier: 3 },
  { de: 'schütteln',        en: 'shake',   past: 'shook',    pp: 'shaken',   art: 'en', tier: 3 },
  { de: 'verstecken',       en: 'hide',    past: 'hid',      pp: 'hidden',   art: 'en', tier: 3 },
  { de: 'schlagen',         en: 'beat',    past: 'beat',     pp: 'beaten',   art: 'en', tier: 3 },
  { de: 'beißen',           en: 'bite',    past: 'bit',      pp: 'bitten',   art: 'en', tier: 4 },
  { de: 'vergeben',         en: 'forgive', past: 'forgave',  pp: 'forgiven', art: 'en', tier: 4 },
  { de: 'zerreißen',        en: 'tear',    past: 'tore',     pp: 'torn',     art: 'en', tier: 4 },
  { de: 'schwören',         en: 'swear',   past: 'swore',    pp: 'sworn',    art: 'en', tier: 4 },
  { de: 'liegen',           en: 'lie',     past: 'lay',      pp: 'lain',     art: 'en', tier: 4, tricky: true },
  { de: 'verwechseln',      en: 'mistake', past: 'mistook',  pp: 'mistaken', art: 'en', tier: 4 },
  { de: 'tragen, ertragen', en: 'bear',    past: 'bore',     pp: 'borne',    art: 'en', tier: 5 },
  { de: 'entstehen',        en: 'arise',   past: 'arose',    pp: 'arisen',   art: 'en', tier: 5 },
  { de: 'verbieten',        en: 'forbid',  past: 'forbade',  pp: 'forbidden', art: 'en', tier: 5 },
  { de: 'weben',            en: 'weave',   past: 'wove',     pp: 'woven',    art: 'en', tier: 5 },
  { de: 'treten, schreiten', en: 'tread',  past: 'trod',     pp: 'trodden',  art: 'en', tier: 5 },
  { de: 'anschwellen',      en: 'swell',   past: 'swelled',  pp: 'swollen',  art: 'en', tier: 5 },
  { de: 'nähen',            en: 'sew',     past: 'sewed',    pp: 'sewn',     art: 'en', tier: 5 },
  { de: 'säen',             en: 'sow',     past: 'sowed',    pp: 'sown',     art: 'en', tier: 5 },
  { de: 'mähen',            en: 'mow',     past: 'mowed',    pp: 'mown',     art: 'en', tier: 5 },

  // ── Faulpelze (keine Änderung) ──────────────────────────────────────────
  { de: 'schneiden',        en: 'cut',     past: 'cut',      pp: 'cut',      art: 'keine', tier: 1 },
  { de: 'setzen, legen',    en: 'put',     past: 'put',      pp: 'put',      art: 'keine', tier: 1 },
  { de: 'lassen',           en: 'let',     past: 'let',      pp: 'let',      art: 'keine', tier: 1 },
  { de: 'schlagen, treffen', en: 'hit',    past: 'hit',      pp: 'hit',      art: 'keine', tier: 2 },
  { de: 'schließen',        en: 'shut',    past: 'shut',     pp: 'shut',     art: 'keine', tier: 2 },
  { de: 'setzen, stellen',  en: 'set',     past: 'set',      pp: 'set',      art: 'keine', tier: 2 },
  { de: 'kosten',           en: 'cost',    past: 'cost',     pp: 'cost',     art: 'keine', tier: 2 },
  { de: 'verletzen, wehtun', en: 'hurt',   past: 'hurt',     pp: 'hurt',     art: 'keine', tier: 2 },
  { de: 'wetten',           en: 'bet',     past: 'bet',      pp: 'bet',      art: 'keine', tier: 4 },
  { de: 'platzen',          en: 'burst',   past: 'burst',    pp: 'burst',    art: 'keine', tier: 4 },
  { de: 'spalten, teilen',  en: 'split',   past: 'split',    pp: 'split',    art: 'keine', tier: 4 },
  { de: 'verbreiten',       en: 'spread',  past: 'spread',   pp: 'spread',   art: 'keine', tier: 4 },
  { de: 'aufhören',         en: 'quit',    past: 'quit',     pp: 'quit',     art: 'keine', tier: 4 },
  { de: 'werfen, gießen',   en: 'cast',    past: 'cast',     pp: 'cast',     art: 'keine', tier: 5 },
  { de: 'ausstrahlen, senden', en: 'broadcast', past: 'broadcast', pp: 'broadcast', art: 'keine', tier: 5 },
  { de: 'vorhersagen',      en: 'forecast', past: 'forecast', pp: 'forecast', art: 'keine', tier: 5 },
  { de: 'befreien (von)',   en: 'rid',     past: 'rid',      pp: 'rid',      art: 'keine', tier: 5 },
  { de: 'stoßen',           en: 'thrust',  past: 'thrust',   pp: 'thrust',   art: 'keine', tier: 5 },
  { de: 'abwerfen, vergießen', en: 'shed', past: 'shed',     pp: 'shed',     art: 'keine', tier: 5 },
];

// ── Sternbilder (Schwierigkeits-Gruppen) ────────────────────────────────────
// Statt Schulart/Klasse: die Verben werden nach Schwierigkeit (tier 1→5) geordnet
// und je Stufe in kleine, benannte Sternbilder à CONSTELLATION_SIZE Verben zerlegt.
// Reihenfolge der Liste = Spielreihenfolge (leicht → schwer), linear freigeschaltet.
const CONSTELLATION_SIZE = 6;
export const CONSTELLATION_NAMES = [
  'Kleiner Wagen', 'Großer Wagen', 'Kassiopeia', 'Orion', 'Schwan', 'Adler',
  'Leier', 'Stier', 'Zwillinge', 'Löwe', 'Krebs', 'Jungfrau', 'Skorpion',
  'Schütze', 'Pegasus', 'Andromeda', 'Perseus', 'Drache', 'Bootes', 'Widder',
  'Fische', 'Steinbock', 'Wassermann', 'Walfisch', 'Herkules', 'Delfin',
  'Pfeil', 'Luchs', 'Eidechse', 'Phönix', 'Greif', 'Pfau', 'Kranich', 'Tukan',
];

let _constellations = null;
// Geordnete Sternbild-Liste: pro tier eigene Chunks (kein Sternbild mischt Stufen).
export function getConstellations() {
  if (_constellations) return _constellations;
  const out = [];
  for (let t = 1; t <= 5; t++) {
    const verbs = IRREGULAR_VERBS.filter((v) => v.tier === t);
    for (let i = 0; i < verbs.length; i += CONSTELLATION_SIZE) {
      const idx = out.length;
      out.push({
        id: 'c' + idx, idx,
        name: CONSTELLATION_NAMES[idx] || ('Sternbild ' + (idx + 1)),
        tier: t, cefr: TIER_CEFR[t] || '',
        verbs: verbs.slice(i, i + CONSTELLATION_SIZE),
      });
    }
  }
  _constellations = out;
  return out;
}

// Verben einer Art (Muster-Familie) — für die Gestaltwandler-Sternbilder.
export function verbsByArt(art) {
  return IRREGULAR_VERBS.filter((v) => v.art === art);
}

// GER-Niveau eines Verbs als Text (A1 … C1).
export function cefrOf(verb) {
  return TIER_CEFR[verb.tier] || '—';
}

// ── Gestaltwandler-Anbindung (Phase 0) ──────────────────────────────────────
// Synthetische Preset-Kennung: die 150 Verben verhalten sich stat-/sync-seitig
// wie eine Vorlagen-Kategorie (Stats in SD.globalPresetStats), brauchen aber
// KEINE Supabase-Zeile — Datenquelle ist diese Datei. _presetId aktiviert das
// bestehende globalPresetStats-Routing in stats.js/game.js.
export const IRREGULAR_PRESET_ID = 'irregular-verbs';

// Datensatz-Verb → Vokabel-Modell mit optionalem forms-Feld (Spec §1).
// en bleibt der Infinitiv-Anker (gehen → go). forms trägt past/participle und
// reitet so im normalen Vokabel-/Spiegel-System mit. tier/art/tricky bleiben
// für spätere Phasen erhalten.
export function irregularAsVocab(v) {
  return {
    de: v.de,
    en: v.en,
    forms: { past: v.past, participle: v.pp },
    art: v.art,
    tier: v.tier,
    tricky: !!v.tricky,
    _presetId: IRREGULAR_PRESET_ID,
  };
}

// Komplettes Verb-Set als Vokabeln (für window.VOCAB der UV-Engine).
export function irregularVocabSet() {
  return IRREGULAR_VERBS.map(irregularAsVocab);
}

// ── MC-Distraktoren für Verbformen (Spec §3) ────────────────────────────────
// NICHT andere Wörter, sondern verlockend FALSCHE Formen: regelmäßig gebildet
// (goed, cutted), -en-übergeneralisiert (cutten) und die jeweils andere echte
// Form (für „gone" lockt „went"). Rein heuristisch — bewusst grob, weil es
// kindgerechte Fallen sein sollen, keine Linguistik.
function _firstAlt(s) { return (s || '').split('/')[0].trim(); }

function _regularize(inf) {
  inf = _firstAlt(inf).toLowerCase();
  if (!inf) return '';
  if (/e$/.test(inf)) return inf + 'd';                      // make → maked
  if (/[^aeiou]y$/.test(inf)) return inf.slice(0, -1) + 'ied'; // fly → flied
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(inf)) return inf + inf.slice(-1) + 'ed'; // cut → cutted
  return inf + 'ed';                                          // go → goed
}

function _enForm(inf) {
  inf = _firstAlt(inf).toLowerCase();
  if (!inf) return '';
  if (/e$/.test(inf)) return inf + 'n';                       // make → maken
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(inf)) return inf + inf.slice(-1) + 'en'; // cut → cutten
  return inf + 'en';                                          // go → goen
}

// Endkonsonant verdoppeln (für „verschluckte" Falschformen: burn → burnn).
function _double(inf) {
  inf = _firstAlt(inf).toLowerCase();
  const last = inf.slice(-1);
  return /[bcdfghjklmnpqrstvwxz]/.test(last) ? inf + last : inf;
}

// Genau drei plausibel-falsche Formen für eine Ziel-Form (which: 'past'|'pp').
// Reihenfolge = stärkste Verführung zuerst; die hinteren sind Fallbacks, damit
// auch /-Alternativ-Verben (burnt/burned) sicher 3 kollisionsfreie liefern.
export function formDistractors(verb, which) {
  const inf = verb.en;
  const target = which === 'past' ? verb.forms.past : verb.forms.participle;
  const other  = which === 'past' ? verb.forms.participle : verb.forms.past;
  const block = new Set((target || '').split('/').map(s => s.trim().toLowerCase()));
  const cands = [
    _regularize(inf),                 // go → goed
    _enForm(inf),                     // go → goen
    _firstAlt(other),                 // die andere echte Form als Verführung
    _firstAlt(inf),                   // der Infinitiv selbst
    _double(inf) + 'ed',              // burn → burnned
    _double(inf) + 'en',              // burn → burnnen
    _firstAlt(inf) + 'd',             // burn → burnd
    _firstAlt(inf) + 't',
    _firstAlt(inf) + 'ed',
  ];
  const out = [];
  for (const c of cands) {
    const cl = (c || '').toLowerCase();
    if (!cl || block.has(cl)) continue;
    if (out.some(o => o.toLowerCase() === cl)) continue;
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}
