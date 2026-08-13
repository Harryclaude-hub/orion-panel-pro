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
        '<div class="s-log" id="s-log"></div>' +
      '</div>' +

      /* ---------- GEFECHTSSTAND (rechte Seite) ----------
       *
       * Ein festes Gerippe, einmal gebaut. auffrischen() setzt nur noch
       * Zahlen und Balkenbreiten — wuerde die Tafel jede Sekunde neu
       * geschrieben, staerben alle CSS-Uebergaenge und der Schirm flackerte.
       *
       * Gleiche Hoehe wie der Schirm (190 px), damit das ganze Sonar seine
       * alte Hoehe behaelt. Jede Zahl traegt ihre Erklaerung als title;
       * ausfuehrlich stehen die Begriffe auf angaben.html. */
      '<div class="s-hud">' +
        '<div class="s-hud-ring"></div>' +
        '<div class="s-hud-scan"></div>' +
        '<svg class="s-hud-jet" viewBox="0 0 64 20" aria-hidden="true">' +
          '<path fill="currentColor" d="M2 10 L22 8 L30 2 L33 8 L52 9 L62 10 L52 11 L33 12 L30 18 L22 12 Z"/>' +
        '</svg>' +
        '<div class="s-hud-kopf"><span class="s-led s-gruen" id="s-hud-led"></span>GEFECHTSSTAND</div>' +
        '<div class="s-hz" title="Alle Paare, die gerade beobachtet werden — Chancen, knappe und veraltete zusammen.">' +
          '<span>IM VISIER</span><b id="s-hud-visier">—</b></div>' +
        '<div class="s-hud-balken" title="Zusammensetzung: grün = erfasste Chancen, grau = knapp darunter, orange = Kurse veraltet.">' +
          '<i id="s-hud-b1"></i><i id="s-hud-b2"></i><i id="s-hud-b3"></i></div>' +
        '<div class="s-hz s-hz-gut" title="Über der Schwelle UND mit Geld dahinter — die Ziele, auf die man schießen kann.">' +
          '<span>ERFASST</span><b class="s-ziel" id="s-hud-erfasst"><i></i><i></i><i></i><i></i>—</b></div>' +
        '<div class="s-hz s-hz-rot" title="Von der Nachkontrolle als nicht handelbar aussortiert — meist ein Gegenbuch, dessen eigene Kurse zusammen unter 100 % ergeben.">' +
          '<span>VERWORFEN</span><b id="s-hud-verworfen">—</b></div>' +
        '<div class="s-hz" title="Waren über der Schwelle und sind wieder verschwunden, bevor jemand geschossen hat.">' +
          '<span>DURCHGERUTSCHT</span><b id="s-hud-verpasst">—</b></div>' +
        '<div class="s-hud-beute" title="Was die erfassten Ziele zusammen einbrächten, wenn man jedes bis zum Anschlag setzt. In Dollar; die Karte rechnet in Euro um.">' +
          '<span>BEUTE</span><b id="s-hud-beute">—</b></div>' +
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

    /* ---------- GEFECHTSSTAND ----------
     *
     * Nur Zahlen und Balkenbreiten setzen, NIE das Gerippe neu schreiben:
     * innerHTML im Sekundentakt wuerde jede CSS-Animation neu starten und
     * die Uebergaenge der Balken toeten. Dieselbe Regel wie in anzeige.js
     * (Fehlerklasse 6). */
    if (e) {
      var chancen = (e.chancen || []).length;
      var knapp = (e.knapp || []).length;
      var veraltet = (e.veraltetHoch || []).length;
      var verlauf = e.verlauf || [];
      var imVisier = chancen + knapp + veraltet;

      /* Aussortiert: von der Nachkontrolle als falsch markiert — seit dem
       * 13.8. vor allem die Buchstimmigkeit. Verpasst: der HOECHSTSTAND lag
       * ueber der Schwelle, denn er beantwortet "haette sich das gelohnt?". */
      var schwelle = (K.mindestRendite || 2);
      var verworfen = 0, verpasst = 0;
      for (var v = 0; v < verlauf.length; v++) {
        if (verlauf[v].pruefung === 'falsch') { verworfen++; continue; }
        var best = verlauf[v].beste_rendite;
        if (best !== null && best !== undefined && Number(best) >= schwelle) verpasst++;
      }

      /* Beute ist GELD, nicht Rendite: die Summe der erreichbaren Gewinne. */
      var beute = 0, beuteBekannt = true;
      for (var c = 0; c < (e.chancen || []).length; c++) {
        var g = e.chancen[c].max_gewinn;
        if (g === null || g === undefined || !isFinite(Number(g))) { beuteBekannt = false; continue; }
        beute += Number(g);
      }

      function setz(id, text) {
        var el = document.getElementById(id);
        if (el && el.lastChild) {
          /* Der Zahlknoten ist immer der LETZTE Textknoten — vor ihm koennen
           * die Zielmarken-<i> stehen, die bleiben muessen. */
          if (el.lastChild.nodeType === 3) { if (el.lastChild.nodeValue !== text) el.lastChild.nodeValue = text; }
          else el.appendChild(document.createTextNode(text));
        } else if (el) el.textContent = text;
      }
      setz('s-hud-visier', String(imVisier));
      setz('s-hud-erfasst', String(chancen));
      setz('s-hud-verworfen', String(verworfen));
      setz('s-hud-verpasst', String(verpasst));
      setz('s-hud-beute', beute.toFixed(2) + ' $' + (beuteBekannt ? '' : ' +'));

      /* Der Lagebalken: Anteile von IM VISIER. Breiten in Prozent, mit
       * CSS-Uebergang — deshalb style.width statt neu bauen. */
      function breite(id, anteil) {
        var el = document.getElementById(id);
        if (el) el.style.width = (imVisier > 0 ? (100 * anteil / imVisier) : 0).toFixed(1) + '%';
      }
      breite('s-hud-b1', chancen);
      breite('s-hud-b2', knapp);
      breite('s-hud-b3', veraltet);

      var hudLed = document.getElementById('s-hud-led');
      if (hudLed) hudLed.className = 's-led ' + (chancen > 0 ? 's-gruen' : (laeuft ? 's-grau' : 's-rot'));
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
