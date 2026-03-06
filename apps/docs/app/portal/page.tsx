"use client"
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@repo/convex';
import { Activity, MessageSquare, Heart, Droplets, Thermometer, ChevronRight, Send, Bot, X, PlusCircle, Video, Clock, Loader2, UserPlus, Check, XCircle, Pencil, Pill, AlertCircle, Stethoscope, User, Syringe, ShieldCheck, Phone, Plus, Trash2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const appointments = [{
  id: 1,
  doctor: 'Dr. Sarah Wilson',
  specialty: 'Cardiologist',
  time: 'Tomorrow, 10:30 AM',
  avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop'
}, {
  id: 2,
  doctor: 'Dr. James Miller',
  specialty: 'General Practitioner',
  time: 'Oct 24, 02:15 PM',
  avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop'
}];

const MetricCard = ({
  title,
  value,
  unit,
  icon: Icon,
  color,
  loading
}: any) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"
  >
    <div className={`p-2 rounded-lg w-fit ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div className="mt-4">
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <div className="flex items-baseline gap-1 mt-1">
        {loading && value === "—" ? (
          <div className="flex items-center gap-2">
            <Loader2 size={18} className="animate-spin text-slate-400" />
            <span className="text-sm text-slate-400">Analyzing...</span>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            <span className="text-slate-400 text-sm">{unit}</span>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

export default function PortalPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Check if user has a patient profile
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );
  const patientProfile = useQuery(
    api.patients.getByUserId,
    convexUser ? { userId: convexUser._id } : "skip"
  );

  // Vitals query
  const latestVitals = useQuery(
    api.vitals.getLatestByPatient,
    patientProfile ? { patientId: patientProfile._id } : "skip"
  );

  // Check if documents are being processed
  const isProcessing = useQuery(
    api.documents.isProcessing,
    patientProfile ? { patientId: patientProfile._id } : "skip"
  );

  // Health overview editing
  const updateHealthOverview = useMutation(api.patients.updateHealthOverview);
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState("");
  const [savingOverview, setSavingOverview] = useState(false);

  const handleEditOverview = () => {
    setOverviewDraft(patientProfile?.healthOverview ?? "");
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (!patientProfile) return;
    setSavingOverview(true);
    try {
      await updateHealthOverview({
        patientId: patientProfile._id,
        healthOverview: overviewDraft,
      });
      setEditingOverview(false);
    } catch (error) {
      console.error("Failed to save health overview:", error);
    } finally {
      setSavingOverview(false);
    }
  };

  // Profile fields editing
  const updateProfileFields = useMutation(api.patients.updateProfileFields);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);

  // Draft states for each editable field
  const [medDraft, setMedDraft] = useState<{ name: string; dosage: string }[]>([]);
  const [allergyDraft, setAllergyDraft] = useState<{ allergen: string; type: string }[]>([]);
  const [conditionDraft, setConditionDraft] = useState<{ name: string; status: string }[]>([]);
  const [sexDraft, setSexDraft] = useState("");
  const [bloodTypeDraft, setBloodTypeDraft] = useState("");
  const [procedureDraft, setProcedureDraft] = useState<{ name: string; date: string }[]>([]);
  const [insuranceDraft, setInsuranceDraft] = useState({ planName: "", provider: "", memberId: "" });
  const [emergencyDraft, setEmergencyDraft] = useState({ name: "", relationship: "", phoneNumber: "" });

  const startEditField = (field: string) => {
    if (!patientProfile) return;
    const p = patientProfile as any;
    switch (field) {
      case "medications":
        setMedDraft((p.medications ?? []).map((m: any) => ({ name: m.name, dosage: m.dosage ?? "" })));
        break;
      case "allergies":
        setAllergyDraft((p.allergies ?? []).map((a: any) => ({ allergen: a.allergen, type: a.type ?? "" })));
        break;
      case "conditions":
        setConditionDraft((p.conditions ?? []).map((c: any) => ({ name: c.name, status: c.status ?? "" })));
        break;
      case "demographics":
        setSexDraft(p.sex ?? "");
        setBloodTypeDraft(p.bloodType ?? "");
        break;
      case "procedures":
        setProcedureDraft((p.procedures ?? []).map((pr: any) => ({ name: pr.name, date: pr.date ?? "" })));
        break;
      case "insurance":
        setInsuranceDraft({ planName: p.insurance?.planName ?? "", provider: p.insurance?.provider ?? "", memberId: p.insurance?.memberId ?? "" });
        break;
      case "emergency":
        setEmergencyDraft({ name: p.emergencyContact?.name ?? "", relationship: p.emergencyContact?.relationship ?? "", phoneNumber: p.emergencyContact?.phoneNumber ?? "" });
        break;
    }
    setEditingField(field);
  };

  const saveField = async (field: string) => {
    if (!patientProfile) return;
    setSavingField(true);
    try {
      const args: any = { patientId: patientProfile._id };
      switch (field) {
        case "medications":
          args.medications = medDraft.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), ...(m.dosage.trim() ? { dosage: m.dosage.trim() } : {}) }));
          break;
        case "allergies":
          args.allergies = allergyDraft.filter((a) => a.allergen.trim()).map((a) => ({ allergen: a.allergen.trim(), ...(a.type ? { type: a.type } : {}) } as any));
          break;
        case "conditions":
          args.conditions = conditionDraft.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), ...(c.status ? { status: c.status } : {}) } as any));
          break;
        case "demographics":
          if (sexDraft) args.sex = sexDraft;
          if (bloodTypeDraft) args.bloodType = bloodTypeDraft;
          break;
        case "procedures":
          args.procedures = procedureDraft.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), ...(p.date.trim() ? { date: p.date.trim() } : {}) }));
          break;
        case "insurance":
          args.insurance = {
            ...(insuranceDraft.planName.trim() ? { planName: insuranceDraft.planName.trim() } : {}),
            ...(insuranceDraft.provider.trim() ? { provider: insuranceDraft.provider.trim() } : {}),
            ...(insuranceDraft.memberId.trim() ? { memberId: insuranceDraft.memberId.trim() } : {}),
          };
          break;
        case "emergency":
          if (emergencyDraft.name.trim() && emergencyDraft.relationship.trim() && emergencyDraft.phoneNumber.trim()) {
            args.emergencyContact = { name: emergencyDraft.name.trim(), relationship: emergencyDraft.relationship.trim(), phoneNumber: emergencyDraft.phoneNumber.trim() };
          }
          break;
      }
      await updateProfileFields(args);
      setEditingField(null);
    } catch (error) {
      console.error("Failed to save profile field:", error);
    } finally {
      setSavingField(false);
    }
  };

  // Connection requests
  const pendingRequests = useQuery(
    api.connectionRequests.getByPatientUserId,
    convexUser ? { patientUserId: convexUser._id } : "skip"
  );
  const respondToRequest = useMutation(api.connectionRequests.respond);
  const [respondingAction, setRespondingAction] = useState<{
    id: string;
    action: "accept" | "decline";
  } | null>(null);

  const [respondError, setRespondError] = useState<string | null>(null);

  const handleRespond = async (requestId: (typeof pendingRequests extends (infer T)[] | undefined ? T : never)["_id"], accept: boolean) => {
    if (!convexUser) return;
    setRespondError(null);
    setRespondingAction({ id: requestId, action: accept ? "accept" : "decline" });
    try {
      await respondToRequest({ requestId, patientUserId: convexUser._id, accept });
    } catch (error) {
      console.error("Failed to respond to connection request:", error);
      setRespondError("Failed to respond. Please try again.");
    } finally {
      setRespondingAction(null);
    }
  };

  // Pending physician-uploaded documents
  const pendingDocuments = useQuery(
    api.documents.getPendingByPatientUserId,
    convexUser ? { patientUserId: convexUser._id } : "skip"
  );
  const approveDocument = useMutation(api.documents.approveDocument);
  const rejectDocument = useMutation(api.documents.rejectDocument);
  const [docAction, setDocAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const handleDocAction = async (documentId: string, approve: boolean) => {
    if (!convexUser) return;
    setDocError(null);
    setDocAction({ id: documentId, action: approve ? "approve" : "reject" });
    try {
      if (approve) {
        await approveDocument({ documentId: documentId as any, patientUserId: convexUser._id });
      } else {
        await rejectDocument({ documentId: documentId as any, patientUserId: convexUser._id });
      }
    } catch (error) {
      console.error("Failed to handle document action:", error);
      setDocError("Failed to process document. Please try again.");
    } finally {
      setDocAction(null);
    }
  };

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hello! I am your Health AI Assistant. How can I help you today?'
  }]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const aiReplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect to onboarding if no patient profile or no Convex user record yet
  useEffect(() => {
    if (convexUser && patientProfile === null) {
      router.replace("/onboarding");
    }
    // If Clerk user exists but no Convex user record (webhook hasn't fired), redirect to onboarding
    if (clerkUser && convexUser === null) {
      router.replace("/onboarding");
    }
  }, [clerkUser, convexUser, patientProfile, router]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (aiReplyTimeoutRef.current) {
        clearTimeout(aiReplyTimeoutRef.current);
        aiReplyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMessage = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    aiReplyTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "I've noted that in your health record. Would you like me to schedule a follow-up with Dr. Wilson regarding this?"
      }]);
    }, 1000);
  };

  // Show loading while checking profile
  if (!clerkLoaded || (clerkUser && (convexUser === undefined || (convexUser && patientProfile === undefined)))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* Connection Request Error */}
      {respondError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-600">
          {respondError}
        </div>
      )}

      {/* Pending Connection Requests Banner */}
      <AnimatePresence>
        {pendingRequests && pendingRequests.length > 0 && pendingRequests.map((req) => (
          <motion.div
            key={req._id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <UserPlus size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {req.physicianName} wants to connect with you
                </p>
                {req.specialty && (
                  <p className="text-xs text-slate-500 mt-0.5">{req.specialty}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleRespond(req._id, true)}
                disabled={respondingAction?.id === req._id}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {respondingAction?.id === req._id && respondingAction.action === "accept" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Confirm
              </button>
              <button
                onClick={() => handleRespond(req._id, false)}
                disabled={respondingAction?.id === req._id}
                className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {respondingAction?.id === req._id && respondingAction.action === "decline" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Decline
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Pending Document Review Error */}
      {docError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-600">
          {docError}
        </div>
      )}

      {/* Pending Document Review Banners */}
      <AnimatePresence>
        {pendingDocuments && pendingDocuments.length > 0 && pendingDocuments.map((doc) => (
          <motion.div
            key={doc._id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {doc.physicianName} uploaded a document for your review
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {doc.fileName} &bull; {doc.category.replace("_", " ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleDocAction(doc._id, true)}
                disabled={docAction?.id === doc._id}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {docAction?.id === doc._id && docAction.action === "approve" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Approve
              </button>
              <button
                onClick={() => handleDocAction(doc._id, false)}
                disabled={docAction?.id === doc._id}
                className="flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {docAction?.id === doc._id && docAction.action === "reject" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Reject
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Good morning, {patientProfile?.firstName ?? "there"}</h1>
          <p className="text-slate-500 mt-1">Your vitals are extracted automatically from uploaded medical documents.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/portal?tab=records")}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
          >
            <PlusCircle size={18} />
            <span>Upload Document</span>
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100">
            <Video size={18} />
            <span>Join Consultation</span>
          </button>
        </div>
      </section>

      {/* AI Room Navigator */}
      <motion.section
        whileHover={{ scale: 1.01 }}
        className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm overflow-hidden relative cursor-pointer"
        onClick={() => setChatOpen(true)}
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-50/50 -skew-x-12 translate-x-12 z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
            <Bot size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Enter Your Personal Health AI Room</h2>
            <p className="text-slate-500 max-w-lg">Get real-time insights, analyze symptoms, and connect with your medical data through our most advanced neural engine.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">Active Now</span>
          </div>
          <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shrink-0">
            Enter Room <ChevronRight size={18} />
          </button>
        </div>
      </motion.section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Heart Rate" value={latestVitals?.heartRate ?? "—"} unit="bpm" icon={Heart} color="bg-rose-500" loading={isProcessing} />
        <MetricCard title="Blood Pressure" value={latestVitals?.systolicBP != null && latestVitals?.diastolicBP != null ? `${latestVitals.systolicBP}/${latestVitals.diastolicBP}` : "—"} unit="mmHg" icon={Activity} color="bg-blue-500" loading={isProcessing} />
        <MetricCard title="Glucose Level" value={latestVitals?.glucoseLevel ?? "—"} unit="mg/dL" icon={Droplets} color="bg-teal-500" loading={isProcessing} />
        <MetricCard title="Body Temp" value={latestVitals?.bodyTemperature ?? "—"} unit="°F" icon={Thermometer} color="bg-amber-500" loading={isProcessing} />
      </section>

      {/* Medical Profile Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Medical Profile</h3>
            <p className="text-sm text-slate-500">Auto-extracted from your documents. Click edit to make changes.</p>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              Extracting...
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Medications */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-50"><Pill size={16} className="text-violet-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Active Medications</h4>
              </div>
              {editingField !== "medications" && !isProcessing && (
                <button onClick={() => startEditField("medications")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "medications" ? (
              <div className="space-y-2">
                {medDraft.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={m.name} onChange={(e) => { const d = [...medDraft]; d[i] = { name: e.target.value, dosage: d[i]!.dosage }; setMedDraft(d); }} placeholder="Name" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                    <input value={m.dosage} onChange={(e) => { const d = [...medDraft]; d[i] = { name: d[i]!.name, dosage: e.target.value }; setMedDraft(d); }} placeholder="Dosage" className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                    <button onClick={() => setMedDraft(medDraft.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setMedDraft([...medDraft, { name: "", dosage: "" }])} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("medications")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (patientProfile as any)?.medications?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {((patientProfile as any).medications as any[]).map((m, i) => (
                  <span key={i} className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-medium">{m.name}{m.dosage ? ` ${m.dosage}` : ""}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No medications recorded</p>
            )}
          </div>

          {/* Allergies */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50"><AlertCircle size={16} className="text-rose-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Known Allergies</h4>
              </div>
              {editingField !== "allergies" && !isProcessing && (
                <button onClick={() => startEditField("allergies")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "allergies" ? (
              <div className="space-y-2">
                {allergyDraft.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={a.allergen} onChange={(e) => { const d = [...allergyDraft]; d[i] = { allergen: e.target.value, type: d[i]!.type }; setAllergyDraft(d); }} placeholder="Allergen" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                    <select value={a.type} onChange={(e) => { const d = [...allergyDraft]; d[i] = { allergen: d[i]!.allergen, type: e.target.value }; setAllergyDraft(d); }} className="w-36 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">Type...</option>
                      <option value="drug">Drug</option>
                      <option value="food">Food</option>
                      <option value="environmental">Environmental</option>
                      <option value="other">Other</option>
                    </select>
                    <button onClick={() => setAllergyDraft(allergyDraft.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setAllergyDraft([...allergyDraft, { allergen: "", type: "" }])} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("allergies")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (patientProfile as any)?.allergies?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {((patientProfile as any).allergies as any[]).map((a, i) => {
                  const colors: Record<string, string> = { drug: "bg-red-50 text-red-700", food: "bg-amber-50 text-amber-700", environmental: "bg-green-50 text-green-700", other: "bg-slate-50 text-slate-700" };
                  return <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[a.type] ?? "bg-rose-50 text-rose-700"}`}>{a.allergen}{a.type ? ` (${a.type})` : ""}</span>;
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No allergies recorded</p>
            )}
          </div>

          {/* Conditions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50"><Stethoscope size={16} className="text-blue-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Conditions</h4>
              </div>
              {editingField !== "conditions" && !isProcessing && (
                <button onClick={() => startEditField("conditions")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "conditions" ? (
              <div className="space-y-2">
                {conditionDraft.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={c.name} onChange={(e) => { const d = [...conditionDraft]; d[i] = { name: e.target.value, status: d[i]!.status }; setConditionDraft(d); }} placeholder="Condition" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                    <select value={c.status} onChange={(e) => { const d = [...conditionDraft]; d[i] = { name: d[i]!.name, status: e.target.value }; setConditionDraft(d); }} className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                      <option value="">Status...</option>
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="chronic">Chronic</option>
                    </select>
                    <button onClick={() => setConditionDraft(conditionDraft.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setConditionDraft([...conditionDraft, { name: "", status: "" }])} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("conditions")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (patientProfile as any)?.conditions?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {((patientProfile as any).conditions as any[]).map((c, i) => {
                  const statusColors: Record<string, string> = { active: "bg-blue-50 text-blue-700", resolved: "bg-emerald-50 text-emerald-700", chronic: "bg-amber-50 text-amber-700" };
                  return <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[c.status] ?? "bg-slate-100 text-slate-700"}`}>{c.name}{c.status ? ` · ${c.status}` : ""}</span>;
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No conditions recorded</p>
            )}
          </div>

          {/* Demographics */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50"><User size={16} className="text-indigo-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Demographics</h4>
              </div>
              {editingField !== "demographics" && !isProcessing && (
                <button onClick={() => startEditField("demographics")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "demographics" ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Sex</label>
                  <select value={sexDraft} onChange={(e) => setSexDraft(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Blood Type</label>
                  <select value={bloodTypeDraft} onChange={(e) => setBloodTypeDraft(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
                    <option value="">Not specified</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("demographics")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {patientProfile?.dateOfBirth && (
                  <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">DOB:</span> {patientProfile.dateOfBirth}</p>
                )}
                <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Sex:</span> {(patientProfile as any)?.sex ? <span className="capitalize">{(patientProfile as any).sex}</span> : <span className="text-slate-400">—</span>}</p>
                <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Blood Type:</span> {(patientProfile as any)?.bloodType ?? <span className="text-slate-400">—</span>}</p>
              </div>
            )}
          </div>

          {/* Procedures */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-50"><Syringe size={16} className="text-teal-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Recent Procedures</h4>
              </div>
              {editingField !== "procedures" && !isProcessing && (
                <button onClick={() => startEditField("procedures")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "procedures" ? (
              <div className="space-y-2">
                {procedureDraft.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={p.name} onChange={(e) => { const d = [...procedureDraft]; d[i] = { name: e.target.value, date: d[i]!.date }; setProcedureDraft(d); }} placeholder="Procedure" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                    <input type="date" value={p.date} onChange={(e) => { const d = [...procedureDraft]; d[i] = { name: d[i]!.name, date: e.target.value }; setProcedureDraft(d); }} className="w-36 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                    <button onClick={() => setProcedureDraft(procedureDraft.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setProcedureDraft([...procedureDraft, { name: "", date: "" }])} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Add</button>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("procedures")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (patientProfile as any)?.procedures?.length ? (
              <div className="space-y-1.5">
                {((patientProfile as any).procedures as any[]).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700 font-medium">{p.name}</span>
                    {p.date && <span className="text-slate-400 text-xs">{p.date}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No procedures recorded</p>
            )}
          </div>

          {/* Insurance */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50"><ShieldCheck size={16} className="text-emerald-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Insurance</h4>
              </div>
              {editingField !== "insurance" && !isProcessing && (
                <button onClick={() => startEditField("insurance")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "insurance" ? (
              <div className="space-y-2">
                <input value={insuranceDraft.planName} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, planName: e.target.value })} placeholder="Plan Name" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <input value={insuranceDraft.provider} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, provider: e.target.value })} placeholder="Provider" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <input value={insuranceDraft.memberId} onChange={(e) => setInsuranceDraft({ ...insuranceDraft, memberId: e.target.value })} placeholder="Member ID" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("insurance")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : (patientProfile as any)?.insurance ? (
              <div className="space-y-1.5">
                {(patientProfile as any).insurance.planName && <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Plan:</span> {(patientProfile as any).insurance.planName}</p>}
                {(patientProfile as any).insurance.provider && <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Provider:</span> {(patientProfile as any).insurance.provider}</p>}
                {(patientProfile as any).insurance.memberId && <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Member ID:</span> {(patientProfile as any).insurance.memberId}</p>}
                {!(patientProfile as any).insurance.planName && !(patientProfile as any).insurance.provider && !(patientProfile as any).insurance.memberId && <p className="text-xs text-slate-400">No insurance info</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No insurance info</p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-50"><Phone size={16} className="text-red-600" /></div>
                <h4 className="text-sm font-bold text-slate-700">Emergency Contact</h4>
              </div>
              {editingField !== "emergency" && !isProcessing && (
                <button onClick={() => startEditField("emergency")} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              )}
            </div>
            {editingField === "emergency" ? (
              <div className="space-y-2">
                <input value={emergencyDraft.name} onChange={(e) => setEmergencyDraft({ ...emergencyDraft, name: e.target.value })} placeholder="Name" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <input value={emergencyDraft.relationship} onChange={(e) => setEmergencyDraft({ ...emergencyDraft, relationship: e.target.value })} placeholder="Relationship" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <input value={emergencyDraft.phoneNumber} onChange={(e) => setEmergencyDraft({ ...emergencyDraft, phoneNumber: e.target.value })} placeholder="Phone Number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingField(null)} disabled={savingField} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                  <button onClick={() => saveField("emergency")} disabled={savingField} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">{savingField ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                </div>
              </div>
            ) : patientProfile?.emergencyContact ? (
              <div className="space-y-1.5">
                <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Name:</span> {patientProfile.emergencyContact.name}</p>
                <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Relationship:</span> {patientProfile.emergencyContact.relationship}</p>
                <p className="text-sm text-slate-700"><span className="text-slate-400 text-xs">Phone:</span> {patientProfile.emergencyContact.phoneNumber}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No emergency contact</p>
            )}
          </div>
        </div>
        {(patientProfile as any)?.profileFieldsUpdatedAt && (
          <p className="text-xs text-slate-400 mt-2">
            Profile last updated: {new Date((patientProfile as any).profileFieldsUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </section>

      {/* Chart & Appointments Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Your Profile Summary</h3>
              <p className="text-sm text-slate-500">This summary is visible to physicians you connect with</p>
            </div>
            {!editingOverview && patientProfile?.healthOverview && !isProcessing && (
              <button
                onClick={handleEditOverview}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
          </div>
          <div className="min-h-[200px] flex items-start">
            {isProcessing ? (
              <div className="w-full h-[200px] flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <p className="text-sm text-slate-500 font-medium">Analyzing your medical documents...</p>
                <p className="text-xs text-slate-400">Generating your profile summary from uploaded records</p>
              </div>
            ) : editingOverview ? (
              <div className="w-full flex flex-col gap-3">
                <textarea
                  value={overviewDraft}
                  onChange={(e) => setOverviewDraft(e.target.value)}
                  className="w-full min-h-[180px] p-4 text-sm text-slate-700 leading-relaxed border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 resize-y"
                  placeholder="Write a health summary for your profile..."
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingOverview(false)}
                    disabled={savingOverview}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOverview}
                    disabled={savingOverview}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingOverview ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Save
                  </button>
                </div>
              </div>
            ) : patientProfile?.healthOverview ? (
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {patientProfile.healthOverview}
              </p>
            ) : (
              <div className="w-full h-[200px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <Activity size={32} className="text-slate-300" />
                <p className="text-sm">No profile summary yet. Upload medical documents to auto-generate one.</p>
              </div>
            )}
          </div>
          {!editingOverview && patientProfile?.healthOverviewUpdatedAt && (
            <p className="text-xs text-slate-400 mt-4">
              Last updated: {new Date(patientProfile.healthOverviewUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Upcoming Appointments</h3>
            <div className="space-y-4">
              {appointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <img src={apt.avatar} alt={apt.doctor} className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">{apt.doctor}</h4>
                    <p className="text-xs text-slate-500 font-medium">{apt.specialty}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 font-bold bg-blue-50 w-fit px-2 py-0.5 rounded-full uppercase">
                      <Clock size={10} />
                      {apt.time}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 text-slate-500 font-semibold text-sm border-t border-slate-100 hover:text-blue-600 transition-colors">
              View All Appointments
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 opacity-10">
              <Activity size={120} />
            </div>
            <h3 className="text-lg font-bold mb-2">Physician Network</h3>
            <p className="text-slate-400 text-sm mb-6">Instantly connect with over 500+ specialized doctors in our workspace network.</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-slate-700 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="doc" />
                  </div>
                ))}
              </div>
              <span className="text-xs font-medium text-slate-300">+24 Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick AI Floating Chat Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-200 flex items-center justify-center z-50 cursor-pointer"
      >
        {chatOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </motion.button>

      {/* AI Quick Chat Widget */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-28 right-8 w-96 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-100 flex flex-col"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Health AI</h3>
                  <p className="text-xs text-blue-100">Always online for you</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Ask any general question..."
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
