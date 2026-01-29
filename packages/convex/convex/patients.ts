import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get patient by user ID
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Get patient by ID
export const getById = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});

// Create patient profile
export const create = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.string(),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if patient already exists
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      throw new Error("Patient profile already exists");
    }

    return await ctx.db.insert("patients", {
      userId: args.userId,
      firstName: args.firstName,
      lastName: args.lastName,
      dateOfBirth: args.dateOfBirth,
      phoneNumber: args.phoneNumber,
      consentStatus: "pending",
    });
  },
});

// Update patient profile
export const update = mutation({
  args: {
    patientId: v.id("patients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        relationship: v.string(),
        phoneNumber: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { patientId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(patientId, filteredUpdates);
  },
});

// Update consent status
export const updateConsent = mutation({
  args: {
    patientId: v.id("patients"),
    consentStatus: v.union(
      v.literal("pending"),
      v.literal("granted"),
      v.literal("revoked")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, {
      consentStatus: args.consentStatus,
      consentTimestamp: Date.now(),
    });
  },
});

// Assign physician to patient
export const assignPhysician = mutation({
  args: {
    patientId: v.id("patients"),
    physicianId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify physician exists and has correct role
    const physician = await ctx.db.get(args.physicianId);
    if (!physician || physician.role !== "physician") {
      throw new Error("Invalid physician ID");
    }

    await ctx.db.patch(args.patientId, {
      assignedPhysicianId: args.physicianId,
    });
  },
});

// Get patients for a physician
export const getByPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .withIndex("by_assignedPhysician", (q) =>
        q.eq("assignedPhysicianId", args.physicianId)
      )
      .collect();
  },
});

// Search patients by name
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const results = await ctx.db
      .query("patients")
      .withSearchIndex("search_name", (q) => q.search("firstName", args.query))
      .take(50);

    return results;
  },
});
