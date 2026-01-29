import { createTRPCReact, type CreateTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./root";

// Create tRPC React hooks with explicit type annotation
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

// Re-export types
export type { AppRouter } from "./root";
