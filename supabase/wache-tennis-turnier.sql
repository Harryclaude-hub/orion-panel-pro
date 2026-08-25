-- TENNIS-TURNIERPRAEFIX IN DEN KENNUNGSSPERREN  (19.8.2026)
--
-- ANWENDEN: Supabase-Dashboard -> SQL Editor -> diese Datei komplett
-- einfuegen und ausfuehren. Einmalig. Ohne diesen Schritt sperren
-- orion_wache_stufe2 und orion_kennung_pruefen jede Frauen-Tennis-
-- Paarung als "Mannschaftsklasse ungleich".
--
-- WARUM: Polymarket-Titel tragen bei Tennis ein Turnierpraefix
--   "ITF W35 Krakow Women: Amelia Paszun vs Radka Zelnickova"
-- Die Kennungssperren vergleichen orion_kennung(titel) gegen
-- orion_kennung(bf_partie). Das Wort "Women" im TURNIERNAMEN ergibt
-- die Kennung 'w', waehrend Betfairs Partie ("Amelia Paszun v Radka
-- Zelnickova") keine traegt — Sperre, obwohl beide Buecher dieselbe
-- Frauen-Partie meinen. Gemessen am 19.8.: 2 der 19 paarbaren
-- Tennis-Partien tragen "Women" im Turniernamen.
--
-- orion_partie_von_titel ist der SQL-Spiegel von turnierRein() in
-- js/zuordnung.js und supabase/functions/orion-lauf/zuordnung.ts:
-- steht nach dem LETZTEN Doppelpunkt eine vs-Partie, zaehlt nur dieser
-- Teil. Titel ohne Doppelpunkt und Titel mit der Partie VOR dem
-- Doppelpunkt ("A vs B: Draw at halftime?") bleiben unveraendert.
-- WER turnierRein AENDERT, ZIEHT DIESE FUNKTION MIT — drei Fassungen,
-- ein Verhalten.

create or replace function public.orion_partie_von_titel(t text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(t, '') like '%:%'
     and regexp_replace(t, '^.*:', '') ~* '\svs?\.?\s'
    then btrim(regexp_replace(t, '^.*:', ''))
    else t
  end;
$$;

-- Probe (muss 4 Zeilen 'ok' geben):
--   select case when orion_partie_von_titel('Cincinnati Open: Iga Swiatek vs Diane Parry') = 'Iga Swiatek vs Diane Parry' then 'ok' end
--   union all select case when orion_kennung(orion_partie_von_titel('ITF W35 Krakow Women: Amelia Paszun vs Radka Zelnickova')) = '' then 'ok' end
--   union all select case when orion_partie_von_titel('Italy vs Bahrain') = 'Italy vs Bahrain' then 'ok' end
--   union all select case when orion_partie_von_titel('Charlotte FC vs. CF Pachuca: Draw at halftime?') = 'Charlotte FC vs. CF Pachuca: Draw at halftime?' then 'ok' end;

-- Kennungssperre (eigener Takt): Titel vor dem Kennungsvergleich reinigen.
create or replace function public.orion_kennung_pruefen()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare geaendert integer;
begin
  update orion_funde f
     set pruefung = 'falsch',
         pruefung_grund = 'Kennung ungleich: "' || coalesce(nullif(orion_kennung(orion_partie_von_titel(f.titel)), ''), 'ohne') ||
                          '" gegen "' || coalesce(nullif(orion_kennung(f.bf_partie), ''), 'ohne') ||
                          '" — verschiedene Mannschaftsklasse (Alter, Frauen oder Reserve), also NICHT dasselbe Spiel',
         geprueft_am = now(),
         geprueft_von = 'kennungssperre'
   where f.bf_partie is not null
     and orion_kennung(orion_partie_von_titel(f.titel)) is distinct from orion_kennung(f.bf_partie)
     and coalesce(f.pruefung, '') <> 'falsch';
  get diagnostics geaendert = row_count;
  return geaendert;
end;
$function$;

-- ===========================================================================
-- WACHE STUFE 2
-- ===========================================================================
-- ACHTUNG, 25.8.2026: dieser Abschnitt war bis heute ein SPRENGSATZ.
--
-- Die Repo-Fassung stand auf dem Stand vom 19.8. und war an DREI Stellen
-- gegenlaeufig zur laufenden Datenbank. Wer sie unveraendert ausgerollt
-- haette, haette jede gesunde Zeile als "falsch" gestempelt:
--
--   1. BUCHSUMME war genau andersherum. Die Repo-Datei nannte
--      buch_summe >= 1,00 einen "Widerspruch". Am 23.8. wurde das in der
--      Datenbank UMGEDREHT: buch_summe ist die Marge EINES Buches und MUSS
--      ueber 1 liegen (an vier Faellen nachgerechnet, 0,6410 + 0,3707 =
--      1,0118). Unplausibel ist jetzt < 1,00 oder > 1,30.
--   2. EINHEIT: die Repo-Datei zaehlte gegen 0.05 und multiplizierte im
--      Text mit 100. beste_rendite steht aber in PROZENT. Dieselbe
--      Einheiten-Verwechslung wie in orion_verlauf_urteil, dort am 24.8.
--      behoben (Stempel "260,0 %" fuer 2,60 %).
--   3. SECURITY DEFINER und search_path stehen NICHT an der laufenden
--      Funktion (prosecdef = false, proconfig = null, am 25.8. geprueft).
--
-- BEWEIS, dass die laufende Fassung die hier stehende ist: der Sonego-Fund
-- vom 24.8. hatte buch_summe 1,008524 bei positiver Rendite. Nach der alten
-- Repo-Fassung haette sein Stempel "Widerspruch: Buchsumme" lauten muessen -
-- er lautete "Anpfiff ist vorbei". Der Buchsummen-Zweig steht im CASE VOR
-- allen anderen, also kann die alte Fassung nicht live sein.
--
-- Ab jetzt gilt: diese Datei ist eine ABSCHRIFT der Datenbank, keine
-- Absichtserklaerung. Vor jeder Aenderung mit pg_get_functiondef abgleichen.
-- ===========================================================================
create or replace function public.orion_wache_stufe2()
returns table(geprueft integer, gesperrt integer, gruende jsonb)
language plpgsql
as $function$
declare
  n_geprueft integer := 0;
  n_gesperrt integer := 0;
  g jsonb;
begin
  perform orion_schreibsperre();

  select count(*) into n_geprueft from orion_funde
   where status = 'live' or coalesce(beste_rendite, 0) >= 6.5;

  create temporary table if not exists _w2 (schluessel text, grund text, urteil text) on commit drop;
  delete from _w2;

  /* ---- LEBENDE ZEILEN: alle Zahlen aus demselben Moment ---- */
  insert into _w2
  select f.schluessel,
         case
           /* BUCHSUMME, am 23.8. UMGEDREHT. Bis dahin galt ">= 1,00 =
            * Widerspruch". Das war falsch herum und hat alles kassiert,
            * was ueber der Meldeschwelle lag: 24 Zeilen im Chancenband,
            * 96 im Knappband, keine einzige kam durch.
            * buch_summe ist die Marge EINES Buches. An vier Faellen
            * nachgerechnet: Preis plus Restseite ergibt exakt den Wert
            * (0,6410 + 0,3707 = 1,0118). Eine Marge MUSS ueber 1 liegen.
            * Die Arbitrage steckt in beiden Buechern zusammen, dort lagen
            * dieselben Faelle bei 0,9210 bis 0,9846, und die Rendite passt
            * lueckenlos dazu. js/anzeige.js liest den Wert seit jeher
            * richtig herum. Die Wache folgt jetzt derselben Deutung.
            * Obergrenze 1,30 faengt kaputte Werte wie 2,0280 (West Ham
            * gegen Charlton) - eine Marge von 103 % hat kein Buch. */
           when f.buch_summe is not null
            and (f.buch_summe < 1.0 or f.buch_summe > 1.3)
            and coalesce(f.rendite, 0) > 0
             then 'Buchsumme ' || round(f.buch_summe, 4) || ' ist unplausibel - ' ||
                  case when f.buch_summe < 1.0
                       then 'unter 1,00, im Gegenbuch klebt vermutlich ein Kurs'
                       else 'ueber 1,30, das ist keine Marge eines gesunden Buches' end
           when f.beginnt_am is null
             then 'Anpfiff nicht belegt - ohne Datum ist nicht beweisbar, dass beide Buecher dasselbe Spiel meinen'
           when f.endet_am is not null
            and abs(extract(epoch from (f.endet_am - f.beginnt_am))) > 180 * 60
             then 'Anpfiff ' || round(abs(extract(epoch from (f.endet_am - f.beginnt_am)) / 60)) ||
                  ' min auseinander - nicht dasselbe Spiel'
           when f.bf_partie is not null
            and orion_kennung(orion_partie_von_titel(f.titel)) is distinct from orion_kennung(f.bf_partie)
             then 'Mannschaftsklasse ungleich: "' || coalesce(nullif(orion_kennung(orion_partie_von_titel(f.titel)), ''), 'ohne') ||
                  '" gegen "' || coalesce(nullif(orion_kennung(f.bf_partie), ''), 'ohne') || '"'
           when f.beginnt_am <= now() + interval '5 minutes'
             then 'Anpfiff ist ' || case when f.beginnt_am <= now() then 'vorbei' else 'in unter 5 Minuten' end ||
                  ' - zu spaet, um beide Seiten sicher zu setzen'
           when f.pm_link is null or f.bf_link is null
             then 'Ein Marktlink fehlt - die Gegenseite ist nicht erreichbar'
         end,
         'falsch'
    from orion_funde f
   where f.status = 'live';

  /* ---- VERLAUF: mit Beleg beweisen, ohne Beleg nur einordnen ----
   * beste_rendite steht in PROZENT - kein "* 100" im Text (Fehler bis
   * 23.8.: "Spitzenwert 260,0 %" fuer 2,60 %). Deckel 6,5 = vor Gebuehren. */
  insert into _w2
  select f.schluessel,
         case orion_verlauf_urteil(f.beste_rendite, f.beste_buch_summe)
           when 'falsch' then
             'Widerlegt: im Moment des Hoechststands lag die Buchsumme bei ' ||
             round(f.beste_buch_summe, 4) || ' - ausserhalb des plausiblen Bandes 1,00 bis 1,30, ' ||
             'also gab es den angezeigten Vorteil von ' ||
             round(f.beste_rendite::numeric, 2) || ' % nie'
           else
             'Spitzenwert ' || round(f.beste_rendite::numeric, 2) ||
             ' % liegt ueber dem Plausibilitaetsdeckel von 6,5 % (vor Gebuehren; ' ||
             'gemessen 13.8.: jede Zeile ueber 5 % netto war ein Kleber oder eine Fehlpaarung). ' ||
             'Ohne gespeicherte Kurse von damals nicht nachrechenbar'
         end,
         orion_verlauf_urteil(f.beste_rendite, f.beste_buch_summe)
    from orion_funde f
   where f.status <> 'live'
     and orion_verlauf_urteil(f.beste_rendite, f.beste_buch_summe) is not null
     and coalesce(f.pruefung, '') in ('', 'zweifelhaft');

  delete from _w2 where grund is null or urteil is null;

  update orion_funde f
     set pruefung = w.urteil, pruefung_grund = w.grund,
         geprueft_am = now(), geprueft_von = 'wache2'
    from (select schluessel, grund, urteil from _w2 order by schluessel) w
   where f.schluessel = w.schluessel
     and (coalesce(f.pruefung, '') <> w.urteil or coalesce(f.pruefung_grund, '') <> w.grund);

  update orion_funde f
     set pruefung = null, pruefung_grund = null, geprueft_am = now(), geprueft_von = 'wache2'
   where f.status = 'live'
     and f.geprueft_von = 'wache2'
     and coalesce(f.pruefung, '') <> ''
     and not exists (select 1 from _w2 w where w.schluessel = f.schluessel);

  select count(*)::integer into n_gesperrt from _w2;
  select coalesce(jsonb_object_agg(art, anz), '{}'::jsonb) into g
    from (select urteil as art, count(*) as anz from _w2 group by 1) z;

  return query select n_geprueft, n_gesperrt, g;
end;
$function$;
