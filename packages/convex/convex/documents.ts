import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI, { toFile } from "openai";

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
    return await ctx.db.insert("documents", {
      patientId: args.patientId,
      uploadedBy: args.uploadedBy,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      category: args.category,
      uploadedAt: Date.now(),
      metadata: args.metadata,
    });
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
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    // Skip if already generated or in progress
    if (doc.aiSummaryStatus === "done" || doc.aiSummaryStatus === "generating") return;

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
  },
});
