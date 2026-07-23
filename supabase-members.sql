-- gogogo.social Mitglieder (Website Auth)
-- Im Supabase SQL Editor ausführen (gleiche Instanz wie die App).
-- Authentication → Providers: Email aktivieren.
-- "Confirm email" einschalten für die Bestätigungsmail.

create table if not exists member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  contact_pref text,
  privacy_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table member_profiles enable row level security;

drop policy if exists "members_select_own" on member_profiles;
drop policy if exists "members_insert_own" on member_profiles;
drop policy if exists "members_update_own" on member_profiles;

create policy "members_select_own"
  on member_profiles for select
  using (auth.uid() = id);

create policy "members_insert_own"
  on member_profiles for insert
  with check (auth.uid() = id);

create policy "members_update_own"
  on member_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profil automatisch aus Auth-Metadaten anlegen (auch vor Email-Bestätigung)
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_profiles (
    id, first_name, last_name, email, phone, contact_pref, privacy_accepted_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.raw_user_meta_data->>'contact_pref',
    now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    contact_pref = excluded.contact_pref;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member on auth.users;
create trigger on_auth_user_created_member
  after insert on auth.users
  for each row execute function public.handle_new_member();
