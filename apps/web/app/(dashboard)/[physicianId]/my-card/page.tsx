"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import gsap from "gsap";
import {
  Loader2,
  Camera,
  Star,
  Save,
  Upload,
  MapPin,
  GraduationCap,
  Clock,
  Phone,
  Pencil,
  X,
} from "lucide-react";

const DEV_CLERK_ID =
  process.env.NODE_ENV === "development"
    ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
    : null;

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

type Mode = "viewing" | "editing";

// Field clusters with anchor positions on card edge (yFrac = fraction of card height)
const FIELD_CLUSTERS = [
  { id: "photos", edge: "left" as const, yFrac: 0.15 },
  { id: "bio", edge: "right" as const, yFrac: 0.20 },
  { id: "rating", edge: "left" as const, yFrac: 0.50 },
  { id: "experience", edge: "right" as const, yFrac: 0.50 },
  { id: "phone", edge: "right" as const, yFrac: 0.80 },
  { id: "location", edge: "left" as const, yFrac: 0.80 },
] as const;

export default function PhysicianMyCardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const [mode, setMode] = useState<Mode>("viewing");
  const modeRef = useRef<Mode>("viewing");
  const [isDesktop, setIsDesktop] = useState(true);

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );
  const physician = useQuery(
    api.physicians.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  const updatePhysician = useMutation(api.physicians.update);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [cardBio, setCardBio] = useState("");
  const [rating, setRating] = useState(0);
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [education, setEducation] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
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
    cardBio: string; rating: number; yearsOfExperience: string; education: string;
    city: string; state: string; country: string; phone: string;
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

  // Seed form state from physician data (skip during editing to prevent overwrite)
  useEffect(() => {
    if (!physician || mode === "editing") return;
    setCardBio(physician.cardBio ?? "");
    setRating(physician.rating ?? 0);
    setYearsOfExperience(physician.yearsOfExperience?.toString() ?? "");
    setEducation(physician.education ?? "");
    setCity(physician.city ?? "");
    setState(physician.state ?? "");
    setCountry(physician.country ?? "");
    setPhone(physician.phone ?? "");
    setProfilePhotoStorageId(physician.profilePhotoStorageId ?? null);
    setBannerPhotoStorageId(physician.bannerPhotoStorageId ?? null);
  }, [physician, mode]);

  // Resolve existing photo URLs
  const existingProfileUrl = useQuery(
    api.documents.getStorageUrl,
    physician?.profilePhotoStorageId ? { storageId: physician.profilePhotoStorageId } : "skip"
  );
  const existingBannerUrl = useQuery(
    api.documents.getStorageUrl,
    physician?.bannerPhotoStorageId ? { storageId: physician.bannerPhotoStorageId } : "skip"
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

      // Field connection point (center of the edge facing the card)
      const fx = (cluster.edge === "right"
        ? fRect.left    // left edge of right-side field
        : fRect.right   // right edge of left-side field
      ) - ctr.left;
      const fy = fRect.top + fRect.height / 2 - ctr.top;

      // L-shaped path: horizontal from card edge, then vertical to field
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

      // 1. Shrink card, then compute paths once card is at final position
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
        tl.fromTo(
          dots,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, stagger: 0.05 },
        );
      }

      // 3. Draw SVG paths (dashoffset set in computePaths via strokeDasharray)
      const paths = svgRef.current?.querySelectorAll<SVGPathElement>("[data-line]");
      if (paths) {
        // Set initial hidden state — computePaths sets dasharray, we set offset to match
        tl.add(() => {
          paths.forEach((p) => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = `${len}`;
            p.style.strokeDashoffset = `${len}`;
          });
        });
        tl.to(
          paths,
          { strokeDashoffset: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" },
        );
      }

      // 4. Fade in edit fields
      const fields = FIELD_CLUSTERS.map((c) => fieldRefs.current[c.id]).filter(Boolean);
      tl.fromTo(
        fields,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.08, ease: "power2.out" },
        "-=0.2"
      );
    });
  }, [computePaths]);

  // Animate collapse
  const animateCollapse = useCallback((onComplete?: () => void) => {
    if (timelineRef.current) timelineRef.current.kill();
    const tl = gsap.timeline({ onComplete });
    timelineRef.current = tl;

    // 1. Fade out fields
    const fields = FIELD_CLUSTERS.map((c) => fieldRefs.current[c.id]).filter(Boolean);
    tl.to(fields, { opacity: 0, duration: 0.2, stagger: 0.04 });

    // 2. Retract SVG paths
    const paths = svgRef.current?.querySelectorAll<SVGPathElement>("[data-line]");
    if (paths) {
      tl.to(
        paths,
        {
          strokeDashoffset: (i: number, el: SVGPathElement) => el.getTotalLength(),
          duration: 0.3,
          stagger: 0.04,
        },
        "-=0.1"
      );
    }

    // 3. Fade out dots
    const dots = svgRef.current?.querySelectorAll("[data-dot]");
    if (dots) {
      tl.to(dots, { opacity: 0, duration: 0.15 }, "-=0.15");
    }

    // 4. Card back to normal
    tl.to(cardRef.current, { scale: 1, y: 0, duration: 0.4, ease: "power2.inOut" }, "-=0.2");
  }, []);

  // ResizeObserver to recompute paths while editing
  useEffect(() => {
    if (mode !== "editing" || !isDesktop || !containerRef.current) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(computePaths));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [mode, isDesktop, computePaths]);

  const handleUpdate = () => {
    snapshotRef.current = {
      cardBio, rating, yearsOfExperience, education, city, state, country, phone,
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
      setRating(s.rating);
      setYearsOfExperience(s.yearsOfExperience);
      setEducation(s.education);
      setCity(s.city);
      setState(s.state);
      setCountry(s.country);
      setPhone(s.phone);
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
    if (!physician || saving) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        physicianId: physician._id,
        cardBio: cardBio || undefined,
        education: education || undefined,
        phone: phone || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
      };
      if (rating > 0) updates.rating = rating;
      const parsedYears = Number(yearsOfExperience);
      if (yearsOfExperience && !isNaN(parsedYears)) updates.yearsOfExperience = parsedYears;
      if (profilePhotoStorageId) updates.profilePhotoStorageId = profilePhotoStorageId;
      if (bannerPhotoStorageId) updates.bannerPhotoStorageId = bannerPhotoStorageId;
      await updatePhysician(updates as any);
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

  if (convexUser === undefined || physician === undefined) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading...</span>
        </div>
      </div>
    );
  }

  if (!physician) {
    return (
      <div className="p-8 text-center text-slate-500">Physician profile not found.</div>
    );
  }

  const displayName = `Dr. ${physician.firstName} ${physician.lastName}`;
  const editing = mode === "editing";

  // ── Mobile fallback layout ──
  if (!isDesktop) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">My Card</h1>
        {/* Card preview */}
        <CardPreview
          displayName={displayName}
          cardBio={cardBio}
          specialty={physician.specialty}
          rating={rating}
          city={city}
          state={state}
          education={education}
          yearsOfExperience={yearsOfExperience}
          phone={phone}
          bannerPhotoUrl={bannerPhotoUrl}
          profilePhotoUrl={profilePhotoUrl}
          initials={getInitials(physician.firstName, physician.lastName)}
          uploadingBanner={uploadingBanner}
          uploadingProfile={uploadingProfile}
          onBannerClick={() => editing && bannerInputRef.current?.click()}
          onProfileClick={() => editing && profileInputRef.current?.click()}
        />

        {!editing ? (
          <button
            onClick={handleUpdate}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil size={16} />
            Update
          </button>
        ) : (
          <MobileEditForm
            cardBio={cardBio} setCardBio={setCardBio}
            rating={rating} setRating={setRating}
            yearsOfExperience={yearsOfExperience} setYearsOfExperience={setYearsOfExperience}
            education={education} setEducation={setEducation}
            city={city} setCity={setCity}
            state={state} setState={setState}
            country={country} setCountry={setCountry}
            phone={phone} setPhone={setPhone}
            bannerInputRef={bannerInputRef}
            profileInputRef={profileInputRef}
            bannerPhotoStorageId={bannerPhotoStorageId}
            profilePhotoStorageId={profilePhotoStorageId}
            saving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        {/* Hidden file inputs */}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "banner"); e.target.value = ""; }} />
        <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "profile"); e.target.value = ""; }} />
      </div>
    );
  }

  // ── Desktop exploded view layout ──
  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8">
      {/* SVG overlay for connection lines */}
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
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeOpacity="0.6"
              strokeLinecap="round"
            />
            <circle
              data-dot={cluster.id}
              r="3"
              fill="#3b82f6"
              opacity="0"
            />
          </g>
        ))}
      </svg>

      {/* Card (center hero) */}
      <div ref={cardRef} className="relative z-10 w-full max-w-2xl will-change-transform">
        <CardPreview
          displayName={displayName}
          cardBio={cardBio}
          specialty={physician.specialty}
          rating={rating}
          city={city}
          state={state}
          education={education}
          yearsOfExperience={yearsOfExperience}
          phone={phone}
          bannerPhotoUrl={bannerPhotoUrl}
          profilePhotoUrl={profilePhotoUrl}
          initials={getInitials(physician.firstName, physician.lastName)}
          uploadingBanner={uploadingBanner}
          uploadingProfile={uploadingProfile}
          onBannerClick={() => editing && bannerInputRef.current?.click()}
          onProfileClick={() => editing && profileInputRef.current?.click()}
        />
      </div>

      {/* Update / Save / Cancel buttons */}
      <div className="relative z-10 mt-6 flex items-center gap-3">
        {!editing ? (
          <button
            onClick={handleUpdate}
            className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Pencil size={16} />
            Update
          </button>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
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
                <button onClick={() => bannerInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  <Upload size={14} />
                  {bannerPhotoStorageId ? "Change Banner" : "Upload Banner"}
                </button>
                <button onClick={() => profileInputRef.current?.click()} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  <Upload size={14} />
                  {profilePhotoStorageId ? "Change Photo" : "Upload Photo"}
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
                placeholder="Dermatology @ Goodman Dermatology"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FieldCard>
          </div>

          {/* Mid-left: Rating */}
          <div
            ref={(el) => { fieldRefs.current["rating"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "38%", left: "2%" }}
          >
            <FieldCard title="Rating">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setRating(s === rating ? 0 : s)} className="p-0.5">
                    <Star size={20} className={`transition-colors ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200 hover:text-amber-300"}`} />
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>

          {/* Mid-right: Experience & Education */}
          <div
            ref={(el) => { fieldRefs.current["experience"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "32%", right: "2%" }}
          >
            <FieldCard title="Experience & Education">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Years of Experience</label>
                  <input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} placeholder="10" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Education</label>
                  <input type="text" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Harvard Medical School" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </FieldCard>
          </div>

          {/* Bottom-right: Phone */}
          <div
            ref={(el) => { fieldRefs.current["phone"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "68%", right: "2%" }}
          >
            <FieldCard title="Phone">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </FieldCard>
          </div>

          {/* Bottom-left: Location */}
          <div
            ref={(el) => { fieldRefs.current["location"] = el; }}
            className="absolute z-20 opacity-0 pointer-events-auto"
            style={{ top: "60%", left: "2%" }}
          >
            <FieldCard title="Location">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* Hidden file inputs (stable outside animated containers) */}
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

function CardPreview({
  displayName, cardBio, specialty, rating, city, state, education, yearsOfExperience, phone,
  bannerPhotoUrl, profilePhotoUrl, initials,
  uploadingBanner, uploadingProfile,
  onBannerClick, onProfileClick,
}: {
  displayName: string;
  cardBio: string;
  specialty?: string;
  rating: number;
  city: string;
  state: string;
  education: string;
  yearsOfExperience: string;
  phone: string;
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
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600" />
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
        {!cardBio && specialty && <p className="text-sm text-slate-500 mt-1">{specialty}</p>}

        {/* Rating Stars */}
        {rating > 0 && (
          <div className="flex items-center justify-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={20} className={s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"} />
            ))}
          </div>
        )}

        {/* Details */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {(city || state) && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={14} />
              {[city, state].filter(Boolean).join(", ")}
            </div>
          )}
          {education && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <GraduationCap size={14} />
              {education}
            </div>
          )}
          {yearsOfExperience && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Clock size={14} />
              {yearsOfExperience} yrs exp
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Phone size={14} />
              {phone}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileEditForm({
  cardBio, setCardBio, rating, setRating, yearsOfExperience, setYearsOfExperience,
  education, setEducation, city, setCity, state, setState, country, setCountry,
  phone, setPhone, bannerInputRef, profileInputRef,
  bannerPhotoStorageId, profilePhotoStorageId,
  saving, onSave, onCancel,
}: {
  cardBio: string; setCardBio: (v: string) => void;
  rating: number; setRating: (v: number) => void;
  yearsOfExperience: string; setYearsOfExperience: (v: string) => void;
  education: string; setEducation: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
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
          <button onClick={() => bannerInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Upload size={16} />
            {bannerPhotoStorageId ? "Change Banner" : "Upload Banner"}
          </button>
          <button onClick={() => profileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Upload size={16} />
            {profilePhotoStorageId ? "Change Photo" : "Upload Photo"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Card Details</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bio / Tagline</label>
          <input type="text" value={cardBio} onChange={(e) => setCardBio(e.target.value)} placeholder="Dermatology @ Goodman Dermatology" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => setRating(s === rating ? 0 : s)} className="p-0.5">
                <Star size={20} className={`transition-colors ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200 hover:text-amber-300"}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Years of Experience</label>
          <input type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} placeholder="10" min="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Education</label>
          <input type="text" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Harvard Medical School" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Location</h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
