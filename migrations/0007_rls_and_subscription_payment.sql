-- Lock auth and join-request tables against the Data API.
-- The app connects as the table owner, which bypasses RLS.
-- No policies: anon and authenticated roles get no rows.

alter table "user" enable row level security;
alter table "session" enable row level security;
alter table "account" enable row level security;
alter table "verification" enable row level security;
alter table join_requests enable row level security;
alter table _migrations enable row level security;

alter type subscription_status add value if not exists 'rejected';

alter table subscriptions
  add column if not exists paid_at timestamptz,
  add column if not exists admin_note text not null default '';
