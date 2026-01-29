"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import {
  User,
  Shield,
  Bell,
  FileText,
  Phone,
  Mail,
  Check,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Heart,
  Calendar,
  Globe,
  Moon,
  Sun,
  Smartphone,
  Key,
  LogOut,
  Download,
  Trash2,
  CheckCircle2,
  Circle,
  Info,
} from "lucide-react";

const settingsSections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "emergency", label: "Emergency Contact", icon: Phone },
  { id: "privacy", label: "Privacy & Consent", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
];

export default function SettingsPage() {
  const { user } = useUser();
  const clerk = useClerk();
  const [activeSection, setActiveSection] = useState("profile");
  const [consentGranted, setConsentGranted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    escalation: true,
    documents: true,
    reminders: false,
  });
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
  });
  const [emergencyContact, setEmergencyContact] = useState({
    name: "",
    relationship: "",
    phoneNumber: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isSavingEmergency, setIsSavingEmergency] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // TODO: Replace with actual Convex query
        // const settings = await fetchPatientSettings();
        // setConsentGranted(settings.consentStatus === "granted");
        // setNotifications(settings.notifications);
        // setEmergencyContact(settings.emergencyContact || { name: "", relationship: "", phoneNumber: "" });
        setIsLoadingSettings(false);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  // Sync profile data with user when user data loads
  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({
        ...prev,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      }));
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save profile data
      // await saveProfile(profileData);
      console.log("Saving profile:", profileData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmergencyContact = async () => {
    setIsSavingEmergency(true);
    try {
      // TODO: Implement API call to save emergency contact via Convex
      // await updatePatient({ emergencyContact });
      console.log("Saving emergency contact:", emergencyContact);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Failed to save emergency contact:", error);
    } finally {
      setIsSavingEmergency(false);
    }
  };

  const handleConsentChange = async (granted: boolean) => {
    setIsSavingConsent(true);
    try {
      // TODO: Implement API call to update consent via Convex
      // await updatePatientConsent({ consentStatus: granted ? "granted" : "revoked", consentTimestamp: Date.now() });
      console.log("Updating consent:", granted);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConsentGranted(granted);
    } catch (error) {
      console.error("Failed to update consent:", error);
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleNotificationChange = async (key: keyof typeof notifications) => {
    const newValue = !notifications[key];
    // Optimistically update UI
    setNotifications((prev) => ({ ...prev, [key]: newValue }));
    try {
      // TODO: Implement API call to save notification preferences via Convex
      // await updateNotificationPreferences({ [key]: newValue });
      console.log("Updating notification:", key, newValue);
    } catch (error) {
      // Revert on failure
      setNotifications((prev) => ({ ...prev, [key]: !newValue }));
      console.error("Failed to update notification:", error);
    }
  };

  const handleDeleteAccount = async () => {
    // TODO: Implement actual account deletion via Convex/Clerk
    console.log("Account deletion requested");
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account, privacy, and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24 space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {section.label}
                  <ChevronRight
                    className={`ml-auto h-4 w-4 transition-transform ${
                      activeSection === section.id ? "rotate-90" : ""
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                <div className="relative h-24 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20">
                  <div className="absolute -bottom-12 left-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                        {user?.firstName?.[0] || "P"}
                        {user?.lastName?.[0] || ""}
                      </div>
                      <button className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-card border-2 border-background flex items-center justify-center shadow-md hover:bg-muted transition-colors">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-16 pb-6 px-6">
                  <h2 className="text-xl font-semibold">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>

              {/* Profile Form */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <h3 className="text-lg font-semibold mb-6">
                  Personal Information
                </h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          firstName: e.target.value,
                        }))
                      }
                      placeholder="Enter your first name"
                      className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) =>
                        setProfileData((prev) => ({
                          ...prev,
                          lastName: e.target.value,
                        }))
                      }
                      placeholder="Enter your last name"
                      className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        defaultValue={
                          user?.primaryEmailAddress?.emailAddress || ""
                        }
                        disabled
                        className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 pr-10 text-sm text-muted-foreground cursor-not-allowed"
                      />
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Email is managed through your account provider
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) =>
                          setProfileData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="(555) 123-4567"
                        className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Birth</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={profileData.dateOfBirth}
                        onChange={(e) =>
                          setProfileData((prev) => ({
                            ...prev,
                            dateOfBirth: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border/50 flex justify-end">
                  <Button
                    className="rounded-xl"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contact Section */}
          {activeSection === "emergency" && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-xl bg-warning/5 border border-warning/20 p-4">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Important Information
                  </p>
                  <p className="text-muted-foreground">
                    Emergency contact will be notified in case of urgent medical
                    situations. Please ensure this information is accurate and
                    up-to-date.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                    <Heart className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Emergency Contact</h3>
                    <p className="text-sm text-muted-foreground">
                      Primary contact for emergencies
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contact Name</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={emergencyContact.name}
                      onChange={(e) =>
                        setEmergencyContact((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g., Spouse, Parent, Sibling"
                      value={emergencyContact.relationship}
                      onChange={(e) =>
                        setEmergencyContact((prev) => ({
                          ...prev,
                          relationship: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={emergencyContact.phoneNumber}
                      onChange={(e) =>
                        setEmergencyContact((prev) => ({
                          ...prev,
                          phoneNumber: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border/50 flex justify-end">
                  <Button
                    className="rounded-xl"
                    onClick={handleSaveEmergencyContact}
                    disabled={isSavingEmergency}
                  >
                    {isSavingEmergency ? "Saving..." : "Save Emergency Contact"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Consent Section */}
          {activeSection === "privacy" && (
            <div className="space-y-6">
              {/* Consent Status */}
              <div
                className={`rounded-2xl border p-6 ${
                  consentGranted
                    ? "bg-success/5 border-success/20"
                    : "bg-warning/5 border-warning/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      consentGranted ? "bg-success/10" : "bg-warning/10"
                    }`}
                  >
                    {consentGranted ? (
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-warning" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Data Processing Consent</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          consentGranted
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {consentGranted ? "Granted" : "Pending"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      I consent to Pulse processing my health information in
                      accordance with HIPAA regulations for the purpose of
                      providing medical communication services.
                    </p>
                    {consentGranted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConsentChange(false)}
                        disabled={isSavingConsent}
                        className="rounded-xl"
                      >
                        {isSavingConsent ? "Saving..." : "Revoke Consent"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConsentChange(true)}
                        disabled={isSavingConsent}
                        className="rounded-xl"
                      >
                        {isSavingConsent ? "Saving..." : "Grant Consent"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* HIPAA Rights */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Your Rights Under HIPAA</h3>
                    <p className="text-sm text-muted-foreground">
                      Understanding your privacy rights
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      icon: Eye,
                      title: "Access Your Records",
                      desc: "View and obtain copies of your health information",
                    },
                    {
                      icon: FileText,
                      title: "Request Corrections",
                      desc: "Ask for changes to inaccurate information",
                    },
                    {
                      icon: Download,
                      title: "Data Portability",
                      desc: "Receive your data in a portable format",
                    },
                    {
                      icon: Trash2,
                      title: "Revoke Consent",
                      desc: "Withdraw your consent at any time",
                    },
                  ].map((right) => (
                    <div
                      key={right.title}
                      className="flex items-start gap-3 rounded-xl border border-border/50 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        <right.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{right.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {right.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Export */}
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                      <Download className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Export Your Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Download all your health records
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled
                    title="Data export coming soon"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === "notifications" && (
            <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/50">
              {[
                {
                  key: "email",
                  icon: Mail,
                  title: "Email Notifications",
                  desc: "Receive updates about your care via email",
                },
                {
                  key: "escalation",
                  icon: AlertTriangle,
                  title: "Escalation Alerts",
                  desc: "Get notified when your case is escalated to a physician",
                },
                {
                  key: "documents",
                  icon: FileText,
                  title: "Document Updates",
                  desc: "Notify when new documents are available or uploaded",
                },
                {
                  key: "reminders",
                  icon: Calendar,
                  title: "Health Reminders",
                  desc: "Receive reminders for checkups and appointments",
                },
              ].map((setting) => (
                <div
                  key={setting.key}
                  className="flex items-center justify-between p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <setting.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{setting.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {setting.desc}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleNotificationChange(
                        setting.key as keyof typeof notifications
                      )
                    }
                    className={`relative h-7 w-12 rounded-full transition-colors ${
                      notifications[setting.key as keyof typeof notifications]
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        notifications[setting.key as keyof typeof notifications]
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Account Security
                  </p>
                  <p className="text-muted-foreground">
                    Your account is protected with industry-standard security
                    measures. Authentication is managed through Clerk.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/50">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                      <Key className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-sm text-muted-foreground">
                        Managed by Clerk
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => clerk.openUserProfile()}
                  >
                    Change
                  </Button>
                </div>

                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                      <Smartphone className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    Enable
                  </Button>
                </div>

                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Active Sessions</p>
                      <p className="text-sm text-muted-foreground">
                        Manage devices where you're signed in
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    View All
                  </Button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
                <h3 className="font-semibold text-destructive mb-4">
                  Danger Zone
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Delete Account</h2>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Deleting your account will permanently remove:
              </p>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>• All your personal information</li>
                <li>• Your medical documents and records</li>
                <li>• All chat history with the AI assistant</li>
                <li>• Your consent and notification preferences</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                className="flex-1 rounded-xl"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
