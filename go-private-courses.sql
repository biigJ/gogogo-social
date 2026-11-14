-- Private Kurse: courses.private_for + RLS
-- Voraussetzung: go-courses-support.sql bereits ausgeführt.
-- Idempotent. Im SQL Editor von agpysewcsakdpmpftndp ausführen.

alter table courses
  add column if not exists private_for uuid references go_accounts(id) on delete set null;

create index if not exists courses_private_for_idx
  on courses (private_for)
  where private_for is not null;

comment on column courses.private_for is
  'Wenn gesetzt: Kurs nur für diese Person (+ Coach) sichtbar, nicht im öffentlichen Katalog.';

-- Katalog-Select: öffentlich nur ohne private_for; privat nur für Adressat/Coach/Boot
drop policy if exists "courses_select_active" on courses;
create policy "courses_select_active"
  on courses for select to anon, authenticated
  using (
    (
      is_active = true
      and private_for is null
    )
    or private_for = go_current_account_id()
    or coach_id = go_current_account_id()
    or go_current_account_id() is null
  );

-- Templates sichtbar, wenn der Kurs sichtbar wäre
drop policy if exists "course_templates_select" on course_templates;
create policy "course_templates_select"
  on course_templates for select to anon, authenticated
  using (
    exists (
      select 1 from courses c
      where c.id = course_id
        and (
          (c.is_active = true and c.private_for is null)
          or c.private_for = go_current_account_id()
          or c.coach_id = go_current_account_id()
          or go_current_account_id() is null
        )
    )
  );
