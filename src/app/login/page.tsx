"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Eye,
  EyeOff
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Tradução de mensagens do Supabase para pt-BR amigável
const traduzirErroSupabase = (msg: string): string => {
  const lower = (msg || "").toLowerCase();
  if (lower.includes("email not confirmed")) {
    return "Por favor, confirme seu e-mail na caixa de entrada para entrar (ou ative o auto-confirm no Supabase).";
  }
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_grant") ||
    lower.includes("invalid credentials")
  ) {
    return "E-mail ou senha incorretos.";
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("unique constraint")
  ) {
    return "Este e-mail já possui cadastro.";
  }
  if (
    lower.includes("password should be at least 6 characters") ||
    lower.includes("at least 6 characters") ||
    lower.includes("password is too short")
  ) {
    return "A senha deve ter no mínimo 6 caracteres.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes antes de tentar novamente.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Erro de conexão com o servidor. Verifique sua internet.";
  }
  return msg || "Ocorreu um erro ao processar sua solicitação.";
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "unauthorized"
      ? "Acesso restrito: Você precisa de permissão de Administrador para acessar o painel Admin."
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Se já houver sessão ativa, redireciona para a rota apropriada
  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.push(redirectTo);
        }
      } catch (err) {
        console.warn("Sessão não detectada:", err);
      }
    }
    checkCurrentSession();
  }, [router, redirectTo]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const emailTrim = email.trim().toLowerCase();

    try {
      if (isSignUp) {
        // REGRA DE ADMIN RESTRITO: Todo cadastro público é estritamente Aluno/Vendedor
        const { data, error } = await supabase.auth.signUp({
          email: emailTrim,
          password,
          options: {
            data: {
              nome: nome.trim() || emailTrim.split("@")[0],
              role: "aluno", // Restrito exclusivamente a aluno
            },
          },
        });

        if (error) {
          setErrorMsg(traduzirErroSupabase(error.message));
        } else if (data.user) {
          // Registrar na tabela de alunos
          try {
            await supabase.from("alunos").upsert({
              id: data.user.id,
              nome: nome.trim() || emailTrim.split("@")[0],
              email: emailTrim,
            });
          } catch (errAluno) {
            console.warn("Aviso ao salvar aluno no banco:", errAluno);
          }

          if (data.session) {
            setSuccessMsg("Conta criada com sucesso! Entrando no sistema...");
            setTimeout(() => {
              router.push(redirectTo);
            }, 800);
          } else {
            setSuccessMsg("Conta criada com sucesso! Por favor, verifique seu e-mail para confirmar seu acesso ou realize o login.");
            setIsSignUp(false);
          }
        }
      } else {
        // Login com E-mail e Senha
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password,
        });

        if (error) {
          setErrorMsg(traduzirErroSupabase(error.message));
        } else if (data.session) {
          setSuccessMsg("Login realizado com sucesso! Redirecionando...");
          const userEmail = (data.user.email || "").toLowerCase();
          const userRole = data.user.user_metadata?.role || data.user.app_metadata?.role || "";

          // Verificação de Admin Oficial
          const isAdmin =
            userEmail === "daniel@goplacas.com.br" ||
            userEmail === "admin@goplacas.com.br" ||
            userRole === "admin";

          const destinoFinal =
            redirectTo && redirectTo !== "/login"
              ? redirectTo
              : isAdmin
              ? "/admin"
              : "/dashboard";

          setTimeout(() => {
            router.push(destinoFinal);
          }, 600);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro inesperado na autenticação:", err);
      setErrorMsg(traduzirErroSupabase(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl transition-colors animate-in fade-in zoom-in-95 duration-200">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mb-3 shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            GOPLAK • Acesso Seguro
          </span>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
          {isSignUp ? "Criar Minha Conta" : "Entrar no GOPLAK"}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1">
          {isSignUp
            ? "Cadastre-se para gerenciar seus displays e ativações em campo"
            : "Acesse seu dashboard de campo com suas credenciais"}
        </p>
      </div>

      {/* Tabs Entrar / Cadastrar */}
      <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-neutral-950 rounded-2xl mb-5 border border-zinc-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(false);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            !isSignUp
              ? "bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Entrar (Login)
        </button>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(true);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            isSignUp
              ? "bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Novo Cadastro
        </button>
      </div>

      {/* Mensagens de Alerta com Tradução em Português */}
      {errorMsg && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleAuth} className="space-y-3.5">
        {isSignUp && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-zinc-400" /> Nome Completo
            </label>
            <input
              type="text"
              required={isSignUp}
              placeholder="Ex: Daniel Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
              autoFocus
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-zinc-400" /> E-mail
          </label>
          <input
            type="email"
            required
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-zinc-400" /> Senha
          </label>
          <div className="relative">
            <input
              type={mostrarSenha ? "text" : "password"}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition font-mono"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition p-1 cursor-pointer"
              title={mostrarSenha ? "Ocultar senha" : "Ver senha"}
              aria-label={mostrarSenha ? "Ocultar senha" : "Ver senha"}
            >
              {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span>{isSignUp ? "Concluir Cadastro" : "Acessar Plataforma"}</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<div className="text-xs text-zinc-400 animate-pulse">Carregando tela de acesso...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
