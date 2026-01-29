import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get physician by user ID
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("physicians")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Get physician by ID
export const getById = query({
  args: { physicianId: v.id("physicians") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.physicianId);
  },
});

// Create physician profile
export const create = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    specialty: v.string(),
    licenseNumber: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Check if physician profile already exists
    const existing = await ctx.db
      .query("physicians")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      throw new Error("Physician profile already exists");
    }

    return await ctx.db.insert("physicians", {
      userId: args.userId,
      firstName: args.firstName,
      lastName: args.lastName,
      specialty: args.specialty,
      licenseNumber: args.licenseNumber,
      organizationId: args.organizationId,
    });
  },
});

// Update physician profile
export const update = mutation({
  args: {
    physicianId: v.id("physicians"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    specialty: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { physicianId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(physicianId, filteredUpdates);
  },
});

// Get all physicians by specialty
export const getBySpecialty = query({
  args: { specialty: v.string() },
  handler: async (ctx, args) => {
    const physicians = await ctx.db.query("physicians").collect();
    return physicians.filter(
      (p) => p.specialty.toLowerCase() === args.specialty.toLowerCase()
    );
  },
});

// Get all physicians in an organization
export const getByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("physicians")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
  },
});
