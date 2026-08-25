/* orion-melder-telegram — Chancen-Bot. Minutentakt ueber pg_cron.
 *
 * Die ausfuehrlichen Begruendungen stehen in UEBERGABE.md, Abschnitt 9a.
 * Hier nur, was man beim Lesen des Codes wissen muss.
 *
 * EMPFAENGER: alle aktiven Zeilen in orion_telegram_empfaenger (bot=1).
 * Nebeneinander moeglich: art='direkt' (Karam), 'kanal' (Bot ist Admin),
 * 'abo' (hat dem Bot geschrieben). Vorher war es genau EINER, deshalb
 * bekam ausser Karam niemand etwas.
 *
 * BEITRAGSLINK je Empfaenger (mit_beitragslink): beitrag.html liegt
 * hinter dem Kennwort, Fremde liefen dort an die Wand.
 *
 * SELBST-ANMELDUNG seit 24.8.: neue Chats werden bei JEDEM Takt
 * automatisch eingetragen (neueEintragen), mit Beitragslink.
 *
 * BEDIENUNG: {"einrichten":true} zeigt, wer nichts bekommt.
 *            {"abholen":true} traegt neue Chats sofort von Hand ein.
 *            {"test":true} funkt ein MUSTER an alle Empfaenger. */

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

/* Dieselbe Partie laeuft unter zwei Titeln, mit und ohne den Zusatz
 * "- More Markets" (36 % der Zeilen). Abgeschnitten wird NUR fuer den
 * Vergleich; in der Nachricht steht der volle Titel.
 * SPIEGEL: gleiche Funktion in orion-melder-knapp. */
function partieSchluessel(titel: unknown): string {
  return String(titel ?? '')
    .replace(/\s*-\s*More Markets\s*$/i, '')
    .trim()
    .toLowerCase();
}

/* GENAUE SETZ-ANWEISUNG je Seite (Karams Vorgabe 23.8.): WO, WAS und
 * WIE VIEL — mit der Zahl, die man am Buch WIRKLICH eintippt:
 *   Anteilspreis   Betrag in $ und die Stueckzahl (Betrag / Preis)
 *   Back           der Betrag selbst, zur Mindest-Quote
 *   Lay            das EINSATZ-FELD ist Betrag / (L − 1); die Haftung,
 *                  die die Boerse dann zeigt, ist der Betrag dieser
 *                  Rechnung. Den Haftungsbetrag ins Feld zu tippen ist
 *                  der klassische Lay-Fehler (das (L−1)-fache gesetzt). */
function anweisung(buch: string, seite: unknown, roh: number, usd: number): string {
  const s = String(seite ?? '').toLowerCase();
  const boerse = buch === 'betfair' || buch === 'smarkets';
  if (!boerse) {
    if (!(roh > 0 && roh < 1) || !isFinite(usd)) return usd.toFixed(2) + ' $';
    const st = buch === 'kalshi' ? 'Kontrakte' : 'Anteile';
    return `<b>${usd.toFixed(2)} $</b> = ≈${(usd / roh).toFixed(1)} ${st} zum Preis max. ${roh.toFixed(3)} $`;
  }
  if (!(roh > 1) || !isFinite(usd)) return usd.toFixed(2) + ' $';
  if (s === 'lay') {
    return `Lay zu max. ${roh.toFixed(2)}: <b>ins Einsatz-Feld ${(usd / (roh - 1)).toFixed(2)} $</b> — Haftung ${usd.toFixed(2)} $, und die Haftung ist dein Betrag`;
  }
  return `<b>${usd.toFixed(2)} $</b> Back zur Quote min. ${roh.toFixed(2)}`;
}

/* Die Zahl NACH Gebuehren im Kopf jeder Meldung (23.8., zweiter Teil):
 * ohne sie sieht "+0,42 % vor Gebuehren" besser aus, als es ist. */
function nettoText(f: Record<string, unknown>): string {
  const rn = Number(f.rendite_netto);
  if (f.rendite_netto === null || f.rendite_netto === undefined || !isFinite(rn)) return '';
  return ` · nach Gebühren ${rn >= 0 ? '+' : ''}${rn.toFixed(2)} %`;
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
    `\u{1F3AF} <b>ZIEL ERFASST · +${Number(f.rendite).toFixed(2)} % vor Gebühren</b>${nettoText(f)}`,
    `<b>${esc(f.titel)}</b>${f.mannschaft ? ' · ' + esc(f.mannschaft) : ''}`,
    buchZeile(p1, n1, f.pm_seite, Number(f.pm_preis), null, 1),
    buchZeile(p2, n2, f.bf_seite, Number(f.bf_quote), f.bf_name, 2),
    (isFinite(e1) && isFinite(e2) && isFinite(aus)
      ? (() => {
          /* Basis = handelbarer Deckel, hoechstens 1000 $ (Grundeinsatz);
           * ohne bekannte Menge ehrlich die 100er-Basis. Die Aufteilung
           * ist bei jedem Betrag dieselbe. */
          const max = Number(f.max_einsatz);
          const basis = isFinite(max) && max > 0 ? Math.min(1000, max) : 100;
          const skala = basis / 100;
          const g = (aus - 100) * skala;
          return [
            `\u{1F9EE} <b>So setzt du</b> — ${basis.toFixed(2)} $ gesamt` +
              (isFinite(max) && max > 0
                ? (max < 1000 ? ' (mehr passt zu diesen Kursen nicht hinein)' : '')
                : ' (Menge im Buch unbekannt, vorher pruefen)') + ':',
            /* Die Prozent-Aufteilung IMMER dazu (Karams Vorgabe 23.8.
             * abends): e1/e2 sind die Aufteilung von 100, also direkt
             * die Prozente vom Gesamteinsatz - bei jedem Betrag gleich. */
            `1⃣ ${n1} (<b>${e1.toFixed(1)} %</b> vom Gesamt): ${anweisung(b1, f.pm_seite, Number(f.pm_preis), e1 * skala)}`,
            `2⃣ ${n2} (<b>${e2.toFixed(1)} %</b> vom Gesamt): ${anweisung(b2, f.bf_seite, Number(f.bf_quote), e2 * skala)}`,
            `→ beide Ausgänge zahlen <b>${(aus * skala).toFixed(2)} $</b> zurück: <b>${g >= 0 ? '+' : ''}${g.toFixed(2)} $</b> sicher, vor Gebühren`
          ].join('\n');
        })()
      : ''),
    `\u{1F4B0} Einsatz bis <b>${geld(f.max_einsatz)}</b> · holbar ~<b>${geld(f.max_gewinn)}</b>`,
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

/* SELBST-ANMELDUNG (24.8., Karams Vorgabe: "jeder, der den Bot startet,
 * bekommt immer alle Benachrichtigungen - dieselben wie ich, mit Links").
 *
 * Vorher musste jemand von Hand {"abholen":true} rufen, und ein /start
 * verfiel nach 24 Stunden (getUpdates haelt Updates nur so lange).
 * Jetzt laeuft das Eintragen bei JEDEM Takt automatisch, VOR dem Holen
 * der Empfaenger - ein frisch Gestarteter bekommt also schon den
 * laufenden Takt mit. Neue Empfaenger bekommen mit_beitragslink=true
 * (Karams Ansage; die Beitragsseite liegt hinter dem Sperrwort, das
 * gibt der Betreiber der Community selbst weiter). Ein Fehler hier darf
 * den Meldelauf NIE reissen - deshalb alles im try, Rueckgabe 0. */
async function neueEintragen(): Promise<number> {
  try {
    const bk = await bekannteChats();
    if (!bk.ok) return 0;
    const empf = await holeEmpfaenger();
    const drin = new Set((empf ?? []).map((e: Record<string, unknown>) => String(e.chat_id)));
    const neu = bk.chats.filter((c) => !drin.has(c.id));
    if (neu.length === 0) return 0;
    const r = await db('orion_telegram_empfaenger?on_conflict=bot,chat_id', {
      method: 'POST',
      headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(neu.map((c) => ({
        bot: BOT_NR, chat_id: c.id, art: c.typ === 'channel' ? 'kanal' : 'abo',
        name: c.titel, aktiv: true, mit_beitragslink: true
      })))
    });
    const angelegt = await r.json();
    const anzahl = Array.isArray(angelegt) ? angelegt.length : 0;
    /* Kurze Begruessung, damit der neue Empfaenger WEISS, dass es
     * geklappt hat - sonst sieht ein stummer Bot aus wie ein kaputter. */
    for (const z of (Array.isArray(angelegt) ? angelegt : [])) {
      try {
        await sende(String((z as Record<string, unknown>).chat_id),
          '✅ Angemeldet. Ab jetzt bekommst du hier automatisch jede Meldung dieses Bots — dieselben wie der Betreiber, mit allen Links.\n' + PANEL);
      } catch { /* Begruessung ist Schmuck, kein Muss */ }
      await new Promise((w) => setTimeout(w, 150));
    }
    return anzahl;
  } catch { return 0; }
}

Deno.serve(async (req) => {
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leerer Koerper ist normal */ }

    if (!TOKEN) {
      return new Response(JSON.stringify({ ok: false, grund: 'TELEGRAM_BOT_TOKEN fehlt' }), { headers: kopf });
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
          name: c.titel, aktiv: true, mit_beitragslink: true
        })))
      });
      const angelegt = await r.json();
      return new Response(JSON.stringify({
        ok: true, neu_eingetragen: Array.isArray(angelegt) ? angelegt.length : 0, zeilen: angelegt,
        hinweis: 'Mit Beitragslink eingetragen (Karams Vorgabe 24.8.: alle bekommen dasselbe).'
      }, null, 1), { headers: kopf });
    }

    /* Erst neue /start-Chats eintragen, DANN die Empfaenger holen. */
    const neuAngemeldet = await neueEintragen();
    const empfaenger = await holeEmpfaenger();
    if (!Array.isArray(empfaenger) || empfaenger.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'kein aktiver Empfaenger' }), { headers: kopf });
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
        schluessel: 'pm>bf:MUSTER', _probe: true, rendite: 2.34,
        titel: 'Cincinnati Open: Iga Swiatek vs Diane Parry', mannschaft: 'Iga Swiatek',
        buch_1: 'polymarket', buch: 'betfair',
        pm_seite: 'JA', pm_preis: 0.44, bf_seite: 'Lay', bf_quote: 1.8, bf_name: 'Iga Swiatek',
        rendite_netto: 1.02,
        einsatz_1: 45.1, einsatz_2: 54.9, auszahlung: 102.34,
        max_einsatz: 94, max_gewinn: 5.2, _weitere: 2
      };
      const bericht = await sendeAnAlle(empfaenger, (mitLinks) =>
        '\u{1F4E1} <b>FUNKPROBE — KEIN ECHTER FUND</b>\nMuster zum Pruefen der Zustellung. Die Zahlen sind erfunden.\n\n' +
        meldung(muster, geld, mitLinks));
      return new Response(JSON.stringify({ ok: true, funkprobe: bericht, empfaenger: empfaenger.length }, null, 1), { headers: kopf });
    }

    const bewaehrtVor = new Date(Date.now() - 120_000).toISOString();
    /* BUCHSUMMEN-GURT, am 23.8. UMGEDREHT. Bis dahin stand hier
     * buch_summe.lt.1, also "melde nur unter 1". Das war falsch herum und
     * hat praktisch alles ausgesperrt: gemessen 24 Zeilen im Chancenband
     * und 96 im Knappband, davon 22 bzw. 83 allein an diesem Gurt.
     *
     * buch_summe ist die Marge EINES Buches, nicht die Summe der Paarung.
     * Am 23.8. an vier Faellen nachgerechnet: Preis plus Restseite ergibt
     * exakt den Wert (0,6410 + 0,3707 = 1,0118). Eine Marge MUSS ueber 1
     * liegen. Die Arbitrage steckt in beiden Buechern zusammen, dort lagen
     * dieselben Faelle bei 0,9210 bis 0,9846 - und die Rendite passt
     * lueckenlos dazu, Gebuehrenabstand eingerechnet.
     *
     * js/anzeige.js:1481 liest den Wert seit jeher richtig herum
     * ("unter 1 = UNSTIMMIG, ein Kurs klebt"). Der Gurt folgt jetzt dieser
     * Deutung: unter 1 ist verdaechtig, ab 1 ist der Normalfall.
     *
     * OBERGRENZE 1,30 ist neu und NICHT Teil von Karams Entscheidung: in
     * den Daten steht eine Zeile mit buch_summe 2,0280 (West Ham gegen
     * Charlton). Eine Marge von 103 % hat kein gesundes Buch, das ist ein
     * Datenfehler. Ohne Deckel waere sie ab jetzt meldefaehig. Soll der
     * Deckel weg, ist es diese eine Zahl. */
    /* BAND 2 bis 6,5 seit 23.8.: rendite ist VOR Gebuehren gerechnet
     * (Karams Vorgabe), und der Plausibilitaetsdeckel wanderte von 5
     * (netto gemessen) auf 6,5 (roh). Dieselbe Zahl wie KONFIG
     * .maxPlausibel, orion_verlauf_urteil und orion_verdacht. */
    const q = 'orion_funde?status=eq.live&telegram_gemeldet=eq.false' +
      '&pruefung=is.null' +
      '&or=(buch_summe.is.null,and(buch_summe.gte.1,buch_summe.lte.1.3))' +
      '&rendite=gte.2&rendite=lte.6.5' +
      '&zuerst_gesehen=lte.' + bewaehrtVor +
      '&max_einsatz=not.is.null&max_gewinn=gte.5' +
      '&select=schluessel,nr,titel,mannschaft,rendite,rendite_netto,max_einsatz,max_gewinn,buch,buch_1,' +
      'pm_seite,pm_preis,pm_link,bf_seite,bf_quote,bf_name,bf_link,einsatz_1,einsatz_2,auszahlung' +
      /* SORTIERUNG, 25.8.2026 (Karams Freigabe). Bis heute stand hier nur
       * '&limit=5' OHNE order - PostgREST gab dann fuenf Zeilen in
       * BELIEBIGER Tabellenordnung heraus. Bei mehr als fuenf Bewerbern
       * konnte der dickste Fund herausfallen, BEVOR ueberhaupt jemand
       * sortiert. Verloren ging er nicht (die uebrigen bleiben
       * telegram_gemeldet=false und kommen im naechsten Takt dran), aber
       * verzoegert - und eine grosse Chance lebt oft nur Minuten.
       *
       * SORTIERT WIRD NACH GELD, nicht nach Prozent: das Band ist ohnehin
       * auf 2 bis 6,5 % verengt, innerhalb dieses schmalen Bandes
       * entscheidet die Buchtiefe ueber den Ertrag (2,1 % auf 5000 $ sind
       * 105 $, 6,4 % auf 100 $ sind 6,40 $). nullslast ist Pflicht -
       * ohne sie stuenden Zeilen ohne bekannten Gewinn ganz oben.
       *
       * ABWEICHUNG, bewusst: die Auswahl 'beste je Partie' weiter unten
       * vergleicht Number(b.rendite). Das ist kein Widerspruch, sondern
       * eine andere Frage: hier geht es darum, WELCHE Bewerber ueberhaupt
       * hereinkommen (Geld), dort darum, welche EINE Zeile derselben
       * Partie gezeigt wird (Prozent). Wer das vereinheitlichen will,
       * aendert beide Stellen zusammen. */
      '&order=max_gewinn.desc.nullslast,rendite.desc,zuerst_gesehen.asc' +
      '&limit=5';
    const kand = await (await db(q)).json();
    if (!Array.isArray(kand) || kand.length === 0) {
      return new Response(JSON.stringify({ ok: true, getan: 'nichts', grund: 'keine neue Chance', neu_angemeldet: neuAngemeldet }), { headers: kopf });
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
      method: 'PATCH', body: JSON.stringify({ telegram_gemeldet: true })
    });
    return new Response(JSON.stringify({
      ok: true, gemeldet: zuMelden.length, zeilen_markiert: kand.length, zustellung: bericht,
      neu_angemeldet: neuAngemeldet
    }, null, 1), { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
