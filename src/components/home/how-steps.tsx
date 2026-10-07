import { ChevronLeft, MessageCircle, Package, UserRound, Users } from "lucide-react";
import { useT } from "@/lib/use-locale";

const ICONS = [UserRound, Users, Package, MessageCircle] as const;

export function HowSteps() {
  const t = useT();
  const steps = [
    { title: t("home.step1Title"), body: t("home.step1Body") },
    { title: t("home.step2Title"), body: t("home.step2Body") },
    { title: t("home.step3Title"), body: t("home.step3Body") },
    { title: t("home.step4Title"), body: t("home.step4Body") },
  ];

  return (
    <section id="how" className="mt-16">
      <h2 className="text-center text-2xl font-semibold text-accent">{t("home.how")}</h2>
      <ol className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
        {steps.map((step, index) => {
          const Icon = ICONS[index];
          return (
            <li key={step.title} className="flex flex-1 items-start gap-2">
              <div className="flex-1 text-center">
                <p className="text-sm tabular-nums text-muted">0{index + 1}</p>
                <span className="mx-auto mt-2 grid size-14 place-items-center rounded-full bg-white text-accent shadow-[0_8px_24px_rgba(18,56,44,0.08)] ring-1 ring-border">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </div>
              {index < steps.length - 1 ? (
                <ChevronLeft className="mt-12 hidden size-5 shrink-0 text-muted ltr:rotate-180 lg:block" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
