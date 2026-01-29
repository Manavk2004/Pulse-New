import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import {
  Users,
  MessageSquare,
  AlertTriangle,
  FileText,
  Activity,
} from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // This would be fetched from Convex in a real implementation
  const stats = {
    totalPatients: 0,
    activeChats: 0,
    pendingEscalations: 0,
    documentsToReview: 0,
  };

  const recentEscalations: {
    id: string;
    patientName: string;
    severity: "low" | "medium" | "high" | "urgent";
    reason: string;
    time: string;
  }[] = [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-semibold">Pulse Physician Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm">
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, Doctor</h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your patient communications
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Patients
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPatients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeChats}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Escalations
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingEscalations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Documents to Review
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.documentsToReview}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Escalations */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Escalations</CardTitle>
              <CardDescription>
                AI-escalated patient conversations requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentEscalations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending escalations. Great job!
                </p>
              ) : (
                <div className="space-y-4">
                  {recentEscalations.map((escalation) => (
                    <div
                      key={escalation.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{escalation.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {escalation.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            escalation.severity === "urgent"
                              ? "urgent"
                              : escalation.severity === "high"
                                ? "destructive"
                                : escalation.severity === "medium"
                                  ? "warning"
                                  : "secondary"
                          }
                        >
                          {escalation.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {escalation.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link href="/dashboard/patients">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  View All Patients
                </Button>
              </Link>
              <Link href="/dashboard/chats">
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Active Conversations
                </Button>
              </Link>
              <Link href="/dashboard/escalations">
                <Button variant="outline" className="w-full justify-start">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Review Escalations
                </Button>
              </Link>
              <Link href="/dashboard/documents">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Document Library
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
