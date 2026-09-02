"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export default function NavLinks({
  links,
  orientation = "row",
}: {
  links: { href: string; label: string }[];
  orientation?: "row" | "col";
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        orientation === "row"
          ? "flex items-center gap-1 overflow-x-auto"
          : "flex flex-col gap-1",
      )}
    >
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-lg text-sm font-medium transition-colors",
              orientation === "row" ? "px-3 py-1.5" : "px-3 py-2",
              active
                ? "bg-brand-100 text-brand-900"
                : "text-slate-600 hover:bg-brand-50 hover:text-brand-800",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
