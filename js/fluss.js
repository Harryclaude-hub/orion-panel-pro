/* ══════════════════════════════════════════════════════════════════════
   fluss.js — 28.08.2026
   ══════════════════════════════════════════════════════════════════════
   Misst, ob die Seite fluessig laeuft, und drosselt die Animationsstufe,
   wenn sie es nicht tut.

   ANLASS, Karams Wort: "sie ist seit dieser Woche nicht fluessig genug."

   WAS GEMESSEN WURDE (28.8.):
     - Alle sechs Orion-Programme zusammen: 15,9 % EINES Kerns, also
       2 % der ganzen CPU. Der Notbetrieb ist NICHT die Ursache.
     - Der Browser dagegen: ueber 140 % eines Kerns auf drei Prozesse.
       Die Seite selbst ist das Schwere.
     - Die Animationsstufe stand auf 3 ("VOLLES KINO"), der hoechsten.

   WARUM STUFE 3 GESETZT WAR: anim.js empfiehlt sie ab 8 logischen Kernen
   und 8 GB. Karams Laptop hat genau 8 logische Kerne — meist sind das
   4 physische mit Hyperthreading. Die Empfehlung ist also zu
   optimistisch, und sie wurde einmal berechnet, als der Laptop noch
   nichts anderes zu tun hatte. Seit dem 26.8. traegt er zusaetzlich die
   ganze Last, die vorher Supabase getragen hat.

   WARUM MESSEN STATT DIE EMPFEHLUNG UMSCHREIBEN: eine Kernzahl sagt
   nichts darueber, was auf dem Geraet sonst noch laeuft. Die Bildrate
   sagt es. Erst messen, dann behaupten.

   WAS SIE TUT
     - zaehlt Bilder ueber Fenster von 4 Sekunden, nur bei sichtbarer Seite
     - zwei schlechte Fenster hintereinander  ->  eine Stufe herunter
     - nie unter Stufe 1, und sie schaltet NIE wieder hoch (sonst pendelt
       es zwischen zwei Stufen und wird selbst zur Unruhe)
     - sie sagt es. Karams Animations-Warnregel: bei Uebertreibung IMMER
       warnen, nicht heimlich drosseln.

   WAS SIE NIE TUT
     - Karams eigene Wahl ueberschreiben. Hat er den Animationsknopf
       einmal benutzt, steht 'orion-anim' im Speicher und diese Datei
       haelt sich komplett heraus.
     - irgendetwas an Zahlen, Rechnung, Takt oder Scanner anfassen. Sie
       setzt eine Klasse am <html>-Element, mehr nicht.

   LOESCHBAR. Faellt diese Datei weg, gilt wieder die Empfehlung aus
   anim.js, und alles laeuft wie vorher.
   ══════════════════════════════════════════════════════════════════════ */

(function (welt) {
  'use strict';

  var EIGENE_WAHL = 'orion-anim';        /* setzt der Animationsknopf */
  var GEDROSSELT  = 'orion-anim-fluss';  /* setzt nur diese Datei */

  /* Unter dieser Bildrate gilt eine Seite als zaeh. 60 ist das Ziel,
   * unter 45 wird Scrollen sichtbar ruckelig. Bewusst konservativ: ein
   * Fehlalarm nimmt Karam Anzeige weg, die er haben will. */
  var GRENZE = 45;
  var FENSTER_MS = 4000;
  var SCHLECHT_NOETIG = 2;   /* zwei Fenster hintereinander */

  function lies(name) {
    try { return welt.localStorage.getItem(name); } catch (e) { return null; }
  }
  function schreib(name, wert) {
    try { welt.localStorage.setItem(name, wert); } catch (e) { /* privater Modus */ }
  }

  function stufeJetzt() {
    var k = document.documentElement.className.match(/anim-([123])/);
    return k ? Number(k[1]) : 3;
  }

  function stufeSetzen(stufe) {
    var w = document.documentElement;
    w.classList.remove('anim-1', 'anim-2', 'anim-3');
    w.classList.add('anim-' + stufe);
    /* Die Knopfbeschriftung mitziehen, sonst behauptet der Knopf eine
     * Stufe, die nicht mehr gilt. Genau die Art Doppelwahrheit, die in
     * diesem Projekt schon Zeit gekostet hat. */
    var NAMEN = { 1: 'SCHONUNG', 2: 'STANDARD', 3: 'KINO' };
    var t = document.getElementById('anim-text');
    if (t) t.textContent = 'Stufe ' + stufe + ' · ' + NAMEN[stufe];
  }

  /* Der Hinweis. Er verschwindet von selbst und laesst sich wegklicken.
   * Kein Fenster, kein Ton — die Seite soll ruhiger werden, nicht lauter. */
  function sagen(alt, neu, bildrate) {
    var d = document.createElement('div');
    d.className = 'fluss-hinweis';
    d.setAttribute('role', 'status');
    d.innerHTML =
      '<b>Animation von Stufe ' + alt + ' auf ' + neu + ' gedrosselt.</b><br>' +
      'Gemessen: ' + bildrate + ' Bilder pro Sekunde, zu wenig für flüssiges Scrollen. ' +
      'Über den Animationsknopf stellst du es jederzeit selbst ein — deine Wahl gilt dann dauerhaft.';
    document.body.appendChild(d);
    d.addEventListener('click', function () { d.remove(); });
    welt.setTimeout(function () { if (d.parentNode) d.remove(); }, 15000);
  }

  function start() {
    /* Hat Karam selbst gewaehlt? Dann ist hier nichts zu tun. */
    var s = Number(lies(EIGENE_WAHL));
    if (s === 1 || s === 2 || s === 3) return;

    /* Frueher schon einmal gedrosselt? Dann gleich wieder so anfangen,
     * statt jedes Mal erst acht Sekunden lang zu ruckeln. */
    var g = Number(lies(GEDROSSELT));
    if (g === 1 || g === 2) {
      if (g < stufeJetzt()) stufeSetzen(g);
    }

    if (!welt.requestAnimationFrame) return;

    var bilder = 0;
    var beginn = 0;
    var schlecht = 0;

    function tick(jetzt) {
      welt.requestAnimationFrame(tick);

      /* Versteckte Tabs drosseln requestAnimationFrame von sich aus. Da
       * zu messen hiesse, die Drosselung des Browsers fuer Ruckeln zu
       * halten — der Messfehler, in den ich beim Bauen selbst gelaufen
       * bin (der Browser-Pane war versteckt, die Messung lief ins Leere). */
      if (document.hidden) { bilder = 0; beginn = jetzt; return; }

      if (!beginn) { beginn = jetzt; return; }
      bilder++;
      var dauer = jetzt - beginn;
      if (dauer < FENSTER_MS) return;

      var rate = Math.round(bilder / (dauer / 1000));
      bilder = 0;
      beginn = jetzt;

      var stufe = stufeJetzt();
      if (rate >= GRENZE || stufe <= 1) { schlecht = 0; return; }

      schlecht++;
      if (schlecht < SCHLECHT_NOETIG) return;

      schlecht = 0;
      var neu = stufe - 1;
      stufeSetzen(neu);
      schreib(GEDROSSELT, String(neu));
      sagen(stufe, neu, rate);
    }

    welt.requestAnimationFrame(tick);
    welt.Fluss = { grenze: GRENZE, stufe: stufeJetzt };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof globalThis !== 'undefined' ? globalThis : this);
