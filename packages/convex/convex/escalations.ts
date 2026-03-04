import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { listMessages } from "@convex-dev/agent";
import OpenAI from "openai";

// Create an escalation
export const create = mutation({
  args: {
    chatId: v.id("chats"),
    patientId: v.id("patients"),
    physicianId: v.id("users"),
    reason: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("escalations", {
      chatId: args.chatId,
      patientId: args.patientId,
      physicianId: args.physicianId,
      reason: args.reason,
      severity: args.severity,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Create an unassigned escalation (when patient has no assigned physician)
export const createUnassigned = mutation({
  args: {
    chatId: v.id("chats"),
    patientId: v.id("patients"),
    reason: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    // Find an available admin or physician to assign
    // For now, find any admin user to handle unassigned escalations
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    // Use the first admin found, or leave unassigned if none exist
    const assignedTo = admins[0]?._id;

    if (!assignedTo) {
      throw new Error(
        "No administrators available to handle escalation. Please contact support."
      );
    }

    return await ctx.db.insert("escalations", {
      chatId: args.chatId,
      patientId: args.patientId,
      physicianId: assignedTo,
      reason: `[UNASSIGNED PATIENT] ${args.reason}`,
      severity: args.severity,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Get escalation by ID
export const getById = query({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.escalationId);
  },
});

// Get escalations for a physician
export const getByPhysician = query({
  args: {
    physicianId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("acknowledged"),
        v.literal("resolved")
      )
    ),
  },
  handler: async (ctx, args) => {
    let escalations = await ctx.db
      .query("escalations")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianId))
      .order("desc")
      .collect();

    if (args.status) {
      escalations = escalations.filter((e) => e.status === args.status);
    }

    // Enrich with patient info
    return await Promise.all(
      escalations.map(async (esc) => {
        const patient = await ctx.db.get(esc.patientId);
        return { ...esc, patient };
      })
    );
  },
});

// Get escalations for a patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalations")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

// Get pending escalations by severity
export const getPendingBySeverity = query({
  args: {
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  handler: async (ctx, args) => {
    const escalations = await ctx.db
      .query("escalations")
      .withIndex("by_severity", (q) => q.eq("severity", args.severity))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return await Promise.all(
      escalations.map(async (esc) => {
        const patient = await ctx.db.get(esc.patientId);
        const physician = await ctx.db.get(esc.physicianId);
        return { ...esc, patient, physician };
      })
    );
  },
});

// Acknowledge escalation
export const acknowledge = mutation({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
    });
  },
});

// Resolve escalation
export const resolve = mutation({
  args: {
    escalationId: v.id("escalations"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, {
      status: "resolved",
      resolvedAt: Date.now(),
      notes: args.notes,
    });

    // Also resolve the associated chat
    const escalation = await ctx.db.get(args.escalationId);
    if (escalation) {
      await ctx.db.patch(escalation.chatId, {
        status: "resolved",
      });
    }
  },
});

// Internal mutation to patch the summary field on an escalation
export const patchSummary = internalMutation({
  args: {
    escalationId: v.id("escalations"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, { summary: args.summary });
  },
});

// Generate an AI summary for an escalation using the thread's messages
export const generateSummary = internalAction({
  args: {
    escalationId: v.id("escalations"),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch conversation messages from the agent component
    const paginated = await listMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: { numItems: 50, cursor: null },
      statuses: ["success", "failed"],
    });

    const messages = paginated.page
      .filter(
        (m) =>
          m.message?.role === "user" || m.message?.role === "assistant"
      )
      .map((m) => {
        const content = m.message?.content;
        const text =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? (content as any[])
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("")
              : "";
        return { role: m.message?.role as string, content: text };
      })
      .filter((m) => m.content);

    if (messages.length === 0) {
      await ctx.runMutation(internal.escalations.patchSummary, {
        escalationId: args.escalationId,
        summary: "No conversation messages available for summary.",
      });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.escalations.patchSummary, {
        escalationId: args.escalationId,
        summary: "Summary generation unavailable: API key not configured.",
      });
      return;
    }

    const openai = new OpenAI({ apiKey });

    const conversationText = messages
      .map((m) => `${m.role === "user" ? "Patient" : "AI"}: ${m.content}`)
      .join("\n");

    let summary: string;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a clinical summarizer. Given a patient-AI conversation that was escalated to a physician, produce a 2-3 sentence clinical summary highlighting the patient's chief complaint, key symptoms, and why escalation was triggered. Be concise and professional.",
          },
          {
            role: "user",
            content: conversationText,
          },
        ],
        max_tokens: 200,
      });
      summary =
        completion.choices[0]?.message?.content?.trim() ??
        "Summary generation failed.";
    } catch (error) {
      console.error("OpenAI summary generation error:", error);
      summary = "Summary generation failed due to an error.";
    }

    await ctx.runMutation(internal.escalations.patchSummary, {
      escalationId: args.escalationId,
      summary,
    });
  },
});

// Get enriched escalation detail by ID (escalation + patient + chat + documents with URLs)
export const getDetailById = query({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, args) => {
    const escalation = await ctx.db.get(args.escalationId);
    if (!escalation) return null;

    const patient = await ctx.db.get(escalation.patientId);
    const chat = await ctx.db.get(escalation.chatId);

    // Fetch patient documents with signed URLs
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", escalation.patientId))
      .collect();

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return { ...doc, url };
      })
    );

    // Fetch physician profile
    const physician = escalation.physicianId
      ? await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", escalation.physicianId))
          .unique()
      : null;

    return {
      ...escalation,
      patient,
      chat,
      documents: documentsWithUrls,
      physician,
    };
  },
});

// Count active (non-resolved) escalations for a physician
export const countActiveByPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    const escalations = await ctx.db
      .query("escalations")
      .withIndex("by_physicianId", (q) => q.eq("physicianId", args.physicianId))
      .collect();

    return escalations.filter((e) => e.status !== "resolved").length;
  },
});
