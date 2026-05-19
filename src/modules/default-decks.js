// src/modules/default-decks.js
// Starter-Vokabelsammlungen für neue Nutzer

export const DEFAULT_DECKS = [
  {
    id: 'deck_tiere',
    name: 'Tiere',
    vocab: [
      {de:'Hund',en:'dog'},{de:'Katze',en:'cat'},{de:'Maus',en:'mouse'},
      {de:'Pferd',en:'horse'},{de:'Kuh',en:'cow'},{de:'Schwein',en:'pig'},
      {de:'Vogel',en:'bird'},{de:'Fisch',en:'fish'},{de:'Hase',en:'rabbit'},
      {de:'Bär',en:'bear'},
    ],
  },
  {
    id: 'deck_farben',
    name: 'Farben',
    vocab: [
      {de:'rot',en:'red'},{de:'blau',en:'blue'},{de:'grün',en:'green'},
      {de:'gelb',en:'yellow'},{de:'schwarz',en:'black'},{de:'weiß',en:'white'},
      {de:'orange',en:'orange'},{de:'rosa',en:'pink'},{de:'lila',en:'purple'},
      {de:'braun',en:'brown'},
    ],
  },
  {
    id: 'deck_zahlen',
    name: 'Zahlen 1-10',
    vocab: [
      {de:'eins',en:'one'},{de:'zwei',en:'two'},{de:'drei',en:'three'},
      {de:'vier',en:'four'},{de:'fünf',en:'five'},{de:'sechs',en:'six'},
      {de:'sieben',en:'seven'},{de:'acht',en:'eight'},{de:'neun',en:'nine'},
      {de:'zehn',en:'ten'},
    ],
  },
];
