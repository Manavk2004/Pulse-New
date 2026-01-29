"use client";

import { useState, useRef } from "react";
import { Button } from "@repo/ui/button";
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
  Check,
  CloudUpload,
  Shield,
  Clock,
  Grid3X3,
  List,
  ChevronRight,
  File,
} from "lucide-react";

interface Document {
  id: string;
  fileName: string;
  category: "lab_result" | "prescription" | "imaging" | "notes" | "other";
  uploadedAt: Date;
  fileType: string;
  size: string;
}

const categoryConfig = {
  lab_result: {
    icon: TestTube,
    label: "Lab Results",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  prescription: {
    icon: Pill,
    label: "Prescriptions",
    color: "text-secondary",
    bg: "bg-secondary/10",
    border: "border-secondary/20",
  },
  imaging: {
    icon: Image,
    label: "Imaging",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  notes: {
    icon: StickyNote,
    label: "Notes",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
  },
  other: {
    icon: FileText,
    label: "Other",
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFiles([]);
    setUploadCategory(null);
    setUploadDescription("");
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !uploadCategory) {
      return;
    }

    setIsUploading(true);
    try {
      // TODO: Implement actual file upload via Convex
      // const uploadUrl = await getUploadUrl();
      // await uploadFiles(selectedFiles, uploadUrl);
      // await createDocumentRecords(selectedFiles, uploadCategory, uploadDescription);
      console.log("Uploading files:", selectedFiles, "Category:", uploadCategory);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate adding documents to state
      const newDocs: Document[] = selectedFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        fileName: file.name,
        category: uploadCategory as Document["category"],
        uploadedAt: new Date(),
        fileType: file.type,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      }));
      setDocuments((prev) => [...newDocs, ...prev]);

      closeUploadDialog();
    } catch (error) {
      console.error("Failed to upload files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
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
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground text-sm">
            Securely store and manage your medical records
          </p>
        </div>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Security Badge */}
      <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/20 p-4">
        <Shield className="h-5 w-5 text-success shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-foreground">HIPAA-Compliant Storage</p>
          <p className="text-muted-foreground">
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
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          All Files
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
              selectedCategory === "all"
                ? "bg-white/20"
                : "bg-background"
            }`}
          >
            {documents.length}
          </span>
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = documents.filter((d) => d.category === key).length;
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {config.label}
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  selectedCategory === key
                    ? "bg-white/20"
                    : "bg-background"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/30 pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex rounded-xl border border-border/50 p-1 bg-muted/30">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              viewMode === "grid"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              viewMode === "list"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {/* Documents Content */}
      {documents.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed transition-all ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/50 bg-card"
          }`}
        >
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-2xl mb-6 transition-all ${
                isDragging
                  ? "bg-primary/10"
                  : "bg-gradient-to-br from-primary/10 to-secondary/10"
              }`}
            >
              <CloudUpload
                className={`h-10 w-10 transition-all ${
                  isDragging ? "text-primary scale-110" : "text-primary/70"
                }`}
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {isDragging ? "Drop your files here" : "No documents yet"}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {isDragging
                ? "Release to upload your medical documents"
                : "Upload your medical documents to keep them organized and accessible. Drag and drop files or click the button below."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="rounded-xl"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={handleFileSelection}
            />
            <p className="text-xs text-muted-foreground mt-6">
              Supported formats: PDF, JPG, PNG • Max file size: 10MB
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
                key={doc.id}
                className="group relative rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
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
                <h3 className="font-semibold truncate mb-1">{doc.fileName}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <Clock className="h-3 w-3" />
                  {doc.uploadedAt.toLocaleDateString()}
                  <span className="text-border">•</span>
                  {doc.size}
                </div>
                <div className="flex gap-2 pt-4 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-lg hover:bg-primary/10 hover:text-primary"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-lg hover:bg-primary/10 hover:text-primary"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          {filteredDocuments.map((doc, index) => {
            const config = categoryConfig[doc.category];
            const Icon = config.icon;
            return (
              <div
                key={doc.id}
                className={`flex items-center gap-4 p-4 transition-all hover:bg-muted/50 ${
                  index !== filteredDocuments.length - 1
                    ? "border-b border-border/50"
                    : ""
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
                >
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span
                      className={`${config.color}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-border">•</span>
                    {doc.uploadedAt.toLocaleDateString()}
                    <span className="text-border">•</span>
                    {doc.size}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg hover:bg-primary/10 hover:text-primary"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg hover:bg-primary/10 hover:text-primary"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={closeUploadDialog}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-slide-up">
            <button
              onClick={closeUploadDialog}
              className="absolute right-4 top-4 rounded-lg p-2 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-semibold">Upload Document</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add medical documents to your secure health vault
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-all mb-6 ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex justify-center mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <CloudUpload className="h-7 w-7 text-primary" />
                </div>
              </div>
              <p className="font-medium mb-1">Drag and drop your files here</p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg"
              >
                Browse Files
              </Button>
            </div>

            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium">
                  Selected Files ({selectedFiles.length})
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm"
                    >
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
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
                <label className="text-sm font-medium">Category</label>
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
                            ? `${config.border} ${config.bg} ring-2 ring-primary/20`
                            : "border-border/50 hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="text-xs">{config.label}</span>
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
                            ? `${config.border} ${config.bg} ring-2 ring-primary/20`
                            : "border-border/50 hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <span className="text-xs">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description (optional)
                </label>
                <input
                  id="description"
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of the document"
                  className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={closeUploadDialog}
                disabled={isUploading}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0 || !uploadCategory}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = documents.filter((d) => d.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`group flex items-center gap-3 rounded-2xl border p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                selectedCategory === key
                  ? `${config.border} ${config.bg}`
                  : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg}`}
              >
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
