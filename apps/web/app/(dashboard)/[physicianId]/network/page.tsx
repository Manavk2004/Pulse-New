"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import gsap from "gsap";
import {
  Loader2,
  Users,
  UserPlus,
  Check,
  X,
  Filter,
  Mail,
} from "lucide-react";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function PhysicianNetworkPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const patients = useQuery(
    api.network.browsePatients,
    convexUser
      ? {
          physicianUserId: convexUser._id,
          ...(cityFilter ? { city: cityFilter } : {}),
          ...(stateFilter ? { state: stateFilter } : {}),
          ...(countryFilter ? { country: countryFilter } : {}),
        }
      : "skip"
  );

  const locationOptions = useQuery(api.network.getLocationFilterOptions, {
    role: "patient",
  });

  const pendingRequests = useQuery(
    api.connectionRequests.getPendingForPhysician,
    convexUser ? { physicianUserId: convexUser._id } : "skip"
  );

  const allRequests = useQuery(
    api.connectionRequests.getAllForPhysician,
    convexUser ? { physicianUserId: convexUser._id } : "skip"
  );

  const sendRequest = useMutation(api.connectionRequests.send);
  const respondToRequest = useMutation(api.connectionRequests.respondByPhysician);

  const connectedCount = allRequests?.filter((r) => r.status === "accepted").length ?? 0;
  const pendingCount = pendingRequests?.length ?? 0;

  // GSAP entrance animations
  useEffect(() => {
    if (!containerRef.current || !patients) return;
    const sections = containerRef.current.querySelectorAll<HTMLElement>("[data-animate]");
    const tween = gsap.fromTo(
      sections,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );
    return () => {
      tween.kill();
    };
  }, [patients]);

  const hasFilters = cityFilter || stateFilter || countryFilter;

  const clearFilters = () => {
    setCityFilter("");
    setStateFilter("");
    setCountryFilter("");
  };

  const handleConnect = async (patientId: string) => {
    if (!convexUser) return;
    setLoadingId(patientId);
    try {
      await sendRequest({
        physicianUserId: convexUser._id,
        patientId: patientId as any,
      });
    } catch (err) {
      console.error("Failed to send connection request:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    if (!convexUser) return;
    setLoadingId(requestId);
    try {
      await respondToRequest({
        requestId: requestId as any,
        physicianUserId: convexUser._id,
        accept,
      });
    } catch (err) {
      console.error("Failed to respond to request:", err);
    } finally {
      setLoadingId(null);
    }
  };

  if (convexUser === undefined || patients === undefined) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading network...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-6 lg:p-8 max-w-7xl mx-auto text-slate-900">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left sidebar ── */}
        <aside data-animate className="w-full lg:w-72 shrink-0 space-y-4">
          {/* Manage my network card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Manage my network</h2>
            </div>
            <nav className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 text-slate-600">
                  <Users size={18} />
                  <span className="text-sm">Connections</span>
                </div>
                <span className="text-sm font-semibold text-blue-600">{connectedCount}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail size={18} />
                  <span className="text-sm">Invitations</span>
                </div>
                <span className="text-sm font-semibold text-blue-600">{pendingCount}</span>
              </div>
            </nav>
          </div>

          {/* Location filters card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">Location Filters</h3>
              </div>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="Filter by city"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All Cities</option>
                {locationOptions?.cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                aria-label="Filter by state"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All States</option>
                {locationOptions?.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                aria-label="Filter by country"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All Countries</option>
                {locationOptions?.countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Pending invitations */}
          <div data-animate className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="text-sm text-slate-600">
                {pendingCount === 0
                  ? "No pending invitations"
                  : `${pendingCount} pending invitation${pendingCount > 1 ? "s" : ""}`}
              </span>
              {pendingCount > 0 && (
                <span className="text-sm font-medium text-blue-600 cursor-pointer hover:underline">
                  Manage
                </span>
              )}
            </div>

            {pendingRequests && pendingRequests.length > 0 && (
              <div className="divide-y divide-slate-100">
                {pendingRequests.map((req) => (
                  <div key={req._id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm shrink-0">
                        {req.patientName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{req.patientName}</p>
                        {(req.city || req.state) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[req.city, req.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRespondToRequest(req._id, false)}
                        disabled={loadingId === req._id}
                        className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                        title="Decline"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(req._id, true)}
                        disabled={loadingId === req._id}
                        className="w-8 h-8 rounded-full border border-blue-600 bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        title="Accept"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* People you may know */}
          <div data-animate className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Patients you may want to connect with</h2>
            </div>

            {patients.filter((p) => !dismissedIds.has(p._id)).length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-slate-500">No patients found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your location filters</p>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {patients.filter((p) => !dismissedIds.has(p._id)).map((patient) => (
                  <div
                    key={patient._id}
                    className="border border-slate-200 rounded-xl hover:shadow-md transition-shadow flex flex-col items-center text-center overflow-hidden"
                  >
                    {/* Top background strip with avatar inset */}
                    <div className="w-full h-[5.5rem] relative flex items-end justify-center pb-0">
                      {patient.bannerPhotoUrl ? (
                        <img
                          src={patient.bannerPhotoUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100" />
                      )}
                      <button
                        onClick={() => setDismissedIds((prev) => new Set(prev).add(patient._id))}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-colors z-10"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                      {/* Avatar sits at the bottom edge, half inside the strip */}
                      {patient.profilePhotoUrl ? (
                        <img
                          src={patient.profilePhotoUrl}
                          alt={`${patient.firstName} ${patient.lastName}`}
                          className="w-16 h-16 rounded-full border-4 border-white object-cover shadow-sm translate-y-1/2 relative z-10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-200 border-4 border-white flex items-center justify-center text-slate-600 font-bold text-lg shadow-sm translate-y-1/2 relative z-10">
                          {getInitials(patient.firstName, patient.lastName)}
                        </div>
                      )}
                    </div>

                    <div className="px-3 pt-10 pb-4 flex flex-col items-center flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                        {patient.firstName} {patient.lastName}
                      </h3>
                      {patient.cardBio && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{patient.cardBio}</p>
                      )}
                      {(patient.city || patient.state) && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {[patient.city, patient.state].filter(Boolean).join(", ")}
                        </p>
                      )}

                      <div className="mt-auto pt-3 w-full">
                        {patient.connectionStatus === "accepted" ? (
                          <div className="flex items-center justify-center gap-1.5 text-green-600 text-xs font-medium py-1.5">
                            <Check size={14} />
                            Connected
                          </div>
                        ) : patient.connectionStatus === "pending" ? (
                          <button
                            disabled
                            className="w-full py-1.5 rounded-full text-xs font-medium border border-slate-200 text-slate-400 cursor-not-allowed"
                          >
                            Pending
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(patient._id)}
                            disabled={loadingId === patient._id}
                            className="w-full py-1.5 rounded-full text-xs font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <UserPlus size={13} />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
