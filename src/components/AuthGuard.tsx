"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setAuthenticated(true);
      }
      setLoading(false);
    }
    check();

    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
