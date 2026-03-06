import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// Called by the document summary pipeline to store extracted vitals
export const createFromDocument = internalMutation({
  args: {
    patientId: v.id("patients"),
    documentId: v.id("documents"),
    heartRate: v.optional(v.number()),
    systolicBP: v.optional(v.number()),
    diastolicBP: v.optional(v.number()),
    glucoseLevel: v.optional(v.number()),
    bodyTemperature: v.optional(v.number()),
    extractedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vitals", args);
  },
});

// Get the most recent vitals record for a patient (for dashboard metric cards)
export const getLatestByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vitals")
      .withIndex("by_patientId_extractedAt", (q) =>
        q.eq("patientId", args.patientId)
      )
      .order("desc")
      .first();
  },
});

// Get vitals within a time range for a patient (for chart)
export const getByPatientInRange = query({
  args: {
    patientId: v.id("patients"),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vitals")
      .withIndex("by_patientId_extractedAt", (q) =>
        q.eq("patientId", args.patientId).gte("extractedAt", args.from).lte("extractedAt", args.to)
      )
      .order("asc")
      .collect();
  },
});
