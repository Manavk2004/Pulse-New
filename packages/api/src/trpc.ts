import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// Auth object type from Clerk
interface AuthObject {
  userId: string | null;
  sessionId: string | null;
  sessionClaims: Record<string, unknown> | null;
}

// Context type
export interface Context {
  auth: AuthObject;
  headers: Headers;
}

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

// Export router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

// Auth middleware - ensures user is authenticated
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      auth: ctx.auth,
    },
  });
});

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthed);

// Role-based middleware
const hasRole = (allowedRoles: string[]) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.auth.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in",
      });
    }

    // Get role from session claims (set by Clerk)
    const sessionClaims = ctx.auth.sessionClaims as {
      metadata?: { role?: string };
    };
    const role = sessionClaims?.metadata?.role;

    if (!role || !allowedRoles.includes(role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
      });
    }

    return next({
      ctx: {
        auth: ctx.auth,
        role,
      },
    });
  });

// Role-specific procedures
export const patientProcedure = t.procedure.use(hasRole(["patient", "admin"]));
export const physicianProcedure = t.procedure.use(hasRole(["physician", "admin"]));
export const adminProcedure = t.procedure.use(hasRole(["admin"]));

// Sensitive fields that should never be logged (PHI/PII)
const SENSITIVE_FIELDS = new Set([
  "password",
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "dob",
  "phoneNumber",
  "phone",
  "email",
  "address",
  "medicalHistory",
  "diagnosis",
  "treatment",
  "prescription",
  "labResults",
  "symptoms",
  "notes",
  "content",
  "emergencyContact",
  "insuranceNumber",
  "creditCard",
  "bankAccount",
]);

// Fields safe to log for audit purposes
const SAFE_FIELDS = new Set([
  "id",
  "_id",
  "patientId",
  "userId",
  "documentId",
  "chatId",
  "category",
  "action",
  "status",
  "role",
  "type",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
]);

// Sanitize input for audit logging - removes PHI/PII
function sanitizeForAudit(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  const inputObj = input as Record<string, unknown>;

  for (const [key, value] of Object.entries(inputObj)) {
    const lowerKey = key.toLowerCase();

    // Skip sensitive fields entirely
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Include safe fields as-is (but only IDs and simple values)
    if (SAFE_FIELDS.has(key)) {
      // Only log primitive values, not nested objects
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        sanitized[key] = value;
      } else {
        sanitized[key] = "[OBJECT]";
      }
      continue;
    }

    // For unknown fields, only log the key exists with type info
    if (value !== undefined) {
      sanitized[key] = `[${typeof value}]`;
    }
  }

  return sanitized;
}

// Audit logging middleware - sanitizes input to prevent PHI/PII leakage
export const withAuditLog = (action: string, resourceType: string) =>
  middleware(async ({ ctx, next, getRawInput }) => {
    const startTime = Date.now();
    const result = await next();

    // Log the action after successful execution
    if (result.ok && ctx.auth.userId) {
      const rawInput = await getRawInput();
      const sanitizedInput = sanitizeForAudit(rawInput);

      // Audit log entry with sanitized data
      const auditEntry = {
        userId: ctx.auth.userId,
        action,
        resourceType,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        // Only include sanitized, non-sensitive metadata
        metadata: sanitizedInput,
      };

      // In production, send to secure audit log service (Convex auditLog table)
      // For now, only log in development with sanitized data
      if (process.env.NODE_ENV === "development") {
        console.log("[AUDIT]", JSON.stringify(auditEntry));
      }

      // TODO: In production, call Convex auditLog mutation:
      // await convex.mutation(api.auditLog.create, auditEntry);
    }

    return result;
  });
