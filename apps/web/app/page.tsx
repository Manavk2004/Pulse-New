"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Loader2 } from "lucide-react";

// DEV: hardcoded physician Clerk ID — bypasses Clerk auth (development only)
const DEV_CLERK_ID = process.env.NODE_ENV === "development"
  ? "user_38r6neCjAIGzEOdJF5l4P9Ay6cj"
  : null;

export default function RootPage() {
  const router = useRouter();

  const convexUser = useQuery(
    api.users.getByClerkId,
    DEV_CLERK_ID ? { clerkId: DEV_CLERK_ID } : "skip"
  );

  useEffect(() => {
    if (!DEV_CLERK_ID) {
      // Production: no dev bypass available, show error
      console.error("No authentication configured");
      return;
    }
    if (convexUser) {
      router.replace(`/${convexUser._id}`);
    } else if (convexUser === null) {
      console.error("User not found for DEV_CLERK_ID");
    }
  }, [convexUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23cbd5e1' stroke-width='0.5'%3E%3Cpath d='M0 0l60 60M60 0L0 60M30 0v60M0 30h60'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          opacity: 0.4,
        }}
      />
      <div className="relative z-10 bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex items-center gap-4">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-700">Loading...</span>
      </div>
    </div>
  );
}
