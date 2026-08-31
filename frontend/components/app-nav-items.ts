import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Settings,
} from "lucide-react";

export const appNavItems = [
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/tasks", label: "Tasks", Icon: ClipboardList },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function isAppNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
