"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  User,
  XCircle,
  X,
  Stethoscope,
  CalendarCheck,
  CalendarX,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  parseISO,
  isBefore,
} from "date-fns";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  cancelled: { bg: "bg-slate-50", text: "text-slate-500", label: "Cancelled" },
  no_show: { bg: "bg-amber-50", text: "text-amber-700", label: "No Show" },
};

export default function PatientAppointmentsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingSlot, setBookingSlot] = useState<any | null>(null);
  const [bookingReason, setBookingReason] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );
  const patientProfile = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const assignedPhysicianId = patientProfile?.assignedPhysicianId;

  const physicianProfile = useQuery(
    api.physicians.getByUserId,
    assignedPhysicianId ? { userId: assignedPhysicianId } : "skip"
  );

  // Patient's appointments
  const myAppointments = useQuery(
    api.appointments.getByPatient,
    patientProfile ? { patientId: patientProfile._id } : "skip"
  );

  // Available slots for the month (from assigned physician)
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const monthSlots = useQuery(
    api.availabilitySlots.getByPhysicianAndDateRange,
    assignedPhysicianId
      ? { physicianId: assignedPhysicianId, startDate: monthStart, endDate: monthEnd }
      : "skip"
  );

  // Available slots for selected date
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const daySlots = useQuery(
    api.availabilitySlots.getAvailableByPhysicianAndDate,
    assignedPhysicianId && selectedDateStr
      ? { physicianId: assignedPhysicianId, date: selectedDateStr }
      : "skip"
  );

  const bookAppt = useMutation(api.appointments.book);
  const cancelAppt = useMutation(api.appointments.cancel);

  // Calendar grid
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });
  const startDay = getDay(startOfMonth(currentMonth));

  // Dates with available slots
  const availableDates = new Set<string>();
  if (monthSlots) {
    for (const s of monthSlots) {
      if (!s.isBooked) availableDates.add(s.date);
    }
  }

  const handleBook = async () => {
    if (!bookingSlot || !patientProfile || !assignedPhysicianId) return;
    setIsBooking(true);
    try {
      await bookAppt({
        patientId: patientProfile._id,
        physicianId: assignedPhysicianId,
        slotId: bookingSlot._id,
        reason: bookingReason || undefined,
      });
      setBookingSlot(null);
      setBookingReason("");
    } catch (e: any) {
      alert(e.message ?? "Failed to book appointment");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelDialog) return;
    try {
      await cancelAppt({ appointmentId: cancelDialog as any, cancelledBy: "patient" });
    } catch (e: any) {
      alert(e.message ?? "Failed to cancel");
    }
    setCancelDialog(null);
  };

  // Loading
  if (!clerkLoaded || (clerkUser && (convexUser === undefined || (convexUser && patientProfile === undefined)))) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading appointments...</span>
        </div>
      </div>
    );
  }

  if (!assignedPhysicianId) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Physician Assigned</h2>
          <p className="text-slate-500">
            You need to be connected to a physician before you can book appointments. Please contact your healthcare provider.
          </p>
        </div>
      </div>
    );
  }

  const upcomingAppointments = (myAppointments ?? [])
    .filter((a) => a.status === "scheduled" && a.date >= format(new Date(), "yyyy-MM-dd"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const pastAppointments = (myAppointments ?? [])
    .filter((a) => a.status !== "scheduled" || a.date < format(new Date(), "yyyy-MM-dd"))
    .sort((a, b) => b.date.localeCompare(a.date));

  const sortedDaySlots = (daySlots ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointments</h1>
        <p className="text-slate-500 text-sm mt-1">
          {physicianProfile
            ? `Book appointments with Dr. ${physicianProfile.lastName}`
            : "Manage your appointments"}
        </p>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <CalendarCheck size={20} className="text-blue-500" />
          Upcoming Appointments
        </h2>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-slate-400">No upcoming appointments</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map((appt) => (
              <div key={appt._id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Stethoscope size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">
                    {appt.physician ? `Dr. ${appt.physician.lastName}` : "Physician"}
                    {appt.physician?.specialty && (
                      <span className="text-sm text-slate-400 ml-2">{appt.physician.specialty}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <Calendar size={12} />
                    {format(parseISO(appt.date), "MMM d, yyyy")}
                    <span>&bull;</span>
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
                <button
                  onClick={() => setCancelDialog(appt._id)}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XCircle size={16} />
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book New Appointment */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-indigo-500" />
          Book New Appointment
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

            <div className="grid grid-cols-7 gap-1 mb-2">
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
                const hasSlots = availableDates.has(dateStr);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const isPast = isBefore(day, new Date()) && !today;

                return (
                  <button
                    key={dateStr}
                    onClick={() => hasSlots && !isPast ? setSelectedDate(day) : undefined}
                    disabled={!hasSlots || isPast}
                    className={`relative flex flex-col items-center py-2 rounded-xl transition-all text-sm ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                        : hasSlots && !isPast
                          ? today
                            ? "bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
                            : "hover:bg-blue-50 text-slate-700"
                          : "text-slate-300 cursor-default"
                    }`}
                  >
                    {format(day, "d")}
                    {hasSlots && !isPast && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? "bg-blue-200" : "bg-blue-400"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Available dates
            </div>
          </div>

          {/* Time Slots */}
          <div>
            {!selectedDate ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Calendar className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-400">Select a date to see available times</p>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-slate-800 mb-3">
                  Available times for {format(selectedDate, "MMM d, yyyy")}
                </h4>
                {sortedDaySlots.length === 0 ? (
                  <p className="text-sm text-slate-400">No available slots for this date</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sortedDaySlots.map((slot) => (
                      <button
                        key={slot._id}
                        onClick={() => setBookingSlot(slot)}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-medium text-slate-700 hover:text-blue-700"
                      >
                        <Clock size={14} />
                        {slot.startTime} - {slot.endTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CalendarX size={20} className="text-slate-400" />
            Past Appointments
          </h2>
          <div className="space-y-3">
            {pastAppointments.slice(0, 10).map((appt) => {
              const statusCfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled;
              return (
                <div key={appt._id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                    <Stethoscope size={18} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700">
                      {appt.physician ? `Dr. ${appt.physician.lastName}` : "Physician"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <Calendar size={12} />
                      {format(parseISO(appt.date), "MMM d, yyyy")}
                      <span>&bull;</span>
                      {appt.startTime} - {appt.endTime}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                    {statusCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Confirmation Dialog */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setBookingSlot(null); setBookingReason(""); }} />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <button
              onClick={() => { setBookingSlot(null); setBookingReason(""); }}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800">Confirm Booking</h2>
              <p className="text-sm text-slate-500 mt-1">
                {physicianProfile && `Dr. ${physicianProfile.firstName} ${physicianProfile.lastName}`}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-slate-800">{selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-sm text-blue-600">{bookingSlot.startTime} - {bookingSlot.endTime}</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="reason" className="text-sm font-medium text-slate-700 mb-1 block">
                Reason for visit (optional)
              </label>
              <textarea
                id="reason"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                placeholder="Brief description of your concern..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setBookingSlot(null); setBookingReason(""); }}
                disabled={isBooking}
                className="flex-1 bg-white text-slate-700 border border-slate-200 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={isBooking}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
              >
                {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                {isBooking ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
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
                <p className="text-sm text-slate-500">The time slot will become available again</p>
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
    </div>
  );
}
