import Link from "next/link";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import {
  MessageSquare,
  FileText,
  Shield,
  Users,
  Clock,
  HeartPulse,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Pulse</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Healthcare Communication,{" "}
            <span className="text-primary">Reimagined</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Pulse is a HIPAA-compliant platform connecting patients with physicians
            through AI-assisted triage, secure messaging, and seamless document
            management.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg">Start as Patient</Button>
            </Link>
            <Link href="/sign-up?role=physician">
              <Button variant="outline" size="lg">
                Physician Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Why Choose Pulse?</h2>
          <p className="mt-4 text-muted-foreground">
            Built with healthcare professionals and patients in mind
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">AI-Assisted Triage</CardTitle>
              <CardDescription>
                Our intelligent assistant helps patients describe symptoms and
                automatically escalates urgent cases to physicians.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">HIPAA Compliant</CardTitle>
              <CardDescription>
                End-to-end encryption, audit logging, and role-based access
                control ensure your data is always protected.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Document Management</CardTitle>
              <CardDescription>
                Securely upload, organize, and share medical documents including
                lab results, prescriptions, and imaging.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Care Coordination</CardTitle>
              <CardDescription>
                Seamless communication between patients and their care team with
                real-time messaging and notifications.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">24/7 Availability</CardTitle>
              <CardDescription>
                Access your health information and AI assistant anytime. Urgent
                escalations reach physicians immediately.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <HeartPulse className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Patient-Centered</CardTitle>
              <CardDescription>
                Designed to empower patients while giving physicians the tools
                they need to provide excellent care.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to Transform Your Care?</h2>
          <p className="mt-4 text-muted-foreground">
            Join thousands of patients and physicians using Pulse for better
            healthcare communication.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg">Create Free Account</Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-6 w-6 text-primary" />
              <span className="font-semibold">Pulse</span>
            </div>
            <p className="text-sm text-muted-foreground">
              HIPAA-compliant medical communication platform
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
