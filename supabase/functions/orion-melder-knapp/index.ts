/* orion-melder-knapp — der ZWEITE Telegram-Bot (20.8.2026): meldet die
 * KNAPPSTEN PAARE, also Zeilen, die noch KEINE Chance sind, aber dicht
 * an der Gewinnzone stehen. Drilling von orion-melder-telegram —
 * eigener Bot, eigenes Geheimnis, eigene Zielzeile, eigene
 * Markierungsspalte. Der Chancen-Bot bleibt unangetastet daneben.
 *
 * BAND = RENDITE 0 BIS UNTER 2 (Stand 21.8.). Es war bis dahin
 * -0,5 bis 2, gestuetzt auf die Messung vom 20.8. (Band -0,25..0: 1
 * Zeile, -0,5..-0,25: 5, -1..-0,5: 34, 0..2: 0). Diese Messung sah aber
 * nur die DATENBANK, nicht das Panel: dort blendet die Rauschgrenze
 * (js/konfig.js, rauschGrenze: 0.0) alles unter null aus. Der Bot meldete
 * damit Zeilen, die im Panel nirgends zu finden waren. Seit 21.8. gilt
 * die Panel-Grenze auch hier. Einzelheiten am Abfragefilter unten.
 *
 * Gleiche Schutzgurte wie der Chancen-Bot v6: Wache-Urteil leer,
 * 120 s Bewaehrung, hoechstens einmal je Fund (Spalte knapp_gemeldet).
 * Buchsummen-Gurt hier als Deckel 1,02 — knappe Paare LIEGEN ueber 1,
 * aber wer weiter weg ist, ist nicht knapp.
 *
 * JEDER LINK FUEHRT INS EIGENE HAUS (v2, 20.8., Karams Vorgabe: "nicht
 * die von den Anbietern, sondern die von Pro"). Die beiden Buchzeilen
 * zeigen NICHT mehr direkt auf den Anbieter, sondern auf
 * beitrag.html?fund=<schluessel>&zu=1 bzw. &zu=2. Dort steht der
 * Absprung als eigener Klick, mit dem aktuellen Kurs daneben. Bei einem
 * knappen Paar wiegt das doppelt: die Zeile ist per Definition NOCH
 * keine Chance, wer direkt beim Anbieter landet, setzt auf eine Lage,
 * die es noch gar nicht gibt.
 *
 * Schluessel: Geheimnis TELEGRAM_BOT_TOKEN_KNAPP, Ziel orion_telegram
 * id=2. {"einrichten": true} nennt den Bot hinter dem Schluessel (getMe)
 * und listet die Chats, {"test": true} funkt ein MUSTER. Takt: pg_cron
 * orion-knapp-takt, alle fuenf Minuten (bewusst nicht minuetlich, siehe
 * Egress-Kapitel 8t). Die Cron-Schreibweise steht hier NICHT im Klartext:
 * ein Stern-Schraegstrich beendet den Blockkommentar mitten im Satz. */

const URL_SUPA = Deno.env.get('SUPABASE_URL') ?? '';
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN_KNAPP') ?? '';

const PANEL = 'https://harryclaude-hub.github.io/orion-panel-pro/';
const kopf = { 'content-type': 'application/json' };

/* Farbpunkte = die Buchfarben des Panels (css/stil.css --pm/--ka/--sm/--bf). */
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

/* WELCHE PARTIE IST DAS? (21.8., Karams Fund: "zwei Benachrichtigungen
 * fuer eine Chance")
 *
 * Die Gruppierung von heute frueh verglich den Titel BUCHSTAEBLICH. Das
 * genuegt nicht: dieselbe Partie laeuft unter zwei Titeln,
 *     "Botafogo FR vs. CS Cienciano"
 *     "Botafogo FR vs. CS Cienciano - More Markets"
 * und wurde deshalb zweimal gemeldet. Gemessen ueber drei Tage: 164 von
 * 453 Zeilen (36 %) tragen den Zusatz.
 *
 * Abgeschnitten wird NUR fuer den Vergleich. In der Nachricht steht
 * weiter der volle Titel: er sagt, welcher Markt gemeint ist. */
function partieSchluessel(titel: unknown): string {
  return String(titel ?? '')
    .replace(/\s*-\s*More Markets\s*$/i, '')
    .trim()
    .toLowerCase();
}

/* Ein knappes Paar als Telegram-HTML. Ehrlich: das ist KEINE Chance,
 * sondern ein Beobachtungsposten. geld() rechnet USD->EUR wenn Kurs da. */
function meldung(f: Record<string, unknown>, geld: (usd: unknown) => string): string {
  const b1 = String(f.buch_1 ?? 'polymarket'), b2 = String(f.buch ?? 'betfair');
  const p1 = PUNKT[b1] ?? '⚪', p2 = PUNKT[b2] ?? '⚪';
  const n1 = BUCHNAME[b1] ?? b1, n2 = BUCHNAME[b2] ?? b2;
  const r = Number(f.rendite);
  const e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2), aus = Number(f.auszahlung);
  /* FUNKPROBEN ZEIGEN AUFS PANEL, NICHT AUF EINEN ERFUNDENEN SCHLUESSEL
   * (21.8.). Die Probe baute ihren Link aus 'pm>bf:MUSTER'; beitrag.html
   * antwortete darauf ehrlich mit "Diesen Fund gibt es nicht mehr in der
   * Datenbank". Fuer den Leser sah das aus wie eine echte Meldung, deren
   * Fund verschwunden ist. Genau das hat Karam am 21.8. gemeldet, und die
   * Proben kamen von mir. Eine Testnachricht darf nie wie ein Fehler des
   * Betriebs aussehen. */
  const probe = f._probe === true;
  const beitrag = probe
    ? PANEL
    : PANEL + 'beitrag.html?fund=' + encodeURIComponent(String(f.schluessel ?? ''));
  /* Bei einer Probe haengt kein &zu an: PANEL traegt kein '?', ein
   * angehaengtes '&zu=1' ergaebe einen kaputten Link. */
  const zuLink = (n: number) => probe ? PANEL : beitrag + '&amp;zu=' + n;
  const lage = r < 0
    ? `noch <b>${Math.abs(r).toFixed(2)} %</b> bis zur Gewinnzone`
    : `<b>+${r.toFixed(2)} %</b>, unter der 2-%-Meldeschwelle`;
  const zeilen = [
    `\u{1F440} <b>KNAPPES PAAR</b> · ${lage} (noch keine Chance)`,
    `<b>${esc(f.titel)}</b>${f.mannschaft ? ' · ' + esc(f.mannschaft) : ''}`,
    `${p1} ${n1}: <b>${esc(f.pm_seite)}</b> zu ${Number(f.pm_preis).toFixed(3)} → <a href="${zuLink(1)}">ansehen</a>`,
    `${p2} ${n2}: <b>${esc(f.bf_seite)}</b> ${f.bf_name ? 'auf ' + esc(f.bf_name) + ' ' : ''}zu ${Number(f.bf_quote).toFixed(3)} → <a href="${zuLink(2)}">ansehen</a>`,
    (isFinite(e1) && isFinite(e2) && isFinite(aus)
      ? `\u{1F9EE} Bei 100 $ Einsatz kämen <b>${aus.toFixed(2)} $</b> zurück (${e1.toFixed(2)} $ auf ${n1}, ${e2.toFixed(2)} $ auf ${n2})`
      : ''),
    `\u{1F4B0} Platz bis <b>${geld(f.max_einsatz)}</b> Einsatz, falls es kippt`,
    /* Ehrlich sagen, dass dieselbe Partie noch ueber andere Buchpaare
     * gefunden wurde, statt dafuer eine zweite Nachricht zu schicken. */
    (Number(f._weitere) > 0
      ? `\u{1F517} Dieselbe Partie steht noch über <b>${Number(f._weitere)}</b> weitere Buchpaarung${Number(f._weitere) === 1 ? '' : 'en'} im Panel. Hier steht die beste davon.`
      : ''),
    `\u{1F4CB} <a href="${beitrag}">Ganze Karte öffnen</a> · kippt der Kurs, meldet der Chancen-Bot. Alle Links dieser Meldung führen dorthin, der Absprung zum Anbieter steht auf der Seite.`
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
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN_KNAPP fehlt als Geheimnis' }), { headers: kopf });
    }

    /* ---------- Einrichtungsmodus: WER ist der Bot, welche Chats sieht er? ----------
     * getMe nennt den Bot hinter dem gespeicherten Schluessel — so fliegt
     * ein versehentlich eingetragener FALSCHER Token sofort auf, statt
     * still "keine Chats" zu melden. */
    if (body.einrichten === true) {
      const meR = await fetch(`https://api.telegram.org/bot${TOKEN}/getMe`);
      const me = await meR.json();
      const bot = me?.ok && me.result
        ? { name: String(me.result.first_name ?? '?'), benutzername: '@' + String(me.result.username ?? '?') }
        : { fehler: 'getMe fehlgeschlagen: ' + JSON.stringify(me).slice(0, 120) };
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ allowed_updates: ['message', 'channel_post', 'my_chat_member'] })
      });
      const j = await r.json();
      if (!j.ok) {
        return new Response(JSON.stringify({ ok: false, bot, grund: 'Telegram: ' + JSON.stringify(j).slice(0, 200) }), { headers: kopf });
      }
      const chats = new Map<string, { id: string; titel: string; typ: string }>();
      for (const u of (j.result ?? [])) {
        const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
        if (c) chats.set(String(c.id), { id: String(c.id), titel: c.title ?? c.username ?? c.first_name ?? '?', typ: c.type });
      }
      return new Response(JSON.stringify({
        ok: true, einrichten: true, bot, gefundene_chats: [...chats.values()],
        hinweis: chats.size ? 'chat_id nach orion_telegram (id=2) eintragen und aktiv=true setzen.'
          : 'Keine Chats gefunden. Dem OBEN GENANNTEN Bot eine Direktnachricht schicken (START druecken), dann erneut einrichten.'
      }, null, 1), { headers: kopf });
    }

    /* ---------- Ziel und Wechselkurs ---------- */
    const zielRes = await db('orion_telegram?id=eq.2');
    const ziel = (await zielRes.json())[0];
    if (!ziel?.aktiv || !ziel?.chat_id) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktives Ziel in orion_telegram (id=2)' }), { headers: kopf });
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
        schluessel: 'pm>bf:MUSTER', _probe: true, rendite: -0.32,
        titel: 'Mjällby v Red Bull Salzburg', mannschaft: 'Mjällby',
        buch_1: 'smarkets', buch: 'betfair',
        pm_seite: 'JA', pm_preis: 0.62, pm_link: PANEL,
        bf_seite: 'Lay', bf_quote: 1.62, bf_name: 'Mjällby', bf_link: PANEL,
        einsatz_1: 48.2, einsatz_2: 51.8, auszahlung: 99.68,
        max_einsatz: 120, max_gewinn: -0.4
      }, geld);
      const tj = await sende(String(ziel.chat_id),
        '\u{1F4E1} FUNKPROBE — so sieht eine Knapp-Meldung aus (das hier ist ein MUSTER):\n\n' + muster);
      return new Response(JSON.stringify(tj.ok
        ? { ok: true, funkprobe: 'gesendet', kanal: ziel.chat_id }
        : { ok: false, grund: 'Telegram: ' + JSON.stringify(tj).slice(0, 200) }), { headers: kopf });
    }

    /* ---------- Kandidaten: das gemessene Band ----------
     *   1. rendite 0 bis unter 2 (darueber faengt der Chancen-Bot,
     *      darunter zeigt das Panel nichts an, siehe Begruendung
     *      direkt am Filter)
     *   2. pruefung LEER — kein Urteil steht gegen die Zeile
     *   3. buch_summe unter 1,02 oder ungemessen — wer weiter weg ist,
     *      ist nicht knapp
     *   4. 120 s Bewaehrung — fluechtige Zuckungen fallen raus
     *   5. hoechstens EINMAL je Fund (knapp_gemeldet) */
    const jetzt = Date.now();
    const bewaehrtVor = new Date(jetzt - 120_000).toISOString();
    const q = 'orion_funde?status=eq.live&knapp_gemeldet=eq.false' +
      '&pruefung=is.null' +
      '&or=(buch_summe.is.null,buch_summe.lt.1.02)' +
      /* UNTERGRENZE 0, NICHT -0,5 (21.8., Karams Fund: "davon war nix mehr
       * in den Chancen und es war auch nix im Verlauf").
       *
       * Gemessen: das Panel blendet ueber die RAUSCHGRENZE (js/konfig.js,
       * rauschGrenze: 0.0) alles unter null vollstaendig aus. Sichtbar
       * bleibt nur, was aktuell bei mindestens 0 steht ODER je eine
       * Chance war. Der Bot meldete aber ab -0,5 %.
       *
       * Ergebnis: eine Meldung ueber eine Zeile, die im Panel WEDER
       * unter Chancen NOCH unter Knapp NOCH im Verlauf zu finden war.
       * Genau die Fehlerklasse "zwei Wege mit zwei Massstaeben".
       *
       * Der Bot richtet sich jetzt nach dem Panel, nicht umgekehrt: eine
       * Meldung ueber etwas Unauffindbares ist schlimmer als keine
       * Meldung. PREIS, ehrlich: im 24-h-Fenster vom 20.8. lagen NULL
       * Zeilen im Band 0..2 %. Der Knapp-Bot wird also selten melden.
       * Wer das aendern will, senkt die rauschGrenze im Panel und zieht
       * DIESE Zeile mit. Eine Zahl, zwei Stellen, immer gemeinsam. */
      '&rendite=gte.0&rendite=lt.2' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null' +
      '&select=schluessel,nr,titel,mannschaft,rendite,max_einsatz,max_gewinn,buch,buch_1,' +
      'pm_seite,pm_preis,pm_link,bf_seite,bf_quote,bf_name,bf_link,einsatz_1,einsatz_2,auszahlung&limit=5';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein knappes Paar' }), { headers: kopf });
    }

    /* EINE PARTIE, EINE MELDUNG (21.8., Karams Fund: "immer die gleiche
     * Benachrichtigung"). Am 20.8. gingen FUENF Meldungen fuer EIN Spiel
     * raus (Botafogo FR vs. CS Cienciano), weil dieselbe Partie ueber
     * fuenf Buchpaarungen gefunden wurde: betfair>polymarket,
     * kalshi>betfair, kalshi>smarkets, polymarket>betfair,
     * smarkets>betfair. Jede Zeile war fuer sich richtig, als Nachricht
     * war es fuenfmal dasselbe Ereignis.
     *
     * Gemeldet wird jetzt die BESTE Zeile je Partie. Die uebrigen werden
     * mitgezaehlt (die Meldung nennt sie) und weiter unten mitmarkiert,
     * damit sie nicht im naechsten Takt einzeln nachkommen. Wer die
     * anderen Paarungen sehen will, findet sie auf der Beitragsseite. */
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

    const text = zuMelden.map((f: Record<string, unknown>) => meldung(f, geld)).join('\n\n────────\n\n');
    const tj = await sende(String(ziel.chat_id), text);
    if (!tj.ok) {
      return new Response(JSON.stringify({ ok: false, grund: 'Telegram: ' + JSON.stringify(tj).slice(0, 200) }), { headers: kopf });
    }

    /* Erst nach erfolgreichem Versand markieren — wie beim Chancen-Bot. */
    const schluessel = kand.map((f: Record<string, unknown>) => '"' + String(f.schluessel).replace(/"/g, '') + '"').join(',');
    await db('orion_funde?schluessel=in.(' + encodeURIComponent(schluessel) + ')', {
      method: 'PATCH',
      body: JSON.stringify({ knapp_gemeldet: true })
    });
    return new Response(JSON.stringify({ ok: true, gemeldet: kand.length, kanal: ziel.chat_id }), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
