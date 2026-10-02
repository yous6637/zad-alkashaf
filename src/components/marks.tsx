import {
  Backpack,
  BriefcaseMedical,
  Compass,
  CookingPot,
  Flag,
  Hammer,
  Package,
  Shapes,
  Shirt,
  Tent,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  tents: Tent,
  bags: Backpack,
  uniform: Shirt,
  flags: Flag,
  "camp-tools": Hammer,
  cooking: CookingPot,
  activities: Shapes,
  "first-aid": BriefcaseMedical,
  navigation: Compass,
  training: Compass,
  other: Package,
};

export function CategoryMark({
  id,
  slug,
  className,
}: {
  id?: string;
  slug?: string;
  className?: string;
}) {
  const Icon = ICONS[slug ?? ""] ?? ICONS[id ?? ""] ?? Package;
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}
