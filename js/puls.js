/* Orion Panel Pro — Das Sonar
 *
 * Ein Radarschirm im Stil eines U-Boot-Sonars. Er ist KEIN Zierrat: der
 * Sweep dreht sich nur, wenn der Scanner wirklich laeuft, und bleibt
 * stehen, wenn er steht.
 *
 * Das ist der ganze Grund, warum es ihn gibt. Ein Ausfall waere sonst
 * still: die Seite zeigt weiter Zahlen, nur eben alte. Eine Animation, die
 * immer laeuft, wuerde genau das verstecken. Deshalb:
 *
 *     Sweep dreht sich   ->  der Scanner hat sich in den letzten 90 s gemeldet
 *     Sweep steht, rot   ->  er meldet sich nicht mehr, die Zahlen sind alt
 *     kein Sweep, grau   ->  wir wissen es nicht (ungemessen, nicht "kaputt")
 *
 * LEISTUNG: alles laeuft ueber CSS-Animationen auf transform und opacity,
 * also auf der Grafikkarte. Es gibt KEINEN Zeichenloop je Bild und kein
 * Canvas. Der einzige JS-Takt laeuft einmal pro Sekunde und setzt nur
 * Klassen und Text. Das war die Vorgabe: der Schirm darf die Seite nicht
 * ausbremsen.
 */

(function (welt) {
  'use strict';

  var K = welt.KONFIG || {};

  /* Der Scanner taktet alle 15 s. 90 s sind sechs verpasste Laeufe —
   * spaet genug, um nicht bei jedem Aussetzer Alarm zu schlagen, frueh
   * genug, um einen echten Ausfall zu sehen. */
  var FRISCH_S = 90;

  /* Wo die Buecher auf dem Schirm sitzen. Feste Plaetze, damit man sie
   * wiedererkennt — ein Sonar, auf dem die Kontakte springen, ist
   * huebsch und nutzlos. Winkel in Grad, Abstand in Prozent des Radius. */
  var PLATZ = {
    polymarket: { winkel:  35, weite: 62 },
    kalshi:     { winkel: 140, weite: 48 },
    smarkets:   { winkel: 215, weite: 68 },
    betfair:    { winkel: 305, weite: 55 },
    sxbet:      { winkel:  95, weite: 78 }
  };

  function elem() { return document.getElementById('orion-puls'); }

  function bauen() {
    var buecher = K.buecher || {};
    var blips = Object.keys(buecher).map(function (id) {
      var b = buecher[id];
      var p = PLATZ[id] || { winkel: 0, weite: 50 };
      var aus = b.aktiv === false;
      /* Polarkoordinaten in Prozent umrechnen, damit der Schirm mitskaliert. */
      var rad = p.winkel * Math.PI / 180;
      var x = 50 + Math.cos(rad) * p.weite / 2;
      var y = 50 + Math.sin(rad) * p.weite / 2;
      return '<div class="s-blip ' + b.chip + (aus ? ' s-aus' : '') + '" ' +
             'data-buch="' + id + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%" ' +
             'title="' + b.name + (aus ? ' — abgeschaltet' : '') + '">' +
               '<span class="s-kern"></span>' +
               '<span class="s-echo"></span>' +
               '<b class="s-kuerzel">' + (b.kurz || '') + '</b>' +
             '</div>';
    }).join('');

    return '' +
      '<div class="s-schirm">' +
        '<div class="s-gitter"></div>' +
        '<div class="s-ringe"><i></i><i></i><i></i></div>' +
        '<div class="s-kreuz"></div>' +
        '<div class="s-sweep"></div>' +
        '<div class="s-blips">' + blips + '</div>' +
        '<div class="s-rauschen"></div>' +
        '<div class="s-kontakt" id="s-kontakt"></div>' +
      '</div>' +
      '<div class="s-tafel">' +
        '<div class="s-zeile s-titel">' +
          '<span class="s-led" id="s-led"></span>' +
          '<b id="s-status">SONAR AKTIV</b>' +
        '</div>' +
        '<div class="s-gross"><span id="s-zahl">—</span><small>Märkte im Sektor</small></div>' +
        '<div class="s-werte" id="s-werte"></div>' +
        '<div class="s-bilanz" id="s-bilanz"></div>' +
        '<div class="s-log" id="s-log"></div>' +
      '</div>';
  }

  var gebaut = false;
  var letzterLauf = null;
  var letztePaare = null;

  function zeile(text, klasse) {
    var log = document.getElementById('s-log');
    if (!log) return;
    var d = document.createElement('div');
    d.className = 's-logzeile' + (klasse ? ' ' + klasse : '');
    var t = new Date();
    var uhr = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) +
              ':' + ('0' + t.getSeconds()).slice(-2);
    d.textContent = uhr + '  ' + text;
    log.insertBefore(d, log.firstChild);
    /* Nur die letzten Meldungen behalten — ein Protokoll, das endlos
     * waechst, frisst mit der Zeit den Speicher des Browsers. */
    while (log.childNodes.length > 4) log.removeChild(log.lastChild);
  }

  function auffrischen(e) {
    var w = elem();
    if (!w) return;
    if (!gebaut) { w.innerHTML = bauen(); gebaut = true; zeile('Sonar hochgefahren', 's-grau'); }

    var u = (e && e.uebersicht) || {};
    var lauf = (e && e.lauf) || {};

    /* Das Alter kommt fertig vom Server (orion_uebersicht), gegen DESSEN
     * Uhr. Aus einem Zeitstempel gegen die Browseruhr zu rechnen waere
     * ungenauer — die kann falsch gestellt sein. */
    function buchAlter(id) {
      var b = u[id];
      if (!b || typeof b.alter_s !== 'number' || !isFinite(b.alter_s)) return null;
      return b.alter_s;
    }

    var sAlter = buchAlter('polymarket');
    if (sAlter === null && lauf.gelaufen_am) {
      var t = Date.parse(lauf.gelaufen_am);
      if (!isNaN(t)) sAlter = Math.round((Date.now() - t) / 1000);
    }
    var laeuft = sAlter !== null && sAlter <= FRISCH_S;

    w.classList.toggle('s-an', laeuft);
    w.classList.toggle('s-tot', sAlter !== null && !laeuft);

    var led = document.getElementById('s-led');
    var status = document.getElementById('s-status');
    var zahl = document.getElementById('s-zahl');
    var werte = document.getElementById('s-werte');

    var maerkte = Number(lauf.pm_maerkte);
    if (!isFinite(maerkte) || maerkte <= 0) maerkte = Number((u.polymarket || {}).maerkte);
    if (zahl) zahl.textContent = isFinite(maerkte) && maerkte > 0 ? maerkte : '—';

    var paare = Number(lauf.paare);
    if (!isFinite(paare)) paare = Number((u.polymarket || {}).paare);
    var dauer = Number(lauf.dauer_ms);
    if (!isFinite(dauer)) dauer = Number((u.polymarket || {}).dauer_ms);

    if (status && led) {
      if (sAlter === null) {
        led.className = 's-led s-grau';
        status.textContent = 'KEIN SIGNAL';
      } else if (laeuft) {
        led.className = 's-led s-gruen';
        status.textContent = 'SONAR AKTIV';
      } else {
        led.className = 's-led s-rot';
        status.textContent = 'AUSFALL — ' + Math.round(sAlter / 60) + ' MIN';
      }
    }

    if (werte) {
      werte.innerHTML =
        '<span>PING <b>' + (sAlter === null ? '—' : sAlter + ' s') + '</b></span>' +
        '<span>LAUFZEIT <b>' + (isFinite(dauer) ? (dauer / 1000).toFixed(1) + ' s' : '—') + '</b></span>' +
        '<span>KONTAKTE <b>' + (isFinite(paare) ? paare : '—') + '</b></span>';
    }

    /* ---------- GEFECHTSBILANZ ----------
     *
     * Die rechte Hälfte der Tafel stand leer. Sie beantwortet jetzt die vier
     * Fragen, die man an ein Sonar stellt: was ist im Visier, was davon ist
     * scharf, was wurde aussortiert, und was ist durchgerutscht.
     *
     * JEDE ZAHL HAT EINEN SATZ DANEBEN. Eine Kennzahl ohne Erklärung ist
     * Deko — und dieser Schirm ist ausdrücklich kein Zierrat.
     */
    var bilanz = document.getElementById('s-bilanz');
    if (bilanz && e) {
      var chancen = (e.chancen || []).length;
      var knapp = (e.knapp || []).length;
      var veraltet = (e.veraltetHoch || []).length;
      var verlauf = e.verlauf || [];
      var imVisier = chancen + knapp + veraltet;

      /* Aussortiert: Zeilen, die eine Nachkontrolle als falsch markiert hat.
       * Seit dem 13.8. ist das vor allem die Buchstimmigkeit — ein Gegenbuch,
       * dessen eigene Kurse zusammen unter 100 % ergeben, ist nicht
       * handelbar, und was darauf beruht, ist keine Chance. */
      var verworfen = 0;
      for (var v = 0; v < verlauf.length; v++) {
        if (verlauf[v].pruefung === 'falsch') verworfen++;
      }

      /* Verpasst: war einmal über der Schwelle, ist jetzt weg. Genau die
       * Frage "hätte sich das gelohnt?" — beantwortet vom HÖCHSTSTAND, nicht
       * vom Zufallswert beim Verschwinden. */
      var schwelle = (K.mindestRendite || 2);
      var verpasst = 0;
      for (var p = 0; p < verlauf.length; p++) {
        var best = verlauf[p].beste_rendite;
        if (verlauf[p].pruefung === 'falsch') continue;
        if (best !== null && best !== undefined && Number(best) >= schwelle) verpasst++;
      }

      /* Beute: was die erfassten Ziele zusammen einbrächten, wenn man ALLE
       * bis zum Anschlag setzt. Nicht "Rendite" — Rendite ist ein
       * Verhältnis, das hier ist Geld. */
      var beute = 0, beuteBekannt = true;
      for (var c = 0; c < (e.chancen || []).length; c++) {
        var g = e.chancen[c].max_gewinn;
        if (g === null || g === undefined || !isFinite(Number(g))) { beuteBekannt = false; continue; }
        beute += Number(g);
      }
      var fx = (welt.Anzeige && welt.Anzeige.waehrung) || null;

      function zeileB(name, wert, erklaerung, klasse) {
        return '<div class="s-bz' + (klasse ? ' ' + klasse : '') + '">' +
                 '<span class="s-bz-name">' + name + '</span>' +
                 '<span class="s-bz-wert">' + wert + '</span>' +
                 '<span class="s-bz-text">' + erklaerung + '</span>' +
               '</div>';
      }

      bilanz.innerHTML =
        '<div class="s-bz-kopf">GEFECHTSBILANZ</div>' +
        zeileB('IM VISIER', imVisier,
               'Paare, die gerade beobachtet werden') +
        zeileB('ERFASST', chancen,
               'davon über ' + schwelle.toFixed(1) + ' % <i>und</i> mit Geld dahinter',
               chancen > 0 ? 's-bz-gut' : '') +
        zeileB('VERWORFEN', verworfen,
               'als nicht handelbar aussortiert',
               verworfen > 0 ? 's-bz-rot' : '') +
        zeileB('DURCHGERUTSCHT', verpasst,
               'waren über der Schwelle, sind wieder weg') +
        zeileB('BEUTE', (beute > 0 ? (beute).toFixed(2) : '0.00') + (beuteBekannt ? '' : '+'),
               beuteBekannt
                 ? 'was die erfassten Ziele zusammen brächten'
                 : 'mindestens — bei einem Ziel ist die Menge unbekannt',
               beute > 0 ? 's-bz-gut' : '');
    }

    /* Blips: leuchtet, wenn von diesem Buch frische Kurse kommen. */
    var grenze = { polymarket: FRISCH_S, kalshi: K.kalshiMaxAlterS || 600,
                   smarkets: K.smarketsMaxAlterS || 900, betfair: K.bridgeMaxAlterS || 300 };
    var blips = w.querySelectorAll('.s-blip');
    for (var i = 0; i < blips.length; i++) {
      var id = blips[i].getAttribute('data-buch');
      var b = (K.buecher || {})[id] || {};
      if (b.aktiv === false) continue;               // abgeschaltet bleibt stumm
      var a = id === 'polymarket' ? sAlter : buchAlter(id);
      var frisch = a !== null && a <= (grenze[id] || 600);
      blips[i].classList.toggle('s-frisch', frisch);
      blips[i].classList.toggle('s-still', a !== null && !frisch);
    }

    /* KONTAKT: ein neuer Lauf ist eingelaufen. */
    var kennung = lauf.gelaufen_am || (sAlter !== null ? 'a' + sAlter : null);
    if (kennung && kennung !== letzterLauf) {
      var ersterLauf = letzterLauf === null;
      letzterLauf = kennung;

      var k = document.getElementById('s-kontakt');
      if (k && laeuft) {
        k.classList.remove('s-treffer');
        void k.offsetWidth;                          // Animation neu starten
        k.classList.add('s-treffer');
      }

      /* Nur melden, wenn sich die Lage WIRKLICH geaendert hat. Ein
       * Protokoll, das im Sekundentakt dasselbe meldet, liest niemand. */
      if (!ersterLauf && isFinite(paare) && paare !== letztePaare) {
        if (letztePaare !== null && paare > letztePaare) {
          zeile('KONTAKT — ' + (paare - letztePaare) + ' neu, ' + paare + ' im Sektor', 's-treffer-log');
        } else if (letztePaare !== null) {
          zeile('Kontakt verloren — ' + paare + ' im Sektor', 's-grau');
        }
      }
      if (isFinite(paare)) letztePaare = paare;
    }
  }

  var lief = false;
  function takt() {
    try { auffrischen(welt.letztesErgebnis || null); } catch (e) { /* nie die Seite mitreissen */ }
  }
  function start() {
    if (lief) return;
    lief = true;
    takt();
    setInterval(takt, 1000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  welt.Puls = { auffrischen: auffrischen, start: start };

})(typeof globalThis !== 'undefined' ? globalThis : this);
