"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
  Users,
  Search,
  Phone,
  Mail,
  Stethoscope,
  User,
  Shield,
  ChevronRight,
} from "lucide-react";
import gsap from "gsap";

interface PatientRecord {
  _id: string;
  firstname?: string;
  lastname?: string;
  middleinitial?: string;
  physician?: string;
  username?: string;
  email?: string;
  phone?: string;
  dateofbirth?: string;
  [key: string]: unknown;
}

const HIDDEN_FIELDS = new Set([
  "_id",
  "_creationTime",
  "firstname",
  "lastname",
  "middleinitial",
  "physician",
  "username",
  "email",
  "phone",
  "dateofbirth",
]);

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function PatientCard({ patient, onViewProfile }: { patient: PatientRecord; onViewProfile: () => void }) {
  const fullName = [
    patient.firstname,
    patient.middleinitial ? `${patient.middleinitial}.` : null,
    patient.lastname,
  ]
    .filter(Boolean)
    .join(" ");

  const initials = [patient.firstname?.[0], patient.lastname?.[0]]
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
            {patient.username && (
              <p className="text-sm text-slate-500 truncate">@{patient.username}</p>
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
        {patient.physician && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Stethoscope size={16} className="text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Physician</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.physician)}
              </p>
            </div>
          </div>
        )}

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

        {patient.phone && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Phone size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Phone</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.phone)}
              </p>
            </div>
          </div>
        )}

        {patient.dateofbirth && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <User size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">Date of Birth</p>
              <p className="text-sm font-semibold text-slate-700 truncate">
                {String(patient.dateofbirth)}
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

export default function PatientsPage() {
  const router = useRouter();
  const patients = useQuery(api.user.getAll) as PatientRecord[] | undefined;
  const [searchQuery, setSearchQuery] = useState("");
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
    const fullName = [p.firstname, p.middleinitial ? `${p.middleinitial}.` : null, p.lastname].filter(Boolean).join(" ").toLowerCase();
    const physician = (p.physician ?? "").toString().toLowerCase();
    const username = (p.username ?? "").toString().toLowerCase();
    const email = (p.email ?? "").toString().toLowerCase();
    return (
      fullName.includes(query) ||
      physician.includes(query) ||
      username.includes(query) ||
      email.includes(query)
    );
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
            <p className="text-sm text-slate-500 font-medium">Physicians</p>
            <p className="text-2xl font-bold text-slate-800">
              {patients
                ? new Set(patients.map((p) => p.physician).filter(Boolean)).size
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
              onViewProfile={() => router.push(`/patients/${patient._id}`)}
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
    </div>
  );
}
