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
  camp: Hammer,
  cooking: CookingPot,
  activities: Shapes,
  aid: BriefcaseMedical,
  nav: Compass,
  other: Package,
};

export function CategoryMark({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Package;
  return <Icon className={className} strokeWidth={1.5} aria-hidden="true" />;
}
