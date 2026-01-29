"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@repo/ui/button";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Info,
  AlertCircle,
  Stethoscope,
  FileText,
  Calendar,
  Phone,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const quickPrompts = [
  { text: "I have a headache", icon: Stethoscope },
  { text: "Explain my lab results", icon: FileText },
  { text: "Questions for my doctor", icon: Calendar },
  { text: "I need urgent help", icon: Phone },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Pulse AI Health Assistant. I'm here to help you understand your health better.\n\nI can assist with:\n• Understanding symptoms\n• Explaining medical documents\n• Preparing for doctor visits\n• Answering health questions\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) {
        clearTimeout(simulationTimerRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback: could show a toast notification here
    }
  };

  const handleSubmit = async (e: React.FormEvent, customMessage?: string) => {
    e.preventDefault();
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Clear any existing timer before scheduling a new one
    if (simulationTimerRef.current) {
      clearTimeout(simulationTimerRef.current);
    }

    // Simulate AI response
    simulationTimerRef.current = setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getSimulatedResponse(messageText),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
      simulationTimerRef.current = null;
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickPrompt = (text: string) => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    handleSubmit(fakeEvent, text);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content:
          "Hello! I'm your Pulse AI Health Assistant. I'm here to help you understand your health better.\n\nI can assist with:\n• Understanding symptoms\n• Explaining medical documents\n• Preparing for doctor visits\n• Answering health questions\n\nHow can I help you today?",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Health Assistant</h1>
          <p className="text-muted-foreground text-sm">
            Powered by advanced AI • Available 24/7
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="rounded-xl"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
        <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Medical Disclaimer</p>
          <p className="text-muted-foreground">
            This AI provides general health information only. For medical emergencies, call 911.
            Always consult your physician for medical advice.
          </p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  message.role === "user"
                    ? "bg-primary"
                    : "bg-gradient-to-br from-primary/20 to-secondary/20"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`group relative max-w-[80%] ${
                  message.role === "user" ? "items-end" : ""
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-md"
                      : "bg-muted/50 rounded-tl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-2 mt-1.5 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.role === "assistant" && (
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleQuickPrompt(prompt.text)}
                  className="flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm hover:bg-muted hover:border-primary/30 transition-all"
                >
                  <prompt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border/50 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your health question..."
                rows={1}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-xl shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

function getSimulatedResponse(input: string): string {
  const lowerInput = input.toLowerCase();

  if (
    lowerInput.includes("emergency") ||
    lowerInput.includes("911") ||
    lowerInput.includes("urgent")
  ) {
    return "🚨 **If you're experiencing a medical emergency, please call 911 immediately.**\n\nI've noted your urgent concern. While I can provide general guidance, emergency situations require immediate professional medical attention.\n\nIf this is not a life-threatening emergency but you need to speak with a physician soon, I can help escalate your concern to your care team.";
  }

  if (lowerInput.includes("headache")) {
    return "I understand you're experiencing a headache. Let me help you assess this.\n\n**Quick Questions:**\n1. How long have you had this headache?\n2. Where is the pain located (front, back, sides)?\n3. Rate the pain from 1-10\n4. Any other symptoms (nausea, light sensitivity, vision changes)?\n\n**General Guidance:**\n• Stay hydrated and rest in a quiet, dark room\n• Over-the-counter pain relievers may help\n• Track when headaches occur to identify triggers\n\n⚠️ **Seek immediate care if:**\n• Sudden, severe headache (\"worst headache of your life\")\n• Headache with fever, stiff neck, or confusion\n• Headache after head injury";
  }

  if (lowerInput.includes("lab") || lowerInput.includes("result")) {
    return "I'd be happy to help you understand your lab results! 📋\n\n**To get started:**\n1. Upload your lab results in the Documents section\n2. Share specific values you'd like explained\n3. I'll provide context on what they mean\n\n**Common lab tests I can explain:**\n• Complete Blood Count (CBC)\n• Metabolic Panel (BMP/CMP)\n• Lipid Panel (cholesterol)\n• Thyroid Function Tests\n• Hemoglobin A1C\n\nWhich results would you like to discuss?";
  }

  if (lowerInput.includes("doctor") || lowerInput.includes("visit") || lowerInput.includes("question")) {
    return "Great idea to prepare for your visit! Here's a helpful framework:\n\n**Before Your Appointment:**\n\n📝 **Symptoms Log**\n• When did they start?\n• How often do they occur?\n• What makes them better/worse?\n\n💊 **Current Medications**\n• Prescriptions\n• Supplements\n• Over-the-counter drugs\n\n❓ **Questions to Ask**\n• What could be causing my symptoms?\n• What tests do you recommend?\n• What are my treatment options?\n• When should I follow up?\n\nWould you like help organizing any specific concerns?";
  }

  return "Thank you for your question. I'm here to help with general health information.\n\nI can assist with:\n• **Symptom Assessment** - Describe what you're experiencing\n• **Lab Results** - Upload and I'll help explain them\n• **Visit Preparation** - Questions to ask your doctor\n• **Health Education** - Learn about conditions and treatments\n\n*Please note: I provide information only, not medical diagnoses or treatment recommendations. Always consult your healthcare provider for personalized medical advice.*\n\nWhat would you like to explore?";
}
