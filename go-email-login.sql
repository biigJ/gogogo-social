-- go-email-login.sql — Neu anmelden ohne Einladungscode: Vorname + E-Mail, Code per E-Mail (Supabase Auth OTP)
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen.
--
-- Ablauf (/login/): Vorname + E-Mail → Supabase Auth schickt Code + Link → Code eingeben oder Link tippen
-- → go_email_login() mit dem Auth-Token: findet das Konto zur bestätigten E-Mail oder legt es an.
-- Die E-Mail kommt aus dem geprüften Token (auth.jwt()), nicht vom Formular.
-- Das Konto bekommt zusätzlich einen 4-stelligen Code: Anmelden mit Vorname + Code geht weiterhin.

alter table go_accounts add column if not exists email text;
alter table go_accounts add column if not exists privacy_ack_at timestamptz;
create unique index if not exists go_accounts_email_uidx on go_accounts (lower(email)) where email is not null;

create or replace function go_email_login(p_name text default null)
returns setof go_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  em text := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  acc go_accounts%rowtype;
  first text := nullif(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  code text;
  i int := 0;
begin
  if em is null then
    raise exception 'E-Mail nicht bestätigt';
  end if;
  select * into acc from go_accounts where lower(email) = em order by created_at asc limit 1;
  if not found then
    if first is null then
      first := coalesce(nullif(auth.jwt() -> 'user_metadata' ->> 'first_name', ''), split_part(em, '@', 1));
    end if;
    -- 4-stelliger Code, der mit diesem Vornamen noch frei ist
    loop
      code := (1000 + floor(random() * 9000))::int::text;
      exit when not exists (
        select 1 from go_accounts a
        where a.invite_code = code and lower(split_part(a.name, ' ', 1)) = lower(split_part(first, ' ', 1))
      ) or i > 20;
      i := i + 1;
    end loop;
    insert into go_accounts (name, phone, email, invite_code, privacy_ack_at)
    values (first, '', em, code, now())
    returning * into acc;
  end if;
  return next acc;
end $$;

revoke all on function go_email_login(text) from public, anon;
grant execute on function go_email_login(text) to authenticated;
