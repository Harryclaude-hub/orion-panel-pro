/* orion-melder-telegram — schickt eine Telegram-Nachricht, wenn eine NEUE
 * Chance im Raster steht. Zwilling von orion-melder-mail (19.8.2026):
 * GLEICHER Massstab, eigener Kanal, eigene Markierungsspalte — die Mail
 * bleibt unangetastet daneben bestehen.
 *
 * Laeuft im Minutentakt ueber pg_cron (orion-telegram-takt), unabhaengig
 * vom Browser. Versand ueber die Telegram-Bot-API (kostenlos, kein
 * Drittanbieter); der Schluessel kommt als Supabase-Geheimnis
 * TELEGRAM_BOT_TOKEN, der Zielkanal steht in orion_telegram (id=1).
 * Ohne Schluessel oder ohne aktiven Kanal meldet die Funktion das
 * ehrlich und tut nichts.
 *
 * "Chance" heisst hier die SERVERSEITIGE Naeherung der sieben
 * Bedingungen: live, Rendite zwischen Mindest- und Plausibel-Schwelle,
 * mindestens 25 s bewaehrt, Menge bekannt, Gewinn ueber 5 USD. Die
 * Feinheiten (Absage-Form, Deckung) prueft die Website — die Nachricht
 * ist der Wecker, nicht das Urteil. Jeder Fund wird hoechstens EINMAL
 * gemeldet (Spalte telegram_gemeldet).
 *
 * WAEHRUNG (Vorgabe 19.8.): Geldbetraege tragen IMMER beide Zeichen —
 * "4,31 € ($ 5,00)" — denn zwei Buecher fuehren Dollar (Polymarket,
 * Kalshi), die Gegenseite fuehrt beim Auftraggeber Euro. Der Kurs kommt
 * aus orion_kurse (EZB, von der Datenbank selbst geholt); ohne Kurs
 * steht der Betrag ehrlich in $. Ein erfundener Kurs waere schlimmer
 * als eine fremde Waehrung.
 *
 * EINRICHTUNG (einmalig): Aufruf mit {"einrichten": true} fragt beim
 * Bot getUpdates ab und listet alle Chats, die der Bot sieht — samt
 * chat_id. Der Bot muss dafuer Administrator des Kanals sein und im
 * Kanal muss NACH dem Hinzufuegen mindestens eine Nachricht geschrieben
 * worden sein. Die gefundene chat_id kommt nach orion_telegram. */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

const kopf = { 'content-type': 'application/json' };

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

Deno.serve(async (req) => {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leerer Koerper ist normal */ }

    if (!TOKEN) {
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN fehlt als Geheimnis' }), { headers: kopf });
    }

    /* ---------- Einrichtungsmodus: welche Chats sieht der Bot? ---------- */
    if (body.einrichten === true) {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
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

    /* ---------- Regelbetrieb ---------- */
    const zielRes = await db('orion_telegram?id=eq.1');
    const ziel = (await zielRes.json())[0];
    if (!ziel?.aktiv || !ziel?.chat_id) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktiver Kanal in orion_telegram' }), { headers: kopf });
    }

    /* Wechselkurs fuer die Doppel-Anzeige. Fehlt er, bleibt es bei $. */
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

    /* Kandidaten: EXAKT der Massstab des Mail-Melders, eigene Markierung. */
    const jetzt = Date.now();
    const bewaehrtVor = new Date(jetzt - 25_000).toISOString();
    const q = 'orion_funde?status=eq.live&telegram_gemeldet=eq.false' +
      '&rendite=gte.2&rendite=lte.5' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null&max_gewinn=gte.5' +
      '&select=schluessel,nr,titel,rendite,max_einsatz,max_gewinn,buch,buch_1&limit=10';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neue Chance' }), { headers: kopf });
    }

    const zeilen = kand.map((f: Record<string, unknown>) =>
      `#${f.nr ?? '?'} · ${f.titel} · ${Number(f.rendite).toFixed(2)} % · ` +
      `${f.buch_1 ?? 'polymarket'} gegen ${f.buch ?? 'betfair'}\n` +
      `   Einsatz bis ${geld(f.max_einsatz)} · holbar ~${geld(f.max_gewinn)}`
    );
    const text = 'ZIEL ERFASST, Offizier:\n\n' + zeilen.join('\n') +
      '\n\nZum Panel: https://harryclaude-hub.github.io/orion-panel-pro/\n' +
      'Die Karte nennt Einsaetze, Absage-Ausgang und Links.' +
      (kurs === null ? '\n(Kein EZB-Kurs verfuegbar — Betraege ehrlich in $.)' : '');

    const antwort = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: ziel.chat_id, text, disable_web_page_preview: true })
    });
    const tj = await antwort.json();
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
