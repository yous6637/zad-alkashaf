import type { ButtonHTMLAttributes, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "ghost" && "border border-border bg-card text-fg",
        variant === "danger" && "bg-danger-soft text-danger",
        className,
      )}
      {...props}
    />
  );
}

export const controlClass =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-accent/25";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-4">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <div className="mt-4 space-y-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
