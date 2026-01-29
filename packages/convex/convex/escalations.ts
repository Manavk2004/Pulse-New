import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create an escalation
export const create = mutation({
  args: {
    chatId: v.id("chats"),
    patientId: v.id("patients"),
    physicianId: v.id("users"),
    reason: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("escalations", {
      chatId: args.chatId,
      patientId: args.patientId,
      physicianId: args.physicianId,
      reason: args.reason,
      severity: args.severity,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Create an unassigned escalation (when patient has no assigned physician)
export const createUnassigned = mutation({
  args: {
    chatId: v.id("chats"),
    patientId: v.id("patients"),
    reason: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    // Find an available admin or physician to assign
    // For now, find any admin user to handle unassigned escalations
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    // Use the first admin found, or leave unassigned if none exist
    const assignedTo = admins[0]?._id;

    if (!assignedTo) {
      throw new Error(
        "No administrators available to handle escalation. Please contact support."
      );
    }

    return await ctx.db.insert("escalations", {
      chatId: args.chatId,
      patientId: args.patientId,
      physicianId: assignedTo,
      reason: `[UNASSIGNED PATIENT] ${args.reason}`,
      severity: args.severity,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Get escalation by ID
export const getById = query({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.escalationId);
  },
});

// Get escalations for a physician
export const getByPhysician = query({
  args: {
    physicianId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("acknowledged"),
        v.literal("resolved")
      )
    ),
  },
  handler: async (ctx, args) => {
    let escalations = await ctx.db
      .query("escalations")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianId))
      .order("desc")
      .collect();

    if (args.status) {
      escalations = escalations.filter((e) => e.status === args.status);
    }

    // Enrich with patient info
    return await Promise.all(
      escalations.map(async (esc) => {
        const patient = await ctx.db.get(esc.patientId);
        return { ...esc, patient };
      })
    );
  },
});

// Get escalations for a patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalations")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Get pending escalations by severity
export const getPendingBySeverity = query({
  args: {
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    const escalations = await ctx.db
      .query("escalations")
      .withIndex("by_severity", (q) => q.eq("severity", args.severity))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return await Promise.all(
      escalations.map(async (esc) => {
        const patient = await ctx.db.get(esc.patientId);
        const physician = await ctx.db.get(esc.physicianId);
        return { ...esc, patient, physician };
      })
    );
  },
});

// Acknowledge escalation
export const acknowledge = mutation({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
    });
  },
});

// Resolve escalation
export const resolve = mutation({
  args: {
    escalationId: v.id("escalations"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, {
      status: "resolved",
      resolvedAt: Date.now(),
      notes: args.notes,
    });

    // Also resolve the associated chat
    const escalation = await ctx.db.get(args.escalationId);
    if (escalation) {
      await ctx.db.patch(escalation.chatId, {
        status: "resolved",
      });
    }
  },
});
