"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID = process.env.NODE_ENV === "development"
  ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
  : null;
import {
  Users,
  Search,
  Phone,
  Mail,
  Stethoscope,
  User,
  Shield,
  ChevronRight,
  PlusCircle,
  Loader2,
  Check,
  UserPlus,
  Calendar,
  Building,
  Link2,
  Trash2,
  X,
} from "lucide-react";
import gsap from "gsap";

interface PatientRecord {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  assignedPhysicianId?: string;
  consentStatus?: string;
  [key: string]: unknown;
}

const HIDDEN_FIELDS = new Set([
  "_id",
  "_creationTime",
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "dateOfBirth",
  "userId",
  "assignedPhysicianId",
  "consentStatus",
  "consentTimestamp",
  "organizationId",
  "emergencyContact",
  "connected",
]);

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function PatientCard({ patient, onViewProfile }: { patient: PatientRecord; onViewProfile: () => void }) {
  const fullName = [patient.firstName, patient.lastName]
    .filter(Boolean)
    .join(" ");

  const initials = [patient.firstName?.[0], patient.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  // Collect extra fields that aren't in the standard set
  const extraFields = Object.entries(patient).filter(
    ([key, value]) => !HIDDEN_FIELDS.has(key) && value !== undefined && value !== null && value !== ""
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
            {initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate">
              {fullName || "Unknown Patient"}
            </h3>
            {patient.email && (
              <p className="text-sm text-slate-500 truncate">{patient.email}</p>
            )}
          </div>
          <button
            onClick={onViewProfile}
            aria-label={`View ${fullName || "patient"} profile`}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-6 py-4 space-y-3">
        {patient.email && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Mail size={16} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Email</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.email)}
              </p>
            </div>
          </div>
        )}

        {patient.phoneNumber && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Phone size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Phone</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.phoneNumber)}
              </p>
            </div>
          </div>
        )}

        {patient.dateOfBirth && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <User size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Date of Birth</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.dateOfBirth)}
              </p>
            </div>
          </div>
        )}

        {/* Render any extra fields dynamically */}
        {extraFields.map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Shield size={16} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">
                {formatFieldName(key)}
              </p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Card Footer */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={onViewProfile}
          className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors py-1"
        >
          View Full Profile
        </button>
      </div>
    </div>
  );
}

function AddPatientDialog({
  open,
  onOpenChange,
  physicianUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  physicianUserId: string | undefined;
}) {
  const availablePatients = useQuery(
    api.connectionRequests.getAvailablePatients,
    physicianUserId ? { physicianUserId: physicianUserId as any } : "skip"
  );
  const sendRequest = useMutation(api.connectionRequests.send);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const filtered = availablePatients?.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    return name.includes(q) || p.email.toLowerCase().includes(q);
  });

  const handleSend = async (patientId: string) => {
    if (!physicianUserId || sendingId) return;
    setError("");
    setSendingId(patientId);
    try {
      await sendRequest({
        physicianUserId: physicianUserId as any,
        patientId: patientId as any,
      });
      setSentIds((prev) => new Set(prev).add(patientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request.");
    } finally {
      setSendingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          setSearch("");
          setError("");
          setSentIds(new Set());
          onOpenChange(false);
        }}
      />
      {/* Content */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-slate-800">Add Patient</h2>
            <button
              onClick={() => {
                setSearch("");
                setError("");
                setSentIds(new Set());
                onOpenChange(false);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Select a registered patient to send a connection request. They will need to confirm on their dashboard.
          </p>
        </div>

        {/* Search */}
        <div className="px-6 py-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="px-6">
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
              {error}
            </p>
          </div>
        )}

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {availablePatients === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filtered && filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((patient) => {
                const isSent = sentIds.has(patient._id);
                const isSending = sendingId === patient._id;
                const initials = `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase();

                return (
                  <div
                    key={patient._id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {patient.email}
                      </p>
                    </div>
                    {isSent ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                        <Check size={14} />
                        Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSend(patient._id)}
                        disabled={isSending}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserPlus size={14} />
                        )}
                        {isSending ? "Sending..." : "Send Request"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {search ? "No matching patients" : "No available patients"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {search
                  ? "Try a different search term."
                  : "All registered patients are already connected or have pending requests."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PatientDetailDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient: PatientRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hidePatient = useMutation(api.patients.hidePatient);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!open || !patient) return null;

  const fullName = [patient.firstName, patient.lastName]
    .filter(Boolean)
    .join(" ");

  const initials = [patient.firstName?.[0], patient.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await hidePatient({ patientId: patient._id as any });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete patient.");
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    setDeleting(false);
    setDeleteError("");
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
              {initials || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">
                {fullName || "Unknown Patient"}
              </h2>
              {patient.email && (
                <p className="text-sm text-slate-500 truncate">{patient.email}</p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {patient.email && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Mail size={16} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Email</p>
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {String(patient.email)}
                </p>
              </div>
            </div>
          )}

          {patient.phoneNumber && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Phone size={16} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Phone</p>
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {String(patient.phoneNumber)}
                </p>
              </div>
            </div>
          )}

          {patient.dateOfBirth && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <Calendar size={16} className="text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Date of Birth</p>
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {String(patient.dateOfBirth)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <Shield size={16} className="text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Consent Status</p>
              <p className="text-sm font-semibold text-slate-700 capitalize">
                {patient.consentStatus ?? "Unknown"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Link2 size={16} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Connected</p>
              <p className="text-sm font-semibold text-slate-700">
                {(patient as any).connected ? "Yes" : "No"}
              </p>
            </div>
          </div>

          {(patient as any).organizationId && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Building size={16} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">Organization</p>
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {String((patient as any).organizationId)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {deleteError && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
              {deleteError}
            </p>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            } disabled:opacity-50`}
          >
            {deleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {deleting
              ? "Deleting..."
              : confirmDelete
                ? "Confirm Delete?"
                : "Delete Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const params = useParams();
  const physicianId = params.physicianId as string;
  // DEV: bypass Clerk — hardcode physician lookup
  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );
  const patients = useQuery(
    api.patients.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  ) as PatientRecord[] | undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !patients) return;
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
  }, [patients]);

  const filteredPatients = patients?.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
    const email = (p.email ?? "").toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

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
            My Patients
          </h1>
          <p className="text-slate-500 mt-1">
            {patients === undefined
              ? "Loading patient records..."
              : `${patients.length} patient${patients.length === 1 ? "" : "s"} in your care`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients..."
              aria-label="Search patients"
              className="bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm w-64"
            />
          </div>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100 text-sm"
          >
            <PlusCircle size={18} />
            <span>Add Patient</span>
          </button>
        </div>
      </section>

      {/* Stats Bar */}
      <section data-animate className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Users size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Patients</p>
            <p className="text-2xl font-bold text-slate-800">
              {patients?.length ?? "—"}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
            <Stethoscope size={22} className="text-teal-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Consented</p>
            <p className="text-2xl font-bold text-slate-800">
              {patients
                ? patients.filter((p) => p.consentStatus === "granted").length
                : "—"}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <Search size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Search Results</p>
            <p className="text-2xl font-bold text-slate-800">
              {filteredPatients?.length ?? "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Patient Cards Grid */}
      {patients === undefined ? (
        <section data-animate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm h-72 animate-pulse"
            >
              <div className="bg-slate-100 h-20 rounded-t-2xl" />
              <div className="p-6 space-y-4">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </section>
      ) : filteredPatients && filteredPatients.length > 0 ? (
        <section
          data-animate
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient._id}
              patient={patient}
              onViewProfile={() => setSelectedPatient(patient)}
            />
          ))}
        </section>
      ) : (
        <section
          data-animate
          className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">
            {searchQuery ? "No patients found" : "No patients yet"}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No patients match "${searchQuery}". Try a different search term.`
              : "Patient records will appear here once they are added to the system."}
          </p>
        </section>
      )}

      <AddPatientDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        physicianUserId={convexUser?._id}
      />

      <PatientDetailDialog
        patient={selectedPatient}
        open={selectedPatient !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPatient(null);
        }}
      />
    </div>
  );
}
