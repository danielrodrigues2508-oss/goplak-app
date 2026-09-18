"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function checkAuthAndRedirect() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session || !session.user) {
          router.replace("/login");
          return;
        }

        const user = session.user;
        const email = (user.email || "").toLowerCase();
        const role = user.user_metadata?.role || user.app_metadata?.role || "";

        const isAdmin =
          email === "daniel.rodrigues2508@gmail.com" ||
          email === "daniel@goplacas.com.br" ||
          email === "distribuidor@goplacas.com.br" ||
          email.includes("admin") ||
          email.includes("daniel@goplacas") ||
          role === "admin";

        if (isAdmin) {
          router.replace("/admin");
        } else {
          router.replace("/dashboard");
        }
      } catch (err) {
        console.warn("Erro ao verificar sessão na rota raiz:", err);
        if (mounted) router.replace("/login");
      }
    }

    checkAuthAndRedirect();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-black">
      <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
            GOPLAK
          </h1>
          <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            <span>Redirecionando para seu ambiente...</span>
          </p>
        </div>
      </div>
    </div>
  );
}
