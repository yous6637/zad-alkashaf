import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireRole, requireTroop } from "@/lib/zad/access";
import { memberEmailSchema, memberIdSchema } from "@/lib/zad/member";
import { productIdSchema, productSchema, productStatusSchema } from "@/lib/zad/product";
import { planSchema } from "@/lib/zad/plan";
import { productRefSchema, reportSchema } from "@/lib/zad/report";
import { proofSchema } from "@/lib/zad/subscription";
import { troopSchema } from "@/lib/zad/troop";
import type { Category, Listing, Me, Plan, TroopCard, Wilaya } from "@/lib/zad/types";

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("بيانات غير صالحة");
  return result.data;
}

function id() {
  return crypto.randomUUID();
}

function dbError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("LIMIT_PRODUCTS")) throw new Error("بلغت حد المنتجات في الباقة");
  if (message.includes("LIMIT_MEMBERS")) throw new Error("بلغت حد الأعضاء في الباقة");
  if (message.includes("NO_ACTIVE_SUBSCRIPTION")) throw new Error("هذه العملية تحتاج اشتراكاً فعّالاً");
  if (message.includes("duplicate key") || message.includes("unique")) {
    throw new Error("هذا السجل موجود مسبقاً");
  }
  throw error instanceof Error ? error : new Error("تعذّر التنفيذ");
}

async function ensureProfile(sql: Sql, userId: string) {
  await sql`
    insert into profiles (id, full_name)
    select u.id, coalesce(nullif(u.name, ''), 'مستخدم')
    from "user" u
    where u.id = ${userId}
    on conflict (id) do nothing
  `;
}

function listingSelect(locale: "ar" | "fr" = "ar") {
  const name = locale === "fr" ? "name_fr" : "name_ar";
  return `
  p.id,
  p.title,
  p.description,
  p.category_id as "categoryId",
  c.slug as "categorySlug",
  c.${name} as "categoryName",
  p.listing_type as operation,
  p.condition,
  p.price_dzd::text as "salePrice",
  p.rent_price_dzd::text as "rentPrice",
  p.wilaya_id as "wilayaCode",
  w.${name} as "wilayaName",
  p.visibility,
  p.status,
  p.troop_id as "troopId",
  t.name as "troopName",
  to_char(coalesce(p.published_at, p.created_at), 'YYYY-MM-DD') as "createdAt"
`;
}

const visibleListing = `
  p.visibility = 'public'
  and p.status = 'active'
  and t.status = 'active'
  and has_active_subscription(t.id)
`;

export const getMeta = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    parse(z.object({ locale: z.enum(["ar", "fr"]).optional() }), data ?? {}),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const categories =
      data.locale === "fr"
        ? await sql<{ id: string; slug: string; name: string }>`
            select id, slug, name_fr as name from categories where is_active order by sort_order, name_fr
          `
        : await sql<{ id: string; slug: string; name: string }>`
            select id, slug, name_ar as name from categories where is_active order by sort_order, name_ar
          `;
    const wilayas =
      data.locale === "fr"
        ? await sql<{ code: number; name: string }>`
            select id as code, name_fr as name from wilayas order by id
          `
        : await sql<{ code: number; name: string }>`
            select id as code, name_ar as name from wilayas order by id
          `;
  const plans = await sql<{
    id: string;
    name: string;
    price: string;
    durationDays: number;
    maxMembers: number;
    maxProducts: number;
  }>`
    select id, name, price_dzd::text as price,
      duration_days as "durationDays", max_members as "maxMembers",
      max_products as "maxProducts"
    from plans where is_active = true
    order by price_dzd
    limit 1
  `;
  return {
    categories: categories as Category[],
    wilayas: wilayas as Wilaya[],
    plan: (plans[0] ?? null) as Plan | null,
  };
});

const catalogSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: z.union([z.literal(""), z.string().uuid()]).optional(),
  wilayaCode: z.number().int().min(1).max(58).optional(),
  operation: z.enum(["", "sale", "rent", "exchange", "wanted"]).optional(),
  condition: z.enum(["", "new", "used_good", "needs_repair"]).optional(),
  maxPrice: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(48).optional(),
  locale: z.enum(["ar", "fr"]).optional(),
});

export const listProducts = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(catalogSchema, data ?? {}))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const q = (data.q ?? "").replace(/[%_\\]/g, "");
    const limit = data.limit ?? 24;
    const locale = data.locale === "fr" ? "fr" : "ar";
    return sql.query<Listing>(
      `select ${listingSelect(locale)}
       from products p
       join troops t on t.id = p.troop_id
       join categories c on c.id = p.category_id
       join wilayas w on w.id = p.wilaya_id
       where ${visibleListing}
         and ($1 = '' or p.title ilike $2 or p.description ilike $2)
         and ($3 = '' or p.category_id::text = $3)
         and ($4::int is null or p.wilaya_id = $4)
         and ($5 = '' or p.listing_type::text = $5)
         and ($6 = '' or p.condition::text = $6)
         and (
           $7::int is null
           or (p.listing_type = 'sale' and p.price_dzd <= $7)
           or (p.listing_type = 'rent' and p.rent_price_dzd <= $7)
         )
       order by p.created_at desc
       limit $8`,
      [
        q,
        `%${q}%`,
        data.categoryId ?? "",
        data.wilayaCode ?? null,
        data.operation ?? "",
        data.condition ?? "",
        data.maxPrice ?? null,
        limit,
      ],
    );
  });

export const getProduct = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().min(1), locale: z.enum(["ar", "fr"]).optional() }), data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const locale = data.locale === "fr" ? "fr" : "ar";
    const rows = await sql.query<Listing & { logo: string | null; commune: string }>(
      `select ${listingSelect(locale)},
              t.logo_path as logo,
              t.municipality as commune
       from products p
       join troops t on t.id = p.troop_id
       join categories c on c.id = p.category_id
       join wilayas w on w.id = p.wilaya_id
       where p.id = $1::uuid and ${visibleListing}`,
      [data.id],
    );
    const item = rows[0];
    if (!item) return null;
    const related = await sql.query<Listing>(
      `select ${listingSelect(locale)}
       from products p
       join troops t on t.id = p.troop_id
       join categories c on c.id = p.category_id
       join wilayas w on w.id = p.wilaya_id
       where p.troop_id = $1::uuid and p.id <> $2::uuid and ${visibleListing}
       order by p.created_at desc
       limit 4`,
      [item.troopId, item.id],
    );
    return {
      item,
      logo: item.logo,
      commune: item.commune,
      related,
    };
  });

export const listTroops = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    parse(z.object({ locale: z.enum(["ar", "fr"]).optional() }), data ?? {}),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const name = data.locale === "fr" ? "name_fr" : "name_ar";
    return sql.query<TroopCard>(
      `select t.id, t.name, t.wilaya_id as "wilayaCode", w.${name} as "wilayaName",
              t.municipality as commune, t.description as about, t.status,
              t.logo_path as logo, t.thumbnail_path as thumbnail,
              (
                select count(*)::int from products p
                where p.troop_id = t.id
                  and p.visibility = 'public'
                  and p.status = 'active'
                  and t.status = 'active'
                  and has_active_subscription(t.id)
              ) as "listingCount",
              (
                select count(*)::int from profiles pr
                where pr.troop_id = t.id and pr.is_active
              ) as "memberCount"
       from troops t
       join wilayas w on w.id = t.wilaya_id
       where t.status = 'active'
       order by t.created_at desc`,
    );
  });

export const getTroop = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().max(80), locale: z.enum(["ar", "fr"]).optional() }), data),
  )
  .handler(async ({ data }) => {
    if (!z.string().uuid().safeParse(data.id).success) return null;
    const sql = await getSql();
    const locale = data.locale === "fr" ? "fr" : "ar";
    const name = locale === "fr" ? "name_fr" : "name_ar";
    const troops = await sql.query<TroopCard>(
      `select t.id, t.name, t.wilaya_id as "wilayaCode", w.${name} as "wilayaName",
              t.municipality as commune, t.description as about, t.status,
              t.logo_path as logo, t.thumbnail_path as thumbnail,
              0 as "listingCount",
              (
                select count(*)::int from profiles pr
                where pr.troop_id = t.id and pr.is_active
              ) as "memberCount"
       from troops t
       join wilayas w on w.id = t.wilaya_id
       where t.id = $1::uuid and t.status = 'active'`,
      [data.id],
    );
    const troop = troops[0];
    if (!troop) return null;
    const listings = await sql.query<Listing>(
      `select ${listingSelect(locale)}
       from products p
       join troops t on t.id = p.troop_id
       join categories c on c.id = p.category_id
       join wilayas w on w.id = p.wilaya_id
       where t.id = $1::uuid and ${visibleListing}
       order by p.created_at desc`,
      [data.id],
    );
    return { troop, listings };
  });

async function loadMe(sql: Sql, userId: string): Promise<Me> {
  await ensureProfile(sql, userId);
  const users = await sql<{ name: string; email: string; platformRole: string }>`
    select u.name, u.email, p.role as "platformRole"
    from "user" u
    join profiles p on p.id = u.id
    where u.id = ${userId}
  `;
  const user = users[0];
  if (!user) throw new Error("الحساب غير موجود");
  const admins = await sql<{ n: number }>`
    select count(*)::int as n from profiles where role = 'admin'
  `;
  const troops = await sql<{
    id: string;
    name: string;
    wilayaCode: number;
    wilayaName: string;
    commune: string;
    about: string;
    phone: string;
    contactEmail: string;
    logo: string;
    thumbnail: string;
    status: string;
    role: string;
  }>`
    select t.id, t.name, t.wilaya_id as "wilayaCode", w.name_ar as "wilayaName",
      t.municipality as commune, t.description as about, coalesce(t.contact_phone, '') as phone,
      coalesce(t.contact_email, '') as "contactEmail",
      coalesce(t.logo_path, '') as logo,
      coalesce(t.thumbnail_path, '') as thumbnail,
      t.status, p.role
    from profiles p
    join troops t on t.id = p.troop_id
    join wilayas w on w.id = t.wilaya_id
    where p.id = ${userId} and p.is_active and p.troop_id is not null
    limit 1
  `;
  const troop = troops[0] ?? null;
  let subscription: Me["subscription"] = null;
  let pendingProof: string | null = null;
  let counts = { members: 0, products: 0 };
  if (troop) {
    const subs = await sql<{
      id: string;
      status: string;
      price: string;
      startsOn: string | null;
      endsOn: string | null;
      maxMembers: number;
      maxProducts: number;
      proof: string;
    }>`
      select id, status, price_dzd::text as price,
        to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD') as "startsOn",
        to_char(ends_at at time zone 'UTC', 'YYYY-MM-DD') as "endsOn",
        max_members as "maxMembers",
        max_products as "maxProducts",
        payment_note as proof
      from subscriptions
      where troop_id = ${troop.id}::uuid
      order by
        case status when 'active' then 0 when 'pending' then 1 else 2 end,
        created_at desc
      limit 1
    `;
    subscription = subs[0] ?? null;
    const pending = await sql<{ proof: string }>`
      select payment_note as proof
      from subscriptions
      where troop_id = ${troop.id}::uuid and status = 'pending'
      limit 1
    `;
    pendingProof = pending[0]?.proof ?? null;
    const memberCount = await sql<{ n: number }>`
      select count(*)::int as n from profiles
      where troop_id = ${troop.id}::uuid and is_active
    `;
    const productCount = await sql<{ n: number }>`
      select count(*)::int as n from products where troop_id = ${troop.id}::uuid
    `;
    counts = { members: memberCount[0]?.n ?? 0, products: productCount[0]?.n ?? 0 };
  }
  const requests = await sql<{ id: string; troopId: string; troopName: string }>`
    select r.id, r.troop_id as "troopId", t.name as "troopName"
    from join_requests r
    join troops t on t.id = r.troop_id
    where r.user_id = ${userId} and r.status = 'pending'
    limit 1
  `;
  return {
    userId,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole,
    canClaimAdmin: (admins[0]?.n ?? 0) === 0,
    troop,
    subscription,
    pendingProof,
    counts,
    joinRequest: requests[0] ?? null,
    notifications: [],
  };
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return loadMe(sql, context.userId);
  });

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await loadMe(sql, context.userId);
    return {
      id: me.userId,
      name: me.name,
      email: me.email,
      role: me.platformRole,
      troopId: me.troop?.id ?? null,
    };
  });

export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    parse(z.object({ fullName: z.string().trim().min(2).max(80) }), data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (id, full_name)
      values (${context.userId}, ${data.fullName})
      on conflict (id) do update set full_name = excluded.full_name
    `;
    return { ok: true as const };
  });

export const registerTroop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(troopSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const existing = await sql<{ id: string }>`
      select id from profiles where id = ${context.userId} and troop_id is not null limit 1
    `;
    if (existing[0]) throw new Error("أنت عضو في فوج بالفعل");
    const troopId = id();
    await sql`
      update join_requests
      set status = 'rejected', handled_at = now()
      where user_id = ${context.userId} and status = 'pending'
    `;
    const rows = await sql<{ id: string }>`
      with new_troop as (
        insert into troops (
          id, name, wilaya_id, municipality, description, contact_phone, contact_email,
          logo_path, thumbnail_path
        )
        values (
          ${troopId}::uuid, ${data.name}, ${data.wilayaCode}, ${data.commune},
          ${data.about}, ${data.phone}, ${data.email}, ${data.logo}, ${data.thumbnail}
        )
        returning id
      )
      update profiles
      set troop_id = (select id from new_troop), role = 'troop_manager'
      where id = ${context.userId} and troop_id is null
      returning troop_id as id
    `;
    if (!rows[0]) throw new Error("تعذّر تسجيل الفوج");
    return { troopId };
  });

export const joinTroop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ troopId: z.string().uuid() }), data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const existing = await sql<{ id: string }>`
      select id from profiles where id = ${context.userId} and troop_id is not null limit 1
    `;
    if (existing[0]) throw new Error("أنت عضو في فوج بالفعل");
    const pending = await sql<{ id: string; troopId: string }>`
      select id, troop_id as "troopId"
      from join_requests
      where user_id = ${context.userId} and status = 'pending'
      limit 1
    `;
    if (pending[0]?.troopId === data.troopId) throw new Error("طلبك قيد مراجعة مدير الفوج");
    if (pending[0]) throw new Error("لديك طلب انضمام قيد المراجعة");
    const troops = await sql<{ id: string }>`
      select id from troops where id = ${data.troopId}::uuid and status = 'active' limit 1
    `;
    if (!troops[0]) throw new Error("الفوج غير متاح للانضمام");
    try {
      await sql`
        insert into join_requests (troop_id, user_id)
        values (${data.troopId}::uuid, ${context.userId})
      `;
    } catch (error) {
      dbError(error);
    }
    return { ok: true as const };
  });

export const cancelJoinRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update join_requests
      set status = 'rejected', handled_at = now()
      where user_id = ${context.userId} and status = 'pending'
      returning id
    `;
    if (!rows[0]) throw new Error("لا يوجد طلب قيد المراجعة");
    return { ok: true as const };
  });

export const listJoinRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("طلبات الانضمام لمدير الفوج فقط");
    return sql<{ id: string; name: string; email: string }>`
      select r.id, u.name, u.email
      from join_requests r
      join "user" u on u.id = r.user_id
      where r.troop_id = ${me.troop.id}::uuid and r.status = 'pending'
      order by r.created_at
    `;
  });

export const decideJoinRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().uuid(), accept: z.boolean() }), data),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("القبول لمدير الفوج فقط");
    const requests = await sql<{ id: string; userId: string }>`
      select id, user_id as "userId"
      from join_requests
      where id = ${data.id}::uuid
        and troop_id = ${me.troop.id}::uuid
        and status = 'pending'
      limit 1
    `;
    const request = requests[0];
    if (!request) throw new Error("الطلب غير موجود");
    if (!data.accept) {
      await sql`
        update join_requests
        set status = 'rejected', handled_by = ${context.userId}, handled_at = now()
        where id = ${request.id}::uuid and status = 'pending'
      `;
      return { ok: true as const };
    }
    if (me.troop.status !== "active" || !subIsLive(me.subscription)) {
      throw new Error("قبول الأعضاء يحتاج اشتراكاً فعّالاً");
    }
    try {
      const linked = await sql<{ id: string }>`
        update profiles
        set troop_id = ${me.troop.id}::uuid, role = 'member'
        where id = ${request.userId} and troop_id is null
        returning id
      `;
      if (!linked[0]) throw new Error("هذا الحساب مرتبط بفوج آخر");
      await sql`
        update join_requests
        set status = 'accepted', handled_by = ${context.userId}, handled_at = now()
        where id = ${request.id}::uuid
      `;
    } catch (error) {
      dbError(error);
    }
    return { ok: true as const };
  });

export const updateTroop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(troopSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("FORBIDDEN");
    await sql`
      update troops
      set name = ${data.name},
          wilaya_id = ${data.wilayaCode},
          municipality = ${data.commune},
          description = ${data.about},
          contact_phone = ${data.phone},
          contact_email = ${data.email},
          logo_path = ${data.logo},
          thumbnail_path = ${data.thumbnail}
      where id = ${me.troop.id}::uuid
    `;
    return { ok: true as const };
  });

export const requestSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(proofSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await loadMe(sql, context.userId);
    if (!me.troop || me.troop.role !== "troop_manager") throw new Error("طلب الاشتراك من مسؤول الفوج فقط");
    if (me.pendingProof) throw new Error("يوجد طلب قيد المراجعة");
    const subId = id();
    const inserted = await sql<{ id: string }>`
      insert into subscriptions (
        id, troop_id, plan_id, price_dzd, max_members, max_products, status, payment_note
      )
      select ${subId}::uuid, ${me.troop.id}::uuid, p.id, p.price_dzd,
        p.max_members, p.max_products, 'pending', ${data.proof}
      from plans p
      where p.is_active = true
      order by p.price_dzd
      limit 1
      returning id
    `;
    if (!inserted[0]) throw new Error("لا توجد باقة مفعّلة");
    return { id: inserted[0].id };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql<{ userId: string }>`
      update profiles set role = 'admin'
      where id = ${context.userId}
        and not exists (
          select 1 from profiles where role = 'admin'
        )
      returning id as "userId"
    `;
    if (!rows[0]) throw new Error("توجد إدارة للمنصة بالفعل");
    return { ok: true };
  });

async function requireManager(sql: Sql, userId: string) {
  await requireTroop(sql, userId);
  const me = await loadMe(sql, userId);
  if (!me.troop) throw new Error("سجّل فوجاً أولاً");
  return { ...me, troop: me.troop };
}

function subIsLive(sub: Me["subscription"]) {
  if (!sub || sub.status !== "active" || !sub.startsOn || !sub.endsOn) return false;
  const today = new Date().toISOString().slice(0, 10);
  return sub.startsOn <= today && sub.endsOn >= today;
}

function troopPrice(
  listingType: "sale" | "rent" | "exchange" | "wanted",
  salePrice: number | null,
  rentPrice: number | null,
) {
  if (listingType === "sale") {
    if (salePrice == null) throw new Error("سعر البيع مطلوب");
    return { sale: salePrice, rent: null };
  }
  if (listingType === "rent") {
    if (rentPrice == null) throw new Error("سعر الكراء مطلوب");
    return { sale: null, rent: rentPrice };
  }
  return { sale: null, rent: null };
}

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(productSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    const troop = me.troop;
    if (!troop) throw new Error("سجّل فوجاً أولاً");
    if (troop.role !== "troop_manager") throw new Error("نشر المنتجات لمسؤول الفوج فقط");
    const price = troopPrice(data.operation, data.salePrice, data.rentPrice);
    if (data.id) {
      const owned = await sql<{ id: string; visibility: string }>`
        select id, visibility from products
        where id = ${data.id}::uuid and troop_id = ${troop.id}::uuid
      `;
      const row = owned[0];
      if (!row) throw new Error("المنتج غير موجود");
      if (row.visibility === "hidden") throw new Error("الإعلان مخفي من الإدارة");
      await sql`
        update products set
          title = ${data.title},
          description = ${data.description},
          category_id = ${data.categoryId}::uuid,
          listing_type = ${data.operation}::listing_type,
          condition = ${data.condition}::item_condition,
          price_dzd = ${price.sale},
          rent_price_dzd = ${price.rent},
          wilaya_id = ${data.wilayaCode}
        where id = ${data.id}::uuid and troop_id = ${troop.id}::uuid
      `;
      return { id: data.id };
    }
    if (troop.status !== "active" || !subIsLive(me.subscription)) {
      throw new Error("النشر يحتاج اشتراكاً فعّالاً");
    }
    const maxProducts = me.subscription?.maxProducts ?? 0;
    if (me.counts.products >= maxProducts) throw new Error("بلغت حد المنتجات في الباقة");
    const productId = id();
    try {
      await sql`
        insert into products (
          id, troop_id, created_by, category_id, title, description, condition,
          listing_type, price_dzd, rent_price_dzd, wilaya_id, published_at
        ) values (
          ${productId}::uuid, ${troop.id}::uuid, ${context.userId}, ${data.categoryId}::uuid,
          ${data.title}, ${data.description}, ${data.condition}::item_condition, ${data.operation}::listing_type,
          ${price.sale}, ${price.rent}, ${data.wilayaCode}, now()
        )
      `;
    } catch (error) {
      dbError(error);
    }
    return { id: productId };
  });

export const setProductStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(productStatusSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop?.role !== "troop_manager") throw new Error("تعديل المنتجات لمسؤول الفوج فقط");
    const rows = await sql<{ status: string }>`
      update products set status = ${data.status}::product_status
      where id = ${data.id}::uuid and troop_id = ${me.troop.id}::uuid and visibility <> 'hidden'
      returning status
    `;
    if (!rows[0]) throw new Error("تعذّر تحديث الإعلان");
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(productIdSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("حذف المنتجات لمسؤول الفوج فقط");
    const removed = await sql<{ id: string }>`
      delete from products
      where id = ${data.id}::uuid and troop_id = ${me.troop.id}::uuid
      returning id
    `;
    if (!removed[0]) throw new Error("المنتج غير موجود");
    return { ok: true as const };
  });

export const listOwnProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    return sql.query<Listing>(
      `select ${listingSelect()}
       from products p
       join troops t on t.id = p.troop_id
       join categories c on c.id = p.category_id
       join wilayas w on w.id = p.wilaya_id
       where p.troop_id = $1::uuid
       order by p.created_at desc`,
      [me.troop!.id],
    );
  });

export const addMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(memberEmailSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("إضافة الأعضاء للمسؤول فقط");
    if (me.troop.status !== "active" || !subIsLive(me.subscription)) {
      throw new Error("إضافة الأعضاء تحتاج اشتراكاً فعّالاً");
    }
    const maxMembers = me.subscription?.maxMembers ?? 0;
    if (me.counts.members >= maxMembers) throw new Error("بلغت حد الأعضاء في الباقة");
    const users = await sql<{ id: string }>`
      select id from "user" where lower(email) = lower(${data.email}) limit 1
    `;
    const target = users[0];
    if (!target) throw new Error("لا يوجد حساب بهذا البريد. اطلب من العضو التسجيل أولاً");
    if (target.id === context.userId) throw new Error("أنت عضو بالفعل");
    const busy = await sql<{ id: string }>`
      select id from profiles where id = ${target.id} and troop_id is not null limit 1
    `;
    if (busy[0]) throw new Error("هذا الحساب مرتبط بفوج آخر");
    await ensureProfile(sql, target.id);
    try {
      const linked = await sql<{ id: string }>`
        update profiles
        set troop_id = ${me.troop.id}::uuid, role = 'member'
        where id = ${target.id} and troop_id is null
        returning id
      `;
      if (!linked[0]) throw new Error("تعذّرت إضافة العضو");
    } catch (error) {
      dbError(error);
    }
    return { ok: true as const };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(memberIdSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    if (me.troop.role !== "troop_manager") throw new Error("إخراج الأعضاء للمسؤول فقط");
    if (data.userId === context.userId) throw new Error("لا يمكن إخراج مسؤول الفوج");
    const removed = await sql<{ id: string }>`
      update profiles
      set troop_id = null
      where id = ${data.userId}
        and troop_id = ${me.troop.id}::uuid
        and role = 'member'
      returning id
    `;
    if (!removed[0]) throw new Error("العضو غير موجود في هذا الفوج");
    return { ok: true as const };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = await requireManager(sql, context.userId);
    return sql<{ id: string; name: string; email: string; role: string }>`
      select u.id, u.name, u.email, p.role
      from profiles p
      join "user" u on u.id = p.id
      where p.troop_id = ${me.troop.id}::uuid and p.is_active
      order by p.created_at
    `;
  });

export const listInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const empty: {
      id: string;
      message: string;
      createdAt: string;
      fromName: string;
      productTitle: string;
    }[] = [];
    return empty;
  });

export const getListingContact = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(productRefSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const mine = await sql<{ troopId: string | null }>`
      select troop_id as "troopId" from profiles where id = ${context.userId} limit 1
    `;
    if (!mine[0]?.troopId) return { status: "need_troop" as const };
    const rows = await sql.query<{ phone: string; email: string }>(
      `select coalesce(t.contact_phone, '') as phone, coalesce(t.contact_email, '') as email
       from products p
       join troops t on t.id = p.troop_id
       where p.id = $1::uuid and ${visibleListing}`,
      [data.productId],
    );
    const row = rows[0];
    if (!row) return { status: "gone" as const };
    return { status: "ok" as const, phone: row.phone, email: row.email };
  });

export const sendReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(reportSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const rows = await sql.query<{ troopId: string }>(
      `select p.troop_id as "troopId"
       from products p
       join troops t on t.id = p.troop_id
       where p.id = $1::uuid and ${visibleListing}`,
      [data.productId],
    );
    const row = rows[0];
    if (!row) throw new Error("الإعلان غير متاح");
    const mine = await sql<{ troopId: string | null }>`
      select troop_id as "troopId" from profiles where id = ${context.userId} limit 1
    `;
    if (mine[0]?.troopId && mine[0].troopId === row.troopId) {
      throw new Error("لا يمكنك الإبلاغ عن إعلان فوجك");
    }
    try {
      await sql`
        insert into reports (id, product_id, reporter_id, reason, details)
        values (
          ${id()}::uuid, ${data.productId}::uuid, ${context.userId},
          ${data.reason}::report_reason, ${data.note}
        )
      `;
    } catch (error) {
      dbError(error);
    }
    return { ok: true as const };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    return { ok: true };
  });

async function requireAdmin(sql: Sql, userId: string) {
  await ensureProfile(sql, userId);
  try {
    await requireRole(sql, userId, "admin");
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      throw new Error("ليست لديك صلاحية الإدارة");
    }
    throw error;
  }
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    parse(z.object({ locale: z.enum(["ar", "fr"]).optional() }), data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const troops =
      data.locale === "fr"
        ? await sql<{
            id: string;
            name: string;
            wilayaName: string;
            status: string;
            members: number;
            pendingSubId: string | null;
          }>`
            select t.id, t.name, w.name_fr as "wilayaName", t.status,
              (select count(*)::int from profiles m where m.troop_id = t.id and m.is_active) as members,
              (
                select s.id from subscriptions s
                where s.troop_id = t.id and s.status = 'pending'
                order by s.created_at desc
                limit 1
              ) as "pendingSubId"
            from troops t
            join wilayas w on w.id = t.wilaya_id
            order by t.created_at desc
          `
        : await sql<{
            id: string;
            name: string;
            wilayaName: string;
            status: string;
            members: number;
            pendingSubId: string | null;
          }>`
            select t.id, t.name, w.name_ar as "wilayaName", t.status,
              (select count(*)::int from profiles m where m.troop_id = t.id and m.is_active) as members,
              (
                select s.id from subscriptions s
                where s.troop_id = t.id and s.status = 'pending'
                order by s.created_at desc
                limit 1
              ) as "pendingSubId"
            from troops t
            join wilayas w on w.id = t.wilaya_id
            order by t.created_at desc
          `;
    const subs = await sql<{
      id: string;
      troopId: string;
      troopName: string;
      status: string;
      price: string;
      proof: string;
      maxMembers: number;
      maxProducts: number;
      endsOn: string | null;
    }>`
      select s.id, s.troop_id as "troopId", t.name as "troopName", s.status,
        s.price_dzd::text as price, s.payment_note as proof, s.max_members as "maxMembers",
        s.max_products as "maxProducts",
        to_char(s.ends_at at time zone 'UTC', 'YYYY-MM-DD') as "endsOn"
      from subscriptions s
      join troops t on t.id = s.troop_id
      order by s.created_at desc
    `;
    const products = await sql<{ id: string; title: string; troopName: string; status: string; visibility: string }>`
      select p.id, p.title, t.name as "troopName", p.status, p.visibility
      from products p join troops t on t.id = p.troop_id
      order by p.created_at desc
    `;
    const reports = await sql<{
      id: string;
      reason: string;
      note: string;
      status: string;
      productId: string;
      productTitle: string;
      productStatus: string;
      productVisibility: string;
    }>`
      select r.id, r.reason, r.details as note, r.status,
        p.id as "productId", p.title as "productTitle", p.status as "productStatus",
        p.visibility as "productVisibility"
      from reports r join products p on p.id = r.product_id
      order by r.created_at desc
    `;
    const plan = await sql<Plan>`
      select id, name, price_dzd::text as price,
        duration_days as "durationDays", max_members as "maxMembers",
        max_products as "maxProducts"
      from plans where is_active = true order by price_dzd limit 1
    `;
    return {
      troops,
      subs,
      products,
      reports,
      plan: plan[0] ?? null,
    };
  });

export const adminSetTroopStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; status: "active" | "suspended" | "pending" }) =>
    parse(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["active", "suspended", "pending"]),
      }),
      data,
    ),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`update troops set status = ${data.status}::troop_status where id = ${data.id}::uuid`;
    return { ok: true };
  });

export const adminActivateSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid() }), data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{ troopId: string }>`
      with expired as (
        update subscriptions
        set status = 'expired'
        where troop_id = (select troop_id from subscriptions where id = ${data.id}::uuid)
          and status = 'active'
          and id <> ${data.id}::uuid
      )
      update subscriptions s
      set status = 'active',
          starts_at = now(),
          ends_at = now() + make_interval(days => p.duration_days),
          approved_by = ${context.userId},
          approved_at = now()
      from plans p
      where s.id = ${data.id}::uuid
        and p.id = s.plan_id
      returning s.troop_id as "troopId"
    `;
    const row = rows[0];
    if (!row) throw new Error("الاشتراك غير موجود");
    await sql`update troops set status = 'active' where id = ${row.troopId}::uuid`;
    return { ok: true };
  });

export const adminHideProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid(), hidden: z.boolean() }), data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{ id: string }>`
      update products set visibility = ${data.hidden ? "hidden" : "public"}::product_visibility
      where id = ${data.id}::uuid
      returning id
    `;
    if (!rows[0]) throw new Error("المنتج غير موجود");
    return { ok: true as const };
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid() }), data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const rows = await sql<{ id: string }>`
      update reports
      set status = 'resolved', handled_by = ${context.userId}, handled_at = now()
      where id = ${data.id}::uuid and status = 'open'
      returning id
    `;
    if (!rows[0]) throw new Error("البلاغ غير موجود");
    return { ok: true as const };
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(planSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await sql`
      update plans set
        price_dzd = ${data.price},
        duration_days = ${data.durationDays},
        max_members = ${data.maxMembers},
        max_products = ${data.maxProducts}
      where is_active = true
    `;
    return { ok: true };
  });
