"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  FolderOpen,
  Settings,
  CreditCard,
  Users,
  Shield,
  Workflow,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "New Document",
    href: "/dashboard/documents/new",
    icon: Upload,
  },
  {
    name: "All Documents",
    href: "/dashboard/documents",
    icon: FileText,
  },
  {
    name: "Templates",
    href: "/dashboard/templates",
    icon: FolderOpen,
  },
  {
    name: "Workflows",
    href: "/dashboard/workflows",
    icon: Workflow,
  },
];

const secondaryNavigation = [
  {
    name: "Team",
    href: "/dashboard/team",
    icon: Users,
  },
  {
    name: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Check if user is super admin
    fetch("/api/user/plan-limits")
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuperAdmin) {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {
        // Silently fail - user just won't see admin link
      });
  }, []);

  return (
    <aside className="hidden w-64 flex-col border-r border-white/20 bg-white/60 backdrop-blur-xl lg:flex dark:border-white/10 dark:bg-slate-900/60">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/20 px-6 dark:border-white/10">
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Geek Sign"
            width={140}
            height={42}
            className="h-8 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/15 text-primary shadow-glass-sm backdrop-blur-sm"
                  : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="border-t border-white/20 px-3 py-4 dark:border-white/10">
        <nav className="space-y-1">
          {secondaryNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/15 text-primary shadow-glass-sm backdrop-blur-sm"
                    : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
          {/* Super Admin Link - only visible to super admins */}
          {isSuperAdmin && (
            <Link
              href="/dashboard/admin"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                pathname === "/dashboard/admin"
                  ? "bg-[#F15C3E]/15 text-[#F15C3E] shadow-glass-sm backdrop-blur-sm"
                  : "text-[#F15C3E] hover:bg-[#F15C3E]/10"
              )}
            >
              <Shield className="h-5 w-5" />
              Super Admin
            </Link>
          )}
        </nav>
      </div>
    </aside>
  );
}
