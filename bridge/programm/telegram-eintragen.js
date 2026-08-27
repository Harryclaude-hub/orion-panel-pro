/* ===========================================================================
 * Telegram-Schluessel pruefen und eintragen
 * ===========================================================================
 * Wird von TELEGRAM-EINTRAGEN.cmd aufgerufen und bekommt die zwei Schluessel
 * ueber die Umgebung (TG1 = Chancen-Bot, TG2 = Knapp-Bot).
 *
 * WARUM EINE EIGENE DATEI: dasselbe stand erst als langer node -e Einzeiler
 * in der cmd-Datei. cmd hat ihn zerlegt (SyntaxError: Unexpected end of
 * input) - der dritte Fall dieser Art an einem Tag. Regel fuer dieses
 * Projekt: laengere Logik NIE in eine Befehlszeile quetschen, sondern in
 * eine Datei legen.
 *
 * WAS ES TUT
 *   1. Form pruefen: ein Telegram-Schluessel ist Zahlen, Doppelpunkt, Rest
 *   2. bei Telegram nachfragen (getMe), ob er wirklich gilt
 *   3. NUR was Telegram bestaetigt, wird gespeichert
 *
 * Warum mit Pruefung: am 27.08. wurden Werte eingetragen, die wie Schluessel
 * aussahen, aber Pruefsummen aus Supabase waren. Der Bot scheiterte danach
 * jede Minute still. Lieber vorher fragen als hinterher raten.
 * =========================================================================== */

'use strict';

const fs = require('fs');
const pfad = require('path');
const https = require('https');

const a = process.env.TG1 || '';
const b = process.env.TG2 || '';

function fragTelegram(t) {
  return new Promise((fertig) => {
    if (!t) return fertig({ leer: true });
    if (!/^\d+:/.test(t)) return fertig({ form: false });
    https.get('https://api.telegram.org/bot' + t + '/getMe', (s) => {
      let d = '';
      s.on('data', (c) => { d += c; });
      s.on('end', () => {
        try {
          const j = JSON.parse(d);
          fertig(j.ok ? { ok: true, name: j.result.username } : { ok: false, grund: j.description || 'abgelehnt' });
        } catch (e) { fertig({ ok: false, grund: 'unlesbare Antwort' }); }
      });
    }).on('error', (e) => fertig({ ok: false, grund: e.message }));
  });
}

function zeig(name, r) {
  if (r.leer)        { console.log('  ' + name + ' : nicht angegeben'); return false; }
  if (r.form === false) { console.log('  ' + name + ' : FALSCHE FORM, da fehlt der Doppelpunkt'); return false; }
  if (r.ok)          { console.log('  ' + name + ' : OK, das ist @' + r.name); return true; }
  console.log('  ' + name + ' : ABGELEHNT von Telegram, ' + r.grund);
  return false;
}

(async () => {
  const r1 = await fragTelegram(a);
  const r2 = await fragTelegram(b);
  const o1 = zeig('Chancen-Bot', r1);
  const o2 = zeig('Knapp-Bot  ', r2);
  console.log('');

  if (!o1 && !o2) {
    console.log('  Nichts gespeichert. Es hat sich nichts geaendert.');
    process.exit(1);
  }

  /* Die Zugangsdatei liegt eine Ebene hoeher, faellt aber auf denselben
   * Ordner zurueck - damit der Ordner auch flach kopiert funktioniert. */
  let f = pfad.join(__dirname, '..', 'bridge-config.json');
  if (!fs.existsSync(f)) f = pfad.join(__dirname, 'bridge-config.json');

  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (o1) c.telegramBotToken = a;
  if (o2) c.telegramBotTokenKnapp = b;
  fs.writeFileSync(f, JSON.stringify(c, null, 2));
  console.log('  Gespeichert. Ab jetzt nie wieder noetig.');
})();
