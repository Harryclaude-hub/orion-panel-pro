/* Orion Panel Pro — die Hintergrund-Ambiente (Design-Schicht, 15.8.2026)
 *
 * Kein Gesang, keine fremde Musik (Urheberrecht!) — ein selbst
 * SYNTHETISIERTER Gefechtsstand-Teppich aus WebAudio: zwei tiefe, leicht
 * verstimmte Droehnen, ein tiefpass-gefilterter Rauschteppich (das
 * "Maschinenraum"-Gefuehl), alle ~9 s ein leiser Sonar-Ping, alle ~27 s
 * ein fernes Grollen. Endlos, ohne Datei, ohne Netz.
 *
 * AN/AUS: RECHTSKLICK auf den Ton-Knopf (der Linksklick schaltet wie
 * gehabt die Funksprueche). Standard: AUS — Dauerton muss man wollen.
 * Eigene Datei, loeschbar; haengt an keiner Logik.
 */
(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-musik';
  var ctx = null, master = null, teile = [], wecker = [], laeuft = false;

  /* Gewollt ist die Ambiente nur, wenn ihr eigener Schalter AN ist UND
   * der Haupt-Ton nicht aus — Ton AUS heisst Funkstille, komplett. */
  function an() {
    return localStorage.getItem(SCHLUESSEL) === 'an' &&
           localStorage.getItem('orion-ton') !== 'aus';
  }

  function start() {
    if (laeuft || !an()) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    laeuft = true;

    master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);  // weich rein
    master.connect(ctx.destination);

    /* Zwei tiefe Droehnen, leicht gegeneinander verstimmt (Schwebung). */
    [55, 55.6].forEach(function (hz) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.value = 0.028;
      o.connect(g); g.connect(master);
      o.start(); teile.push(o);
    });

    /* Maschinenraum: braunes Rauschen durch einen Tiefpass, als Schleife. */
    var puffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    var d = puffer.getChannelData(0), b = 0;
    for (var i = 0; i < d.length; i++) {
      b = (b + (Math.random() * 2 - 1) * 0.02) * 0.985;
      d[i] = b * 3;
    }
    var n = ctx.createBufferSource();
    n.buffer = puffer; n.loop = true;
    var tp = ctx.createBiquadFilter(); tp.type = 'lowpass'; tp.frequency.value = 150;
    var ng = ctx.createGain(); ng.gain.value = 0.5;
    n.connect(tp); tp.connect(ng); ng.connect(master);
    n.start(); teile.push(n);

    wecker.push(setInterval(ping, 9000));
    wecker.push(setInterval(grollen, 27000));
  }

  function ping() {
    if (!laeuft) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 740;
    g.gain.setValueAtTime(0.03, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + 1.5);
  }

  function grollen() {
    if (!laeuft) return;
    var puffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = puffer.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var n = ctx.createBufferSource(); n.buffer = puffer;
    var tp = ctx.createBiquadFilter(); tp.type = 'lowpass'; tp.frequency.value = 85;
    var g = ctx.createGain(); g.gain.value = 0.10;
    n.connect(tp); tp.connect(g); g.connect(master);
    n.start();
  }

  function stopp() {
    laeuft = false;
    wecker.forEach(clearInterval); wecker = [];
    if (master) {
      /* weich raus, dann kappen */
      try {
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        var alteTeile = teile, altesMaster = master;
        setTimeout(function () {
          alteTeile.forEach(function (t) { try { t.stop(); } catch (e) {} });
          try { altesMaster.disconnect(); } catch (e) {}
          /* Kontext schlafen legen: danach kann NICHTS mehr toenen. */
          try { if (ctx && !laeuft) ctx.suspend(); } catch (e) {}
        }, 900);
      } catch (e) {}
    }
    teile = []; master = null;
  }

  function beschrifte() {
    var k = document.getElementById('ton-klein');
    if (k) k.textContent = 'Rechtsklick: Ambiente ' + (an() ? 'AN' : 'AUS');
  }

  function startWennErlaubt() {
    if (an()) start();
    beschrifte();
  }

  function anhaengen() {
    /* EINMALIGE harte Zuruecksetzung (15.8., zweite Runde des
     * Ton-geht-nicht-aus-Problems): wer noch ein altes "an" im
     * Speicher hat, startet ab jetzt mit Ambiente AUS. */
    if (!localStorage.getItem('orion-musik-r1')) {
      localStorage.setItem('orion-musik', 'aus');
      localStorage.setItem('orion-musik-r1', '1');
    }
    /* Tab weg (verdeckt, gewechselt, geschlossen) -> sofortige Stille;
     * kommt er zurueck und die Ambiente ist gewollt, faehrt sie wieder
     * hoch. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopp(); else if (an()) start();
    });
    window.addEventListener('pagehide', stopp);
    var knopf = document.getElementById('ton-knopf');
    if (!knopf) return;
    knopf.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      localStorage.setItem(SCHLUESSEL, an() ? 'aus' : 'an');
      if (an()) start(); else stopp();
      beschrifte();
    });
    /* Browser-Regel: Ton erst nach einer Geste — die erste Beruehrung
     * startet die Ambiente, falls sie gewollt ist. */
    document.addEventListener('pointerdown', startWennErlaubt, { once: true });
    beschrifte();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anhaengen);
  else anhaengen();

  welt.Musik = { start: start, stopp: stopp };

})(typeof globalThis !== 'undefined' ? globalThis : this);
