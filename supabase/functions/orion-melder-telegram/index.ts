/* orion-melder-telegram — schickt eine Telegram-Nachricht, wenn eine NEUE
 * Chance im Raster steht. Laeuft im Minutentakt ueber pg_cron
 * (orion-telegram-takt), unabhaengig vom Browser.
 *
 * EMPFAENGER SEIT v12 (21.8.2026, Karams Vorgabe "beides"): die Melder
 * senden an ALLE aktiven Zeilen in orion_telegram_empfaenger (bot = 1).
 * Dort stehen nebeneinander:
 *     art='direkt'  Karams eigener Chat
 *     art='kanal'   ein Telegram-Kanal, in dem der Bot Admin ist
 *     art='abo'     jemand, der dem Bot selbst geschrieben hat
 *
 * VORHER war es GENAU EINER (orion_telegram id=1). Gemessen am 21.8.:
 * beide Bots kannten den Chat 6921758376 ("Felix_2044"), gesendet wurde
 * aber nur an 6795362180 — der Beitretende bekam nie etwas. Genau das
 * hat Karam gemeldet.
 *
 * DER BEITRAGSLINK IST NICHT FUER JEDEN. beitrag.html liegt hinter dem
 * Kennwort; ein Fremder landet dort an der Wand. Deshalb entscheidet je
 * Empfaenger die Spalte `mit_beitragslink`, ob die Nachricht Links ins
 * Panel traegt. Standard fuer neue Abonnenten: NEIN. Wer keine Links
 * bekommt, bekommt trotzdem die vollstaendige Information.
 *
 * "Chance" heisst hier die SERVERSEITIGE Naeherung der sieben
 * Bedingungen — seit 20.8. verschaerft um Wache-Urteil, Buchsummen-
 * Doppelgurt und 120 s Bewaehrung. Die Feinheiten prueft die Website;
 * die Nachricht ist der Wecker, nicht das Urteil. Jeder Fund wird
 * hoechstens EINMAL gemeldet (Spalte telegram_gemeldet).
 *
 * BEDIENUNG:
 *   {"einrichten": true}  listet die Chats, die der Bot sieht, und sagt,
 *                         welche davon KEINE Meldungen bekommen
 *   {"abholen": true}     traegt alle, die dem Bot geschrieben haben, als
 *                         art='abo' ein (ohne Beitragslink, aktiv)
 *   {"test": true}        funkt ein MUSTER an alle aktiven Empfaenger
 */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

const BOT_NR = 1;
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

/* WELCHE PARTIE IST DAS? (21.8.) Dieselbe Partie laeuft unter zwei Titeln,
 *     "Botafogo FR vs. CS Cienciano"
 *     "Botafogo FR vs. CS Cienciano - More Markets"
 * Gemessen ueber drei Tage: 164 von 453 Zeilen (36 %) tragen den Zusatz.
 * Abgeschnitten wird NUR fuer den Vergleich; in der Nachricht steht der
 * volle Titel. SPIEGEL: dieselbe Funktion in orion-melder-knapp. */
function partieSchluessel(titel: unknown): string {
  return String(titel ?? '')
    .replace(/\s*-\s*More Markets\s*$/i, '')
    .trim()
    .toLowerCase();
}

/* Eine Chance als Telegram-HTML.
 *
 * mitLinks entscheidet, ob die Nachricht ins Panel verlinkt. Ohne Links
 * steht dieselbe Information da, nur ohne Verweise, die hinter dem
 * Kennwort enden wuerden. */
function meldung(f: Record<string, unknown>, geld: (usd: unknown) => string, mitLinks: boolean): string {
  const b1 = String(f.buch_1 ?? 'polymarket'), b2 = String(f.buch ?? 'betfair');
  const p1 = PUNKT[b1] ?? '⚪', p2 = PUNKT[b2] ?? '⚪';
  const n1 = BUCHNAME[b1] ?? b1, n2 = BUCHNAME[b2] ?? b2;
  const e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2), aus = Number(f.auszahlung);

  /* FUNKPROBEN ZEIGEN AUFS PANEL, NICHT AUF EINEN ERFUNDENEN SCHLUESSEL
   * (21.8.). Die Probe baute ihren Link aus 'pm>bf:MUSTER'; beitrag.html
   * antwortete darauf ehrlich mit "Diesen Fund gibt es nicht mehr in der
   * Datenbank". Fuer den Leser sah das aus wie eine echte Meldung, deren
   * Fund verschwunden ist. Eine Testnachricht darf nie wie ein Fehler des
   * Betriebs aussehen. */
  const probe = f._probe === true;
  const beitrag = probe
    ? PANEL
    : PANEL + 'beitrag.html?fund=' + encodeURIComponent(String(f.schluessel ?? ''));
  /* Bei einer Probe haengt kein &zu an: PANEL traegt kein '?', ein
   * angehaengtes '&zu=1' ergaebe einen kaputten Link. */
  const zuLink = (n: number) => probe ? PANEL : beitrag + '&amp;zu=' + n;

  function buchZeile(punkt: string, name: string, seite: unknown, wert: number, laeufer: unknown, n: number) {
    const kern = `${punkt} ${name}: <b>${esc(seite)}</b> ${laeufer ? 'auf ' + esc(laeufer) + ' ' : ''}zu ${wert.toFixed(3)}`;
    return mitLinks ? `${kern} → <a href="${zuLink(n)}">ansehen</a>` : kern;
  }

  const zeilen = [
    `\u{1F3AF} <b>ZIEL ERFASST · +${Number(f.rendite).toFixed(2)} %</b>`,
    `<b>${esc(f.titel)}</b>${f.mannschaft ? ' · ' + esc(f.mannschaft) : ''}`,
    buchZeile(p1, n1, f.pm_seite, Number(f.pm_preis), null, 1),
    buchZeile(p2, n2, f.bf_seite, Number(f.bf_quote), f.bf_name, 2),
    (isFinite(e1) && isFinite(e2) && isFinite(aus)
      ? `\u{1F9EE} Bei 100 $ Einsatz: <b>${e1.toFixed(2)} $</b> auf ${n1}, <b>${e2.toFixed(2)} $</b> auf ${n2} → <b>${aus.toFixed(2)} $</b> zurück, egal wie es endet (Aufteilung prozentual, gilt in € genauso)`
      : ''),
    `\u{1F4B0} Einsatz bis <b>${geld(f.max_einsatz)}</b> · holbar ~<b>${geld(f.max_gewinn)}</b>`,
    (Number(f._weitere) > 0
      ? `\u{1F517} Dieselbe Partie steht noch über <b>${Number(f._weitere)}</b> weitere Buchpaarung${Number(f._weitere) === 1 ? '' : 'en'} im Panel. Hier steht die beste davon.`
      : ''),
    mitLinks
      ? `\u{1F4CB} <a href="${beitrag}">Ganze Karte öffnen</a> (Gebühren, Absage-Ausgang, Fristen, Speichern). Alle Links dieser Meldung führen dorthin, der Absprung zum Anbieter steht auf der Seite.`
      : `\u{1F4CB} Kurse laufen weiter — vor dem Setzen bei beiden Büchern gegenprüfen. Der Stand oben ist der Moment dieser Meldung.`
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

/* An ALLE aktiven Empfaenger senden.
 *
 * Zwei Vorkehrungen, die bei einem Verteiler Pflicht sind:
 *   RATENBREMSE  Telegram nimmt rund 30 Nachrichten je Sekunde an.
 *                150 ms Abstand sind gemuetlich und tragen hunderte
 *                Empfaenger, ohne je in die Naehe der Grenze zu kommen.
 *   STILLLEGEN   Wer den Bot blockiert oder seinen Chat loescht, liefert
 *                403 bzw. 400. Solche Empfaenger werden auf aktiv=false
 *                gesetzt, mit Grund und Zeitpunkt. Sonst versucht es der
 *                Melder jede Minute erneut, jedes Mal vergeblich, und
 *                der Fehler bleibt unsichtbar. */
async function sendeAnAlle(
  empfaenger: Record<string, unknown>[],
  bauText: (mitLinks: boolean) => string
) {
  const bericht = { zugestellt: 0, stillgelegt: 0, fehler: [] as string[] };
  for (const e of empfaenger) {
    const text = bauText(e.mit_beitragslink === true);
    let tj: Record<string, unknown> = {};
    try { tj = await sende(String(e.chat_id), text); }
    catch (err) { bericht.fehler.push(String(e.chat_id) + ': ' + String(err).slice(0, 80)); continue; }

    if (tj.ok === true) {
      bericht.zugestellt++;
    } else {
      const code = Number(tj.error_code);
      const grund = String(tj.description ?? JSON.stringify(tj)).slice(0, 200);
      bericht.fehler.push(String(e.chat_id) + ': ' + grund.slice(0, 90));
      /* 403 blockiert, 400 Chat nicht gefunden: stilllegen. Alles andere
       * (etwa 429 zu schnell, 500 bei Telegram) ist voruebergehend und
       * darf den Empfaenger NICHT kosten. */
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

/* Wer hat dem Bot geschrieben? Liefert die Chats aus getUpdates. */
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
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN fehlt als Geheimnis' }), { headers: kopf });
    }

    /* ---------- Einrichten: wer bekommt etwas, wer nicht? ---------- */
    if (body.einrichten === true) {
      const bk = await bekannteChats();
      if (!bk.ok) return new Response(JSON.stringify({ ok: false, grund: bk.grund }), { headers: kopf });
      const empf = await holeEmpfaenger();
      const eingetragen = new Set((empf ?? []).map((e: Record<string, unknown>) => String(e.chat_id)));
      const ohneMeldung = bk.chats.filter((c) => !eingetragen.has(c.id));
      return new Response(JSON.stringify({
        ok: true, einrichten: true,
        empfaenger: empf,
        gefundene_chats: bk.chats,
        BEKOMMEN_NICHTS: ohneMeldung,
        hinweis: ohneMeldung.length
          ? 'Mit {"abholen": true} werden diese Chats als art=abo eingetragen (ohne Beitragslink).'
          : 'Alle bekannten Chats stehen als Empfaenger.'
      }, null, 1), { headers: kopf });
    }

    /* ---------- Abholen: neue Abonnenten eintragen ---------- */
    if (body.abholen === true) {
      const bk = await bekannteChats();
      if (!bk.ok) return new Response(JSON.stringify({ ok: false, grund: bk.grund }), { headers: kopf });
      const empf = await holeEmpfaenger();
      const eingetragen = new Set((empf ?? []).map((e: Record<string, unknown>) => String(e.chat_id)));
      const neu = bk.chats.filter((c) => !eingetragen.has(c.id));
      if (neu.length === 0) {
        return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neuen Chats' }), { headers: kopf });
      }
      const zeilen = neu.map((c) => ({
        bot: BOT_NR, chat_id: c.id,
        art: c.typ === 'channel' ? 'kanal' : 'abo',
        name: c.titel, aktiv: true, mit_beitragslink: false
      }));
      const r = await db('orion_telegram_empfaenger?on_conflict=bot,chat_id', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(zeilen)
      });
      const angelegt = await r.json();
      return new Response(JSON.stringify({
        ok: true, neu_eingetragen: Array.isArray(angelegt) ? angelegt.length : 0, zeilen: angelegt,
        hinweis: 'Ohne Beitragslink eingetragen (beitrag.html liegt hinter dem Kennwort). ' +
                 'Zum Freischalten: mit_beitragslink=true setzen.'
      }, null, 1), { headers: kopf });
    }

    /* ---------- Empfaenger und Wechselkurs ---------- */
    const empfaenger = await holeEmpfaenger();
    if (!Array.isArray(empfaenger) || empfaenger.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktiver Empfaenger in orion_telegram_empfaenger' }), { headers: kopf });
    }

    let kurs: number | null = null;
    try {
      const kRes = await db('orion_kurse?paar=eq.USD_EUR&select=kurs&limit=1');
      const kZ = await kRes.json();
      const n = Number(kZ?.[0]?.kurs);
      if (isFinite(n) && n > 0) kurs = n;
    } catch { /* ohne Kurs ehrlich in $ */ }
    const geld = (usd: unknown) => {
      const n = Number(usd);
      if (!isFinite(n)) return 'unbekannt';
      return kurs === null ? n.toFixed(2) + ' $' : (n * kurs).toFixed(2) + ' € ($ ' + n.toFixed(2) + ')';
    };

    /* ---------- Funkprobe ---------- */
    if (body.test === true) {
      const muster: Record<string, unknown> = {
        schluessel: 'pm>bf:MUSTER', _probe: true, rendite: 2.34,
        titel: 'Cincinnati Open: Iga Swiatek vs Diane Parry', mannschaft: 'Iga Swiatek',
        buch_1: 'polymarket', buch: 'betfair',
        pm_seite: 'JA', pm_preis: 0.44, bf_seite: 'Lay', bf_quote: 1.8, bf_name: 'Iga Swiatek',
        einsatz_1: 45.1, einsatz_2: 54.9, auszahlung: 102.34,
        max_einsatz: 94, max_gewinn: 5.2, _weitere: 2
      };
      const bericht = await sendeAnAlle(empfaenger, (mitLinks) =>
        '\u{1F4E1} <b>FUNKPROBE — KEIN ECHTER FUND</b>\nMuster zum Pruefen der Zustellung. Die Zahlen sind erfunden.\n\n' +
        meldung(muster, geld, mitLinks));
      return new Response(JSON.stringify({ ok: true, funkprobe: bericht, empfaenger: empfaenger.length }, null, 1), { headers: kopf });
    }

    /* ---------- Kandidaten ---------- */
    const jetzt = Date.now();
    const bewaehrtVor = new Date(jetzt - 120_000).toISOString();
    const q = 'orion_funde?status=eq.live&telegram_gemeldet=eq.false' +
      '&pruefung=is.null' +
      '&or=(buch_summe.is.null,buch_summe.lt.1)' +
      '&rendite=gte.2&rendite=lte.5' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null&max_gewinn=gte.5' +
      '&select=schluessel,nr,titel,mannschaft,rendite,max_einsatz,max_gewinn,buch,buch_1,' +
      'pm_seite,pm_preis,pm_link,bf_seite,bf_quote,bf_name,bf_link,einsatz_1,einsatz_2,auszahlung&limit=5';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neue Chance' }), { headers: kopf });
    }

    /* EINE PARTIE, EINE MELDUNG (21.8.) */
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

    /* MARKIERT WIRD NUR, WENN MINDESTENS EINER SIE BEKOMMEN HAT.
     * Sonst gilt ein Fund als gemeldet, den niemand gesehen hat. */
    if (bericht.zugestellt === 0) {
      return new Response(JSON.stringify({ ok: false, grund: 'an keinen Empfaenger zugestellt', bericht }, null, 1), { headers: kopf });
    }

    /* Markiert werden ALLE geholten Zeilen, nicht nur die gemeldeten:
     * sonst kaemen die zusammengefassten Paarungen einzeln nach. */
    const schluessel = kand.map((f: Record<string, unknown>) => '"' + String(f.schluessel).replace(/"/g, '') + '"').join(',');
    await db('orion_funde?schluessel=in.(' + encodeURIComponent(schluessel) + ')', {
      method: 'PATCH',
      body: JSON.stringify({ telegram_gemeldet: true })
    });
    return new Response(JSON.stringify({
      ok: true, gemeldet: zuMelden.length, zeilen_markiert: kand.length, zustellung: bericht
    }, null, 1), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
