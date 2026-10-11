import { translate, type Locale } from "@/lib/i18n";

export function clipText(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function shareMeta({
  locale,
  title,
  description,
  path,
  origin,
  type = "website",
}: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  origin: string;
  type?: "website" | "product";
}) {
  const brand = translate(locale, "meta.title");
  const fullTitle = title === brand ? title : `${title} · ${brand}`;
  const summary = clipText(description);
  const base = origin.replace(/\/$/, "");
  const url = base ? `${base}${path}` : "";
  const image = base ? `${base}/og.jpg` : "";
  const meta: Array<{ title: string } | { name: string; content: string } | { property: string; content: string }> = [
    { title: fullTitle },
    { name: "description", content: summary },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: summary },
    { property: "og:type", content: type },
    { property: "og:locale", content: locale === "fr" ? "fr_FR" : "ar_DZ" },
  ];
  if (url) meta.push({ property: "og:url", content: url });
  if (image) meta.push({ property: "og:image", content: image });
  return { meta };
}
