# -*- coding: utf-8 -*-
# Erzeugt orion-melder-knapp AUS orion-melder-telegram.
#
# Warum erzeugt statt von Hand gepflegt: die beiden sind Drillinge. Zwei
# handgepflegte Fassungen laufen auseinander, das ist die Fehlerklasse
# "Drift zwischen zwei Fassungen". Hier steht an EINER Stelle, worin sie
# sich unterscheiden duerfen.
#
# ALLE Ersetzungen als rohe Zeichenketten (r"..."), sonst frisst Python
# die \u-Escapes im TypeScript-Text.
import io

QUELLE = 'supabase/functions/orion-melder-telegram/index.ts'
ZIEL   = 'supabase/functions/orion-melder-knapp/index.ts'

s = io.open(QUELLE, encoding='utf-8').read()

KOPF = r'''/* orion-melder-knapp — der ZWEITE Telegram-Bot: meldet die KNAPPSTEN
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
 * hoechstens einmal je Fund. Buchsummen-Gurt hier als Deckel 1,02 —
 * knappe Paare LIEGEN ueber 1, aber wer weiter weg ist, ist nicht knapp.
 *
 * BEDIENUNG: {"einrichten": true} listet, wer nichts bekommt.
 *            {"abholen": true} traegt neue Chats ein.
 *            {"test": true} funkt ein MUSTER an alle Empfaenger.
 */
'''

marke = ' */\n\nconst URL_SUPA'
s = KOPF + s[s.index(marke) + len(' */\n'):]

TAUSCH = [
    # Schluessel, Botnummer, Markierungsspalte
    (r"const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';",
     r"const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN_KNAPP') ?? '';"),
    (r"const BOT_NR = 1;", r"const BOT_NR = 2;"),
    (r"TELEGRAM_BOT_TOKEN fehlt", r"TELEGRAM_BOT_TOKEN_KNAPP fehlt"),
    (r"telegram_gemeldet", r"knapp_gemeldet"),

    # Kandidatenband
    (r"'&or=(buch_summe.is.null,buch_summe.lt.1)' +",
     r"'&or=(buch_summe.is.null,buch_summe.lt.1.02)' +"),
    (r"'&rendite=gte.2&rendite=lte.5' +",
     r"'&rendite=gte.0&rendite=lt.2' +"),
    (r"'&max_einsatz=not.is.null&max_gewinn=gte.5' +",
     r"'&max_einsatz=not.is.null' +"),
    (r"grund: 'keine neue Chance'", r"grund: 'kein knappes Paar'"),

    # Nachrichtentext
    (r"    `\u{1F3AF} <b>ZIEL ERFASST · +${Number(f.rendite).toFixed(2)} %</b>`,",
     r"    `\u{1F440} <b>KNAPPES PAAR</b> · <b>+${Number(f.rendite).toFixed(2)} %</b>, unter der 2-%-Meldeschwelle (noch keine Chance)`,"),
    (r"      ? `\u{1F9EE} Bei 100 $ Einsatz: <b>${e1.toFixed(2)} $</b> auf ${n1}, <b>${e2.toFixed(2)} $</b> auf ${n2} → <b>${aus.toFixed(2)} $</b> zurück, egal wie es endet`",
     r"      ? `\u{1F9EE} Bei 100 $ Einsatz kämen <b>${aus.toFixed(2)} $</b> zurück (${e1.toFixed(2)} $ auf ${n1}, ${e2.toFixed(2)} $ auf ${n2})`"),
    (r"    `\u{1F4B0} Einsatz bis <b>${geld(f.max_einsatz)}</b> · holbar ~<b>${geld(f.max_gewinn)}</b>`,",
     r"    `\u{1F4B0} Platz bis <b>${geld(f.max_einsatz)}</b> Einsatz, falls es kippt`,"),

    # Muster der Funkprobe
    (r"schluessel: 'pm>bf:MUSTER', _probe: true, rendite: 2.34,",
     r"schluessel: 'pm>bf:MUSTER', _probe: true, rendite: 0.42,"),
    (r"titel: 'Cincinnati Open: Iga Swiatek vs Diane Parry', mannschaft: 'Iga Swiatek',",
     r"titel: 'Mjällby v Red Bull Salzburg', mannschaft: 'Mjällby',"),
    (r"buch_1: 'polymarket', buch: 'betfair',", r"buch_1: 'smarkets', buch: 'betfair',"),
    (r"pm_seite: 'JA', pm_preis: 0.44, bf_seite: 'Lay', bf_quote: 1.8, bf_name: 'Iga Swiatek',",
     r"pm_seite: 'JA', pm_preis: 0.62, bf_seite: 'Lay', bf_quote: 1.62, bf_name: 'Mjällby',"),
    (r"einsatz_1: 45.1, einsatz_2: 54.9, auszahlung: 102.34,",
     r"einsatz_1: 48.2, einsatz_2: 51.8, auszahlung: 100.42,"),
    (r"max_einsatz: 94, max_gewinn: 5.2, _weitere: 2",
     r"max_einsatz: 120, max_gewinn: 0.5, _weitere: 4"),

    # Verweise
    (r"'kein aktiver Empfaenger'",
     r"'kein aktiver Empfaenger (bot 2)'"),
    (r"SPIEGEL: gleiche Funktion in orion-melder-knapp.",
     r"SPIEGEL: gleiche Funktion in orion-melder-telegram."),
]

fehlend = []
for alt, neu in TAUSCH:
    if alt not in s:
        fehlend.append(alt[:60])
    s = s.replace(alt, neu)

if fehlend:
    print('ABBRUCH, diese Stellen fehlen in der Quelle:')
    for f in fehlend:
        print('   ' + f)
    raise SystemExit(1)

io.open(ZIEL, 'w', encoding='utf-8', newline='').write(s)
print('erzeugt: ' + ZIEL + '  (' + str(len(s)) + ' Bytes)')
