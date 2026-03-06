"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import {
  Loader2,
  Users,
  UserPlus,
  Check,
  X,
  Filter,
  Mail,
  Stethoscope,
  Star,
} from "lucide-react";

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function PatientNetworkPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const physicians = useQuery(
    api.network.browsePhysicians,
    convexUser
      ? {
          patientUserId: convexUser._id,
          ...(cityFilter ? { city: cityFilter } : {}),
          ...(stateFilter ? { state: stateFilter } : {}),
          ...(countryFilter ? { country: countryFilter } : {}),
        }
      : "skip"
  );

  const locationOptions = useQuery(api.network.getLocationFilterOptions, {
    role: "physician",
  });

  const allRequests = useQuery(
    api.connectionRequests.getAllForPatient,
    convexUser ? { patientUserId: convexUser._id } : "skip"
  );

  const pendingInvitations = useQuery(
    api.connectionRequests.getByPatientUserId,
    convexUser ? { patientUserId: convexUser._id } : "skip"
  );

  const sendFromPatient = useMutation(api.connectionRequests.sendFromPatient);
  const respondToRequest = useMutation(api.connectionRequests.respond);

  const connectedCount = allRequests?.filter((r) => r.status === "accepted").length ?? 0;
  const pendingCount = pendingInvitations?.length ?? 0;

  const hasFilters = cityFilter || stateFilter || countryFilter;

  const clearFilters = () => {
    setCityFilter("");
    setStateFilter("");
    setCountryFilter("");
  };

  const handleConnect = async (physicianUserId: string) => {
    if (!convexUser) return;
    setLoadingId(physicianUserId);
    try {
      await sendFromPatient({
        patientUserId: convexUser._id,
        physicianUserId: physicianUserId as any,
      });
    } catch (err) {
      console.error("Failed to send connection request:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRespondToInvitation = async (requestId: string, accept: boolean) => {
    if (!convexUser) return;
    setLoadingId(requestId);
    try {
      await respondToRequest({
        requestId: requestId as any,
        patientUserId: convexUser._id,
        accept,
      });
    } catch (err) {
      console.error("Failed to respond to invitation:", err);
    } finally {
      setLoadingId(null);
    }
  };

  if (
    !clerkLoaded ||
    (clerkUser && (convexUser === undefined || (convexUser && physicians === undefined)))
  ) {
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto text-slate-900">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left sidebar ── */}
        <aside className="w-full lg:w-72 shrink-0 space-y-4">
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
          {/* Pending invitations from physicians */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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

            {pendingInvitations && pendingInvitations.length > 0 && (
              <div className="divide-y divide-slate-100">
                {pendingInvitations.map((inv) => (
                  <div key={inv._id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm shrink-0">
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{inv.physicianName}</p>
                        {inv.specialty && (
                          <p className="text-xs text-slate-500 mt-0.5">{inv.specialty}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRespondToInvitation(inv._id, false)}
                        disabled={loadingId === inv._id}
                        className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
                        title="Decline"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => handleRespondToInvitation(inv._id, true)}
                        disabled={loadingId === inv._id}
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

          {/* Physicians you may want to connect with */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Physicians you may want to connect with</h2>
            </div>

            {!physicians || physicians.filter((p) => !dismissedIds.has(p._id)).length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-slate-500">No physicians found</p>
                <p className="text-sm text-slate-400 mt-1">Try adjusting your location filters</p>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {physicians.filter((p) => !dismissedIds.has(p._id)).map((physician) => (
                  <div
                    key={physician._id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/portal/profile/${physician.userId}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/portal/profile/${physician.userId}`); } }}
                    className="border border-slate-200 rounded-xl hover:shadow-md transition-shadow flex flex-col items-center text-center overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {/* Top background strip with avatar inset */}
                    <div className="w-full h-[5.5rem] relative flex items-end justify-center pb-0">
                      {physician.bannerPhotoUrl ? (
                        <img
                          src={physician.bannerPhotoUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-blue-100" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDismissedIds((prev) => new Set(prev).add(physician._id)); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-colors z-10"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                      {/* Avatar sits at the bottom edge, half inside the strip */}
                      {physician.profilePhotoUrl ? (
                        <img
                          src={physician.profilePhotoUrl}
                          alt={`Dr. ${physician.firstName} ${physician.lastName}`}
                          className="w-16 h-16 rounded-full border-4 border-white object-cover shadow-sm translate-y-1/2 relative z-10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center text-indigo-600 font-bold text-lg shadow-sm translate-y-1/2 relative z-10">
                          {getInitials(physician.firstName, physician.lastName)}
                        </div>
                      )}
                    </div>

                    <div className="px-3 pt-10 pb-4 flex flex-col items-center flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                        Dr. {physician.firstName} {physician.lastName}
                      </h3>
                      {physician.cardBio ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{physician.cardBio}</p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {physician.specialty}
                          {physician.organizationName ? ` at ${physician.organizationName}` : ""}
                        </p>
                      )}
                      {physician.rating && physician.rating > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={12}
                              className={s <= (physician.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                            />
                          ))}
                        </div>
                      )}
                      {(physician.city || physician.state) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {[physician.city, physician.state].filter(Boolean).join(", ")}
                        </p>
                      )}

                      <div className="mt-auto pt-3 w-full">
                        {physician.connectionStatus === "accepted" ? (
                          <div className="flex items-center justify-center gap-1.5 text-green-600 text-xs font-medium py-1.5">
                            <Check size={14} />
                            Connected
                          </div>
                        ) : physician.connectionStatus === "pending" ? (
                          <button
                            disabled
                            className="w-full py-1.5 rounded-full text-xs font-medium border border-slate-200 text-slate-400 cursor-not-allowed"
                          >
                            Pending
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConnect(physician.userId); }}
                            disabled={loadingId === physician.userId}
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
