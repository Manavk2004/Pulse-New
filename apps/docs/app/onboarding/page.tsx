"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Loader2, Building2, UserCheck, Heart } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Look up Convex user by Clerk ID
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  // Check if patient profile already exists
  const existingPatient = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  // Queries for dropdowns
  const organizations = useQuery(api.organizations.listAll);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const physicians = useQuery(
    api.physicians.getByOrganization,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedOrgId ? { organizationId: selectedOrgId as any } : "skip"
  );

  // Mutations
  const upsertUser = useMutation(api.users.upsertFromClerk);
  const createPatient = useMutation(api.patients.create);
  const assignPhysician = useMutation(api.patients.assignPhysician);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPhysicianId, setSelectedPhysicianId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if patient profile already exists
  useEffect(() => {
    if (existingPatient) {
      router.replace("/portal");
    }
  }, [existingPatient, router]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (clerkLoaded && !clerkUser) {
      router.replace("/sign-in");
    }
  }, [clerkLoaded, clerkUser, router]);

  // Loading state
  if (!clerkLoaded || (clerkUser && convexUser === undefined) || existingPatient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!firstName || !lastName || !dateOfBirth || !selectedOrgId || !selectedPhysicianId) {
      setError("Please fill in all required fields.");
      return;
    }

    // Validate date of birth
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      setError("Please enter a valid date of birth.");
      return;
    }

    setSubmitting(true);

    try {
      // Ensure Convex user exists (handles webhook race condition)
      let userId = convexUser?._id;
      if (!userId && clerkUser) {
        userId = await upsertUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
          role: "patient",
        });
      }

      if (!userId) {
        setError("Unable to create user account. Please try again.");
        return;
      }

      // Create patient profile
      const patientId = await createPatient({
        userId,
        firstName,
        lastName,
        dateOfBirth,
        phoneNumber: phoneNumber || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationId: selectedOrgId as any,
      });

      // Assign physician
      await assignPhysician({
        patientId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        physicianId: selectedPhysicianId as any,
      });

      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen portal-grid flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to Pulse</h1>
          <p className="text-muted-foreground mt-2">
            Let&apos;s set up your patient profile to get started.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg border border-border p-8 space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1.5">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                required
                maxLength={100}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="John"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1.5">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                maxLength={100}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="dob" className="block text-sm font-medium text-foreground mb-1.5">
              Date of Birth <span className="text-destructive">*</span>
            </label>
            <input
              id="dob"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1.5">
              Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Hospital / Organization */}
          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-foreground mb-1.5">
              <Building2 className="inline w-4 h-4 mr-1 -mt-0.5" />
              Hospital / Organization <span className="text-destructive">*</span>
            </label>
            <select
              id="organization"
              required
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedPhysicianId("");
              }}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a hospital...</option>
              {organizations?.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name}{org.address ? ` — ${org.address}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Physician */}
          <div>
            <label htmlFor="physician" className="block text-sm font-medium text-foreground mb-1.5">
              <UserCheck className="inline w-4 h-4 mr-1 -mt-0.5" />
              Assigned Physician <span className="text-destructive">*</span>
            </label>
            <select
              id="physician"
              required
              value={selectedPhysicianId}
              disabled={!selectedOrgId}
              onChange={(e) => setSelectedPhysicianId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedOrgId ? "Select a hospital first..." : "Select a physician..."}
              </option>
              {physicians?.map((doc) => (
                <option key={doc._id} value={doc.userId}>
                  Dr. {doc.firstName} {doc.lastName} — {doc.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Setting up your profile...
              </>
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
