/* ══════════════════════════════════════════════════════════════════════
   zeitstatistik.js — 15.08.2026
   ══════════════════════════════════════════════════════════════════════
   Der Fundverlauf ueber die Zeit, mit Zeitfilter.

   WAS DIESE DATEI NICHT TUT:
   - Sie rechnet KEINE Rendite und keine Einsaetze. Sie zaehlt nur, was
     die Datenbank schon abgelegt hat.
   - Sie beruehrt keine Schwelle. Die 2-%-Marke kommt aus der SQL-
     Funktion orion_zeitstatistik und ist dieselbe wie ueberall.

   LASTREGEL (wichtig — diese Supabase-Instanz ist klein und ist am
   13.8. zweimal umgefallen): der Hauptakt liest alle 2 Sekunden. Diese
   Statistik liest NUR alle 60 Sekunden, und ausserdem sofort bei einem
   Filterwechsel. Ein Abruf ist EIN Aufruf einer serverseitigen
   Funktion, nicht das Ziehen aller Zeilen.

   ZUR ZEITRECHNUNG: die Toepfe sind auf volle Einheiten gerundet
   (date_bin). Der erste Topf reicht deshalb etwas vor das Fenster
   zurueck — bei 24 h waren das in der Messung vom 15.8. zwei Zeilen
   mehr als die exakte Stundenzaehlung. Das ist fuer ein Balkenbild
   richtig so: gezeigt werden ganze Stunden, und die Summe unter dem
   Bild ist die Summe der gezeigten Balken.
   ══════════════════════════════════════════════════════════════════════ */

(function (welt) {
  'use strict';

  var K = welt.KONFIG;
  var LESE_ABSTAND_MS = 60000;

  var fenster = '24h';
  var letzteLese = 0;
  var laeuft = false;

  var STUFEN = [
    { id: '1h',    name: '1 Stunde',   topf: '5 min' },
    { id: '24h',   name: '24 Stunden', topf: 'Stunde' },
    { id: '7t',    name: '7 Tage',     topf: '6 Stunden' },
    { id: 'alles', name: 'Alles',      topf: 'Tag' }
  ];

  function hole(f) {
    return fetch(K.supabase + '/rest/v1/rpc/orion_zeitstatistik', {
      method: 'POST',
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key,
                 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ fenster: f })
    }).then(function (r) {
      if (!r.ok) throw new Error('Zeitstatistik HTTP ' + r.status);
      return r.json();
    });
  }

  function txt(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Beschriftung eines Topfes, passend zur Weite des Fensters. */
  function topfName(iso, f) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var zwei = function (n) { return (n < 10 ? '0' : '') + n; };
    if (f === '1h')  return zwei(d.getHours()) + ':' + zwei(d.getMinutes());
    if (f === '24h') return zwei(d.getHours()) + ':00';
    if (f === '7t')  return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + ' ' + zwei(d.getHours()) + 'h';
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.';
  }

  function zeichnen(reihen) {
    var bild = document.getElementById('zstat-bild');
    var zahlen = document.getElementById('zstat-zahlen');
    if (!bild) return;

    if (!reihen || !reihen.length) {
      bild.innerHTML = '<div class="zstat-leer">Für diesen Zeitraum liegt nichts vor.</div>';
      if (zahlen) zahlen.innerHTML = '';
      return;
    }

    var hoechster = reihen.reduce(function (m, r) { return Math.max(m, r.gesamt || 0); }, 0);
    var summe   = reihen.reduce(function (s, r) { return s + (r.gesamt || 0); }, 0);
    var ueber   = reihen.reduce(function (s, r) { return s + (r.ueber_marke || 0); }, 0);
    var richtig = reihen.reduce(function (s, r) { return s + (r.richtig || 0); }, 0);
    var falsch  = reihen.reduce(function (s, r) { return s + (r.falsch || 0); }, 0);

    /* Die Balken. Jeder Balken traegt zwei Teile: der helle Sockel ist
     * alles, der satte Kopf ist der Anteil ueber der Marke. So sieht man
     * auf einen Blick, ob viel Rauschen oder viel Substanz da war. */
    bild.innerHTML = '<div class="zstat-balken">' + reihen.map(function (r, i) {
      var g = r.gesamt || 0, u = r.ueber_marke || 0;
      var hoehe = hoechster > 0 ? Math.round(g / hoechster * 100) : 0;
      var anteil = g > 0 ? Math.round(u / g * 100) : 0;
      var titel = topfName(r.topf, fenster) + ' · ' + g + ' Funde' +
                  (u ? ', davon ' + u + ' über der Marke' : '');
      return '<div class="zstat-saeule" style="--i:' + i + '" title="' + txt(titel) + '">' +
               '<span class="zstat-stab" style="height:' + Math.max(hoehe, g > 0 ? 3 : 0) + '%">' +
                 '<i style="height:' + anteil + '%"></i>' +
               '</span>' +
               '<b class="zstat-marke">' + txt(topfName(r.topf, fenster)) + '</b>' +
             '</div>';
    }).join('') + '</div>';

    if (zahlen) {
      var stufe = STUFEN.filter(function (s) { return s.id === fenster; })[0] || STUFEN[1];
      zahlen.innerHTML =
        feld('Funde gesamt', summe, '') +
        feld('über 2 %', ueber, summe ? Math.round(ueber / summe * 100) + ' % davon' : '') +
        feld('geprüft richtig', richtig, '') +
        feld('geprüft falsch', falsch, '') +
        feld('Topfweite', stufe.topf, reihen.length + ' Töpfe');
    }
  }

  function feld(name, wert, unter) {
    return '<div class="zstat-feld"><span class="zstat-name">' + txt(name) + '</span>' +
           '<b class="zstat-wert">' + txt(wert) + '</b>' +
           '<small class="zstat-unter">' + txt(unter || '') + '</small></div>';
  }

  function lesen(erzwingen) {
    if (laeuft) return;
    if (!erzwingen && Date.now() - letzteLese < LESE_ABSTAND_MS) return;
    laeuft = true;
    var abs = document.getElementById('zeitstatistik');
    if (abs) abs.classList.add('laedt');
    hole(fenster).then(function (reihen) {
      letzteLese = Date.now();
      zeichnen(reihen);
    }).catch(function (e) {
      var bild = document.getElementById('zstat-bild');
      /* Ein Fehler wird GEZEIGT, nicht verschluckt. Ein leeres Bild waere
       * nicht von "nichts gefunden" zu unterscheiden. */
      if (bild) bild.innerHTML = '<div class="zstat-leer zstat-fehler">Statistik nicht erreichbar: ' +
                                 txt(e.message) + '</div>';
    }).then(function () {
      laeuft = false;
      if (abs) abs.classList.remove('laedt');
    });
  }

  function filterBauen() {
    var nav = document.getElementById('zstat-filter');
    if (!nav) return;
    nav.innerHTML = STUFEN.map(function (s) {
      return '<button type="button" class="zstat-knopf' + (s.id === fenster ? ' aktiv' : '') +
             '" data-fenster="' + s.id + '">' + txt(s.name) + '</button>';
    }).join('');
    nav.addEventListener('click', function (ev) {
      var b = ev.target.closest('.zstat-knopf');
      if (!b) return;
      fenster = b.dataset.fenster;
      [].forEach.call(nav.querySelectorAll('.zstat-knopf'), function (x) {
        x.classList.toggle('aktiv', x === b);
      });
      lesen(true);
    });
  }

  function start() {
    if (!document.getElementById('zeitstatistik')) return;
    filterBauen();
    lesen(true);
    setInterval(function () { lesen(false); }, 15000);   /* prueft, liest aber nur alle 60 s */
  }

  welt.Zeitstatistik = { start: start, lesen: lesen };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(window);
