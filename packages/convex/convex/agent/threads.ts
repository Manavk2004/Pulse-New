import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { components } from "../_generated/api";
import { paginationOptsValidator } from "convex/server";
import { healthAgent } from "./index";
import { listMessages } from "@convex-dev/agent";

// List all threads for a user (sidebar)
export const listThreads = query({
  args: {
    userId: v.string(),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth once ConvexProviderWithClerk is configured
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity || identity.subject !== args.userId) throw new Error("Unauthorized");
    return await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: args.userId,
      order: "desc",
      paginationOpts: args.paginationOpts ?? { numItems: 50, cursor: null },
    });
  },
});

// Get messages for a thread (chat view)
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth — verify the requesting user owns this thread
    const paginated = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      statuses: ["success", "failed", "pending"],
    });
    return paginated;
  },
});

// Create a new thread
export const createThread = mutation({
  args: {
    userId: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth once ConvexProviderWithClerk is configured
    const thread = await ctx.runMutation(
      components.agent.threads.createThread,
      {
        userId: args.userId,
        title: args.title ?? "New Chat",
      }
    );
    return thread._id;
  },
});

// Send a message and get AI response
export const sendMessage = action({
  args: {
    threadId: v.string(),
    content: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth once ConvexProviderWithClerk is configured
    try {
      const { thread } = await healthAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId: args.userId,
      });

      const result = await thread.generateText({
        prompt: args.content,
      });

      return result.text;
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to generate AI response:", msg);
      // Return a sanitized error — don't leak provider internals to the client
      throw new Error(
        "Sorry, I was unable to process your request. Please try again."
      );
    }
  },
});

// Delete a thread
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth — verify the requesting user owns this thread
    // Component IDs are typed as Id<"threads"> internally but passed as strings
    // from the parent app — the cast is the documented workaround for components.
    await ctx.runMutation(
      components.agent.threads.deleteAllForThreadIdAsync,
      {
        threadId: args.threadId as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    );
  },
});
