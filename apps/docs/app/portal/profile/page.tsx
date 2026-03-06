"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Loader2,
  Pencil,
  X,
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
} from "lucide-react";

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

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function PatientOwnProfilePage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  const patient = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const updateProfile = useMutation(api.patients.updateProfileFields);
  const updatePatient = useMutation(api.patients.update);

  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Draft states
  const [aboutDraft, setAboutDraft] = useState("");
  const [heightDraft, setHeightDraft] = useState("");
  const [weightDraft, setWeightDraft] = useState("");
  const [smokingDraft, setSmokingDraft] = useState<"never" | "former" | "current">("never");
  const [alcoholDraft, setAlcoholDraft] = useState<"none" | "occasional" | "moderate" | "heavy">("none");
  const [exerciseDraft, setExerciseDraft] = useState("");
  const [occupationDraft, setOccupationDraft] = useState("");
  const [familyHistoryDraft, setFamilyHistoryDraft] = useState<{ relation: string; condition: string }[]>([]);
  const [emergencyDraft, setEmergencyDraft] = useState({ name: "", relationship: "", phoneNumber: "" });
  const [cityDraft, setCityDraft] = useState("");
  const [stateDraft, setStateDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!clerkLoaded || convexUser === undefined || (convexUser && patient === undefined)) {
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
        <p className="text-slate-500">No patient profile found.</p>
      </div>
    );
  }

  const profilePhotoUrl = clerkUser?.imageUrl;
  const age = calculateAge(patient.dateOfBirth);

  const startEdit = (section: string) => {
    setEditingSection(section);
    switch (section) {
      case "about":
        setAboutDraft(patient.about ?? patient.healthOverview ?? "");
        break;
      case "lifestyle":
        setSmokingDraft(patient.smokingStatus ?? "never");
        setAlcoholDraft(patient.alcoholUse ?? "none");
        setExerciseDraft(patient.exerciseFrequency ?? "");
        setOccupationDraft(patient.occupation ?? "");
        break;
      case "history":
        setFamilyHistoryDraft(patient.familyHistory ?? []);
        break;
      case "emergency":
        setEmergencyDraft(patient.emergencyContact ?? { name: "", relationship: "", phoneNumber: "" });
        break;
      case "vitals":
        setHeightDraft(patient.height ?? "");
        setWeightDraft(patient.weight ?? "");
        break;
      case "location":
        setCityDraft(patient.city ?? "");
        setStateDraft(patient.state ?? "");
        break;
    }
  };

  const saveSection = async (section: string) => {
    setSaveError(null);
    try {
      switch (section) {
        case "about":
          await updateProfile({ patientId: patient._id, about: aboutDraft });
          break;
        case "lifestyle":
          await updateProfile({
            patientId: patient._id,
            smokingStatus: smokingDraft,
            alcoholUse: alcoholDraft,
            exerciseFrequency: exerciseDraft,
            occupation: occupationDraft,
          });
          break;
        case "history":
          await updateProfile({ patientId: patient._id, familyHistory: familyHistoryDraft });
          break;
        case "emergency":
          await updateProfile({ patientId: patient._id, emergencyContact: emergencyDraft });
          break;
        case "vitals":
          await updateProfile({ patientId: patient._id, height: heightDraft, weight: weightDraft });
          break;
        case "location":
          await updatePatient({ patientId: patient._id, city: cityDraft, state: stateDraft });
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
          <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-200" />
        </div>
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
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

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* About */}
      <EditableSection
        title="About"
        icon={User}
        isEditing={editingSection === "about"}
        onEdit={() => startEdit("about")}
        onSave={() => saveSection("about")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <textarea
            value={aboutDraft}
            onChange={(e) => setAboutDraft(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
            placeholder="Write a brief health overview or bio..."
          />
        }
      >
        {patient.about || patient.healthOverview ? (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{patient.about ?? patient.healthOverview}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No bio added yet.</p>
        )}
      </EditableSection>

      {/* Health Snapshot */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Heart size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">Health Snapshot</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Conditions */}
          {patient.conditions && patient.conditions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Active Conditions</p>
              <div className="flex flex-wrap gap-2">
                {patient.conditions.map((c, i) => (
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
                    {c.status && (
                      <span className="ml-1 opacity-75">({c.status})</span>
                    )}
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
                {patient.medications.map((m, i) => (
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
                {patient.allergies.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                    <AlertCircle size={12} />
                    {a.allergen}
                    {a.type && <span className="opacity-75">({a.type})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vitals: height, weight, blood type */}
          <EditableSection
            title="Vitals"
            icon={Activity}
            isEditing={editingSection === "vitals"}
            onEdit={() => startEdit("vitals")}
            onSave={() => saveSection("vitals")}
            onCancel={() => setEditingSection(null)}
            editForm={
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Height</label>
                  <input
                    value={heightDraft}
                    onChange={(e) => setHeightDraft(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5'10&quot;"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Weight</label>
                  <input
                    value={weightDraft}
                    onChange={(e) => setWeightDraft(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="170 lbs"
                  />
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <Ruler size={14} className="text-slate-400" />
                {patient.height || "—"}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Weight size={14} className="text-slate-400" />
                {patient.weight || "—"}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Heart size={14} className="text-slate-400" />
                {patient.bloodType || "—"}
              </div>
            </div>
          </EditableSection>
        </div>
      </div>

      {/* Medical History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Syringe size={18} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">Medical History</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Procedures */}
          {patient.procedures && patient.procedures.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Past Procedures</p>
              <div className="space-y-1">
                {patient.procedures.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    {p.date && <span className="text-slate-400 text-xs">{p.date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Family History (editable) */}
          <EditableSection
            title="Family History"
            icon={Users}
            isEditing={editingSection === "history"}
            onEdit={() => startEdit("history")}
            onSave={() => saveSection("history")}
            onCancel={() => setEditingSection(null)}
            editForm={
              <div className="space-y-2">
                {familyHistoryDraft.map((fh, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={fh.relation}
                      onChange={(e) => {
                        const updated = [...familyHistoryDraft];
                        updated[i] = { ...updated[i]!, relation: e.target.value };
                        setFamilyHistoryDraft(updated);
                      }}
                      placeholder="Relation (e.g., Father)"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={fh.condition}
                      onChange={(e) => {
                        const updated = [...familyHistoryDraft];
                        updated[i] = { ...updated[i]!, condition: e.target.value };
                        setFamilyHistoryDraft(updated);
                      }}
                      placeholder="Condition"
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => setFamilyHistoryDraft(familyHistoryDraft.filter((_, j) => j !== i))}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFamilyHistoryDraft([...familyHistoryDraft, { relation: "", condition: "" }])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Family History Entry
                </button>
              </div>
            }
          >
            {patient.familyHistory && patient.familyHistory.length > 0 ? (
              <div className="space-y-1">
                {patient.familyHistory.map((fh, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{fh.relation}</span>
                    <span className="text-slate-700">{fh.condition}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No family history recorded.</p>
            )}
          </EditableSection>
        </div>
      </div>

      {/* Lifestyle */}
      <EditableSection
        title="Lifestyle"
        icon={Dumbbell}
        isEditing={editingSection === "lifestyle"}
        onEdit={() => startEdit("lifestyle")}
        onSave={() => saveSection("lifestyle")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Smoking Status</label>
              <select
                value={smokingDraft}
                onChange={(e) => setSmokingDraft(e.target.value as typeof smokingDraft)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="never">Never</option>
                <option value="former">Former</option>
                <option value="current">Current</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Alcohol Use</label>
              <select
                value={alcoholDraft}
                onChange={(e) => setAlcoholDraft(e.target.value as typeof alcoholDraft)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="occasional">Occasional</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Exercise Frequency</label>
              <input
                value={exerciseDraft}
                onChange={(e) => setExerciseDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 3-4 times/week"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Occupation</label>
              <input
                value={occupationDraft}
                onChange={(e) => setOccupationDraft(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Software Engineer"
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Cigarette size={14} />
              <span className="text-xs font-medium">Smoking</span>
            </div>
            <p className="text-slate-700 capitalize">{patient.smokingStatus ?? "Not specified"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Wine size={14} />
              <span className="text-xs font-medium">Alcohol</span>
            </div>
            <p className="text-slate-700 capitalize">{patient.alcoholUse ?? "Not specified"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Dumbbell size={14} />
              <span className="text-xs font-medium">Exercise</span>
            </div>
            <p className="text-slate-700">{patient.exerciseFrequency || "Not specified"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Briefcase size={14} />
              <span className="text-xs font-medium">Occupation</span>
            </div>
            <p className="text-slate-700">{patient.occupation || "Not specified"}</p>
          </div>
        </div>
      </EditableSection>

      {/* Emergency Contact */}
      <EditableSection
        title="Emergency Contact"
        icon={Phone}
        isEditing={editingSection === "emergency"}
        onEdit={() => startEdit("emergency")}
        onSave={() => saveSection("emergency")}
        onCancel={() => setEditingSection(null)}
        editForm={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Name</label>
              <input
                value={emergencyDraft.name}
                onChange={(e) => setEmergencyDraft({ ...emergencyDraft, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Relationship</label>
              <input
                value={emergencyDraft.relationship}
                onChange={(e) => setEmergencyDraft({ ...emergencyDraft, relationship: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
              <input
                value={emergencyDraft.phoneNumber}
                onChange={(e) => setEmergencyDraft({ ...emergencyDraft, phoneNumber: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        }
      >
        {patient.emergencyContact ? (
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
        ) : (
          <p className="text-sm text-slate-400 italic">No emergency contact added yet.</p>
        )}
      </EditableSection>
    </div>
  );
}
