import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "@/lib/db";
import { pendingMigrations } from "../../../scripts/migration-plan.mjs";
import { requireRole, requireTroop } from "./access.ts";
import { visibleListing } from "./visibility.ts";

/**
 * Rules that must hold even when the app connects as a superuser:
 * subscription triggers, the public catalog predicate, and admin checks.
 * Uses an embedded database. Does not read DATABASE_URL.
 */

let pg: PGlite;
let seq = 0;

function troopUuid(n: number) {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

async function q<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
  const result = await pg.query<T>(text, params);
  return result.rows;
}

async function expectDbError(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, new RegExp(code));
    return true;
  });
}

async function makeTroop(label: string, status: "pending" | "active" | "suspended" = "active") {
  seq += 1;
  const userId = `rules-${label}`;
  const troopId = troopUuid(seq);
  await q(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, true, now(), now())`,
    [userId, label, `${userId}@rules.test`],
  );
  await q(
    `insert into troops (id, name, wilaya_id, municipality, status)
     values ($1::uuid, $2, 16, 'الجزائر', $3::troop_status)`,
    [troopId, label, status],
  );
  await q(
    `insert into profiles (id, troop_id, full_name, role)
     values ($1, $2::uuid, $3, 'troop_manager')`,
    [userId, troopId, label],
  );
  return { userId, troopId };
}

async function subscribe(
  troopId: string,
  options: { maxMembers?: number; maxProducts?: number; ends?: "future" | "past"; status?: string } = {},
) {
  const ends = options.ends === "past" ? "now() - interval '1 hour'" : "now() + interval '30 days'";
  const status = options.status ?? "active";
  await q(
    `insert into subscriptions (
       troop_id, plan_id, price_dzd, max_members, max_products, status, starts_at, ends_at
     )
     select $1::uuid, p.id, p.price_dzd, $2, $3, $4::subscription_status,
       now() - interval '1 day', ${ends}
     from plans p
     where p.is_active
     order by p.price_dzd
     limit 1`,
    [troopId, options.maxMembers ?? 10, options.maxProducts ?? 30, status],
  );
}

async function addProduct(
  troop: { userId: string; troopId: string },
  options: { title: string; visibility?: string; status?: string } ,
) {
  const rows = await q<{ id: string }>(
    `insert into products (
       troop_id, created_by, category_id, title, description, listing_type, condition,
       price_dzd, wilaya_id, visibility, status, published_at
     )
     select $1::uuid, $2, c.id, $3, 'وصف للاختبار', 'sale', 'new', 1500, 16,
       $4::product_visibility, $5::product_status, now()
     from categories c
     where c.slug = 'tents'
     returning id`,
    [troop.troopId, troop.userId, options.title, options.visibility ?? "public", options.status ?? "active"],
  );
  return rows[0].id;
}

async function addMember(troopId: string, label: string) {
  const userId = `rules-member-${label}`;
  await q(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, true, now(), now())`,
    [userId, label, `${userId}@rules.test`],
  );
  await q(
    `insert into profiles (id, troop_id, full_name, role)
     values ($1, $2::uuid, $3, 'member')`,
    [userId, troopId, label],
  );
  return userId;
}

async function catalogTitles() {
  const rows = await q<{ title: string }>(
    `select p.title
     from products p
     join troops t on t.id = p.troop_id
     where ${visibleListing}
       and p.title like 'rule-%'
     order by p.title`,
  );
  return rows.map((row) => row.title);
}

async function titlesAs(userId: string | null) {
  return pg.transaction(async (tx) => {
    await tx.exec("set local role zad_visitor");
    if (userId) await tx.query("select set_config('app.user_id', $1, true)", [userId]);
    const rows = await tx.query<{ title: string }>(
      "select title from products where title like 'rule-%' order by title",
    );
    return rows.rows.map((row) => row.title);
  });
}

describe("subscription limits, visibility, and admin permissions", { concurrency: 1 }, () => {
  before(async () => {
    pg = new PGlite();
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const dir = join(import.meta.dirname, "../../..", "migrations");
    const pending = pendingMigrations(
      (await readdir(dir)).map((name) => join(dir, name)),
      [],
    );
    for (const file of pending) {
      const text = await readFile(file.path, "utf8");
      try {
        await pg.transaction(async (tx) => {
          await tx.exec(text);
          await tx.query("insert into _migrations (name) values ($1)", [file.name]);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${file.name}: ${message}`);
      }
    }
    await pg.exec("create role zad_visitor nologin nosuperuser nobypassrls");
    await pg.exec("grant usage on schema public to zad_visitor");
    await pg.exec("grant select, insert, update, delete on all tables in schema public to zad_visitor");
  });

  after(async () => {
    await pg.close();
  });

  it("lets the founding manager join before any subscription", async () => {
    const troop = await makeTroop("founder");
    const rows = await q<{ role: string }>("select role from profiles where id = $1", [troop.userId]);
    assert.equal(rows[0]?.role, "troop_manager");
  });

  it("refuses products and extra members without a live subscription", async () => {
    const troop = await makeTroop("nosub");
    await expectDbError(
      () => addProduct(troop, { title: "rule-nosub" }),
      "NO_ACTIVE_SUBSCRIPTION",
    );
    await expectDbError(() => addMember(troop.troopId, "nosub"), "NO_ACTIVE_SUBSCRIPTION");

    await subscribe(troop.troopId, { status: "pending", maxProducts: 5, maxMembers: 5 });
    await expectDbError(
      () => addProduct(troop, { title: "rule-pending-sub" }),
      "NO_ACTIVE_SUBSCRIPTION",
    );

    const dated = await makeTroop("dated");
    await subscribe(dated.troopId, { ends: "past" });
    await expectDbError(
      () => addProduct(dated, { title: "rule-expired-sub" }),
      "NO_ACTIVE_SUBSCRIPTION",
    );
  });

  it("stops at max_products, counting hidden listings", async () => {
    const troop = await makeTroop("products");
    await subscribe(troop.troopId, { maxProducts: 2, maxMembers: 5 });
    await addProduct(troop, { title: "rule-cap-public" });
    await addProduct(troop, { title: "rule-cap-hidden", visibility: "hidden" });
    await expectDbError(
      () => addProduct(troop, { title: "rule-cap-over" }),
      "LIMIT_PRODUCTS",
    );
    const rows = await q<{ n: number }>(
      "select count(*)::int as n from products where troop_id = $1::uuid",
      [troop.troopId],
    );
    assert.equal(rows[0]?.n, 2);
  });

  it("stops at max_members and frees a slot when a member is deactivated", async () => {
    const troop = await makeTroop("members");
    await subscribe(troop.troopId, { maxMembers: 2, maxProducts: 5 });
    const second = await addMember(troop.troopId, "second");
    await expectDbError(() => addMember(troop.troopId, "third"), "LIMIT_MEMBERS");
    await q("update profiles set is_active = true where id = $1", [second]);
    const still = await q<{ n: number }>(
      "select count(*)::int as n from profiles where troop_id = $1::uuid and is_active",
      [troop.troopId],
    );
    assert.equal(still[0]?.n, 2);
    await q("update profiles set is_active = false where id = $1", [second]);
    const replacement = await addMember(troop.troopId, "replacement");
    const active = await q<{ id: string }>(
      "select id from profiles where troop_id = $1::uuid and is_active order by id",
      [troop.troopId],
    );
    assert.deepEqual(
      active.map((row) => row.id),
      [replacement, troop.userId].sort(),
    );
  });

  it("allows five images on a product and refuses a sixth", async () => {
    const troop = await makeTroop("images");
    await subscribe(troop.troopId, { maxProducts: 2 });
    const productId = await addProduct(troop, { title: "rule-images" });
    for (let index = 0; index < 5; index += 1) {
      await q(
        "insert into product_images (product_id, storage_path, sort_order) values ($1::uuid, $2, $3)",
        [productId, `products/${productId}/${index}.jpg`, index],
      );
    }
    await expectDbError(
      () =>
        q(
          "insert into product_images (product_id, storage_path, sort_order) values ($1::uuid, $2, 5)",
          [productId, `products/${productId}/extra.jpg`],
        ),
      "LIMIT_IMAGES",
    );
    await q("delete from product_images where product_id = $1::uuid and sort_order = 0", [productId]);
    await q(
      "insert into product_images (product_id, storage_path, sort_order) values ($1::uuid, $2, 0)",
      [productId, `products/${productId}/again.jpg`],
    );
  });

  it("shows only a public active listing of an active troop with a live subscription", async () => {
    const live = await makeTroop("catalog");
    await subscribe(live.troopId);
    await addProduct(live, { title: "rule-public-live" });
    await addProduct(live, { title: "rule-troops-only", visibility: "troops_only" });
    await addProduct(live, { title: "rule-hidden", visibility: "hidden" });
    await addProduct(live, { title: "rule-unavailable", status: "unavailable" });

    const suspended = await makeTroop("catalog-suspended");
    await subscribe(suspended.troopId);
    await addProduct(suspended, { title: "rule-suspended-troop" });
    await q("update troops set status = 'suspended' where id = $1::uuid", [suspended.troopId]);

    const lapsed = await makeTroop("catalog-lapsed");
    await subscribe(lapsed.troopId);
    await addProduct(lapsed, { title: "rule-lapsed-sub" });
    await q(
      "update subscriptions set ends_at = now() - interval '1 hour' where troop_id = $1::uuid and status = 'active'",
      [lapsed.troopId],
    );

    assert.deepEqual(await catalogTitles(), [
      "rule-cap-public",
      "rule-images",
      "rule-public-live",
    ]);
  });

  it("hides non-public listings from visitors and reveals them by role", async () => {
    const live = await q<{ id: string }>(
      "select id from profiles where id = 'rules-catalog'",
    );
    assert.equal(live[0]?.id, "rules-catalog");
    const scout = await makeTroop("scout");
    await subscribe(scout.troopId, { maxMembers: 3 });
    const memberId = await addMember(scout.troopId, "scout");
    const adminId = "rules-admin";
    await q(
      `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       values ($1, 'admin', $2, true, now(), now())`,
      [adminId, `${adminId}@rules.test`],
    );
    await q(
      "insert into profiles (id, full_name, role) values ($1, 'admin', 'admin')",
      [adminId],
    );

    assert.deepEqual(await titlesAs(null), ["rule-cap-public", "rule-images", "rule-public-live"]);
    assert.deepEqual(await titlesAs(memberId), [
      "rule-cap-public",
      "rule-images",
      "rule-public-live",
      "rule-troops-only",
    ]);
    assert.deepEqual(await titlesAs("rules-catalog"), [
      "rule-hidden",
      "rule-public-live",
      "rule-troops-only",
      "rule-unavailable",
      "rule-cap-public",
      "rule-images",
    ].sort());
    const adminTitles = await titlesAs(adminId);
    assert.deepEqual(adminTitles, [
      "rule-cap-hidden",
      "rule-cap-public",
      "rule-hidden",
      "rule-images",
      "rule-lapsed-sub",
      "rule-public-live",
      "rule-suspended-troop",
      "rule-troops-only",
      "rule-unavailable",
    ]);
  });

  it("allows only an active admin through requireRole", async () => {
    const sql = Object.assign(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = strings[0] ?? "";
        for (let index = 0; index < values.length; index += 1) {
          text += `$${index + 1}${strings[index + 1] ?? ""}`;
        }
        return q(text, values);
      },
      { query: q },
    ) as Sql;
    assert.equal(await requireRole(sql, "rules-admin", "admin"), "admin");
    await expectDbError(() => requireRole(sql, "rules-catalog", "admin"), "FORBIDDEN");
    await expectDbError(() => requireRole(sql, "rules-member-scout", "admin"), "FORBIDDEN");
    await expectDbError(() => requireRole(sql, "missing-user", "admin"), "FORBIDDEN");
    await q("update profiles set is_active = false where id = 'rules-admin'");
    await expectDbError(() => requireRole(sql, "rules-admin", "admin"), "FORBIDDEN");
    await q("update profiles set is_active = true where id = 'rules-admin'");

    const troop = await requireTroop(sql, "rules-catalog");
    assert.equal(troop.role, "troop_manager");
    await expectDbError(() => requireTroop(sql, "rules-admin"), "NO_TROOP");
    await q("update profiles set is_active = false where id = 'rules-catalog'");
    await expectDbError(() => requireTroop(sql, "rules-catalog"), "NO_TROOP");
    await q("update profiles set is_active = true where id = 'rules-catalog'");
  });

  it("stops a manager from changing role or troop status, and allows an admin", async () => {
    const troop = await makeTroop("guard");
    await expectDbError(
      () =>
        pg.transaction(async (tx) => {
          await tx.query("select set_config('app.user_id', $1, true)", [troop.userId]);
          await tx.query("update profiles set role = 'admin' where id = $1", [troop.userId]);
        }),
      "FORBIDDEN_PROFILE_FIELDS",
    );
    await expectDbError(
      () =>
        pg.transaction(async (tx) => {
          await tx.query("select set_config('app.user_id', $1, true)", [troop.userId]);
          await tx.query("update troops set status = 'suspended' where id = $1::uuid", [troop.troopId]);
        }),
      "FORBIDDEN_TROOP_STATUS",
    );
    await pg.transaction(async (tx) => {
      await tx.query("select set_config('app.user_id', 'rules-admin', true)", []);
      await tx.query("update troops set status = 'suspended' where id = $1::uuid", [troop.troopId]);
    });
    const rows = await q<{ status: string }>("select status from troops where id = $1::uuid", [troop.troopId]);
    assert.equal(rows[0]?.status, "suspended");
  });

  it("lets only an admin read reports, and only the reporter file one", async () => {
    const product = await q<{ id: string }>(
      "select id from products where title = 'rule-public-live'",
    );
    const productId = product[0]?.id;
    assert.ok(productId);
    await expectDbError(
      () =>
        pg.transaction(async (tx) => {
          await tx.exec("set local role zad_visitor");
          await tx.query("select set_config('app.user_id', 'rules-member-scout', true)");
          await tx.query(
            `insert into reports (product_id, reporter_id, reason)
             values ($1::uuid, 'rules-catalog', 'other')`,
            [productId],
          );
        }),
      "row-level security",
    );
    await pg.transaction(async (tx) => {
      await tx.exec("set local role zad_visitor");
      await tx.query("select set_config('app.user_id', 'rules-member-scout', true)");
      await tx.query(
        `insert into reports (product_id, reporter_id, reason)
         values ($1::uuid, 'rules-member-scout', 'wrong_info')`,
        [productId],
      );
    });
    const asMember = await pg.transaction(async (tx) => {
      await tx.exec("set local role zad_visitor");
      await tx.query("select set_config('app.user_id', 'rules-member-scout', true)");
      const rows = await tx.query("select id from reports");
      return rows.rows.length;
    });
    assert.equal(asMember, 0);
    const asAdmin = await pg.transaction(async (tx) => {
      await tx.exec("set local role zad_visitor");
      await tx.query("select set_config('app.user_id', 'rules-admin', true)");
      const rows = await tx.query<{ reason: string }>("select reason from reports");
      return rows.rows.map((row) => row.reason);
    });
    assert.deepEqual(asAdmin, ["wrong_info"]);
  });

  it("lets a manager edit only their own troop's product", async () => {
    const own = await q<{ id: string }>("select id from products where title = 'rule-public-live'");
    const other = await q<{ id: string }>("select id from products where title = 'rule-images'");
    const changed = await pg.transaction(async (tx) => {
      await tx.exec("set local role zad_visitor");
      await tx.query("select set_config('app.user_id', 'rules-catalog', true)");
      const rows = await tx.query<{ id: string }>(
        "update products set title = 'rule-public-live-edited' where id = $1::uuid returning id",
        [own[0]?.id],
      );
      return rows.rows.length;
    });
    assert.equal(changed, 1);
    const stolen = await pg.transaction(async (tx) => {
      await tx.exec("set local role zad_visitor");
      await tx.query("select set_config('app.user_id', 'rules-catalog', true)");
      const rows = await tx.query<{ id: string }>(
        "update products set title = 'rule-stolen' where id = $1::uuid returning id",
        [other[0]?.id],
      );
      return rows.rows.length;
    });
    assert.equal(stolen, 0);
    const title = await q<{ title: string }>("select title from products where id = $1::uuid", [other[0]?.id]);
    assert.equal(title[0]?.title, "rule-images");
  });
});
