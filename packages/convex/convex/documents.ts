import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to get authenticated user from context
async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required. Please sign in to continue.");
  }

  // Extract Clerk user ID from the token identifier
  // Clerk's tokenIdentifier format is typically "https://clerk.dev|user_xxx"
  const clerkId = identity.subject;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();

  if (!user) {
    throw new Error(
      "User account not found. Please complete your profile setup."
    );
  }

  return user;
}

// Helper to check if user has access to a patient's documents
async function verifyPatientAccess(
  ctx: QueryCtx | MutationCtx,
  patientId: Id<"patients">,
  userId: Id<"users">,
  userRole: "patient" | "physician" | "admin"
) {
  // Admins have access to all patients
  if (userRole === "admin") {
    return true;
  }

  // Physicians have access to their assigned patients
  if (userRole === "physician") {
    const patient = await ctx.db.get(patientId);
    if (!patient) {
      throw new Error("Patient not found.");
    }
    // Physicians can access documents of patients assigned to them
    if (patient.assignedPhysicianId === userId) {
      return true;
    }
    throw new Error(
      "Access denied. You are not authorized to access this patient's documents."
    );
  }

  // Patients can only access their own documents
  if (userRole === "patient") {
    const patient = await ctx.db.get(patientId);
    if (!patient) {
      throw new Error("Patient not found.");
    }
    if (patient.userId === userId) {
      return true;
    }
    throw new Error(
      "Access denied. You can only access your own documents."
    );
  }

  throw new Error("Access denied. Invalid user role.");
}

// Generate upload URL (requires authentication)
// Returns both the upload URL and the authenticated user's ID for tying uploads to users
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    // Verify user is authenticated
    const user = await getAuthenticatedUser(ctx);

    const uploadUrl = await ctx.storage.generateUploadUrl();

    // Return upload URL along with user metadata to tie uploads to the authenticated user
    return {
      uploadUrl,
      userId: user._id,
      userRole: user.role,
    };
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
    // Verify authentication and authorization
    const user = await getAuthenticatedUser(ctx);
    await verifyPatientAccess(ctx, args.patientId, user._id, user.role);

    // Ensure uploadedBy matches the authenticated user
    if (args.uploadedBy !== user._id) {
      throw new Error(
        "Invalid request. The uploadedBy field must match the authenticated user."
      );
    }

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
    // Verify authentication and authorization
    const user = await getAuthenticatedUser(ctx);
    await verifyPatientAccess(ctx, args.patientId, user._id, user.role);

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    // Get download URLs
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
    // Verify authentication and authorization
    const user = await getAuthenticatedUser(ctx);
    await verifyPatientAccess(ctx, args.patientId, user._id, user.role);

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
    // Verify authentication
    const user = await getAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    // Verify authorization to access this document's patient
    await verifyPatientAccess(ctx, doc.patientId, user._id, user.role);

    const url = await ctx.storage.getUrl(doc.storageId);
    return { ...doc, url };
  },
});

// Delete document
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    // Verify authentication
    const user = await getAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify authorization - only the uploader, assigned physician, or admin can delete
    if (user.role === "patient") {
      // Patients can only delete documents they uploaded
      if (doc.uploadedBy !== user._id) {
        throw new Error(
          "Access denied. You can only delete documents you uploaded."
        );
      }
    } else if (user.role === "physician") {
      // Physicians can delete documents for their assigned patients
      const patient = await ctx.db.get(doc.patientId);
      if (!patient || patient.assignedPhysicianId !== user._id) {
        throw new Error(
          "Access denied. You can only delete documents for your assigned patients."
        );
      }
    }
    // Admins can delete any document (no additional check needed)

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
    // Verify authentication
    const user = await getAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify authorization - only the uploader, assigned physician, or admin can update
    if (user.role === "patient") {
      // Patients can only update documents they uploaded
      if (doc.uploadedBy !== user._id) {
        throw new Error(
          "Access denied. You can only update documents you uploaded."
        );
      }
    } else if (user.role === "physician") {
      // Physicians can update documents for their assigned patients
      const patient = await ctx.db.get(doc.patientId);
      if (!patient || patient.assignedPhysicianId !== user._id) {
        throw new Error(
          "Access denied. You can only update documents for your assigned patients."
        );
      }
    }
    // Admins can update any document (no additional check needed)

    const { documentId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(documentId, filteredUpdates);
  },
});
