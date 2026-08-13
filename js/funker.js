/* Orion Panel Pro — der Funker
 *
 * Ein Mini-Gespraechspartner unten rechts, im Ton eines Soldaten. EHRLICH
 * GESAGT, WAS ER IST: kein Sprachmodell, sondern ein Pruefer mit
 * Woerterbuch. Er versteht eine Handvoll Befehle ueber Schluesselwoerter —
 * aber was er MELDET, ist nie geraten: Rechnungen rechnet er mit DENSELBEN
 * Formeln nach wie der Scanner (js/rechnung.js, per Spiegel-Pruefstand
 * identisch mit der Serverfassung), Begriffe erklaert er aus derselben
 * Quelle wie die Angaben-Seite, den Lagebericht liest er aus den echten
 * Live-Daten.
 *
 * JEDE Zeile traegt eine feste fuenfstellige Rechnungsnummer (daten.js,
 * vorn auf jeder Karte). "pruefe #48213" liefert die Tiefenpruefung:
 * beide Seiten einzeln, Kehrwertsumme, Aufteilung, Abgleich mit der
 * gespeicherten Zeile, die sechs Bedingungen, die Buchprobe, das Urteil.
 *
 * Das KI-Tor (ein echtes Sprachmodell hinter den festen Regeln) steht im
 * Plan und braucht Karams API-Schluessel als Supabase-Secret.
 *
 * EIGENE DATEI wie melder/buehne: liest nur welt.letztesErgebnis und
 * welt.Rechnung, darf geloescht werden, keine Logik haengt an ihm.
 */
(function (welt) {
  'use strict';

  var R = welt.Rechnung;
  var STRICH = '────────────────';

  /* ---------- Nachrechnen: dieselben Formeln wie der Scanner ---------- */
  function qeVon(buch, seiteText, roh, satz) {
    var s = String(seiteText || '').toUpperCase();
    if (buch === 'polymarket') return { qe: R.qePm(Number(roh), Number(satz)), form: 'Anteil ' + s };
    if (buch === 'kalshi') return { qe: R.qeKalshi(Number(roh), Number(satz)), form: 'Kontrakt ' + s };
    if (s === 'BACK') return { qe: R.qeBack(Number(roh), Number(satz)), form: 'Back' };
    if (s === 'LAY') return { qe: R.qeLay(Number(roh), Number(satz)), form: 'Lay' };
    return { qe: null, form: '?' };
  }

  function nachrechnen(f) {
    var s1 = qeVon(f.buch_1 || 'polymarket', f.pm_seite, f.pm_preis, f.pm_gebuehr);
    var s2 = qeVon(f.buch || 'betfair', f.bf_seite, f.bf_quote, f.bf_gebuehr);
    if (s1.qe === null || s2.qe === null) {
      return { pruefbar: false, s1: s1, s2: s2,
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
    return { pruefbar: true, s1: s1, s2: s2, ergebnis: e, abweichungen: abw };
  }

  /* Die sechs Bedingungen, einzeln abgehakt — dieselbe Reihenfolge wie in
   * daten.js. Drei Zustaende je Bedingung: erfuellt (✓), verletzt (✗),
   * nicht feststellbar (?). */
  function bedingungen(f) {
    var K = welt.KONFIG || {};
    var G = welt.Anzeige && welt.Anzeige.istGedeckt;
    var z = [];
    function b(nr, name, wert) {
      z.push((wert === true ? '✓' : wert === false ? '✗' : '?') + ' ' + nr + '. ' + name);
    }
    b(1, 'Rendite über ' + K.mindestRendite + ' %', Number(f.rendite) >= K.mindestRendite);
    b(2, 'Menge bekannt', f.max_einsatz !== null && f.max_einsatz !== undefined);
    b(3, 'Gewinn über ' + K.mindestGewinn + ' USD', f.echter_gewinn == null ? null : f.echter_gewinn >= K.mindestGewinn);
    b(4, 'Absage kostet nichts', !f.absage ? null : (f.absage.art === 'sicher' ? true : f.absage.art === 'verlust' ? false : null));
    b(5, 'beide Ausgänge gedeckt', G ? G(f) : null);
    b(6, 'plausibel (bis ' + (K.maxPlausibel || 5) + ' %)', Number(f.rendite) <= (K.maxPlausibel || 5));
    b(7, 'Bewährung (' + (K.bewaehrungS || 25) + ' s überlebt)', (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen)) >= (K.bewaehrungS || 25) * 1000);
    return z;
  }

  function pruefAntwort(f) {
    var n = nachrechnen(f);
    var z = 'BEFEHL ERHALTEN — PRÜFUNG #' + (f.nr || '?') + '\n' +
            'Ziel: „' + (f.titel || '?') + '“\n' + STRICH + '\n' +
            'Seite 1: ' + (f.buch_1 || '?') + ' ' + (f.pm_seite || '') + ' ' + Number(f.pm_preis).toFixed(4) +
            ' · Gebühr ' + (Number(f.pm_gebuehr) * 100).toFixed(1) + ' % (' + n.s1.form + ')' +
            (n.s1.qe === null ? ' → keine gültige Effektivquote' : ' → Effektivquote ' + n.s1.qe.toFixed(4)) + '\n' +
            'Seite 2: ' + (f.buch || '?') + ' ' + (f.bf_seite || '') + ' ' + Number(f.bf_quote).toFixed(4) +
            ' · Gebühr ' + (Number(f.bf_gebuehr) * 100).toFixed(1) + ' % (' + n.s2.form + ')' +
            (n.s2.qe === null ? ' → keine gültige Effektivquote' : ' → Effektivquote ' + n.s2.qe.toFixed(4)) + '\n';
    if (!n.pruefbar) {
      return z + STRICH + '\nMELDUNG: ' + n.text + '\nEnde der Meldung.';
    }
    z += 'Kehrwertsumme ' + n.ergebnis.inv.toFixed(4) + ' → Rendite ' + n.ergebnis.rendite.toFixed(4) + ' %\n' +
         'Aufteilung ' + n.ergebnis.s1.toFixed(2) + ' / ' + n.ergebnis.s2.toFixed(2) +
         ' je 100 → Auszahlung ' + n.ergebnis.auszahlung.toFixed(2) + ' bei BEIDEN Ausgängen\n' +
         STRICH + '\nAbgleich mit der gespeicherten Zeile:\n';
    if (n.abweichungen.length) {
      z += '✗ ABWEICHUNG:\n– ' + n.abweichungen.join('\n– ') + '\n';
    } else {
      z += '✓ Rendite, Kehrwertsumme, beide Einsätze und Auszahlung decken sich (Toleranz 0,005).\n';
    }
    z += STRICH + '\nDie sieben Bedingungen:\n' + bedingungen(f).join('\n') + '\n';
    if (f.buch_summe != null) {
      z += 'Buchprobe Gegenbuch: ' + Number(f.buch_summe).toFixed(4) +
           (Number(f.buch_summe) < 1 ? ' — UNSTIMMIG, ein Kurs klebt' : ' — stimmig') + '\n';
    }
    if (f.beste_rendite != null) {
      z += 'Beste je gesehene Rendite: ' + Number(f.beste_rendite).toFixed(2) + ' %\n';
    }
    z += STRICH + '\nURTEIL: ' +
         (n.abweichungen.length
           ? 'RECHNUNG WEICHT AB — Meldung geht an den Auftraggeber.'
           : 'RECHNUNG BESTÄTIGT, Kamerad. Gilt für den gespeicherten Zeitpunkt — ob die Kurse JETZT noch stehen, entscheidet das Buch.') +
         '\nEnde der Meldung.';
    return z;
  }

  /* ---------- Das Woerterbuch ---------- */
  var BEGRIFFE = {
    rendite: 'RENDITE = was diese Zeile GERADE JETZT brächte, in Prozent des Einsatzes, nach allen Gebühren: (1/Kehrwertsumme − 1) × 100. Gilt nur für die zwei gespeicherten Kurse in diesem Moment.',
    beste: 'BESTE = die höchste Rendite, die diese Zeile JE hatte. Im Verlauf ist das die Zahl, die zählt — sie beantwortet „hätte sich das gelohnt?“. Live kann BESTE über der RENDITE liegen, wenn der Vorsprung schon geschrumpft ist.',
    holbar: 'HOLBAR = Geld, nicht Prozent: handelbare Menge × Rendite. Die Menge ist das Geld auf der BESTEN Preisstufe beider Bücher — dahinter liegt mehr, aber zu schlechteren Kursen. +2 % bei 140 € Menge sind 2,80 € holbar.',
    kehrwertsumme: 'KEHRWERTSUMME = 1/Effektivquote1 + 1/Effektivquote2. Unter 1,0000 ist es eine Arbitrage: beide Seiten zusammen kosten weniger, als jeder Ausgang zurückzahlt.',
    zuordnung: 'ZUORDNUNG = wie sicher beide Bücher dieselbe Partie und denselben Ausgang meinen (1,00 = wortgleich belegt). Achtung: alle bekannten FEHLpaarungen trugen ebenfalls 1,00 — deshalb prüft der Wächter unabhängig nach.',
    buchprobe: 'BUCHPROBE = Summe der Gegenwahrscheinlichkeiten aller Ausgänge EINES Marktes. Unter 1,00 könnte man bei diesem einen Buch alle Ausgänge kaufen und sicher gewinnen — gibt es nicht, also klebt dort ein Kurs. Solche Zeilen werden automatisch aussortiert.',
    absage: 'ABSAGE = der dritte Ausgang, der in keiner Rendite steht. Jede Karte rechnet ihn in Geld aus: Smarkets zahlt zurück (belegt), Polymarket löst oft 50/50 auf (hängt vom Kaufpreis ab!), Kalshi wertet zum letzten Kurs, Betfair unbelegt. Kostet die Absage rechnerisch Geld, zählt die Zeile nicht als Chance.',
    plausibel: 'PLAUSIBILITÄT = Bedingung 6: über ' + ((welt.KONFIG || {}).maxPlausibel || 5) + ' % Rendite ist keine Chance. Gemessen: richtig war 2,07 bis 3,27 %, falsch alles über 4,48 — über 5 % war es IMMER ein klebender Kurs oder eine Fehlpaarung.',
    gedeckt: 'GEDECKT = beide Seiten decken nachweislich GEGENSÄTZLICHE Ausgänge derselben Frage. Ein Unentschieden ist kein dritter Verlustfall: „X gewinnt nicht“ schließt es mit ein.',
    nummer: 'RECHNUNGSNUMMER = die #Zahl vorn auf jeder Karte. Fest aus dem Schlüssel der Zeile abgeleitet — dieselbe Zeile trägt immer dieselbe Nummer. Sag „prüfe #48213“, und ich nehme genau diese Zeile auseinander.'
  };

  /* ---------- Antworten finden ---------- */
  function antwort(frage) {
    var q = String(frage || '').toLowerCase();
    var e = welt.letztesErgebnis;

    /* Nummern-Befehl: #48213 findet die Zeile in ALLEN vier Listen. */
    var nrTreffer = q.match(/#\s*(\d{5})\b/) || q.match(/\b(\d{5})\b/);
    if (nrTreffer && e) {
      var nr = Number(nrTreffer[1]);
      var alleN = (e.chancen || []).concat(e.knapp || [], e.verlauf || [], e.falsch || []);
      for (var ni = 0; ni < alleN.length; ni++) {
        if (alleN[ni].nr === nr) return pruefAntwort(alleN[ni]);
      }
      return 'Negativ, Kamerad — Rechnung #' + nr + ' ist in keiner der vier Listen. ' +
             'Entweder älter als die geladenen 500 Verlaufszeilen, oder die Nummer stimmt nicht. ' +
             'Die Nummer steht vorn auf jeder Karte.';
    }

    /* Nachrechnen ueber den Titel. */
    if (/pr(ü|ue)f|check|rechne|nachrechnen|stimmt/.test(q)) {
      if (!e || !Array.isArray(e.chancen)) return 'Noch keine Daten geladen, Kamerad — zwei Sekunden, dann frag nochmal.';
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
      if (!ziel) return 'Negativ — keine Zeile im Visier. Gib mir eine Nummer (prüfe #48213) oder ein Titelstück (prüfe Hearts).';
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
      if (!e) return 'Noch keine Daten, Kamerad — die Seite lädt alle 2 Sekunden.';
      var lauf = e.lauf || {};
      var alter = lauf.gelaufen_am ? Math.round((Date.now() - Date.parse(lauf.gelaufen_am)) / 1000) : null;
      return 'MELDUNG — Lagebericht: ' + (e.chancen || []).length + ' Chancen, ' +
             (e.knapp || []).length + ' knapp daneben, ' + (e.verlauf || []).length +
             ' im Verlauf, ' + ((e.falsch || []).length) + ' als falsch aussortiert. ' +
             'Letzter Scanner-Lauf ' + (alter === null ? 'unbekannt' : 'vor ' + alter + ' s') + '. Ende.';
    }

    /* Warum keine Chance? */
    if (/warum.*(keine|nicht).*chance|warum.*knapp/.test(q)) {
      return 'Eine Zeile ist nur dann eine Chance, wenn ALLE sieben Bedingungen stimmen: ' +
             '1) Rendite über 2 %, 2) Menge bekannt, 3) Gewinn in Geld über 5 USD, 4) Absage ' +
             'kostet nichts, 5) beide Ausgänge gedeckt, 6) höchstens ' +
             ((welt.KONFIG || {}).maxPlausibel || 5) + ' % (darüber war es bisher immer ein ' +
             'klebender Kurs). Welche fehlt, sage ich dir bei „prüfe #<Nummer>“.';
    }

    return 'Befehl nicht verstanden, Kamerad. Zu Diensten stehen:\n' +
           '– „prüfe #48213“ — die Nummer steht vorn auf jeder Karte; volle Tiefenprüfung\n' +
           '– „prüfe <Titelstück>“ — dasselbe über den Namen\n' +
           '– „was heißt holbar / rendite / beste / kehrwertsumme / buchprobe / absage / gedeckt / nummer“\n' +
           '– „status“ — der Lagebericht\n' +
           '– „warum keine Chance“ — die sechs Bedingungen\n' +
           'Ich rate nie: jede Zahl ist nachgerechnet, jede Aussage gemessen. Ende.';
  }

  /* ---------- Oberflaeche ---------- */
  function baue() {
    if (document.getElementById('funker')) return;
    var k = document.createElement('button');
    k.id = 'funker-knopf';
    k.type = 'button';
    k.title = 'Der Funker: prüft Rechnungen nach und erklärt Begriffe — im Ton der Truppe';
    k.textContent = '🎙 FUNKER';
    var p = document.createElement('div');
    p.id = 'funker';
    p.innerHTML =
      '<div class="fu-kopf">FUNKER <span>prüft nach — rät nie</span>' +
        '<button type="button" class="fu-zu" title="Schließen">×</button></div>' +
      '<div class="fu-log" id="funker-log"></div>' +
      '<form class="fu-eingabe" id="funker-form">' +
        '<input id="funker-frage" type="text" placeholder="z. B. prüfe #48213" autocomplete="off">' +
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
        schreib('Funker auf Empfang, Kamerad — dein Befehl ist mir Auftrag. ' +
                '„prüfe #<Nummer>“ für die Tiefenprüfung; die Nummer steht vorn auf jeder Karte. ' +
                'Ich rechne mit denselben Formeln wie der Scanner und rate nie.', 'funker');
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
