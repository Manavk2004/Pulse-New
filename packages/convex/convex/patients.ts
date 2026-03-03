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
    organizationId: v.optional(v.id("organizations")),
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
      organizationId: args.organizationId,
      connected: false,
      showPatient: true,
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
    organizationId: v.optional(v.id("organizations")),
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

// Get patients for a physician (enriched with email)
export const getByPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_assignedPhysician", (q) =>
        q.eq("assignedPhysicianId", args.physicianId)
      )
      .collect();

    const visible = patients.filter((p) => p.showPatient !== false);

    return Promise.all(
      visible.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return { ...p, email: user?.email ?? "" };
      })
    );
  },
});

// Hide patient from physician view (soft delete)
export const hidePatient = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    // Authorization: verify caller is the assigned physician
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const callerUser = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) =>
          q.eq("clerkId", identity.subject)
        )
        .unique();
      if (
        !callerUser ||
        (callerUser.role !== "admin" &&
          callerUser._id !== patient.assignedPhysicianId)
      ) {
        throw new Error("Unauthorized: only the assigned physician or an admin can hide this patient");
      }
    }
    // TODO: Once ConvexProviderWithClerk is configured on the web app,
    // throw an error when identity is null instead of allowing unauthenticated access.

    await ctx.db.patch(args.patientId, { showPatient: false });
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
