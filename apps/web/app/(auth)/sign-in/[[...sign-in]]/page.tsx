"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// DEV: Clerk disabled — redirect straight to dashboard
export default function SignInPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
