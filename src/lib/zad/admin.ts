import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requireRole } from "@/lib/zad/access";
import type { Plan } from "@/lib/zad/types";

const pageSize = 8;
const noteField = z.string().trim().min(1).max(500);

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("بيانات غير صالحة");
  return result.data;
}

async function requireAdmin(userId: string) {
  const sql = await getSql();
  try {
    await requireRole(sql, userId, "admin");
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      throw new Error("ليست لديك صلاحية الإدارة");
    }
    throw error;
  }
  return sql;
}

const adminPageSchema = z.object({
  resource: z.enum(["troops", "subs", "products", "reports"]),
  q: z.string().trim().max(80).optional(),
  status: z.string().trim().max(20).optional(),
  page: z.number().int().min(1).max(500).optional(),
  locale: z.enum(["ar", "fr"]).optional(),
});

export const adminPage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(adminPageSchema, data))
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await sql`select expire_subscriptions()`;
    const q = (data.q ?? "").replace(/[%_\\]/g, "");
    const status = !data.status || data.status === "all" ? "" : data.status;
    const page = data.page ?? 1;
    const locale = data.locale === "fr" ? "fr" : "ar";
    const wilaya = locale === "fr" ? "name_fr" : "name_ar";
    const offset = (page - 1) * pageSize;
    if (data.resource === "troops") {
      const rows = await sql.query<
        {
          id: string | null;
          name: string | null;
          wilayaName: string | null;
          status: string | null;
          members: number | null;
          pendingSubId: string | null;
          total: number;
        }
      >(
        `with filtered as (
           select t.id, t.name, w.${wilaya} as "wilayaName", t.status,
             (select count(*)::int from profiles m where m.troop_id = t.id and m.is_active) as members,
             (
               select s.id from subscriptions s
               where s.troop_id = t.id and s.status = 'pending'
               order by s.created_at desc limit 1
             ) as "pendingSubId",
             t.created_at
           from troops t
           join wilayas w on w.id = t.wilaya_id
           where ($1 = '' or t.name ilike $2 or w.name_ar ilike $2 or w.name_fr ilike $2)
             and ($3 = '' or t.status::text = $3)
         )
         select f.id, f.name, f."wilayaName", f.status, f.members, f."pendingSubId", c.total
         from (select count(*)::int as total from filtered) c
         left join lateral (
           select * from filtered order by created_at desc limit $4 offset $5
         ) f on true`,
        [q, `%${q}%`, status, pageSize, offset],
      );
      return {
        total: rows[0]?.total ?? 0,
        pageSize,
        troops: rows.flatMap((row) =>
          row.id && row.name && row.wilayaName && row.status && row.members != null
            ? [
                {
                  id: row.id,
                  name: row.name,
                  wilayaName: row.wilayaName,
                  status: row.status,
                  members: row.members,
                  pendingSubId: row.pendingSubId,
                },
              ]
            : [],
        ),
        subs: [],
        products: [],
        reports: [],
      };
    }
    if (data.resource === "subs") {
      const rows = await sql.query<
        {
          id: string | null;
          troopId: string | null;
          troopName: string | null;
          status: string | null;
          price: string | null;
          proof: string | null;
          adminNote: string | null;
          maxMembers: number | null;
          maxProducts: number | null;
          startsOn: string | null;
          endsOn: string | null;
          paidAt: string | null;
          total: number;
        }
      >(
        `with filtered as (
           select s.id, s.troop_id as "troopId", t.name as "troopName", s.status,
             s.price_dzd::text as price, s.payment_note as proof, s.admin_note as "adminNote",
             s.max_members as "maxMembers", s.max_products as "maxProducts",
             to_char(s.starts_at at time zone 'UTC', 'YYYY-MM-DD') as "startsOn",
             to_char(s.ends_at at time zone 'UTC', 'YYYY-MM-DD') as "endsOn",
             to_char(s.paid_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "paidAt",
             s.created_at
           from subscriptions s
           join troops t on t.id = s.troop_id
           where ($1 = '' or t.name ilike $2)
             and ($3 = '' or s.status::text = $3)
         )
         select f.id, f."troopId", f."troopName", f.status, f.price, f.proof, f."adminNote",
           f."maxMembers", f."maxProducts", f."startsOn", f."endsOn", f."paidAt", c.total
         from (select count(*)::int as total from filtered) c
         left join lateral (
           select * from filtered order by created_at desc limit $4 offset $5
         ) f on true`,
        [q, `%${q}%`, status, pageSize, offset],
      );
      return {
        total: rows[0]?.total ?? 0,
        pageSize,
        troops: [],
        subs: rows.flatMap((row) =>
          row.id && row.troopId && row.troopName && row.status && row.price && row.maxMembers != null && row.maxProducts != null
            ? [
                {
                  id: row.id,
                  troopId: row.troopId,
                  troopName: row.troopName,
                  status: row.status,
                  price: row.price,
                  proof: row.proof ?? "",
                  adminNote: row.adminNote ?? "",
                  maxMembers: row.maxMembers,
                  maxProducts: row.maxProducts,
                  startsOn: row.startsOn,
                  endsOn: row.endsOn,
                  paidAt: row.paidAt,
                },
              ]
            : [],
        ),
        products: [],
        reports: [],
      };
    }
    if (data.resource === "products") {
      const rows = await sql.query<
        {
          id: string | null;
          title: string | null;
          troopName: string | null;
          status: string | null;
          visibility: string | null;
          total: number;
        }
      >(
        `with filtered as (
           select p.id, p.title, t.name as "troopName", p.status, p.visibility, p.created_at
           from products p
           join troops t on t.id = p.troop_id
           where ($1 = '' or p.title ilike $2 or t.name ilike $2)
             and (
               $3 = ''
               or ($3 = 'hidden' and p.visibility = 'hidden')
               or ($3 <> 'hidden' and p.status::text = $3 and p.visibility <> 'hidden')
             )
         )
         select f.id, f.title, f."troopName", f.status, f.visibility, c.total
         from (select count(*)::int as total from filtered) c
         left join lateral (
           select * from filtered order by created_at desc limit $4 offset $5
         ) f on true`,
        [q, `%${q}%`, status, pageSize, offset],
      );
      return {
        total: rows[0]?.total ?? 0,
        pageSize,
        troops: [],
        subs: [],
        products: rows.flatMap((row) =>
          row.id && row.title && row.troopName && row.status && row.visibility
            ? [{ id: row.id, title: row.title, troopName: row.troopName, status: row.status, visibility: row.visibility }]
            : [],
        ),
        reports: [],
      };
    }
    const rows = await sql.query<
      {
        id: string | null;
        reason: string | null;
        note: string | null;
        adminNote: string | null;
        status: string | null;
        productId: string | null;
        productTitle: string | null;
        productStatus: string | null;
        productVisibility: string | null;
        total: number;
      }
    >(
      `with filtered as (
         select r.id, r.reason, r.details as note, r.admin_note as "adminNote", r.status,
           p.id as "productId", p.title as "productTitle", p.status as "productStatus",
           p.visibility as "productVisibility", r.created_at
         from reports r
         join products p on p.id = r.product_id
         where ($1 = '' or p.title ilike $2 or r.details ilike $2 or r.admin_note ilike $2)
           and ($3 = '' or r.status::text = $3)
       )
       select f.id, f.reason, f.note, f."adminNote", f.status, f."productId", f."productTitle",
         f."productStatus", f."productVisibility", c.total
       from (select count(*)::int as total from filtered) c
       left join lateral (
         select * from filtered order by created_at desc limit $4 offset $5
       ) f on true`,
      [q, `%${q}%`, status, pageSize, offset],
    );
    return {
      total: rows[0]?.total ?? 0,
      pageSize,
      troops: [],
      subs: [],
      products: [],
      reports: rows.flatMap((row) =>
        row.id && row.reason && row.status && row.productId && row.productTitle && row.productVisibility
          ? [
              {
                id: row.id,
                reason: row.reason,
                note: row.note ?? "",
                adminNote: row.adminNote ?? "",
                status: row.status,
                productId: row.productId,
                productTitle: row.productTitle,
                productStatus: row.productStatus ?? "",
                productVisibility: row.productVisibility,
              },
            ]
          : [],
      ),
    };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ locale: z.enum(["ar", "fr"]).optional() }), data ?? {}))
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    await sql`select expire_subscriptions()`;
    const name = data.locale === "fr" ? "name_fr" : "name_ar";
    const [headline] = await sql<
      {
        troops: number;
        products: number;
        pendingTroops: number;
        activeTroops: number;
        paid: number;
        billable: number;
        renewed: number;
        expiredTroops: number;
        searches: number;
        contacts: number;
      }
    >`
      select
        (select count(*)::int from troops) as troops,
        (select count(*)::int from products) as products,
        (select count(*)::int from troops where status = 'pending') as "pendingTroops",
        (select count(*)::int from troops t
          where t.status = 'active'
            and exists (
              select 1 from subscriptions s
              where s.troop_id = t.id and s.status = 'active'
                and s.starts_at <= now() and s.ends_at > now()
            )
        ) as "activeTroops",
        (select count(*)::int from subscriptions
          where paid_at is not null and status in ('active', 'expired', 'suspended')
        ) as paid,
        (select count(*)::int from subscriptions
          where status in ('active', 'expired', 'suspended')
        ) as billable,
        (select count(*)::int from (
          select troop_id from subscriptions where status = 'expired' group by troop_id
        ) finished
          where exists (
            select 1 from subscriptions s
            where s.troop_id = finished.troop_id
              and s.status in ('active', 'suspended', 'expired')
              and s.created_at > (
                select min(x.created_at) from subscriptions x
                where x.troop_id = finished.troop_id and x.status = 'expired'
              )
          )
        ) as renewed,
        (select count(*)::int from (
          select troop_id from subscriptions where status = 'expired' group by troop_id
        ) finished) as "expiredTroops",
        coalesce((select value from platform_counters where key = 'search'), 0)::int as searches,
        coalesce((select value from platform_counters where key = 'contact'), 0)::int as contacts
    `;
    const categories = await sql.query<{ name: string; count: number }>(
      `select c.${name} as name, count(p.id)::int as count
       from categories c
       left join products p on p.category_id = c.id
       group by c.id
       order by count desc, c.sort_order
       limit 5`,
    );
    const wilayas = await sql.query<{ name: string; count: number }>(
      `select w.${name} as name, count(t.id)::int as count
       from wilayas w
       join troops t on t.wilaya_id = w.id
       group by w.id
       order by count desc, w.id
       limit 5`,
    );
    const reportRows = await sql<{ status: string; count: number }>`
      select status::text as status, count(*)::int as count
      from reports
      group by status
    `;
    const reports = { open: 0, resolved: 0, dismissed: 0, total: 0 };
    for (const row of reportRows) {
      if (row.status === "open" || row.status === "resolved" || row.status === "dismissed") {
        reports[row.status] = row.count;
      }
      reports.total += row.count;
    }
    const plan = await sql<Plan>`
      select id, name, price_dzd::text as price,
        duration_days as "durationDays", max_members as "maxMembers",
        max_products as "maxProducts"
      from plans where is_active = true order by price_dzd limit 1
    `;
    const paid = headline?.paid ?? 0;
    const billable = headline?.billable ?? 0;
    const renewed = headline?.renewed ?? 0;
    const expiredTroops = headline?.expiredTroops ?? 0;
    return {
      troops: headline?.troops ?? 0,
      products: headline?.products ?? 0,
      pendingTroops: headline?.pendingTroops ?? 0,
      activeTroops: headline?.activeTroops ?? 0,
      searches: headline?.searches ?? 0,
      contacts: headline?.contacts ?? 0,
      paid,
      billable,
      paymentRate: billable ? Math.round((paid / billable) * 100) : null,
      renewed,
      expiredTroops,
      renewalRate: expiredTroops ? Math.round((renewed / expiredTroops) * 100) : null,
      categories,
      wilayas,
      reports,
      plan: plan[0] ?? null,
    };
  });

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(40),
  nameAr: z.string().trim().min(2).max(80),
  nameFr: z.string().trim().min(2).max(80),
  isActive: z.boolean(),
});

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await requireAdmin(context.userId);
    return sql<{
      id: string;
      slug: string;
      nameAr: string;
      nameFr: string;
      sortOrder: number;
      isActive: boolean;
      products: number;
    }>`
      select c.id, c.slug, c.name_ar as "nameAr", c.name_fr as "nameFr",
        c.sort_order as "sortOrder", c.is_active as "isActive",
        (select count(*)::int from products p where p.category_id = c.id) as products
      from categories c
      order by c.sort_order, c.name_ar
    `;
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(categorySchema, data))
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    try {
      if (data.id) {
        const rows = await sql<{ id: string }>`
          update categories set
            slug = ${data.slug},
            name_ar = ${data.nameAr},
            name_fr = ${data.nameFr},
            is_active = ${data.isActive}
          where id = ${data.id}::uuid
          returning id
        `;
        if (!rows[0]) throw new Error("التصنيف غير موجود");
      } else {
        await sql`
          insert into categories (slug, name_ar, name_fr, is_active, sort_order)
          values (
            ${data.slug}, ${data.nameAr}, ${data.nameFr}, ${data.isActive},
            coalesce((select max(sort_order) + 1 from categories), 0)
          )
        `;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "23505" || message.includes("duplicate") || message.includes("unique")) {
        throw new Error("هذا السجل موجود مسبقاً");
      }
      throw error;
    }
    return { ok: true as const };
  });

export const adminReorderCategories = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }), data))
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const existing = await sql<{ id: string }>`select id from categories`;
    if (existing.length !== data.ids.length || new Set(data.ids).size !== data.ids.length) {
      throw new Error("ترتيب التصنيفات غير مكتمل");
    }
    const known = new Set(existing.map((row) => row.id));
    if (data.ids.some((id) => !known.has(id))) throw new Error("ترتيب التصنيفات غير مكتمل");
    const values = data.ids.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::int)`).join(", ");
    const params = data.ids.flatMap((id, index) => [id, index]);
    await sql.query(
      `update categories as c
       set sort_order = v.sort_order
       from (values ${values}) as v(id, sort_order)
       where c.id = v.id`,
      params,
    );
    return { ok: true as const };
  });

export const adminDismissReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid(), note: noteField }), data))
  .handler(async ({ context, data }) => {
    const sql = await requireAdmin(context.userId);
    const rows = await sql<{ id: string }>`
      update reports
      set status = 'dismissed',
          admin_note = ${data.note},
          handled_by = ${context.userId},
          handled_at = now()
      where id = ${data.id}::uuid and status = 'open'
      returning id
    `;
    if (!rows[0]) throw new Error("البلاغ غير موجود");
    return { ok: true as const };
  });
