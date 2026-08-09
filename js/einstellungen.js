/* Orion Panel Pro — Einstellungen
 *
 * Die Betfair-Zugangsdaten bleiben in diesem Browser und wandern von hier
 * ausschliesslich in eine Datei, die der Nutzer selbst herunterlaedt.
 * Sie werden NICHT an Supabase geschickt. Ein Passwort zu einem Geldkonto
 * gehoert nicht in eine Datenbank, die von aussen lesbar ist.
 */

(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-betfair';
  var FELDER = ['bfUser', 'bfPass', 'bfKey', 'bridgeToken'];

  function el(id) { return document.getElementById(id); }

  function sagen(text, art) {
    var r = el('rueckmeldung');
    r.textContent = text;
    r.style.color = art === 'gut' ? 'var(--gruen)' : (art === 'rot' ? 'var(--rot)' : 'var(--text-leise)');
  }

  function lies() {
    try {
      var roh = localStorage.getItem(SCHLUESSEL);
      return roh ? JSON.parse(roh) : null;
    } catch (e) { return null; }
  }

  function fuellen() {
    var d = lies();
    if (!d) return false;
    FELDER.forEach(function (f) { if (d[f]) el(f).value = d[f]; });
    return true;
  }

  function sammeln() {
    var d = {};
    FELDER.forEach(function (f) { d[f] = el(f).value.trim(); });
    return d;
  }

  function fehlende(d) {
    return FELDER.filter(function (f) { return !d[f]; });
  }

  function speichern() {
    var d = sammeln();
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(d));
      if (localStorage.getItem(SCHLUESSEL)) {
        var f = fehlende(d);
        sagen(f.length ? 'Gemerkt. Es fehlen noch: ' + f.join(', ') : 'Gemerkt, alle vier Felder sind da.',
              f.length ? null : 'gut');
        return;
      }
    } catch (e) { /* Speicher gesperrt */ }
    sagen('Der Browser lässt kein Speichern zu. Die Datei lässt sich trotzdem erzeugen.', 'rot');
  }

  function herunterladen() {
    var d = sammeln();
    var f = fehlende(d);
    if (f.length) {
      /* Nie disabled (Fehlerklasse 3): der Knopf reagiert und nennt den Grund. */
      sagen('Es fehlen: ' + f.join(', ') + '. Ohne diese Felder kann sich die Bridge nicht anmelden.', 'rot');
      return;
    }

    var inhalt = {
      _ANLEITUNG: 'Diese Datei gehoert neben die Bridge auf deinen PC. Sie wird nie hochgeladen.',
      betfairUsername: d.bfUser,
      betfairPassword: d.bfPass,
      betfairAppKey: d.bfKey,
      bridgeToken: d.bridgeToken,
      bridgeUrl: welt.KONFIG.supabase + '/functions/v1/bf-bridge',
      minRoiPercent: welt.KONFIG.mindestRendite,
      minRoiSchnellPercent: 2.5,
      minStake: 20,
      feeBetfairPercent: 5,
      pmFallbackFeePercent: 7,
      excludeEventTypeIds: ['7', '4339']
    };

    var blob = new Blob([JSON.stringify(inhalt, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    sagen('Datei erzeugt. Sie gehört in denselben Ordner wie die Bridge.', 'gut');
  }

  function loeschen() {
    try { localStorage.removeItem(SCHLUESSEL); } catch (e) {}
    FELDER.forEach(function (f) { el(f).value = ''; });
    sagen('Aus diesem Browser gelöscht.', 'gut');
  }

  /* ---------- Zertifikat, ohne Terminal ---------- */

  function zertMeldung(text, art) {
    var r = el('zertMeldung');
    if (!r) return;
    r.textContent = text;
    r.style.color = art === 'gut' ? 'var(--gruen)' : (art === 'rot' ? 'var(--rot)' : 'var(--text-leise)');
  }

  function zertErzeugen() {
    zertMeldung('Der Server erzeugt das Paar, das dauert einen Moment ...');
    fetch(welt.KONFIG.supabase + '/functions/v1/orion-zertifikat', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok || !d.zertifikat) throw new Error(d.fehler || 'keine Antwort');
        var blob = new Blob([d.zertifikat], { type: 'application/x-pem-file' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'betfair.crt';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        zertMeldung('Fertig in ' + d.dauer_ms + ' ms. betfair.crt ist heruntergeladen. ' +
                    'Der private Schlüssel bleibt auf dem Server.', 'gut');
      })
      .catch(function (e) { zertMeldung('Ging nicht: ' + e.message, 'rot'); });
  }

  function zertStand() {
    zertMeldung('sehe nach ...');
    fetch(welt.KONFIG.supabase + '/functions/v1/orion-zertifikat?stand=1')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.fehler || 'keine Antwort');
        zertMeldung(d.vorhanden
          ? 'Ein Zertifikat liegt bereits auf dem Server, erzeugt am ' +
            new Date(d.erstellt_am).toLocaleString('de-AT') +
            '. Ein neues zu erzeugen ersetzt das alte — dann muss auch bei Betfair neu hochgeladen werden.'
          : 'Noch keines vorhanden.', d.vorhanden ? 'gut' : null);
      })
      .catch(function (e) { zertMeldung('Ging nicht: ' + e.message, 'rot'); });
  }

  function start() {
    var hatte = fuellen();
    sagen(hatte ? 'Gespeicherte Angaben geladen.' : 'Noch nichts gespeichert.');
    el('speichern').addEventListener('click', speichern);
    el('herunterladen').addEventListener('click', herunterladen);
    el('loeschen').addEventListener('click', loeschen);
    if (el('zertErzeugen')) el('zertErzeugen').addEventListener('click', zertErzeugen);
    if (el('zertStand')) el('zertStand').addEventListener('click', zertStand);
  }

  document.addEventListener('DOMContentLoaded', function () {
    welt.Sperre.start(start);
  });

})(typeof globalThis !== 'undefined' ? globalThis : this);
