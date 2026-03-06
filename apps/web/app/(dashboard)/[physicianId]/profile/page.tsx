"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Loader2,
  Pencil,
  X,
  Check,
  Star,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  Building2,
  Shield,
  Languages,
  Stethoscope,
  BadgeCheck,
  UserPlus,
} from "lucide-react";

const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function EditableSection({
  title,
  icon: Icon,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  children,
  editForm,
}: {
  title: string;
  icon: React.ElementType;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  editForm: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        </div>
        {!isEditing ? (
          <button
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Pencil size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>
      <div className="px-6 py-4">
        {isEditing ? editForm : children}
      </div>
    </div>
  );
}

export default function PhysicianOwnProfilePage() {
  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const profile = useQuery(
    api.physicians.getProfileByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const updatePhysician = useMutation(api.physicians.update);

  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Draft state for each section
  const [aboutDraft, setAboutDraft] = useState("");
  const [certsDraft, setCertsDraft] = useState<{ name: string; year?: number }[]>([]);
  const [educationDraft, setEducationDraft] = useState("");
  const [residencyDraft, setResidencyDraft] = useState("");
  const [fellowshipDraft, setFellowshipDraft] = useState("");
  const [affiliationsDraft, setAffiliationsDraft] = useState<string[]>([]);
  const [insurancesDraft, setInsurancesDraft] = useState<string[]>([]);
  const [languagesDraft, setLanguagesDraft] = useState<string[]>([]);
  const [conditionsDraft, setConditionsDraft] = useState<string[]>([]);
  const [acceptingDraft, setAcceptingDraft] = useState(true);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (convexUser === undefined || profile === undefined) {
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
        <p className="text-slate-500">No physician profile found.</p>
      </div>
    );
  }

  const startEdit = (section: string) => {
    setEditingSection(section);
    switch (section) {
      case "about":
        setAboutDraft(profile.about ?? "");
        break;
      case "credentials":
        setCertsDraft(profile.boardCertifications ?? []);
        setEducationDraft(profile.education ?? "");
        setResidencyDraft(profile.residency ?? "");
        setFellowshipDraft(profile.fellowship ?? "");
        break;
      case "practice":
        setAffiliationsDraft(profile.hospitalAffiliations ?? []);
        setInsurancesDraft(profile.insurancesAccepted ?? []);
        setLanguagesDraft(profile.languages ?? []);
        break;
      case "specialties":
        setConditionsDraft(profile.conditionsTreated ?? []);
        setAcceptingDraft(profile.acceptingNewPatients ?? true);
        break;
      case "contact":
        setPhoneDraft(profile.phone ?? "");
        setCityDraft(profile.city ?? "");
        setStateDraft(profile.state ?? "");
        break;
    }
  };

  const saveSection = async (section: string) => {
    setSaveError(null);
    try {
      switch (section) {
        case "about":
          await updatePhysician({ physicianId: profile._id, about: aboutDraft });
          break;
        case "credentials":
          await updatePhysician({
            physicianId: profile._id,
            boardCertifications: certsDraft,
            education: educationDraft,
            residency: residencyDraft,
            fellowship: fellowshipDraft,
          });
          break;
        case "practice":
          await updatePhysician({
            physicianId: profile._id,
            hospitalAffiliations: affiliationsDraft,
            insurancesAccepted: insurancesDraft,
            languages: languagesDraft,
          });
          break;
        case "specialties":
          await updatePhysician({
            physicianId: profile._id,
            conditionsTreated: conditionsDraft,
            acceptingNewPatients: acceptingDraft,
          });
          break;
        case "contact":
          await updatePhysician({
            physicianId: profile._id,
            phone: phoneDraft,
            city: cityDraft,
            state: stateDraft,
          });
          break;
      }
      setEditingSection(null);
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveError("Failed to save changes. Please try again.");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 text-slate-900">
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

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* About */}
      <EditableSection
        title="About"
        icon={Stethoscope}
        isEditing={editingSection === "about"}
        onEdit={() => startEdit("about")}
        onSave={() => saveSection("about")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <textarea
            value={aboutDraft}
            onChange={(e) => setAboutDraft(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
            placeholder="Write a bio about your practice and experience..."
          />
        }
      >
        {profile.about ? (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{profile.about}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No bio added yet.</p>
        )}
      </EditableSection>

      {/* Clinical Credentials */}
      <EditableSection
        title="Clinical Credentials"
        icon={GraduationCap}
        isEditing={editingSection === "credentials"}
        onEdit={() => startEdit("credentials")}
        onSave={() => saveSection("credentials")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Medical School</label>
              <input
                value={educationDraft}
                onChange={(e) => setEducationDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Residency</label>
              <input
                value={residencyDraft}
                onChange={(e) => setResidencyDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fellowship</label>
              <input
                value={fellowshipDraft}
                onChange={(e) => setFellowshipDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Board Certifications</label>
              {certsDraft.map((cert, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={cert.name}
                    onChange={(e) => {
                      const updated = [...certsDraft];
                      updated[i] = { ...updated[i]!, name: e.target.value };
                      setCertsDraft(updated);
                    }}
                    placeholder="Certification name"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={cert.year ?? ""}
                    onChange={(e) => {
                      const updated = [...certsDraft];
                      updated[i] = { ...updated[i]!, year: e.target.value ? Number(e.target.value) : undefined };
                      setCertsDraft(updated);
                    }}
                    placeholder="Year"
                    className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setCertsDraft(certsDraft.filter((_, j) => j !== i))}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setCertsDraft([...certsDraft, { name: "" }])}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Certification
              </button>
            </div>
          </div>
        }
      >
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
          {!profile.boardCertifications?.length && !profile.education && !profile.residency && !profile.fellowship && (
            <p className="text-sm text-slate-400 italic">No credentials added yet.</p>
          )}
        </div>
      </EditableSection>

      {/* Practice Information */}
      <EditableSection
        title="Practice Information"
        icon={Building2}
        isEditing={editingSection === "practice"}
        onEdit={() => startEdit("practice")}
        onSave={() => saveSection("practice")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Hospital Affiliations (one per line)</label>
              <textarea
                value={affiliationsDraft.join("\n")}
                onChange={(e) => setAffiliationsDraft(e.target.value.split("\n").filter(Boolean))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                placeholder="Cedars-Sinai Medical Center&#10;UCLA Health"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Insurances Accepted (comma-separated)</label>
              <textarea
                value={insurancesDraft.join(", ")}
                onChange={(e) => setInsurancesDraft(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Blue Cross, Aetna, UnitedHealthcare"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Languages (comma-separated)</label>
              <input
                value={languagesDraft.join(", ")}
                onChange={(e) => setLanguagesDraft(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="English, Spanish"
              />
            </div>
          </div>
        }
      >
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
          {!profile.hospitalAffiliations?.length && !profile.insurancesAccepted?.length && !profile.languages?.length && (
            <p className="text-sm text-slate-400 italic">No practice information added yet.</p>
          )}
        </div>
      </EditableSection>

      {/* Specialties & Conditions */}
      <EditableSection
        title="Specialties & Conditions"
        icon={Shield}
        isEditing={editingSection === "specialties"}
        onEdit={() => startEdit("specialties")}
        onSave={() => saveSection("specialties")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Accepting New Patients</label>
              <button
                role="switch"
                aria-checked={acceptingDraft}
                aria-label="Accepting new patients"
                onClick={() => setAcceptingDraft(!acceptingDraft)}
                className={`w-10 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  acceptingDraft ? "bg-green-500" : "bg-slate-300"
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${
                    acceptingDraft ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions Treated (comma-separated)</label>
              <textarea
                value={conditionsDraft.join(", ")}
                onChange={(e) => setConditionsDraft(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                placeholder="Heart Failure, Atrial Fibrillation, Hypertension"
              />
            </div>
          </div>
        }
      >
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
      </EditableSection>

      {/* Contact */}
      <EditableSection
        title="Contact"
        icon={Phone}
        isEditing={editingSection === "contact"}
        onEdit={() => startEdit("contact")}
        onSave={() => saveSection("contact")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
              <input
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">City</label>
                <input
                  value={cityDraft}
                  onChange={(e) => setCityDraft(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">State</label>
                <input
                  value={stateDraft}
                  onChange={(e) => setStateDraft(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        }
      >
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
          {!profile.phone && !profile.email && !profile.city && !profile.state && (
            <p className="text-slate-400 italic">No contact information added yet.</p>
          )}
        </div>
      </EditableSection>
    </div>
  );
}
