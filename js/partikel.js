/* Orion Panel Pro — der Aufbau (Design-Schicht, 14.8.2026, spät)
 *
 * Wunsch des Auftraggebers: "die Website soll sich beim Laden aus kleinen
 * Teilchen zusammenstellen." Er schickte dazu eine React-Komponente
 * (ParticleText) — diese Website hat aber bewusst KEIN React und kein
 * Build-System, deshalb ist der Effekt hier nativ gebaut:
 *
 *   1. TITEL-PARTIKEL: der Schriftzug im Hero wird einmal auf eine
 *      unsichtbare Leinwand gemalt, in Teilchen zerlegt, verstreut und
 *      dann an seinen Platz gezogen. Danach verschwindet die Leinwand
 *      und der echte Titel steht da — kein Dauerbetrieb, ein Auftritt.
 *   2. AUFBAU-STAFFEL: Hero, Bereichs-Karten, Radar, Tafel und Kacheln
 *      treten beim ersten Laden nacheinander an (Versatz je Element).
 *      Was beim Start unter der Falz liegt, baut sich beim ERSTEN
 *      Hineinscrollen zusammen (IntersectionObserver).
 *
 * Alles loeschbar; Stufe 1 (SCHONUNG) und reduzierte Bewegung lassen den
 * kompletten Auftritt aus — dann steht die Seite einfach da.
 */
(function (welt) {
  'use strict';

  function stufe() {
    var h = document.documentElement.className;
    return h.indexOf('anim-1') !== -1 ? 1 : (h.indexOf('anim-2') !== -1 ? 2 : 3);
  }
  function bewegungOk() {
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------- 2. Aufbau-Staffel ---------- */
  function staffel() {
    var ziele = [];
    var kopf = document.querySelector('header.kopf');
    if (kopf) ziele.push(kopf);
    document.querySelectorAll('#bereichs-karten .bereichskarte').forEach(function (k) { ziele.push(k); });
    ['orion-puls', 'tafel', 'kacheln'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) ziele.push(el);
    });

    var beobachter = ('IntersectionObserver' in window)
      ? new IntersectionObserver(function (eintraege) {
          eintraege.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('bau-fertig'); beobachter.unobserve(e.target); }
          });
        }, { threshold: 0.15 })
      : null;

    /* PUZZLE (Vorgabe 14.8. nachts): die Bereichs-Karten kommen aus vier
     * Richtungen angeflogen und docken mit leichtem Ueberschwung an —
     * wie Teile, die sich zusammenfinden. */
    var puzzle = [[-110, -46, -7], [110, -52, 6], [-90, 64, 5], [95, 56, -6]];
    var pi = 0;
    ziele.forEach(function (el, i) {
      el.classList.add('bau');
      el.style.setProperty('--bau-i', String(i));
      if (el.classList.contains('bereichskarte') && puzzle[pi]) {
        var p = puzzle[pi++];
        el.style.setProperty('--bau-dx', p[0] + 'px');
        el.style.setProperty('--bau-dy', p[1] + 'px');
        el.style.setProperty('--bau-rot', p[2] + 'deg');
      }
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight || !beobachter) {
        /* Im Sichtfeld: gestaffelt antreten lassen. */
        setTimeout(function () { el.classList.add('bau-fertig'); }, 60 + i * 110);
      } else {
        /* Unter der Falz: erst beim ersten Hineinscrollen. */
        beobachter.observe(el);
      }
    });
  }

  /* ---------- 1. Titel-Partikel ---------- */
  function titelPartikel() {
    var h1 = document.querySelector('.hero-marke h1');
    if (!h1 || !('getContext' in document.createElement('canvas'))) return;
    var kasten = h1.getBoundingClientRect();
    if (kasten.width < 40) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var leinwand = document.createElement('canvas');
    leinwand.className = 'titel-partikel';
    /* Etwas Luft rundherum, damit verstreute Teilchen nicht abgeschnitten
     * werden. */
    var rand = 60;
    leinwand.style.left = (kasten.left - rand) + 'px';
    leinwand.style.top = (kasten.top - rand) + 'px';
    leinwand.style.width = (kasten.width + rand * 2) + 'px';
    leinwand.style.height = (kasten.height + rand * 2) + 'px';
    leinwand.width = Math.round((kasten.width + rand * 2) * dpr);
    leinwand.height = Math.round((kasten.height + rand * 2) * dpr);
    document.body.appendChild(leinwand);
    var stift = leinwand.getContext('2d');
    stift.scale(dpr, dpr);

    /* Den echten Titel abmalen, um die Zielpunkte zu bekommen. */
    var probe = document.createElement('canvas');
    probe.width = Math.round(kasten.width);
    probe.height = Math.round(kasten.height);
    var ps = probe.getContext('2d');
    var stil = getComputedStyle(h1);
    ps.font = stil.fontWeight + ' ' + parseFloat(stil.fontSize) + 'px ' + stil.fontFamily;
    ps.textBaseline = 'middle';
    /* letter-spacing kann canvas nicht — der Auftritt ist trotzdem klar
     * als der Schriftzug erkennbar, und am Ende steht ohnehin das echte
     * Element. */
    ps.fillStyle = '#fff';
    ps.fillText(h1.textContent, 0, probe.height / 2);
    var bild;
    try { bild = ps.getImageData(0, 0, probe.width, probe.height).data; }
    catch (e) { leinwand.remove(); return; }

    var teilchen = [];
    var schritt = 3;                       // jedes 3. Pixel wird ein Teilchen
    for (var y = 0; y < probe.height; y += schritt) {
      for (var x = 0; x < probe.width; x += schritt) {
        if (bild[(y * probe.width + x) * 4 + 3] > 128) {
          teilchen.push({
            zx: x + rand, zy: y + rand,
            x: rand + probe.width / 2 + (Math.random() - 0.5) * (probe.width + 260),
            y: rand + probe.height / 2 + (Math.random() - 0.5) * 340
          });
        }
      }
    }
    if (!teilchen.length) { leinwand.remove(); return; }

    h1.style.opacity = '0';
    var start = null, DAUER = 1350;
    function mal(t) {
      if (start === null) start = t;
      var u = Math.min(1, (t - start) / DAUER);
      var weich = 1 - Math.pow(1 - u, 3);           // ease-out
      stift.clearRect(0, 0, leinwand.width, leinwand.height);
      stift.fillStyle = 'rgba(228,230,222,0.95)';
      for (var i = 0; i < teilchen.length; i++) {
        var p = teilchen[i];
        stift.fillRect(p.x + (p.zx - p.x) * weich, p.y + (p.zy - p.y) * weich, 1.6, 1.6);
      }
      if (u < 1) { requestAnimationFrame(mal); return; }
      /* Fertig: echten Titel einblenden, Leinwand weich abbauen. */
      h1.style.transition = 'opacity .35s ease';
      h1.style.opacity = '1';
      leinwand.style.transition = 'opacity .45s ease';
      leinwand.style.opacity = '0';
      setTimeout(function () { leinwand.remove(); }, 500);
    }
    requestAnimationFrame(mal);
  }

  function start() {
    if (!bewegungOk() || stufe() === 1) return;      // Schonung: kein Auftritt
    staffel();
    /* Der Titel-Auftritt wartet, bis die Sperre weg ist (vorher ist der
     * Hero verdeckt und die Masse stimmen nicht). */
    var sperre = document.getElementById('sperre');
    var probiert = 0;
    var warter = setInterval(function () {
      probiert++;
      var offen = !sperre || getComputedStyle(sperre).display === 'none';
      if (offen) { clearInterval(warter); if (stufe() === 3) titelPartikel(); }
      if (probiert > 120) clearInterval(warter);     // 1 Minute, dann egal
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof globalThis !== 'undefined' ? globalThis : this);
