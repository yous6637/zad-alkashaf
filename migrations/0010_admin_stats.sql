alter table reports
  add column if not exists admin_note text not null default '';

create table if not exists platform_counters (
  key text primary key,
  value bigint not null default 0
);

insert into platform_counters (key, value)
values ('search', 0), ('contact', 0)
on conflict (key) do nothing;
