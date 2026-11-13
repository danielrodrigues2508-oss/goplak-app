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
  User,
  Eye,
  EyeOff,
  Clock,
  RefreshCw,
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

interface AlunoDbResult {
  encontrado: boolean;
  status: "ativo" | "pendente" | "bloqueado" | "nao_encontrado";
  aluno?: any;
}

// Consulta em tempo real e resiliente na tabela public.alunos (com prioridade por e-mail)
async function buscarAlunoNoBanco(userId?: string | null, userEmail?: string | null): Promise<AlunoDbResult> {
  const emailLimpo = (userEmail || "").trim().toLowerCase();
  let aDb: any = null;

  // 1. Busca direta por E-MAIL via REST sem cache (prioridade absoluta para ignorar discrepâncias de ID)
  if (emailLimpo) {
    try {
      const resEmail = await fetch(
        `${SUPABASE_URL}/rest/v1/alunos?email=ilike.${encodeURIComponent(emailLimpo)}&select=*&t=${Date.now()}`,
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
      if (resEmail.ok) {
        const arrE = await resEmail.json();
        if (Array.isArray(arrE) && arrE.length > 0) aDb = arrE[0];
      }
    } catch (_) {}
  }

  // 2. Busca direta por ID se não achou por e-mail
  if (!aDb && userId) {
    try {
      const resDirect = await fetch(
        `${SUPABASE_URL}/rest/v1/alunos?id=eq.${userId}&select=*&t=${Date.now()}`,
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
      if (resDirect.ok) {
        const arr = await resDirect.json();
        if (Array.isArray(arr) && arr.length > 0) aDb = arr[0];
      }
    } catch (_) {}
  }

  // 3. Fallback via SDK do Supabase
  if (!aDb && emailLimpo) {
    try {
      const { data: dSdkEmail } = await supabase
        .from("alunos")
        .select("*")
        .ilike("email", emailLimpo)
        .maybeSingle();
      if (dSdkEmail) aDb = dSdkEmail;
    } catch (_) {}
  }

  if (!aDb && userId) {
    try {
      const { data: dSdkId } = await supabase
        .from("alunos")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (dSdkId) aDb = dSdkId;
    } catch (_) {}
  }

  if (!aDb) {
    return { encontrado: false, status: "nao_encontrado" };
  }

  // Avaliação dos campos gravados pelo Admin ('aprovado' ou 'ativo')
  const whats = (aDb.whatsapp || "").toLowerCase().trim();
  const st = (aDb.status || "").toLowerCase().trim();

  if (
    st === "ativo" ||
    st === "aprovado" ||
    whats.includes("aprovado") ||
    whats.includes("ativo")
  ) {
    return { encontrado: true, status: "ativo", aluno: aDb };
  }

  if (
    st === "bloqueado" ||
    st === "suspenso" ||
    whats.includes("bloqueado") ||
    whats.includes("suspenso")
  ) {
    return { encontrado: true, status: "bloqueado", aluno: aDb };
  }

  return { encontrado: true, status: "pendente", aluno: aDb };
}

// Grava ou atualiza o aluno como pendente na tabela public.alunos garantindo compatibilidade imediata
async function salvarAlunoPendenteNoBanco(userId?: string | null, userEmail?: string | null, userNome?: string | null) {
  const emailLimpo = (userEmail || "").trim().toLowerCase();
  if (!emailLimpo) return false;

  const nomeFinal = (userNome || "").trim() || emailLimpo.split("@")[0] || "Aluno";

  const payload: any = {
    nome: nomeFinal,
    email: emailLimpo,
    whatsapp: "pendente",
  };
  if (userId) {
    payload.id = userId;
  }

  // 1. Grava via REST direto com on_conflict=email (garante inserção e atualização sem violar constraint)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/alunos?on_conflict=email`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      // Se a coluna status existir no banco, tenta atualizar também
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/alunos?email=ilike.${encodeURIComponent(emailLimpo)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "pendente" }),
        });
      } catch (_) {}
      return true;
    }
  } catch (_) {}

  // 2. Fallback via SDK Supabase
  try {
    const { error: errSdk } = await supabase
      .from("alunos")
      .upsert(payload, { onConflict: "email" });
    if (!errSdk) return true;
  } catch (_) {}

  return false;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");

  const messageParam = searchParams.get("message");

  const [isSignUp, setIsSignUp] = useState(false);
  const [cadastroPendenteInfo, setCadastroPendenteInfo] = useState(false);
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
  const [infoMsg, setInfoMsg] = useState<string | null>(messageParam || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Se já houver sessão ativa, valida se a conta está ativa antes de redirecionar
  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userEmail = (session.user.email || "").toLowerCase();
          const userRole = session.user.user_metadata?.role || session.user.app_metadata?.role || "";
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

          // Checa se o aluno está aprovado diretamente no banco de dados
          const dbCheck = await buscarAlunoNoBanco(session.user.id, session.user.email);

          // PRIORIDADE ABSOLUTA: Se o banco public.alunos diz que está ativo/aprovado, LIBERA IMEDIATAMENTE!
          if (dbCheck.status === "ativo") {
            try {
              await supabase.auth.updateUser({ data: { status: "ativo", role: "aluno" } });
            } catch (_) {}
            router.push(redirectTo);
            return;
          }

          // Se não consta no banco (ex: após limpeza de testes), recria como pendente
          if (dbCheck.status === "nao_encontrado" || !dbCheck.encontrado) {
            await salvarAlunoPendenteNoBanco(session.user.id, session.user.email, session.user.user_metadata?.nome);
          }

          if (dbCheck.status === "bloqueado") {
            setErrorMsg("Seu acesso está suspenso ou bloqueado pelo administrador. Entre em contato com o suporte.");
            try { await supabase.auth.signOut(); } catch (_) {}
            return;
          }

          setInfoMsg("A sua conta está aguardando liberação do administrador. Você receberá a confirmação em breve.");
          try { await supabase.auth.signOut(); } catch (_) {}
          return;
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
    const nomeTrim = nome.trim() || emailTrim.split("@")[0] || "Aluno";

    try {
      if (isSignUp) {
        // 1. Chamar supabase.auth.signUp com email em minúsculo e senha
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: emailTrim,
          password,
          options: {
            data: {
              nome: nomeTrim,
              role: "aluno",
              status: "pendente",
            },
          },
        });

        // Se o signUp retornar erro, mostre o erro real na tela para sabermos o motivo
        if (signUpError) {
          console.error("Erro no signUp do Supabase Auth:", signUpError);
          const msgTraduzida = traduzirErroSupabase(signUpError.message);
          setErrorMsg(
            msgTraduzida !== signUpError.message && !msgTraduzida.includes("Ocorreu um erro")
              ? msgTraduzida
              : `Erro no cadastro: ${signUpError.message}`
          );
          setLoading(false);
          return;
        }

        // Garanta que o usuário seja gravado na tabela public.alunos com o mesmo e-mail em minúsculo e status pendente
        if (signUpData?.user) {
          const userId = signUpData.user.id;
          await salvarAlunoPendenteNoBanco(userId, emailTrim, nomeTrim);

          // Se auto-confirm logou o usuário, desloga imediatamente para moderação no Admin
          try {
            await supabase.auth.signOut();
          } catch (eSo) {
            console.warn("SignOut pós-cadastro:", eSo);
          }

          // Exibe tela informativa pós-cadastro
          setCadastroPendenteInfo(true);
        } else {
          setErrorMsg("Conta criada no Auth, mas dados do usuário não retornados. Tente fazer login.");
        }
      } else {
        // Login com E-mail e Senha
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
          const userEmail = (data.user.email || emailTrim).toLowerCase();
          const userRole = data.user.user_metadata?.role || data.user.app_metadata?.role || "";

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

          // 2. Após o signInWithPassword ter sucesso, consulte a tabela public.alunos filtrando por email.trim().toLowerCase()
          const dbCheck = await buscarAlunoNoBanco(data.user.id, userEmail);

          // Se o registro existir na tabela public.alunos com status aprovado/ativo, libere o acesso ao painel do aluno imediatamente
          if (dbCheck.encontrado && dbCheck.status === "ativo") {
            try {
              await supabase.auth.updateUser({ data: { status: "ativo", role: "aluno" } });
            } catch (_) {}

            setSuccessMsg("Login realizado com sucesso! Redirecionando...");
            const destinoFinal =
              redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard";

            setTimeout(() => {
              router.push(destinoFinal);
            }, 400);
            return;
          }

          // Se estiver bloqueado
          if (dbCheck.encontrado && dbCheck.status === "bloqueado") {
            setErrorMsg(
              "Seu acesso está suspenso ou bloqueado pelo administrador. Entre em contato com o suporte."
            );
            try {
              await supabase.auth.signOut();
            } catch (_) {}
            setLoading(false);
            return;
          }

          // Se ainda não constar na tabela public.alunos (ou estiver pendente):
          // Garante que o registro esteja em public.alunos com status pendente para que o Admin possa aprovar
          if (!dbCheck.encontrado) {
            await salvarAlunoPendenteNoBanco(data.user.id, userEmail, data.user.user_metadata?.nome || "");
          }

          setErrorMsg(
            "A sua conta está aguardando liberação do administrador. Você receberá a confirmação em breve."
          );
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          setLoading(false);
          return;
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
      {cadastroPendenteInfo ? (
        <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-sm">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              Cadastro em Análise
            </span>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white mt-2">
              Cadastro recebido com sucesso!
            </h2>
            <p className="text-xs text-zinc-600 dark:text-neutral-300 mt-2 leading-relaxed max-w-sm mx-auto">
              A sua conta está aguardando liberação do administrador. Você receberá a confirmação em breve.
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3.5 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400">
              <span>E-mail informado:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">
                {email.trim().toLowerCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400">
              <span>Status do acesso:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Aguardando Liberação
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                const dbRes = await buscarAlunoNoBanco("", email.trim().toLowerCase());
                setLoading(false);
                if (dbRes.status === "ativo") {
                  setCadastroPendenteInfo(false);
                  setIsSignUp(false);
                  setSuccessMsg("Conta aprovada com sucesso! Digite sua senha para acessar o painel.");
                } else {
                  setErrorMsg("Seu cadastro ainda está em análise pelo administrador. Tente novamente em instantes.");
                }
              }}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold rounded-xl text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Verificando aprovação..." : "Já fui aprovado / Atualizar status"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCadastroPendenteInfo(false);
                setIsSignUp(false);
                setPassword("");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs hover:bg-zinc-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            >
              Voltar para a Tela de Login
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
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
      <Suspense fallback={<div className="text-xs text-zinc-400 animate-pulse">Carregando tela de acesso...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
