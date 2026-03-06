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

    // Get existing connection requests for this physician
    const existingRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianUserId))
      .collect();

    // Build a map of patientId -> status
    const statusMap = new Map<string, string>();
    for (const r of existingRequests) {
      const current = statusMap.get(r.patientId);
      // "accepted" takes priority over "pending"
      if (!current || r.status === "accepted") {
        statusMap.set(r.patientId, r.status);
      }
    }

    // Return with user emails and connection status
    return Promise.all(
      patients.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          _id: p._id,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          email: user?.email ?? "",
          connectionStatus: statusMap.get(p._id) ?? null,
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

    // If already connected or pending, just return the existing request
    if (duplicate) {
      return duplicate._id;
    }

    return await ctx.db.insert("connectionRequests", {
      physicianId: args.physicianUserId,
      patientId: args.patientId,
      status: "pending",
      initiatedBy: "physician",
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
      .withIndex("by_patientId_status", (q) =>
        q.eq("patientId", patient._id).eq("status", "pending")
      )
      .collect();

    // Only show physician-initiated requests (incoming invitations)
    const incoming = requests.filter((r) => r.initiatedBy !== "patient");

    // Enrich with physician info
    return await Promise.all(
      incoming.map(async (r) => {
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
        consentStatus: "granted" as const,
        consentTimestamp: Date.now(),
      });
    }
  },
});

// Send a connection request from patient to physician
export const sendFromPatient = mutation({
  args: {
    patientUserId: v.id("users"),
    physicianUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find the patient record
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();

    if (!patient) {
      throw new Error("Patient record not found");
    }

    // Verify the target is actually a physician
    const physician = await ctx.db.get(args.physicianUserId);
    if (!physician || physician.role !== "physician") {
      throw new Error("Target user is not a physician");
    }

    // Check no existing pending/accepted request between these two
    const existing = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    const duplicate = existing.find(
      (r) =>
        r.physicianId === args.physicianUserId &&
        (r.status === "pending" || r.status === "accepted")
    );

    if (duplicate) {
      return duplicate._id;
    }

    return await ctx.db.insert("connectionRequests", {
      physicianId: args.physicianUserId,
      patientId: patient._id,
      status: "pending",
      initiatedBy: "patient",
      createdAt: Date.now(),
    });
  },
});

// Physician responds to a patient-initiated connection request
export const respondByPhysician = mutation({
  args: {
    requestId: v.id("connectionRequests"),
    physicianUserId: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending") {
      throw new Error("Invalid or already resolved request.");
    }

    if (request.initiatedBy !== "patient") {
      throw new Error("Request must be initiated by patient");
    }

    if (request.physicianId !== args.physicianUserId) {
      throw new Error("Not authorized to respond to this request");
    }

    const newStatus = args.accept ? "accepted" : "rejected";

    await ctx.db.patch(args.requestId, {
      status: newStatus,
      respondedAt: Date.now(),
    });

    if (args.accept) {
      await ctx.db.patch(request.patientId, {
        assignedPhysicianId: request.physicianId,
        connected: true,
        showPatient: true,
        consentStatus: "granted" as const,
        consentTimestamp: Date.now(),
      });
    }
  },
});

// Get pending requests sent TO the physician (patient-initiated)
export const getPendingForPhysician = query({
  args: { physicianUserId: v.id("users") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId_status", (q) =>
        q.eq("physicianId", args.physicianUserId).eq("status", "pending")
      )
      .collect();

    // Only return patient-initiated ones
    const patientInitiated = requests.filter(
      (r) => r.initiatedBy === "patient"
    );

    return Promise.all(
      patientInitiated.map(async (r) => {
        const patient = await ctx.db.get(r.patientId);
        return {
          _id: r._id,
          patientId: r.patientId,
          patientName: patient
            ? `${patient.firstName} ${patient.lastName}`
            : "Unknown Patient",
          city: patient?.city,
          state: patient?.state,
          createdAt: r.createdAt,
        };
      })
    );
  },
});

// Get all connection requests involving a physician (both directions)
export const getAllForPhysician = query({
  args: { physicianUserId: v.id("users") },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId", (q) =>
        q.eq("physicianId", args.physicianUserId)
      )
      .collect();

    return Promise.all(
      requests.map(async (r) => {
        const patient = await ctx.db.get(r.patientId);
        return {
          _id: r._id,
          patientId: r.patientId,
          patientName: patient
            ? `${patient.firstName} ${patient.lastName}`
            : "Unknown Patient",
          status: r.status,
          initiatedBy: r.initiatedBy ?? "physician",
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
        };
      })
    );
  },
});

// Get all connection requests involving a patient (both directions)
export const getAllForPatient = query({
  args: { patientUserId: v.id("users") },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();

    if (!patient) return [];

    const requests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    return Promise.all(
      requests.map(async (r) => {
        const physician = await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", r.physicianId))
          .unique();
        return {
          _id: r._id,
          physicianId: r.physicianId,
          physicianName: physician
            ? `Dr. ${physician.firstName} ${physician.lastName}`
            : "Unknown Physician",
          specialty: physician?.specialty ?? "",
          status: r.status,
          initiatedBy: r.initiatedBy ?? "physician",
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
        };
      })
    );
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
