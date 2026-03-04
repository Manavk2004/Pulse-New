import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Create a new chat session
export const create = mutation({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chats", {
      patientId: args.patientId,
      status: "unresolved",
      createdAt: Date.now(),
    });
  },
});

// Get active chat for patient (or create one)
// Handles TOCTOU race conditions via insert-first-then-deduplicate pattern.
// Convex doesn't support unique constraints on arbitrary fields, so we enforce
// uniqueness by always checking for duplicates after insert and cleaning up.
// Convex's OCC (serializable isolation) helps prevent most races, but concurrent
// mutations can still slip through if they don't read overlapping data ranges.
export const getOrCreateForPatient = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Always insert first to establish our claim with a timestamp.
    // This insert-first approach ensures we don't lose in a race where
    // two calls both see "no active chat" and both try to create.
    const newChatId = await ctx.db.insert("chats", {
      patientId: args.patientId,
      status: "unresolved",
      createdAt: now,
    });

    // Query all active chats for this patient to detect duplicates.
    // This read establishes a dependency on the index range for Convex's OCC.
    const allActiveChats = await ctx.db
      .query("chats")
      .withIndex("by_patientId_status", (q) =>
        q.eq("patientId", args.patientId).eq("status", "unresolved")
      )
      .collect();

    // If only one active chat exists (the one we just created), we're done
    if (allActiveChats.length === 1) {
      return newChatId;
    }

    // Multiple active chats exist - deduplicate by keeping the earliest.
    // Sort by createdAt, then by _id for deterministic tiebreaker.
    allActiveChats.sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a._id < b._id ? -1 : 1;
    });

    const keepChat = allActiveChats[0]!;

    // Delete all duplicates
    for (const chat of allActiveChats.slice(1)) {
      await ctx.db.delete(chat._id);
    }

    return keepChat._id;
  },
});

// Get chat by ID
export const getById = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  },
});

// Get chat by threadId (internal — used by sendMessage to check status)
export const getByThreadId = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
  },
});

// Get all chats for a patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Get escalated chats for a physician
export const getEscalatedForPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_escalatedTo", (q) => q.eq("escalatedTo", args.physicianId))
      .filter((q) => q.eq(q.field("status"), "escalated"))
      .collect();
  },
});

// Escalate chat
export const escalate = mutation({
  args: {
    chatId: v.id("chats"),
    physicianId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, {
      status: "escalated",
      escalatedAt: Date.now(),
      escalatedTo: args.physicianId,
    });
  },
});

// Resolve chat
export const resolve = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, {
      status: "resolved",
    });
  },
});

// Get messages for a chat
export const getMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

// List chats for a user by their Clerk ID with optional status filter
export const listByClerkUser = query({
  args: {
    clerkId: v.string(),
    status: v.optional(
      v.union(v.literal("unresolved"), v.literal("escalated"), v.literal("resolved"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return [];

    if (args.status) {
      return await ctx.db
        .query("chats")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// Escalate a chat by its threadId (called by the AI agent tool)
export const escalateByThreadId = internalMutation({
  args: {
    threadId: v.string(),
    reason: v.string(),
    severity: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!chat) {
      throw new Error("Chat not found for the given thread.");
    }

    // Look up the patient to find their assigned physician
    const patient = await ctx.db.get(chat.patientId);
    if (!patient) {
      throw new Error("Patient record not found.");
    }

    // Resolve the assignee before changing chat status
    let assigneeId = patient.assignedPhysicianId;
    let escalationReason = args.reason;

    if (!assigneeId) {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect();
      assigneeId = admins[0]?._id;
      if (!assigneeId) {
        throw new Error("No physician assigned and no admin available to handle escalation.");
      }
      escalationReason = `[UNASSIGNED PATIENT] ${args.reason}`;
    }

    // Use AI-determined severity if provided, otherwise fall back to keyword heuristic
    let severity: "low" | "medium" | "high" | "urgent" = args.severity ?? "low";
    if (!args.severity) {
      const lowerReason = args.reason.toLowerCase();
      const urgentKeywords = ["chest pain", "heart attack", "stroke", "difficulty breathing", "severe bleeding", "unconscious", "suicide", "overdose", "cancer", "tumor", "tumors", "seizure", "anaphylaxis", "not breathing"];
      const highKeywords = ["severe pain", "high fever", "infection", "allergic reaction", "swelling", "vomiting blood", "lump", "lumps", "blood in stool", "blood in urine", "sudden weight loss", "persistent cough"];
      const mediumKeywords = ["persistent pain", "worsening", "medication concern", "new symptoms", "fever", "dizziness", "numbness", "rash"];

      if (urgentKeywords.some((kw) => lowerReason.includes(kw))) {
        severity = "urgent";
      } else if (highKeywords.some((kw) => lowerReason.includes(kw))) {
        severity = "high";
      } else if (mediumKeywords.some((kw) => lowerReason.includes(kw))) {
        severity = "medium";
      }
    }

    // Update chat status to escalated
    await ctx.db.patch(chat._id, {
      status: "escalated",
      escalatedAt: Date.now(),
      escalatedTo: assigneeId,
    });

    // Create an escalation record
    const escalationId = await ctx.db.insert("escalations", {
      chatId: chat._id,
      patientId: chat.patientId,
      physicianId: assigneeId,
      reason: escalationReason,
      severity,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule AI summary generation for the escalation
    await ctx.scheduler.runAfter(0, internal.escalations.generateSummary, {
      escalationId,
      threadId: args.threadId,
    });

    return { escalated: true, chatId: chat._id };
  },
});

// Resolve a chat by its threadId (called by the AI agent tool)
export const resolveByThreadId = internalMutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!chat) {
      throw new Error("Chat not found for the given thread.");
    }

    await ctx.db.patch(chat._id, {
      status: "resolved",
    });

    // Also resolve any pending escalation for this chat
    const pendingEscalation = await ctx.db
      .query("escalations")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .filter((q) => q.neq(q.field("status"), "resolved"))
      .first();
    if (pendingEscalation) {
      await ctx.db.patch(pendingEscalation._id, {
        status: "resolved",
        resolvedAt: Date.now(),
      });
    }

    return { resolved: true, chatId: chat._id };
  },
});

// Reopen a resolved or escalated chat by its threadId
export const reopenByThreadId = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated.");
    }

    const chat = await ctx.db
      .query("chats")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!chat) {
      throw new Error("Chat not found for the given thread.");
    }

    // Verify ownership
    if (chat.userId) {
      const user = await ctx.db.get(chat.userId);
      if (!user || user.clerkId !== identity.subject) {
        throw new Error("Not authorized to reopen this chat.");
      }
    }

    await ctx.db.patch(chat._id, {
      status: "unresolved",
      escalatedAt: undefined,
      escalatedTo: undefined,
    });

    return chat._id;
  },
});

// Add a message to chat
export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    metadata: v.optional(
      v.object({
        toolCalls: v.optional(v.array(v.any())),
        escalationInfo: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});
