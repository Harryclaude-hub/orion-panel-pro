/* orion-melder-telegram — schickt eine Telegram-Nachricht, wenn eine NEUE
 * Chance im Raster steht. Zwilling von orion-melder-mail (19.8.2026):
 * GLEICHER Massstab, eigener Kanal, eigene Markierungsspalte — die Mail
 * bleibt unangetastet daneben bestehen.
 *
 * Laeuft im Minutentakt ueber pg_cron (orion-telegram-takt), unabhaengig
 * vom Browser. Versand ueber die Telegram-Bot-API (kostenlos, kein
 * Drittanbieter); der Schluessel kommt als Supabase-Geheimnis
 * TELEGRAM_BOT_TOKEN, das Ziel steht in orion_telegram (id=1).
 * Ohne Schluessel oder ohne aktives Ziel meldet die Funktion das
 * ehrlich und tut nichts.
 *
 * "Chance" heisst hier die SERVERSEITIGE Naeherung der sieben
 * Bedingungen: live, Rendite zwischen Mindest- und Plausibel-Schwelle,
 * mindestens 25 s bewaehrt, Menge bekannt, Gewinn ueber 5 USD. Die
 * Feinheiten (Absage-Form, Deckung) prueft die Website — die Nachricht
 * ist der Wecker, nicht das Urteil. Jeder Fund wird hoechstens EINMAL
 * gemeldet (Spalte telegram_gemeldet).
 *
 * DIE NACHRICHT (Ausbau 20.8., Vorgabe des Auftraggebers):
 *   - beide Anbieter mit FARBPUNKT in den Panel-Farben (stil.css):
 *     Polymarket blau, Kalshi tealgruen (Quadrat), Smarkets gruen,
 *     Betfair gelb — Name steht immer dabei, die Farbe ist nur die
 *     Schnellerkennung
 *   - DIREKTLINK zu beiden Anbietern (dieselben Links wie auf der Karte)
 *   - MINIRECHNUNG: Aufteilung bei 100 $ und Auszahlung — die Anteile
 *     sind prozentual und waehrungsfrei, deshalb dort KEINE Kursdrehung
 *   - BEITRAGSLINK auf die eigene Seite beitrag.html?fund=<schluessel>:
 *     genau diese eine Karte, ohne Suchen, mit Zurueck-Knopf
 *   - Geldbetraege tragen IMMER beide Waehrungen — "4,31 € ($ 5,00)" —
 *     zwei Buecher fuehren Dollar, die Gegenseite fuehrt Euro; der Kurs
 *     kommt aus orion_kurse, ohne Kurs ehrlich in $
 *
 * EINRICHTUNG (einmalig): {"einrichten": true} listet die Chats, die der
 * Bot sieht (allowed_updates ausdruecklich, sonst fehlt my_chat_member).
 * {"test": true} schickt eine MUSTER-Meldung im echten Format. */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

const PANEL = 'https://harryclaude-hub.github.io/orion-panel-pro/';
const kopf = { 'content-type': 'application/json' };

/* Farbpunkte = die Buchfarben des Panels (css/stil.css --pm/--ka/--sm/--bf).
 * Kalshi ist tealgruen — als QUADRAT, damit es neben Smarkets' gruenem
 * Kreis unterscheidbar bleibt. */
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

/* Eine Chance als Telegram-HTML. geld() rechnet USD->EUR wenn Kurs da. */
function meldung(f: Record<string, unknown>, geld: (usd: unknown) => string): string {
  const b1 = String(f.buch_1 ?? 'polymarket'), b2 = String(f.buch ?? 'betfair');
  const p1 = PUNKT[b1] ?? '⚪', p2 = PUNKT[b2] ?? '⚪';
  const n1 = BUCHNAME[b1] ?? b1, n2 = BUCHNAME[b2] ?? b2;
  const e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2), aus = Number(f.auszahlung);
  /* Seit 20.8. die EIGENE Beitragsseite: zeigt genau diese eine Karte,
   * ohne Suchen, mit Zurueck-Knopf. Der alte #fund-Sprung im Panel
   * bleibt als Zweitweg bestehen. */
  const beitrag = PANEL + 'beitrag.html?fund=' + encodeURIComponent(String(f.schluessel ?? ''));
  const zeilen = [
    `\u{1F3AF} <b>ZIEL ERFASST · +${Number(f.rendite).toFixed(2)} %</b>`,
    `<b>${esc(f.titel)}</b>${f.mannschaft ? ' · ' + esc(f.mannschaft) : ''}`,
    `${p1} ${n1}: <b>${esc(f.pm_seite)}</b> zu ${Number(f.pm_preis).toFixed(3)} → <a href="${esc(f.pm_link)}">öffnen</a>`,
    `${p2} ${n2}: <b>${esc(f.bf_seite)}</b> ${f.bf_name ? 'auf ' + esc(f.bf_name) + ' ' : ''}zu ${Number(f.bf_quote).toFixed(3)} → <a href="${esc(f.bf_link)}">öffnen</a>`,
    (isFinite(e1) && isFinite(e2) && isFinite(aus)
      ? `\u{1F9EE} Bei 100 $ Einsatz: <b>${e1.toFixed(2)} $</b> auf ${n1}, <b>${e2.toFixed(2)} $</b> auf ${n2} → <b>${aus.toFixed(2)} $</b> zurück, egal wie es endet (Aufteilung prozentual, gilt in € genauso)`
      : ''),
    `\u{1F4B0} Einsatz bis <b>${geld(f.max_einsatz)}</b> · holbar ~<b>${geld(f.max_gewinn)}</b>`,
    `\u{1F4CB} <a href="${beitrag}">Beitrag öffnen</a> (eigene Seite: genau diese Karte — Gebühren, Absage-Ausgang, Fristen, Speichern)`
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

Deno.serve(async (req) => {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leerer Koerper ist normal */ }

    if (!TOKEN) {
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN fehlt als Geheimnis' }), { headers: kopf });
    }

    /* ---------- Einrichtungsmodus: welche Chats sieht der Bot? ---------- */
    if (body.einrichten === true) {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ allowed_updates: ['message', 'channel_post', 'my_chat_member'] })
      });
      const j = await r.json();
      if (!j.ok) {
        return new Response(JSON.stringify({ ok: false, grund: 'Telegram: ' + JSON.stringify(j).slice(0, 200) }), { headers: kopf });
      }
      const chats = new Map<string, { id: string; titel: string; typ: string }>();
      for (const u of (j.result ?? [])) {
        const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
        if (c) chats.set(String(c.id), { id: String(c.id), titel: c.title ?? c.username ?? c.first_name ?? '?', typ: c.type });
      }
      return new Response(JSON.stringify({
        ok: true, einrichten: true, gefundene_chats: [...chats.values()],
        hinweis: chats.size ? 'chat_id nach orion_telegram (id=1) eintragen und aktiv=true setzen.'
          : 'Keine Chats gefunden. Bot als Kanal-Admin hinzufuegen und danach EINE Nachricht in den Kanal schreiben, dann erneut einrichten.'
      }, null, 1), { headers: kopf });
    }

    /* ---------- Ziel und Wechselkurs ---------- */
    const zielRes = await db('orion_telegram?id=eq.1');
    const ziel = (await zielRes.json())[0];
    if (!ziel?.aktiv || !ziel?.chat_id) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktives Ziel in orion_telegram' }), { headers: kopf });
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

    /* ---------- Funkprobe: MUSTER-Meldung im echten Format ---------- */
    if (body.test === true) {
      const muster = meldung({
        schluessel: 'pm>bf:MUSTER', rendite: 2.34,
        titel: 'Cincinnati Open: Iga Swiatek vs Diane Parry', mannschaft: 'Iga Swiatek',
        buch_1: 'polymarket', buch: 'betfair',
        pm_seite: 'JA', pm_preis: 0.44, pm_link: PANEL,
        bf_seite: 'Lay', bf_quote: 1.8, bf_name: 'Iga Swiatek', bf_link: PANEL,
        einsatz_1: 45.1, einsatz_2: 54.9, auszahlung: 102.34,
        max_einsatz: 94, max_gewinn: 5.2
      }, geld);
      const tj = await sende(String(ziel.chat_id),
        '\u{1F4E1} FUNKPROBE — so sieht eine echte Meldung aus (das hier ist ein MUSTER, keine Chance):\n\n' + muster);
      return new Response(JSON.stringify(tj.ok
        ? { ok: true, funkprobe: 'gesendet', kanal: ziel.chat_id }
        : { ok: false, grund: 'Telegram: ' + JSON.stringify(tj).slice(0, 200) }), { headers: kopf });
    }

    /* ---------- Kandidaten: EXAKT der Massstab des Mail-Melders ---------- */
    const jetzt = Date.now();
    const bewaehrtVor = new Date(jetzt - 25_000).toISOString();
    const q = 'orion_funde?status=eq.live&telegram_gemeldet=eq.false' +
      '&rendite=gte.2&rendite=lte.5' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null&max_gewinn=gte.5' +
      '&select=schluessel,nr,titel,mannschaft,rendite,max_einsatz,max_gewinn,buch,buch_1,' +
      'pm_seite,pm_preis,pm_link,bf_seite,bf_quote,bf_name,bf_link,einsatz_1,einsatz_2,auszahlung&limit=5';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neue Chance' }), { headers: kopf });
    }

    const text = kand.map((f: Record<string, unknown>) => meldung(f, geld)).join('\n\n────────\n\n');
    const tj = await sende(String(ziel.chat_id), text);
    if (!tj.ok) {
      return new Response(JSON.stringify({ ok: false, grund: 'Telegram: ' + JSON.stringify(tj).slice(0, 200) }), { headers: kopf });
    }

    /* Erst nach erfolgreichem Versand markieren — wie beim Mail-Melder. */
    const schluessel = kand.map((f: Record<string, unknown>) => '"' + String(f.schluessel).replace(/"/g, '') + '"').join(',');
    await db('orion_funde?schluessel=in.(' + encodeURIComponent(schluessel) + ')', {
      method: 'PATCH',
      body: JSON.stringify({ telegram_gemeldet: true })
    });
    return new Response(JSON.stringify({ ok: true, gemeldet: kand.length, kanal: ziel.chat_id }), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
