import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// List all organizations (excludes registrationKey for security)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    return orgs
      .map(({ registrationKey: _, ...rest }) => rest)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

// Seed organizations (internal only — not callable from clients)
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing organizations
    const existing = await ctx.db.query("organizations").collect();
    for (const org of existing) {
      await ctx.db.delete(org._id);
    }

    const hospitals = [
      { name: "Mount Sinai Hospital", address: "1 Gustave L. Levy Pl, New York, NY 10029", phoneNumber: "(212) 241-6500" },
      { name: "Massachusetts General Hospital", address: "55 Fruit St, Boston, MA 02114", phoneNumber: "(617) 726-2000" },
      { name: "Mayo Clinic", address: "200 First St SW, Rochester, MN 55905", phoneNumber: "(507) 284-2511" },
      { name: "Johns Hopkins Hospital", address: "1800 Orleans St, Baltimore, MD 21287", phoneNumber: "(410) 955-5000" },
      { name: "Cleveland Clinic", address: "9500 Euclid Ave, Cleveland, OH 44195", phoneNumber: "(216) 444-2200" },
      { name: "UCLA Medical Center", address: "757 Westwood Plaza, Los Angeles, CA 90095", phoneNumber: "(310) 825-9111" },
      { name: "UCSF Medical Center", address: "505 Parnassus Ave, San Francisco, CA 94143", phoneNumber: "(415) 476-1000" },
      { name: "Northwestern Memorial Hospital", address: "251 E Huron St, Chicago, IL 60611", phoneNumber: "(312) 926-2000" },
      { name: "Stanford Health Care", address: "300 Pasteur Dr, Stanford, CA 94305", phoneNumber: "(650) 723-4000" },
      { name: "NYU Langone Health", address: "550 First Ave, New York, NY 10016", phoneNumber: "(212) 263-7300" },
    ];

    const now = Date.now();
    for (const hospital of hospitals) {
      await ctx.db.insert("organizations", {
        ...hospital,
        registrationKey: generateKey(),
        createdAt: now,
      });
    }
    return `Seeded ${hospitals.length} hospitals with registration keys`;
  },
});

// Verify registration key for an organization
export const verifyRegistrationKey = query({
  args: {
    organizationId: v.id("organizations"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      return false;
    }
    return org.registrationKey === args.key;
  },
});

// Get organization by ID (excludes registrationKey for security)
export const getById = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;
    const { registrationKey: _, ...rest } = org;
    return rest;
  },
});
