import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateDate(date: string) {
  if (!DATE_RE.test(date)) throw new Error("Invalid date format, expected YYYY-MM-DD");
  const parsed = new Date(date + "T00:00:00Z");
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid date value");
  }
}
function validateTime(time: string) {
  if (!TIME_RE.test(time)) throw new Error("Invalid time format, expected HH:mm");
}

// Get slots for a physician across a date range (calendar month view)
export const getByPhysicianAndDateRange = query({
  args: {
    physicianId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("availabilitySlots")
      .withIndex("by_physician_date", (q) =>
        q
          .eq("physicianId", args.physicianId)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .collect();
  },
});

// Get available (unbooked) slots for a physician on a specific date
export const getAvailableByPhysicianAndDate = query({
  args: {
    physicianId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const slots = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_physician_date", (q) =>
        q.eq("physicianId", args.physicianId).eq("date", args.date)
      )
      .collect();

    return slots.filter((s) => !s.isBooked);
  },
});

// Get all slots for a physician on a specific date (physician day view)
export const getByPhysicianAndDate = query({
  args: {
    physicianId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("availabilitySlots")
      .withIndex("by_physician_date", (q) =>
        q.eq("physicianId", args.physicianId).eq("date", args.date)
      )
      .collect();
  },
});

// Create a single availability slot with overlap validation
export const create = mutation({
  args: {
    physicianId: v.id("users"),
    date: v.string(),
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (ctx, args) => {
    validateDate(args.date);
    validateTime(args.startTime);
    validateTime(args.endTime);

    if (args.startTime >= args.endTime) {
      throw new Error("Start time must be before end time");
    }

    // Check for overlapping slots
    const existing = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_physician_date", (q) =>
        q.eq("physicianId", args.physicianId).eq("date", args.date)
      )
      .collect();

    const overlaps = existing.some(
      (s) => args.startTime < s.endTime && args.endTime > s.startTime
    );

    if (overlaps) {
      throw new Error("This slot overlaps with an existing slot");
    }

    return await ctx.db.insert("availabilitySlots", {
      physicianId: args.physicianId,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      isBooked: false,
      createdAt: Date.now(),
    });
  },
});

// Bulk create slots
export const createBulk = mutation({
  args: {
    physicianId: v.id("users"),
    slots: v.array(
      v.object({
        date: v.string(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    const insertedSlots: { date: string; startTime: string; endTime: string }[] = [];

    for (const slot of args.slots) {
      if (!DATE_RE.test(slot.date) || !TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) continue;
      if (slot.startTime >= slot.endTime) continue;

      const existing = await ctx.db
        .query("availabilitySlots")
        .withIndex("by_physician_date", (q) =>
          q.eq("physicianId", args.physicianId).eq("date", slot.date)
        )
        .collect();

      const allSlots = [...existing, ...insertedSlots.filter((s) => s.date === slot.date)];
      const overlaps = allSlots.some(
        (s) => slot.startTime < s.endTime && slot.endTime > s.startTime
      );

      if (!overlaps) {
        const id = await ctx.db.insert("availabilitySlots", {
          physicianId: args.physicianId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBooked: false,
          createdAt: Date.now(),
        });
        ids.push(id);
        insertedSlots.push({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime });
      }
    }
    return ids;
  },
});

// Remove an unbooked slot
export const remove = mutation({
  args: { slotId: v.id("availabilitySlots") },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.isBooked) throw new Error("Cannot delete a booked slot");
    await ctx.db.delete(args.slotId);
  },
});
