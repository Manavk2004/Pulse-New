"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
  AlertTriangle,
  Clock,
  ChevronRight,
  Loader2,
  Shield,
  Flame,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import gsap from "gsap";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

type StatusFilter = "all" | "pending" | "acknowledged" | "resolved";

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_CONFIG: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<any> }
> = {
  urgent: { bg: "bg-red-50", text: "text-red-700", icon: Flame },
  high: { bg: "bg-orange-50", text: "text-orange-700", icon: AlertTriangle },
  medium: { bg: "bg-amber-50", text: "text-amber-700", icon: AlertCircle },
  low: { bg: "bg-blue-50", text: "text-blue-700", icon: Shield },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> =
  {
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    acknowledged: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
    resolved: {
      bg: "bg-green-50",
      text: "text-green-700",
      dot: "bg-green-500",
    },
  };

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function EscalationsPage() {
  const params = useParams();
  const physicianId = params.physicianId as string;
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const escalations = useQuery(
    api.escalations.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );

  const filtered =
    escalations && activeFilter !== "all"
      ? escalations.filter((e) => e.status === activeFilter)
      : escalations;

  // Stats
  const counts = {
    urgent: escalations?.filter((e) => e.severity === "urgent" && e.status !== "resolved").length ?? 0,
    high: escalations?.filter((e) => e.severity === "high" && e.status !== "resolved").length ?? 0,
    medium: escalations?.filter((e) => e.severity === "medium" && e.status !== "resolved").length ?? 0,
    low: escalations?.filter((e) => e.severity === "low" && e.status !== "resolved").length ?? 0,
  };

  useEffect(() => {
    if (!containerRef.current || !escalations) return;
    const sections =
      containerRef.current.querySelectorAll<HTMLElement>("[data-animate]");
    const tween = gsap.fromTo(
      sections,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
    return () => {
      tween.kill();
    };
  }, [escalations]);

  return (
    <div
      ref={containerRef}
      className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900"
    >
      {/* Header */}
      <section
        data-animate
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Escalations
          </h1>
          <p className="text-slate-500 mt-1">
            {escalations === undefined
              ? "Loading escalations..."
              : `${escalations.filter((e) => e.status !== "resolved").length} active escalation${escalations.filter((e) => e.status !== "resolved").length === 1 ? "" : "s"} requiring attention`}
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section data-animate className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["urgent", "high", "medium", "low"] as const).map((severity) => {
          const config = SEVERITY_CONFIG[severity]!;
          const Icon = config.icon;
          return (
            <div
              key={severity}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}
              >
                <Icon size={22} className={config.text} />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium capitalize">
                  {severity}
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {counts[severity]}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Filter Tabs */}
      <section data-animate>
        <div className="flex gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeFilter === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Escalation Cards */}
      {escalations === undefined ? (
        <section
          data-animate
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm h-56 animate-pulse"
            >
              <div className="p-6 space-y-4">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </section>
      ) : filtered && filtered.length > 0 ? (
        <section
          data-animate
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filtered.map((esc) => {
            const patient = esc.patient;
            const fullName = patient
              ? `${patient.firstName} ${patient.lastName}`
              : "Unknown Patient";
            const initials = patient
              ? `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`
              : "?";
            const sevConfig = SEVERITY_CONFIG[esc.severity] ?? SEVERITY_CONFIG.low!;
            const SevIcon = sevConfig.icon;
            const statusConfig = STATUS_CONFIG[esc.status] ?? STATUS_CONFIG.pending!;

            return (
              <Link
                key={esc._id}
                href={`/${physicianId}/escalations/${esc._id}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden group"
              >
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        {fullName}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={12} className="text-slate-400" />
                        <span className="text-xs text-slate-400">
                          {timeAgo(esc.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-slate-300 group-hover:text-blue-500 transition-colors"
                  />
                </div>

                {/* Card Body */}
                <div className="px-6 py-4 space-y-3">
                  {/* Badges */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sevConfig.bg} ${sevConfig.text}`}
                    >
                      <SevIcon size={12} />
                      {esc.severity.charAt(0).toUpperCase() +
                        esc.severity.slice(1)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}
                      />
                      {esc.status.charAt(0).toUpperCase() +
                        esc.status.slice(1)}
                    </span>
                  </div>

                  {/* Summary or Reason */}
                  <p className="text-sm text-slate-600 line-clamp-3">
                    {esc.summary ?? esc.reason}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section
          data-animate
          className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">
            {activeFilter !== "all" ? "No escalations found" : "All clear!"}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {activeFilter !== "all"
              ? `No ${activeFilter} escalations at the moment.`
              : "There are no escalations requiring your attention right now."}
          </p>
        </section>
      )}
    </div>
  );
}
