-- Hard-Delete für support_orders + activity_log (RLS)
-- Im Supabase SQL Editor der gogogo-Instanz ausführen:
--   https://agpysewcsakdpmpftndp.supabase.co
-- Danach können eigene Orders/Logs per DELETE (Header x-go-account-id) gelöscht werden.

drop policy if exists "support_orders_delete_own_or_boot" on support_orders;
create policy "support_orders_delete_own_or_boot"
  on support_orders for delete to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

drop policy if exists "activity_log_delete_own_or_boot" on activity_log;
create policy "activity_log_delete_own_or_boot"
  on activity_log for delete to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );

drop policy if exists "activity_log_update_own_or_boot" on activity_log;
create policy "activity_log_update_own_or_boot"
  on activity_log for update to anon, authenticated
  using (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  )
  with check (
    user_id = go_current_account_id()
    or go_is_coach_of(user_id)
    or go_current_account_id() is null
  );
