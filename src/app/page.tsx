"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? "/dashboard" : "/login");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
