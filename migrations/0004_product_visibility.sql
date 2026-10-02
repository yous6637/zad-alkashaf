-- Split who can see a product from whether it is available.
-- Old product_status 'hidden' becomes visibility = 'hidden' and status = 'active'.

create type product_visibility as enum ('public', 'troops_only', 'hidden');

alter table products
  add column visibility product_visibility not null default 'public';

update products
set visibility = 'hidden'
where status::text = 'hidden';

drop policy if exists products_select on products;
drop policy if exists product_images_select on product_images;

alter table products alter column status drop default;

create type product_status_v2 as enum ('active', 'unavailable');

alter table products
  alter column status type product_status_v2
  using (
    case
      when status::text = 'unavailable' then 'unavailable'
      else 'active'
    end
  )::product_status_v2;

drop type product_status;
alter type product_status_v2 rename to product_status;

alter table products alter column status set default 'active';

create policy products_select on products
  for select using (
    app_current_role() = 'admin'
    or troop_id = app_current_troop_id()
    or (
      status = 'active'
      and visibility = 'public'
      and exists (
        select 1 from troops t
        where t.id = products.troop_id and t.status = 'active'
      )
      and has_active_subscription(troop_id)
    )
    or (
      status = 'active'
      and visibility = 'troops_only'
      and app_current_role() in ('member', 'troop_manager')
      and exists (
        select 1 from troops t
        where t.id = products.troop_id and t.status = 'active'
      )
      and has_active_subscription(troop_id)
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
            and p.visibility = 'public'
            and exists (
              select 1 from troops t
              where t.id = p.troop_id and t.status = 'active'
            )
            and has_active_subscription(p.troop_id)
          )
          or (
            p.status = 'active'
            and p.visibility = 'troops_only'
            and app_current_role() in ('member', 'troop_manager')
            and exists (
              select 1 from troops t
              where t.id = p.troop_id and t.status = 'active'
            )
            and has_active_subscription(p.troop_id)
          )
        )
    )
  );
