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
    organizationId: v.optional(v.id("organizations")),
    assignedPhysicianId: v.optional(v.id("users")),
    connected: v.optional(v.boolean()),
    showPatient: v.optional(v.boolean()),
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
    .index("by_organizationId", ["organizationId"])
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
    email: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  })
    .index("by_userId", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Organizations (clinics, hospitals)
  organizations: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    registrationKey: v.string(),
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
    aiSummary: v.optional(v.string()),
    aiSummaryStatus: v.optional(
      v.union(
        v.literal("generating"),
        v.literal("done"),
        v.literal("failed")
      )
    ),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_patientId", ["patientId"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_category", ["category"]),

  // Chat sessions
  chats: defineTable({
    patientId: v.id("patients"),
    title: v.optional(v.string()),
    threadId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
    status: v.union(
      v.literal("unresolved"),
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
    .index("by_patientId_status", ["patientId", "status"])
    .index("by_threadId", ["threadId"])
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

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
    summary: v.optional(v.string()),
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

  // Connection requests between physicians and patients
  connectionRequests: defineTable({
    physicianId: v.id("users"),
    patientId: v.id("patients"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_physicianId", ["physicianId"])
    .index("by_patientId", ["patientId"])
    .index("by_status", ["status"])
    .index("by_physicianId_status", ["physicianId", "status"]),

  // Physician availability slots
  availabilitySlots: defineTable({
    physicianId: v.id("users"),
    date: v.string(), // ISO "2026-03-15"
    startTime: v.string(), // "09:00"
    endTime: v.string(), // "09:30"
    isBooked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_physician", ["physicianId"])
    .index("by_physician_date", ["physicianId", "date"]),

  // Booked appointments
  appointments: defineTable({
    patientId: v.id("patients"),
    physicianId: v.id("users"),
    slotId: v.id("availabilitySlots"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("no_show")
    ),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    cancelledBy: v.optional(
      v.union(v.literal("patient"), v.literal("physician"))
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_patient", ["patientId"])
    .index("by_physician", ["physicianId"])
    .index("by_physician_date", ["physicianId", "date"]),

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
