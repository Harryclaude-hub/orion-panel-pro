/* Orion Panel Pro — der Funker
 *
 * Ein Mini-Gespraechspartner unten rechts. EHRLICH GESAGT, WAS ER IST:
 * kein Sprachmodell, sondern ein Pruefer mit Woerterbuch. Er versteht eine
 * Handvoll Fragen ueber Schluesselwoerter — aber was er ANTWORTET, ist nie
 * geraten: Rechnungen rechnet er mit DENSELBEN Formeln nach wie der Scanner
 * (js/rechnung.js, per Spiegel-Pruefstand identisch mit der Serverfassung),
 * Begriffe erklaert er aus derselben Quelle wie die Angaben-Seite, und den
 * Betriebszustand liest er aus den echten Live-Daten.
 *
 * Das KI-Tor (ein echtes Sprachmodell hinter den festen Regeln) steht im
 * Plan und braucht Karams API-Schluessel als Supabase-Secret — bis dahin
 * ist dieser Funker die belegbare Fassung: alles, was er sagt, kann man
 * nachrechnen.
 *
 * EIGENE DATEI wie melder/buehne: liest nur welt.letztesErgebnis und
 * welt.Rechnung, darf geloescht werden, keine Logik haengt an ihm.
 */
(function (welt) {
  'use strict';

  var R = welt.Rechnung;

  /* ---------- Nachrechnen: dieselben Formeln wie der Scanner ---------- */
  function qeVon(buch, seiteText, roh, satz) {
    var s = String(seiteText || '').toUpperCase();
    if (buch === 'polymarket') return { qe: R.qePm(Number(roh), Number(satz)), form: 'Anteil (' + s + ')' };
    if (buch === 'kalshi') return { qe: R.qeKalshi(Number(roh), Number(satz)), form: 'Kontrakt (' + s + ')' };
    if (s === 'BACK') return { qe: R.qeBack(Number(roh), Number(satz)), form: 'Back' };
    if (s === 'LAY') return { qe: R.qeLay(Number(roh), Number(satz)), form: 'Lay' };
    return { qe: null, form: '?' };
  }

  function nachrechnen(f) {
    var s1 = qeVon(f.buch_1 || 'polymarket', f.pm_seite, f.pm_preis, f.pm_gebuehr);
    var s2 = qeVon(f.buch || 'betfair', f.bf_seite, f.bf_quote, f.bf_gebuehr);
    if (s1.qe === null || s2.qe === null) {
      return { pruefbar: false,
               text: 'Nicht nachrechenbar: eine Seite liefert keine gültige Effektivquote (' +
                     s1.form + ' / ' + s2.form + '). Das ist eine Antwort, kein Fehler.' };
    }
    var e = R.pruefe(s1.qe, s2.qe);
    var abw = [];
    function vgl(name, meins, gespeichert) {
      var a = Number(meins), b = Number(gespeichert);
      if (!isFinite(b)) return;
      if (Math.abs(a - b) > 0.005) abw.push(name + ': ich rechne ' + a.toFixed(4) + ', gespeichert ist ' + b.toFixed(4));
    }
    vgl('Rendite', e.rendite, f.rendite);
    vgl('Kehrwertsumme', e.inv, f.inv);
    vgl('Einsatz Seite 1', e.s1, f.einsatz_1);
    vgl('Einsatz Seite 2', e.s2, f.einsatz_2);
    vgl('Auszahlung', e.auszahlung, f.auszahlung);
    return { pruefbar: true, ergebnis: e, abweichungen: abw };
  }

  function pruefAntwort(f) {
    var n = nachrechnen(f);
    var kopf = '„' + (f.titel || '?') + '" — ' + (f.buch_1 || '?') + ' ' + (f.pm_seite || '') +
               ' ' + Number(f.pm_preis).toFixed(3) + ' gegen ' + (f.buch || '?') + ' ' +
               (f.bf_seite || '') + ' ' + Number(f.bf_quote).toFixed(3) + '.\n';
    if (!n.pruefbar) return kopf + n.text;
    var z = kopf + 'Nachgerechnet mit den Scanner-Formeln: Rendite ' +
            n.ergebnis.rendite.toFixed(4) + ' %, Kehrwertsumme ' + n.ergebnis.inv.toFixed(4) +
            ', Aufteilung ' + n.ergebnis.s1.toFixed(2) + ' / ' + n.ergebnis.s2.toFixed(2) +
            ' je 100, Auszahlung ' + n.ergebnis.auszahlung.toFixed(2) + '.\n';
    if (n.abweichungen.length) {
      z += '⚠ ABWEICHUNG zur gespeicherten Zeile:\n– ' + n.abweichungen.join('\n– ');
    } else {
      z += '✓ Deckt sich mit der gespeicherten Zeile (Toleranz 0,005).';
    }
    z += '\nWichtig: das prüft die RECHNUNG zum gespeicherten Zeitpunkt. Ob die Kurse ' +
         'JETZT noch stehen, sagt nur das Buch selbst — und ob die richtigen zwei Kurse ' +
         'verglichen wurden, prüfen Buchprobe, Deckung und Plausibilität (siehe Karte).';
    return z;
  }

  /* ---------- Das Woerterbuch ---------- */
  var BEGRIFFE = {
    rendite: 'RENDITE = was diese Zeile GERADE JETZT brächte, in Prozent des Einsatzes, nach allen Gebühren: (1/Kehrwertsumme − 1) × 100. Sie gilt nur für die zwei gespeicherten Kurse in diesem Moment.',
    beste: 'BESTE = die höchste Rendite, die diese Zeile JE hatte, seit sie zum ersten Mal gesehen wurde. Im Verlauf ist das die Zahl, die zählt — sie beantwortet „hätte sich das gelohnt?". Live kann BESTE über der RENDITE liegen, wenn der Vorsprung schon wieder geschrumpft ist.',
    holbar: 'HOLBAR = Geld, nicht Prozent: handelbare Menge × Rendite. Die Menge ist das Geld auf der BESTEN Preisstufe beider Bücher — dahinter liegt mehr, aber zu schlechteren Kursen. +2 % Rendite bei 140 € Menge sind 2,80 € holbar. Das ist die Zahl, die am Ende auf dem Konto landet.',
    kehrwertsumme: 'KEHRWERTSUMME = 1/Effektivquote₁ + 1/Effektivquote₂. Unter 1,0000 ist es eine Arbitrage: beide Seiten zusammen kosten weniger, als jeder Ausgang zurückzahlt.',
    zuordnung: 'ZUORDNUNG = wie sicher beide Bücher dieselbe Partie und denselben Ausgang meinen (1,00 = wortgleich belegt). Achtung: alle bekannten FEHLpaarungen trugen ebenfalls 1,00 — deshalb prüft der Wächter unabhängig nach.',
    buchprobe: 'BUCHPROBE = Summe der Gegenwahrscheinlichkeiten aller Ausgänge EINES Marktes. Unter 1,00 könnte man bei diesem einen Buch alle Ausgänge kaufen und sicher gewinnen — gibt es nicht, also klebt dort ein Kurs. Solche Zeilen werden automatisch aussortiert.',
    absage: 'ABSAGE = der dritte Ausgang, der in keiner Rendite steht. Jede Karte rechnet ihn in Geld aus: Smarkets zahlt zurück (belegt), Polymarket löst oft 50/50 auf (hängt vom Kaufpreis ab!), Kalshi wertet zum letzten Kurs, Betfair unbelegt. Kostet die Absage rechnerisch Geld, zählt die Zeile nicht als Chance.',
    plausibel: 'PLAUSIBILITÄT = Bedingung 6: über ' + ((welt.KONFIG || {}).maxPlausibel || 5) + ' % Rendite ist keine Chance. Gemessen: alle richtigen Funde lagen zwischen 2,07 und 3,27 %, alle falschen über 4,48 — über 5 % war es IMMER ein klebender Kurs oder eine Fehlpaarung.',
    gedeckt: 'GEDECKT = beide Seiten decken nachweislich GEGENSÄTZLICHE Ausgänge derselben Frage. Ein Unentschieden ist dabei kein dritter Verlustfall: „X gewinnt nicht" schließt es mit ein.'
  };

  /* ---------- Antworten finden ---------- */
  function antwort(frage) {
    var q = String(frage || '').toLowerCase();
    var e = welt.letztesErgebnis;

    /* Nachrechnen: "prüfe", "check", "rechne" — optional mit Titelstück. */
    if (/pr(ü|ue)f|check|rechne|nachrechnen|stimmt/.test(q)) {
      if (!e || !Array.isArray(e.chancen)) return 'Noch keine Daten geladen — zwei Sekunden, dann frag nochmal.';
      var alle = (e.chancen || []).concat(e.knapp || [], e.verlauf || [], e.falsch || []);
      var rest = q.replace(/.*?(pr(ü|ue)fe?|check|rechne)\s*/, '').trim();
      var ziel = null;
      if (rest.length > 2) {
        for (var i = 0; i < alle.length; i++) {
          if (String(alle[i].titel || '').toLowerCase().indexOf(rest.slice(0, 24)) !== -1) { ziel = alle[i]; break; }
        }
      }
      if (!ziel && e.chancen && e.chancen.length) ziel = e.chancen[0];
      if (!ziel && alle.length) ziel = alle[0];
      if (!ziel) return 'Keine Zeile zum Prüfen da. Sag mir ein Stück vom Titel, z. B. „prüfe Hearts".';
      return pruefAntwort(ziel);
    }

    /* Begriffe. */
    for (var b in BEGRIFFE) {
      if (q.indexOf(b) !== -1) return BEGRIFFE[b];
    }
    if (/unterschied|drei.*prozent|prozentzahl/.test(q)) {
      return BEGRIFFE.rendite + '\n\n' + BEGRIFFE.beste + '\n\n' + BEGRIFFE.holbar;
    }

    /* Lage. */
    if (/status|lage|zustand|verbindung|l(ä|ae)uft/.test(q)) {
      if (!e) return 'Noch keine Daten — die Seite lädt alle 2 Sekunden.';
      var lauf = e.lauf || {};
      var alter = lauf.gelaufen_am ? Math.round((Date.now() - Date.parse(lauf.gelaufen_am)) / 1000) : null;
      return 'Lagebericht: ' + (e.chancen || []).length + ' Chancen, ' +
             (e.knapp || []).length + ' knapp daneben, ' + (e.verlauf || []).length +
             ' im Verlauf, ' + ((e.falsch || []).length) + ' als falsch aussortiert. ' +
             'Letzter Scanner-Lauf ' + (alter === null ? 'unbekannt' : 'vor ' + alter + ' s') + '.';
    }

    /* Warum keine Chance? */
    if (/warum.*(keine|nicht).*chance|warum.*knapp/.test(q)) {
      return 'Eine Zeile ist nur dann eine Chance, wenn ALLE sechs Bedingungen stimmen: ' +
             '1) Rendite ≥ 2 %, 2) Menge bekannt, 3) Gewinn in Geld ≥ 5 $, 4) Absage kostet ' +
             'nichts, 5) beide Ausgänge gedeckt, 6) Rendite ≤ ' +
             ((welt.KONFIG || {}).maxPlausibel || 5) + ' % (darüber war es bisher immer ein ' +
             'klebender Kurs). Welche Bedingung fehlt, steht auf jeder Karte unter „Knappste Paare".';
    }

    return 'Ich bin der Funker: kein Sprachmodell, ein Prüfer. Ich kann:\n' +
           '– „prüfe" oder „prüfe <Titelstück>" — rechnet eine Zeile mit den Scanner-Formeln nach\n' +
           '– „was heißt holbar / rendite / beste / kehrwertsumme / buchprobe / absage / gedeckt"\n' +
           '– „status" — der Lagebericht\n' +
           '– „warum keine Chance" — die sechs Bedingungen\n' +
           'Alles, was ich sage, ist nachgerechnet oder gemessen — nie geraten.';
  }

  /* ---------- Oberflaeche ---------- */
  function baue() {
    if (document.getElementById('funker')) return;
    var k = document.createElement('button');
    k.id = 'funker-knopf';
    k.type = 'button';
    k.title = 'Der Funker: prüft Rechnungen nach und erklärt Begriffe';
    k.textContent = '🎙 FUNKER';
    var p = document.createElement('div');
    p.id = 'funker';
    p.innerHTML =
      '<div class="fu-kopf">FUNKER <span>prüft nach — rät nie</span>' +
        '<button type="button" class="fu-zu" title="Schließen">×</button></div>' +
      '<div class="fu-log" id="funker-log"></div>' +
      '<form class="fu-eingabe" id="funker-form">' +
        '<input id="funker-frage" type="text" placeholder="z. B. „prüfe“ oder „was heißt holbar“" autocomplete="off">' +
        '<button type="submit">Senden</button>' +
      '</form>';
    document.body.appendChild(k);
    document.body.appendChild(p);

    function schreib(text, wer) {
      var log = document.getElementById('funker-log');
      var d = document.createElement('div');
      d.className = 'fu-zeile ' + wer;
      d.textContent = text;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }

    k.addEventListener('click', function () {
      p.classList.toggle('offen');
      if (p.classList.contains('offen') && !p.dataset.begruesst) {
        p.dataset.begruesst = '1';
        schreib('Funker auf Empfang. Ich rechne mit denselben Formeln wie der Scanner — frag „prüfe“, oder frag nach einem Begriff.', 'funker');
      }
    });
    p.querySelector('.fu-zu').addEventListener('click', function () { p.classList.remove('offen'); });

    document.getElementById('funker-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var inp = document.getElementById('funker-frage');
      var frage = inp.value.trim();
      if (!frage) return;
      inp.value = '';
      schreib(frage, 'ich');
      schreib(antwort(frage), 'funker');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baue);
  else baue();

  welt.Funker = { antwort: antwort, nachrechnen: nachrechnen };

})(typeof globalThis !== 'undefined' ? globalThis : this);
