/* Orion Panel Pro — Filter
 *
 * Ein Feld rechts, das man auf- und zuklappen kann. Es filtert NUR die
 * Anzeige: gesucht und gerechnet wird unveraendert auf dem Server. Wer
 * einen Filter setzt, verliert also keine Funde, er sieht sie nur nicht.
 * Genau deshalb steht unter jedem Reiter, wie viele ausgeblendet sind —
 * ein Filter, der stillschweigend etwas verschluckt, ist eine Falle.
 *
 * Die Einstellung ueberlebt das Auffrischen (alle 2 s) und einen Neustart
 * des Browsers. Ohne das waere das Feld unbenutzbar: bei jedem Takt waere
 * es wieder zurueckgesetzt.
 */

(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-filter';

  /* Die Marktart steht NICHT in der Datenbank, sie wird aus der Bezeichnung
   * abgelesen, die orion-lauf schreibt (Variable `bez`). Das ist eine
   * Kopplung an eine Anzeigezeichenkette und damit die schwaechste Stelle
   * hier. Aendert sich `bez` im Scanner, greift dieser Filter ins Leere —
   * er wuerde dann alles als "sieger" zaehlen, nicht abstuerzen.
   * Sauber waere eine eigene Spalte; steht als offener Punkt. */
  function artVon(f) {
    var m = String(f && f.mannschaft || '');
    if (m === 'Unentschieden') return 'unentschieden';
    if (m === 'Beide Mannschaften treffen') return 'btts';
    if (m.indexOf('Über/Unter') === 0) return 'ueber_unter';
    return 'sieger';
  }

  var ARTEN = [
    { id: 'sieger',        name: 'Sieger' },
    { id: 'unentschieden', name: 'Unentschieden' },
    { id: 'ueber_unter',   name: 'Über/Unter' },
    { id: 'btts',          name: 'Beide treffen' }
  ];

  var SPORTARTEN = [
    { id: 'soccer', name: 'Fußball' }, { id: 'ucl', name: 'Champions League' },
    { id: 'mlb', name: 'Baseball' },   { id: 'nfl', name: 'Football' },
    { id: 'nba', name: 'Basketball' }, { id: 'tennis', name: 'Tennis' }
  ];

  /* "alle" ist bewusst der Standard: ein Panel, das beim ersten Oeffnen
   * schon filtert, versteckt Funde, von denen man nichts weiss. */
  var STANDARD = {
    offen: false,
    gefundenMin: 0,     // 0 = alle
    endetStd: 0,        // 0 = alle
    minRendite: null,   // null = keine eigene Grenze
    minEinsatz: 0,
    nurMitMenge: false,
    buecher: null,      // null = alle
    arten: null,
    sportarten: null
  };

  var stand = laden();

  function laden() {
    var s = {};
    for (var k in STANDARD) if (Object.prototype.hasOwnProperty.call(STANDARD, k)) s[k] = STANDARD[k];
    try {
      var roh = localStorage.getItem(SCHLUESSEL);
      if (roh) {
        var g = JSON.parse(roh);
        for (var j in g) if (Object.prototype.hasOwnProperty.call(s, j)) s[j] = g[j];
      }
    } catch (e) { /* Speicher gesperrt oder Unsinn drin: dann eben Standard */ }
    return s;
  }
  function sichern() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(stand)); } catch (e) {}
  }

  function anListe(liste, wert) {
    return liste === null || liste.indexOf(wert) >= 0;
  }

  /* Der eigentliche Filter. Gibt zurueck, ob ein Fund gezeigt wird. */
  function passt(f, imVerlauf) {
    var jetzt = Date.now();

    if (stand.gefundenMin > 0) {
      var t = Date.parse(f.zuerst_gesehen || '');
      if (isNaN(t) || (jetzt - t) > stand.gefundenMin * 60000) return false;
    }
    /* Im Verlauf ist "endet in" sinnlos — die Partie ist ja vorbei. */
    if (stand.endetStd > 0 && !imVerlauf) {
      var e = Date.parse(f.endet_am || '');
      if (isNaN(e) || (e - jetzt) > stand.endetStd * 3600000) return false;
    }
    if (stand.minRendite !== null && Number(f.rendite) < stand.minRendite) return false;

    /* Unbekannte Menge ist NICHT null. Wer "nur mit bekannter Menge"
     * anhakt, will genau diese Zeilen loswerden; wer es nicht anhakt,
     * soll sie sehen statt sie stillschweigend zu verlieren. */
    if (stand.nurMitMenge && f.max_einsatz === null) return false;
    if (stand.minEinsatz > 0) {
      if (f.max_einsatz === null) return false;
      if (Number(f.max_einsatz) < stand.minEinsatz) return false;
    }

    if (!anListe(stand.buecher, f.buch_1 || 'polymarket') &&
        !anListe(stand.buecher, f.buch || 'betfair')) return false;
    if (stand.buecher !== null) {
      /* BEIDE Buecher muessen erlaubt sein. Sonst zeigt der Filter "nur
       * Smarkets" auch Zeilen, deren zweite Seite ein abgewaehltes Buch
       * ist — und die kann man nicht handeln, wenn man dort kein Konto hat. */
      if (!anListe(stand.buecher, f.buch_1 || 'polymarket')) return false;
      if (!anListe(stand.buecher, f.buch || 'betfair')) return false;
    }
    if (!anListe(stand.arten, artVon(f))) return false;
    if (!anListe(stand.sportarten, f.sportart)) return false;
    return true;
  }

  function anwenden(liste, imVerlauf) {
    if (!liste || !liste.length) return { sichtbar: liste || [], weg: 0 };
    var s = [];
    for (var i = 0; i < liste.length; i++) if (passt(liste[i], imVerlauf)) s.push(liste[i]);
    return { sichtbar: s, weg: liste.length - s.length };
  }

  function aktiv() {
    return stand.gefundenMin > 0 || stand.endetStd > 0 || stand.minRendite !== null ||
           stand.minEinsatz > 0 || stand.nurMitMenge ||
           stand.buecher !== null || stand.arten !== null || stand.sportarten !== null;
  }

  /* ---------- Das Feld ---------- */

  function txt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function kaesten(name, eintraege, gewaehlt) {
    return eintraege.map(function (x) {
      var an = gewaehlt === null || gewaehlt.indexOf(x.id) >= 0;
      return '<label class="f-zeile"><input type="checkbox" data-gruppe="' + name +
             '" data-wert="' + txt(x.id) + '"' + (an ? ' checked' : '') + '> ' + txt(x.name) + '</label>';
    }).join('');
  }

  function knoepfe(name, eintraege, gewaehlt) {
    return '<div class="f-knoepfe">' + eintraege.map(function (x) {
      return '<button type="button" class="f-knopf' + (gewaehlt === x.wert ? ' offen' : '') +
             '" data-feld="' + name + '" data-wert="' + x.wert + '">' + txt(x.name) + '</button>';
    }).join('') + '</div>';
  }

  function bauen() {
    var K = welt.KONFIG || {};
    var buecher = Object.keys(K.buecher || {}).map(function (id) {
      var b = K.buecher[id];
      return { id: id, name: b.name + (b.aktiv === false ? ' (aus)' : '') };
    });

    return '' +
      '<div class="f-kopf"><b>Filter</b>' +
        '<button type="button" class="f-zu" id="f-zu" title="Zuklappen">&times;</button></div>' +
      '<div class="f-koerper">' +

        '<div class="f-gruppe"><div class="f-titel">Gefunden in den letzten</div>' +
          knoepfe('gefundenMin', [
            { name: 'alle', wert: 0 }, { name: '15 min', wert: 15 },
            { name: '1 h', wert: 60 }, { name: '6 h', wert: 360 }, { name: '24 h', wert: 1440 }
          ], stand.gefundenMin) +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Partie endet in</div>' +
          knoepfe('endetStd', [
            { name: 'alle', wert: 0 }, { name: '3 h', wert: 3 },
            { name: '12 h', wert: 12 }, { name: '24 h', wert: 24 }
          ], stand.endetStd) +
          '<div class="f-hinweis">Gilt nicht im Verlauf — dort ist die Partie vorbei.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Mindestrendite</div>' +
          '<input type="number" id="f-rendite" step="0.1" placeholder="ohne Grenze" value="' +
            (stand.minRendite === null ? '' : stand.minRendite) + '"> %' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Handelbarer Einsatz</div>' +
          '<input type="number" id="f-einsatz" step="1" min="0" value="' + stand.minEinsatz + '"> mindestens' +
          '<label class="f-zeile"><input type="checkbox" id="f-menge"' +
            (stand.nurMitMenge ? ' checked' : '') + '> nur mit bekannter Menge</label>' +
          '<div class="f-hinweis">Unbekannte Menge heißt nicht null. Ohne Haken bleibt sie sichtbar.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Bücher</div>' +
          kaesten('buecher', buecher, stand.buecher) +
          '<div class="f-hinweis">Es müssen BEIDE Seiten erlaubt sein — eine Arbitrage braucht zwei.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Frage</div>' +
          kaesten('arten', ARTEN, stand.arten) +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Sportart</div>' +
          kaesten('sportarten', SPORTARTEN, stand.sportarten) +
        '</div>' +

        '<button type="button" class="knopf" id="f-zurueck">Alles zurücksetzen</button>' +
      '</div>';
  }

  var gebaut = false;

  function umschalten(auf) {
    stand.offen = (auf === undefined) ? !stand.offen : !!auf;
    sichern();
    zeichnen();
  }

  function gruppeUmschalten(gruppe, wert, an) {
    var alle = gruppe === 'buecher' ? Object.keys((welt.KONFIG || {}).buecher || {})
             : gruppe === 'arten' ? ARTEN.map(function (x) { return x.id; })
             : SPORTARTEN.map(function (x) { return x.id; });
    var jetzt = stand[gruppe] === null ? alle.slice() : stand[gruppe].slice();
    var i = jetzt.indexOf(wert);
    if (an && i < 0) jetzt.push(wert);
    if (!an && i >= 0) jetzt.splice(i, 1);
    /* Alles angehakt ist dasselbe wie kein Filter — dann wieder null, damit
     * die Anzeige "Filter aktiv" nicht luegt. */
    stand[gruppe] = (jetzt.length === alle.length) ? null : jetzt;
    sichern();
    zeichnen();
    neuZeichnenLassen();
  }

  function neuZeichnenLassen() {
    if (welt.letztesErgebnis && welt.Anzeige) welt.Anzeige.zeichne(welt.letztesErgebnis);
  }

  function zeichnen() {
    var panel = document.getElementById('filter-panel');
    var knopf = document.getElementById('filter-knopf');
    if (!panel || !knopf) return;

    if (!gebaut) {
      panel.innerHTML = bauen();
      gebaut = true;
      binden(panel);
    }
    panel.classList.toggle('offen', stand.offen);
    knopf.classList.toggle('an', aktiv());
    knopf.textContent = aktiv() ? 'Filter aktiv' : 'Filter';
  }

  function binden(panel) {
    panel.addEventListener('click', function (ev) {
      var z = ev.target;
      if (z.id === 'f-zu') return umschalten(false);
      if (z.id === 'f-zurueck') {
        for (var k in STANDARD) if (Object.prototype.hasOwnProperty.call(STANDARD, k)) stand[k] = STANDARD[k];
        stand.offen = true;
        gebaut = false;
        sichern();
        zeichnen();
        neuZeichnenLassen();
        return;
      }
      if (z.classList && z.classList.contains('f-knopf')) {
        stand[z.getAttribute('data-feld')] = Number(z.getAttribute('data-wert'));
        sichern();
        var geschwister = z.parentNode.querySelectorAll('.f-knopf');
        for (var i = 0; i < geschwister.length; i++) geschwister[i].classList.remove('offen');
        z.classList.add('offen');
        zeichnen();
        neuZeichnenLassen();
      }
    });

    panel.addEventListener('change', function (ev) {
      var z = ev.target;
      if (z.id === 'f-menge') { stand.nurMitMenge = z.checked; sichern(); zeichnen(); return neuZeichnenLassen(); }
      var g = z.getAttribute && z.getAttribute('data-gruppe');
      if (g) return gruppeUmschalten(g, z.getAttribute('data-wert'), z.checked);
    });

    panel.addEventListener('input', function (ev) {
      var z = ev.target;
      if (z.id === 'f-rendite') {
        var v = z.value.trim();
        stand.minRendite = v === '' ? null : Number(v);
        if (stand.minRendite !== null && !isFinite(stand.minRendite)) stand.minRendite = null;
      } else if (z.id === 'f-einsatz') {
        var w = Number(z.value);
        stand.minEinsatz = isFinite(w) && w > 0 ? w : 0;
      } else return;
      sichern();
      zeichnen();
      neuZeichnenLassen();
    });
  }

  function start() {
    var knopf = document.getElementById('filter-knopf');
    if (knopf) knopf.addEventListener('click', function () { umschalten(); });
    zeichnen();
  }

  welt.Filter = {
    anwenden: anwenden,
    aktiv: aktiv,
    artVon: artVon,
    start: start,
    zeichnen: zeichnen
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
