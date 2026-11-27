-- go-circle-events-friends.sql — Circle-Events (Zirkel, visibility 'circle') sehen auch Freunde des Erstellers
-- (wie 'team': go_shares_group_with). Damit pulsiert der Freund in der Profilzeile, das Event steht in seiner Story
-- und im Feed, Zusage per Winken (go_join_circle_event). Idempotent.
drop policy if exists "events_select_circle_friends" on events;
create policy "events_select_circle_friends" on events for select to authenticated
  using (visibility = 'circle' and go_shares_group_with(user_id));
