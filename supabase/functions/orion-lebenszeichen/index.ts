/* orion-lebenszeichen — beantwortet die eine Frage, die Stille nie
 * beantwortet: LAEUFT ES NOCH?
 *
 * ANLASS (22.8.2026, Karams Wort): "Du hast zwei Nachrichten verschickt,
 * aber danach ist nichts mehr gekommen. Ich will wissen, warum."
 * Gemessen war die Lage in Ordnung - in 24 Stunden gab es schlicht keine
 * Zeile ueber 2 %. Aber das konnte Karam nicht sehen. Ein stummer Bot und
 * ein kaputter Bot sehen von aussen GENAU GLEICH aus. Diese Funktion macht
 * den Unterschied sichtbar.
 *
 * Sie meldet zweierlei:
 *   1. ALARM, wenn ein Fund durchgerutscht ist - also im Meldeband lag,
 *      von der Wache nicht beanstandet wurde, lange genug lebte und
 *      TROTZDEM nie gemeldet wurde. Das ist der Fall, den es nie geben
 *      darf, und bis heute gibt es ihn auch nicht (gemessen: 0 in 24 h).
 *   2. ALARM, wenn der Scanner steht, die Bridge schweigt oder alle
 *      Empfaenger stillgelegt sind.
 *   3. Sonst ein kurzes Lebenszeichen mit der besten Rendite des
 *      Zeitraums - damit Stille BELEGT ist und nicht nur behauptet.
 *
 * Sie meldet NUR an Bot 1 und NUR an art = 'direkt', also an Karam
 * selbst. NICHT ueber mit_beitragslink abgegrenzt: das Feld steht am
 * 22.8. auch bei Felix_2044 auf true, und ob Karams Laptop laeuft oder
 * die Bridge schweigt, geht einen Abonnenten nichts an.
 */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const kopf = { 'content-type': 'application/json' };

function db(pfad: string) {
  return fetch(`${URL_SUPA}/rest/v1/${pfad}`, {
    headers: { apikey: DIENST, authorization: `Bearer ${DIENST}` }
  }).then((r) => r.json());
}

Deno.serve(async (req) => {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leer ist normal */ }
    const stunden = Number(body.stunden) > 0 ? Number(body.stunden) : 6;
    const seit = new Date(Date.now() - stunden * 3600_000).toISOString();

    /* --- 1. Durchgerutschte Funde: das eigentliche Alarmzeichen --- */
    const bewaehrt = new Date(Date.now() - 300_000).toISOString();
    const durch = await db('orion_funde?select=schluessel,titel,rendite,beste_rendite' +
      '&status=eq.live&pruefung=is.null&telegram_gemeldet=eq.false' +
      '&rendite=gte.2&zuerst_gesehen=lte.' + bewaehrt + '&max_einsatz=not.is.null&limit=5');

    /* --- 2. Steht der Scanner? --- */
    const laeufe = await db('orion_laeufe?select=bereich,gelaufen_am&order=gelaufen_am.desc&limit=1');
    const letzterLauf = laeufe?.[0]?.gelaufen_am ? new Date(laeufe[0].gelaufen_am) : null;
    const laufAlterMin = letzterLauf ? (Date.now() - letzterLauf.getTime()) / 60000 : null;

    /* --- 3. Schweigt die Bridge? --- */
    const br = await db('bridge_odds?id=eq.1&select=updated_at,stats');
    const bridgeZeit = br?.[0]?.updated_at ? new Date(br[0].updated_at) : null;
    const bridgeAlterMin = bridgeZeit ? (Date.now() - bridgeZeit.getTime()) / 60000 : null;

    /* --- 4. Hat noch jemand Empfang? --- */
    const e1 = await db('orion_telegram_empfaenger?bot=eq.1&aktiv=is.true&select=id,chat_id,art');
    const e2 = await db('orion_telegram_empfaenger?bot=eq.2&aktiv=is.true&select=id');

    /* --- 5. Was war ueberhaupt los? --- */
    const gesehen = await db('orion_funde?select=rendite,beste_rendite,telegram_gemeldet,knapp_gemeldet' +
      '&zuletzt_gesehen=gte.' + seit + '&limit=2000');
    const liste = Array.isArray(gesehen) ? gesehen : [];
    const beste = liste.reduce((m: number, f: Record<string, unknown>) =>
      Math.max(m, Number(f.rendite) || -99, Number(f.beste_rendite) || -99), -99);
    const alsChance = liste.filter((f: Record<string, unknown>) => f.telegram_gemeldet).length;
    const alsKnapp = liste.filter((f: Record<string, unknown>) => f.knapp_gemeldet).length;

    /* --- Urteil --- */
    const alarme: string[] = [];
    if (Array.isArray(durch) && durch.length > 0) {
      alarme.push(`<b>${durch.length} Fund(e) NICHT gemeldet</b>, obwohl im Band und sauber:\n` +
        durch.map((f: Record<string, unknown>) =>
          `· ${String(f.titel).slice(0, 40)} (+${Number(f.rendite).toFixed(2)} %)`).join('\n'));
    }
    if (laufAlterMin === null) alarme.push('<b>Kein einziger Scannerlauf verzeichnet.</b>');
    else if (laufAlterMin > 20) alarme.push(`<b>Scanner steht</b> — letzter Lauf vor ${laufAlterMin.toFixed(0)} Minuten.`);
    if (bridgeAlterMin === null) alarme.push('<b>Bridge hat noch nie geliefert.</b>');
    else if (bridgeAlterMin > 10) alarme.push(`<b>Bridge schweigt</b> — letzte Lieferung vor ${bridgeAlterMin.toFixed(0)} Minuten. Laptop pruefen.`);
    if (!Array.isArray(e1) || e1.length === 0) alarme.push('<b>Chancen-Bot hat KEINEN aktiven Empfaenger.</b>');
    if (!Array.isArray(e2) || e2.length === 0) alarme.push('<b>Knapp-Bot hat KEINEN aktiven Empfaenger.</b>');

    const text = alarme.length
      ? '\u{1F6A8} <b>ORION — STOERUNG</b>\n\n' + alarme.join('\n\n') +
        `\n\n<i>Geprueft ueber die letzten ${stunden} Stunden.</i>`
      : '\u{2705} <b>ORION laeuft</b>\n' +
        `Letzte ${stunden} h: <b>${liste.length}</b> Zeilen geprueft, beste Rendite ` +
        `<b>${beste > -99 ? beste.toFixed(2) + ' %' : 'keine'}</b>.\n` +
        `Gemeldet: ${alsChance} Chance(n), ${alsKnapp} knappe(s) Paar(e).\n` +
        `Scanner vor ${laufAlterMin!.toFixed(0)} min gelaufen, Bridge vor ${bridgeAlterMin!.toFixed(0)} min geliefert.\n` +
        (alsChance === 0
          ? '\n<i>Keine Meldung heisst hier: es gab nichts ueber 2 %. Nicht: der Bot ist kaputt.</i>'
          : '');

    /* Betriebsmeldungen gehen NUR an den Direktchat. Abonnenten und
     * Kanal bekommen Funde, keine Stoerungsberichte. */
    const ziele = (Array.isArray(e1) ? e1 : []).filter(
      (e: Record<string, unknown>) => e.art === 'direkt');

    if (body.nur_pruefen === true) {
      return new Response(JSON.stringify({ ok: true, waere_gesendet: text, an: ziele.length, alarme: alarme.length }, null, 1), { headers: kopf });
    }
    /* Ohne Stoerung nur melden, wenn ausdruecklich gewuenscht: ein
     * stuendliches "alles gut" waere nach zwei Tagen Hintergrundrauschen
     * und wuerde im Ernstfall mit ueberlesen. */
    if (alarme.length === 0 && body.immer !== true) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine Stoerung', bericht: text }, null, 1), { headers: kopf });
    }

    let zugestellt = 0;
    for (const z of ziele) {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST', headers: kopf,
        body: JSON.stringify({ chat_id: String(z.chat_id), text, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      if ((await r.json()).ok === true) zugestellt++;
    }
    return new Response(JSON.stringify({ ok: true, alarme: alarme.length, zugestellt, bericht: text }, null, 1), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
