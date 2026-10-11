create or replace function expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  update subscriptions
  set status = 'expired'
  where status = 'active'
    and ends_at is not null
    and ends_at < now();
  get diagnostics updated = row_count;
  return updated;
end;
$$;
