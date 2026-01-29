import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new chat session
export const create = mutation({
  args: {
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chats", {
      patientId: args.patientId,
      status: "active",
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
      status: "active",
      createdAt: now,
    });

    // Query all active chats for this patient to detect duplicates.
    // This read establishes a dependency on the index range for Convex's OCC.
    const allActiveChats = await ctx.db
      .query("chats")
      .withIndex("by_patientId_status", (q) =>
        q.eq("patientId", args.patientId).eq("status", "active")
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
