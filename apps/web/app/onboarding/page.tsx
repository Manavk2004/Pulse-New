"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@repo/convex";
import { Loader2, Activity, Building2, Stethoscope } from "lucide-react";

const SPECIALTIES = [
  "Cardiology",
  "Dermatology",
  "Emergency Medicine",
  "Endocrinology",
  "Family Medicine",
  "Gastroenterology",
  "General Surgery",
  "Internal Medicine",
  "Nephrology",
  "Neurology",
  "Obstetrics & Gynecology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Urology",
];

export default function PhysicianOnboardingPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Look up Convex user by Clerk ID
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  // Check if physician profile already exists
  const existingPhysician = useQuery(
    api.physicians.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  // Queries for dropdowns
  const organizations = useQuery(api.organizations.listAll);

  // Convex client for imperative query calls
  const convex = useConvex();

  // Mutations
  const upsertUser = useMutation(api.users.upsertFromClerk);
  const createPhysician = useMutation(api.physicians.create);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [registrationKey, setRegistrationKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if physician profile already exists
  useEffect(() => {
    if (existingPhysician) {
      router.replace("/");
    }
  }, [existingPhysician, router]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (clerkLoaded && !clerkUser) {
      router.replace("/sign-in");
    }
  }, [clerkLoaded, clerkUser, router]);

  // Loading state
  if (
    !clerkLoaded ||
    (clerkUser && convexUser === undefined) ||
    existingPhysician
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !specialty ||
      !licenseNumber.trim() ||
      !selectedOrgId ||
      !registrationKey.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      // Verify registration key (query called imperatively)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keyValid = await convex.query(api.organizations.verifyRegistrationKey, {
        organizationId: selectedOrgId as any,
        key: registrationKey,
      });

      if (!keyValid) {
        setError(
          "Invalid registration key. Please check with your hospital administrator."
        );
        setSubmitting(false);
        return;
      }

      // Ensure Convex user exists (handles webhook race condition)
      let userId = convexUser?._id;
      if (!userId && clerkUser) {
        userId = await upsertUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
          role: "physician",
        });
      }

      if (!userId) {
        setError("Unable to create user account. Please try again.");
        setSubmitting(false);
        return;
      }

      // Create physician profile
      await createPhysician({
        userId,
        firstName,
        lastName,
        specialty,
        licenseNumber,
        email: clerkUser?.primaryEmailAddress?.emailAddress ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationId: selectedOrgId as any,
      });

      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0l60 60M60 0L0 60M30 0v60M0 30h60'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          opacity: 0.4,
        }}
      />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity size={24} className="text-blue-600" />
            <span className="text-xl font-bold tracking-tight text-slate-800">
              Pulse
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">
            Physician Onboarding
          </h1>
          <p className="text-slate-500 mt-2">
            Complete your profile to access the physician dashboard.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6"
        >
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                required
                maxLength={100}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                placeholder="Sarah"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                maxLength={100}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                placeholder="Chen"
              />
            </div>
          </div>

          {/* Specialty */}
          <div>
            <label
              htmlFor="specialty"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              <Stethoscope className="inline w-4 h-4 mr-1 -mt-0.5" />
              Specialty <span className="text-rose-500">*</span>
            </label>
            <select
              id="specialty"
              required
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            >
              <option value="">Select your specialty...</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* License Number */}
          <div>
            <label
              htmlFor="licenseNumber"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Medical License Number <span className="text-rose-500">*</span>
            </label>
            <input
              id="licenseNumber"
              type="text"
              required
              maxLength={50}
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              placeholder="e.g. MD-123456"
            />
          </div>

          {/* Hospital / Organization */}
          <div>
            <label
              htmlFor="organization"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              <Building2 className="inline w-4 h-4 mr-1 -mt-0.5" />
              Hospital / Organization <span className="text-rose-500">*</span>
            </label>
            <select
              id="organization"
              required
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setRegistrationKey("");
                setError("");
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            >
              <option value="">Select a hospital...</option>
              {organizations?.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name}
                  {org.address ? ` — ${org.address}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Registration Key */}
          <div>
            <label
              htmlFor="registrationKey"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Hospital Registration Key <span className="text-rose-500">*</span>
            </label>
            <input
              id="registrationKey"
              type="text"
              required
              maxLength={8}
              value={registrationKey}
              onChange={(e) => {
                setRegistrationKey(e.target.value.toUpperCase());
                setError("");
              }}
              disabled={!selectedOrgId}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-mono tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter 8-character key"
            />
            <p className="text-xs text-slate-400 mt-1">
              Contact your hospital administrator for this key.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
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
