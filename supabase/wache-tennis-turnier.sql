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

-- Wache Stufe 2: dieselbe Reinigung an derselben Huerde. Alles andere
-- ist unveraendert gegenueber dem Stand vom 19.8. (8m/8p).
create or replace function public.orion_wache_stufe2()
returns table(geprueft integer, gesperrt integer, gruende jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n_geprueft integer := 0;
  n_gesperrt integer := 0;
  g jsonb;
begin
  perform orion_schreibsperre();

  select count(*) into n_geprueft from orion_funde
   where status = 'live' or coalesce(beste_rendite, 0) >= 0.05;

  create temporary table if not exists _w2 (schluessel text, grund text, urteil text) on commit drop;
  delete from _w2;

  /* ---- LEBENDE ZEILEN: alle Zahlen aus demselben Moment ---- */
  insert into _w2
  select f.schluessel,
         case
           when f.buch_summe is not null and f.buch_summe >= 1.0 and coalesce(f.rendite, 0) > 0
             then 'Widerspruch: Buchsumme ' || round(f.buch_summe, 4) ||
                  ' liegt bei/ueber 1,00 - dann kann es keinen Vorteil geben. Angezeigt sind aber ' ||
                  round((coalesce(f.rendite, 0) * 100)::numeric, 2) || ' %'
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

  /* ---- VERLAUF: mit Beleg beweisen, ohne Beleg nur einordnen ---- */
  insert into _w2
  select f.schluessel,
         case orion_verlauf_urteil(f.beste_rendite, f.beste_buch_summe)
           when 'falsch' then
             'Widerlegt: im Moment des Hoechststands lag die Buchsumme bei ' ||
             round(f.beste_buch_summe, 4) || ' - ueber 1,00, also gab es den angezeigten Vorteil von ' ||
             round((f.beste_rendite * 100)::numeric, 1) || ' % nie'
           else
             'Spitzenwert ' || round((f.beste_rendite * 100)::numeric, 1) ||
             ' % liegt weit ueber dem, was je bestaetigt wurde (13.8.: richtige 2,07 bis 3,27 %, ' ||
             'falsche ueber 4,48 %). Ohne gespeicherte Kurse von damals nicht nachrechenbar'
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
