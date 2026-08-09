/* Orion Panel — Anzeige
 *
 * Fehlerklasse 6: sekuendliches innerHTML auf Elementen unter der Maus
 * zerstoert den Hover-Zustand und laesst Klicks zwischen mousedown und
 * mouseup durchfallen. Regel: vor jedem Schreiben pruefen, ob sich der
 * Inhalt ueberhaupt geaendert hat.
 *
 * Fehlerklasse 4: window.open nach asynchroner Arbeit wird blockiert.
 * Deshalb sind beide Marktlinks echte <a target="_blank">, kein JS-Öffner.
 *
 * Fehlerklasse 5: kein content-visibility, damit nichts springt oder
 * ueberlappt.
 */

(function (welt) {
  'use strict';

  function setzeWennAnders(el, html) {
    if (!el) return;
    if (el.dataset.stand === html) return;   // nichts geaendert, nicht anfassen
    el.dataset.stand = html;
    el.innerHTML = html;
  }

  function txt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function zeit(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    var h = (t - Date.now()) / 3600000;
    if (h < 0) return 'vorbei';
    if (h < 1) return Math.round(h * 60) + ' min';
    if (h < 48) return h.toFixed(1) + ' h';
    return (h / 24).toFixed(1) + ' Tage';
  }

  /* anzahlChancen wird uebergeben, damit Kachel und Liste NIE verschiedene
   * Zahlen zeigen. Eine Kachel, die 1 sagt, waehrend darunter "keine Chance"
   * steht, ist genau die Art Widerspruch, die Vertrauen kostet. */
  function kacheln(s, anzahlChancen) {
    return [
      { name: 'Chancen jetzt', wert: anzahlChancen, farbe: anzahlChancen > 0 ? 'var(--gruen)' : 'var(--text-leise)' },
      { name: 'Paare gerechnet', wert: s.gerechnet },
      { name: 'Polymarket handelbar', wert: s.pm_handelbar, farbe: 'var(--violett)' },
      { name: 'Betfair Match Odds', wert: s.bf_match_odds, farbe: 'var(--blau)' },
      { name: 'Bridge-Daten alt', wert: alterText(s.bf_alter_s),
        farbe: (s.bf_alter_s === null || s.bf_alter_s > welt.KONFIG.bridgeMaxAlterS) ? 'var(--rot)' : 'var(--gruen)' }
    ].map(function (k) {
      return '<div class="kachel"><div class="wert" style="color:' + (k.farbe || 'var(--text)') + '">' +
             txt(k.wert) + '</div><div class="name">' + txt(k.name) + '</div></div>';
    }).join('');
  }

  function fundKarte(f) {
    var r = f.rechnung;
    var chance = r.istArbitrage;
    var rendite = r.rendite.toFixed(2) + ' %';

    return '' +
      '<div class="fund' + (chance ? ' chance' : '') + '">' +
        '<div class="titel">' + txt(f.titel) + '</div>' +
        '<div class="unter">' +
          '<span class="chip">' + txt(f.tag) + '</span> ' +
          '<span class="chip">endet in ' + txt(zeit(f.ende)) + '</span> ' +
          '<span class="chip' + (f.score >= 0.99 ? ' gut' : ' acht') + '">Zuordnung ' + f.score.toFixed(2) + '</span> ' +
          '<span class="chip ' + (chance ? 'gut' : '') + '">Rendite ' + rendite + '</span>' +
        '</div>' +
        '<div class="seiten">' +
          '<div class="seite pm">' +
            '<div class="quelle">Polymarket</div>' +
            '<div class="zahl">' + f.pmSeite + ' ' + f.pmPreis.toFixed(3) + '</div>' +
            '<div class="leise">' + txt(f.mannschaft) + ' &middot; Effektivquote ' + r.qe1.toFixed(3) + '</div>' +
          '</div>' +
          '<div class="seite bf">' +
            '<div class="quelle">Betfair</div>' +
            '<div class="zahl">' + f.bfSeite + ' ' + Number(f.bfQuote).toFixed(2) + '</div>' +
            '<div class="leise">' + txt(f.bfName) + ' &middot; Volumen ' + txt(f.bfVolumen) +
              ' &middot; Effektivquote ' + r.qe2.toFixed(3) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="unter">Summe der Kehrwerte ' + r.inv.toFixed(4) +
          ' &middot; bei 100 Einsatz: ' + r.s1.toFixed(2) + ' / ' + r.s2.toFixed(2) +
          ' &rarr; Auszahlung ' + r.auszahlung.toFixed(2) + '</div>' +
        '<div class="aktionen">' +
          '<a class="knopf" target="_blank" rel="noopener" href="' + txt(f.pmLink) + '">Polymarket öffnen</a>' +
          '<a class="knopf" target="_blank" rel="noopener" href="' + txt(f.bfLink) + '">Betfair über Broker öffnen</a>' +
        '</div>' +
      '</div>';
  }

  function alterText(s) {
    if (s === null || s === undefined) return 'unbekannt';
    if (s < 120) return s + ' s';
    if (s < 7200) return Math.round(s / 60) + ' min';
    return (s / 3600).toFixed(1) + ' h';
  }

  function zeichne(ergebnis) {
    var K = welt.KONFIG;
    var s = ergebnis.statistik;

    /* Veraltete Bridge-Daten sind keine Kurse mehr. Lieber ehrlich sagen,
     * dass nichts Verlaessliches da ist, als eine Chance vorspielen. */
    var veraltet = s.bf_alter_s === null || s.bf_alter_s > K.bridgeMaxAlterS;

    /* Rauschen ist kein Fund: eine Chance braucht die Mindestrendite.
     * Auf veralteten Daten gibt es gar keine Chance, nur alte Zahlen. */
    var chancen = ergebnis.funde.filter(function (f) {
      return f.rechnung.istArbitrage && f.rechnung.rendite >= K.mindestRendite;
    });

    setzeWennAnders(document.getElementById('kacheln'), kacheln(s, veraltet ? 0 : chancen.length));
    var knapp = ergebnis.funde.filter(function (f) {
      return !(f.rechnung.istArbitrage && f.rechnung.rendite >= K.mindestRendite);
    }).slice(0, 25);

    var html = '';

    if (veraltet) {
      html += '<div class="warnung"><b>Betfair-Daten sind ' + alterText(s.bf_alter_s) + ' alt.</b> ' +
              'Die Bridge auf dem Heim-PC lädt normalerweise im Minutentakt hoch. ' +
              'Solange das so ist, sind die Quoten unten Geschichte, keine Kurse. ' +
              'Läuft die Bridge noch?</div>';
    }

    if (!ergebnis.funde.length) {
      html += '<div class="warnung">Keine zugeordneten Paare. Entweder liegen gerade keine ' +
              'gemeinsamen Partien an, oder die Bridge hat nichts Passendes hochgeladen.</div>';
    }
    if (chancen.length && !veraltet) {
      html += '<h2>Echte Chancen (' + chancen.length + ')</h2>' + chancen.map(fundKarte).join('');
    } else if (chancen.length && veraltet) {
      html += '<h2>Chancen auf veralteten Daten (' + chancen.length + ') — nicht handeln</h2>' +
              chancen.map(fundKarte).join('');
    } else if (ergebnis.funde.length) {
      html += '<div class="warnung">Gerade keine Chance über ' + K.mindestRendite.toFixed(2) + ' %. ' +
              'Das ist der Normalfall: zwei Börsen mit vielen Teilnehmern liegen selten weit auseinander.</div>';
    }
    if (knapp.length) {
      html += '<h2>Die knappsten Paare (' + knapp.length + ' von ' +
              (ergebnis.funde.length - chancen.length) + ')</h2>' + knapp.map(fundKarte).join('');
    }

    setzeWennAnders(document.getElementById('liste'), html);
  }

  function stand(text, art) {
    var el = document.getElementById('stand');
    if (!el) return;
    el.className = 'chip' + (art ? ' ' + art : '');
    el.textContent = text;
  }

  welt.Anzeige = { zeichne: zeichne, stand: stand, zeit: zeit, setzeWennAnders: setzeWennAnders };

})(typeof globalThis !== 'undefined' ? globalThis : this);
