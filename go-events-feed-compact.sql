-- Vergangenes Event in Aktuell verkleinern (Besitzer über •••, gilt für alle Betrachter)
alter table events add column if not exists feed_compact boolean not null default false;
