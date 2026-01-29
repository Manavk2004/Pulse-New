import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User accounts linked to Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("patient"), v.literal("physician"), v.literal("admin")),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Patient profiles with HIPAA-required fields
  patients: defineTable({
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    dateOfBirth: v.string(),
    phoneNumber: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        relationship: v.string(),
        phoneNumber: v.string(),
      })
    ),
    assignedPhysicianId: v.optional(v.id("users")),
    consentStatus: v.union(
      v.literal("pending"),
      v.literal("granted"),
      v.literal("revoked")
    ),
    consentTimestamp: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_assignedPhysician", ["assignedPhysicianId"])
    .index("by_consentStatus", ["consentStatus"])
    .searchIndex("search_name", {
      searchField: "firstName",
      filterFields: ["lastName"],
    }),

  // Physician profiles
  physicians: defineTable({
    userId: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    specialty: v.string(),
    licenseNumber: v.string(),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_userId", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Organizations (clinics, hospitals)
  organizations: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // Documents with file storage
  documents: defineTable({
    patientId: v.id("patients"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    category: v.union(
      v.literal("lab_result"),
      v.literal("prescription"),
      v.literal("imaging"),
      v.literal("notes"),
      v.literal("other")
    ),
    uploadedAt: v.number(),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  })
    .index("by_patientId", ["patientId"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_category", ["category"]),

  // Chat sessions
  chats: defineTable({
    patientId: v.id("patients"),
    status: v.union(
      v.literal("active"),
      v.literal("escalated"),
      v.literal("resolved")
    ),
    escalatedAt: v.optional(v.number()),
    escalatedTo: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_status", ["status"])
    .index("by_escalatedTo", ["escalatedTo"])
    // Compound index for efficiently finding active chats per patient
    .index("by_patientId_status", ["patientId", "status"]),

  // Chat messages
  messages: defineTable({
    chatId: v.id("chats"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(
      v.object({
        toolCalls: v.optional(v.array(v.any())),
        escalationInfo: v.optional(v.any()),
      })
    ),
  })
    .index("by_chatId", ["chatId"])
    .index("by_timestamp", ["timestamp"]),

  // Escalation records
  escalations: defineTable({
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
    status: v.union(
      v.literal("pending"),
      v.literal("acknowledged"),
      v.literal("resolved")
    ),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_chatId", ["chatId"])
    .index("by_patientId", ["patientId"])
    .index("by_physicianId", ["physicianId"])
    .index("by_status", ["status"])
    .index("by_severity", ["severity"]),

  // HIPAA Audit logging
  auditLog: defineTable({
    userId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_action", ["action"])
    .index("by_resourceType", ["resourceType"])
    .index("by_timestamp", ["timestamp"]),

  // Knowledge base for RAG
  knowledgeBase: defineTable({
    organizationId: v.optional(v.id("organizations")),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_category", ["category"]),
});
