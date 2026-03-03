import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get available patients in the same org, excluding already-connected ones
export const getAvailablePatients = query({
  args: { physicianUserId: v.id("users") },
  handler: async (ctx, args) => {
    // Get physician's org
    const physician = await ctx.db
      .query("physicians")
      .withIndex("by_userId", (q) => q.eq("userId", args.physicianUserId))
      .unique();

    if (!physician?.organizationId) return [];

    // Get patients in same org
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", physician.organizationId)
      )
      .collect();

    // Filter out patients with pending/accepted requests from this physician
    const existingRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianUserId))
      .collect();

    const connectedPatientIds = new Set(
      existingRequests
        .filter((r) => r.status === "pending" || r.status === "accepted")
        .map((r) => r.patientId)
    );

    const available = patients.filter((p) => !connectedPatientIds.has(p._id));

    // Return with user emails
    return Promise.all(
      available.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          _id: p._id,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          email: user?.email ?? "",
        };
      })
    );
  },
});

// Send a connection request from physician to patient
export const send = mutation({
  args: {
    physicianUserId: v.id("users"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    // Verify the physician exists
    const physician = await ctx.db.get(args.physicianUserId);
    if (!physician || physician.role !== "physician") {
      throw new Error("Unauthorized: not a physician");
    }

    // Check no existing pending/accepted request
    const existing = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianUserId))
      .collect();

    const duplicate = existing.find(
      (r) =>
        r.patientId === args.patientId &&
        (r.status === "pending" || r.status === "accepted")
    );

    if (duplicate) {
      throw new Error("Connection request already exists for this patient.");
    }

    return await ctx.db.insert("connectionRequests", {
      physicianId: args.physicianUserId,
      patientId: args.patientId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Get pending connection requests for a patient (for patient dashboard)
export const getByPatientUserId = query({
  args: { patientUserId: v.id("users") },
  handler: async (ctx, args) => {
    // Find the patient record for this user
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();

    if (!patient) return [];

    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    // Enrich with physician info
    return await Promise.all(
      requests
        .filter((r) => r.status === "pending")
        .map(async (r) => {
          const physician = await ctx.db
            .query("physicians")
            .withIndex("by_userId", (q) => q.eq("userId", r.physicianId))
            .unique();
          return {
            _id: r._id,
            physicianName: physician
              ? `Dr. ${physician.firstName} ${physician.lastName}`
              : "Unknown Physician",
            specialty: physician?.specialty ?? "",
            createdAt: r.createdAt,
          };
        })
    );
  },
});

// Patient responds to a connection request
export const respond = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    patientUserId: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Invalid or already resolved request.");
    }

    // Verify the caller owns the patient record
    const patient = await ctx.db.get(request.patientId);
    if (!patient || patient.userId !== args.patientUserId) {
      throw new Error("Not authorized to respond to this request");
    }

    const newStatus = args.accept ? "accepted" : "rejected";

    await ctx.db.patch(args.requestId, {
      status: newStatus,
      respondedAt: Date.now(),
    });

    // If accepted, assign the physician to the patient
    if (args.accept) {
      await ctx.db.patch(request.patientId, {
        assignedPhysicianId: request.physicianId,
        connected: true,
        showPatient: true,
      });
    }
  },
});

// Get accepted patients for a physician (for the patients list)
export const getAcceptedForPhysician = query({
  args: { physicianUserId: v.id("users") },
  handler: async (ctx, args) => {
    const accepted = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId_status", (q) =>
        q.eq("physicianId", args.physicianUserId).eq("status", "accepted")
      )
      .collect();

    return await Promise.all(
      accepted.map(async (r) => {
        const patient = await ctx.db.get(r.patientId);
        const user = patient ? await ctx.db.get(patient.userId) : null;
        return {
          _id: patient?._id ?? r.patientId,
          firstName: patient?.firstName ?? "",
          lastName: patient?.lastName ?? "",
          dateOfBirth: patient?.dateOfBirth ?? "",
          email: user?.email ?? "",
          connectedAt: r.respondedAt ?? r.createdAt,
        };
      })
    );
  },
});
