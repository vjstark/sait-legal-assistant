/*
 * Shared UI primitives — the app's entire visual vocabulary lives here.
 * Every page composes these instead of hand-rolling styles, so changing
 * the look in one place restyles the whole app.
 */
import Link from "next/link";
import type React from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ── Buttons ─────────────────────────────────────────────────── */

const buttonVariants = {
  primary:
    "bg-brand-800 text-white hover:bg-brand-700 focus-visible:outline-brand-800 disabled:bg-brand-800/50",
  secondary:
    "bg-surface text-brand-800 border border-line hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-brand-800 disabled:opacity-50",
  ghost:
    "text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-800 disabled:opacity-50",
  danger:
    "bg-surface text-red-700 border border-line hover:border-red-200 hover:bg-red-50 focus-visible:outline-red-600 disabled:opacity-50",
} as const;

const buttonSizes = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
} as const;

type ButtonExtras = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

function buttonClasses({ variant = "primary", size = "md" }: ButtonExtras) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    buttonVariants[variant],
    buttonSizes[size],
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtras & { className?: string }) {
  return (
    <button
      {...props}
      className={cn(buttonClasses({ variant, size }), className)}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size,
  href,
  className,
  children,
}: ButtonExtras & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(buttonClasses({ variant, size }), className)}>
      {children}
    </Link>
  );
}

/* ── Surfaces ────────────────────────────────────────────────── */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-card border border-line bg-surface shadow-[0_1px_2px_rgb(20_35_57/0.04)]",
        className,
      )}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-5 sm:p-6", className)} />;
}

/* ── Page scaffolding ────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-block text-sm text-slate-500 hover:text-brand-700"
        >
          ← {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardBody className="flex flex-col items-center py-12 text-center">
        <p className="font-serif text-lg text-brand-900">{title}</p>
        {description && (
          <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CardBody>
    </Card>
  );
}

/* ── Forms ───────────────────────────────────────────────────── */

const fieldClasses =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-800 " +
  "placeholder:text-slate-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600/20 " +
  "disabled:cursor-not-allowed disabled:bg-paper";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClasses, className)} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldClasses, className)} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClasses, className)} />;
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn("mb-1.5 block text-sm font-medium text-brand-900", className)}
    />
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-slate-500">{children}</p>;
}

/* ── Feedback ────────────────────────────────────────────────── */

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-brand-200 bg-brand-50 text-brand-800",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3.5 py-2.5 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "accent" | "brand";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    accent: "bg-accent-100 text-accent-700",
    brand: "bg-brand-100 text-brand-800",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700",
        className,
      )}
    />
  );
}
