import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as UiButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

const variantMap = {
  primary: "default",
  ghost: "outline",
  danger: "destructive",
} as const;

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <UiButton
      type={type}
      variant={variantMap[variant]}
      size="lg"
      className={cn("h-11 px-4", className)}
      {...props}
    />
  );
}

export const controlClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

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
    <div className="flex flex-col gap-1.5" data-invalid={error ? true : undefined}>
      <Label className="text-muted">{label}</Label>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
