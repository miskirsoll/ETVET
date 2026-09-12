"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrgRole } from "@/lib/types/db";

const LINKS = [
  { href: "/studio", label: "Courses" },
  { href: "/studio/themes", label: "Themes" },
  { href: "/studio/live", label: "Live Sessions" },
];

export function StudioNav({ role }: { role: OrgRole }) {
  const pathname = usePathname();

  const links = [
    ...LINKS,
    ...(role === "ORG_ADMIN" ? [{ href: "/studio/team", label: "Team" }] : []),
    ...(role === "SUPER_ADMIN" ? [{ href: "/admin", label: "Platform admin" }] : []),
  ];

  return (
    <nav className="flex gap-1 text-sm">
      {links.map((link) => {
        // "/studio" itself would otherwise match every /studio/* path too.
        const isActive =
          link.href === "/studio" ? pathname === "/studio" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded px-3 py-1.5 transition-colors ${
              isActive
                ? "bg-brand-subtle font-medium text-brand-text"
                : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
