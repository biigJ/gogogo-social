-- go-ziele-neu.sql — Profilziele = Ziele der Vorabfrage + „Hybrid Athlet“
-- Einmalig im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Mehrfaches Ausführen schadet nicht.
-- Alte Ziele (HYROX, Marathon, just for Fun …) werden geleert, „Hybrid Athlet“ bleibt.
-- Sicherung in go_cleanup_backup (tbl 'ziele-neu').

create table if not exists go_cleanup_backup (
  id bigserial primary key,
  account_id uuid not null,
  tbl text not null,
  col text,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

do $$
declare n int;
begin
  insert into go_cleanup_backup (account_id, tbl, col, row_data)
  select a.id, 'ziele-neu', 'training_goal', jsonb_build_object('training_goal', a.training_goal)
  from go_accounts a
  where a.training_goal is not null
    and a.training_goal not in ('Gesund laufen','Rücken stärken','Gesund bleiben','Abnehmen','Muskeln erhalten','Gelenke schonen','Hybrid Athlet')
    and not exists (select 1 from go_cleanup_backup b where b.account_id = a.id and b.tbl = 'ziele-neu');

  update go_accounts set training_goal = null
  where training_goal is not null
    and training_goal not in ('Gesund laufen','Rücken stärken','Gesund bleiben','Abnehmen','Muskeln erhalten','Gelenke schonen','Hybrid Athlet');
  get diagnostics n = row_count;
  raise notice 'Ziele geleert: %', n;
end $$;

-- Kontrolle
select training_goal, count(*) from go_accounts group by training_goal order by 2 desc;
