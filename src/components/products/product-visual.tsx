import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const SCENES: Record<string, () => ReactNode> = {
  tents: TentScene,
  bags: BagScene,
  uniform: UniformScene,
  flags: FlagScene,
  "camp-tools": ToolsScene,
  cooking: StoveScene,
  activities: RopeScene,
  "first-aid": AidScene,
  navigation: CompassScene,
  training: BookScene,
};

export function ProductVisual({
  slug,
  className,
}: {
  slug?: string;
  className?: string;
}) {
  const Scene = SCENES[slug ?? ""] ?? BoxScene;
  return (
    <div className={cn("relative overflow-hidden bg-[#eef3ea]", className)}>
      <svg viewBox="0 0 320 200" className="size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="pv-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e6efe4" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" fill="url(#pv-glow)" />
        <ellipse cx="160" cy="168" rx="78" ry="14" fill="#12382c" opacity="0.08" />
        <Scene />
      </svg>
    </div>
  );
}

export function TroopCoverArt({ seed, className }: { seed: string; className?: string }) {
  const variant = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return (
    <div className={cn("size-full", className)}>
      <svg viewBox="0 0 320 200" className="size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {variant === 0 ? <MountainCover /> : variant === 1 ? <FlagCover /> : <CampCover />}
      </svg>
    </div>
  );
}

function TentScene() {
  return (
    <g>
      <path d="M92 156 L160 52 L228 156 Z" fill="#166534" />
      <path d="M160 52 L228 156 H160 Z" fill="#12382c" />
      <path d="M148 156 V94 L160 84 L172 94 V156" fill="#f5efe2" />
      <path d="M160 52 V156" stroke="#0c241c" strokeWidth="3" />
      <path d="M78 156 H242" stroke="#12382c" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function BagScene() {
  return (
    <g>
      <rect x="118" y="58" width="84" height="98" rx="16" fill="#166534" />
      <rect x="128" y="70" width="64" height="36" rx="8" fill="#12382c" />
      <path d="M132 58 C132 40 188 40 188 58" fill="none" stroke="#12382c" strokeWidth="8" />
      <rect x="148" y="118" width="24" height="18" rx="4" fill="#f5c518" />
      <circle cx="160" cy="127" r="3" fill="#12382c" />
    </g>
  );
}

function UniformScene() {
  return (
    <g>
      <path d="M118 70 L160 58 L202 70 L214 156 H106 Z" fill="#f3efe4" />
      <path d="M160 62 V156" stroke="#d9c39a" strokeWidth="2" />
      <path d="M118 70 L160 88 L202 70" fill="#166534" />
      <circle cx="138" cy="108" r="4" fill="#12382c" />
      <circle cx="138" cy="124" r="4" fill="#12382c" />
      <path d="M160 88 L214 78 L206 104 L160 108 Z" fill="#c2410c" />
    </g>
  );
}

function FlagScene() {
  return (
    <g>
      <rect x="118" y="44" width="6" height="118" rx="3" fill="#7c5a32" />
      <path d="M124 50 H214 L196 78 L214 106 H124 Z" fill="#166534" />
      <circle cx="154" cy="78" r="12" fill="#fff" />
      <path d="M154 68 L157 76 H166 L159 81 L162 89 L154 84 L146 89 L149 81 L142 76 H151 Z" fill="#12382c" />
    </g>
  );
}

function ToolsScene() {
  return (
    <g>
      <rect x="150" y="58" width="16" height="78" rx="4" fill="#7c5a32" />
      <rect x="132" y="50" width="52" height="18" rx="6" fill="#12382c" />
      <rect x="96" y="128" width="54" height="10" rx="3" fill="#c4aa7a" transform="rotate(-18 123 133)" />
      <rect x="176" y="132" width="54" height="10" rx="3" fill="#c4aa7a" transform="rotate(16 203 137)" />
    </g>
  );
}

function StoveScene() {
  return (
    <g>
      <rect x="128" y="92" width="64" height="52" rx="8" fill="#1f2937" />
      <circle cx="160" cy="118" r="16" fill="#374151" />
      <circle cx="160" cy="118" r="8" fill="#f5c518" />
      <path d="M142 92 V74 H178 V92" fill="none" stroke="#6b7280" strokeWidth="6" />
      <rect x="138" y="64" width="44" height="12" rx="6" fill="#9ca3af" />
    </g>
  );
}

function RopeScene() {
  return (
    <g>
      <path
        d="M96 70 C130 40 170 110 210 70 C230 50 246 90 228 120 C200 166 130 150 112 118 C96 92 80 92 96 70"
        fill="none"
        stroke="#c4aa7a"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M96 70 C130 40 170 110 210 70 C230 50 246 90 228 120 C200 166 130 150 112 118 C96 92 80 92 96 70"
        fill="none"
        stroke="#166534"
        strokeWidth="3"
      />
    </g>
  );
}

function AidScene() {
  return (
    <g>
      <rect x="112" y="58" width="96" height="88" rx="14" fill="#fff" stroke="#d1d5db" strokeWidth="3" />
      <rect x="146" y="78" width="28" height="48" rx="4" fill="#dc2626" />
      <rect x="128" y="96" width="64" height="28" rx="4" fill="#dc2626" />
    </g>
  );
}

function CompassScene() {
  return (
    <g>
      <circle cx="160" cy="104" r="48" fill="#fff" stroke="#166534" strokeWidth="6" />
      <circle cx="160" cy="104" r="36" fill="#e6f4ea" />
      <path d="M160 74 L168 104 L160 134 L152 104 Z" fill="#166534" />
      <path d="M160 74 L164 104 L160 88 Z" fill="#dc2626" />
      <circle cx="160" cy="104" r="5" fill="#12382c" />
    </g>
  );
}

function BookScene() {
  return (
    <g>
      <path d="M108 62 H196 C204 62 208 68 208 74 V148 H116 C110 148 108 142 108 136 Z" fill="#166534" />
      <path d="M118 70 H196 V140 H118 C114 140 112 136 112 132 V76 C112 72 114 70 118 70 Z" fill="#faf8f3" />
      <path d="M128 88 H180 M128 104 H172 M128 120 H164" stroke="#d9c39a" strokeWidth="4" />
    </g>
  );
}

function BoxScene() {
  return (
    <g>
      <path d="M110 86 L160 62 L210 86 L210 146 L160 170 L110 146 Z" fill="#166534" />
      <path d="M160 62 V170" stroke="#12382c" strokeWidth="3" />
      <path d="M110 86 H210" stroke="#12382c" strokeWidth="3" />
    </g>
  );
}

function MountainCover() {
  return (
    <g>
      <rect width="320" height="200" fill="#1a4a38" />
      <path d="M0 200 L0 118 L48 78 L86 108 L130 52 L188 112 L230 70 L280 104 L320 86 V200 Z" fill="#0f2f24" />
      <path d="M0 200 L0 148 L70 108 L120 138 L170 96 L230 140 L320 116 V200 Z" fill="#166534" />
    </g>
  );
}

function FlagCover() {
  return (
    <g>
      <rect width="320" height="200" fill="#e8e8e8" />
      <rect y="0" width="320" height="66" fill="#166534" />
      <rect y="134" width="320" height="66" fill="#dc2626" />
      <circle cx="160" cy="100" r="22" fill="#dc2626" />
    </g>
  );
}

function CampCover() {
  return (
    <g>
      <rect width="320" height="200" fill="#16382c" />
      <path d="M40 170 L90 88 L140 170 Z" fill="#1f5a40" />
      <path d="M180 176 L236 96 L292 176 Z" fill="#1f5a40" />
      <circle cx="160" cy="132" r="16" fill="#f5c518" opacity="0.85" />
      <path d="M0 176 H320 V200 H0 Z" fill="#0c241c" />
    </g>
  );
}
