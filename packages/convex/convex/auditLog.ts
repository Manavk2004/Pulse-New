import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Log an action (internal use for audit trail)
export const log = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

// Public mutation to log actions
export const logAction = mutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

// Query audit logs by user
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

// Query audit logs by resource
export const getByResource = query({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_resourceType", (q) => q.eq("resourceType", args.resourceType))
      .order("desc")
      .take(limit * 10); // Get extra to filter

    return logs
      .filter((log) => log.resourceId === args.resourceId)
      .slice(0, limit);
  },
});

// Query audit logs by action type
export const getByAction = query({
  args: {
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_action", (q) => q.eq("action", args.action))
      .order("desc")
      .take(limit);
  },
});

// Query audit logs within time range
export const getByTimeRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1000;
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit * 10);

    return logs
      .filter(
        (log) =>
          log.timestamp >= args.startTime && log.timestamp <= args.endTime
      )
      .slice(0, limit);
  },
});

// Get recent audit logs (admin view)
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const logs = await ctx.db
      .query("auditLog")
      .order("desc")
      .take(limit);

    // Enrich with user info
    return await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return { ...log, user };
      })
    );
  },
});

// Action types enum (for reference)
export const AUDIT_ACTIONS = {
  // Authentication
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",

  // Patient actions
  PATIENT_PROFILE_VIEW: "patient_profile_view",
  PATIENT_PROFILE_UPDATE: "patient_profile_update",
  PATIENT_CONSENT_UPDATE: "patient_consent_update",

  // Document actions
  DOCUMENT_UPLOAD: "document_upload",
  DOCUMENT_VIEW: "document_view",
  DOCUMENT_DOWNLOAD: "document_download",
  DOCUMENT_DELETE: "document_delete",

  // Chat actions
  CHAT_CREATE: "chat_create",
  CHAT_MESSAGE_SEND: "chat_message_send",
  CHAT_ESCALATE: "chat_escalate",
  CHAT_RESOLVE: "chat_resolve",

  // Escalation actions
  ESCALATION_CREATE: "escalation_create",
  ESCALATION_ACKNOWLEDGE: "escalation_acknowledge",
  ESCALATION_RESOLVE: "escalation_resolve",
} as const;
