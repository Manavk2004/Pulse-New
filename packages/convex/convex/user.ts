import { query } from "./_generated/server";

// Get all patients for the physician dashboard
export const getAll = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return empty array when unauthenticated rather than throwing,
      // since the web app uses ConvexProvider (not ConvexProviderWithClerk yet).
      // TODO: Once ConvexProviderWithClerk is configured, throw Error("Unauthorized") here
      // and verify the caller has a physician role before returning PII.
      return [];
    }

    const patients = await ctx.db.query("patients").collect();
    // Map schema fields to the format expected by the web app
    return patients.map((p) => ({
      _id: p._id,
      _creationTime: p._creationTime,
      firstname: p.firstName,
      lastname: p.lastName,
      dateofbirth: p.dateOfBirth,
      phone: p.phoneNumber,
    }));
  },
});
