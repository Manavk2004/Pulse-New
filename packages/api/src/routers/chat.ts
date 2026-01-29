import { z } from "zod";
import { router, protectedProcedure, withAuditLog } from "../trpc";

export const chatRouter = router({
  // Get or create active chat for patient
  getOrCreate: protectedProcedure
    .use(withAuditLog("chat_access", "chat"))
    .input(z.object({ patientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get or create in Convex
      return {
        chatId: "",
      };
    }),

  // Get chat by ID
  get: protectedProcedure
    .use(withAuditLog("chat_view", "chat"))
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        chat: null,
      };
    }),

  // List chats for a patient
  listByPatient: protectedProcedure
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        chats: [],
      };
    }),

  // Get messages for a chat
  getMessages: protectedProcedure
    .use(withAuditLog("chat_messages_view", "chat"))
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get from Convex
      return {
        messages: [],
      };
    }),

  // Send a message (triggers AI response)
  sendMessage: protectedProcedure
    .use(withAuditLog("chat_message_send", "chat"))
    .input(
      z.object({
        chatId: z.string(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // This will call the Convex action for AI response
      return {
        messageId: "",
        response: "",
      };
    }),

  // Resolve a chat
  resolve: protectedProcedure
    .use(withAuditLog("chat_resolve", "chat"))
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Resolve in Convex
      return {
        success: true,
      };
    }),
});

export type ChatRouter = typeof chatRouter;
