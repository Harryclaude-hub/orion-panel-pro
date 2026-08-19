/* Orion Panel — Speicher (20.8.2026)
 *
 * Der Merkzettel des Auftraggebers: jeder Fund traegt einen
 * Speichern-Knopf; gespeicherte Funde liegen in der Tabelle
 * orion_gespeichert (Supabase, RLS: anon darf lesen/anlegen/loeschen)
 * und sind damit auf JEDEM Geraet dieselben — nicht nur in einem
 * Browser. Die Seite gespeichert.html zeigt sie an.
 *
 * FUNKTIONS-SCHICHT, aber bewusst schmal: dieses Modul kennt nur
 * drei Handgriffe (speichere, entferne, liste) und fasst weder
 * Rechenwege noch den Takt an. Gespeichert wird der SCHNAPPSCHUSS
 * der Zeile zum Zeitpunkt des Klicks — so bleibt nachlesbar, wie die
 * Chance aussah, als sie gemerkt wurde, auch wenn sie laengst vorbei
 * ist. Die Kurse darin sind also HISTORISCH, nicht live; die Seite
 * sagt das dazu.
 *
 * Drei Zustaende, nie zwei: jeder Weg meldet Erfolg, "war schon da"
 * oder den Fehler — nichts schlaegt still fehl. */

(function (welt) {
  'use strict';

  function kopf() {
    var K = welt.KONFIG || {};
    return {
      apikey: K.key, authorization: 'Bearer ' + K.key,
      'content-type': 'application/json'
    };
  }
  function url(pfad) { return (welt.KONFIG || {}).supabase + '/rest/v1/' + pfad; }

  /* Die Zeile zum Schluessel: erst im letzten Ergebnis suchen (kein
   * Netz), sonst frisch aus der Datenbank laden (beitrag.html hat kein
   * letztesErgebnis). */
  function zeileZu(schluessel) {
    var e = welt.letztesErgebnis;
    if (e) {
      var listen = [e.chancen, e.knapp, e.verlauf, e.falsch];
      for (var i = 0; i < listen.length; i++) {
        var l = listen[i] || [];
        for (var j = 0; j < l.length; j++) {
          if (l[j] && l[j].schluessel === schluessel) return Promise.resolve(l[j]);
        }
      }
    }
    return fetch(url('orion_funde?schluessel=eq.' + encodeURIComponent(schluessel) + '&limit=1'),
                 { headers: kopf() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (z) {
        if (!z || !z.length) throw new Error('Fund nicht mehr in der Datenbank');
        return z[0];
      });
  }

  function speichere(schluessel) {
    return zeileZu(schluessel).then(function (f) {
      return fetch(url('orion_gespeichert?on_conflict=schluessel'), {
        method: 'POST',
        headers: Object.assign(kopf(), { prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify({ schluessel: schluessel, zeile: f })
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120)); });
        return true;
      });
    });
  }

  function entferne(schluessel) {
    return fetch(url('orion_gespeichert?schluessel=eq.' + encodeURIComponent(schluessel)), {
      method: 'DELETE', headers: kopf()
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    });
  }

  function liste() {
    return fetch(url('orion_gespeichert?select=schluessel,zeile,gespeichert_am&order=gespeichert_am.desc&limit=200'),
                 { headers: kopf() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /* SCHWEBENDE BESTAETIGUNG statt Knopftext: die Karten werden alle
   * paar Sekunden neu geschrieben, ein umgeschriebener Knopf waere nach
   * dem naechsten Zeichnen wieder weg und saehe aus, als haette der
   * Klick nichts getan (beim Bauen am 20.8. genau so passiert). Der
   * Zettel haengt am body und ueberlebt jedes Neuzeichnen. */
  function zettel(text, gut) {
    var z = document.createElement('div');
    z.textContent = text;
    z.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);' +
      'z-index:9999;padding:10px 18px;border-radius:10px;font-size:14px;' +
      'background:' + (gut ? '#12251A' : '#2A1616') + ';color:' + (gut ? '#7CD69A' : '#E08585') + ';' +
      'border:1px solid ' + (gut ? '#2E5C3F' : '#5C2E2E') + ';box-shadow:0 6px 24px rgba(0,0,0,.5)';
    document.body.appendChild(z);
    setTimeout(function () { z.remove(); }, 3500);
  }

  /* Der Knopf auf den Karten. Dokument-Zuhoerer wie beim Kopieren-Knopf. */
  document.addEventListener('click', function (ev) {
    var k = ev.target && ev.target.closest ? ev.target.closest('.chip.speich') : null;
    if (!k) return;
    var s = k.getAttribute('data-schluessel');
    if (!s) return;
    k.disabled = true;
    k.textContent = 'speichert …';
    speichere(s).then(function () {
      zettel('★ Gespeichert — liegt jetzt unter „Gespeichert“, auf jedem Gerät.', true);
    }, function (e) {
      zettel('Speichern fehlgeschlagen: ' + e.message, false);
      k.disabled = false;
    });
  });

  welt.Speicher = { speichere: speichere, entferne: entferne, liste: liste };

})(typeof globalThis !== 'undefined' ? globalThis : this);
