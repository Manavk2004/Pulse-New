import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

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
    cardBio: v.optional(v.string()),
    cardVisibleFields: v.optional(v.array(v.string())),
    profilePhotoStorageId: v.optional(v.id("_storage")),
    bannerPhotoStorageId: v.optional(v.id("_storage")),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
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
    // Get patients assigned directly
    const assignedPatients = await ctx.db
      .query("patients")
      .withIndex("by_assignedPhysician", (q) =>
        q.eq("assignedPhysicianId", args.physicianId)
      )
      .collect();

    // Also get patients connected via accepted connection requests
    const acceptedRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_physicianId_status", (q) =>
        q.eq("physicianId", args.physicianId).eq("status", "accepted")
      )
      .collect();

    const connectedPatientIds = new Set(acceptedRequests.map((r) => r.patientId));

    // Fetch any connected patients not already in the assigned list
    const assignedIds = new Set(assignedPatients.map((p) => p._id));
    const additionalPatients = await Promise.all(
      [...connectedPatientIds]
        .filter((id) => !assignedIds.has(id))
        .map((id) => ctx.db.get(id))
    );

    const allPatients = [
      ...assignedPatients,
      ...additionalPatients.filter((p): p is NonNullable<typeof p> => p !== null),
    ];

    const visible = allPatients.filter((p) => p.showPatient !== false);

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

    await ctx.db.patch(args.patientId, {
      showPatient: false,
      connected: false,
      assignedPhysicianId: undefined,
      consentStatus: "pending" as const,
      consentTimestamp: undefined,
    });

    // Delete all connection requests for this patient
    const connectionRequests = await ctx.db
      .query("connectionRequests")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    await Promise.all(
      connectionRequests.map((r) => ctx.db.delete(r._id))
    );
  },
});

// Update health overview (patient-editable profile summary)
export const updateHealthOverview = mutation({
  args: {
    patientId: v.id("patients"),
    healthOverview: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, {
      healthOverview: args.healthOverview,
      healthOverviewUpdatedAt: Date.now(),
    });
  },
});

// Update patient medical profile fields
export const updateProfileFields = mutation({
  args: {
    patientId: v.id("patients"),
    medications: v.optional(v.array(v.object({ name: v.string(), dosage: v.optional(v.string()) }))),
    allergies: v.optional(v.array(v.object({ allergen: v.string(), type: v.optional(v.union(v.literal("drug"), v.literal("food"), v.literal("environmental"), v.literal("other"))) }))),
    conditions: v.optional(v.array(v.object({ name: v.string(), status: v.optional(v.union(v.literal("active"), v.literal("resolved"), v.literal("chronic"))) }))),
    sex: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    bloodType: v.optional(v.union(v.literal("A+"), v.literal("A-"), v.literal("B+"), v.literal("B-"), v.literal("AB+"), v.literal("AB-"), v.literal("O+"), v.literal("O-"))),
    procedures: v.optional(v.array(v.object({ name: v.string(), date: v.optional(v.string()) }))),
    insurance: v.optional(v.object({ planName: v.optional(v.string()), provider: v.optional(v.string()), memberId: v.optional(v.string()) })),
    emergencyContact: v.optional(v.object({ name: v.string(), relationship: v.string(), phoneNumber: v.string() })),
    about: v.optional(v.string()),
    familyHistory: v.optional(v.array(v.object({ relation: v.string(), condition: v.string() }))),
    smokingStatus: v.optional(v.union(v.literal("never"), v.literal("former"), v.literal("current"))),
    alcoholUse: v.optional(v.union(v.literal("none"), v.literal("occasional"), v.literal("moderate"), v.literal("heavy"))),
    exerciseFrequency: v.optional(v.string()),
    occupation: v.optional(v.string()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { patientId, ...fields } = args;
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      updates.profileFieldsUpdatedAt = Date.now();
      await ctx.db.patch(patientId, updates);
    }
  },
});

// Get full patient profile by patient ID (with resolved photo URLs, privacy-filtered)
export const getProfileByPatientId = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) return null;

    const profilePhotoUrl = patient.profilePhotoStorageId
      ? await ctx.storage.getUrl(patient.profilePhotoStorageId)
      : null;
    const bannerPhotoUrl = patient.bannerPhotoStorageId
      ? await ctx.storage.getUrl(patient.bannerPhotoStorageId)
      : null;

    // Clinical fields always visible to connected physicians
    // Non-clinical fields respect cardVisibleFields privacy
    const visibleFields = patient.cardVisibleFields ?? [];

    const filteredPatient: Record<string, any> = {
      _id: patient._id,
      _creationTime: patient._creationTime,
      userId: patient.userId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      profilePhotoUrl,
      bannerPhotoUrl,
      // Clinical fields — always visible to physicians
      medications: patient.medications,
      allergies: patient.allergies,
      conditions: patient.conditions,
      procedures: patient.procedures,
      insurance: patient.insurance,
      emergencyContact: patient.emergencyContact,
      sex: patient.sex,
      bloodType: patient.bloodType,
      healthOverview: patient.healthOverview,
      familyHistory: patient.familyHistory,
      height: patient.height,
      weight: patient.weight,
    };

    // Privacy-controlled fields — only if patient opted in
    const privacyFields: Record<string, any> = {
      phoneNumber: patient.phoneNumber,
      city: patient.city,
      state: patient.state,
      country: patient.country,
      cardBio: patient.cardBio,
      about: patient.about,
      smokingStatus: patient.smokingStatus,
      alcoholUse: patient.alcoholUse,
      exerciseFrequency: patient.exerciseFrequency,
      occupation: patient.occupation,
    };

    for (const [key, value] of Object.entries(privacyFields)) {
      if (visibleFields.length === 0 || visibleFields.includes(key)) {
        filteredPatient[key] = value;
      }
    }

    return filteredPatient;
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

// ── Health Tips AI Generation ──

export const patchHealthTips = internalMutation({
  args: {
    patientId: v.id("patients"),
    healthTips: v.array(v.object({ title: v.string(), tip: v.string(), reason: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, {
      healthTips: args.healthTips,
      healthTipsUpdatedAt: Date.now(),
    });
  },
});

export const generateHealthTips = internalAction({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.runQuery(internal.patients.getByIdInternal, {
      patientId: args.patientId,
    });
    if (!patient) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    const openai = new OpenAI({ apiKey });

    // Build patient context from available data
    const parts: string[] = [];
    if (patient.conditions?.length) {
      parts.push(`Active conditions: ${patient.conditions.map((c: any) => `${c.name} (${c.status ?? "active"})`).join(", ")}`);
    }
    if (patient.medications?.length) {
      parts.push(`Medications: ${patient.medications.map((m: any) => m.name + (m.dosage ? ` ${m.dosage}` : "")).join(", ")}`);
    }
    if (patient.allergies?.length) {
      parts.push(`Allergies: ${patient.allergies.map((a: any) => a.allergen).join(", ")}`);
    }
    if (patient.smokingStatus) parts.push(`Smoking: ${patient.smokingStatus}`);
    if (patient.alcoholUse) parts.push(`Alcohol: ${patient.alcoholUse}`);
    if (patient.exerciseFrequency) parts.push(`Exercise: ${patient.exerciseFrequency}`);
    if (patient.familyHistory?.length) {
      parts.push(`Family history: ${patient.familyHistory.map((f: any) => `${f.relation} - ${f.condition}`).join(", ")}`);
    }
    if (patient.healthOverview) {
      parts.push(`Health overview: ${patient.healthOverview}`);
    }
    if (patient.sex) parts.push(`Sex: ${patient.sex}`);
    if (patient.bloodType) parts.push(`Blood type: ${patient.bloodType}`);
    if (patient.height) parts.push(`Height: ${patient.height}`);
    if (patient.weight) parts.push(`Weight: ${patient.weight}`);

    const patientContext = parts.length > 0
      ? parts.join("\n")
      : "No detailed health information available. Provide general wellness tips.";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a health wellness advisor. Based on the patient's health profile, generate exactly 4 personalized health tips. Each tip should be directly relevant to their specific conditions, medications, lifestyle, or risk factors. Be actionable and encouraging. Return ONLY valid JSON — an array of 4 objects with "title" (2-3 words, like a category label), "reason" (1 short sentence explaining which specific detail from the patient's profile prompted this tip, e.g. "Based on your elevated blood pressure" or "Given your family history of diabetes"), and "tip" (2-3 sentences of actionable advice). Example format: [{"title":"Heart Health","reason":"Based on your hyperlipidemia diagnosis","tip":"..."},...]`,
          },
          {
            role: "user",
            content: `Patient profile:\n${patientContext}`,
          },
        ],
        max_tokens: 700,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) return;

      // Parse JSON from the response (handle markdown code blocks)
      const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const tips = JSON.parse(jsonStr);

      if (Array.isArray(tips) && tips.length > 0) {
        await ctx.runMutation(internal.patients.patchHealthTips, {
          patientId: args.patientId,
          healthTips: tips.slice(0, 4).map((t: any) => ({
            title: String(t.title),
            tip: String(t.tip),
            reason: String(t.reason ?? ""),
          })),
        });
      }
    } catch (error) {
      console.error("Health tips generation failed:", error);
    }
  },
});

// Internal query for reading patient data inside actions
export const getByIdInternal = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});

// Public mutation to trigger health tips regeneration
export const refreshHealthTips = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.patients.generateHealthTips, {
      patientId: args.patientId,
    });
  },
});
