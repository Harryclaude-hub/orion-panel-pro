/* ══════════════════════════════════════════════════════════════════════
   ruhe.js — 15.08.2026
   ══════════════════════════════════════════════════════════════════════
   Haelt Zier-Animationen an, solange sie NICHT im Bild sind.

   Warum das der groesste Hebel ist (gemessen 15.8. auf Stufe 3):
   69 Animationen laufen gleichzeitig, darunter eine ganze Staffel aus
   Jets, Panzern, Booten und Radarschirmen. Die laufen auch dann weiter,
   wenn sie zehn Bildschirmhoehen ueber dem sichtbaren Bereich stehen.
   Beim Scrollen muss der Browser sie trotzdem alle mitfuehren.

   Diese Datei aendert NICHTS am Aussehen und nichts an den Daten. Sie
   setzt nur die Klasse "ausser-sicht", css/hud.css haelt darin die
   Animationen an (animation-play-state: paused). Faellt die Datei weg,
   laeuft wieder alles wie vorher.

   WICHTIG: was einen ZUSTAND anzeigt, wird nie angehalten. Der Puls
   sagt "der Scanner laeuft" — ein angehaltener Puls waere eine
   Falschaussage. Deshalb steht #orion-puls auf der Ausnahmeliste.
   ══════════════════════════════════════════════════════════════════════ */

(function (welt) {
  'use strict';

  /* Nur Zierbereiche. Alles, was Zustand meldet, fehlt hier absichtlich. */
  var BEREICHE = [
    '.hero-lage',
    '#zeitstatistik',
    '#bereichs-band',
    '.gefecht', '.szene', '.staffel', '.buehne'
  ];

  /* Diese bleiben IMMER in Bewegung, auch ausserhalb des Bildes. */
  var NIEMALS = ['#orion-puls', '.puls'];

  function start() {
    if (!('IntersectionObserver' in welt)) return;   /* alter Browser: alles bleibt wie es war */

    var knoten = [];
    BEREICHE.forEach(function (w) {
      [].forEach.call(document.querySelectorAll(w), function (e) {
        if (NIEMALS.some(function (n) { return e.matches(n) || e.closest(n); })) return;
        if (knoten.indexOf(e) === -1) knoten.push(e);
      });
    });
    if (!knoten.length) return;

    var waechter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (ein) {
        ein.target.classList.toggle('ausser-sicht', !ein.isIntersecting);
      });
    }, { rootMargin: '120px 0px' });   /* etwas Vorlauf, damit nichts sichtbar anspringt */

    knoten.forEach(function (e) { waechter.observe(e); });

    /* Liegt das Fenster im Hintergrund, ruht alles. Ein Browser-Tab, den
     * niemand ansieht, muss keine Panzer fahren lassen. */
    document.addEventListener('visibilitychange', function () {
      document.documentElement.classList.toggle('seite-ruht', document.hidden);
    });

    welt.Ruhe = { knoten: knoten.length };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(window);
