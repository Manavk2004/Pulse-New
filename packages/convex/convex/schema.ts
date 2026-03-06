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
    healthOverview: v.optional(v.string()),
    healthOverviewUpdatedAt: v.optional(v.number()),
    medications: v.optional(v.array(v.object({ name: v.string(), dosage: v.optional(v.string()) }))),
    allergies: v.optional(v.array(v.object({ allergen: v.string(), type: v.optional(v.union(v.literal("drug"), v.literal("food"), v.literal("environmental"), v.literal("other"))) }))),
    conditions: v.optional(v.array(v.object({ name: v.string(), status: v.optional(v.union(v.literal("active"), v.literal("resolved"), v.literal("chronic"))) }))),
    sex: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    bloodType: v.optional(v.union(v.literal("A+"), v.literal("A-"), v.literal("B+"), v.literal("B-"), v.literal("AB+"), v.literal("AB-"), v.literal("O+"), v.literal("O-"))),
    procedures: v.optional(v.array(v.object({ name: v.string(), date: v.optional(v.string()) }))),
    insurance: v.optional(v.object({ planName: v.optional(v.string()), provider: v.optional(v.string()), memberId: v.optional(v.string()) })),
    about: v.optional(v.string()),
    familyHistory: v.optional(v.array(v.object({ relation: v.string(), condition: v.string() }))),
    smokingStatus: v.optional(v.union(v.literal("never"), v.literal("former"), v.literal("current"))),
    alcoholUse: v.optional(v.union(v.literal("none"), v.literal("occasional"), v.literal("moderate"), v.literal("heavy"))),
    exerciseFrequency: v.optional(v.string()),
    occupation: v.optional(v.string()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    healthTips: v.optional(v.array(v.object({ title: v.string(), tip: v.string(), reason: v.optional(v.string()) }))),
    healthTipsUpdatedAt: v.optional(v.number()),
    profileFieldsUpdatedAt: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id("_storage")),
    bannerPhotoStorageId: v.optional(v.id("_storage")),
    cardBio: v.optional(v.string()),
    cardVisibleFields: v.optional(v.array(v.string())),
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
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id("_storage")),
    bannerPhotoStorageId: v.optional(v.id("_storage")),
    cardBio: v.optional(v.string()),
    rating: v.optional(v.number()),
    yearsOfExperience: v.optional(v.number()),
    education: v.optional(v.string()),
    phone: v.optional(v.string()),
    about: v.optional(v.string()),
    boardCertifications: v.optional(v.array(v.object({ name: v.string(), year: v.optional(v.number()) }))),
    hospitalAffiliations: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    insurancesAccepted: v.optional(v.array(v.string())),
    acceptingNewPatients: v.optional(v.boolean()),
    conditionsTreated: v.optional(v.array(v.string())),
    residency: v.optional(v.string()),
    fellowship: v.optional(v.string()),
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
    reviewStatus: v.optional(v.union(v.literal("pendingReview"), v.literal("approved"), v.literal("rejected"))),
    uploadedByRole: v.optional(v.union(v.literal("patient"), v.literal("physician"))),
  })
    .index("by_patientId", ["patientId"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_category", ["category"])
    .index("by_patientId_reviewStatus", ["patientId", "reviewStatus"]),

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
    initiatedBy: v.optional(v.union(v.literal("physician"), v.literal("patient"))),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_physicianId", ["physicianId"])
    .index("by_patientId", ["patientId"])
    .index("by_status", ["status"])
    .index("by_physicianId_status", ["physicianId", "status"])
    .index("by_patientId_status", ["patientId", "status"]),

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

  // Vitals extracted from medical documents
  vitals: defineTable({
    patientId: v.id("patients"),
    documentId: v.optional(v.id("documents")),
    heartRate: v.optional(v.number()),
    systolicBP: v.optional(v.number()),
    diastolicBP: v.optional(v.number()),
    glucoseLevel: v.optional(v.number()),
    bodyTemperature: v.optional(v.number()),
    extractedAt: v.number(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_patientId_extractedAt", ["patientId", "extractedAt"])
    .index("by_documentId", ["documentId"]),

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
