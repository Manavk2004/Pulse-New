import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./root";
import type { Context } from "./trpc";

// Create tRPC handler for Next.js API routes
export const createTRPCHandler = (createContext: () => Promise<Context>) => {
  return async (req: Request) => {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext,
      onError:
        process.env.NODE_ENV === "development"
          ? ({ path, error }) => {
              console.error(`❌ tRPC failed on ${path ?? "<no-path>"}:`, error);
            }
          : undefined,
    });
  };
};

// Re-export router for type inference
export { appRouter };
export type { AppRouter } from "./root";
