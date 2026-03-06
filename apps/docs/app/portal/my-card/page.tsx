"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import gsap from "gsap";
import {
  Loader2,
  Camera,
  Save,
  Upload,
  MapPin,
  Pencil,
  X,
} from "lucide-react";

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const VISIBLE_FIELD_OPTIONS = [
  { key: "city", label: "City & State" },
  { key: "conditions", label: "Conditions" },
  { key: "bloodType", label: "Blood Type" },
  { key: "allergies", label: "Allergies" },
];

type Mode = "viewing" | "editing";

const FIELD_CLUSTERS = [
  { id: "photos", edge: "left" as const, yFrac: 0.15 },
  { id: "bio", edge: "right" as const, yFrac: 0.20 },
  { id: "visibility", edge: "left" as const, yFrac: 0.55 },
  { id: "location", edge: "right" as const, yFrac: 0.65 },
] as const;

export default function PatientMyCardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const [mode, setMode] = useState<Mode>("viewing");
  const modeRef = useRef<Mode>("viewing");
  const [isDesktop, setIsDesktop] = useState(true);

  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );
  const patient = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const updatePatient = useMutation(api.patients.update);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [cardBio, setCardBio] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [bannerPhotoUrl, setBannerPhotoUrl] = useState<string | null>(null);
  const [profilePhotoStorageId, setProfilePhotoStorageId] = useState<string | null>(null);
  const [bannerPhotoStorageId, setBannerPhotoStorageId] = useState<string | null>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileBlobRef = useRef<string | null>(null);
  const bannerBlobRef = useRef<string | null>(null);

  // Snapshot for cancel
  const snapshotRef = useRef<{
    cardBio: string; city: string; state: string; country: string;
    visibleFields: string[];
    profilePhotoStorageId: string | null; bannerPhotoStorageId: string | null;
    profilePhotoUrl: string | null; bannerPhotoUrl: string | null;
  } | null>(null);

  // Check desktop
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Seed form state from patient data (skip during editing)
  useEffect(() => {
    if (!patient || mode === "editing") return;
    setCardBio(patient.cardBio ?? "");
    setCity(patient.city ?? "");
    setState(patient.state ?? "");
    setCountry(patient.country ?? "");
    setVisibleFields(patient.cardVisibleFields ?? []);
    setProfilePhotoStorageId(patient.profilePhotoStorageId ?? null);
    setBannerPhotoStorageId(patient.bannerPhotoStorageId ?? null);
  }, [patient, mode]);

  // Resolve existing photo URLs
  const existingProfileUrl = useQuery(
    api.documents.getStorageUrl,
    patient?.profilePhotoStorageId ? { storageId: patient.profilePhotoStorageId } : "skip"
  );
  const existingBannerUrl = useQuery(
    api.documents.getStorageUrl,
    patient?.bannerPhotoStorageId ? { storageId: patient.bannerPhotoStorageId } : "skip"
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (existingProfileUrl && !profilePhotoUrl) setProfilePhotoUrl(existingProfileUrl);
  }, [existingProfileUrl]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (existingBannerUrl && !bannerPhotoUrl) setBannerPhotoUrl(existingBannerUrl);
  }, [existingBannerUrl]);

  // Cleanup blob URLs and kill GSAP timeline on unmount
  useEffect(() => {
    return () => {
      if (profileBlobRef.current) URL.revokeObjectURL(profileBlobRef.current);
      if (bannerBlobRef.current) URL.revokeObjectURL(bannerBlobRef.current);
      timelineRef.current?.kill();
    };
  }, []);

  // Compute SVG line paths from card edge to field clusters
  const computePaths = useCallback(() => {
    if (!containerRef.current || !cardRef.current || !svgRef.current) return;
    const ctr = containerRef.current.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();

    FIELD_CLUSTERS.forEach((cluster) => {
      const path = svgRef.current!.querySelector<SVGPathElement>(`[data-line="${cluster.id}"]`);
      const dot = svgRef.current!.querySelector<SVGCircleElement>(`[data-dot="${cluster.id}"]`);
      const field = fieldRefs.current[cluster.id];
      if (!path || !field) return;

      const fRect = field.getBoundingClientRect();

      // Anchor point on card edge
      const ax = (cluster.edge === "right" ? card.right : card.left) - ctr.left;
      const ay = card.top + card.height * cluster.yFrac - ctr.top;

      // Field connection point
      const fx = (cluster.edge === "right"
        ? fRect.left
        : fRect.right
      ) - ctr.left;
      const fy = fRect.top + fRect.height / 2 - ctr.top;

      const d = `M ${ax} ${ay} L ${fx} ${ay} L ${fx} ${fy}`;
      path.setAttribute("d", d);
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;

      if (dot) {
        dot.setAttribute("cx", `${ax}`);
        dot.setAttribute("cy", `${ay}`);
      }
    });
  }, []);

  // Animate expand
  const animateExpand = useCallback(() => {
    if (timelineRef.current) timelineRef.current.kill();
    requestAnimationFrame(() => {
      if (modeRef.current !== "editing") return;
      const tl = gsap.timeline();
      timelineRef.current = tl;

      // 1. Shrink card, compute paths once card is at final position
      tl.to(cardRef.current, {
        scale: 0.78,
        y: -32,
        duration: 0.4,
        ease: "power2.inOut",
        onComplete: () => computePaths(),
      });

      // 2. Fade in anchor dots
      const dots = svgRef.current?.querySelectorAll("[data-dot]");
      if (dots) {
        tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.05 });
      }

      // 3. Draw SVG paths
      const paths = svgRef.current?.querySelectorAll<SVGPathElement>("[data-line]");
      if (paths) {
        tl.add(() => {
          paths.forEach((p) => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = `${len}`;
            p.style.strokeDashoffset = `${len}`;
          });
        });
        tl.to(paths, { strokeDashoffset: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" });
      }

      // 4. Fade in edit fields
      const fields = FIELD_CLUSTERS.map((c) => fieldRefs.current[c.id]).filter(Boolean);
      tl.fromTo(fields, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.08, ease: "power2.out" }, "-=0.2");
    });
  }, [computePaths]);

  // Animate collapse
  const animateCollapse = useCallback((onComplete?: () => void) => {
    if (timelineRef.current) timelineRef.current.kill();
    const tl = gsap.timeline({ onComplete });
    timelineRef.current = tl;

    const fields = FIELD_CLUSTERS.map((c) => fieldRefs.current[c.id]).filter(Boolean);
    tl.to(fields, { opacity: 0, duration: 0.2, stagger: 0.04 });

    const paths = svgRef.current?.querySelectorAll<SVGPathElement>("[data-line]");
    if (paths) {
      tl.to(paths, { strokeDashoffset: (i: number, el: SVGPathElement) => el.getTotalLength(), duration: 0.3, stagger: 0.04 }, "-=0.1");
    }

    const dots = svgRef.current?.querySelectorAll("[data-dot]");
    if (dots) {
      tl.to(dots, { opacity: 0, duration: 0.15 }, "-=0.15");
    }

    tl.to(cardRef.current, { scale: 1, y: 0, duration: 0.4, ease: "power2.inOut" }, "-=0.2");
  }, []);

  // ResizeObserver while editing
  useEffect(() => {
    if (mode !== "editing" || !isDesktop || !containerRef.current) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(computePaths));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [mode, isDesktop, computePaths]);

  const toggleVisibleField = (key: string) => {
    setVisibleFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleUpdate = () => {
    snapshotRef.current = {
      cardBio, city, state, country, visibleFields: [...visibleFields],
      profilePhotoStorageId, bannerPhotoStorageId, profilePhotoUrl, bannerPhotoUrl,
    };
    modeRef.current = "editing";
    setMode("editing");
    if (isDesktop) {
      setTimeout(animateExpand, 50);
    }
  };

  const handleCancel = () => {
    modeRef.current = "viewing";
    const s = snapshotRef.current;
    if (s) {
      setCardBio(s.cardBio);
      setCity(s.city);
      setState(s.state);
      setCountry(s.country);
      setVisibleFields(s.visibleFields);
      setProfilePhotoStorageId(s.profilePhotoStorageId);
      setBannerPhotoStorageId(s.bannerPhotoStorageId);
      setProfilePhotoUrl(s.profilePhotoUrl);
      setBannerPhotoUrl(s.bannerPhotoUrl);
    }

    if (isDesktop) {
      animateCollapse(() => setMode("viewing"));
    } else {
      setMode("viewing");
    }
  };

  const handleUpload = async (file: File, type: "profile" | "banner") => {
    const setUploading = type === "profile" ? setUploadingProfile : setUploadingBanner;
    setUploading(true);
    try {
      const { uploadUrl } = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error(`Upload failed with status ${result.status}`);
      const { storageId } = await result.json();
      if (!storageId) throw new Error("No storageId returned from upload");
      const blobUrl = URL.createObjectURL(file);
      if (type === "profile") {
        if (profileBlobRef.current) URL.revokeObjectURL(profileBlobRef.current);
        profileBlobRef.current = blobUrl;
        setProfilePhotoStorageId(storageId);
        setProfilePhotoUrl(blobUrl);
      } else {
        if (bannerBlobRef.current) URL.revokeObjectURL(bannerBlobRef.current);
        bannerBlobRef.current = blobUrl;
        setBannerPhotoStorageId(storageId);
        setBannerPhotoUrl(blobUrl);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!patient || saving) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        patientId: patient._id,
        cardBio: cardBio || undefined,
        cardVisibleFields: visibleFields,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
      };
      if (profilePhotoStorageId) updates.profilePhotoStorageId = profilePhotoStorageId;
      if (bannerPhotoStorageId) updates.bannerPhotoStorageId = bannerPhotoStorageId;
      await updatePatient(updates as any);
      modeRef.current = "viewing";

      if (isDesktop) {
        animateCollapse(() => setMode("viewing"));
      } else {
        setMode("viewing");
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!clerkLoaded || convexUser === undefined || (convexUser && patient === undefined)) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">Loading...</span>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-slate-500">Patient profile not found.</div>
    );
  }

  const displayName = `${patient.firstName} ${patient.lastName}`;
  const editing = mode === "editing";

  // ── Mobile fallback ──
  if (!isDesktop) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">My Card</h1>
        <PatientCardPreview
          displayName={displayName}
          cardBio={cardBio}
          city={city}
          state={state}
          visibleFields={visibleFields}
          patient={patient}
          bannerPhotoUrl={bannerPhotoUrl}
          profilePhotoUrl={profilePhotoUrl}
          initials={getInitials(patient.firstName, patient.lastName)}
          uploadingBanner={uploadingBanner}
          uploadingProfile={uploadingProfile}
          onBannerClick={() => editing && bannerInputRef.current?.click()}
          onProfileClick={() => editing && profileInputRef.current?.click()}
        />

        {!editing ? (
          <button
            onClick={handleUpdate}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil size={16} />
            Update
          </button>
        ) : (
          <PatientMobileEditForm
            cardBio={cardBio} setCardBio={setCardBio}
            city={city} setCity={setCity}
            state={state} setState={setState}
            country={country} setCountry={setCountry}
            visibleFields={visibleFields} toggleVisibleField={toggleVisibleField}
            bannerInputRef={bannerInputRef}
            profileInputRef={profileInputRef}
            bannerPhotoStorageId={bannerPhotoStorageId}
            profilePhotoStorageId={profilePhotoStorageId}
            saving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "banner"); e.target.value = ""; }} />
        <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "profile"); e.target.value = ""; }} />
      </div>
    );
  }

  // ── Desktop exploded view ──
  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8">
      {/* SVG overlay */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{ zIndex: 1 }}
      >
        {FIELD_CLUSTERS.map((cluster) => (
          <g key={cluster.id}>
            <path
              data-line={cluster.id}
              fill="none"
              stroke="#6ee7b7"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              strokeLinecap="round"
            />
            <circle
              data-dot={cluster.id}
              r="3"
              fill="#10b981"
              opacity="0"
            />
          </g>
        ))}
      </svg>

      {/* Card (center hero) */}
      <div ref={cardRef} className="relative z-10 w-full max-w-2xl will-change-transform">
        <PatientCardPreview
          displayName={displayName}
          cardBio={cardBio}
          city={city}
          state={state}
          visibleFields={visibleFields}
          patient={patient}
          bannerPhotoUrl={bannerPhotoUrl}
          profilePhotoUrl={profilePhotoUrl}
          initials={getInitials(patient.firstName, patient.lastName)}
          uploadingBanner={uploadingBanner}
          uploadingProfile={uploadingProfile}
          onBannerClick={() => editing && bannerInputRef.current?.click()}
          onProfileClick={() => editing && profileInputRef.current?.click()}
        />
      </div>

      {/* Buttons */}
      <div className="relative z-10 mt-6 flex items-center gap-3">
        {!editing ? (
          <button
            onClick={handleUpdate}
            className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Pencil size={16} />
            Update
          </button>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-3 rounded-xl bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 shadow border border-slate-200"
            >
              <X size={16} />
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Floating edit field clusters */}
      {editing && (
        <>
          {/* Top-left: Photos */}
          <div
            ref={(el) => { fieldRefs.current["photos"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "4%", left: "2%" }}
          >
            <FieldCard title="Photos">
              <div className="flex gap-2">
                <button onClick={() => bannerInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  <Upload size={14} />
                  Banner
                </button>
                <button onClick={() => profileInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  <Upload size={14} />
                  Photo
                </button>
              </div>
            </FieldCard>
          </div>

          {/* Top-right: Bio */}
          <div
            ref={(el) => { fieldRefs.current["bio"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "4%", right: "2%" }}
          >
            <FieldCard title="Bio / Tagline">
              <input
                type="text"
                value={cardBio}
                onChange={(e) => setCardBio(e.target.value)}
                placeholder="Health-conscious individual from NYC"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </FieldCard>
          </div>

          {/* Mid-left: Visible fields checkboxes */}
          <div
            ref={(el) => { fieldRefs.current["visibility"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "38%", left: "2%" }}
          >
            <FieldCard title="Visible Fields">
              <div className="space-y-2">
                {VISIBLE_FIELD_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleFields.includes(opt.key)}
                      onChange={() => toggleVisibleField(opt.key)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </FieldCard>
          </div>

          {/* Mid-right: Location */}
          <div
            ref={(el) => { fieldRefs.current["location"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "50%", right: "2%" }}
          >
            <FieldCard title="Location">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* Hidden file inputs */}
      <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "banner"); e.target.value = ""; }} />
      <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "profile"); e.target.value = ""; }} />
    </div>
  );
}

// ── Subcomponents ──

function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-64 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-md p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  );
}

function PatientCardPreview({
  displayName, cardBio, city, state, visibleFields, patient,
  bannerPhotoUrl, profilePhotoUrl, initials,
  uploadingBanner, uploadingProfile,
  onBannerClick, onProfileClick,
}: {
  displayName: string;
  cardBio: string;
  city: string;
  state: string;
  visibleFields: string[];
  patient: any;
  bannerPhotoUrl: string | null;
  profilePhotoUrl: string | null;
  initials: string;
  uploadingBanner: boolean;
  uploadingProfile: boolean;
  onBannerClick: () => void;
  onProfileClick: () => void;
}) {
  return (
    <div className="w-full border border-slate-200 rounded-2xl overflow-hidden shadow-lg bg-white">
      {/* Banner */}
      <div className="w-full h-48 relative cursor-pointer group overflow-hidden" onClick={onBannerClick}>
        {bannerPhotoUrl ? (
          <img src={bannerPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500" />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={28} />
        </div>
        {uploadingBanner && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Profile Photo */}
      <div className="flex justify-center -mt-14 relative z-10">
        <div className="w-28 h-28 rounded-full border-4 border-white shadow-md cursor-pointer group relative overflow-hidden" onClick={onProfileClick}>
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
          </div>
          {uploadingProfile && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Card Info */}
      <div className="px-8 pt-4 pb-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">{displayName}</h2>
        {cardBio && <p className="text-sm text-slate-500 mt-1">{cardBio}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {visibleFields.includes("city") && (city || state) && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={14} />
              {[city, state].filter(Boolean).join(", ")}
            </div>
          )}
          {visibleFields.includes("conditions") && patient.conditions && patient.conditions.length > 0 && (
            <p className="text-sm text-slate-500">
              {patient.conditions.map((c: any) => c.name).join(", ")}
            </p>
          )}
          {visibleFields.includes("bloodType") && patient.bloodType && (
            <p className="text-sm text-slate-500">Blood Type: {patient.bloodType}</p>
          )}
          {visibleFields.includes("allergies") && patient.allergies && patient.allergies.length > 0 && (
            <p className="text-sm text-slate-500">
              Allergies: {patient.allergies.map((a: any) => a.allergen).join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PatientMobileEditForm({
  cardBio, setCardBio, city, setCity, state, setState, country, setCountry,
  visibleFields, toggleVisibleField,
  bannerInputRef, profileInputRef,
  bannerPhotoStorageId, profilePhotoStorageId,
  saving, onSave, onCancel,
}: {
  cardBio: string; setCardBio: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  visibleFields: string[]; toggleVisibleField: (key: string) => void;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
  bannerPhotoStorageId: string | null;
  profilePhotoStorageId: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Photos</h3>
        <div className="flex gap-3">
          <button onClick={() => bannerInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
            <Upload size={16} />
            {bannerPhotoStorageId ? "Change Banner" : "Upload Banner"}
          </button>
          <button onClick={() => profileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
            <Upload size={16} />
            {profilePhotoStorageId ? "Change Photo" : "Upload Photo"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Card Details</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bio / Tagline</label>
          <input type="text" value={cardBio} onChange={(e) => setCardBio(e.target.value)} placeholder="Health-conscious individual from NYC" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mt-2">Fields to show on card</h3>
          <div className="space-y-2 mt-2">
            {VISIBLE_FIELD_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={visibleFields.includes(opt.key)} onChange={() => toggleVisibleField(opt.key)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Location</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 border border-slate-200"
        >
          <X size={16} />
          Cancel
        </button>
      </div>
    </div>
  );
}
