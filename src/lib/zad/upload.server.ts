import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getRequest } from "@tanstack/react-start/server";
import { getSql, type Sql } from "@/lib/db";

export const maxImagesPerProduct = 5;
const maxBytes = 5_000_000;
const ttlMs = 10 * 60 * 1000;

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageContentType = keyof typeof extensions;

type Ticket = {
  productId: string;
  userId: string;
  path: string;
  contentType: ImageContentType;
  exp: number;
};

const secretRef = globalThis as { __zadUploadSecret?: string };

function uploadSecret() {
  const configured = process.env.UPLOAD_SIGNING_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (configured) return configured;
  secretRef.__zadUploadSecret ??= randomBytes(32).toString("hex");
  return secretRef.__zadUploadSecret;
}

function sign(ticket: Ticket) {
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const mac = createHmac("sha256", uploadSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyProductImageUpload(token: string): Ticket {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new Error("رابط الرفع غير صالح");
  const expected = createHmac("sha256", uploadSecret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("رابط الرفع غير صالح");
  }
  const ticket = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Ticket;
  if (!ticket.exp || ticket.exp < Date.now()) throw new Error("انتهت صلاحية رابط الرفع");
  if (!extensions[ticket.contentType]) throw new Error("نوع الملف غير مقبول");
  if (!/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(ticket.path)) {
    throw new Error("رابط الرفع غير صالح");
  }
  return ticket;
}

function requestOrigin() {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    const configured = process.env.BETTER_AUTH_URL?.trim();
    if (!configured) return "";
    return new URL(configured).origin;
  }
}

const storedPath = /^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function replaceProductImages(sql: Sql, productId: string, images: string[]) {
  const current = await sql<{ storagePath: string }>`
    select storage_path as "storagePath"
    from product_images
    where product_id = ${productId}::uuid
  `;
  const owned = new Set(current.map((row) => row.storagePath));
  const next: string[] = [];
  for (const image of images) {
    if (storedPath.test(image)) {
      if (!owned.has(image)) throw new Error("صورة غير صالحة");
      next.push(image);
      continue;
    }
    const match = image.match(/^data:image\/jpeg;base64,([a-z0-9+/]+={0,2})$/i);
    if (!match?.[1]) throw new Error("نوع الملف غير مقبول");
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length < 1 || bytes.length > maxBytes) throw new Error("حجم الصورة غير صالح");
    const path = `products/${productId}/${randomUUID()}.jpg`;
    const file = join(process.cwd(), "storage", "product-images", path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, bytes);
    next.push(path);
  }
  await sql`delete from product_images where product_id = ${productId}::uuid`;
  for (let index = 0; index < next.length; index += 1) {
    await sql`
      insert into product_images (product_id, storage_path, sort_order)
      values (${productId}::uuid, ${next[index]}, ${index})
    `;
  }
  for (const path of owned) {
    if (!next.includes(path)) {
      await unlink(join(process.cwd(), "storage", "product-images", path)).catch(() => undefined);
    }
  }
}

export async function openProductImage(path: string) {
  if (!storedPath.test(path)) return null;
  const sql = await getSql();
  const rows = await sql<{ storagePath: string }>`
    select storage_path as "storagePath"
    from product_images
    where storage_path = ${path}
    limit 1
  `;
  if (!rows[0]) return null;
  try {
    const bytes = await readFile(join(process.cwd(), "storage", "product-images", path));
    const type = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { bytes, type };
  } catch {
    return null;
  }
}

export async function issueProductImageUpload(
  userId: string,
  productId: string,
  contentType: ImageContentType,
) {
  const sql = await getSql();
  await assertImageSlot(sql, userId, productId);
  const path = `products/${productId}/${randomUUID()}.${extensions[contentType]}`;
  const exp = Date.now() + ttlMs;
  const token = sign({ productId, userId, path, contentType, exp });
  const origin = requestOrigin();
  const url = `${origin}/api/product-images/upload?token=${encodeURIComponent(token)}`;
  return {
    url,
    method: "PUT" as const,
    path,
    contentType,
    expiresAt: new Date(exp).toISOString(),
  };
}

export async function saveSignedProductImage(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ticket = verifyProductImageUpload(token);
  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (type !== ticket.contentType) throw new Error("نوع الملف غير مقبول");
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length < 1 || bytes.length > maxBytes) throw new Error("حجم الصورة غير صالح");
  const sql = await getSql();
  await assertImageSlot(sql, ticket.userId, ticket.productId);
  const file = join(process.cwd(), "storage", "product-images", ticket.path);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, bytes);
  try {
    const rows = await sql<{ id: string }>`
      with locked as (
        select id from products where id = ${ticket.productId}::uuid for update
      )
      insert into product_images (product_id, storage_path, sort_order)
      select locked.id, ${ticket.path}, (
        select count(*)::int from product_images where product_id = locked.id
      )
      from locked
      returning id
    `;
    if (!rows[0]) throw new Error("تعذّر حفظ الصورة");
    return { path: ticket.path };
  } catch (error) {
    await unlink(file).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("LIMIT_IMAGES")) throw new Error("الحد خمس صور للمنتج");
    throw error;
  }
}

async function assertImageSlot(sql: Sql, userId: string, productId: string) {
  const rows = await sql<{
    visibility: string;
    productCount: number;
    maxProducts: number | null;
    images: number;
  }>`
    select p.visibility,
      (select count(*)::int from products where troop_id = t.id) as "productCount",
      (
        select s.max_products
        from subscriptions s
        where s.troop_id = t.id
          and s.status = 'active'
          and s.starts_at <= now()
          and s.ends_at > now()
        order by s.ends_at desc
        limit 1
      ) as "maxProducts",
      (select count(*)::int from product_images where product_id = p.id) as images
    from products p
    join troops t on t.id = p.troop_id and t.status = 'active'
    join profiles pr on pr.troop_id = t.id
      and pr.id = ${userId}
      and pr.is_active
      and pr.role = 'troop_manager'
    where p.id = ${productId}::uuid
  `;
  const row = rows[0];
  if (!row) throw new Error("رفع الصور لمسؤول فوج باشتراك فعّال فقط");
  if (row.visibility === "hidden") throw new Error("الإعلان مخفي من الإدارة");
  if (row.maxProducts == null) throw new Error("النشر يحتاج اشتراكاً فعّالاً");
  if (row.productCount > row.maxProducts) throw new Error("بلغت حد المنتجات في الباقة");
  if (row.images >= maxImagesPerProduct) throw new Error("الحد خمس صور للمنتج");
}
