-- Reference data only. No users, no credentials.
-- Applied once, after 0003_spec.sql, by the same migrator.
-- To promote the first admin after that person has registered:
--   update profiles set role = 'admin' where id = '<user id from "user".id>';

insert into wilayas (id, name_ar, name_fr) values
  (1, 'أدرار', 'Adrar'),
  (2, 'الشلف', 'Chlef'),
  (3, 'الأغواط', 'Laghouat'),
  (4, 'أم البواقي', 'Oum El Bouaghi'),
  (5, 'باتنة', 'Batna'),
  (6, 'بجاية', 'Béjaïa'),
  (7, 'بسكرة', 'Biskra'),
  (8, 'بشار', 'Béchar'),
  (9, 'البليدة', 'Blida'),
  (10, 'البويرة', 'Bouira'),
  (11, 'تمنراست', 'Tamanrasset'),
  (12, 'تبسة', 'Tébessa'),
  (13, 'تلمسان', 'Tlemcen'),
  (14, 'تيارت', 'Tiaret'),
  (15, 'تيزي وزو', 'Tizi Ouzou'),
  (16, 'الجزائر', 'Alger'),
  (17, 'الجلفة', 'Djelfa'),
  (18, 'جيجل', 'Jijel'),
  (19, 'سطيف', 'Sétif'),
  (20, 'سعيدة', 'Saïda'),
  (21, 'سكيكدة', 'Skikda'),
  (22, 'سيدي بلعباس', 'Sidi Bel Abbès'),
  (23, 'عنابة', 'Annaba'),
  (24, 'قالمة', 'Guelma'),
  (25, 'قسنطينة', 'Constantine'),
  (26, 'المدية', 'Médéa'),
  (27, 'مستغانم', 'Mostaganem'),
  (28, 'المسيلة', 'M''Sila'),
  (29, 'معسكر', 'Mascara'),
  (30, 'ورقلة', 'Ouargla'),
  (31, 'وهران', 'Oran'),
  (32, 'البيض', 'El Bayadh'),
  (33, 'إليزي', 'Illizi'),
  (34, 'برج بوعريريج', 'Bordj Bou Arreridj'),
  (35, 'بومرداس', 'Boumerdès'),
  (36, 'الطارف', 'El Tarf'),
  (37, 'تندوف', 'Tindouf'),
  (38, 'تيسمسيلت', 'Tissemsilt'),
  (39, 'الوادي', 'El Oued'),
  (40, 'خنشلة', 'Khenchela'),
  (41, 'سوق أهراس', 'Souk Ahras'),
  (42, 'تيبازة', 'Tipaza'),
  (43, 'ميلة', 'Mila'),
  (44, 'عين الدفلى', 'Aïn Defla'),
  (45, 'النعامة', 'Naâma'),
  (46, 'عين تموشنت', 'Aïn Témouchent'),
  (47, 'غرداية', 'Ghardaïa'),
  (48, 'غليزان', 'Relizane'),
  (49, 'تيميمون', 'Timimoun'),
  (50, 'برج باجي مختار', 'Bordj Badji Mokhtar'),
  (51, 'أولاد جلال', 'Ouled Djellal'),
  (52, 'بني عباس', 'Béni Abbès'),
  (53, 'عين صالح', 'In Salah'),
  (54, 'عين قزام', 'In Guezzam'),
  (55, 'تقرت', 'Touggourt'),
  (56, 'جانت', 'Djanet'),
  (57, 'المغير', 'El M''Ghair'),
  (58, 'المنيعة', 'El Meniaa')
on conflict (id) do update set
  name_ar = excluded.name_ar,
  name_fr = excluded.name_fr;

insert into categories (slug, name_ar, name_fr, sort_order) values
  ('tents', 'الخيام', 'Tentes', 1),
  ('bags', 'الحقائب', 'Sacs', 2),
  ('uniform', 'الزي الكشفي', 'Uniforme scout', 3),
  ('flags', 'الرايات', 'Drapeaux', 4),
  ('camp-tools', 'أدوات المخيم', 'Outils de camp', 5),
  ('cooking', 'الطبخ', 'Cuisine', 6),
  ('activities', 'الأنشطة', 'Activités', 7),
  ('first-aid', 'الإسعافات الأولية', 'Premiers secours', 8),
  ('navigation', 'الملاحة', 'Orientation', 9),
  ('training', 'التدريب', 'Formation', 10),
  ('other', 'أخرى', 'Autre', 11)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  name_fr = excluded.name_fr,
  sort_order = excluded.sort_order;

insert into plans (name, price_dzd, duration_days, max_members, max_products, is_active)
select 'الاشتراك السنوي', 2000, 365, 10, 30, true
where not exists (select 1 from plans);
