import { z } from "zod";
import { router, protectedProcedure, physicianProcedure, withAuditLog } from "../trpc";

const severitySchema = z.enum(["low", "medium", "high", "urgent"]);
const statusSchema = z.enum(["pending", "acknowledged", "resolved"]);

export const escalationRouter = router({
  // Get escalations for a physician
  listForPhysician: physicianProcedure
    .use(withAuditLog("escalation_list", "escalation"))
    .input(
      z.object({
        status: statusSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        escalations: [],
      };
    }),

  // Get escalation by ID
  get: protectedProcedure
    .use(withAuditLog("escalation_view", "escalation"))
    .input(z.object({ escalationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        escalation: null,
      };
    }),

  // Get escalations for a patient
  listForPatient: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        escalations: [],
      };
    }),

  // Acknowledge an escalation
  acknowledge: physicianProcedure
    .use(withAuditLog("escalation_acknowledge", "escalation"))
    .input(z.object({ escalationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Acknowledge in Convex
      return {
        success: true,
      };
    }),

  // Resolve an escalation
  resolve: physicianProcedure
    .use(withAuditLog("escalation_resolve", "escalation"))
    .input(
      z.object({
        escalationId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve in Convex
      return {
        success: true,
      };
    }),

  // Get pending urgent escalations (for dashboard)
  getUrgent: physicianProcedure.query(async ({ ctx }) => {
    // Get urgent escalations from Convex
    return {
      escalations: [],
      count: 0,
    };
  }),

  // Get escalation statistics
  getStats: physicianProcedure.query(async ({ ctx }) => {
    // Calculate stats from Convex
    return {
      pending: 0,
      acknowledged: 0,
      resolved: 0,
      urgentCount: 0,
    };
  }),
});

export type EscalationRouter = typeof escalationRouter;
