-- go-cleanup-accounts.sql — doppelte Konten zusammenführen, Testkonten löschen (Stand 16.11.2026)
-- Im Supabase SQL-Editor (gogogo, agpyse…) als Ganzes ausführen. Läuft in einer Transaktion.
--
-- Sicherheitsnetz: Jede betroffene Zeile wird vorher als JSON in go_cleanup_backup gesichert
-- (Konto + alle verknüpften Zeilen). Wiederherstellen ginge von dort aus.
--
-- Zusammenführen (Daten wandern zum behaltenen Konto, Duplikat wird gelöscht):
--   Lippold  ea6e1fde (zuletzt aktiv, eigene Übungen)  ← c79e99c9 (Foto, Posts), 135b8c52 (leer)
--   Stefan   5ca0ca98 (Foto, Posts)                   ← 87209d74
--   Ben/biigJ 5f86ab1e                                 ← biigJ 96170549, BiigJ 06183d5c, biigJ 183cf389
--            (Kurse/Zuordnungen, die diese alten Konten als Coach führten, gehen an Joscha 2d3ab029)
-- Löschen: Test, Test 2, Test 3, Tesssst, Kfkfkf, Zujhdf, Witzbold, Pimmel (alles Testkonten)
--
-- Wer ein zusammengeführtes Konto benutzt hat, meldet sich danach mit dem Code des behaltenen Kontos an.

begin;

create table if not exists go_cleanup_backup (
  id bigserial primary key,
  account_id uuid not null,
  tbl text not null,
  col text,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);
alter table go_cleanup_backup enable row level security;
-- keine Policy: nur im SQL-Editor lesbar

-- Alle einspaltigen Fremdschlüssel auf go_accounts(id)
create or replace function pg_temp.go_fk_cols()
returns table (tbl text, col text, deltype "char")
language sql as $$
  select c.conrelid::regclass::text, a.attname::text, c.confdeltype
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.contype = 'f'
    and c.confrelid = 'public.go_accounts'::regclass
    and array_length(c.conkey, 1) = 1;
$$;

create or replace function pg_temp.go_backup_refs(p_id uuid)
returns void language plpgsql as $$
declare r record;
begin
  for r in select * from pg_temp.go_fk_cols() loop
    execute format(
      'insert into go_cleanup_backup (account_id, tbl, col, row_data) select %L, %L, %L, to_jsonb(t) from %s t where %I = %L',
      p_id, r.tbl, r.col, r.tbl, r.col, p_id);
  end loop;
  insert into go_cleanup_backup (account_id, tbl, col, row_data)
  select p_id, 'go_accounts', null, to_jsonb(a) from go_accounts a where a.id = p_id;
end $$;

-- Duplikat in behaltenes Konto überführen; Zeilen, die dort schon existieren (unique), fallen weg
create or replace function pg_temp.go_merge(p_dup uuid, p_keep uuid)
returns void language plpgsql as $$
declare r record; t record;
begin
  if not exists (select 1 from go_accounts where id = p_dup) then return; end if;
  perform pg_temp.go_backup_refs(p_dup);
  for r in select * from pg_temp.go_fk_cols() loop
    begin
      execute format('update %s set %I = %L where %I = %L', r.tbl, r.col, p_keep, r.col, p_dup);
    exception when unique_violation or check_violation then
      for t in execute format('select ctid as c from %s where %I = %L', r.tbl, r.col, p_dup) loop
        begin
          execute format('update %s set %I = %L where ctid = %L', r.tbl, r.col, p_keep, t.c);
        exception when unique_violation or check_violation then
          execute format('delete from %s where ctid = %L', r.tbl, t.c);
        end;
      end loop;
    end;
  end loop;
  -- Profilfelder übernehmen, wo das behaltene Konto leer ist
  update go_accounts k set
    photo_url = coalesce(k.photo_url, d.photo_url),
    nickname = coalesce(k.nickname, d.nickname),
    trainer_id = coalesce(k.trainer_id, d.trainer_id)
  from go_accounts d
  where k.id = p_keep and d.id = p_dup;
  delete from go_accounts where id = p_dup;
end $$;

-- Testkonto löschen: Zeilen mit restrict/no action vorher entfernen, cascade/set null regelt die DB
create or replace function pg_temp.go_drop(p_id uuid)
returns void language plpgsql as $$
declare r record;
begin
  if not exists (select 1 from go_accounts where id = p_id) then return; end if;
  perform pg_temp.go_backup_refs(p_id);
  for r in select * from pg_temp.go_fk_cols() where deltype in ('a', 'r') loop
    execute format('delete from %s where %I = %L', r.tbl, r.col, p_id);
  end loop;
  delete from go_accounts where id = p_id;
end $$;

-- Alte biigJ-Konten: Coach-Bezüge an Joscha, bevor der Rest zu Ben wandert
update courses set coach_id = '2d3ab029-0a5f-4388-8da7-52501a87dc8c'
where coach_id in ('96170549-7420-4738-843c-aa0f702b321d', '06183d5c-3bfa-4984-9784-4f8f8d8d84be', '183cf389-50ce-4993-9b5a-909a174771cc');
update enrollments set assigned_by = '2d3ab029-0a5f-4388-8da7-52501a87dc8c'
where assigned_by in ('96170549-7420-4738-843c-aa0f702b321d', '06183d5c-3bfa-4984-9784-4f8f8d8d84be', '183cf389-50ce-4993-9b5a-909a174771cc');

select pg_temp.go_merge('c79e99c9-ba70-4711-98d6-2fe2985e5055', 'ea6e1fde-141c-4120-a6c7-ecd6fe219aa7');
select pg_temp.go_merge('135b8c52-9ec3-475f-ad3d-971b9de7ffb3', 'ea6e1fde-141c-4120-a6c7-ecd6fe219aa7');
select pg_temp.go_merge('87209d74-ccd3-4704-bc7d-8b3281c19667', '5ca0ca98-df7b-4a38-954b-38be2b6ef44d');
select pg_temp.go_merge('96170549-7420-4738-843c-aa0f702b321d', '5f86ab1e-2043-4944-8196-1bec0c6b0130');
select pg_temp.go_merge('06183d5c-3bfa-4984-9784-4f8f8d8d84be', '5f86ab1e-2043-4944-8196-1bec0c6b0130');
select pg_temp.go_merge('183cf389-50ce-4993-9b5a-909a174771cc', '5f86ab1e-2043-4944-8196-1bec0c6b0130');

select pg_temp.go_drop(x::uuid) from unnest(array[
  '21aec5e7-ae33-4373-a2ac-636836c3d181', -- Test
  '830c4340-5919-4d3d-9b58-8b647420b864', -- Test 2
  '00ce85ee-76ac-4ba5-8ebe-589e465aa3de', -- Test 3
  '6599b0d0-4cb1-476f-a0b6-8bd61d865a65', -- Test
  '1d60f935-3ac1-45fb-b8a3-9a07a9dcf519', -- Tesssst
  'c82237e6-fae4-4291-af7b-b84daeaa49ae', -- Kfkfkf
  '168ff0cb-6f0a-4b06-9487-b1cd61e63f25', -- Zujhdf
  '337fe789-7b66-42c6-b7e1-a8460f32577d', -- Test
  '261ab9f7-4052-4839-bc23-41081242febb', -- Test
  '775f8d23-b44b-492d-82d3-34bbd5a8b98d', -- Witzbold
  'bd6fc5b6-2058-45ef-a4e7-406841686ada'  -- Pimmel
]) as x;

-- Lippold ist PT-Kunde von Joscha → Coachee (Coach-Portal, Wochenplan zuordnen)
update go_accounts set trainer_id = '2d3ab029-0a5f-4388-8da7-52501a87dc8c'
where id = 'ea6e1fde-141c-4120-a6c7-ecd6fe219aa7' and trainer_id is null;

commit;

-- Kontrolle: übrige Konten
select name, nickname, created_at::date from go_accounts order by created_at;
