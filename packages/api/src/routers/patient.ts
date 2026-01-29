import { z } from "zod";
import { router, protectedProcedure, patientProcedure, withAuditLog } from "../trpc";

export const patientRouter = router({
  // Get current patient's profile
  getProfile: protectedProcedure
    .use(withAuditLog("patient_profile_view", "patient"))
    .query(async ({ ctx }) => {
      // This will be connected to Convex
      return {
        userId: ctx.auth.userId,
        // Profile data would come from Convex
      };
    }),

  // Update patient profile
  updateProfile: patientProcedure
    .use(withAuditLog("patient_profile_update", "patient"))
    .input(
      z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phoneNumber: z.string().optional(),
        emergencyContact: z
          .object({
            name: z.string(),
            relationship: z.string(),
            phoneNumber: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update in Convex
      return {
        success: true,
        userId: ctx.auth.userId,
      };
    }),

  // Update consent status
  updateConsent: patientProcedure
    .use(withAuditLog("patient_consent_update", "patient"))
    .input(
      z.object({
        consentStatus: z.enum(["pending", "granted", "revoked"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update consent in Convex
      return {
        success: true,
        consentStatus: input.consentStatus,
        timestamp: Date.now(),
      };
    }),

  // Get patient's assigned physician
  getAssignedPhysician: patientProcedure.query(async ({ ctx }) => {
    // Get from Convex
    return {
      physician: null,
    };
  }),
});

export type PatientRouter = typeof patientRouter;
