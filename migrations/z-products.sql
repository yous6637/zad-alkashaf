-- Demo catalog. A profile is required for created_by, and an active
-- subscription is required or the product-limit trigger rejects the row.
-- These users have no password, so they cannot sign in.

insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
select v.id, v.name, v.email, true, now(), now()
from (values
  ('seed-manager-01', 'مسؤول فوج الأمل', 'seed-amal@example.com'),
  ('seed-manager-02', 'مسؤول فوج الكشافة', 'seed-kashafa@example.com'),
  ('seed-manager-03', 'مسؤول فوج المستقبل', 'seed-mostaqbal@example.com'),
  ('seed-manager-04', 'مسؤول فوج النور', 'seed-nour@example.com'),
  ('seed-manager-05', 'مسؤول فوج الصمود', 'seed-soumoud@example.com'),
  ('seed-manager-06', 'مسؤول فوج الأطلس', 'seed-atlas@example.com'),
  ('seed-manager-07', 'مسؤول فوج الساحل', 'seed-sahel@example.com'),
  ('seed-manager-08', 'مسؤول فوج الواحات', 'seed-waha@example.com')
) as v(id, name, email)
where not exists (select 1 from "user" u where u.id = v.id);

insert into profiles (id, troop_id, full_name, phone, role)
select v.id, v.troop_id::uuid, v.full_name, v.phone, 'troop_manager'::user_role
from (values
  ('seed-manager-01', 'a1000001-0000-4000-8000-000000000001', 'مسؤول فوج الأمل', '0551000001'),
  ('seed-manager-02', 'a1000001-0000-4000-8000-000000000002', 'مسؤول فوج الكشافة', '0551000002'),
  ('seed-manager-03', 'a1000001-0000-4000-8000-000000000003', 'مسؤول فوج المستقبل', '0551000003'),
  ('seed-manager-04', 'a1000001-0000-4000-8000-000000000004', 'مسؤول فوج النور', '0551000004'),
  ('seed-manager-05', 'a1000001-0000-4000-8000-000000000005', 'مسؤول فوج الصمود', '0551000005'),
  ('seed-manager-06', 'a1000001-0000-4000-8000-000000000006', 'مسؤول فوج الأطلس', '0551000006'),
  ('seed-manager-07', 'a1000001-0000-4000-8000-000000000007', 'مسؤول فوج الساحل', '0551000007'),
  ('seed-manager-08', 'a1000001-0000-4000-8000-000000000008', 'مسؤول فوج الواحات', '0551000008')
) as v(id, troop_id, full_name, phone)
where not exists (select 1 from profiles p where p.id = v.id);

insert into subscriptions (
  id, troop_id, plan_id, price_dzd, max_members, max_products, starts_at, ends_at, status, payment_note
)
select
  v.id::uuid,
  v.troop_id::uuid,
  plan.id,
  plan.price_dzd,
  plan.max_members,
  plan.max_products,
  now(),
  now() + interval '365 days',
  'active'::subscription_status,
  'بيانات عرض'
from (values
  ('b2000001-0000-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000001'),
  ('b2000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000002'),
  ('b2000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-000000000003'),
  ('b2000001-0000-4000-8000-000000000004', 'a1000001-0000-4000-8000-000000000004'),
  ('b2000001-0000-4000-8000-000000000005', 'a1000001-0000-4000-8000-000000000005'),
  ('b2000001-0000-4000-8000-000000000006', 'a1000001-0000-4000-8000-000000000006'),
  ('b2000001-0000-4000-8000-000000000007', 'a1000001-0000-4000-8000-000000000007'),
  ('b2000001-0000-4000-8000-000000000008', 'a1000001-0000-4000-8000-000000000008')
) as v(id, troop_id)
cross join lateral (
  select id, price_dzd, max_members, max_products
  from plans
  where is_active
  order by price_dzd
  limit 1
) plan
where not exists (select 1 from subscriptions s where s.id = v.id::uuid);

insert into products (
  id, troop_id, created_by, category_id, title, description,
  listing_type, condition, price_dzd, rent_price_dzd, wilaya_id,
  visibility, status, published_at, created_at
)
select
  v.id::uuid,
  v.troop_id::uuid,
  v.created_by,
  c.id,
  v.title,
  v.description,
  v.listing_type::listing_type,
  v.condition::item_condition,
  nullif(v.price_dzd, '')::int,
  nullif(v.rent_price_dzd, '')::int,
  v.wilaya_id::int,
  'public'::product_visibility,
  'active'::product_status,
  now(),
  now() - (v.age_hours::int * interval '1 hour')
from (values
  ('c3000001-0000-4000-8000-000000000001', 'a1000001-0000-4000-8000-000000000004', 'seed-manager-04', 'tents', 'خيمة كشفية 4 أشخاص', 'خيمة مستعملة بحالة جيدة، مناسبة لمخيم نهاية الأسبوع.', 'sale', 'used_good', '12000', '', '9', '1'),
  ('c3000001-0000-4000-8000-000000000002', 'a1000001-0000-4000-8000-000000000002', 'seed-manager-02', 'bags', 'حقيبة ظهر 60 لتراً', 'حقيبة جديدة لم تُستعمل بعد المخيم الأخير.', 'sale', 'new', '18500', '', '16', '2'),
  ('c3000001-0000-4000-8000-000000000003', 'a1000001-0000-4000-8000-000000000003', 'seed-manager-03', 'uniform', 'الزي الكشفي الكامل', 'قميص ووشاح وقبعة، مقاس متوسط، مستعمل بحالة جيدة.', 'sale', 'used_good', '8000', '', '31', '3'),
  ('c3000001-0000-4000-8000-000000000004', 'a1000001-0000-4000-8000-000000000005', 'seed-manager-05', 'cooking', 'موقد غاز للتخييم', 'موقد جديد للكراء خلال المخيمات.', 'rent', 'new', '', '5500', '19', '4'),
  ('c3000001-0000-4000-8000-000000000005', 'a1000001-0000-4000-8000-000000000001', 'seed-manager-01', 'first-aid', 'حقيبة إسعافات أولية', 'حقيبة إسعاف كاملة، مستعملة وصالحة للاستعمال.', 'sale', 'used_good', '3000', '', '25', '5'),
  ('c3000001-0000-4000-8000-000000000006', 'a1000001-0000-4000-8000-000000000006', 'seed-manager-06', 'flags', 'راية الفوج', 'راية قماش للمخيم، تُعرض للتبادل مع راية مماثلة.', 'exchange', 'used_good', '', '', '5', '6'),
  ('c3000001-0000-4000-8000-000000000007', 'a1000001-0000-4000-8000-000000000007', 'seed-manager-07', 'navigation', 'بوصلة جيب', 'الفوج يبحث عن بوصلة جيب لمخيم الساحل.', 'wanted', 'used_good', '', '', '6', '7'),
  ('c3000001-0000-4000-8000-000000000008', 'a1000001-0000-4000-8000-000000000008', 'seed-manager-08', 'camp-tools', 'أدوات مخيم صحراوي', 'أوتاد وحبال ومطرقة، للكراء أسبوعياً.', 'rent', 'used_good', '', '2500', '47', '8'),
  ('c3000001-0000-4000-8000-000000000009', 'a1000001-0000-4000-8000-000000000002', 'seed-manager-02', 'activities', 'حبال أنشطة', 'مجموعة حبال للألعاب الكشفية، تحتاج صيانة بسيطة.', 'sale', 'needs_repair', '1500', '', '16', '9'),
  ('c3000001-0000-4000-8000-000000000010', 'a1000001-0000-4000-8000-000000000005', 'seed-manager-05', 'training', 'دليل التدريب الكشفي', 'نسخ مطبوعة من دليل التدريب، بحالة جيدة.', 'sale', 'used_good', '900', '', '19', '10')
) as v(
  id, troop_id, created_by, slug, title, description,
  listing_type, condition, price_dzd, rent_price_dzd, wilaya_id, age_hours
)
join categories c on c.slug = v.slug
where not exists (select 1 from products p where p.id = v.id::uuid);
