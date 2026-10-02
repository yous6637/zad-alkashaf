-- Demo troops for the public list. Idempotent by id. No login accounts.
insert into troops (id, name, wilaya_id, municipality, description, contact_phone, contact_email, status)
select
  v.id::uuid,
  v.name,
  v.wilaya_id::int,
  v.municipality,
  v.description,
  v.contact_phone,
  v.contact_email,
  v.status::troop_status
from (values
  (
    'a1000001-0000-4000-8000-000000000001',
    'فوج الأمل',
    '25',
    'قسنطينة',
    'فوج كشفي في قسنطينة يعرض العتاد غير المستعمل ويتبادل الخبرة مع الأفواج المجاورة.',
    '0551000001',
    'amal@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    'فوج الكشافة',
    '16',
    'الجزائر الوسطى',
    'فوج في العاصمة يشارك الخيام والحقائب والزي بين الأفواج بعد نهاية المخيمات.',
    '0551000002',
    'kashafa@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    'فوج المستقبل',
    '31',
    'وهران',
    'فوج وهراني يهتم بمعدات الطبخ والمخيم ويتيحها للأفواج التي تستعد للخروج.',
    '0551000003',
    'mostaqbal@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000004',
    'فوج النور',
    '9',
    'البليدة',
    'فوج في البليدة يعرض أدوات الإسعاف والرايات بعد تجديد عتاده.',
    '0551000004',
    'nour@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000005',
    'فوج الصمود',
    '19',
    'سطيف',
    'فوج سطايفي يشارك الزي الكشفي وأدوات الأنشطة مع الأفواج الأخرى.',
    '0551000005',
    'soumoud@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000006',
    'فوج الأطلس',
    '5',
    'باتنة',
    'فوج في باتنة يوفّر خياماً وحقائب للمخيمات الجبلية.',
    '0551000006',
    'atlas@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000007',
    'فوج الساحل',
    '6',
    'بجاية',
    'فوج بجاوي يعرض معدات الساحل والملاحة التي لم تعد مستعملة.',
    '0551000007',
    'sahel@example.com',
    'active'
  ),
  (
    'a1000001-0000-4000-8000-000000000008',
    'فوج الواحات',
    '47',
    'غرداية',
    'فوج في غرداية يشارك عتاد المخيم الصحراوي مع الأفواج الزائرة.',
    '0551000008',
    'waha@example.com',
    'active'
  )
) as v(id, name, wilaya_id, municipality, description, contact_phone, contact_email, status)
where not exists (select 1 from troops t where t.id = v.id::uuid);
