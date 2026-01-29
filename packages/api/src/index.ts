// Export types
export type { AppRouter } from "./root";
export type { Context } from "./trpc";

// Export routers
export { appRouter } from "./root";

// Export procedure helpers
export {
  router,
  publicProcedure,
  protectedProcedure,
  patientProcedure,
  physicianProcedure,
  adminProcedure,
  withAuditLog,
} from "./trpc";
