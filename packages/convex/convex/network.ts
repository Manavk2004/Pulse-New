import { v } from "convex/values";
import { query } from "./_generated/server";

// Browse physicians with optional location filters (for patients)
export const browsePhysicians = query({
  args: {
    patientUserId: v.id("users"),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller is a patient
    const callerUser = await ctx.db.get(args.patientUserId);
    if (!callerUser || callerUser.role !== "patient") {
      return [];
    }

    // Get the patient record for connection status lookups
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();

    if (!patient) return [];

    let physicians = await ctx.db.query("physicians").collect();

    // Apply location filters
    if (args.city) {
      physicians = physicians.filter((p) => p.city === args.city);
    }
    if (args.state) {
      physicians = physicians.filter((p) => p.state === args.state);
    }
    if (args.country) {
      physicians = physicians.filter((p) => p.country === args.country);
    }

    // Get connection requests for this patient to determine status
    const connectionRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
      .collect();

    // Get organization names
    return Promise.all(
      physicians.map(async (physician) => {
        const org = physician.organizationId
          ? await ctx.db.get(physician.organizationId)
          : null;

        // Find connection request between this patient and physician
        const request = connectionRequests.find(
          (r) => r.physicianId === physician.userId
        );

        const profilePhotoUrl = physician.profilePhotoStorageId
          ? await ctx.storage.getUrl(physician.profilePhotoStorageId)
          : null;
        const bannerPhotoUrl = physician.bannerPhotoStorageId
          ? await ctx.storage.getUrl(physician.bannerPhotoStorageId)
          : null;

        return {
          _id: physician._id,
          userId: physician.userId,
          firstName: physician.firstName,
          lastName: physician.lastName,
          specialty: physician.specialty,
          city: physician.city,
          state: physician.state,
          country: physician.country,
          organizationName: org?.name ?? null,
          connectionStatus: request?.status ?? null,
          connectionRequestId: request?._id ?? null,
          cardBio: physician.cardBio ?? null,
          rating: physician.rating ?? null,
          education: physician.education ?? null,
          yearsOfExperience: physician.yearsOfExperience ?? null,
          profilePhotoUrl,
          bannerPhotoUrl,
        };
      })
    );
  },
});

// Browse patients with optional location filters (for physicians)
export const browsePatients = query({
  args: {
    physicianUserId: v.id("users"),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller is a physician
    const callerUser = await ctx.db.get(args.physicianUserId);
    if (!callerUser || callerUser.role !== "physician") {
      return [];
    }

    let patients = await ctx.db.query("patients").collect();

    // Filter to discoverable patients: must have showPatient true and consent not revoked
    patients = patients.filter(
      (p) =>
        p.showPatient === true && p.consentStatus === "granted"
    );

    // Apply location filters
    if (args.city) {
      patients = patients.filter((p) => p.city === args.city);
    }
    if (args.state) {
      patients = patients.filter((p) => p.state === args.state);
    }
    if (args.country) {
      patients = patients.filter((p) => p.country === args.country);
    }

    // Get connection requests for this physician
    const connectionRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianUserId))
      .collect();

    return Promise.all(
      patients.map(async (patient) => {
        const request = connectionRequests.find(
          (r) => r.patientId === patient._id
        );

        const profilePhotoUrl = patient.profilePhotoStorageId
          ? await ctx.storage.getUrl(patient.profilePhotoStorageId)
          : null;
        const bannerPhotoUrl = patient.bannerPhotoStorageId
          ? await ctx.storage.getUrl(patient.bannerPhotoStorageId)
          : null;

        return {
          _id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          city: patient.city,
          state: patient.state,
          country: patient.country,
          connectionStatus: request?.status ?? null,
          connectionRequestId: request?._id ?? null,
          cardBio: patient.cardBio ?? null,
          profilePhotoUrl,
          bannerPhotoUrl,
        };
      })
    );
  },
});

// Get distinct location values for filter dropdowns
export const getLocationFilterOptions = query({
  args: {
    role: v.union(v.literal("physician"), v.literal("patient")),
  },
  handler: async (ctx, args) => {
    const records =
      args.role === "physician"
        ? await ctx.db.query("physicians").collect()
        : await ctx.db.query("patients").collect();

    const cities = new Set<string>();
    const states = new Set<string>();
    const countries = new Set<string>();

    for (const record of records) {
      if (record.city) cities.add(record.city);
      if (record.state) states.add(record.state);
      if (record.country) countries.add(record.country);
    }

    return {
      cities: Array.from(cities).sort(),
      states: Array.from(states).sort(),
      countries: Array.from(countries).sort(),
    };
  },
});
