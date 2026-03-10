import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Export a chat from patient to a specific physician
export const exportChat = mutation({
  args: {
    patientId: v.id("patients"),
    physicianUserId: v.id("users"),
    title: v.string(),
    summary: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    messageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    // Verify the caller owns this patient record
    const patient = await ctx.db.get(args.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser || callerUser._id !== patient.userId) {
      throw new Error("Unauthorized: You can only export your own chats");
    }

    return await ctx.db.insert("exportedChats", {
      patientId: args.patientId,
      physicianUserId: args.physicianUserId,
      title: args.title,
      summary: args.summary,
      messages: args.messages,
      messageCount: args.messageCount,
      exportedAt: Date.now(),
      read: false,
    });
  },
});

// Get exported chats for a specific patient+physician pair (physician view)
export const getByPatientAndPhysician = query({
  args: {
    patientId: v.id("patients"),
    physicianUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify the caller is the specified physician
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser || callerUser._id !== args.physicianUserId) {
      return [];
    }

    return await ctx.db
      .query("exportedChats")
      .withIndex("by_patientId_physicianUserId", (q) =>
        q.eq("patientId", args.patientId).eq("physicianUserId", args.physicianUserId)
      )
      .order("desc")
      .collect();
  },
});

// Mark an exported chat as read
export const markAsRead = mutation({
  args: { chatId: v.id("exportedChats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // Verify the caller is the intended physician recipient
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser || callerUser._id !== chat.physicianUserId) {
      throw new Error("Unauthorized: Only the recipient physician can mark as read");
    }

    await ctx.db.patch(args.chatId, { read: true });
  },
});

// Get connected physicians for a patient (for the export picker)
export const getConnectedPhysicians = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId_status", (q) =>
        q.eq("patientId", args.patientId).eq("status", "accepted")
      )
      .collect();

    return Promise.all(
      requests.map(async (r) => {
        const physician = await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", r.physicianId))
          .unique();
        return {
          userId: r.physicianId,
          name: physician
            ? `Dr. ${physician.firstName} ${physician.lastName}`
            : "Unknown Physician",
          specialty: physician?.specialty ?? "",
        };
      })
    );
  },
});
