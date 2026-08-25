-- ===========================================================================
-- FRISCHESPERRE AN DER WURZEL  (25.8.2026)
-- ===========================================================================
-- ABSCHRIFT DER LAUFENDEN DATENBANK, keine Absichtserklaerung.
-- Vor jeder Aenderung mit pg_get_functiondef abgleichen. Diese Datei
-- existiert, weil genau das Gegenteil heute frueh ein Sprengsatz war:
-- supabase/wache-tennis-turnier.sql stand auf einem Stand, der jede gesunde
-- Zeile als "falsch" gestempelt haette.
--
-- WAS DIESE DATEI LOEST
-- ---------------------
-- Der Scanner paarte bis zum 25.8. gegen Kurse, die laengst tot waren. Am
-- 24.8. war das nachweisbar: von 29 gemeldeten Funden betraf JEDER Betfair,
-- das mittlere Kursalter lag bei 13,6 Minuten, der aelteste bei 78 Minuten.
-- Gemessen wurde das Alter zwar (bf_alter_s, kalshi_alter_s,
-- smarkets_alter_s), aber es sperrte NICHTS - es stand nur im Bericht.
--
-- Jetzt sperrt es an der Wurzel: steht ein Buch zu lange still, kommen
-- daraus gar keine Maerkte mehr, also entstehen auch keine Paare.
--
-- DIE SIGNATURFALLE (zweimal zugeschlagen, 24.8. und 25.8.)
-- ---------------------------------------------------------
-- CREATE OR REPLACE mit einer NEUEN Signatur ersetzt die alte Funktion
-- NICHT - es legt eine ZWEITE daneben. PostgREST waehlt dann anhand der
-- uebergebenen Parameternamen, und der Scanner schickt weiterhin den alten
-- Rumpf. Ergebnis: die alte, ungeschuetzte Fassung laeuft weiter und die
-- ganze Reparatur ist wertlos. Am 24.8. fiel das nur durch die Gegenprobe
-- auf; am 25.8. standen nach dem CREATE erneut je zwei Fassungen da.
--
-- DESHALB IMMER IN DIESER REIHENFOLGE:
--   1. neue Fassung anlegen (die alte lebt weiter, nichts bricht)
--   2. ALTE SIGNATUR DROPPEN
--   3. notify pgrst, 'reload schema'
--   4. GEGENPROBE: es darf je Name nur EINE Fassung uebrig sein
--   5. GEGENPROBE: der Aufruf mit dem ALTEN Rumpf muss weiter gehen
--
-- DIE SCHWELLEN, GEMESSEN
-- -----------------------
-- Betfair 300 s: die Bridge liefert im Sekundentakt. Gemessen am 25.8.
--   ueber 3274 Laeufe seit Inbetriebnahme der Sperre: mittleres Alter
--   13 bis 17 s, aeltestes 91 s.
--
-- Kalshi und Smarkets 900 s: beide Sammler laufen im 120-s-Takt
--   (pg_cron Job 3 und Job 74, '*/2 * * * *').
--   Seit der Erholung vom Ausfall (25.8. 07:42): je 129 Takte, NULL
--   Fehlschlaege, groesste Luecke 123 s.
--   Im schlimmsten je gemessenen Fenster - dem Ausfall vom 23. bis 25.8.,
--   in dem 45 % aller Takte mit 'job startup timeout' scheiterten -
--   betrug die groesste Luecke 517 s, p99 lag bei 307 s, p999 bei 410 s,
--   und es gab KEINE EINZIGE Luecke ueber 600 s.
--   Dazu die Laufdauer des Sammlers (Kalshi 67 s, Smarkets 16 s), macht
--   ein schlimmstes erreichbares Alter von rund 584 s.
--   900 s laesst damit 316 s Abstand ueber dem schlimmsten je gemessenen
--   Wert und das 7,3-fache des Normalbetriebs. Ein wirklich eingefrorenes
--   Buch steht Stunden, nicht Minuten.
--
-- max_alter_s <= 0 schaltet die Sperre ab. Einheitlich bei allen dreien.
--
-- DIE RUECKGABEFORM IST ABSICHT
-- -----------------------------
-- Greift die Sperre, kommt weiter GENAU EINE Zeile - nur maerkte ist leer,
-- updated_at bleibt stehen. Der Scanner rechnet daraus kalshi_alter_s bzw.
-- smarkets_alter_s. Gaebe die Funktion NULL Zeilen zurueck, faenge
-- orion-lauf zwar den Absturz ab (index.ts:338 und :365), aber die
-- Alterszahl waere weg - und damit der einzige Beleg, WARUM nichts kam.
-- Ein stiller Filter ist die teuerste Fehlerklasse dieses Projekts.
--
-- WAS DIE SPERRE NICHT KANN (ehrlich)
-- -----------------------------------
-- Sie beweist "die Quelle spricht", nicht "dieser Kurs ist frisch".
--   * bf-bridge/index.ts:48 stempelt updated_at BEDINGUNGSLOS, die
--     Marktliste dagegen nur bei gueltigem Array (:50) - und :131 ist ein
--     Teil-Update. Ein POST mit gueltigem Token ohne markets frischt also
--     die Uhr auf, ohne die Kurse zu erneuern. (Fehlerklasse L5, im Code
--     bestaetigt, Reparaturvorschlag: eigene Spalte markets_at.)
--   * Die Bridge selbst laedt in jeder Runde alte Kurse mit hoch: sie
--     katalogisiert je Durchlauf nur EINE Sportart neu und liest nur
--     kurseProDurchlauf Maerkte frisch (Standard 400), sendet aber den
--     gesamten Vorrat (gemessen: vorrat 1723, gelesen 400, gesendet 504).
--     Ein Alter JE MARKT erreicht den Server heute gar nicht.
--   * Kalshi stempelt beim SCHREIBEN, die Abrufe liefen ueber den ganzen
--     Durchlauf davor (dauer_ms 67207 gemessen). updated_at unterschaetzt
--     das Alter des aeltesten Marktes also um bis zu gut eine Minute.
-- Der belastbare Frischebeweis JE MARKT bleibt pm_preis_seit /
-- bf_quote_seit im Panel (KONFIG.gross.kursMaxS).
--
-- SICHTBARKEIT
-- ------------
-- Zu jeder der drei Sperren gehoert eine Regel in orion_verdacht_zusatz()
-- (Regeln 3, 4, 5): "BRIDGE STEHT", "KALSHI STEHT", "SMARKETS STEHT".
-- Die Grenzen dort sind DIESELBEN Zahlen wie hier. Wer eine aendert, muss
-- beide aendern.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- BETFAIR  (Sperre seit 25.8., 10:48 UTC)
-- Aufruf: orion-lauf/index.ts:306-308 mit {fenster_h:12, bereich_p:bereich}
-- ---------------------------------------------------------------------------
drop function if exists public.orion_bf_maerkte(integer, text);

create or replace function public.orion_bf_maerkte(
  fenster_h integer default 12,
  bereich_p text default null::text,
  max_alter_s integer default 300
)
returns jsonb
language sql
stable
as $function$
  select coalesce(jsonb_agg(j), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'k',       m->>'k',
             'ev',      m->>'ev',
             'mt',      m->>'mt',
             'st',      m->>'st',
             'link',    m->>'link',
             'sz',      m->'sz',
             'et',      m->>'et',
             'co',      m->>'co',
             'bereich', coalesce(orion_bereich_bf(m->>'et', m->>'co'), s.bereich),
             'r',    (select coalesce(jsonb_agg(jsonb_build_object(
                        'n', x->>'n', 'b', x->'b', 'l', x->'l',
                        'bs', x->'bs', 'ls', x->'ls')), '[]'::jsonb)
                        from jsonb_array_elements(m->'r') x)
           ) as j
    from bridge_odds b
    cross join lateral jsonb_array_elements(b.markets) as m
    left join orion_bf_sport s on s.et = m->>'et'
    where b.id = 1
      /* FRISCHESPERRE (25.8.): steht die Bridge laenger als max_alter_s,
       * kommt hier NICHTS mehr heraus. Tote Kurse sollen erst gar keine
       * Paarung erzeugen. max_alter_s <= 0 schaltet die Sperre ab. */
      and (max_alter_s <= 0
           or b.updated_at > now() - make_interval(secs => max_alter_s))
      and (m->>'mt' = 'MATCH_ODDS' or m->>'mt' like 'OVER_UNDER_%')
      and (m->>'st') is not null
      and (m->>'st')::timestamptz > now()
      and (m->>'st')::timestamptz <= now() + make_interval(hours =>
            least(fenster_h, case when bereich_p is null then 12 else 24 end))
      /* Die Verfeinerung gilt AUCH beim Filtern, sonst liefe der lol-Radar
       * weiter ins Leere. */
      and (bereich_p is null or coalesce(orion_bereich_bf(m->>'et', m->>'co'), s.bereich) = bereich_p)
    order by (m->>'st')::timestamptz
    limit (case when bereich_p is null then 250 else 400 end)
  ) t;
$function$;


-- ---------------------------------------------------------------------------
-- KALSHI  (Sperre NEU am 25.8.)
-- Aufruf: orion-lauf/index.ts:334-336 mit {bereich_p: bereich}
-- ---------------------------------------------------------------------------
create or replace function public.orion_kalshi_maerkte(
  bereich_p text,
  max_alter_s integer default 900
)
returns table(maerkte jsonb, updated_at timestamptz)
language sql
stable
set search_path to 'public'
as $function$
  -- EGRESS-BREMSE 20.8.2026: orion-lauf holte den GANZEN Kalshi-Schnappschuss
  -- (208 KB) und warf im Edge-Code ~90 % weg (fremde Bereiche). Dieselbe
  -- Auswahl hier, VOR dem Versand, ueber den bestehenden dritten
  -- Zuordnungsweg orion_bereich_kalshi(serie) -- KEINE neue Logik.
  -- Der Edge-Code prueft weiterhin nach (Gurt und Hosentraeger).
  select case
           when max_alter_s > 0
            and s.updated_at <= now() - make_interval(secs => max_alter_s)
             then '[]'::jsonb
           else coalesce((
             select jsonb_agg(m)
             from jsonb_array_elements(s.maerkte) m
             where orion_bereich_kalshi(m->>'serie') = bereich_p
           ), '[]'::jsonb)
         end as maerkte,
         s.updated_at
  from kalshi_snapshot s
  where s.id = 1;
$function$;

drop function if exists public.orion_kalshi_maerkte(text);


-- ---------------------------------------------------------------------------
-- SMARKETS  (Sperre NEU am 25.8.)
-- Aufruf: orion-lauf/index.ts:361-362 mit dem Rumpf '{}'
--
-- WICHTIGSTE der drei: Smarkets trug am 25.8. 227 von 410 Zeilen und hatte
-- bis dahin KEINEN Riegel gegen ein eingefrorenes Buch ausser dem
-- Plausibilitaetsdeckel.
--
-- SIGNATURFALLE hier besonders heimtueckisch: die alte Fassung nahm NULL
-- Argumente und wird mit '{}' gerufen. Eine neue Fassung mit einem
-- Vorgabewert stellt sich daneben, und PostgREST nimmt bei leerem Rumpf
-- weiter die 0-Argument-Fassung. Der DROP unten ist also nicht Kosmetik,
-- sondern der eigentliche Schalter.
-- ---------------------------------------------------------------------------
create or replace function public.orion_sm_maerkte(
  max_alter_s integer default 900
)
returns table(maerkte jsonb, updated_at timestamptz)
language sql
stable
set search_path to 'public'
as $function$
  -- EGRESS-BREMSE 20.8.2026: die Smarkets-Quoten trugen 16 Nachkommastellen
  -- (Gleitkomma-Artefakte des Sammlers, "2.8401022436807724"). Gerundet auf
  -- 6 Stellen (Quoten) bzw. 2 Stellen (Mengen) -- weit feiner als jeder
  -- echte Kurs-Tick, aber halb so viele Bytes. Inhalt sonst unveraendert.
  select case
           when max_alter_s > 0
            and s.updated_at <= now() - make_interval(secs => max_alter_s)
             then '[]'::jsonb
           else coalesce((
             select jsonb_agg(
               case when jsonb_typeof(m->'r') = 'array' then
                 m || jsonb_build_object('r', (
                   select jsonb_agg(
                     l
                     || case when (l->>'b')  is not null then jsonb_build_object('b',  round((l->>'b')::numeric, 6))  else '{}'::jsonb end
                     || case when (l->>'l')  is not null then jsonb_build_object('l',  round((l->>'l')::numeric, 6))  else '{}'::jsonb end
                     || case when (l->>'bs') is not null then jsonb_build_object('bs', round((l->>'bs')::numeric, 2)) else '{}'::jsonb end
                     || case when (l->>'ls') is not null then jsonb_build_object('ls', round((l->>'ls')::numeric, 2)) else '{}'::jsonb end
                   )
                   from jsonb_array_elements(m->'r') l
                 ))
               else m end
             )
             from jsonb_array_elements(s.maerkte) m
           ), '[]'::jsonb)
         end as maerkte,
         s.updated_at
  from smarkets_snapshot s
  where s.id = 1;
$function$;

drop function if exists public.orion_sm_maerkte();


-- ---------------------------------------------------------------------------
-- PostgREST muss den neuen Stand lernen
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ===========================================================================
-- GEGENPROBE - nach JEDER Aenderung ausfuehren
-- ===========================================================================
-- 1. Je Name genau EINE Fassung, und jede mit Sperre:
--
--    select p.oid::regprocedure::text as fassung,
--           (pg_get_functiondef(p.oid) like '%max_alter_s%') as hat_sperre
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('orion_bf_maerkte','orion_kalshi_maerkte','orion_sm_maerkte')
--     order by 1;
--
--    Erwartet (gemessen am 25.8.):
--      orion_bf_maerkte(integer,text,integer)   true
--      orion_kalshi_maerkte(text,integer)       true
--      orion_sm_maerkte(integer)                true
--
-- 2. Im Normalbetrieb darf die Sperre NICHTS wegnehmen:
--
--    select jsonb_array_length(orion_bf_maerkte(12,'tennis',300)) as mit,
--           jsonb_array_length(orion_bf_maerkte(12,'tennis',0))   as ohne;
--    -- gemessen 25.8.: 44 und 44
--
-- 3. Bei zu altem Schnappschuss MUSS sie greifen, und die Uhr muss bleiben:
--
--    select (select jsonb_array_length(maerkte) from orion_sm_maerkte(900)) as normal,
--           (select jsonb_array_length(maerkte) from orion_sm_maerkte(5))   as gesperrt,
--           (select count(*)                    from orion_sm_maerkte(5))   as zeilen,
--           (select updated_at is not null      from orion_sm_maerkte(5))   as uhr_da;
--    -- gemessen 25.8.: 944 / 0 / 1 / true
--
-- 4. Der Aufruf mit dem ALTEN Rumpf muss weiter gehen (das ist die Falle):
--
--    curl -s -X POST ".../rest/v1/rpc/orion_sm_maerkte" \
--         -H "apikey: <key>" -H "content-type: application/json" -d '{}'
--    curl -s -X POST ".../rest/v1/rpc/orion_kalshi_maerkte" \
--         -H "apikey: <key>" -H "content-type: application/json" -d '{"bereich_p":"tennis"}'
--    -- beide gemessen 25.8.: HTTP 200, eine Zeile, maerkte + updated_at
-- ===========================================================================
