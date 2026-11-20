-- go-comment-replies.sql — Antworten auf Kommentare (Aktuell) + Herz-Hinweis oben rechts
-- Idempotent. Im Supabase SQL-Editor (gogogo, agpyse…) ausführen. Voraussetzung: go-event-comments.sql.
--
-- reply_to          Kommentar, auf den geantwortet wird
-- reply_to_account  Autor dieses Kommentars: bekommt das Herz mit rotem Punkt
-- Lesen/Schreiben laufen über die bestehenden event_comments-Policies.

alter table event_comments add column if not exists reply_to uuid references event_comments(id) on delete set null;
alter table event_comments add column if not exists reply_to_account uuid references go_accounts(id) on delete set null;

create index if not exists event_comments_reply_to_account_idx
  on event_comments (reply_to_account, created_at desc)
  where reply_to_account is not null;
