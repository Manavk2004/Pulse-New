import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
