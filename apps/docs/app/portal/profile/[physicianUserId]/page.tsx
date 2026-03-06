"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
  Loader2,
  Star,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  Building2,
  Languages,
  Stethoscope,
  BadgeCheck,
  UserPlus,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

export default function ViewPhysicianProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawParam = params.physicianUserId;
  const physicianUserId = typeof rawParam === "string" ? rawParam : undefined;

  const profile = useQuery(
    api.physicians.getProfileByUserId,
    physicianUserId ? { userId: physicianUserId as any } : "skip"
  );

  if (profile === undefined) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Physician profile not found.</p>
      </div>
    );
  }

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
          {profile.bannerPhotoUrl ? (
            <img src={profile.bannerPhotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-blue-200" />
          )}
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={`Dr. ${profile.firstName} ${profile.lastName}`}
                className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg">
                {getInitials(profile.firstName, profile.lastName)}
              </div>
            )}
            <div className="flex-1 pt-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Dr. {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-slate-500 mt-0.5">
                {profile.specialty}
                {profile.organizationName ? ` · ${profile.organizationName}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                {profile.rating != null && profile.rating > 0 && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={s <= Math.round(profile.rating!) ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                      />
                    ))}
                    <span className="ml-1">{profile.rating}</span>
                  </div>
                )}
                {profile.yearsOfExperience != null && (
                  <span>{profile.yearsOfExperience} yrs experience</span>
                )}
                {(profile.city || profile.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {[profile.city, profile.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
              {profile.acceptingNewPatients && (
                <div className="flex items-center gap-1.5 mt-2 text-green-600 text-sm font-medium">
                  <UserPlus size={15} />
                  Accepting New Patients
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      {profile.about && (
        <Section title="About" icon={Stethoscope}>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{profile.about}</p>
        </Section>
      )}

      {/* Clinical Credentials */}
      {(profile.boardCertifications?.length || profile.education || profile.residency || profile.fellowship) && (
        <Section title="Clinical Credentials" icon={GraduationCap}>
          <div className="space-y-3">
            {profile.boardCertifications && profile.boardCertifications.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Board Certifications</p>
                <div className="flex flex-wrap gap-2">
                  {profile.boardCertifications.map((cert, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      <BadgeCheck size={12} />
                      {cert.name}{cert.year ? ` (${cert.year})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {profile.education && (
                <div>
                  <p className="text-xs text-slate-400">Medical School</p>
                  <p className="text-slate-700">{profile.education}</p>
                </div>
              )}
              {profile.residency && (
                <div>
                  <p className="text-xs text-slate-400">Residency</p>
                  <p className="text-slate-700">{profile.residency}</p>
                </div>
              )}
              {profile.fellowship && (
                <div>
                  <p className="text-xs text-slate-400">Fellowship</p>
                  <p className="text-slate-700">{profile.fellowship}</p>
                </div>
              )}
            </div>
            {profile.licenseNumber && (
              <div className="text-sm">
                <p className="text-xs text-slate-400">License #</p>
                <p className="text-slate-700">{profile.licenseNumber}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Practice Information */}
      {(profile.hospitalAffiliations?.length || profile.insurancesAccepted?.length || profile.languages?.length) && (
        <Section title="Practice Information" icon={Building2}>
          <div className="space-y-4">
            {profile.hospitalAffiliations && profile.hospitalAffiliations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Hospital Affiliations</p>
                <ul className="space-y-1">
                  {profile.hospitalAffiliations.map((h, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <Building2 size={14} className="text-slate-400" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.insurancesAccepted && profile.insurancesAccepted.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Insurances Accepted</p>
                <div className="flex flex-wrap gap-2">
                  {profile.insurancesAccepted.map((ins, i) => (
                    <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      {ins}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.languages && profile.languages.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Languages</p>
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      <Languages size={12} />
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Specialties & Conditions */}
      <Section title="Specialties & Conditions" icon={Shield}>
        <div className="space-y-3">
          <div>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
              <Stethoscope size={12} />
              {profile.specialty}
            </span>
          </div>
          {profile.conditionsTreated && profile.conditionsTreated.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Conditions Treated</p>
              <div className="flex flex-wrap gap-2">
                {profile.conditionsTreated.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Contact */}
      {(profile.phone || profile.email || profile.city || profile.state) && (
        <Section title="Contact" icon={Phone}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {profile.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone size={14} className="text-slate-400" />
                {profile.phone}
              </div>
            )}
            {profile.email && (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail size={14} className="text-slate-400" />
                {profile.email}
              </div>
            )}
            {(profile.city || profile.state) && (
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin size={14} className="text-slate-400" />
                {[profile.city, profile.state].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
