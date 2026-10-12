create or replace function enforce_product_image_limit()
returns trigger
language plpgsql
as $$
declare
  existing integer;
begin
  select count(*) into existing
  from product_images
  where product_id = new.product_id;
  if existing >= 5 then
    raise exception 'LIMIT_IMAGES' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists product_images_limit on product_images;
create trigger product_images_limit
  before insert on product_images
  for each row execute function enforce_product_image_limit();
