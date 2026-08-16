-- Trainer-Rolle, gewählter Trainer, und Coach-Account (Joscha)
-- Einmal im Supabase SQL Editor ausführen.
-- Ohne den Coach-Account (phone = 'coach') erscheint „Trainer gerade nicht erreichbar.“

alter table go_accounts
  add column if not exists is_trainer boolean not null default false;

alter table go_accounts
  add column if not exists trainer_id uuid references go_accounts(id) on delete set null;

create index if not exists go_accounts_is_trainer_idx
  on go_accounts (is_trainer)
  where is_trainer = true;

create index if not exists go_accounts_trainer_id_idx
  on go_accounts (trainer_id);

-- Coach-Account anlegen, falls noch keiner existiert
insert into go_accounts (name, phone, photo_url)
select
  'Joscha',
  'coach',
  'https://www.gogogo.social/assets/go/gogogo-dithering/coach-joscha.jpg?v=dither'
where not exists (
  select 1 from go_accounts
  where lower(coalesce(phone, '')) = 'coach'
     or lower(coalesce(name, '')) = 'joscha'
);

-- Joscha-/Coach-Account als Trainer markieren
update go_accounts
set is_trainer = true
where (
  lower(coalesce(phone, '')) = 'coach'
  or lower(coalesce(name, '')) = 'joscha'
)
and is_trainer = false;
