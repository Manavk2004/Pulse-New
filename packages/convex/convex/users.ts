import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Create or update user from Clerk webhook
export const upsertFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("patient"), v.literal("physician"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    const now = Date.now();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        lastLoginAt: now,
      });
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      role: args.role,
      createdAt: now,
      lastLoginAt: now,
    });
  },
});

// Update user role (admin only)
export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("patient"), v.literal("physician"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Not authenticated");
    }

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!callerUser) {
      throw new Error("Unauthorized: User not found");
    }

    if (callerUser.role !== "admin") {
      throw new Error("Unauthorized: Only admins can update user roles");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// Get all physicians
export const getPhysicians = query({
  handler: async (ctx) => {
    const physicians = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "physician"))
      .collect();

    // Get physician profiles
    const physicianProfiles = await Promise.all(
      physicians.map(async (user) => {
        const profile = await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();
        return { user, profile };
      })
    );

    return physicianProfiles;
  },
});
