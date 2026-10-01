export const OPERATIONS = [
  { id: "sale", label: "بيع" },
  { id: "rent", label: "كراء" },
  { id: "exchange", label: "تبادل" },
  { id: "wanted", label: "طلب" },
] as const;

export const CONDITIONS = [
  { id: "new", label: "جديد" },
  { id: "used_good", label: "مستعمل بحالة جيدة" },
  { id: "needs_repair", label: "يحتاج إلى صيانة" },
] as const;

export const REPORT_REASONS = [
  { id: "wrong_info", label: "معلومات غير صحيحة" },
  { id: "inappropriate", label: "محتوى غير مناسب" },
  { id: "duplicate", label: "إعلان مكرر" },
  { id: "other", label: "سبب آخر" },
] as const;

export const TROOP_STATUS = {
  pending: "قيد المراجعة",
  active: "نشط",
  suspended: "موقوف",
} as const;

export const SUB_STATUS = {
  pending: "قيد المراجعة",
  active: "نشط",
  expired: "منتهٍ",
  suspended: "موقوف",
} as const;

export const LISTING_STATUS = {
  active: "متوفر",
  unavailable: "غير متوفر",
  hidden: "مخفي",
} as const;

export function labelOf(
  list: readonly { id: string; label: string }[],
  id: string,
) {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function formatDzd(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 0 }).format(n)} دج`;
}

export function priceLabel(item: {
  operation: string;
  salePrice: string | null;
  rentPrice: string | null;
}) {
  if (item.operation === "sale") return formatDzd(item.salePrice);
  if (item.operation === "rent") return `${formatDzd(item.rentPrice)} للكراء`;
  if (item.operation === "wanted") return "طلب";
  return "تبادل";
}
