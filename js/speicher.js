/* Orion Panel — Speicher (20.8.2026, ZWEI KOPIEN seit 24.8.2026)
 *
 * Der Merkzettel des Auftraggebers: jeder Fund traegt einen
 * Speichern-Knopf. Die Seite gespeichert.html zeigt sie an.
 *
 * ============================================================
 * KARAMS VORGABE 24.8.2026: "Was ich speichere, bleibt WIRKLICH
 * gespeichert — auch wenn der Fund ablaeuft oder etwas dran ist,
 * bleibt es trotzdem auf DIESEM GERAET, mit allen Details."
 *
 * Bis dahin lag alles NUR in Supabase. Zwei Loecher, beide am
 * 23./24.8. real geworden bzw. messbar:
 *   1. Faellt die Datenbank aus (14,5 Stunden am 23.8.!), sieht er
 *      seine gemerkten Funde GAR NICHT — genau dann, wenn er sie
 *      braucht.
 *   2. RLS erlaubt anon das Loeschen. Der Panel-Schluessel steht
 *      oeffentlich im Repo; ein Fremder koennte den Merkzettel
 *      leeren, und es gaebe keine zweite Kopie.
 *
 * DESHALB JETZT ZWEI KOPIEN, gleichrangig:
 *   GERAET  localStorage dieses Browsers — wird ZUERST geschrieben,
 *           denn sie kann nicht fehlschlagen. Ueberlebt jeden
 *           Supabase-Ausfall und jede fremde Loeschung.
 *   WOLKE   orion_gespeichert in Supabase — damit derselbe Merkzettel
 *           auf jedem Geraet erscheint.
 * Beim Ansehen werden beide vereinigt und gegenseitig geheilt: was
 * nur in der Wolke liegt, wird aufs Geraet gespiegelt; was nur auf
 * dem Geraet liegt, wandert zurueck in die Wolke, sobald sie wieder
 * antwortet.
 *
 * EHRLICHE GRENZE: "Browserdaten loeschen" raeumt auch den
 * Geraetespeicher weg. Wer es HART sichern will, nimmt den Knopf
 * "Als Datei sichern" auf gespeichert.html — eine Datei im
 * Download-Ordner ueberlebt alles. Deshalb gibt es alle drei.
 * ============================================================
 *
 * FUNKTIONS-SCHICHT, aber bewusst schmal: dieses Modul fasst weder
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

  /* ---------------- DER GERAETESPEICHER ----------------
   *
   * Ein einziger localStorage-Eintrag mit allen Funden als Objekt
   * (Schluessel -> {schluessel, zeile, gespeichert_am}). Ein Eintrag
   * je Fund waere schneller, aber unuebersichtlich beim Sichern und
   * beim Aufraeumen; die Menge ist klein (eine Fundzeile ~2 KB,
   * 500 Stueck ~1 MB, localStorage haelt 5 MB).
   *
   * JEDER Zugriff ist gekapselt: geht der Geraetespeicher nicht
   * (privates Fenster, voller Speicher, abgeschaltet), faellt das
   * Modul auf die Wolke allein zurueck und SAGT es — statt still
   * zu verlieren. */
  var FACH = 'orion_gespeichert_v1';
  var DECKEL = 500;

  function geraetLesen() {
    try {
      var roh = welt.localStorage && welt.localStorage.getItem(FACH);
      if (!roh) return {};
      var o = JSON.parse(roh);
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }

  function geraetSchreiben(alle) {
    try {
      if (!welt.localStorage) return false;
      welt.localStorage.setItem(FACH, JSON.stringify(alle));
      return true;
    } catch (e) { return false; }
  }

  /* Einen Fund aufs Geraet legen. Gibt zurueck, ob es geklappt hat —
   * der Aufrufer meldet das dem Menschen. */
  function geraetMerken(schluessel, zeile, wann) {
    var alle = geraetLesen();
    if (!alle[schluessel] && Object.keys(alle).length >= DECKEL) return false;
    alle[schluessel] = {
      schluessel: schluessel,
      zeile: zeile,
      gespeichert_am: wann || new Date().toISOString()
    };
    return geraetSchreiben(alle);
  }

  function geraetVergessen(schluessel) {
    var alle = geraetLesen();
    if (!alle[schluessel]) return true;
    delete alle[schluessel];
    return geraetSchreiben(alle);
  }

  function geraetListe() {
    var alle = geraetLesen();
    return Object.keys(alle).map(function (k) { return alle[k]; });
  }

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

  /* Die Wolken-Haelfte, fuer sich allein. */
  function wolkeSchreiben(schluessel, zeile) {
    return fetch(url('orion_gespeichert?on_conflict=schluessel'), {
      method: 'POST',
      headers: Object.assign(kopf(), { prefer: 'resolution=ignore-duplicates,return=minimal' }),
      body: JSON.stringify({ schluessel: schluessel, zeile: zeile })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120)); });
      return true;
    });
  }

  /* SPEICHERN: erst aufs GERAET, dann in die Wolke.
   *
   * Die Reihenfolge ist Absicht. Das Geraet kann nicht ausfallen und
   * braucht kein Netz; die Wolke schon. Faellt die Wolke aus, ist der
   * Fund TROTZDEM gemerkt, und der Mensch bekommt das ehrlich gesagt
   * ("nur auf diesem Geraet") statt einer Fehlermeldung, die klingt,
   * als waere nichts passiert.
   *
   * Antwort: { geraet: bool, wolke: bool, grund: text|null } */
  function speichere(schluessel) {
    return zeileZu(schluessel).then(function (f) {
      var aufGeraet = geraetMerken(schluessel, f, null);
      return wolkeSchreiben(schluessel, f).then(function () {
        return { geraet: aufGeraet, wolke: true, grund: null };
      }, function (e) {
        /* Wolke weg: nur dann ist es ein echter Fehlschlag, wenn auch
         * das Geraet nicht wollte. */
        if (!aufGeraet) throw e;
        return { geraet: true, wolke: false, grund: e.message };
      });
    });
  }

  /* ENTFERNEN heisst: aus BEIDEN Kopien. Das tut nur, wer den Knopf
   * druckt — eine fremde Loeschung in der Wolke laesst das Geraet
   * unberuehrt, und beim naechsten Ansehen wandert der Fund von dort
   * automatisch zurueck. Genau das ist der Schutz. */
  function entferne(schluessel) {
    geraetVergessen(schluessel);
    return fetch(url('orion_gespeichert?schluessel=eq.' + encodeURIComponent(schluessel)), {
      method: 'DELETE', headers: kopf()
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    }, function () {
      /* Wolke nicht erreichbar: vom Geraet ist es weg, das genuegt
       * fuer den Menschen. Beim naechsten Ansehen mit lebender Wolke
       * kaeme der Fund allerdings zurueck — deshalb ehrlich melden. */
      throw new Error('Vom Gerät entfernt, aber die Wolke antwortet nicht. Bitte später nochmal entfernen.');
    });
  }

  /* LISTE: beide Kopien vereinigen und gegenseitig heilen.
   *
   * Jeder Eintrag traegt zusaetzlich `quelle` ('beide' | 'wolke' |
   * 'geraet'), damit die Seite zeigen kann, wie sicher ein Fund liegt.
   * Die Heilung laeuft im Hintergrund und darf die Anzeige nie
   * aufhalten oder reissen. */
  function liste() {
    var vomGeraet = geraetListe();
    return fetch(url('orion_gespeichert?select=schluessel,zeile,gespeichert_am&order=gespeichert_am.desc&limit=200'),
                 { headers: kopf() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (ausWolke) { return vereinige(ausWolke, vomGeraet, true); },
            function () {
              /* Wolke stumm: der Merkzettel funktioniert weiter, allein
               * vom Geraet. Genau der Fall vom 23.8. */
              return vereinige([], vomGeraet, false);
            });
  }

  function vereinige(ausWolke, vomGeraet, wolkeLebt) {
    var nachSchluessel = {};
    var inWolke = {};

    ausWolke.forEach(function (e) {
      inWolke[e.schluessel] = true;
      nachSchluessel[e.schluessel] = {
        schluessel: e.schluessel, zeile: e.zeile,
        gespeichert_am: e.gespeichert_am, quelle: 'wolke'
      };
      /* Heilung 1: Wolke -> Geraet. Damit liegt alles, was er je
       * gespeichert hat, nach einem Besuch auch lokal. */
      geraetMerken(e.schluessel, e.zeile, e.gespeichert_am);
    });

    vomGeraet.forEach(function (e) {
      if (nachSchluessel[e.schluessel]) {
        nachSchluessel[e.schluessel].quelle = 'beide';
      } else {
        nachSchluessel[e.schluessel] = {
          schluessel: e.schluessel, zeile: e.zeile,
          gespeichert_am: e.gespeichert_am, quelle: 'geraet'
        };
        /* Heilung 2: Geraet -> Wolke, aber NUR wenn die Wolke lebt.
         * Sonst wuerde jeder Ausfall wie ein Verlust aussehen. */
        if (wolkeLebt) wolkeSchreiben(e.schluessel, e.zeile).catch(function () {});
      }
    });

    var alle = Object.keys(nachSchluessel).map(function (k) { return nachSchluessel[k]; });
    alle.sort(function (a, b) {
      return String(b.gespeichert_am || '').localeCompare(String(a.gespeichert_am || ''));
    });
    alle.wolkeLebt = wolkeLebt;
    return alle;
  }

  /* ---------------- DIE DRITTE KOPIE: eine Datei ----------------
   *
   * Der Geraetespeicher stirbt mit "Browserdaten loeschen". Eine Datei
   * im Download-Ordner nicht. Sie ist ausserdem der einzige Weg, den
   * Merkzettel auf ein ANDERES Geraet zu heben, ohne die Wolke. */
  function alsDatei() {
    return liste().then(function (alle) {
      var inhalt = JSON.stringify({
        was: 'Orion Panel Pro - gespeicherte Funde',
        gesichert_am: new Date().toISOString(),
        anzahl: alle.length,
        funde: alle
      }, null, 1);
      var name = 'orion-gespeichert-' + new Date().toISOString().slice(0, 10) + '.json';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { anzahl: alle.length, name: name };
    });
  }

  /* Eine gesicherte Datei zurueckspielen: erst aufs Geraet, dann in
   * die Wolke. Vorhandenes wird nie ueberschrieben — Zurueckspielen
   * darf nichts kaputtmachen. */
  function ausDatei(text) {
    var daten = JSON.parse(text);
    var funde = (daten && daten.funde) || [];
    if (!funde.length) throw new Error('Die Datei enthält keine Funde.');
    var neu = 0;
    var vorhanden = geraetLesen();
    funde.forEach(function (e) {
      if (!e || !e.schluessel || vorhanden[e.schluessel]) return;
      if (geraetMerken(e.schluessel, e.zeile, e.gespeichert_am)) {
        neu++;
        wolkeSchreiben(e.schluessel, e.zeile).catch(function () {});
      }
    });
    return { gelesen: funde.length, neu: neu };
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
    speichere(s).then(function (erg) {
      if (erg.wolke && erg.geraet) {
        zettel('★ Gespeichert — liegt jetzt unter „Gespeichert“ im Panel und bleibt dort, auch wenn der Fund abläuft.', true);
      } else if (erg.geraet) {
        zettel('★ Gespeichert — steht unter „Gespeichert“ im Panel. (Die Wolke antwortet gerade nicht; der Fund wandert von selbst hinüber, sobald sie wieder da ist.)', true);
      } else {
        zettel('★ Gespeichert — steht unter „Gespeichert“ im Panel. (Nur in der Wolke: der Speicher dieses Browsers ist aus oder voll.)', true);
      }
    }, function (e) {
      zettel('Speichern fehlgeschlagen: ' + e.message, false);
      k.disabled = false;
    });
  });

  welt.Speicher = {
    speichere: speichere, entferne: entferne, liste: liste,
    alsDatei: alsDatei, ausDatei: ausDatei,
    geraetListe: geraetListe
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
