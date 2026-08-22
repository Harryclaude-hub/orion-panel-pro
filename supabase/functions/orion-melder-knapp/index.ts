/* orion-melder-knapp — der ZWEITE Telegram-Bot: meldet die KNAPPSTEN
 * PAARE, also Zeilen, die noch KEINE Chance sind, aber dicht an der
 * Gewinnzone stehen. DRILLING von orion-melder-telegram: gleicher Aufbau,
 * eigener Bot, eigenes Geheimnis, eigene Empfaengerliste (bot = 2),
 * eigene Markierungsspalte (knapp_gemeldet).
 *
 * DIESE DATEI WIRD ERZEUGT, nicht von Hand gepflegt: aus dem Chancen-Bot
 * ueber pruefung/bau-knapp.py. Zwei handgepflegte Drillinge laufen
 * auseinander. Wer hier etwas aendert, aendert es im Chancen-Bot oder in
 * der Unterschiedsliste des Skripts.
 *
 * BAND = RENDITE 0 BIS UNTER 2 (Stand 21.8.). Es war bis dahin -0,5 bis 2.
 * Das Panel blendet ueber die Rauschgrenze (js/konfig.js, rauschGrenze:
 * 0.0) alles unter null aus; der Bot meldete damit Zeilen, die im Panel
 * nirgends zu finden waren. Seit 21.8. gilt die Panel-Grenze auch hier.
 *
 * EMPFAENGER SEIT 21.8. (Karams Vorgabe "beides"): alle aktiven Zeilen in
 * orion_telegram_empfaenger mit bot = 2 — Direktchat, Kanal und
 * Abonnenten nebeneinander. Der Beitragslink haengt je Empfaenger an
 * `mit_beitragslink`, weil beitrag.html hinter dem Kennwort liegt.
 *
 * Schutzgurte wie beim Chancen-Bot: Wache-Urteil leer, 120 s Bewaehrung,
 * hoechstens einmal je Fund. Buchsummen-Gurt seit 22.8. bei 1,00 statt
 * 1,02: die Wache verurteilt JEDE Zeile ab 1,00 bei positiver Rendite,
 * und seit das Band bei 0 beginnt, sind alle Kandidaten positiv. Der
 * weitere Deckel haette nur Zeilen durchgelassen, die die Wache Sekunden
 * spaeter kassiert - eine Meldung ueber einen Fund, der im Panel schon
 * als falsch dasteht. Bot und Wache messen jetzt mit demselben Mass.
 *
 * BEDIENUNG: {"einrichten": true} listet, wer nichts bekommt.
 *            {"abholen": true} traegt neue Chats ein.
 *            {"test": true} funkt ein MUSTER an alle Empfaenger.
 */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN_KNAPP') ?? '';

const BOT_NR = 2;
const PANEL = 'https://harryclaude-hub.github.io/orion-panel-pro/';
const kopf = { 'content-type': 'application/json' };

const PUNKT: Record<string, string> = {
  polymarket: '\u{1F535}', kalshi: '\u{1F7E9}', smarkets: '\u{1F7E2}', betfair: '\u{1F7E1}'
};
const BUCHNAME: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', smarkets: 'Smarkets', betfair: 'Betfair/Orbit'
};

function db(pfad: string, opt: RequestInit = {}) {
  return fetch(`${URL_SUPA}/rest/v1/${pfad}`, {
    ...opt,
    headers: {
      apikey: DIENST,
      authorization: `Bearer ${DIENST}`,
      'content-type': 'application/json',
      ...(opt.headers ?? {})
    }
  });
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Dieselbe Partie laeuft unter zwei Titeln, mit und ohne den Zusatz
 * "- More Markets" (36 % der Zeilen). Abgeschnitten wird NUR fuer den
 * Vergleich; in der Nachricht steht der volle Titel.
 * SPIEGEL: gleiche Funktion in orion-melder-telegram. */
function partieSchluessel(titel: unknown): string {
  return String(titel ?? '')
    .replace(/\s*-\s*More Markets\s*$/i, '')
    .trim()
    .toLowerCase();
}

/* mitLinks=false laesst alle Panel-Verweise weg, die Information bleibt
 * vollstaendig. _probe=true zeigt aufs Panel statt auf einen erfundenen
 * Schluessel: eine Testnachricht darf nie wie ein Betriebsfehler
 * aussehen (siehe 8y). */
function meldung(f: Record<string, unknown>, geld: (usd: unknown) => string, mitLinks: boolean): string {
  const b1 = String(f.buch_1 ?? 'polymarket'), b2 = String(f.buch ?? 'betfair');
  const p1 = PUNKT[b1] ?? '⚪', p2 = PUNKT[b2] ?? '⚪';
  const n1 = BUCHNAME[b1] ?? b1, n2 = BUCHNAME[b2] ?? b2;
  const e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2), aus = Number(f.auszahlung);

  const probe = f._probe === true;
  const beitrag = probe
    ? PANEL
    : PANEL + 'beitrag.html?fund=' + encodeURIComponent(String(f.schluessel ?? ''));
  const zuLink = (n: number) => probe ? PANEL : beitrag + '&amp;zu=' + n;

  function buchZeile(punkt: string, name: string, seite: unknown, wert: number, laeufer: unknown, n: number) {
    const kern = `${punkt} ${name}: <b>${esc(seite)}</b> ${laeufer ? 'auf ' + esc(laeufer) + ' ' : ''}zu ${wert.toFixed(3)}`;
    return mitLinks ? `${kern} → <a href="${zuLink(n)}">ansehen</a>` : kern;
  }

  const zeilen = [
    `\u{1F440} <b>KNAPPES PAAR</b> · <b>+${Number(f.rendite).toFixed(2)} %</b>, unter der 2-%-Meldeschwelle (noch keine Chance)`,
    `<b>${esc(f.titel)}</b>${f.mannschaft ? ' · ' + esc(f.mannschaft) : ''}`,
    buchZeile(p1, n1, f.pm_seite, Number(f.pm_preis), null, 1),
    buchZeile(p2, n2, f.bf_seite, Number(f.bf_quote), f.bf_name, 2),
    (isFinite(e1) && isFinite(e2) && isFinite(aus)
      ? `\u{1F9EE} Bei 100 $ Einsatz kämen <b>${aus.toFixed(2)} $</b> zurück (${e1.toFixed(2)} $ auf ${n1}, ${e2.toFixed(2)} $ auf ${n2})`
      : ''),
    `\u{1F4B0} Platz bis <b>${geld(f.max_einsatz)}</b> Einsatz, falls es kippt`,
    (Number(f._weitere) > 0
      ? `\u{1F517} Dieselbe Partie steht noch über <b>${Number(f._weitere)}</b> weitere Buchpaarung${Number(f._weitere) === 1 ? '' : 'en'} im Panel. Hier steht die beste.`
      : ''),
    mitLinks
      ? `\u{1F4CB} <a href="${beitrag}">Ganze Karte öffnen</a> — Gebühren, Absage-Ausgang, Fristen, Speichern.`
      : `\u{1F4CB} Kurse laufen weiter — vor dem Setzen bei beiden Büchern gegenprüfen.`
  ].filter(z => z !== '');
  return zeilen.join('\n');
}

async function sende(chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  return r.json();
}

/* An ALLE aktiven Empfaenger. 150 ms Bremse (Telegram nimmt ~30/s).
 * 403/400 = blockiert oder Chat weg -> stilllegen mit Grund; 429/500
 * sind voruebergehend und kosten den Empfaenger NICHT. */
async function sendeAnAlle(
  empfaenger: Record<string, unknown>[],
  bauText: (mitLinks: boolean) => string
) {
  const bericht = { zugestellt: 0, stillgelegt: 0, fehler: [] as string[] };
  for (const e of empfaenger) {
    let tj: Record<string, unknown> = {};
    try { tj = await sende(String(e.chat_id), bauText(e.mit_beitragslink === true)); }
    catch (err) { bericht.fehler.push(String(e.chat_id) + ': ' + String(err).slice(0, 80)); continue; }

    if (tj.ok === true) { bericht.zugestellt++; }
    else {
      const code = Number(tj.error_code);
      const grund = String(tj.description ?? JSON.stringify(tj)).slice(0, 200);
      bericht.fehler.push(String(e.chat_id) + ': ' + grund.slice(0, 90));
      if (code === 403 || code === 400) {
        await db('orion_telegram_empfaenger?id=eq.' + encodeURIComponent(String(e.id)), {
          method: 'PATCH',
          body: JSON.stringify({ aktiv: false, letzter_fehler: grund, fehler_am: new Date().toISOString() })
        });
        bericht.stillgelegt++;
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return bericht;
}

function holeEmpfaenger() {
  return db('orion_telegram_empfaenger?bot=eq.' + BOT_NR +
            '&aktiv=is.true&select=id,chat_id,art,name,mit_beitragslink&order=id')
    .then((r) => r.json());
}

async function bekannteChats() {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ allowed_updates: ['message', 'channel_post', 'my_chat_member'] })
  });
  const j = await r.json();
  if (!j.ok) return { ok: false, grund: 'Telegram: ' + JSON.stringify(j).slice(0, 200), chats: [] };
  const chats = new Map<string, { id: string; titel: string; typ: string }>();
  for (const u of (j.result ?? [])) {
    const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
    if (c) chats.set(String(c.id), { id: String(c.id), titel: c.title ?? c.username ?? c.first_name ?? '?', typ: c.type });
  }
  return { ok: true, chats: [...chats.values()] };
}

Deno.serve(async (req) => {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leerer Koerper ist normal */ }

    if (!TOKEN) {
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN_KNAPP fehlt' }), { headers: kopf });
    }

    if (body.einrichten === true) {
      const bk = await bekannteChats();
      if (!bk.ok) return new Response(JSON.stringify({ ok: false, grund: bk.grund }), { headers: kopf });
      const empf = await holeEmpfaenger();
      const drin = new Set((empf ?? []).map((e: Record<string, unknown>) => String(e.chat_id)));
      const ohne = bk.chats.filter((c) => !drin.has(c.id));
      return new Response(JSON.stringify({
        ok: true, empfaenger: empf, gefundene_chats: bk.chats, BEKOMMEN_NICHTS: ohne,
        hinweis: ohne.length ? 'Mit {"abholen":true} eintragen.' : 'Alle bekannten Chats stehen als Empfaenger.'
      }, null, 1), { headers: kopf });
    }

    if (body.abholen === true) {
      const bk = await bekannteChats();
      if (!bk.ok) return new Response(JSON.stringify({ ok: false, grund: bk.grund }), { headers: kopf });
      const empf = await holeEmpfaenger();
      const drin = new Set((empf ?? []).map((e: Record<string, unknown>) => String(e.chat_id)));
      const neu = bk.chats.filter((c) => !drin.has(c.id));
      if (neu.length === 0) {
        return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neuen Chats' }), { headers: kopf });
      }
      const r = await db('orion_telegram_empfaenger?on_conflict=bot,chat_id', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(neu.map((c) => ({
          bot: BOT_NR, chat_id: c.id, art: c.typ === 'channel' ? 'kanal' : 'abo',
          name: c.titel, aktiv: true, mit_beitragslink: false
        })))
      });
      const angelegt = await r.json();
      return new Response(JSON.stringify({
        ok: true, neu_eingetragen: Array.isArray(angelegt) ? angelegt.length : 0, zeilen: angelegt,
        hinweis: 'Ohne Beitragslink eingetragen. Zum Freischalten mit_beitragslink=true setzen.'
      }, null, 1), { headers: kopf });
    }

    const empfaenger = await holeEmpfaenger();
    if (!Array.isArray(empfaenger) || empfaenger.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktiver Empfaenger (bot 2)' }), { headers: kopf });
    }

    let kurs: number | null = null;
    try {
      const kZ = await (await db('orion_kurse?paar=eq.USD_EUR&select=kurs&limit=1')).json();
      const n = Number(kZ?.[0]?.kurs);
      if (isFinite(n) && n > 0) kurs = n;
    } catch { /* ohne Kurs ehrlich in $ */ }
    const geld = (usd: unknown) => {
      const n = Number(usd);
      if (!isFinite(n)) return 'unbekannt';
      return kurs === null ? n.toFixed(2) + ' $' : (n * kurs).toFixed(2) + ' € ($ ' + n.toFixed(2) + ')';
    };

    if (body.test === true) {
      const muster: Record<string, unknown> = {
        schluessel: 'pm>bf:MUSTER', _probe: true, rendite: 0.42,
        titel: 'Mjällby v Red Bull Salzburg', mannschaft: 'Mjällby',
        buch_1: 'smarkets', buch: 'betfair',
        pm_seite: 'JA', pm_preis: 0.62, bf_seite: 'Lay', bf_quote: 1.62, bf_name: 'Mjällby',
        einsatz_1: 48.2, einsatz_2: 51.8, auszahlung: 100.42,
        max_einsatz: 120, max_gewinn: 0.5, _weitere: 4
      };
      const bericht = await sendeAnAlle(empfaenger, (mitLinks) =>
        '\u{1F4E1} <b>FUNKPROBE — KEIN ECHTER FUND</b>\nMuster zum Pruefen der Zustellung. Die Zahlen sind erfunden.\n\n' +
        meldung(muster, geld, mitLinks));
      return new Response(JSON.stringify({ ok: true, funkprobe: bericht, empfaenger: empfaenger.length }, null, 1), { headers: kopf });
    }

    const bewaehrtVor = new Date(Date.now() - 120_000).toISOString();
    const q = 'orion_funde?status=eq.live&knapp_gemeldet=eq.false' +
      '&pruefung=is.null' +
      '&or=(buch_summe.is.null,buch_summe.lt.1)' +
      '&rendite=gte.0&rendite=lt.2' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null' +
      '&select=schluessel,nr,titel,mannschaft,rendite,max_einsatz,max_gewinn,buch,buch_1,' +
      'pm_seite,pm_preis,pm_link,bf_seite,bf_quote,bf_name,bf_link,einsatz_1,einsatz_2,auszahlung&limit=5';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein knappes Paar' }), { headers: kopf });
    }

    /* EINE PARTIE, EINE MELDUNG: beste Zeile je Partie, die uebrigen
     * werden genannt und unten mitmarkiert. */
    const jePartie = new Map<string, Record<string, unknown>[]>();
    for (const f of kand as Record<string, unknown>[]) {
      const t = partieSchluessel(f.titel);
      const bisher = jePartie.get(t);
      if (bisher) bisher.push(f); else jePartie.set(t, [f]);
    }
    const zuMelden = [...jePartie.values()].map((gruppe) => {
      const beste = gruppe.reduce((a, b) =>
        Number(b.rendite) > Number(a.rendite) ? b : a);
      beste._weitere = gruppe.length - 1;
      return beste;
    });

    const bericht = await sendeAnAlle(empfaenger, (mitLinks) =>
      zuMelden.map((f: Record<string, unknown>) => meldung(f, geld, mitLinks)).join('\n\n────────\n\n'));

    /* Markiert wird erst NACH Zustellung an mindestens einen. Sonst gilt
     * ein Fund als gemeldet, den niemand gesehen hat. */
    if (bericht.zugestellt === 0) {
      return new Response(JSON.stringify({ ok: false, grund: 'an keinen Empfaenger zugestellt', bericht }, null, 1), { headers: kopf });
    }

    const schluessel = kand.map((f: Record<string, unknown>) => '"' + String(f.schluessel).replace(/"/g, '') + '"').join(',');
    await db('orion_funde?schluessel=in.(' + encodeURIComponent(schluessel) + ')', {
      method: 'PATCH', body: JSON.stringify({ knapp_gemeldet: true })
    });
    return new Response(JSON.stringify({
      ok: true, gemeldet: zuMelden.length, zeilen_markiert: kand.length, zustellung: bericht
    }, null, 1), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
