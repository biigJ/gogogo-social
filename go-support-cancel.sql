-- Erweitere support_orders Status um cancelled + payment_status bleibt
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'support_orders'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if cname is not null then
    execute format('alter table support_orders drop constraint %I', cname);
  end if;

  alter table support_orders
    add constraint support_orders_status_check
    check (status in ('angefragt', 'freigeschaltet', 'aktiv', 'cancelled'));
end $$;
