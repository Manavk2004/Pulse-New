"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  ArrowLeft,
  Send,
  User,
  Sparkles,
  Stethoscope,
  Loader2,
  FileText,
  Image as ImageIcon,
  Download,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Flame,
  AlertCircle,
} from "lucide-react";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

const SEVERITY_CONFIG: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<any> }
> = {
  urgent: { bg: "bg-red-50", text: "text-red-700", icon: Flame },
  high: { bg: "bg-orange-50", text: "text-orange-700", icon: AlertTriangle },
  medium: { bg: "bg-amber-50", text: "text-amber-700", icon: AlertCircle },
  low: { bg: "bg-blue-50", text: "text-blue-700", icon: Shield },
};

const DOC_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "lab_result", label: "Lab Results" },
  { value: "prescription", label: "Prescriptions" },
  { value: "imaging", label: "Imaging" },
  { value: "notes", label: "Notes" },
  { value: "other", label: "Other" },
];

export default function EscalationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const physicianId = params.physicianId as string;
  const escalationId = params.escalationId as string;

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState("all");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const physicianProfile = useQuery(
    api.physicians.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const detail = useQuery(
    api.escalations.getDetailById,
    escalationId ? { escalationId: escalationId as any } : "skip"
  );

  const messagesResult = useQuery(
    api.agent.threads.getThreadMessages,
    detail?.chat?.threadId
      ? {
          threadId: detail.chat.threadId,
          paginationOpts: { numItems: 200, cursor: null },
        }
      : "skip"
  );

  const messages = useMemo(
    () => [...(messagesResult?.page ?? [])].reverse(),
    [messagesResult?.page]
  );

  const sendPhysicianMessage = useMutation(api.agent.threads.sendPhysicianMessage);
  const acknowledgeMutation = useMutation(api.escalations.acknowledge);
  const resolveMutation = useMutation(api.escalations.resolve);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (!detail?.documents) return [];
    if (docFilter === "all") return detail.documents;
    return detail.documents.filter((d) => d.category === docFilter);
  }, [detail?.documents, docFilter]);

  const selectedDoc = filteredDocs.find((d) => d._id === selectedDocId) ?? filteredDocs[0] ?? null;

  // Auto-acknowledge when physician opens the escalation
  const hasAutoAcked = useRef(false);
  useEffect(() => {
    if (detail && detail.status === "pending" && !hasAutoAcked.current) {
      hasAutoAcked.current = true;
      acknowledgeMutation({ escalationId: detail._id as any });
    }
  }, [detail, acknowledgeMutation]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !detail?.chat?.threadId || !physicianProfile) return;

    setInput("");
    setSendError(null);
    setIsSending(true);
    try {
      await sendPhysicianMessage({
        threadId: detail.chat.threadId,
        content: text,
        physicianName: `${physicianProfile.firstName} ${physicianProfile.lastName}`,
      });
    } catch {
      setInput(text);
      setSendError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcknowledge = async () => {
    if (!detail) return;
    await acknowledgeMutation({ escalationId: detail._id as any });
  };

  const handleResolve = async () => {
    if (!detail) return;
    await resolveMutation({
      escalationId: detail._id as any,
      notes: resolveNotes || undefined,
    });
    setResolveDialogOpen(false);
    setResolveNotes("");
  };

  // Loading state
  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
        <p className="text-slate-500">Escalation not found.</p>
      </div>
    );
  }

  const patient = detail.patient;
  const fullName = patient
    ? `${patient.firstName} ${patient.lastName}`
    : "Unknown Patient";
  const sevConfig = SEVERITY_CONFIG[detail.severity] ?? SEVERITY_CONFIG.low!;
  const SevIcon = sevConfig.icon;
  const isResolved = detail.status === "resolved";

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)]">
      {/* Header Bar */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center gap-4 shrink-0">
        <button
          onClick={() => router.push(`/${physicianId}/escalations`)}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 truncate">
            {fullName}
          </h2>
          <p className="text-xs text-slate-500 truncate">
            {detail.summary ?? detail.reason}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sevConfig.bg} ${sevConfig.text}`}
        >
          <SevIcon size={12} />
          {detail.severity.charAt(0).toUpperCase() + detail.severity.slice(1)}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isResolved && (
            <button
              onClick={() => setResolveDialogOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors"
            >
              <CheckCircle2 size={14} />
              Resolve
            </button>
          )}
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Documents */}
        <div className="w-1/2 border-r border-slate-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Patient Documents
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              {DOC_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setDocFilter(cat.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                    docFilter === cat.value
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <FileText
                  size={40}
                  className="text-slate-300 mb-3"
                />
                <p className="text-sm text-slate-500">No documents found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {docFilter !== "all"
                    ? "Try a different category filter."
                    : "This patient has no uploaded documents."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Document Tabs */}
                <div className="border-b border-slate-100 overflow-x-auto">
                  <div className="flex">
                    {filteredDocs.map((doc) => (
                      <button
                        key={doc._id}
                        onClick={() => setSelectedDocId(doc._id)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                          (selectedDoc?._id ?? filteredDocs[0]?._id) === doc._id
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {doc.fileType.startsWith("image/") ? (
                          <ImageIcon size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                        <span className="max-w-[120px] truncate">
                          {doc.fileName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Viewer */}
                <div className="flex-1 p-4">
                  {selectedDoc ? (
                    selectedDoc.fileType === "application/pdf" ? (
                      <iframe
                        src={selectedDoc.url ?? ""}
                        className="w-full h-full rounded-lg border border-slate-200"
                        title={selectedDoc.fileName}
                      />
                    ) : selectedDoc.fileType.startsWith("image/") ? (
                      <div className="flex items-center justify-center h-full">
                        <img
                          src={selectedDoc.url ?? ""}
                          alt={selectedDoc.fileName}
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <FileText size={48} className="text-slate-300" />
                        <p className="text-sm text-slate-600 font-medium">
                          {selectedDoc.fileName}
                        </p>
                        <a
                          href={selectedDoc.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Download size={16} />
                          Download File
                        </a>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className="w-1/2 flex flex-col bg-[#f8fafc]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages
              .filter(
                (msg) =>
                  msg.message?.role === "user" ||
                  msg.message?.role === "assistant"
              )
              .map((msg) => {
                const isUser = msg.message?.role === "user";
                const content = msg.message?.content;
                const textContent =
                  typeof content === "string"
                    ? content
                    : Array.isArray(content)
                      ? (content as any[])
                          .filter(
                            (c): c is { type: "text"; text: string } =>
                              c.type === "text"
                          )
                          .map((c) => c.text)
                          .join("")
                      : "";
                if (!textContent) return null;

                const isPhysician =
                  !isUser && textContent.startsWith("**Dr.");

                return (
                  <div
                    key={`${msg.order}-${msg.stepOrder}`}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isUser
                          ? "bg-blue-600"
                          : isPhysician
                            ? "bg-gradient-to-br from-emerald-100 to-teal-100"
                            : "bg-gradient-to-br from-blue-100 to-indigo-100"
                      }`}
                    >
                      {isUser ? (
                        <User className="h-4 w-4 text-white" />
                      ) : isPhysician ? (
                        <Stethoscope className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-md"
                          : isPhysician
                            ? "bg-emerald-50 border border-emerald-200 text-slate-800 rounded-tl-md"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {textContent}
                      </p>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {!isResolved ? (
            <div className="border-t border-slate-200 bg-white px-6 py-4">
              {sendError && (
                <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{sendError}</span>
                  <button
                    onClick={() => setSendError(null)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    &times;
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message to the patient..."
                  aria-label="Physician message input"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !input.trim()}
                  aria-label="Send message"
                  className="h-12 w-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Press Enter to send &middot; Shift+Enter for new line
              </p>
            </div>
          ) : (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <p className="text-sm text-slate-600 font-medium">
                This escalation has been resolved.
              </p>
              {detail.notes && (
                <p className="text-xs text-slate-400 mt-1">
                  Notes: {detail.notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resolve Dialog */}
      {resolveDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setResolveDialogOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Resolve Escalation
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Add optional notes before resolving this escalation.
            </p>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes (optional)..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResolveDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
