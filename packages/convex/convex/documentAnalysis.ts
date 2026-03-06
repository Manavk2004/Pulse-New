import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import OpenAI from "openai";

// Get all documents with summaries for a patient (for AI room display)
export const getDocumentsWithAnalysis = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    const approved = documents.filter(
      (d) => d.reviewStatus !== "pendingReview"
    );

    return await Promise.all(
      approved.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return {
          _id: doc._id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          category: doc.category,
          uploadedAt: doc.uploadedAt,
          aiSummary: doc.aiSummary,
          aiSummaryStatus: doc.aiSummaryStatus,
          url,
        };
      })
    );
  },
});

// Document-aware chat action
export const chatWithDocuments = action({
  args: {
    patientId: v.id("patients"),
    question: v.string(),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    focusedDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return "AI analysis is currently unavailable. Please try again later.";
    }

    const openai = new OpenAI({ apiKey });

    // Get patient profile for context
    const patient = await ctx.runQuery(api.patients.getById, {
      patientId: args.patientId,
    });

    // Get all documents with summaries
    const documents = await ctx.runQuery(
      api.documentAnalysis.getDocumentsWithAnalysis,
      { patientId: args.patientId }
    );

    const docsWithSummaries = documents.filter(
      (d: any) => d.aiSummary && d.aiSummaryStatus === "done"
    );

    // Build document context
    let documentContext = "";
    if (docsWithSummaries.length > 0) {
      documentContext = docsWithSummaries
        .map(
          (d: any, i: number) =>
            `[Document ${i + 1}] "${d.fileName}" (${d.category}, uploaded ${new Date(d.uploadedAt).toLocaleDateString()}):\n${d.aiSummary}`
        )
        .join("\n\n");
    }

    // If a specific document is focused, emphasize it
    let focusedContext = "";
    if (args.focusedDocumentId) {
      const focused = docsWithSummaries.find(
        (d: any) => d._id === args.focusedDocumentId
      );
      if (focused) {
        focusedContext = `\n\nThe patient is currently focused on this specific document: "${(focused as any).fileName}" - ${(focused as any).aiSummary}`;
      }
    }

    const systemPrompt = `You are Pulse AI Document Analyst, an advanced medical document analysis assistant. You have access to the patient's medical documents and their AI-generated summaries.

Your role is to:
1. Provide in-depth analysis and explanations of medical documents
2. Help patients understand medical terminology, test results, and findings
3. Identify patterns, trends, and correlations across multiple documents
4. Answer specific questions about their health records
5. Highlight important findings that may need attention

IMPORTANT GUIDELINES:
- You are NOT a replacement for professional medical advice
- Always recommend patients consult with their physician for serious concerns
- Be thorough and educational in your explanations
- Use clear, patient-friendly language while still being medically accurate
- When referencing specific documents, mention them by name
- If you notice concerning trends across documents, flag them clearly
- Never diagnose conditions or prescribe treatments
- If a patient asks about something not in their documents, be honest about the limitation

PATIENT CONTEXT:
${patient ? `Name: ${patient.firstName} ${patient.lastName}` : "Unknown patient"}
${patient?.healthOverview ? `Health Overview: ${patient.healthOverview}` : ""}
${patient?.medications?.length ? `Current Medications: ${patient.medications.map((m: any) => `${m.name}${m.dosage ? ` (${m.dosage})` : ""}`).join(", ")}` : ""}
${patient?.conditions?.length ? `Known Conditions: ${patient.conditions.map((c: any) => `${c.name}${c.status ? ` (${c.status})` : ""}`).join(", ")}` : ""}
${patient?.allergies?.length ? `Allergies: ${patient.allergies.map((a: any) => a.allergen).join(", ")}` : ""}

MEDICAL DOCUMENTS ON FILE:
${documentContext || "No documents with AI analysis available yet."}
${focusedContext}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Limit conversation history to last 20 messages to stay within token budget
    const MAX_HISTORY_MESSAGES = 20;
    const truncatedHistory = args.conversationHistory.slice(-MAX_HISTORY_MESSAGES);

    // Add conversation history
    for (const msg of truncatedHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current question
    messages.push({ role: "user", content: args.question });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 1500,
        temperature: 0.3,
      });

      return (
        completion.choices[0]?.message?.content?.trim() ??
        "I was unable to generate a response. Please try again."
      );
    } catch (error) {
      console.error("Document analysis chat error:", error);
      return "I encountered an error analyzing your documents. Please try again.";
    }
  },
});
