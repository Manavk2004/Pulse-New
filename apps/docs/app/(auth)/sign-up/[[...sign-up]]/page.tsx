import { SignUp } from "@clerk/nextjs";
import { HeartPulse } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="mb-8 flex items-center gap-2">
        <HeartPulse className="h-10 w-10 text-primary" />
        <span className="text-2xl font-bold">Pulse Patient Portal</span>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border",
          },
        }}
        redirectUrl="/portal"
      />
    </div>
  );
}
