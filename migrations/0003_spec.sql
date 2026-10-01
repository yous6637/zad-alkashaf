-- Phase 1: replace the prototype tables with the V1 schema.
-- Auth tables ("user", session, account, verification) are not touched.
--
-- Deviations required by this environment (see docs/SCHEMA.md):
-- * profiles.id is text, equal to "user".id. Better Auth ids are text
--   (the preview user id is the string 'dev-user'), not uuid.
-- * Helper functions are named app_current_role() and app_current_troop_id().
--   current_role() is a reserved Postgres function and cannot be replaced.
-- * There is no Supabase Storage. payment_proof_path and product_images.storage_path
--   are plain text. Buckets are not created here.
-- * The application connects as a superuser, which bypasses RLS. Policies are
--   still defined. Limits are enforced by triggers, which superusers do not skip.

drop table if exists notifications cascade;
drop table if exists contact_requests cascade;
drop table if exists product_images cascade;
drop table if exists reports cascade;
drop table if exists products cascade;
drop table if exists subscriptions cascade;
drop table if exists memberships cascade;
drop table if exists troops cascade;
drop table if exists profiles cascade;
drop table if exists plans cascade;
drop table if exists categories cascade;
drop table if exists wilayas cascade;

drop type if exists report_status cascade;
drop type if exists report_reason cascade;
drop type if exists product_status cascade;
drop type if exists item_condition cascade;
drop type if exists listing_type cascade;
drop type if exists subscription_status cascade;
drop type if exists troop_status cascade;
drop type if exists user_role cascade;

create type user_role as enum ('admin', 'troop_manager', 'member');
create type troop_status as enum ('pending', 'active', 'suspended');
create type subscription_status as enum ('pending', 'active', 'expired', 'suspended');
create type listing_type as enum ('sale', 'rent', 'exchange', 'wanted');
create type item_condition as enum ('new', 'used_good', 'needs_repair');
create type product_status as enum ('active', 'hidden', 'unavailable');
create type report_reason as enum ('wrong_info', 'inappropriate', 'duplicate', 'other');
create type report_status as enum ('open', 'resolved', 'dismissed');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table wilayas (
  id integer primary key,
  name_ar text not null,
  name_fr text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_dzd integer not null default 2000 check (price_dzd >= 0),
  duration_days integer not null default 365 check (duration_days > 0),
  max_members integer not null check (max_members > 0),
  max_products integer not null check (max_products > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table troops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wilaya_id integer not null references wilayas (id),
  municipality text not null,
  description text not null default '',
  contact_phone text,
  contact_email text,
  status troop_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id text primary key references "user" (id) on delete cascade,
  troop_id uuid references troops (id) on delete set null,
  full_name text not null,
  phone text,
  role user_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_one_manager
  on profiles (troop_id)
  where role = 'troop_manager' and troop_id is not null;

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  troop_id uuid not null references troops (id) on delete cascade,
  plan_id uuid not null references plans (id),
  price_dzd integer not null check (price_dzd >= 0),
  max_members integer not null check (max_members > 0),
  max_products integer not null check (max_products > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status subscription_status not null default 'pending',
  payment_proof_path text,
  payment_note text not null default '',
  approved_by text references profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create unique index subscriptions_one_pending
  on subscriptions (troop_id) where status = 'pending';

create unique index subscriptions_one_active
  on subscriptions (troop_id) where status = 'active';

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories (id),
  slug text not null unique,
  name_ar text not null,
  name_fr text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  troop_id uuid not null references troops (id) on delete cascade,
  created_by text not null references profiles (id),
  category_id uuid not null references categories (id),
  title text not null,
  description text not null,
  listing_type listing_type not null,
  condition item_condition not null,
  price_dzd integer,
  rent_price_dzd integer,
  wilaya_id integer not null references wilayas (id),
  status product_status not null default 'active',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_nonneg check (
    (price_dzd is null or price_dzd >= 0)
    and (rent_price_dzd is null or rent_price_dzd >= 0)
  ),
  constraint products_price_rules check (
    (listing_type = 'sale' and price_dzd is not null and rent_price_dzd is null)
    or (listing_type = 'rent' and rent_price_dzd is not null and price_dzd is null)
    or (listing_type in ('exchange', 'wanted') and price_dzd is null and rent_price_dzd is null)
  )
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  reporter_id text not null references profiles (id) on delete cascade,
  reason report_reason not null,
  details text not null default '',
  status report_status not null default 'open',
  handled_by text references profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, reporter_id)
);

create index products_browse_idx
  on products (status, category_id, wilaya_id, listing_type, published_at desc);
create index products_troop_idx on products (troop_id, status);
create index profiles_troop_idx on profiles (troop_id);
create index subscriptions_troop_idx on subscriptions (troop_id, status);
create index reports_status_idx on reports (status, created_at desc);

create trigger wilayas_set_updated_at before update on wilayas
  for each row execute function set_updated_at();
create trigger plans_set_updated_at before update on plans
  for each row execute function set_updated_at();
create trigger troops_set_updated_at before update on troops
  for each row execute function set_updated_at();
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();
create trigger categories_set_updated_at before update on categories
  for each row execute function set_updated_at();
create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();
create trigger product_images_set_updated_at before update on product_images
  for each row execute function set_updated_at();
create trigger reports_set_updated_at before update on reports
  for each row execute function set_updated_at();

-- Caller id is empty unless a later server action sets app.user_id
-- inside a transaction. The pooled driver does not keep session state.
create or replace function app_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '');
$$;

create or replace function app_current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from profiles p where p.id = app_user_id();
$$;

create or replace function app_current_troop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.troop_id
  from profiles p
  where p.id = app_user_id()
    and p.is_active;
$$;

create or replace function has_active_subscription(troop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from subscriptions s
    where s.troop_id = troop
      and s.status = 'active'
      and s.ends_at > now()
  );
$$;

create or replace function enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer;
begin
  if not has_active_subscription(new.troop_id) then
    raise exception 'NO_ACTIVE_SUBSCRIPTION' using errcode = 'P0001';
  end if;

  select s.max_products into lim
  from subscriptions s
  where s.troop_id = new.troop_id
    and s.status = 'active'
    and s.ends_at > now()
  order by s.ends_at desc
  limit 1
  for update;

  if (
    select count(*) from products p where p.troop_id = new.troop_id
  ) >= lim then
    raise exception 'LIMIT_PRODUCTS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger products_enforce_limit
  before insert on products
  for each row execute function enforce_product_limit();

create or replace function enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  others integer;
  lim integer;
begin
  if new.troop_id is null or new.is_active is not true then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.troop_id is not distinct from new.troop_id
     and old.is_active is true then
    return new;
  end if;

  select count(*) into others
  from profiles
  where troop_id = new.troop_id
    and is_active
    and id <> new.id;

  -- The first profile linked to a troop is the founding manager.
  -- Registration happens before any subscription exists.
  if others = 0 then
    return new;
  end if;

  if not has_active_subscription(new.troop_id) then
    raise exception 'NO_ACTIVE_SUBSCRIPTION' using errcode = 'P0001';
  end if;

  select s.max_members into lim
  from subscriptions s
  where s.troop_id = new.troop_id
    and s.status = 'active'
    and s.ends_at > now()
  order by s.ends_at desc
  limit 1
  for update;

  if others >= lim then
    raise exception 'LIMIT_MEMBERS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_member_limit
  before insert or update of troop_id, is_active on profiles
  for each row execute function enforce_member_limit();

-- Blocks a caller from changing their own role or troop when app.user_id is set.
-- The application role is a superuser and does not set app.user_id, so server
-- actions are not blocked here. Those actions must check the role themselves.
create or replace function protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := app_user_id();
  actor_role user_role;
begin
  if actor is null or actor <> old.id then
    return new;
  end if;

  select role into actor_role from profiles where id = actor;
  if actor_role = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role or new.troop_id is distinct from old.troop_id then
    raise exception 'FORBIDDEN_PROFILE_FIELDS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

create or replace function protect_troop_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if app_user_id() is not null
     and app_current_role() is distinct from 'admin'
     and new.status is distinct from old.status then
    raise exception 'FORBIDDEN_TROOP_STATUS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger troops_protect_status
  before update on troops
  for each row execute function protect_troop_status();

alter table wilayas enable row level security;
alter table wilayas force row level security;
alter table plans enable row level security;
alter table plans force row level security;
alter table troops enable row level security;
alter table troops force row level security;
alter table profiles enable row level security;
alter table profiles force row level security;
alter table subscriptions enable row level security;
alter table subscriptions force row level security;
alter table categories enable row level security;
alter table categories force row level security;
alter table products enable row level security;
alter table products force row level security;
alter table product_images enable row level security;
alter table product_images force row level security;
alter table reports enable row level security;
alter table reports force row level security;

create policy wilayas_public_read on wilayas
  for select using (true);

create policy plans_public_read on plans
  for select using (is_active or app_current_role() = 'admin');

create policy plans_admin_write on plans
  for all using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');

create policy categories_public_read on categories
  for select using (is_active or app_current_role() = 'admin');

create policy categories_admin_write on categories
  for all using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');

create policy troops_public_read on troops
  for select using (
    status = 'active'
    or app_current_role() = 'admin'
    or id = app_current_troop_id()
  );

create policy troops_manager_update on troops
  for update using (
    app_current_role() = 'troop_manager'
    and id = app_current_troop_id()
  )
  with check (
    app_current_role() = 'troop_manager'
    and id = app_current_troop_id()
  );

create policy troops_admin_write on troops
  for all using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');

create policy profiles_select on profiles
  for select using (
    id = app_user_id()
    or app_current_role() = 'admin'
    or (
      app_current_role() = 'troop_manager'
      and troop_id is not null
      and troop_id = app_current_troop_id()
    )
  );

create policy profiles_update_own on profiles
  for update using (id = app_user_id() or app_current_role() = 'admin')
  with check (id = app_user_id() or app_current_role() = 'admin');

create policy profiles_admin_write on profiles
  for all using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');

create policy subscriptions_troop_read on subscriptions
  for select using (
    app_current_role() = 'admin'
    or (
      app_current_role() = 'troop_manager'
      and troop_id = app_current_troop_id()
    )
  );

create policy subscriptions_manager_insert on subscriptions
  for insert with check (
    status = 'pending'
    and (
      app_current_role() = 'admin'
      or (
        app_current_role() = 'troop_manager'
        and troop_id = app_current_troop_id()
      )
    )
  );

create policy subscriptions_admin_update on subscriptions
  for update using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');

create policy products_select on products
  for select using (
    app_current_role() = 'admin'
    or troop_id = app_current_troop_id()
    or (
      status = 'active'
      and exists (
        select 1 from troops t
        where t.id = products.troop_id and t.status = 'active'
      )
      and has_active_subscription(troop_id)
    )
  );

create policy products_manager_write on products
  for all using (
    app_current_role() = 'admin'
    or (
      app_current_role() = 'troop_manager'
      and troop_id = app_current_troop_id()
    )
  )
  with check (
    app_current_role() = 'admin'
    or (
      app_current_role() = 'troop_manager'
      and troop_id = app_current_troop_id()
    )
  );

create policy product_images_select on product_images
  for select using (
    exists (
      select 1 from products p
      where p.id = product_images.product_id
        and (
          app_current_role() = 'admin'
          or p.troop_id = app_current_troop_id()
          or (
            p.status = 'active'
            and exists (
              select 1 from troops t
              where t.id = p.troop_id and t.status = 'active'
            )
            and has_active_subscription(p.troop_id)
          )
        )
    )
  );

create policy product_images_manager_write on product_images
  for all using (
    exists (
      select 1 from products p
      where p.id = product_images.product_id
        and (
          app_current_role() = 'admin'
          or (
            app_current_role() = 'troop_manager'
            and p.troop_id = app_current_troop_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from products p
      where p.id = product_images.product_id
        and (
          app_current_role() = 'admin'
          or (
            app_current_role() = 'troop_manager'
            and p.troop_id = app_current_troop_id()
          )
        )
    )
  );

create policy reports_insert on reports
  for insert with check (reporter_id = app_user_id());

create policy reports_admin_read on reports
  for select using (app_current_role() = 'admin');

create policy reports_admin_update on reports
  for update using (app_current_role() = 'admin')
  with check (app_current_role() = 'admin');
