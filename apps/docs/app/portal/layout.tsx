"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import {
  HeartPulse,
  MessageSquare,
  FileText,
  LayoutDashboard,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { name: "AI Assistant", href: "/portal/chat", icon: Sparkles },
  { name: "Documents", href: "/portal/documents", icon: FileText },
  { name: "Settings", href: "/portal/settings", icon: Settings },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border/50 bg-card/50 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">Pulse</span>
              <p className="text-xs text-muted-foreground">Patient Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`group flex gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <item.icon
                            className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive ? "text-primary-foreground" : ""
                            }`}
                          />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>

              {/* Quick Actions */}
              <li className="mt-auto">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-4 border border-primary/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Need Help?</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Our AI assistant is available 24/7 to answer your health questions.
                  </p>
                  <Link href="/portal/chat">
                    <Button size="sm" className="w-full rounded-xl">
                      Start Conversation
                    </Button>
                  </Link>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 lg:hidden">
        <div className="flex h-16 items-center gap-x-4 border-b border-border/50 bg-card/80 backdrop-blur-xl px-4 shadow-sm">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-foreground lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold">Pulse</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-5 w-5" />
            </Button>
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                  <HeartPulse className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">Pulse</span>
              </div>
              <button
                type="button"
                className="-m-2.5 p-2.5"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden lg:fixed lg:left-72 lg:right-0 lg:top-0 lg:z-40">
        <div className="flex h-16 items-center gap-x-4 border-b border-border/50 bg-card/80 backdrop-blur-xl px-8">
          {/* Search */}
          <div className="flex flex-1 items-center gap-x-4">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search documents, messages..."
                className="h-10 w-full rounded-xl border border-border bg-muted/50 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 rounded-xl",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-72">
        <div className="lg:pt-16">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
