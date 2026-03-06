"use client";

import { useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Upload,
  FileText,
  Image,
  Pill,
  TestTube,
  StickyNote,
  Search,
  Download,
  Trash2,
  Eye,
  FolderOpen,
  Plus,
  X,
  CloudUpload,
  Shield,
  Clock,
  Grid3X3,
  List,
  ChevronRight,
  File,
  Loader2,
} from "lucide-react";

interface ConvexDocument {
  _id: string;
  _creationTime: number;
  patientId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  storageId: string;
  category: "lab_result" | "prescription" | "imaging" | "notes" | "other";
  uploadedAt: number;
  metadata?: {
    description?: string;
    tags?: string[];
  };
  url: string | null;
}

const categoryConfig = {
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

export default function DocumentsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );
  const patientProfile = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const documents = useQuery(
    api.documents.getByPatient,
    patientProfile ? { patientId: patientProfile._id } : "skip"
  ) as ConvexDocument[] | undefined;

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const removeDocument = useMutation(api.documents.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFiles([]);
    setUploadCategory(null);
    setUploadDescription("");
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !uploadCategory || !patientProfile) {
      return;
    }

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

        if (!result.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await result.json();

        await createDocument({
          patientId: patientProfile._id,
          uploadedBy: convexUser!._id,
          fileName: file.name,
          fileType: file.type,
          storageId,
          category: uploadCategory as ConvexDocument["category"],
          metadata: uploadDescription
            ? { description: uploadDescription }
            : undefined,
        });
      }

      closeUploadDialog();
    } catch (error) {
      console.error("Failed to upload files:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload files. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      await removeDocument({ documentId: deleteConfirm.id as any });
    } catch (error) {
      console.error("Failed to delete document:", error);
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleView = (url: string | null) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleDownload = (url: string | null) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  const docs = (documents ?? []).filter((doc: any) => doc.reviewStatus !== "pendingReview");

  const filteredDocuments = docs.filter((doc) => {
    const matchesSearch = doc.fileName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Loading state
  if (
    !clerkLoaded ||
    (clerkUser && (convexUser === undefined || (convexUser && patientProfile === undefined)))
  ) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Documents</h1>
          <p className="text-slate-500 text-sm mt-1">
            Securely store and manage your medical records
          </p>
        </div>
        <button
          onClick={() => setUploadDialogOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
        >
          <Plus size={18} />
          Upload Document
        </button>
      </div>

      {/* Security Badge */}
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-slate-800">HIPAA-Compliant Storage</p>
          <p className="text-slate-500">
            Your documents are encrypted and stored securely in compliance with
            healthcare regulations.
          </p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            selectedCategory === "all"
              ? "bg-blue-600 text-white shadow-md shadow-blue-100"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          All Files
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
              selectedCategory === "all"
                ? "bg-white/20"
                : "bg-slate-100"
            }`}
          >
            {docs.length}
          </span>
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = docs.filter((d) => d.category === key).length;
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {config.label}
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  selectedCategory === key
                    ? "bg-white/20"
                    : "bg-slate-100"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 p-1 bg-white">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              viewMode === "grid"
                ? "bg-slate-100 shadow-sm text-slate-800 font-medium"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              viewMode === "list"
                ? "bg-slate-100 shadow-sm text-slate-800 font-medium"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {/* Documents Content */}
      {documents === undefined ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-slate-500">Loading documents...</span>
          </div>
        </div>
      ) : docs.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-3xl border-2 border-dashed transition-all ${
            isDragging
              ? "border-blue-400 bg-blue-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-2xl mb-6 transition-all ${
                isDragging
                  ? "bg-blue-100"
                  : "bg-gradient-to-br from-blue-50 to-indigo-50"
              }`}
            >
              <CloudUpload
                className={`h-10 w-10 transition-all ${
                  isDragging ? "text-blue-600 scale-110" : "text-blue-500"
                }`}
              />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {isDragging ? "Drop your files here" : "No documents yet"}
            </h3>
            <p className="text-slate-500 text-center max-w-md mb-6">
              {isDragging
                ? "Release to upload your medical documents"
                : "Upload your medical documents to keep them organized and accessible. Drag and drop files or click the button below."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setUploadDialogOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
              >
                <Upload size={18} />
                Upload Documents
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
              >
                <FolderOpen size={18} />
                Browse Files
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-6">
              Supported formats: PDF, JPG, PNG &bull; Max file size: 10MB
            </p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => {
            const config = categoryConfig[doc.category];
            const Icon = config.icon;
            return (
              <div
                key={doc._id}
                className="group relative bg-white rounded-2xl border border-slate-100 p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.bg}`}
                  >
                    <Icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <span
                    className={`rounded-full ${config.bg} ${config.color} px-3 py-1 text-xs font-medium`}
                  >
                    {config.label}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800 truncate mb-1">{doc.fileName}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                  <Clock className="h-3 w-3" />
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                  <span>&bull;</span>
                  {doc.fileType}
                </div>
                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleView(doc.url)}
                    className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-500 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(doc.url)}
                    className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-500 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: doc._id, name: doc.fileName })}
                    disabled={deletingId === doc._id}
                    className="flex items-center justify-center w-9 h-9 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === doc._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredDocuments.map((doc, index) => {
            const config = categoryConfig[doc.category];
            const Icon = config.icon;
            return (
              <div
                key={doc._id}
                className={`flex items-center gap-4 p-4 transition-all hover:bg-slate-50 ${
                  index !== filteredDocuments.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
                >
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className={config.color}>
                      {config.label}
                    </span>
                    <span>&bull;</span>
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                    <span>&bull;</span>
                    {doc.fileType}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleView(doc.url)}
                    className="p-2 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(doc.url)}
                    className="p-2 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: doc._id, name: doc.fileName })}
                    disabled={deletingId === doc._id}
                    className="p-2 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === doc._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <h2 className="text-xl font-bold text-slate-800">Upload Document</h2>
              <p className="text-sm text-slate-500 mt-1">
                Add medical documents to your secure health vault
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
              <p className="font-medium text-slate-800 mb-1">Drag and drop your files here</p>
              <p className="text-sm text-slate-500 mb-4">
                or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-all"
              >
                Browse Files
              </button>
            </div>

            {/* Selected Files Display */}
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
                      <span className="truncate flex-1 text-slate-700">{file.name}</span>
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
                <label className="text-sm font-medium text-slate-700">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryConfig).slice(0, 3).map(([key, config]) => {
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
                        <span className="text-xs text-slate-700">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(categoryConfig).slice(3).map(([key, config]) => {
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
                        <span className="text-xs text-slate-700">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-slate-700">
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
                disabled={isUploading || selectedFiles.length === 0 || !uploadCategory}
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Delete Document</h2>
                <p className="text-sm text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteConfirm.name}</span>?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              This will permanently remove the file from storage and the knowledge base.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingId === deleteConfirm.id}
                className="flex-1 bg-white text-slate-700 border border-slate-200 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deletingId === deleteConfirm.id}
                className="flex-1 flex items-center justify-center gap-2 bg-rose-600 text-white py-2.5 rounded-xl font-medium hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {deletingId === deleteConfirm.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deletingId === deleteConfirm.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for browse */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={handleFileSelection}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = docs.filter((d) => d.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`group flex items-center gap-3 bg-white rounded-2xl border p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                selectedCategory === key
                  ? `${config.border} ${config.bg}`
                  : "border-slate-100 hover:border-blue-200"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg}`}
              >
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-slate-800">{count}</p>
                <p className="text-xs text-slate-500">{config.label}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
