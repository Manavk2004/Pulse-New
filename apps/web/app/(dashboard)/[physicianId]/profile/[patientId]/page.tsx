"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex/convex/_generated/dataModel";
import {
  Loader2,
  MapPin,
  Phone,
  Heart,
  Activity,
  Pill,
  AlertCircle,
  Syringe,
  ShieldCheck,
  User,
  Cigarette,
  Wine,
  Dumbbell,
  Briefcase,
  Users,
  Ruler,
  Weight,
  ArrowLeft,
} from "lucide-react";

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Icon size={18} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function ViewPatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = params.patientId;
  const patientId = typeof rawParam === "string" ? rawParam : undefined;

  const patient = useQuery(
    api.patients.getProfileByPatientId,
    patientId ? { patientId: patientId as Id<"patients"> } : "skip"
  );

  if (patient === undefined) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Patient profile not found.</p>
      </div>
    );
  }

  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 text-slate-900">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Banner + Header */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="w-full h-48 relative">
          {patient.bannerPhotoUrl ? (
            <img src={patient.bannerPhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-200" />
          )}
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {patient.profilePhotoUrl ? (
              <img
                src={patient.profilePhotoUrl}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white flex items-center justify-center text-slate-600 font-bold text-2xl shadow-lg">
                {getInitials(patient.firstName, patient.lastName)}
              </div>
            )}
            <div className="flex-1 pt-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                <span>{age} years old</span>
                {patient.sex && <span className="capitalize">{patient.sex}</span>}
                {patient.bloodType && <span>Blood Type: {patient.bloodType}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                {patient.insurance && (
                  <span>
                    <ShieldCheck size={14} className="inline mr-1" />
                    {patient.insurance.provider} {patient.insurance.planName}
                  </span>
                )}
                {(patient.city || patient.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {[patient.city, patient.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {patient.occupation && (
                  <span className="flex items-center gap-1">
                    <Briefcase size={14} />
                    {patient.occupation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      {(patient.about || patient.healthOverview) && (
        <Section title="About" icon={User}>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {patient.about ?? patient.healthOverview}
          </p>
        </Section>
      )}

      {/* Health Snapshot */}
      <Section title="Health Snapshot" icon={Heart}>
        <div className="space-y-4">
          {/* Conditions */}
          {patient.conditions && patient.conditions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Active Conditions</p>
              <div className="flex flex-wrap gap-2">
                {patient.conditions.map((c: any, i: number) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === "chronic"
                        ? "bg-amber-50 text-amber-700"
                        : c.status === "active"
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                    }`}
                  >
                    {c.name}
                    {c.status && <span className="ml-1 opacity-75">({c.status})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {patient.medications && patient.medications.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Current Medications</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {patient.medications.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <Pill size={14} className="text-slate-400" />
                    {m.name}{m.dosage ? ` — ${m.dosage}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Allergies */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Known Allergies</p>
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((a: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                    <AlertCircle size={12} />
                    {a.allergen}
                    {a.type && <span className="opacity-75">({a.type})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vitals */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            {patient.height && (
              <div className="flex items-center gap-2 text-slate-700">
                <Ruler size={14} className="text-slate-400" />
                Height: {patient.height}
              </div>
            )}
            {patient.weight && (
              <div className="flex items-center gap-2 text-slate-700">
                <Weight size={14} className="text-slate-400" />
                Weight: {patient.weight}
              </div>
            )}
            {patient.bloodType && (
              <div className="flex items-center gap-2 text-slate-700">
                <Heart size={14} className="text-slate-400" />
                Blood Type: {patient.bloodType}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Medical History */}
      {((patient.procedures && patient.procedures.length > 0) || (patient.familyHistory && patient.familyHistory.length > 0)) && (
        <Section title="Medical History" icon={Syringe}>
          <div className="space-y-4">
            {patient.procedures && patient.procedures.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Past Procedures</p>
                <div className="space-y-1">
                  {patient.procedures.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{p.name}</span>
                      {p.date && <span className="text-slate-400 text-xs">{p.date}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {patient.familyHistory && patient.familyHistory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Family History</p>
                <div className="space-y-1">
                  {patient.familyHistory.map((fh: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{fh.relation}</span>
                      <span className="text-slate-700">{fh.condition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Lifestyle */}
      {(patient.smokingStatus || patient.alcoholUse || patient.exerciseFrequency || patient.occupation) && (
        <Section title="Lifestyle" icon={Dumbbell}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {patient.smokingStatus && (
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Cigarette size={14} />
                  <span className="text-xs font-medium">Smoking</span>
                </div>
                <p className="text-slate-700 capitalize">{patient.smokingStatus}</p>
              </div>
            )}
            {patient.alcoholUse && (
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Wine size={14} />
                  <span className="text-xs font-medium">Alcohol</span>
                </div>
                <p className="text-slate-700 capitalize">{patient.alcoholUse}</p>
              </div>
            )}
            {patient.exerciseFrequency && (
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Dumbbell size={14} />
                  <span className="text-xs font-medium">Exercise</span>
                </div>
                <p className="text-slate-700">{patient.exerciseFrequency}</p>
              </div>
            )}
            {patient.occupation && (
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Briefcase size={14} />
                  <span className="text-xs font-medium">Occupation</span>
                </div>
                <p className="text-slate-700">{patient.occupation}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Emergency Contact */}
      {patient.emergencyContact && (
        <Section title="Emergency Contact" icon={Phone}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">Name</p>
              <p className="text-slate-700">{patient.emergencyContact.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Relationship</p>
              <p className="text-slate-700">{patient.emergencyContact.relationship}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="text-slate-700">{patient.emergencyContact.phoneNumber}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
