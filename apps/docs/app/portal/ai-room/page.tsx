"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex/convex/_generated/dataModel";
import {
  ArrowLeft,
  Bot,
  Send,
  FileText,
  TestTube,
  Pill,
  Image,
  StickyNote,
  Loader2,
  Sparkles,
  Clock,
  ChevronRight,
  Search,
  Brain,
  ShieldCheck,
  X,
  MessageSquare,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DocumentItem {
  _id: Id<"documents">;
  fileName: string;
  fileType: string;
  category: "lab_result" | "prescription" | "imaging" | "notes" | "other";
  uploadedAt: number;
  aiSummary?: string;
  aiSummaryStatus?: "generating" | "done" | "failed";
  url: string | null;
}

type CategoryStyle = { icon: any; label: string; color: string; bg: string; border: string; gradient: string };

const categoryConfig: Record<DocumentItem["category"], CategoryStyle> = {
  lab_result: {
    icon: TestTube,
    label: "Lab Results",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    gradient: "from-blue-500 to-blue-600",
  },
  prescription: {
    icon: Pill,
    label: "Prescriptions",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-emerald-600",
  },
  imaging: {
    icon: Image,
    label: "Imaging",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    gradient: "from-purple-500 to-purple-600",
  },
  notes: {
    icon: StickyNote,
    label: "Notes",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    gradient: "from-amber-500 to-amber-600",
  },
  other: {
    icon: FileText,
    label: "Other",
    color: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    gradient: "from-slate-500 to-slate-600",
  },
};

export default function AIRoomPage() {
  const router = useRouter();
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
    api.documentAnalysis.getDocumentsWithAnalysis,
    patientProfile ? { patientId: patientProfile._id } : "skip"
  ) as DocumentItem[] | undefined;

  const chatWithDocuments = useAction(api.documentAnalysis.chatWithDocuments);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedDoc, setFocusedDoc] = useState<Id<"documents"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDoc, setExpandedDoc] = useState<Id<"documents"> | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    if (suggestionsOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [suggestionsOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !patientProfile) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatWithDocuments({
        patientId: patientProfile._id,
        question: userMessage,
        conversationHistory: chatMessages,
        ...(focusedDoc ? { focusedDocumentId: focusedDoc } : {}),
      });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const analyzedDocs = (documents ?? []).filter(
    (d) => d.aiSummary && d.aiSummaryStatus === "done"
  );
  const processingDocs = (documents ?? []).filter(
    (d) => d.aiSummaryStatus === "generating"
  );

  const filteredDocs = analyzedDocs.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (
    !clerkLoaded ||
    (clerkUser &&
      (convexUser === undefined ||
        (convexUser && patientProfile === undefined)))
  ) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">
            Loading AI Room...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/portal")}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Brain size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Health AI Room
              </h1>
              <p className="text-slate-500 text-sm">
                Deep analysis of your medical documents
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
            Active
          </span>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Document Analysis Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              Document Analysis
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {analyzedDocs.length} analyzed
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Processing Documents */}
          {processingDocs.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Analyzing {processingDocs.length} document
                    {processingDocs.length > 1 ? "s" : ""}...
                  </p>
                  <p className="text-xs text-blue-600">
                    AI is processing your medical records
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document Cards */}
          <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {filteredDocs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">
                  {documents === undefined
                    ? "Loading documents..."
                    : analyzedDocs.length === 0
                      ? "No analyzed documents yet"
                      : "No matching documents"}
                </h3>
                <p className="text-xs text-slate-500">
                  {analyzedDocs.length === 0
                    ? "Upload medical documents to get AI-powered analysis"
                    : "Try a different search term"}
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const config = categoryConfig[doc.category];
                const Icon = config.icon;
                const isExpanded = expandedDoc === doc._id;
                const isFocused = focusedDoc === doc._id;

                return (
                  <motion.div
                    key={doc._id}
                    layout
                    className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isFocused
                        ? "border-blue-300 ring-2 ring-blue-100 shadow-md"
                        : "border-slate-100 hover:border-blue-200 hover:shadow-sm"
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedDoc(isExpanded ? null : doc._id)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
                        >
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 text-sm truncate">
                              {doc.fileName}
                            </h3>
                            <span
                              className={`shrink-0 rounded-full ${config.bg} ${config.color} px-2 py-0.5 text-[10px] font-medium`}
                            >
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                            <span className="flex items-center gap-1 text-emerald-600">
                              <Sparkles className="h-3 w-3" />
                              AI Analyzed
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className={`text-slate-300 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>

                    {/* Expanded Analysis */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-4 pb-4 space-y-3">
                            <div className="border-t border-slate-100 pt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                  AI Analysis
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed">
                                {doc.aiSummary}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusedDoc(
                                    isFocused ? null : doc._id
                                  );
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-all ${
                                  isFocused
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                {isFocused
                                  ? "Focused in Chat"
                                  : "Ask About This"}
                              </button>
                              {doc.url && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(doc.url!, "_blank");
                                  }}
                                  className="flex items-center justify-center gap-2 text-xs font-medium py-2 px-3 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  View
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px] max-h-[calc(100vh-220px)]">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-200">
              <Bot size={18} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">
                Pulse Document Analyst
              </h3>
              <p className="text-xs text-slate-500">
                {focusedDoc
                  ? `Focused on: ${analyzedDocs.find((d) => d._id === focusedDoc)?.fileName ?? "document"}`
                  : `Analyzing ${analyzedDocs.length} document${analyzedDocs.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {focusedDoc && (
              <button
                onClick={() => setFocusedDoc(null)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all"
              >
                <X size={12} />
                Clear Focus
              </button>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl flex items-center justify-center mb-6">
                  <Brain className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                  Ask About Your Documents
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                  I have access to all your medical documents and can help you
                  understand your health records in detail.
                </p>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {[
                    "Summarize all my medical documents",
                    "What are my latest lab results?",
                    "Are there any concerning trends?",
                    "Explain my medications and their purposes",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="text-left text-xs bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl px-3 py-2.5 transition-all"
                    >
                      <span className="text-blue-500 mr-1.5">→</span>
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Security Badge */}
                <div className="flex items-center gap-2 mt-6 text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>
                    End-to-end encrypted &bull; HIPAA compliant
                  </span>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-50 border border-slate-200 text-slate-700"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <Bot size={14} className="text-blue-500" />
                        <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">
                          Pulse AI
                        </span>
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-blue-500" />
                    <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">
                      Pulse AI
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-500">
                      Analyzing your documents...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-slate-100 p-4 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              {/* Suggested Questions Button */}
              <div className="relative" ref={suggestionsRef}>
                <button
                  onClick={() => setSuggestionsOpen(!suggestionsOpen)}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-all shrink-0 ${
                    suggestionsOpen
                      ? "bg-amber-50 border-amber-300 text-amber-600"
                      : "bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50"
                  }`}
                  title="Suggested questions"
                >
                  <Lightbulb size={18} />
                </button>
                <AnimatePresence>
                  {suggestionsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-14 left-0 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 space-y-1 z-50"
                    >
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
                        Suggested Questions
                      </p>
                      {[
                        "Summarize all my medical documents",
                        "What are my latest lab results?",
                        "Are there any concerning trends in my records?",
                        "Explain my medications and their purposes",
                        "What do my vital signs indicate?",
                        "Are there any drug interactions I should know about?",
                        "What preventive screenings should I consider?",
                        "Explain my diagnosis in simple terms",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => {
                            setInputValue(prompt);
                            setSuggestionsOpen(false);
                            inputRef.current?.focus();
                          }}
                          className="w-full text-left text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 transition-all flex items-start gap-2"
                        >
                          <span className="text-blue-400 mt-0.5 shrink-0">→</span>
                          {prompt}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  focusedDoc
                    ? "Ask about the focused document..."
                    : "Ask about your medical documents..."
                }
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:shadow-none shrink-0"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              AI-powered analysis is for informational purposes only. Always
              consult your physician for medical decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
