"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
  Users,
  MessageSquare,
  AlertTriangle,
  FileText,
  ChevronRight,
  Clock,
  PlusCircle,
  Video,
  Activity,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import gsap from "gsap";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID = process.env.NODE_ENV === "development"
  ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
  : null;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ------------------------------------------------------------------ */
/*  MetricCard                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Pending: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors[status] ?? "bg-slate-50 text-slate-600"}`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatTodayISO(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]!;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const params = useParams();
  const physicianId = params.physicianId as string;
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState("This Week");

  // ---------- Convex queries ----------
  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );
  const patients = useQuery(
    api.patients.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const activeEscalationCount = useQuery(
    api.escalations.countActiveByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const appointments = useQuery(
    api.appointments.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const chats = useQuery(
    api.chats.listForPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const documentCount = useQuery(
    api.documents.countDocumentsByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const escalations = useQuery(
    api.escalations.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );

  // ---------- Derived data ----------
  const todayISO = formatTodayISO();

  const todayAppointmentCount = useMemo(() => {
    if (!appointments) return 0;
    return appointments.filter(
      (a) => a.status === "scheduled" && a.date === todayISO
    ).length;
  }, [appointments, todayISO]);

  // Upcoming appointments: scheduled, date >= today, sorted ascending, first 3
  const upcomingAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter((a) => a.status === "scheduled" && a.date >= todayISO)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.startTime < b.startTime ? -1 : 1;
      })
      .slice(0, 3);
  }, [appointments, todayISO]);

  // Escalated chats for the messages box
  const escalatedChats = useMemo(() => {
    if (!chats) return [];
    return chats.filter((c) => c.status === "escalated");
  }, [chats]);

  // Chart data: appointments + escalations grouped by day
  const chartData = useMemo(() => {
    const now = new Date();
    let rangeStart: Date;
    let isMonthly = false;

    if (timeRange === "Last Week") {
      const thisWeekStart = getStartOfWeek(now);
      rangeStart = new Date(thisWeekStart);
      rangeStart.setDate(rangeStart.getDate() - 7);
    } else if (timeRange === "This Month") {
      rangeStart = getStartOfMonth(now);
      isMonthly = true;
    } else {
      // This Week
      rangeStart = getStartOfWeek(now);
    }

    if (!isMonthly) {
      // 7-day view
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(d.getDate() + i);
        return d;
      });

      return days.map((d) => {
        const iso = d.toISOString().split("T")[0]!;
        const apptCount = appointments
          ? appointments.filter((a) => a.date === iso).length
          : 0;
        const escCount = escalations
          ? escalations.filter((e) => {
              const eDate = new Date(e.createdAt).toISOString().split("T")[0];
              return eDate === iso;
            }).length
          : 0;
        return {
          day: DAY_LABELS[d.getDay()]!,
          appointments: apptCount,
          escalations: escCount,
        };
      });
    } else {
      // Weekly buckets for the month
      const weeks: { label: string; start: Date; end: Date }[] = [];
      let weekStart = new Date(rangeStart);
      let weekNum = 1;
      while (weekStart <= now && weekNum <= 5) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weeks.push({ label: `Wk ${weekNum}`, start: new Date(weekStart), end: weekEnd });
        weekStart.setDate(weekStart.getDate() + 7);
        weekNum++;
      }

      return weeks.map((w) => {
        const startISO = w.start.toISOString().split("T")[0]!;
        const endISO = w.end.toISOString().split("T")[0]!;
        const apptCount = appointments
          ? appointments.filter(
              (a) => a.date >= startISO && a.date <= endISO
            ).length
          : 0;
        const escCount = escalations
          ? escalations.filter((e) => {
              const eDate = new Date(e.createdAt).toISOString().split("T")[0]!;
              return eDate >= startISO && eDate <= endISO;
            }).length
          : 0;
        return {
          day: w.label,
          appointments: apptCount,
          escalations: escCount,
        };
      });
    }
  }, [timeRange, appointments, escalations]);

  // ---------- GSAP animation ----------
  useEffect(() => {
    if (!containerRef.current) return;
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
  }, []);

  return (
    <div
      ref={containerRef}
      className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900"
    >
      {/* Welcome Section */}
      <section
        data-animate
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Good morning, Doctor
          </h1>
          <p className="text-slate-500 mt-1">
            You have {activeEscalationCount ?? "—"} pending escalation{activeEscalationCount === 1 ? "" : "s"} and{" "}
            {todayAppointmentCount} upcoming appointment{todayAppointmentCount === 1 ? "" : "s"} today.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm">
            <PlusCircle size={18} />
            <span>New Prescription</span>
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100">
            <Video size={18} />
            <span>Start Consultation</span>
          </button>
        </div>
      </section>

      {/* Escalation Center Banner */}
      <section
        data-animate
        className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm overflow-hidden relative cursor-pointer hover:scale-[1.01] transition-transform duration-200"
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-rose-50/50 -skew-x-12 translate-x-12 z-0" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 shrink-0">
            <AlertTriangle size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              Escalation Center
            </h2>
            <p className="text-slate-500 max-w-lg">
              Review AI-flagged patient cases requiring your immediate attention
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">
              {activeEscalationCount !== undefined ? activeEscalationCount : "—"} Active
            </span>
          </div>
          <Link
            href={`/${physicianId}/escalations`}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shrink-0"
          >
            Review Now <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Metric Cards */}
      <section data-animate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Patients"
          value={String(patients?.length ?? 0)}
          icon={Users}
          color="bg-teal-500"
        />
        <MetricCard
          title="Active Chats"
          value={String(chats?.length ?? 0)}
          icon={MessageSquare}
          color="bg-blue-500"
        />
        <MetricCard
          title="Pending Escalations"
          value={String(activeEscalationCount ?? 0)}
          icon={AlertTriangle}
          color="bg-rose-500"
        />
        <MetricCard
          title="Documents to Review"
          value={String(documentCount ?? 0)}
          icon={FileText}
          color="bg-amber-500"
        />
      </section>

      {/* Chart + Sidebar */}
      <div data-animate className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Patient Activity
              </h3>
              <p className="text-sm text-slate-500">
                Appointments &amp; escalations overview
              </p>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-slate-50 border-none text-sm font-medium rounded-lg px-3 py-1 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="colorAppointments"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorEscalations"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAppointments)"
                />
                <Area
                  type="monotone"
                  dataKey="escalations"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorEscalations)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right sidebar cards */}
        <div className="space-y-6">
          {/* Upcoming Appointments */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">
              Upcoming Appointments
            </h3>
            <div className="space-y-4">
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No upcoming appointments
                </p>
              ) : (
                upcomingAppointments.map((apt) => {
                  const patientName = apt.patient
                    ? `${apt.patient.firstName} ${apt.patient.lastName}`
                    : "Unknown";
                  const initials = apt.patient
                    ? `${apt.patient.firstName?.[0] ?? ""}${apt.patient.lastName?.[0] ?? ""}`
                    : "?";
                  return (
                    <div
                      key={apt._id}
                      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-800">
                          {patientName}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          {apt.reason ?? "Appointment"}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 font-bold bg-blue-50 w-fit px-2 py-0.5 rounded-full uppercase">
                          <Clock size={10} />
                          {apt.startTime} &middot; {apt.date}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  );
                })
              )}
            </div>
            <Link
              href={`/${physicianId}/appointments`}
              className="block w-full mt-6 py-3 text-slate-500 font-semibold text-sm border-t border-slate-100 hover:text-blue-600 transition-colors text-center"
            >
              View All Appointments
            </Link>
          </div>

          {/* New Messages */}
          <Link
            href={`/${physicianId}/messages`}
            className="block bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white relative overflow-hidden hover:scale-[1.01] transition-transform duration-200"
          >
            <div className="absolute bottom-0 right-0 opacity-10">
              <Activity size={120} />
            </div>
            <h3 className="text-lg font-bold mb-2">Escalated Chats</h3>
            <p className="text-slate-400 text-sm mb-6">
              You have {escalatedChats.length} escalated chat{escalatedChats.length === 1 ? "" : "s"} requiring attention.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                {escalatedChats.slice(0, 4).map((chat) => {
                  const initials = chat.patientName
                    ? chat.patientName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
                    : "?";
                  return (
                    <div
                      key={chat._id}
                      className="w-10 h-10 rounded-full border-2 border-slate-800 bg-slate-600 flex items-center justify-center text-white text-xs font-bold"
                    >
                      {initials}
                    </div>
                  );
                })}
              </div>
              {escalatedChats.length > 4 && (
                <span className="text-xs font-medium text-slate-300">
                  +{escalatedChats.length - 4} more
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>

      {/* My Patients Table */}
      <section data-animate className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">My Patients</h3>
            <p className="text-sm text-slate-500">
              Recently active patients
            </p>
          </div>
          <Link
            href={`/${physicianId}/patients`}
            className="text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors flex items-center gap-1"
          >
            View All Patients <ChevronRight size={16} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 pr-4">
                  Patient
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 pr-4 hidden sm:table-cell">
                  Condition
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 pr-4 hidden md:table-cell">
                  Last Visit
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 pr-4">
                  Status
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {patients === undefined ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-slate-500">
                    No patients yet
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  const name = `${patient.firstName} ${patient.lastName}`;
                  const initials = `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`;
                  const status = patient.consentStatus === "granted" ? "Active" : "Pending";
                  return (
                    <tr
                      key={patient._id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            {initials}
                          </div>
                          <span className="font-semibold text-sm text-slate-800">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-600 hidden sm:table-cell">
                        {(patient as any).conditions?.length > 0
                          ? ((patient as any).conditions as any[])
                              .filter((c: any) => c.status !== "resolved")
                              .slice(0, 2)
                              .map((c: any) => c.name)
                              .join(", ") || "—"
                          : "—"}
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-500 hidden md:table-cell">
                        —
                      </td>
                      <td className="py-4 pr-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-4 text-right">
                        <Link
                          href={`/${physicianId}/patients`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
