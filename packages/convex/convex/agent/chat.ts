import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for the medical assistant
const SYSTEM_PROMPT = `You are Pulse, a medical assistant AI. Your role is to:

1. Help patients understand their symptoms and health concerns
2. Provide general health information and guidance
3. Help patients prepare for doctor visits
4. Remind patients about medication and appointments
5. Answer questions about medical documents and test results

IMPORTANT GUIDELINES:
- You are NOT a replacement for professional medical advice
- Always recommend patients consult with their physician for serious concerns
- If a patient describes symptoms that could be an emergency (chest pain, difficulty breathing, severe bleeding, etc.), respond with ESCALATE: followed by the reason
- Be empathetic, patient, and clear in your explanations
- Use simple language, avoiding medical jargon when possible
- Ask clarifying questions to better understand the patient's concerns
- Never diagnose conditions or prescribe treatments
- Maintain patient privacy and confidentiality at all times`;

// Internal action to handle chat
export const chat = internalAction({
  args: {
    chatId: v.id("chats"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Get chat history
    const messages = await ctx.runQuery(api.chats.getMessages, {
      chatId: args.chatId,
    });

    // Get chat info for patient context
    const chat = await ctx.runQuery(api.chats.getById, {
      chatId: args.chatId,
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    // Get patient info
    const patient = await ctx.runQuery(api.patients.getById, {
      patientId: chat.patientId,
    });

    // Build message history for OpenAI
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add patient context
    if (patient) {
      chatMessages.push({
        role: "system",
        content: `Patient context: ${patient.firstName} ${patient.lastName}`,
      });
    }

    // Add message history
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        chatMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add the new user message
    chatMessages.push({
      role: "user",
      content: args.message,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      max_tokens: 1024,
    });

    const response = completion.choices[0]?.message?.content || "";

    // Check if response indicates escalation
    if (response.startsWith("ESCALATE:")) {
      const reason = response.replace("ESCALATE:", "").trim();

      if (patient?.assignedPhysicianId) {
        // Create escalation with assigned physician
        await ctx.runMutation(api.escalations.create, {
          chatId: args.chatId,
          patientId: chat.patientId,
          physicianId: patient.assignedPhysicianId,
          reason,
          severity: determineSeverity(reason),
        });

        // Escalate the chat
        await ctx.runMutation(api.chats.escalate, {
          chatId: args.chatId,
          physicianId: patient.assignedPhysicianId,
        });

        return `I've escalated your concern to your physician. They will review your case and reach out to you soon. In the meantime, if this is a medical emergency, please call 911 or go to your nearest emergency room.`;
      } else {
        // No assigned physician - create unassigned escalation for review
        await ctx.runMutation(api.escalations.createUnassigned, {
          chatId: args.chatId,
          patientId: chat.patientId,
          reason,
          severity: determineSeverity(reason),
        });

        return `I understand this is a concern that needs medical attention. We've flagged this for review by our medical staff, but you don't currently have an assigned physician. Someone will follow up with you as soon as possible. If this is a medical emergency, please call 911 or go to your nearest emergency room immediately.`;
      }
    }

    return response;
  },
});

// Public action for sending messages
export const sendMessage = action({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    let response: string;

    try {
      // Get AI response first before persisting anything
      response = await ctx.runAction(internal.agent.chat.chat, {
        chatId: args.chatId,
        message: args.content,
      });
    } catch (error) {
      // AI call failed - save both messages with error response
      await ctx.runMutation(api.chats.addMessage, {
        chatId: args.chatId,
        role: "user",
        content: args.content,
      });

      const errorMessage =
        "I'm sorry, I encountered an error processing your message. Please try again, or if the issue persists, contact support.";

      await ctx.runMutation(api.chats.addMessage, {
        chatId: args.chatId,
        role: "assistant",
        content: errorMessage,
      });

      return errorMessage;
    }

    // AI succeeded - save both messages
    await ctx.runMutation(api.chats.addMessage, {
      chatId: args.chatId,
      role: "user",
      content: args.content,
    });

    await ctx.runMutation(api.chats.addMessage, {
      chatId: args.chatId,
      role: "assistant",
      content: response,
    });

    return response;
  },
});

// Helper to determine severity based on keywords
function determineSeverity(
  reason: string
): "low" | "medium" | "high" | "urgent" {
  const lowerReason = reason.toLowerCase();

  const urgentKeywords = [
    "chest pain",
    "heart attack",
    "stroke",
    "difficulty breathing",
    "severe bleeding",
    "unconscious",
    "suicide",
    "overdose",
  ];

  const highKeywords = [
    "severe pain",
    "high fever",
    "infection",
    "allergic reaction",
    "swelling",
    "vomiting blood",
  ];

  const mediumKeywords = [
    "persistent pain",
    "worsening symptoms",
    "medication concerns",
    "new symptoms",
    "fever",
  ];

  if (urgentKeywords.some((k) => lowerReason.includes(k))) {
    return "urgent";
  }
  if (highKeywords.some((k) => lowerReason.includes(k))) {
    return "high";
  }
  if (mediumKeywords.some((k) => lowerReason.includes(k))) {
    return "medium";
  }
  return "low";
}
