import { SignIn } from "@clerk/nextjs";
import { HeartPulse } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0l60 60M60 0L0 60M30 0v60M0 30h60'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          opacity: 0.4,
        }}
      />
      <div className="relative z-10 mb-8 flex items-center gap-2">
        <HeartPulse className="h-10 w-10 text-primary" />
        <span className="text-2xl font-bold">Pulse</span>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border",
          },
        }}
        fallbackRedirectUrl="/portal"
      />
    </div>
  );
}
