"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
  Activity,
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Settings,
  Search,
  Bell,
  Loader2,
} from "lucide-react";

const tabDefinitions = [
  { label: "Overview", icon: LayoutDashboard, path: "" },
  { label: "My Patients", icon: Users, path: "/patients" },
  { label: "Appointments", icon: Calendar, path: "/appointments" },
  { label: "Messages", icon: MessageSquare, path: "/messages" },
  { label: "Escalations", icon: AlertTriangle, path: "/escalations" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

function buildTabs(physicianId: string) {
  return tabDefinitions.map((t) => ({
    ...t,
    href: `/${physicianId}${t.path}`,
  }));
}

function DashboardSidebar({
  tabs,
  activeTab,
  onTabChange,
  onNavigate,
  className,
  showBrand = true,
}: {
  tabs: ReturnType<typeof buildTabs>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNavigate?: () => void;
  className?: string;
  showBrand?: boolean;
}) {
  return (
    <aside
      className={
        className ??
        "w-64 bg-white border-r border-slate-200 hidden xl:flex flex-col relative z-10"
      }
    >
      {showBrand && (
        <div className="p-6">
          <div className="flex items-center gap-2 text-blue-600">
            <Activity size={28} />
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Pulse
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => {
                onTabChange(item.label);
                onNavigate?.();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.label
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 m-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white">
        <h4 className="font-semibold text-sm mb-1">Pulse Pro</h4>
        <p className="text-xs text-blue-100 mb-3">
          Get advanced AI diagnostics and priority escalation routing.
        </p>
        <button className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm">
          Learn More
        </button>
      </div>
    </aside>
  );
}

function Header({
  searchText,
  onSearchChange,
  isMobileNavOpen,
  onMobileNavToggle,
  mobileNavButtonRef,
}: {
  searchText: string;
  onSearchChange: (value: string) => void;
  isMobileNavOpen: boolean;
  onMobileNavToggle: () => void;
  mobileNavButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="sticky top-0 z-10 bg-[#f8fafc]/80 backdrop-blur-md px-8 py-4 flex items-center justify-between border-b border-slate-200">
      <button
        ref={mobileNavButtonRef}
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileNavOpen}
        aria-controls="dashboard-mobile-nav"
        onClick={onMobileNavToggle}
        className="xl:hidden mr-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="sr-only">Open navigation</span>
        <div className="flex flex-col gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
          <span className="h-0.5 w-5 rounded-full bg-slate-700" />
        </div>
      </button>
      <div className="flex-1 max-w-md relative hidden sm:block">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          type="text"
          value={searchText ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search patients, records..."
          className="w-full bg-white border border-slate-200 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 hover:bg-white rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#f8fafc]" />
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-none">
              Dr. Sarah Chen
            </p>
            <p className="text-xs text-slate-500 mt-1">Physician</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop"
            alt="Profile"
            className="w-10 h-10 rounded-full border-2 border-white shadow-sm group-hover:border-blue-200 transition-all"
          />
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const physicianId = params.physicianId as string | undefined;
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Look up Convex user and physician profile for onboarding guard
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );
  const physicianProfile = useQuery(
    api.physicians.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const [searchText, setSearchText] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileNavButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  // Use convexUser._id as fallback if physicianId from URL isn't available yet
  const resolvedPhysicianId = physicianId || convexUser?._id || "";
  const tabs = buildTabs(resolvedPhysicianId);

  // Match active tab by stripping the /{physicianId} prefix
  const pathWithoutId = physicianId
    ? pathname.replace(`/${physicianId}`, "") || "/"
    : pathname;
  const activeTab =
    tabDefinitions.find((t) => {
      const tabPath = t.path || "/";
      return pathWithoutId === tabPath;
    })?.label ?? "Overview";

  const handleTabChange = (label: string) => {
    const tab = tabs.find((t) => t.label === label);
    if (tab) {
      router.push(tab.href);
    }
  };

  // Validate physician ID matches authenticated user
  useEffect(() => {
    if (convexUser && physicianId && convexUser._id !== physicianId) {
      router.replace("/sign-in");
    }
  }, [convexUser, physicianId, router]);

  // Redirect to onboarding if physician user has no physician profile
  useEffect(() => {
    if (convexUser && convexUser.role === "physician" && physicianProfile === null) {
      router.replace("/onboarding");
    }
    if (clerkLoaded && clerkUser && convexUser === null) {
      router.replace("/onboarding");
    }
  }, [clerkLoaded, clerkUser, convexUser, physicianProfile, router]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex="0"]';
    const focusableElements =
      mobileNavRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements?.[0];
    const lastFocusable = focusableElements?.[focusableElements.length - 1];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
        mobileNavButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !firstFocusable || !lastFocusable) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  // Show loading while checking profile (only block for physician role or unknown users)
  if (
    !clerkLoaded ||
    (clerkUser && (convexUser === undefined || (convexUser && convexUser.role === "physician" && physicianProfile === undefined)))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex relative">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0l60 60M60 0L0 60M30 0v60M0 30h60'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          opacity: 0.4,
        }}
      />
      {/* Mobile nav overlay */}
      <div
        className={`fixed inset-0 z-30 xl:hidden transition-opacity duration-300 ${
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className="absolute inset-0 bg-slate-900/40"
          onClick={() => setIsMobileNavOpen(false)}
        />
        <div
          id="dashboard-mobile-nav"
          ref={mobileNavRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={`relative h-full w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ${
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-blue-600">
              <Activity size={24} />
              <span className="text-lg font-semibold text-slate-800">
                Pulse
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="sr-only">Close navigation</span>
              &#x2715;
            </button>
          </div>
          <DashboardSidebar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onNavigate={() => setIsMobileNavOpen(false)}
            className="flex h-full flex-col"
            showBrand={false}
          />
        </div>
      </div>
      <DashboardSidebar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header
          searchText={searchText}
          onSearchChange={setSearchText}
          isMobileNavOpen={isMobileNavOpen}
          onMobileNavToggle={() => setIsMobileNavOpen((prev) => !prev)}
          mobileNavButtonRef={mobileNavButtonRef}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
