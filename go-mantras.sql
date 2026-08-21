-- Mantras (Defaults + weitere per Admin) + persönliches Mantra pro Account
-- Im Supabase SQL Editor ausführen.

alter table go_accounts
  add column if not exists mantra text;

create table if not exists go_mantras (
  slot smallint primary key,
  body text not null,
  attribution text,
  updated_at timestamptz not null default now()
);

alter table go_mantras drop constraint if exists go_mantras_slot_check;
alter table go_mantras
  add constraint go_mantras_slot_check check (slot >= 1 and slot <= 200);

alter table go_mantras enable row level security;

drop policy if exists "go_mantras_select_anon" on go_mantras;
create policy "go_mantras_select_anon"
  on go_mantras for select
  to anon, authenticated
  using (true);

drop policy if exists "go_mantras_insert_anon" on go_mantras;
create policy "go_mantras_insert_anon"
  on go_mantras for insert
  to anon, authenticated
  with check (true);

drop policy if exists "go_mantras_update_anon" on go_mantras;
create policy "go_mantras_update_anon"
  on go_mantras for update
  to anon, authenticated
  using (true)
  with check (true);

insert into go_mantras (slot, body, attribution) values
  (1,  'Bewegung ist die beste Medizin.', 'Hippokrates'),
  (2,  'Der erste Reichtum ist die Gesundheit.', 'Ralph Waldo Emerson'),
  (3,  'Ein Morgenspaziergang segnet den ganzen Tag.', 'Henry David Thoreau'),
  (4,  'Gesundheit ist nicht alles, aber ohne Gesundheit ist alles nichts.', 'Arthur Schopenhauer'),
  (5,  'Kümmere Dich um Deinen Körper. Er ist der einzige Ort, an dem Du lebst.', 'Jim Rohn'),
  (6,  'Der Weg entsteht beim Gehen.', 'Antonio Machado'),
  (7,  'Ein gesunder Geist wohnt in einem gesunden Körper.', 'Juvenal'),
  (8,  'Langsam und stetig gewinnt das Rennen.', 'Äsop'),
  (9,  'Disziplin ist die Brücke zwischen Zielen und Erfolg.', 'Jim Rohn'),
  (10, 'Die beste Zeit anzufangen war gestern. Die zweitbeste ist jetzt.', 'Chinesisches Sprichwort'),
  (11, 'Stärke wächst aus dem, was Du überwindest.', 'Nelson Mandela'),
  (12, 'Es geht nicht um Perfektion, sondern um Beständigkeit.', 'Bruce Lee'),
  (13, 'Ruhe Dich aus, wenn Du müde bist, nicht wenn Du fertig bist.', 'Michael Jordan'),
  (14, 'Wer sich bewegt, bleibt lebendig.', 'Konfuzius'),
  (15, 'Kleine tägliche Schritte schlagen große Absichten.', 'Lao Tzu'),
  (16, 'Dein Körper erreicht, was Dein Geist glaubt.', 'Napoleon Hill'),
  (17, 'Fitness ist die Grundlage klaren Denkens.', 'John F. Kennedy'),
  (18, 'Geh, solange Du gehen kannst.', 'Hippokrates'),
  (19, 'Heute zählt mehr als gestern vornehmen.', 'Seneca'),
  (20, 'Atme. Bewege Dich. Schlafe. Wiederhole.', 'Marcus Aurelius')
on conflict (slot) do nothing;
