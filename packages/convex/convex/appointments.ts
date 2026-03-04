import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all appointments for a patient, enriched with physician info
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    return await Promise.all(
      appointments.map(async (appt) => {
        const physician = await ctx.db
          .query("physicians")
          .withIndex("by_userId", (q) => q.eq("userId", appt.physicianId))
          .first();
        return { ...appt, physician };
      })
    );
  },
});

// Get all appointments for a physician, enriched with patient info
export const getByPhysician = query({
  args: { physicianId: v.id("users") },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_physician", (q) => q.eq("physicianId", args.physicianId))
      .collect();

    return await Promise.all(
      appointments.map(async (appt) => {
        const patient = await ctx.db.get(appt.patientId);
        return { ...appt, patient };
      })
    );
  },
});

// Get appointments for a physician on a specific date
export const getByPhysicianAndDate = query({
  args: {
    physicianId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_physician_date", (q) =>
        q.eq("physicianId", args.physicianId).eq("date", args.date)
      )
      .collect();

    return await Promise.all(
      appointments.map(async (appt) => {
        const patient = await ctx.db.get(appt.patientId);
        return { ...appt, patient };
      })
    );
  },
});

// Book an appointment (race-safe via Convex serialization)
export const book = mutation({
  args: {
    patientId: v.id("patients"),
    physicianId: v.id("users"),
    slotId: v.id("availabilitySlots"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.physicianId !== args.physicianId) {
      throw new Error("Slot does not belong to the specified physician");
    }
    if (slot.isBooked) throw new Error("This slot is already booked");

    // Mark slot as booked
    await ctx.db.patch(args.slotId, { isBooked: true });

    const now = Date.now();
    return await ctx.db.insert("appointments", {
      patientId: args.patientId,
      physicianId: args.physicianId,
      slotId: args.slotId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "scheduled",
      reason: args.reason,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Cancel an appointment and unbook the slot
export const cancel = mutation({
  args: {
    appointmentId: v.id("appointments"),
    cancelledBy: v.union(v.literal("patient"), v.literal("physician")),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.appointmentId);
    if (!appt) throw new Error("Appointment not found");
    if (appt.status !== "scheduled") {
      throw new Error("Only scheduled appointments can be cancelled");
    }

    await ctx.db.patch(args.appointmentId, {
      status: "cancelled",
      cancelledBy: args.cancelledBy,
      updatedAt: Date.now(),
    });

    // Unbook the slot
    const slot = await ctx.db.get(appt.slotId);
    if (slot) {
      await ctx.db.patch(appt.slotId, { isBooked: false });
    }
  },
});

// Update appointment status (completed / no_show)
export const updateStatus = mutation({
  args: {
    appointmentId: v.id("appointments"),
    status: v.union(
      v.literal("completed"),
      v.literal("no_show")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.appointmentId);
    if (!appt) throw new Error("Appointment not found");
    if (appt.status !== "scheduled") {
      throw new Error("Only scheduled appointments can be updated");
    }

    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.notes !== undefined) {
      patch.notes = args.notes;
    }
    await ctx.db.patch(args.appointmentId, patch);
  },
});
