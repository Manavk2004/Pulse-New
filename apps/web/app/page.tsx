"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkLoaded && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  useEffect(() => {
    if (clerkLoaded && !clerkUser) {
      router.replace("/sign-in");
      return;
    }
    if (convexUser) {
      router.replace(`/${convexUser._id}`);
    }
    if (clerkLoaded && clerkUser && convexUser === null) {
      router.replace("/onboarding");
    }
  }, [clerkLoaded, clerkUser, convexUser, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );
}
