-- Weitere Fotos an einem Event (bis 5 inkl. photo_url), über ••• am erledigten Event
alter table events add column if not exists photos text[] not null default '{}';
