/* Orion Panel — Animationsstufen (aus buehne.js herausgeloest, 20.8.2026)
 *
 * WARUM DIESE DATEI: Am 20.8. hat der Auftraggeber die komplette Buehne
 * abgeschafft ("das Seitendesign viel schlichter, den Blödsinn löschen"):
 * Flanken samt Wacht, Jets, Raketen, das Kino und die Partikel sind aus
 * dem System entfernt. Die STUFEN aber sind keine Deko — sie drosseln
 * weiterhin Radar, LED, Avatar und die uebrigen kleinen Dauerlaeufer in
 * stil.css und schuetzen damit schwache Geraete. Deshalb leben sie hier
 * als eigenes Mini-Modul weiter, wortgleich zum alten Stand.
 *
 * Drei Stufen; die Stufe steht als Klasse am <html>-Element (anim-1/2/3),
 * die Drosselung passiert KOMPLETT in stil.css — hier wird nur geschaltet
 * und empfohlen. Der Scanner ist davon voellig unberuehrt.
 *
 *   1 SCHONUNG    — alles Dauerlaufende steht
 *   2 STANDARD    — Radar + LED + Avatar laufen, Bodengitter/Scan stehen
 *   3 VOLLES KINO — alles
 *
 * EMPFEHLUNG statt Bevormundung: aus Kernzahl und Speicher des Geraets
 * wird eine Stufe empfohlen und beim ersten Besuch gesetzt; danach gilt
 * der gespeicherte Wunsch. */
(function (welt) {
  'use strict';

  var ANIM_SCHLUESSEL = 'orion-anim';

  function animEmpfehlung() {
    var kerne = Number(navigator.hardwareConcurrency) || 4;
    var speicher = Number(navigator.deviceMemory) || 4;   // GB; Firefox kennt es nicht -> 4
    if (kerne >= 8 && speicher >= 8) return 3;
    if (kerne >= 4) return 2;
    return 1;
  }

  function animStufe() {
    var s = Number(localStorage.getItem(ANIM_SCHLUESSEL));
    return (s === 1 || s === 2 || s === 3) ? s : animEmpfehlung();
  }

  function animSetzen(stufe) {
    var wurzel = document.documentElement;
    wurzel.classList.remove('anim-1', 'anim-2', 'anim-3');
    wurzel.classList.add('anim-' + stufe);
    /* KURZE Woerter — die langen ragten aus dem Knopf (Rueckmeldung 14.8.). */
    var NAMEN = { 1: 'SCHONUNG', 2: 'STANDARD', 3: 'KINO' };
    var t = document.getElementById('anim-text');
    var k = document.getElementById('anim-klein');
    if (t) t.textContent = 'Stufe ' + stufe + ' · ' + NAMEN[stufe];
    if (k) {
      var e = animEmpfehlung();
      k.textContent = (stufe === e ? '✓ Empfehlung für dieses Gerät'
                                   : 'Empfehlung: Stufe ' + e);
    }
  }

  function animStart() {
    animSetzen(animStufe());
    var knopf = document.getElementById('anim-knopf');
    if (knopf) knopf.addEventListener('click', function () {
      var neu = animStufe() % 3 + 1;
      localStorage.setItem(ANIM_SCHLUESSEL, String(neu));
      animSetzen(neu);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', animStart);
  else animStart();

  welt.Anim = { stufe: animStufe };

})(typeof globalThis !== 'undefined' ? globalThis : this);
