"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Loader2,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import gsap from "gsap";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
  isToday,
} from "date-fns";

// DEV: hardcoded physician Clerk ID
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  cancelled: { bg: "bg-slate-50", text: "text-slate-500", label: "Cancelled" },
  no_show: { bg: "bg-amber-50", text: "text-amber-700", label: "No Show" },
};

export default function PhysicianAppointmentsPage() {
  const params = useParams();
  const physicianId = params.physicianId as string;
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [addStart, setAddStart] = useState("09:00");
  const [addEnd, setAddEnd] = useState("09:30");
  const [quickStart, setQuickStart] = useState("09:00");
  const [quickEnd, setQuickEnd] = useState("17:00");
  const [quickDuration, setQuickDuration] = useState(30);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ id: string; action: "completed" | "no_show" } | null>(null);

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  const monthSlots = useQuery(
    api.availabilitySlots.getByPhysicianAndDateRange,
    convexUser ? { physicianId: convexUser._id, startDate: monthStart, endDate: monthEnd } : "skip"
  );

  const daySlots = useQuery(
    api.availabilitySlots.getByPhysicianAndDate,
    convexUser ? { physicianId: convexUser._id, date: selectedDateStr } : "skip"
  );

  const dayAppointments = useQuery(
    api.appointments.getByPhysicianAndDate,
    convexUser ? { physicianId: convexUser._id, date: selectedDateStr } : "skip"
  );

  const createSlot = useMutation(api.availabilitySlots.create);
  const createBulkSlots = useMutation(api.availabilitySlots.createBulk);
  const removeSlot = useMutation(api.availabilitySlots.remove);
  const cancelAppt = useMutation(api.appointments.cancel);
  const updateApptStatus = useMutation(api.appointments.updateStatus);

  // GSAP entrance
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: "power2.out" }
      );
    }
  }, []);

  // Calendar grid
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });
  const startDay = getDay(startOfMonth(currentMonth));

  // Count slots/appointments per date for dots
  const slotCountByDate = new Map<string, { available: number; booked: number }>();
  if (monthSlots) {
    for (const s of monthSlots) {
      const entry = slotCountByDate.get(s.date) ?? { available: 0, booked: 0 };
      if (s.isBooked) entry.booked++;
      else entry.available++;
      slotCountByDate.set(s.date, entry);
    }
  }

  const handleAddSlot = async () => {
    if (!convexUser) return;
    try {
      await createSlot({
        physicianId: convexUser._id,
        date: selectedDateStr,
        startTime: addStart,
        endTime: addEnd,
      });
    } catch (e: any) {
      alert(e.message ?? "Failed to add slot");
    }
  };

  const handleQuickGenerate = async () => {
    if (!convexUser) return;
    const slots: { date: string; startTime: string; endTime: string }[] = [];
    let [h, m] = quickStart.split(":").map(Number);
    const [endH, endM] = quickEnd.split(":").map(Number);
    const endMinutes = endH * 60 + endM;

    while (h * 60 + m + quickDuration <= endMinutes) {
      const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      m += quickDuration;
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
      const end = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      slots.push({ date: selectedDateStr, startTime: start, endTime: end });
    }

    if (slots.length === 0) return;
    try {
      await createBulkSlots({ physicianId: convexUser._id, slots });
    } catch (e: any) {
      alert(e.message ?? "Failed to generate slots");
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelDialog) return;
    try {
      await cancelAppt({ appointmentId: cancelDialog as any, cancelledBy: "physician" });
    } catch (e: any) {
      alert(e.message ?? "Failed to cancel");
    }
    setCancelDialog(null);
  };

  const handleStatusConfirm = async () => {
    if (!statusDialog) return;
    try {
      await updateApptStatus({ appointmentId: statusDialog.id as any, status: statusDialog.action });
    } catch (e: any) {
      alert(e.message ?? "Failed to update status");
    }
    setStatusDialog(null);
  };

  if (!convexUser) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading...</span>
        </div>
      </div>
    );
  }

  const unbookedSlots = (daySlots ?? []).filter((s) => !s.isBooked).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const bookedAppointments = (dayAppointments ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div ref={containerRef} className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointments</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your availability and patient appointments</p>
      </div>

      {/* Available Slots — calendar + slot chips side by side */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock size={20} className="text-blue-500" />
          Available Slots
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <h3 className="text-base font-semibold text-slate-800">
                {format(currentMonth, "MMMM yyyy")}
              </h3>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronRight size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {monthDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const counts = slotCountByDate.get(dateStr);
                const isSelected = isSameDay(day, selectedDate);
                const today = isToday(day);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={`relative flex flex-col items-center py-1.5 rounded-lg transition-all text-sm ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                        : today
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {format(day, "d")}
                    {counts && (
                      <div className="flex gap-0.5 mt-0.5">
                        {counts.available > 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-blue-200" : "bg-blue-400"}`} />
                        )}
                        {counts.booked > 0 && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-green-200" : "bg-green-500"}`} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Booked
              </div>
            </div>
          </div>

          {/* Slots for selected date */}
          <div>
            <h4 className="font-medium text-slate-800 mb-3">
              Slots for {format(selectedDate, "MMM d, yyyy")}
            </h4>
            {unbookedSlots.length === 0 ? (
              <p className="text-sm text-slate-400">No available slots for this day</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unbookedSlots.map((slot) => (
                  <div key={slot._id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm">
                    <span className="font-medium text-blue-700">{slot.startTime} - {slot.endTime}</span>
                    <button
                      onClick={async () => {
                        try { await removeSlot({ slotId: slot._id as any }); }
                        catch (e: any) { alert(e.message); }
                      }}
                      className="p-1 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booked Appointments */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-green-500" />
          Booked Appointments
          <span className="text-sm font-normal text-slate-400 ml-1">
            {format(selectedDate, "MMM d, yyyy")}
          </span>
        </h2>
        {bookedAppointments.length === 0 ? (
          <p className="text-sm text-slate-400">No appointments for this day</p>
        ) : (
          <div className="space-y-3">
            {bookedAppointments.map((appt) => {
              const statusCfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled;
              return (
                <div key={appt._id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <User size={18} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">
                      {appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : "Patient"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <Clock size={12} />
                      {appt.startTime} - {appt.endTime}
                      {appt.reason && (
                        <>
                          <span>&bull;</span>
                          <span className="truncate">{appt.reason}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                    {statusCfg.label}
                  </span>
                  {appt.status === "scheduled" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setStatusDialog({ id: appt._id, action: "completed" })}
                        className="p-2 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
                        title="Mark completed"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        onClick={() => setStatusDialog({ id: appt._id, action: "no_show" })}
                        className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Mark no-show"
                      >
                        <AlertTriangle size={16} />
                      </button>
                      <button
                        onClick={() => setCancelDialog(appt._id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="Cancel"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Availability */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-indigo-500" />
          Add Availability
          <span className="text-sm font-normal text-slate-400 ml-1">
            {format(selectedDate, "MMM d, yyyy")}
          </span>
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Start</label>
            <input
              type="time"
              value={addStart}
              onChange={(e) => setAddStart(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">End</label>
            <input
              type="time"
              value={addEnd}
              onChange={(e) => setAddEnd(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={handleAddSlot}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100 text-sm"
          >
            <Plus size={16} />
            Add Slot
          </button>
        </div>
      </div>

      {/* Quick Generate */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          Quick Generate
          <span className="text-sm font-normal text-slate-400 ml-1">
            {format(selectedDate, "MMM d, yyyy")}
          </span>
        </h2>
        <p className="text-sm text-slate-500 mb-4">Auto-create slots for a time range</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">From</label>
            <input
              type="time"
              value={quickStart}
              onChange={(e) => setQuickStart(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">To</label>
            <input
              type="time"
              value={quickEnd}
              onChange={(e) => setQuickEnd(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Duration</label>
            <select
              value={quickDuration}
              onChange={(e) => setQuickDuration(Number(e.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
          <button
            onClick={handleQuickGenerate}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-amber-600 transition-all shadow-md shadow-amber-100 text-sm"
          >
            <Zap size={16} />
            Generate
          </button>
        </div>
      </div>

      {/* Cancel Dialog */}
      {cancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCancelDialog(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Cancel Appointment</h2>
                <p className="text-sm text-slate-500">This will free up the time slot</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCancelDialog(null)} className="flex-1 bg-white text-slate-700 border border-slate-200 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all">
                Keep
              </button>
              <button onClick={handleCancelConfirm} className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-700 transition-all">
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Dialog */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStatusDialog(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${statusDialog.action === "completed" ? "bg-green-50" : "bg-amber-50"}`}>
                {statusDialog.action === "completed" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {statusDialog.action === "completed" ? "Mark as Completed" : "Mark as No-Show"}
                </h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStatusDialog(null)} className="flex-1 bg-white text-slate-700 border border-slate-200 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button
                onClick={handleStatusConfirm}
                className={`flex-1 text-white py-2.5 rounded-xl font-medium transition-all ${
                  statusDialog.action === "completed" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
