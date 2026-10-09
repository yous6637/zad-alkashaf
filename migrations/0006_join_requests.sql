create type join_request_status as enum ('pending', 'accepted', 'rejected');

create table join_requests (
  id uuid primary key default gen_random_uuid(),
  troop_id uuid not null references troops (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  status join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by text references profiles (id) on delete set null,
  handled_at timestamptz
);

create unique index join_requests_one_pending
  on join_requests (user_id)
  where status = 'pending';

create index join_requests_troop_idx on join_requests (troop_id, status, created_at);

create trigger join_requests_set_updated_at
  before update on join_requests
  for each row execute function set_updated_at();
