import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { paginationOptsValidator } from "convex/server";
import { healthAgent } from "./index";
import { listMessages } from "@convex-dev/agent";
import { z } from "zod";

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

    // Validate user and patient exist BEFORE creating the thread
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.userId))
      .unique();
    if (!user) {
      throw new Error("User not found. Please complete onboarding first.");
    }

    const patient = await ctx.db
      .query("patients")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!patient) {
      throw new Error("Patient record not found. Please complete onboarding first.");
    }

    const thread = await ctx.runMutation(
      components.agent.threads.createThread,
      {
        userId: args.userId,
        title: args.title ?? "New Chat",
      }
    );

    await ctx.db.insert("chats", {
      patientId: patient._id,
      userId: user._id,
      organizationId: patient.organizationId,
      threadId: thread._id,
      title: args.title ?? "New Chat",
      status: "unresolved",
      createdAt: Date.now(),
    });

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

    // Check if the chat is escalated — if so, save the message but don't trigger AI
    const chat = await ctx.runQuery(internal.chats.getByThreadId, {
      threadId: args.threadId,
    });
    if (chat?.status === "escalated") {
      // Save the patient's message to the thread so the physician can see it
      try {
        await healthAgent.saveMessage(ctx, {
          threadId: args.threadId,
          message: { role: "user", content: args.content },
          skipEmbeddings: true,
        });
        return "Your message has been sent. A physician will respond shortly.";
      } catch (error: unknown) {
        console.error("Failed to save escalated message:", error);
        throw new Error(
          "Sorry, I was unable to send your message. Please try again."
        );
      }
    }

    try {
      const { thread } = await healthAgent.continueThread(ctx, {
        threadId: args.threadId,
        userId: args.userId,
      });

      const result = await thread.generateText({
        prompt: args.content,
        tools: {
          escalateToPhysician: {
            description:
              "Escalate the conversation to the patient's physician. Call this when the patient requests to speak with their doctor, expresses frustration, has concerns beyond AI scope, or describes serious/worsening symptoms. You MUST assess the clinical severity of the situation based on the full conversation context.",
            inputSchema: z.object({
              reason: z
                .string()
                .describe(
                  "A clear, concise summary of why this conversation is being escalated"
                ),
              severity: z
                .enum(["low", "medium", "high", "urgent"])
                .describe(
                  "Clinical severity: 'urgent' = life-threatening or emergency (cancer concerns, chest pain, stroke symptoms, suicidal ideation, severe bleeding, seizures, difficulty breathing); 'high' = serious condition needing prompt attention (tumors, lumps, persistent vomiting blood, sudden weight loss, severe infections, allergic reactions); 'medium' = concerning but not immediately dangerous (worsening symptoms, new/unusual symptoms, medication side effects, persistent pain, fever); 'low' = general questions, routine follow-ups, patient simply wants to talk to doctor, frustration with AI"
                ),
            }),
            execute: async ({ reason, severity }: { reason: string; severity: "low" | "medium" | "high" | "urgent" }) => {
              await ctx.runMutation(internal.chats.escalateByThreadId, {
                threadId: args.threadId,
                reason,
                severity,
              });
              return { success: true, message: "Conversation has been escalated to the physician." };
            },
          },
          resolveConversation: {
            description:
              "Mark the conversation as resolved. Call this when the patient indicates their issue is resolved, they no longer need help, or they explicitly say the conversation can be closed.",
            inputSchema: z.object({}),
            execute: async () => {
              await ctx.runMutation(internal.chats.resolveByThreadId, {
                threadId: args.threadId,
              });
              return { success: true, message: "Conversation has been marked as resolved." };
            },
          },
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Zod v4 / AI SDK v5 type mismatch
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

// Send a physician message directly into a thread (no AI generation)
export const sendPhysicianMessage = mutation({
  args: {
    threadId: v.string(),
    content: v.string(),
    physicianName: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Add server-side auth — verify the caller is a physician with access to this thread
    const prefixedContent = `**Dr. ${args.physicianName}:** ${args.content}`;
    await healthAgent.saveMessage(ctx, {
      threadId: args.threadId,
      message: {
        role: "assistant",
        content: prefixedContent,
      },
      skipEmbeddings: true,
    });
  },
});

// Create a new physician-initiated thread with a patient (no AI involvement)
export const createPhysicianThread = mutation({
  args: {
    physicianUserId: v.id("users"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    // Verify the physician exists and is assigned to this patient
    const physicianProfile = await ctx.db
      .query("physicians")
      .withIndex("by_userId", (q) => q.eq("userId", args.physicianUserId))
      .unique();
    if (!physicianProfile) throw new Error("Physician profile not found.");

    // Look up patient record
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found.");

    // Verify the physician is assigned to this patient
    if (patient.assignedPhysicianId !== args.physicianUserId) {
      throw new Error("Unauthorized: Physician is not assigned to this patient.");
    }

    // Look up patient's user record to get clerkId for thread creation
    const patientUser = await ctx.db.get(patient.userId);
    if (!patientUser) throw new Error("Patient user record not found.");

    const title = `Dr. ${physicianProfile.firstName} ${physicianProfile.lastName}`;

    // Create agent thread under patient's Clerk ID so patient sees it too
    const thread = await ctx.runMutation(
      components.agent.threads.createThread,
      {
        userId: patientUser.clerkId,
        title,
      }
    );

    // Create chat record
    await ctx.db.insert("chats", {
      patientId: args.patientId,
      userId: patient.userId,
      organizationId: patient.organizationId,
      threadId: thread._id,
      title,
      status: "escalated",
      escalatedAt: Date.now(),
      escalatedTo: args.physicianUserId,
      createdAt: Date.now(),
    });

    return thread._id;
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

    // Also delete the corresponding chats row
    const chatRow = await ctx.db
      .query("chats")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (chatRow) {
      await ctx.db.delete(chatRow._id);
    }
  },
});
