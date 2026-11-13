"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
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

// Helper: Normaliza o código para o formato GP-XXXX
const normalizarCodigo = (raw: string): string => {
  const limpo = (raw || "").trim().toUpperCase().replace(/\s+/g, "");
  // Se digitou apenas dígitos (ex: "4829" ou "7391")
  if (/^\d{3,5}$/.test(limpo)) {
    return `GP-${limpo}`;
  }
  // Se digitou GP sem hífen (ex: "GP4829")
  if (/^GP\d{3,5}$/.test(limpo)) {
    return `GP-${limpo.slice(2)}`;
  }
  return limpo;
};

// 1. Consulta a tabela public.alunos filtrando pelo email
async function buscarAlunoPorEmail(userEmail?: string | null) {
  const emailLimpo = (userEmail || "").trim().toLowerCase();
  if (!emailLimpo) return null;

  try {
    const { data: dAluno } = await supabase
      .from("alunos")
      .select("*")
      .ilike("email", emailLimpo)
      .maybeSingle();
    if (dAluno) return dAluno;
  } catch (_) {}

  // Fallback REST sem cache
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/alunos?email=ilike.${encodeURIComponent(emailLimpo)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        cache: "no-store",
      }
    );
    if (res.ok) {
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  } catch (_) {}

  return null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");

  // Modo de acesso: "aluno" (com Código de Acesso GP-XXXX) ou "admin" (com Email/Senha)
  const [modoAcesso, setModoAcesso] = useState<"aluno" | "admin">("aluno");

  // Campos do Aluno
  const [codigoAcesso, setCodigoAcesso] = useState("");

  // Campos do Admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Estados de feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "unauthorized"
      ? "Acesso restrito: Você precisa de permissão de Administrador para acessar o painel Admin."
      : null
  );
  const [infoMsg, setInfoMsg] = useState<string | null>(messageParam || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Se já houver sessão ativa, redireciona adequadamente
  useEffect(() => {
    async function checkCurrentSession() {
      // 1. Verifica se já existe sessão de Aluno salva via Código no localStorage
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("goplak_aluno_logado");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.id || parsed.email || parsed.codigo)) {
              router.push(redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard");
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Verifica se há sessão ativa no Supabase Auth
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const userEmail = (session.user.email || "").trim().toLowerCase();
          const userRole =
            session.user.user_metadata?.role || session.user.app_metadata?.role || "";
          const isAdmin =
            userEmail === "daniel@goplacas.com.br" ||
            userEmail === "admin@goplacas.com.br" ||
            userEmail === "distribuidor@goplacas.com.br" ||
            userEmail === "daniel.rodrigues2508@gmail.com" ||
            userRole === "admin";

          if (isAdmin) {
            router.push(redirectTo && redirectTo !== "/login" ? redirectTo : "/admin");
            return;
          }

          // Consulta na tabela public.alunos filtrando por email
          const aluno = await buscarAlunoPorEmail(userEmail);
          const whats = (aluno?.whatsapp || "").toLowerCase().trim();
          const st = (aluno?.status || "").toLowerCase().trim();
          const isAprovado =
            whats.includes("aprovado") ||
            whats.includes("ativo") ||
            st === "ativo" ||
            st === "aprovado";

          if (isAprovado) {
            router.push(redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard");
            return;
          }

          // Se não estiver aprovado, finaliza a sessão
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          return;
        }
      } catch (err) {
        console.warn("Sessão não detectada:", err);
      }
    }
    checkCurrentSession();
  }, [router, redirectTo]);

  // LOGIN MODO ALUNO: Validação pelo Código de Acesso (GP-XXXX)
  const handleLoginCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const codFormatado = normalizarCodigo(codigoAcesso);
    if (!codFormatado || codFormatado === "GP-") {
      setErrorMsg("Informe o código de acesso fornecido pelo suporte ou administrador.");
      return;
    }

    setLoading(true);

    try {
      // 1. Consulta SDK na tabela public.alunos buscando o código na coluna whatsapp
      let aluno: any = null;
      try {
        const { data: dAluno } = await supabase
          .from("alunos")
          .select("*")
          .ilike("whatsapp", `%${codFormatado}%`)
          .maybeSingle();
        if (dAluno) aluno = dAluno;
      } catch (_) {}

      // 2. Fallback REST sem cache garantindo leitura direta
      if (!aluno) {
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/alunos?whatsapp=ilike.*${encodeURIComponent(codFormatado)}*&select=*`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
              },
              cache: "no-store",
            }
          );
          if (res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > 0) aluno = arr[0];
          }
        } catch (_) {}
      }

      // Validação do Aluno
      if (!aluno) {
        setErrorMsg("Código inválido ou acesso suspenso. Fale com o suporte.");
        setLoading(false);
        return;
      }

      const whats = (aluno.whatsapp || "").toLowerCase().trim();
      const statusBanco = (aluno.status || "").toLowerCase().trim();

      // Verifica se está suspenso ou bloqueado
      if (whats.includes("bloqueado") || whats.includes("suspenso") || statusBanco === "bloqueado") {
        setErrorMsg("Código inválido ou acesso suspenso. Fale com o suporte.");
        setLoading(false);
        return;
      }

      // Verifica se o status contém aprovado ou ativo
      const isAprovado =
        whats.includes("aprovado") ||
        whats.includes("ativo") ||
        statusBanco === "ativo" ||
        statusBanco === "aprovado";

      if (!isAprovado) {
        setErrorMsg("Código inválido ou acesso suspenso. Fale com o suporte.");
        setLoading(false);
        return;
      }

      // Sessão de Aluno liberada com sucesso!
      const sessaoAluno = {
        id: aluno.id,
        nome: aluno.nome || "Aluno Parceiro",
        email: aluno.email || "",
        codigo: codFormatado,
        whatsapp: aluno.whatsapp,
        logadoEm: Date.now(),
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("goplak_aluno_logado", JSON.stringify(sessaoAluno));
      }

      setSuccessMsg(`Bem-vindo(a), ${aluno.nome || "Aluno"}! Acessando seu painel...`);
      const destinoFinal = redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard";
      setTimeout(() => {
        router.push(destinoFinal);
      }, 400);
    } catch (err: unknown) {
      console.error("Erro na validação do código:", err);
      setErrorMsg("Código inválido ou acesso suspenso. Fale com o suporte.");
    } finally {
      setLoading(false);
    }
  };

  // LOGIN MODO ADMIN: E-mail e Senha via Supabase Auth
  const handleAuthAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const emailTrim = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      });

      if (error) {
        setErrorMsg(traduzirErroSupabase(error.message));
        setLoading(false);
        return;
      }

      if (data.session && data.user) {
        const userEmail = (data.user.email || emailTrim).trim().toLowerCase();
        const userRole =
          data.user.user_metadata?.role || data.user.app_metadata?.role || "";

        // Verificação de Administrador Master Oficial
        const isAdmin =
          userEmail === "daniel@goplacas.com.br" ||
          userEmail === "admin@goplacas.com.br" ||
          userEmail === "distribuidor@goplacas.com.br" ||
          userEmail === "daniel.rodrigues2508@gmail.com" ||
          userRole === "admin";

        if (isAdmin) {
          setSuccessMsg("Login de Administrador realizado com sucesso! Redirecionando...");
          const destinoFinal = redirectTo && redirectTo !== "/login" ? redirectTo : "/admin";
          setTimeout(() => {
            router.push(destinoFinal);
          }, 400);
          return;
        }

        // Se for um aluno logando com e-mail e senha
        const aluno = await buscarAlunoPorEmail(userEmail);
        const whats = (aluno?.whatsapp || "").toLowerCase().trim();
        const isAprovado = whats.includes("aprovado") || whats.includes("ativo");

        if (isAprovado) {
          if (aluno && typeof window !== "undefined") {
            const codigoMatch = aluno.whatsapp?.match(/GP-\d{4}/i)?.[0] || "";
            localStorage.setItem(
              "goplak_aluno_logado",
              JSON.stringify({
                id: aluno.id,
                nome: aluno.nome || "Aluno Parceiro",
                email: aluno.email,
                codigo: codigoMatch,
                whatsapp: aluno.whatsapp,
                logadoEm: Date.now(),
              })
            );
          }
          setSuccessMsg("Login realizado com sucesso! Redirecionando...");
          const destinoFinal =
            redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard";
          setTimeout(() => {
            router.push(destinoFinal);
          }, 400);
          return;
        }

        setErrorMsg("A sua conta está aguardando liberação do administrador. Fale com o suporte.");
        try {
          await supabase.auth.signOut();
        } catch (_) {}
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro inesperado na autenticação Admin:", err);
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
          {modoAcesso === "aluno" ? "Entrar no GOPLAK" : "Painel Administrador"}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1">
          {modoAcesso === "aluno"
            ? "Digite seu código pessoal para acessar o painel de campo"
            : "Acesso restrito para administradores da plataforma"}
        </p>
      </div>

      {/* Tabs Seletor de Modo: Sou Aluno (Código) vs Administrador */}
      <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-neutral-950 rounded-2xl mb-5 border border-zinc-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => {
            setModoAcesso("aluno");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            modoAcesso === "aluno"
              ? "bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sou Aluno (Código)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setModoAcesso("admin");
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            modoAcesso === "admin"
              ? "bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Administrador</span>
        </button>
      </div>

      {/* Mensagens de Feedback */}
      {infoMsg && !errorMsg && !successMsg && (
        <div className="mb-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/50 text-sky-800 dark:text-sky-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in">
          <Sparkles className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
          <span>{infoMsg}</span>
        </div>
      )}

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

      {/* MODO 1: SOU ALUNO (ENTRAR COM CÓDIGO GP-XXXX) */}
      {modoAcesso === "aluno" ? (
        <form onSubmit={handleLoginCodigo} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-500" /> Código de Acesso
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-neutral-500 lowercase">
                ex: GP-4829 ou 4829
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                maxLength={10}
                placeholder="Ex: GP-4829"
                value={codigoAcesso}
                onChange={(e) => setCodigoAcesso(e.target.value.toUpperCase())}
                className="w-full bg-zinc-50 dark:bg-neutral-950 border-2 border-zinc-300 dark:border-neutral-800 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-center text-xl sm:text-2xl font-mono font-black tracking-widest text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-600 focus:outline-none transition shadow-inner"
              />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-2 text-center">
              Insira o código de 4 dígitos fornecido pelo administrador da sua conta.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !codigoAcesso.trim()}
            className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando acesso...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span>Entrar no Painel</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>
      ) : (
        /* MODO 2: ADMINISTRADOR (EMAIL E SENHA) */
        <form onSubmit={handleAuthAdmin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-zinc-400" /> E-mail de Administrador
            </label>
            <input
              type="email"
              required
              placeholder="admin@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
              autoFocus
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
                <span>Autenticando...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span>Acessar Painel Admin</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="text-xs text-zinc-400 animate-pulse">Carregando tela de acesso...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
