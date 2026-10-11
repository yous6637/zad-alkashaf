import { Shell } from "@/components/layout/shell";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface ${className}`} />;
}

function Grid({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <Block key={index} className="h-48" />
      ))}
    </div>
  );
}

export function ProductsPending() {
  return (
    <Shell>
      <Block className="h-8 w-48" />
      <Block className="mt-3 h-4 w-72" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Block className="h-11" />
        <Block className="h-11" />
        <Block className="h-11" />
      </div>
      <Grid count={6} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
    </Shell>
  );
}

export function ProductPending() {
  return (
    <Shell>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Block className="h-80" />
        <Block className="h-80" />
      </div>
      <Grid count={3} className="mt-6 grid gap-4 sm:grid-cols-3" />
    </Shell>
  );
}

export function TroopsPending() {
  return (
    <Shell>
      <Block className="h-8 w-40" />
      <Block className="mt-3 h-4 w-64" />
      <Grid count={4} className="mt-6 grid gap-4 md:grid-cols-2" />
    </Shell>
  );
}

export function AccountPending() {
  return (
    <Shell>
      <Block className="h-8 w-56" />
      <Block className="mt-3 h-4 w-40" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <Block className="mt-6 h-40" />
    </Shell>
  );
}

export function AdminPending() {
  return (
    <div className="flex min-h-screen bg-[#f4f7f5]">
      <div className="hidden w-60 shrink-0 bg-[#0f3d2e] lg:block" />
      <div className="min-w-0 flex-1 space-y-4 px-4 py-5">
        <Block className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Block className="h-24" />
          <Block className="h-24" />
          <Block className="h-24" />
          <Block className="h-24" />
        </div>
        <Block className="h-80" />
      </div>
    </div>
  );
}
