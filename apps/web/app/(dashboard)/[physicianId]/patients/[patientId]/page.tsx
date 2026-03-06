"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  Shield,
  Calendar,
  Building,
  Link2,
  Trash2,
  Loader2,
  Pill,
  AlertCircle,
  Stethoscope,
  Syringe,
  ShieldCheck,
  Heart,
  Upload,
  FileText,
  X,
  CloudUpload,
  File,
  TestTube,
  Image,
  StickyNote,
  Clock,
} from "lucide-react";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

const categoryConfig: Record<
  string,
  { icon: any; label: string; color: string; bg: string; border: string }
> = {
  lab_result: {
    icon: TestTube,
    label: "Lab Results",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  prescription: {
    icon: Pill,
    label: "Prescriptions",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  imaging: {
    icon: Image,
    label: "Imaging",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  notes: {
    icon: StickyNote,
    label: "Notes",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  other: {
    icon: FileText,
    label: "Other",
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
};

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const physicianId = params.physicianId as string;
  const patientId = params.patientId as string;

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const patient = useQuery(
    api.patients.getById,
    patientId ? { patientId: patientId as any } : "skip"
  );

  const patientUser = useQuery(
    api.users.getById,
    patient?.userId ? { userId: patient.userId } : "skip"
  );

  const documents = useQuery(
    api.documents.getByPatient,
    patientId ? { patientId: patientId as any } : "skip"
  );

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createByPhysician = useMutation(api.documents.createByPhysician);
  const hidePatient = useMutation(api.patients.hidePatient);

  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFiles([]);
    setUploadCategory(null);
    setUploadDescription("");
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (
      selectedFiles.length === 0 ||
      !uploadCategory ||
      !convexUser ||
      !patientId
    )
      return;

    setIsUploading(true);
    setUploadError(null);
    try {
      for (const file of selectedFiles) {
        const { uploadUrl } = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error(`Failed to upload ${file.name}`);
        const { storageId } = await result.json();

        await createByPhysician({
          patientId: patientId as any,
          uploadedBy: convexUser._id,
          fileName: file.name,
          fileType: file.type,
          storageId,
          category: uploadCategory as any,
          metadata: uploadDescription
            ? { description: uploadDescription }
            : undefined,
        });
      }
      closeUploadDialog();
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Failed to upload files. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await hidePatient({ patientId: patientId as any });
      router.push(`/${physicianId}/patients`);
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete patient."
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setUploadDialogOpen(true);
    }
  };
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setSelectedFiles(files);
      setUploadDialogOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (patient === undefined || convexUser === undefined) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">
            Loading patient details...
          </span>
        </div>
      </div>
    );
  }

  if (!patient || !convexUser) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Patient not found or access denied.
          </p>
          <button
            onClick={() => router.push(`/${physicianId}/patients`)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  const fullName = [patient.firstName, patient.lastName]
    .filter(Boolean)
    .join(" ");
  const initials = [patient.firstName?.[0], patient.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  const email = patientUser?.email ?? "";

  const docs = documents ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* Back button */}
      <button
        onClick={() => router.push(`/${physicianId}/patients`)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Patients
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
            {initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 truncate">
              {fullName || "Unknown Patient"}
            </h1>
            {email && (
              <p className="text-sm text-slate-500 truncate">{email}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              patient.consentStatus === "granted"
                ? "bg-emerald-100 text-emerald-700"
                : patient.consentStatus === "revoked"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {patient.consentStatus === "granted"
              ? "Consent Granted"
              : patient.consentStatus === "revoked"
                ? "Consent Revoked"
                : "Consent Pending"}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Patient Profile */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Contact Information
            </h2>

            {email && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Mail size={16} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Email</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {email}
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
                    {patient.phoneNumber}
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
                  <p className="text-xs text-slate-400 font-medium">
                    Date of Birth
                  </p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {patient.dateOfBirth}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Shield size={16} className="text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 font-medium">
                  Consent Status
                </p>
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
                  {patient.connected ? "Yes" : "No"}
                </p>
              </div>
            </div>

            {patient.organizationId && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Building size={16} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">
                    Organization
                  </p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {String(patient.organizationId)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Medical Profile */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Medical Profile
            </h2>

            {patient.medications && patient.medications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Pill size={14} className="text-violet-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Medications
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.medications.map((m: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-medium"
                    >
                      {m.name}
                      {m.dosage ? ` ${m.dosage}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {patient.allergies && patient.allergies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertCircle size={14} className="text-rose-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Allergies
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.allergies.map((a: any, i: number) => {
                    const colors: Record<string, string> = {
                      drug: "bg-red-50 text-red-700",
                      food: "bg-amber-50 text-amber-700",
                      environmental: "bg-green-50 text-green-700",
                      other: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <span
                        key={i}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[a.type] ?? "bg-rose-50 text-rose-700"}`}
                      >
                        {a.allergen}
                        {a.type ? ` (${a.type})` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {patient.conditions && patient.conditions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Stethoscope size={14} className="text-blue-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Conditions
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patient.conditions.map((c: any, i: number) => {
                    const statusColors: Record<string, string> = {
                      active: "bg-blue-50 text-blue-700",
                      resolved: "bg-emerald-50 text-emerald-700",
                      chronic: "bg-amber-50 text-amber-700",
                    };
                    return (
                      <span
                        key={i}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {c.name}
                        {c.status ? ` · ${c.status}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {(patient.sex || patient.bloodType) && (
              <div className="flex gap-4">
                {patient.sex && (
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-indigo-600" />
                    <p className="text-xs text-slate-400 font-medium">Sex:</p>
                    <p className="text-sm font-semibold text-slate-700 capitalize">
                      {patient.sex}
                    </p>
                  </div>
                )}
                {patient.bloodType && (
                  <div className="flex items-center gap-2">
                    <Heart size={14} className="text-red-600" />
                    <p className="text-xs text-slate-400 font-medium">
                      Blood Type:
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {patient.bloodType}
                    </p>
                  </div>
                )}
              </div>
            )}

            {patient.procedures && patient.procedures.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Syringe size={14} className="text-teal-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Procedures
                  </p>
                </div>
                <div className="space-y-1">
                  {patient.procedures.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {p.name}
                      </span>
                      {p.date && (
                        <span className="text-slate-400 text-xs">{p.date}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {patient.insurance && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Insurance
                  </p>
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  {patient.insurance.planName && (
                    <p>
                      <span className="text-xs text-slate-400">Plan:</span>{" "}
                      {patient.insurance.planName}
                    </p>
                  )}
                  {patient.insurance.provider && (
                    <p>
                      <span className="text-xs text-slate-400">Provider:</span>{" "}
                      {patient.insurance.provider}
                    </p>
                  )}
                  {patient.insurance.memberId && (
                    <p>
                      <span className="text-xs text-slate-400">
                        Member ID:
                      </span>{" "}
                      {patient.insurance.memberId}
                    </p>
                  )}
                </div>
              </div>
            )}

            {patient.emergencyContact && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Phone size={14} className="text-red-600" />
                  <p className="text-xs text-slate-400 font-medium">
                    Emergency Contact
                  </p>
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    <span className="text-xs text-slate-400">Name:</span>{" "}
                    {patient.emergencyContact.name}
                  </p>
                  <p>
                    <span className="text-xs text-slate-400">
                      Relationship:
                    </span>{" "}
                    {patient.emergencyContact.relationship}
                  </p>
                  <p>
                    <span className="text-xs text-slate-400">Phone:</span>{" "}
                    {patient.emergencyContact.phoneNumber}
                  </p>
                </div>
              </div>
            )}

            {!patient.medications?.length &&
              !patient.allergies?.length &&
              !patient.conditions?.length &&
              !patient.sex &&
              !patient.bloodType &&
              !patient.procedures?.length &&
              !patient.insurance &&
              !patient.emergencyContact && (
                <p className="text-xs text-slate-400 text-center py-2">
                  No medical profile data yet
                </p>
              )}
          </div>

          {/* Delete Patient */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {deleteError && (
              <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 mb-3">
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

        {/* Right: Documents */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Documents
              </h2>
              <button
                onClick={() => setUploadDialogOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
              >
                <Upload size={16} />
                Upload
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  No documents yet
                </p>
                <p className="text-xs text-slate-500">
                  Upload medical documents for this patient.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc: any) => {
                  const config = categoryConfig[doc.category as string] ?? categoryConfig["other"]!;
                  const Icon = config!.icon;
                  const reviewBadge =
                    doc.reviewStatus === "pendingReview" ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Pending Review
                      </span>
                    ) : doc.reviewStatus === "approved" || !doc.reviewStatus ? (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Approved
                      </span>
                    ) : null;

                  return (
                    <div
                      key={doc._id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon size={18} className={config.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {doc.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <Clock size={10} />
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                          <span>&bull;</span>
                          <span className={config.color}>{config.label}</span>
                        </div>
                      </div>
                      {reviewBadge}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      {uploadDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={closeUploadDialog}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <button
              onClick={closeUploadDialog}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                Upload Document for {patient.firstName}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                The patient will need to approve this document before AI
                processing begins.
              </p>
            </div>

            {uploadError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
                {uploadError}
              </div>
            )}

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-all mb-6 ${
                isDragging
                  ? "border-blue-400 bg-blue-50/50"
                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50">
                  <CloudUpload className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <p className="font-medium text-slate-800 mb-1">
                Drag and drop your files here
              </p>
              <p className="text-sm text-slate-500 mb-4">or click to browse</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-all"
              >
                Browse Files
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-slate-700">
                  Selected Files ({selectedFiles.length})
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm"
                    >
                      <File className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate flex-1 text-slate-700">
                        {file.name}
                      </span>
                      <span className="text-slate-400 text-xs shrink-0">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryConfig)
                    .slice(0, 3)
                    .map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = uploadCategory === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setUploadCategory(key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-all ${
                            isSelected
                              ? `${config.border} ${config.bg} ring-2 ring-blue-500/20`
                              : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/50"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <span className="text-xs text-slate-700">
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(categoryConfig)
                    .slice(3)
                    .map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = uploadCategory === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setUploadCategory(key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-all ${
                            isSelected
                              ? `${config.border} ${config.bg} ring-2 ring-blue-500/20`
                              : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/50"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <span className="text-xs text-slate-700">
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="text-sm font-medium text-slate-700"
                >
                  Description (optional)
                </label>
                <input
                  id="description"
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of the document"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeUploadDialog}
                disabled={isUploading}
                className="flex-1 bg-white text-slate-700 border border-slate-200 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={
                  isUploading || selectedFiles.length === 0 || !uploadCategory
                }
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={handleFileSelection}
      />
    </div>
  );
}
