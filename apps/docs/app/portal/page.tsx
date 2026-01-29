import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import {
  Sparkles,
  FileText,
  Calendar,
  ArrowRight,
  Activity,
  Shield,
  Clock,
  TrendingUp,
  Heart,
  Stethoscope,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Greeting } from "./components/greeting";

export default async function PortalPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    redirect("/sign-in");
  }

  const firstName = user?.firstName || "there";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl gradient-primary p-8 text-white">
        <div className="relative z-10">
          <Greeting firstName={firstName} />
          <p className="text-white/80 max-w-md">
            Your health dashboard is ready. Check your latest updates or start a conversation with our AI assistant.
          </p>
          <div className="flex gap-3 mt-6">
            <Link href="/portal/chat">
              <Button className="bg-white text-primary hover:bg-white/90 rounded-xl shadow-lg">
                <Sparkles className="mr-2 h-4 w-4" />
                Talk to AI Assistant
              </Button>
            </Link>
            <Link href="/portal/documents">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-xl">
                View Documents
              </Button>
            </Link>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 right-24 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        <Heart className="absolute top-6 right-6 h-24 w-24 text-white/10" />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active Conversations",
            value: "1",
            change: "AI available 24/7",
            icon: Sparkles,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Documents",
            value: "0",
            change: "Upload your first",
            icon: FileText,
            color: "text-secondary",
            bg: "bg-secondary/10",
          },
          {
            label: "Health Score",
            value: "—",
            change: "Complete profile",
            icon: Activity,
            color: "text-accent",
            bg: "bg-accent/10",
          },
          {
            label: "Next Checkup",
            value: "—",
            change: "Not scheduled",
            icon: Calendar,
            color: "text-warning",
            bg: "bg-warning/10",
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Assistant Card */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">AI Health Assistant</h2>
                  <p className="text-sm text-muted-foreground">Powered by advanced AI</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Online
              </span>
            </div>
          </div>
          <div className="p-6">
            <p className="text-muted-foreground mb-6">
              Get instant answers about your health, understand symptoms, prepare for doctor visits, or ask about your medical documents.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              {[
                { text: "Explain my symptoms", icon: Stethoscope },
                { text: "Understand lab results", icon: FileText },
                { text: "Prepare for my visit", icon: Calendar },
                { text: "Medication questions", icon: Shield },
              ].map((item) => (
                <Link
                  key={item.text}
                  href="/portal/chat"
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm hover:bg-muted/50 hover:border-primary/30 transition-all"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.text}
                </Link>
              ))}
            </div>
            <Link href="/portal/chat">
              <Button className="w-full rounded-xl h-11">
                Start New Conversation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/portal/documents"
                className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <p className="font-medium text-sm">Upload Document</p>
                  <p className="text-xs text-muted-foreground">Add lab results, prescriptions</p>
                </div>
              </Link>
              <Link
                href="/portal/settings"
                className="flex items-center gap-3 rounded-xl border border-border/50 p-4 hover:border-primary/30 hover:bg-muted/50 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Complete Profile</p>
                  <p className="text-xs text-muted-foreground">Add emergency contact</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Health Tips */}
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Health Tip</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Regular check-ups can help detect health issues early. Schedule your annual wellness visit today.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Updated daily
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold">Recent Activity</h2>
          {/* TODO: Implement activity listing route at /portal/activity */}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled
            aria-label="View all activity (coming soon)"
          >
            View all
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Activity className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="font-medium mb-1">No activity yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Start a conversation with the AI assistant or upload your first document to see your activity here.
          </p>
        </div>
      </div>
    </div>
  );
}
