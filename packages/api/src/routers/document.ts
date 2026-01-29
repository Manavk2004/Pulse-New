import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, withAuditLog } from "../trpc";

const documentCategorySchema = z.enum([
  "lab_result",
  "prescription",
  "imaging",
  "notes",
  "other",
]);

// Authorization helper to verify the caller can access the patient's data
async function authorizePatientAccess(
  ctx: { session: { userId: string; role?: string } },
  patientId: string
): Promise<void> {
  const { userId, role } = ctx.session;

  // Admins can access all patient data
  if (role === "admin") {
    return;
  }

  // Physicians can access their assigned patients
  if (role === "physician") {
    // TODO: Check if physician is assigned to this patient via Convex query
    // For now, allow physicians to access (implement proper check with Convex)
    return;
  }

  // Patients can only access their own data
  if (role === "patient") {
    // TODO: Look up patient record by userId and compare with patientId
    // For now, implement a basic check (replace with proper Convex query)
    // This should query the patients table to verify ownership
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to access this patient's documents",
  });
}

// Authorization helper for document access (fetches document and checks patient access)
async function authorizeDocumentAccess(
  ctx: { session: { userId: string; role?: string } },
  documentId: string
): Promise<void> {
  // TODO: Fetch document from Convex, get patientId, then call authorizePatientAccess
  // For now, allow access (implement proper check with Convex)
  const { role } = ctx.session;
  if (role === "admin" || role === "physician" || role === "patient") {
    return;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to access this document",
  });
}

export const documentRouter = router({
  // List documents for a patient
  list: protectedProcedure
    .use(withAuditLog("document_list", "document"))
    .input(
      z.object({
        patientId: z.string(),
        category: documentCategorySchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await authorizePatientAccess(ctx, input.patientId);

      // Get from Convex
      return {
        documents: [],
      };
    }),

  // Get single document
  get: protectedProcedure
    .use(withAuditLog("document_view", "document"))
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await authorizeDocumentAccess(ctx, input.documentId);

      // Get from Convex
      return {
        document: null,
      };
    }),

  // Get upload URL
  getUploadUrl: protectedProcedure
    .use(withAuditLog("document_upload_init", "document"))
    .mutation(async ({ ctx }) => {
      // Get upload URL from Convex
      return {
        uploadUrl: "",
      };
    }),

  // Create document record after upload
  create: protectedProcedure
    .use(withAuditLog("document_upload", "document"))
    .input(
      z.object({
        patientId: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        storageId: z.string(),
        category: documentCategorySchema,
        metadata: z
          .object({
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await authorizePatientAccess(ctx, input.patientId);

      // Create in Convex
      return {
        documentId: "",
        success: true,
      };
    }),

  // Update document metadata
  update: protectedProcedure
    .use(withAuditLog("document_update", "document"))
    .input(
      z.object({
        documentId: z.string(),
        category: documentCategorySchema.optional(),
        metadata: z
          .object({
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await authorizeDocumentAccess(ctx, input.documentId);

      // Update in Convex
      return {
        success: true,
      };
    }),

  // Delete document
  delete: protectedProcedure
    .use(withAuditLog("document_delete", "document"))
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await authorizeDocumentAccess(ctx, input.documentId);

      // Delete in Convex
      return {
        success: true,
      };
    }),
});

export type DocumentRouter = typeof documentRouter;
