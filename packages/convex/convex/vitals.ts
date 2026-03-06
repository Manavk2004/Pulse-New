import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

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

// Manually update or create a vitals record for a patient
// Pass number fields to set, list field names in clearFields to remove them
export const upsertManual = mutation({
  args: {
    patientId: v.id("patients"),
    heartRate: v.optional(v.number()),
    systolicBP: v.optional(v.number()),
    diastolicBP: v.optional(v.number()),
    glucoseLevel: v.optional(v.number()),
    bodyTemperature: v.optional(v.number()),
    clearFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser) throw new Error("Unauthorized");

    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    const isPatient = patient.userId === callerUser._id;
    const isAssignedPhysician =
      callerUser.role === "physician" &&
      patient.assignedPhysicianId === callerUser._id;

    if (!isPatient && !isAssignedPhysician && callerUser.role !== "admin") {
      throw new Error("Unauthorized: insufficient permissions to modify vitals");
    }

    const { patientId, clearFields, ...fields } = args;
    const vitalKeys = ["heartRate", "systolicBP", "diastolicBP", "glucoseLevel", "bodyTemperature"] as const;
    const toClear = new Set(clearFields ?? []);

    const existing = await ctx.db
      .query("vitals")
      .withIndex("by_patientId_extractedAt", (q) =>
        q.eq("patientId", patientId)
      )
      .order("desc")
      .first();

    if (existing) {
      const replacement: Record<string, any> = {
        patientId: existing.patientId,
        extractedAt: existing.extractedAt,
      };
      if (existing.documentId) replacement.documentId = existing.documentId;

      for (const key of vitalKeys) {
        if (toClear.has(key)) {
          // Omit from replacement to clear
        } else if ((fields as any)[key] !== undefined) {
          replacement[key] = (fields as any)[key];
        } else if ((existing as any)[key] !== undefined) {
          replacement[key] = (existing as any)[key];
        }
      }

      await ctx.db.replace(existing._id, replacement as any);
      return existing._id;
    }

    const newRecord: Record<string, any> = { patientId, extractedAt: Date.now() };
    for (const key of vitalKeys) {
      if (!toClear.has(key) && (fields as any)[key] !== undefined) {
        newRecord[key] = (fields as any)[key];
      }
    }
    return await ctx.db.insert("vitals", newRecord as any);
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
