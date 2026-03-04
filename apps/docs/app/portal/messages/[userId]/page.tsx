"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@repo/convex";
import {
  Send,
  User,
  Sparkles,
  Loader2,
  Info,
  Stethoscope,
  FileText,
  Calendar,
  Phone,
  Plus,
  Trash2,
  MessageSquare,
  AlertCircle,
  X,
} from "lucide-react";

const quickPrompts = [
  { text: "I have a headache", icon: Stethoscope },
  { text: "Explain my lab results", icon: FileText },
  { text: "Questions for my doctor", icon: Calendar },
  { text: "I need urgent help", icon: Phone },
];

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

function MessagesPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUserId = params.userId as string;
  const { user } = useUser();

  // Use authenticated user's ID for queries; skip queries until auth is verified
  const isAuthorized = !user || user.id === urlUserId;
  const userId = user?.id ?? urlUserId;

  const threadIdFromUrl = searchParams.get("thread");
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(
    threadIdFromUrl
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  // Sync URL thread param to state on browser back/forward navigation
  useEffect(() => {
    const urlThreadId = searchParams.get("thread");
    setActiveThreadIdState(urlThreadId);
  }, [searchParams]);

  // Sync state to URL
  const setActiveThreadId = useCallback(
    (threadId: string | null) => {
      setActiveThreadIdState(threadId);
      const url = threadId
        ? `/portal/messages/${userId}?thread=${threadId}`
        : `/portal/messages/${userId}`;
      router.replace(url, { scroll: false });
    },
    [router, userId]
  );
  const [isSending, setIsSending] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const messageCountAtSend = useRef(0);

  // Convex queries and mutations — skip if not authorized
  const chatsResult = useQuery(
    api.chats.listByClerkUser,
    isAuthorized
      ? { clerkId: userId, status: activeFilter === "all" ? undefined : activeFilter }
      : "skip"
  );
  const chats = useMemo(
    () => (chatsResult ?? []).filter((c) => c.threadId),
    [chatsResult]
  );

  const messagesResult = useQuery(
    api.agent.threads.getThreadMessages,
    isAuthorized && activeThreadId
      ? { threadId: activeThreadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip"
  );
  const messages = useMemo(
    () => [...(messagesResult?.page ?? [])].reverse(),
    [messagesResult?.page]
  );

  const createThreadMutation = useMutation(api.agent.threads.createThread);
  const deleteThreadMutation = useMutation(api.agent.threads.deleteThread);
  const sendMessageAction = useAction(api.agent.threads.sendMessage);
  const reopenChatMutation = useMutation(api.chats.reopenByThreadId);

  // Derive active chat status for locking
  const activeChat = chats.find((c) => c.threadId === activeThreadId);
  const isChatLocked = activeChat?.status === "resolved" || activeChat?.status === "escalated";

  // Show the optimistic bubble only until the real message syncs from the DB.
  // Once messages.length increases beyond what it was at send time, the real
  // message has arrived and we hide the optimistic duplicate.
  const showPendingMessage =
    pendingUserMessage && messages.length <= messageCountAtSend.current;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, showPendingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Focus trap and Escape handler for delete confirmation dialog
  useEffect(() => {
    if (!deleteConfirmId) return;

    const dialog = deleteDialogRef.current;
    if (!dialog) return;

    const focusableSelector = "button:not([disabled])";
    const focusableElements = dialog.querySelectorAll<HTMLElement>(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteConfirmId(null);
        return;
      }
      if (e.key === "Tab" && firstFocusable && lastFocusable) {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmId]);

  const handleNewChat = async () => {
    try {
      const threadId = await createThreadMutation({ userId });
      setActiveThreadId(threadId);
    } catch {
      setError("Failed to create conversation.");
    }
  };

  const handleReopenChat = async () => {
    if (!activeThreadId) return;
    try {
      await reopenChatMutation({ threadId: activeThreadId });
    } catch {
      setError("Failed to reopen conversation.");
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await deleteThreadMutation({ threadId });
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
      }
    } catch {
      setError("Failed to delete conversation.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || isSending || !activeThreadId) return;

    setInput("");
    setError(null);
    messageCountAtSend.current = messages.length;
    setPendingUserMessage(text);
    setIsSending(true);
    try {
      await sendMessageAction({
        threadId: activeThreadId,
        content: text,
        userId,
      });
    } catch {
      setError("Failed to send message. Please try again.");
    } finally {
      setPendingUserMessage(null);
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render unauthorized state after all hooks
  if (user && !isAuthorized) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Unauthorized access.</p>
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="text-lg font-semibold text-slate-800 mb-2">
              Delete conversation?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteThread(deleteConfirmId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Thread List */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Chat
          </button>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 mt-3">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeFilter === tab.value
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Start a new chat to begin
              </p>
            </div>
          ) : (
            <div className="py-2">
              {chats.map((chat) => (
                <div
                  key={chat._id}
                  role="button"
                  tabIndex={0}
                  className={`group relative mx-2 mb-1 rounded-lg cursor-pointer transition-all ${
                    activeThreadId === chat.threadId
                      ? "bg-blue-50 border border-blue-200"
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
                  <div className="flex items-center px-3 py-2.5 pr-8">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full shrink-0 ${(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).dot}`}
                        />
                        <p
                          className={`text-sm font-medium truncate ${
                            activeThreadId === chat.threadId
                              ? "text-blue-700"
                              : "text-slate-700"
                          }`}
                        >
                          {chat.title ?? "New Chat"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 ml-3.5">
                        {new Date(chat.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ring-inset ${(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).badge}`}
                    >
                      {(STATUS_CONFIG[chat.status] ?? DEFAULT_STATUS).label}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (chat.threadId) setDeleteConfirmId(chat.threadId);
                    }}
                    aria-label={`Delete conversation: ${chat.title ?? "New Chat"}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col bg-[#f8fafc]">
        {!activeThreadId ? (
          // Empty state
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                AI Health Assistant
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Start a conversation to get help with your health questions. Your
                conversations are saved and available anytime.
              </p>
              <button
                onClick={handleNewChat}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-5 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Start a New Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-800">
                  {chats.find((c) => c.threadId === activeThreadId)?.title ??
                    "New Chat"}
                </h2>
              </div>
            </div>

            {/* Medical Disclaimer */}
            <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-3">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-slate-700">
                  Medical Disclaimer
                </p>
                <p className="text-slate-500">
                  This AI provides general health information only. For medical
                  emergencies, call 911. Always consult your physician for
                  medical advice.
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length === 0 && !isSending && (
                <div className="mt-8">
                  <p className="text-xs text-slate-400 mb-3 text-center">
                    Suggested questions:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => handleSend(prompt.text)}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-blue-200 transition-all"
                      >
                        <prompt.icon className="h-3.5 w-3.5 text-slate-400" />
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        ? content
                            .filter(
                              (c: any): c is { type: "text"; text: string } =>
                                c.type === "text"
                            )
                            .map((c) => c.text)
                            .join("")
                        : "";
                  if (!textContent) return null;
                  return (
                    <div
                      key={`${msg.order}-${msg.stepOrder}`}
                      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isUser
                            ? "bg-blue-600"
                            : "bg-gradient-to-br from-blue-100 to-indigo-100"
                        }`}
                      >
                        {isUser ? (
                          <User className="h-4 w-4 text-white" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isUser
                            ? "bg-blue-600 text-white rounded-tr-md"
                            : "bg-white border border-slate-200 rounded-tl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {textContent}
                        </p>
                      </div>
                    </div>
                  );
                })}

              {/* Optimistic user message (shown instantly before DB sync) */}
              {showPendingMessage && (
                <div className="flex gap-3 flex-row-reverse">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-blue-600 text-white rounded-tr-md">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {pendingUserMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-white border border-slate-200 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-slate-500">
                        Thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area / Locked Banner */}
            {isChatLocked ? (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
                <div className="text-center">
                  <p className="text-sm text-slate-600 font-medium">
                    {activeChat?.status === "escalated"
                      ? "This conversation has been escalated to your physician."
                      : "This conversation has been resolved."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    This chat will be deleted in 24 hours.
                    {activeChat?.status === "escalated"
                      ? " If you'd like to continue chatting with the assistant, press Continue."
                      : " If you need more help, press Continue to reopen."}
                  </p>
                  <button
                    onClick={handleReopenChat}
                    className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex gap-3">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your health question..."
                    aria-label="Message input"
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    disabled={isSending}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={isSending || !input.trim()}
                    aria-label="Send message"
                    className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Press Enter to send &middot; Shift+Enter for new line
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4.5rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  );
}
