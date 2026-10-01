-- زاد الكشاف: الأفواج، الاشتراك، العتاد. بلا عمولة.

create table if not exists wilayas (
  code smallint primary key check (code between 1 and 58),
  name_ar text not null unique
);

create table if not exists categories (
  id text primary key,
  name_ar text not null unique,
  sort_order integer not null default 0
);

create table if not exists plans (
  id text primary key,
  name_ar text not null,
  annual_price_dzd numeric(12, 2) not null check (annual_price_dzd >= 0),
  duration_days integer not null check (duration_days > 0),
  max_members integer not null check (max_members > 0),
  max_products integer not null check (max_products > 0),
  is_active boolean not null default true
);

create table if not exists profiles (
  user_id text primary key references "user" (id) on delete cascade,
  display_name text not null,
  phone text,
  platform_role text not null default 'user' check (platform_role in ('user', 'platform_admin')),
  created_at timestamptz not null default now()
);

create table if not exists troops (
  id text primary key,
  name text not null,
  wilaya_code smallint not null references wilayas (code),
  commune text not null,
  about text not null default '',
  phone text,
  status text not null default 'pending_review' check (status in ('pending_review', 'active', 'suspended')),
  created_by text not null references "user" (id),
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  troop_id text not null references troops (id) on delete cascade,
  user_id text not null references "user" (id) on delete cascade,
  role text not null check (role in ('manager', 'member')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (troop_id, user_id)
);

create unique index if not exists memberships_one_active_troop
  on memberships (user_id) where status = 'active';

create table if not exists subscriptions (
  id text primary key,
  troop_id text not null references troops (id) on delete cascade,
  plan_id text not null references plans (id),
  price_dzd numeric(12, 2) not null check (price_dzd >= 0),
  duration_days integer not null check (duration_days > 0),
  starts_on date,
  ends_on date,
  max_members integer not null check (max_members > 0),
  max_products integer not null check (max_products > 0),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'active', 'expired', 'suspended')),
  proof text not null default '',
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create unique index if not exists subscriptions_one_pending
  on subscriptions (troop_id) where status = 'pending_review';

create table if not exists products (
  id text primary key,
  troop_id text not null references troops (id) on delete cascade,
  created_by text not null references "user" (id),
  category_id text not null references categories (id),
  title text not null,
  description text not null,
  condition text not null check (condition in ('new', 'used', 'good', 'needs_maintenance')),
  operation text not null check (operation in ('sale', 'rent', 'exchange')),
  sale_price_dzd numeric(12, 2) check (sale_price_dzd is null or sale_price_dzd >= 0),
  rent_price_dzd numeric(12, 2) check (rent_price_dzd is null or rent_price_dzd >= 0),
  wilaya_code smallint not null references wilayas (code),
  status text not null default 'available' check (status in ('available', 'unavailable', 'hidden')),
  created_at timestamptz not null default now(),
  check (
    (operation = 'sale' and sale_price_dzd is not null)
    or (operation = 'rent' and rent_price_dzd is not null)
    or operation = 'exchange'
  )
);

create table if not exists contact_requests (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  from_troop_id text not null references troops (id),
  to_troop_id text not null references troops (id),
  sent_by text not null references "user" (id),
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now(),
  check (from_troop_id <> to_troop_id)
);

create table if not exists reports (
  id text primary key,
  product_id text not null references products (id) on delete cascade,
  reporter_id text references "user" (id),
  reason text not null check (reason in (
    'incorrect_info', 'inappropriate', 'violating_content', 'duplicate', 'other'
  )),
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_id text not null references "user" (id) on delete cascade,
  type text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists products_browse_idx
  on products (status, category_id, wilaya_code, operation, created_at desc);
create index if not exists products_troop_idx on products (troop_id, status);
create index if not exists notifications_user_idx on notifications (user_id, is_read, created_at desc);
create index if not exists contacts_inbox_idx on contact_requests (to_troop_id, created_at desc);
create index if not exists subscriptions_troop_idx on subscriptions (troop_id, status);

insert into wilayas (code, name_ar) values
  (1, 'أدرار'), (2, 'الشلف'), (3, 'الأغواط'), (4, 'أم البواقي'), (5, 'باتنة'),
  (6, 'بجاية'), (7, 'بسكرة'), (8, 'بشار'), (9, 'البليدة'), (10, 'البويرة'),
  (11, 'تمنراست'), (12, 'تبسة'), (13, 'تلمسان'), (14, 'تيارت'), (15, 'تيزي وزو'),
  (16, 'الجزائر'), (17, 'الجلفة'), (18, 'جيجل'), (19, 'سطيف'), (20, 'سعيدة'),
  (21, 'سكيكدة'), (22, 'سيدي بلعباس'), (23, 'عنابة'), (24, 'قالمة'), (25, 'قسنطينة'),
  (26, 'المدية'), (27, 'مستغانم'), (28, 'المسيلة'), (29, 'معسكر'), (30, 'ورقلة'),
  (31, 'وهران'), (32, 'البيض'), (33, 'إليزي'), (34, 'برج بوعريريج'), (35, 'بومرداس'),
  (36, 'الطارف'), (37, 'تندوف'), (38, 'تيسمسيلت'), (39, 'الوادي'), (40, 'خنشلة'),
  (41, 'سوق أهراس'), (42, 'تيبازة'), (43, 'ميلة'), (44, 'عين الدفلى'), (45, 'النعامة'),
  (46, 'عين تموشنت'), (47, 'غرداية'), (48, 'غليزان'), (49, 'تيميمون'),
  (50, 'برج باجي مختار'), (51, 'أولاد جلال'), (52, 'بني عباس'), (53, 'عين صالح'),
  (54, 'عين قزام'), (55, 'تقرت'), (56, 'جانت'), (57, 'المغير'), (58, 'المنيعة')
on conflict (code) do nothing;

insert into categories (id, name_ar, sort_order) values
  ('tents', 'الخيام', 1),
  ('bags', 'الحقائب', 2),
  ('uniform', 'الزي الكشفي', 3),
  ('flags', 'الرايات', 4),
  ('camp', 'أدوات المخيم', 5),
  ('cooking', 'الطبخ', 6),
  ('activities', 'الأنشطة', 7),
  ('aid', 'الإسعاف', 8),
  ('nav', 'الملاحة والتخييم', 9),
  ('other', 'أخرى', 10)
on conflict (id) do nothing;

insert into plans (id, name_ar, annual_price_dzd, duration_days, max_members, max_products)
values ('basic', 'أساسي', 2000, 365, 5, 20)
on conflict (id) do nothing;
