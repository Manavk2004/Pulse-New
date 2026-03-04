"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Send,
  User,
  Sparkles,
  Stethoscope,
  Loader2,
  Plus,
  MessageSquare,
  AlertCircle,
  X,
  Search,
} from "lucide-react";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

type StatusFilter = "all" | "unresolved" | "escalated" | "resolved";

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  unresolved: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 ring-blue-200", label: "Unresolved" },
  escalated: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-200", label: "Escalated" },
  resolved: { dot: "bg-green-500", badge: "bg-green-50 text-green-700 ring-green-200", label: "Resolved" },
};

const DEFAULT_STATUS = { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-600 ring-slate-200", label: "Unknown" };

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unresolved", label: "Unresolved" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
];

function PhysicianMessagesInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const physicianId = params.physicianId as string;

  const threadIdFromUrl = searchParams.get("thread");
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(threadIdFromUrl);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [isSending, setIsSending] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync URL thread param to state on browser back/forward
  useEffect(() => {
    setActiveThreadIdState(searchParams.get("thread"));
  }, [searchParams]);

  // Sync state to URL
  const setActiveThreadId = useCallback(
    (threadId: string | null) => {
      setActiveThreadIdState(threadId);
      const url = threadId
        ? `/${physicianId}/messages?thread=${threadId}`
        : `/${physicianId}/messages`;
      router.replace(url, { scroll: false });
    },
    [router, physicianId]
  );

  // Queries
  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );
  const physicianProfile = useQuery(
    api.physicians.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );
  const chatsResult = useQuery(
    api.chats.listForPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );
  const patients = useQuery(
    api.patients.getByPhysician,
    convexUser ? { physicianId: convexUser._id } : "skip"
  );

  const allChats = useMemo(() => chatsResult ?? [], [chatsResult]);
  const filteredChats = useMemo(
    () => activeFilter === "all" ? allChats : allChats.filter((c) => c.status === activeFilter),
    [allChats, activeFilter]
  );

  const messagesResult = useQuery(
    api.agent.threads.getThreadMessages,
    activeThreadId
      ? { threadId: activeThreadId, paginationOpts: { numItems: 200, cursor: null } }
      : "skip"
  );
  const messages = useMemo(
    () => [...(messagesResult?.page ?? [])].reverse(),
    [messagesResult?.page]
  );

  const activeChat = allChats.find((c) => c.threadId === activeThreadId);

  // Mutations
  const sendPhysicianMessage = useMutation(api.agent.threads.sendPhysicianMessage);
  const createPhysicianThread = useMutation(api.agent.threads.createPhysicianThread);

  // Filtered patients for picker
  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    const query = patientSearch.toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(query) ||
        p.lastName.toLowerCase().includes(query)
    );
  }, [patients, patientSearch]);

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

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !activeThreadId || !physicianProfile) return;

    setInput("");
    setError(null);
    setIsSending(true);
    try {
      await sendPhysicianMessage({
        threadId: activeThreadId,
        content: text,
        physicianName: `${physicianProfile.firstName} ${physicianProfile.lastName}`,
      });
    } catch {
      setInput(text);
      setError("Failed to send message. Please try again.");
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

  const handleSelectPatient = async (patientId: string) => {
    if (!convexUser) return;
    setShowPatientPicker(false);
    setPatientSearch("");
    try {
      const threadId = await createPhysicianThread({
        physicianUserId: convexUser._id,
        patientId: patientId as any,
      });
      setActiveThreadId(threadId);
    } catch {
      setError("Failed to create conversation.");
    }
  };

  // Loading state
  if (convexUser === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  // User not found
  if (convexUser === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] overflow-hidden">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl shadow-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 p-0.5 hover:bg-red-100 rounded"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Patient Picker Modal */}
      {showPatientPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setShowPatientPicker(false);
            setPatientSearch("");
          }}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-1">
              New Message
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Select a patient to start a conversation.
            </p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patients..."
                className="w-full border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No patients found.
                </p>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => handleSelectPatient(patient._id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <User className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {patient.firstName} {patient.lastName}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-slate-400 truncate">
                          {patient.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowPatientPicker(false);
                  setPatientSearch("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Chat List */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => setShowPatientPicker(true)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Message
          </button>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 mt-3">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeFilter === tab.value
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Start a new message to begin
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filteredChats.map((chat) => (
                <div
                  key={chat._id}
                  role="button"
                  tabIndex={0}
                  className={`group relative mx-2 mb-1 rounded-lg cursor-pointer transition-all ${
                    activeThreadId === chat.threadId
                      ? "bg-emerald-50 border border-emerald-200"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                  onClick={() => chat.threadId && setActiveThreadId(chat.threadId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      chat.threadId && setActiveThreadId(chat.threadId);
                    }
                  }}
                >
                  <div className="flex items-center px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full shrink-0 ${(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).dot}`}
                        />
                        <p
                          className={`text-sm font-medium truncate ${
                            activeThreadId === chat.threadId
                              ? "text-emerald-700"
                              : "text-slate-700"
                          }`}
                        >
                          {chat.patientName}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 ml-3.5 truncate">
                        {chat.title ?? "Direct Message"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 ml-3.5">
                        {new Date(chat.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-inset ${(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).badge}`}
                    >
                      {(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col bg-[#f8fafc]">
        {!activeThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                <Stethoscope className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Patient Messages
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Select a conversation from the sidebar or start a new message to
                communicate directly with your patients.
              </p>
              <button
                onClick={() => setShowPatientPicker(true)}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-5 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                New Message
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    {activeChat?.patientName ?? "Patient"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeChat?.title ?? "Direct Message"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
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

                  // Strip the **Dr. Name:** prefix for clean display
                  let displayText = textContent;
                  let physicianName = "";
                  if (isPhysician) {
                    const match = textContent.match(/^\*\*Dr\.\s+(.+?):\*\*\s*/);
                    if (match) {
                      physicianName = `Dr. ${match[1]}`;
                      displayText = textContent.slice(match[0].length);
                    }
                  }

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
                        {isPhysician && physicianName && (
                          <p className="text-xs font-semibold text-emerald-700 mb-1">
                            {physicianName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {displayText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 bg-white px-6 py-4">
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
          </>
        )}
      </div>
    </div>
  );
}

export default function PhysicianMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <PhysicianMessagesInner />
    </Suspense>
  );
}
