import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI, { toFile } from "openai";

// Count total documents across all patients assigned to a physician
export const countDocumentsByPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_assignedPhysician", (q) =>
        q.eq("assignedPhysicianId", args.physicianId)
      )
      .collect();

    let total = 0;
    for (const patient of patients) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
        .collect();
      total += docs.length;
    }
    return total;
  },
});

// Get a public URL for a storage ID
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Generate upload URL
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

// Create document record after upload
export const create = mutation({
  args: {
    patientId: v.id("patients"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    category: v.union(
      v.literal("lab_result"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("notes"),
      v.literal("other")
    ),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      patientId: args.patientId,
      uploadedBy: args.uploadedBy,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      category: args.category,
      uploadedAt: Date.now(),
      metadata: args.metadata,
    });

    // Auto-trigger AI summary (which also extracts vitals + generates health overview)
    await ctx.db.patch(documentId, { aiSummaryStatus: "generating" });
    await ctx.scheduler.runAfter(0, internal.documents.generateDocumentSummary, {
      documentId,
    });

    return documentId;
  },
});

// Create document record uploaded by physician (requires patient approval)
export const createByPhysician = mutation({
  args: {
    patientId: v.id("patients"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    category: v.union(
      v.literal("lab_result"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("notes"),
      v.literal("other")
    ),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify uploader is a physician
    const uploaderUser = await ctx.db.get(args.uploadedBy);
    if (!uploaderUser || uploaderUser.role !== "physician") {
      throw new Error("Only physicians can use this upload method");
    }

    // Verify patient is assigned to this physician
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");
    if (patient.assignedPhysicianId !== args.uploadedBy) {
      throw new Error("Patient is not assigned to this physician");
    }

    const documentId = await ctx.db.insert("documents", {
      patientId: args.patientId,
      uploadedBy: args.uploadedBy,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      category: args.category,
      uploadedAt: Date.now(),
      metadata: args.metadata,
      reviewStatus: "pendingReview",
      uploadedByRole: "physician",
    });

    return documentId;
  },
});

// Get pending review documents for a patient (by patient userId)
export const getPendingByPatientUserId = query({
  args: { patientUserId: v.id("users") },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();
    if (!patient) return [];

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_patientId_reviewStatus", (q) =>
        q.eq("patientId", patient._id).eq("reviewStatus", "pendingReview")
      )
      .collect();

    return await Promise.all(
      docs.map(async (doc) => {
        // Look up physician name
        const physician = await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", doc.uploadedBy))
          .unique();
        const physicianName = physician
          ? `Dr. ${physician.firstName} ${physician.lastName}`
          : "Unknown Physician";
        return {
          _id: doc._id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          category: doc.category,
          uploadedAt: doc.uploadedAt,
          physicianName,
        };
      })
    );
  },
});

// Approve a physician-uploaded document (triggers AI pipeline)
export const approveDocument = mutation({
  args: {
    documentId: v.id("documents"),
    patientUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();
    if (!patient) throw new Error("Patient not found");

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.patientId !== patient._id) throw new Error("Unauthorized");
    if (doc.reviewStatus !== "pendingReview") throw new Error("Document is not pending review");

    await ctx.db.patch(args.documentId, {
      reviewStatus: "approved",
      aiSummaryStatus: "generating",
    });

    await ctx.scheduler.runAfter(0, internal.documents.generateDocumentSummary, {
      documentId: args.documentId,
    });
  },
});

// Reject a physician-uploaded document (deletes storage + record)
export const rejectDocument = mutation({
  args: {
    documentId: v.id("documents"),
    patientUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", args.patientUserId))
      .unique();
    if (!patient) throw new Error("Patient not found");

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.patientId !== patient._id) throw new Error("Unauthorized");
    if (doc.reviewStatus !== "pendingReview") throw new Error("Document is not pending review");

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.documentId);
  },
});

// Get documents for a patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    return await Promise.all(
      documents.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return { ...doc, url };
      })
    );
  },
});

// Check if any documents are currently being processed for a patient
export const isProcessing = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    return docs.some((d) => d.aiSummaryStatus === "generating");
  },
});

// Get documents by category
export const getByCategory = query({
  args: {
    patientId: v.id("patients"),
    category: v.union(
      v.literal("lab_result"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("notes"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    const filtered = documents.filter((d) => d.category === args.category);

    return await Promise.all(
      filtered.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return { ...doc, url };
      })
    );
  },
});

// Get single document
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    const url = await ctx.storage.getUrl(doc.storageId);
    return { ...doc, url };
  },
});

// Delete document
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Delete from storage
    await ctx.storage.delete(doc.storageId);

    // Delete document record
    await ctx.db.delete(args.documentId);
  },
});

// Update document metadata
export const updateMetadata = mutation({
  args: {
    documentId: v.id("documents"),
    category: v.optional(
      v.union(
        v.literal("lab_result"),
        v.literal("prescription"),
        v.literal("imaging"),
        v.literal("notes"),
        v.literal("other")
      )
    ),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    const { documentId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(documentId, filteredUpdates);
  },
});

// Reset all stuck AI summary statuses (for retry)
export const resetStuckSummaries = mutation({
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").collect();
    let count = 0;
    for (const doc of docs) {
      if (doc.aiSummaryStatus === "generating" || doc.aiSummaryStatus === "failed") {
        await ctx.db.patch(doc._id, {
          aiSummaryStatus: undefined,
          aiSummary: undefined,
        });
        count++;
      }
    }
    return { reset: count };
  },
});

// Internal query to fetch document by ID (for use by internalAction)
export const getByIdInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

// Request AI summary for a document
export const requestSummary = mutation({
  args: { documentId: v.id("documents"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    // Skip if already generated or in progress (unless forced)
    if (!args.force && (doc.aiSummaryStatus === "done" || doc.aiSummaryStatus === "generating")) return;

    await ctx.db.patch(args.documentId, { aiSummaryStatus: "generating" });

    await ctx.scheduler.runAfter(0, internal.documents.generateDocumentSummary, {
      documentId: args.documentId,
    });
  },
});

// Internal mutation to patch AI summary fields
export const patchAiSummary = internalMutation({
  args: {
    documentId: v.id("documents"),
    summary: v.string(),
    status: v.union(v.literal("done"), v.literal("failed")),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {
      aiSummary: args.summary,
      aiSummaryStatus: args.status,
    };
    if (args.embedding) {
      patch.embedding = args.embedding;
    }
    await ctx.db.patch(args.documentId, patch);
  },
});

// Generate AI summary for a document
export const generateDocumentSummary = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(internal.documents.getByIdInternal, {
      documentId: args.documentId,
    });
    if (!doc) {
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.documents.patchAiSummary, {
        documentId: args.documentId,
        summary: "Summary generation unavailable: API key not configured.",
        status: "failed",
      });
      return;
    }

    const openai = new OpenAI({ apiKey });

    try {
      const fileBlob = await ctx.storage.get(doc.storageId);
      if (!fileBlob) {
        await ctx.runMutation(internal.documents.patchAiSummary, {
          documentId: args.documentId,
          summary: "File not found in storage.",
          status: "failed",
        });
        return;
      }

      let summaryText: string;
      let textForEmbedding: string;

      const systemPrompt =
        "You are a clinical document summarizer. Analyze this medical document (lab results, prescriptions, imaging reports, clinical notes) and produce a concise clinical summary. Highlight key findings, abnormal values, diagnoses, and recommended actions. Be professional and concise (3-5 sentences).";

      if (doc.fileType === "application/pdf") {
        // Upload PDF to OpenAI Files API, then reference by file_id
        const arrayBuffer = await fileBlob.arrayBuffer();
        const file = await openai.files.create({
          file: await toFile(new Uint8Array(arrayBuffer), doc.fileName, { type: "application/pdf" }),
          purpose: "user_data",
        });

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    file: { file_id: file.id },
                  } as any,
                ],
              },
            ],
            max_tokens: 300,
          });
          summaryText = completion.choices[0]?.message?.content?.trim() ?? "Summary generation failed.";
          textForEmbedding = summaryText;
        } finally {
          // Clean up uploaded file
          await openai.files.del(file.id).catch(() => {});
        }
      } else if (doc.fileType.startsWith("image/")) {
        // Use GPT-4o vision for images
        const arrayBuffer = await fileBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUrl = `data:${doc.fileType};base64,${base64}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          max_tokens: 300,
        });
        summaryText = completion.choices[0]?.message?.content?.trim() ?? "Summary generation failed.";
        textForEmbedding = summaryText;
      } else {
        await ctx.runMutation(internal.documents.patchAiSummary, {
          documentId: args.documentId,
          summary: "Unsupported file type for AI summary.",
          status: "failed",
        });
        return;
      }

      // Extract vitals from the summary text
      try {
        const vitalsCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Extract any vital signs from this medical document summary. Return JSON with optional fields: heartRate (number, bpm), systolicBP (number, mmHg), diastolicBP (number, mmHg), glucoseLevel (number, mg/dL), bodyTemperature (number, °F). Return empty object {} if no vitals found. Only include fields where a specific numeric value is present.",
            },
            { role: "user", content: summaryText },
          ],
          response_format: { type: "json_object" },
          max_tokens: 200,
        });

        const vitalsJson = JSON.parse(
          vitalsCompletion.choices[0]?.message?.content ?? "{}"
        );

        const hasVitals =
          vitalsJson.heartRate !== undefined ||
          vitalsJson.systolicBP !== undefined ||
          vitalsJson.diastolicBP !== undefined ||
          vitalsJson.glucoseLevel !== undefined ||
          vitalsJson.bodyTemperature !== undefined;

        if (hasVitals) {
          await ctx.runMutation(internal.vitals.createFromDocument, {
            patientId: doc.patientId,
            documentId: args.documentId,
            ...(vitalsJson.heartRate !== undefined && {
              heartRate: Number(vitalsJson.heartRate),
            }),
            ...(vitalsJson.systolicBP !== undefined && {
              systolicBP: Number(vitalsJson.systolicBP),
            }),
            ...(vitalsJson.diastolicBP !== undefined && {
              diastolicBP: Number(vitalsJson.diastolicBP),
            }),
            ...(vitalsJson.glucoseLevel !== undefined && {
              glucoseLevel: Number(vitalsJson.glucoseLevel),
            }),
            ...(vitalsJson.bodyTemperature !== undefined && {
              bodyTemperature: Number(vitalsJson.bodyTemperature),
            }),
            extractedAt: Date.now(),
          });
        }
      } catch (vitalsError) {
        console.error("Vitals extraction failed:", vitalsError);
      }

      // Extract profile fields (medications, allergies, conditions, etc.)
      try {
        const profileCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                'Extract any patient profile information from this medical document summary. Return JSON with optional fields: medications (array of {name, dosage?}), allergies (array of {allergen, type?} where type is "drug"|"food"|"environmental"|"other"), conditions (array of {name, status?} where status is "active"|"resolved"|"chronic"), sex ("male"|"female"|"other"), bloodType ("A+"|"A-"|"B+"|"B-"|"AB+"|"AB-"|"O+"|"O-"), procedures (array of {name, date?}), insurance ({planName?, provider?, memberId?}). Return empty object {} if no profile information found. Only include fields where specific values are present.',
            },
            { role: "user", content: summaryText },
          ],
          response_format: { type: "json_object" },
          max_tokens: 500,
        });

        const profileJson = JSON.parse(
          profileCompletion.choices[0]?.message?.content ?? "{}"
        );

        const hasProfileData =
          (profileJson.medications?.length > 0) ||
          (profileJson.allergies?.length > 0) ||
          (profileJson.conditions?.length > 0) ||
          (profileJson.procedures?.length > 0) ||
          profileJson.sex ||
          profileJson.bloodType ||
          profileJson.insurance;

        if (hasProfileData) {
          await ctx.runMutation(internal.documents.mergePatientProfileFields, {
            patientId: doc.patientId,
            extracted: profileJson,
          });
        }
      } catch (profileError) {
        console.error("Profile fields extraction failed:", profileError);
      }

      // Generate embedding
      let embedding: number[] | undefined;
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: textForEmbedding.slice(0, 8000),
        });
        embedding = embeddingResponse.data[0]?.embedding;
      } catch (e) {
        console.error("Embedding generation failed:", e);
      }

      await ctx.runMutation(internal.documents.patchAiSummary, {
        documentId: args.documentId,
        summary: summaryText,
        status: "done",
        embedding,
      });
    } catch (error) {
      console.error("Document summary generation error:", error);
      await ctx.runMutation(internal.documents.patchAiSummary, {
        documentId: args.documentId,
        summary: "Summary generation failed due to an error.",
        status: "failed",
      });
    }

    // After summary is saved, regenerate the patient health overview
    try {
      await ctx.scheduler.runAfter(0, internal.documents.generateHealthOverview, {
        patientId: doc.patientId,
      });
    } catch (e) {
      console.error("Failed to schedule health overview generation:", e);
    }
  },
});

// Internal query to get patient profile fields for merge
export const getPatientProfileFields = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) return null;
    return {
      medications: patient.medications,
      allergies: patient.allergies,
      conditions: patient.conditions,
      sex: patient.sex,
      bloodType: patient.bloodType,
      procedures: patient.procedures,
      insurance: patient.insurance,
    };
  },
});

// Merge AI-extracted profile fields into patient record (append-only dedup for arrays, fill-blank for scalars)
export const mergePatientProfileFields = internalMutation({
  args: {
    patientId: v.id("patients"),
    extracted: v.object({
      medications: v.optional(v.array(v.object({ name: v.string(), dosage: v.optional(v.string()) }))),
      allergies: v.optional(v.array(v.object({ allergen: v.string(), type: v.optional(v.string()) }))),
      conditions: v.optional(v.array(v.object({ name: v.string(), status: v.optional(v.string()) }))),
      sex: v.optional(v.string()),
      bloodType: v.optional(v.string()),
      procedures: v.optional(v.array(v.object({ name: v.string(), date: v.optional(v.string()) }))),
      insurance: v.optional(v.object({ planName: v.optional(v.string()), provider: v.optional(v.string()), memberId: v.optional(v.string()) })),
    }),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) return;

    const patch: Record<string, any> = {};
    const ex = args.extracted;

    // Arrays: append-only dedup
    if (ex.medications?.length) {
      const existing = patient.medications ?? [];
      const existingNames = new Set(existing.map((m: any) => m.name.toLowerCase()));
      const newItems = ex.medications.filter((m) => !existingNames.has(m.name.toLowerCase()));
      if (newItems.length) patch.medications = [...existing, ...newItems];
    }

    if (ex.allergies?.length) {
      const existing = patient.allergies ?? [];
      const existingNames = new Set(existing.map((a: any) => a.allergen.toLowerCase()));
      const newItems = ex.allergies.filter((a) => !existingNames.has(a.allergen.toLowerCase()));
      if (newItems.length) patch.allergies = [...existing, ...newItems as any];
    }

    if (ex.conditions?.length) {
      const existing = patient.conditions ?? [];
      const existingNames = new Set(existing.map((c: any) => c.name.toLowerCase()));
      const newItems = ex.conditions.filter((c) => !existingNames.has(c.name.toLowerCase()));
      if (newItems.length) patch.conditions = [...existing, ...newItems as any];
    }

    if (ex.procedures?.length) {
      const existing = patient.procedures ?? [];
      const existingNames = new Set(existing.map((p: any) => p.name.toLowerCase()));
      const newItems = ex.procedures.filter((p) => !existingNames.has(p.name.toLowerCase()));
      if (newItems.length) patch.procedures = [...existing, ...newItems];
    }

    // Scalars: only set if currently empty
    if (ex.sex && !patient.sex) patch.sex = ex.sex;
    if (ex.bloodType && !patient.bloodType) patch.bloodType = ex.bloodType;

    // Insurance: field-level merge, only fill blanks
    if (ex.insurance) {
      const existing = patient.insurance ?? {};
      const merged = { ...existing } as any;
      let changed = false;
      if (ex.insurance.planName && !merged.planName) { merged.planName = ex.insurance.planName; changed = true; }
      if (ex.insurance.provider && !merged.provider) { merged.provider = ex.insurance.provider; changed = true; }
      if (ex.insurance.memberId && !merged.memberId) { merged.memberId = ex.insurance.memberId; changed = true; }
      if (changed) patch.insurance = merged;
    }

    if (Object.keys(patch).length > 0) {
      patch.profileFieldsUpdatedAt = Date.now();
      await ctx.db.patch(args.patientId, patch);
    }
  },
});

// Get all AI summaries for a patient (for health overview generation)
export const getAiSummariesByPatient = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    return docs
      .filter((d) => d.aiSummary && d.aiSummaryStatus === "done")
      .map((d) => ({ fileName: d.fileName, category: d.category, summary: d.aiSummary! }));
  },
});

// Patch patient health overview
export const patchHealthOverview = internalMutation({
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

// Generate a combined health overview from all document summaries
export const generateHealthOverview = internalAction({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const summaries = await ctx.runQuery(internal.documents.getAiSummariesByPatient, {
      patientId: args.patientId,
    });

    if (summaries.length === 0) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    const openai = new OpenAI({ apiKey });

    const summaryList = summaries
      .map((s, i) => `[${i + 1}] ${s.fileName} (${s.category}): ${s.summary}`)
      .join("\n\n");

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical health summarizer. Given multiple medical document summaries for a single patient, produce a concise, unified health overview (3-6 sentences). Highlight the most important findings, active conditions, medications, and any concerning trends. Be professional, clear, and patient-friendly.",
          },
          {
            role: "user",
            content: `Here are ${summaries.length} medical document summaries for this patient:\n\n${summaryList}`,
          },
        ],
        max_tokens: 400,
      });

      const overview = completion.choices[0]?.message?.content?.trim();
      if (overview) {
        await ctx.runMutation(internal.documents.patchHealthOverview, {
          patientId: args.patientId,
          healthOverview: overview,
        });
      }
    } catch (error) {
      console.error("Health overview generation failed:", error);
    }
  },
});
