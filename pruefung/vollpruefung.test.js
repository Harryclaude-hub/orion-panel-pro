/* Prueft, ob die Vollpruefung das RICHTIGE tut.
 *
 * Abgrenzung zum Spiegeltest: spiegel.test.js beweist, dass Browser- und
 * Server-Fassung sich GLEICH verhalten. Er beweist nicht, dass sie RICHTIG
 * liegen -- zwei gleich falsche Fassungen bestehen ihn anstandslos. Dieser
 * Test hier ist die andere Haelfte: jede Huerde bekommt einen Fall, der
 * durchgehen MUSS, und einen, der scheitern MUSS.
 *
 * Jeder Sperrfall unten ist ein echter Schaden aus dem Betrieb, kein
 * ausgedachter. Wer eine Huerde lockert, sieht hier sofort, was er
 * wieder aufmacht.
 *
 *   node pruefung/vollpruefung.test.js
 */
const Z = require('../js/zuordnung.js');

const GRUND = { partie: ['palermo', 'juventus'], zeit: 1000, liga: null, bereich: null };
const mit = x => Object.assign({}, GRUND, x);

const FAELLE = [
  /* [Name, A, B, soll durchgehen] */
  ['echtes Paar geht durch',                  GRUND, mit({}), true],
  ['Heim/Gast vertauscht geht durch',         mit({ partie: ['palermo', 'juventus'] }),
                                              mit({ partie: ['juventus', 'palermo'] }), true],

  /* Huerde 1 BEREICH -- gemessen 11.8.2026, Fehlpaarung mit 5,34 %:
   * "Eintracht Frankfurt" gibt es im Fussball UND in League of Legends. */
  ['andere Sportart gesperrt',                mit({ bereich: 'fussball' }), mit({ bereich: 'lol' }), false],
  ['gleiche Sportart geht durch',             mit({ bereich: 'fussball' }), mit({ bereich: 'fussball' }), true],
  ['Sportart nur auf einer Seite bekannt',    mit({ bereich: 'fussball' }), mit({ bereich: null }), true],

  /* Huerde 2 KENNUNG -- gemessen 18.8.2026: rund 100 Euro auf ein Spiel
   * gesetzt, bei dem eine Seite die Profimannschaft und die andere die
   * U21 desselben Vereins war. Namen zu 100 % gleich. */
  ['U21 gegen Profi gesperrt',                mit({ partie: ['pachuca', 'puebla'] }),
                                              mit({ partie: ['pachuca u21', 'puebla u21'] }), false],
  ['U21 gegen U21 geht durch',                mit({ partie: ['pachuca u21', 'puebla u21'] }),
                                              mit({ partie: ['pachuca u21', 'puebla u21'] }), true],
  ['Frauen gegen Maenner gesperrt',           mit({ partie: ['arsenal women', 'chelsea women'] }),
                                              mit({ partie: ['arsenal', 'chelsea'] }), false],
  ['Reserve gegen Profi gesperrt',            mit({ partie: ['real madrid b', 'barcelona b'] }),
                                              mit({ partie: ['real madrid', 'barcelona'] }), false],

  /* Huerde 3 LIGA -- die Liga traegt die Kennung oft allein: bei Betfair
   * stand "Sunderland U21 v PSV Eindhoven U21" in "Other Competitions
   * Soccer", und "NS Mura U19" in "Slovenian U19". */
  ['Jugendliga gegen Profiliga gesperrt',     mit({ liga: 'Serie A' }), mit({ liga: 'Primavera U19' }), false],
  ['zwei Profiligen gehen durch',             mit({ liga: 'Serie A' }), mit({ liga: 'Copa Italia' }), true],
  ['zwei Jugendligen gehen durch',            mit({ liga: 'Slovenian U19' }), mit({ liga: 'Other Competitions U19' }), true],

  /* Huerde 4 ZEIT -- bis 19.8. galt "ungemessen ist nicht falsch", eine
   * FEHLENDE Zeit liess durch. Das war das offene Tor. */
  ['Anpfiff fehlt links -> gesperrt',         mit({ zeit: null }), mit({}), false],
  ['Anpfiff fehlt rechts -> gesperrt',        mit({}), mit({ zeit: null }), false],
  ['Anpfiff fehlt beidseitig -> gesperrt',    mit({ zeit: null }), mit({ zeit: null }), false],
  ['Rueckspiel 4 Tage spaeter gesperrt',      mit({ zeit: 0 }), mit({ zeit: 4 * 24 * 3600000 }), false],
  ['genau 180 min noch erlaubt',              mit({ zeit: 0 }), mit({ zeit: 180 * 60000 }), true],
  ['181 min gesperrt',                        mit({ zeit: 0 }), mit({ zeit: 180 * 60000 + 1 }), false],
  ['Zeit als Text statt Zahl',                mit({ zeit: '2026-08-19T10:00:00Z' }),
                                              mit({ zeit: '2026-08-19T10:00:00Z' }), true],

  /* Huerde 6 BEIDE Teams -- eine Mannschaft zu treffen genuegt nie. */
  ['nur EIN Team gleich gesperrt',            mit({ partie: ['palermo', 'juventus'] }),
                                              mit({ partie: ['palermo', 'inter mailand'] }), false],

  /* Huerde 5+7 -- gemessen 9.8.2026: 663 Scheinchancen bis 184 %, weil
   * "CSD Municipal" vollstaendig im laengeren Namen steckte. Der lange
   * Name enthaelt BEIDE Vereine, also passt jeder zu jeder Seite. */
  ['CSD-Municipal-Fall gesperrt',             mit({ partie: ['csd municipal', 'csd coban imperial'] }),
                                              mit({ partie: ['csd municipal 1 3 csd coban imperial', 'csd coban imperial'] }), false],
  /* Gegenprobe zur Trennschaerfe: derselbe Verein unter zwei Namen
   * (Shanghai Haigang = Shanghai Port) behaelt Abstand und bleibt drin.
   * Ohne diesen Fall waere die Versuchung gross, Huerde 5 hochzudrehen
   * und dabei echte Paare zu verlieren. */
  ['Shanghai Haigang = Port bleibt drin',     mit({ partie: ['shanghai haigang fc', 'dalian yingbo fc'] }),
                                              mit({ partie: ['shanghai port fc', 'dalian yingbo'] }), true],

  /* Randfaelle: nichts darf werfen. */
  ['A ist null',                              null, mit({}), false],
  ['B ist null',                              mit({}), null, false],
  ['Partie fehlt',                            mit({ partie: null }), mit({}), false]
];

let gut = 0, schlecht = 0;
for (const [name, A, B, soll] of FAELLE) {
  let r;
  try { r = Z.pruefeSpiel(A, B, 0.5); }
  catch (e) { r = { ok: null, grund: 'WIRFT: ' + e.message }; }
  const ok = r.ok === soll;
  if (ok) gut++; else schlecht++;
  if (!ok || process.env.LAUT) {
    console.log((ok ? '  ok     ' : '  FEHLER ') + name.padEnd(38) +
                (r.ok ? 'durch' : 'gesperrt') + (r.grund ? '  -> ' + r.grund : ''));
  }
}

/* Die Nachsicht-Schalter darf es geben, aber nur ausdruecklich. */
const nachsicht = Z.pruefeSpiel(mit({ zeit: null }), mit({}), 0.5, { zeitPflicht: false });
if (nachsicht.ok) gut++; else { schlecht++; console.log('  FEHLER zeitPflicht:false wirkt nicht'); }

console.log('');
console.log('Vollpruefung: ' + gut + ' von ' + (gut + schlecht) + ' Faellen richtig');
if (schlecht) { console.log('FEHLGESCHLAGEN'); process.exit(1); }
console.log('Alle sieben Huerden greifen wie gemessen');
