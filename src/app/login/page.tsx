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
  EyeOff,
  Clock,
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

          // Checa se o aluno está pendente ou bloqueado
          let statusAluno = session.user.user_metadata?.status || "ativo";
          try {
            const { data: aDb } = await supabase
              .from("alunos")
              .select("status")
              .eq("id", session.user.id)
              .maybeSingle();

            if (aDb && aDb.status) {
              statusAluno = aDb.status;
            }
          } catch (eDb) {
            console.warn("Aviso ao validar status de sessão:", eDb);
          }

          if (statusAluno === "pendente") {
            setInfoMsg("A sua conta está aguardando liberação do administrador. Você receberá a confirmação em breve.");
            return;
          }

          if (statusAluno === "bloqueado") {
            setErrorMsg("Seu acesso está suspenso ou bloqueado pelo administrador. Entre em contato com o suporte.");
            return;
          }

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
        // 1. CHECAGEM NA WHITELIST DE ALUNOS AUTORIZADOS
        try {
          const { data: autorizados, error: errAuthList } = await supabase
            .from("alunos_autorizados")
            .select("id, email");

          // Se a tabela de whitelist estiver ativa e contiver registros:
          if (!errAuthList && autorizados && autorizados.length > 0) {
            const estaAutorizado = autorizados.some(
              (a) => a.email && a.email.trim().toLowerCase() === emailTrim
            );

            if (!estaAutorizado) {
              setErrorMsg(
                "Este e-mail não consta na lista de alunos da Mentoria GOPLAK. Use o mesmo e-mail informado na compra ou entre em contato com o suporte."
              );
              setLoading(false);
              return;
            }
          }
          // Se a tabela estiver vazia (0 autorizados) ou ainda não criada:
          // O cadastro avança, cadastrando o aluno como 'pendente' para moderação manual no Admin.
        } catch (errWhitelist) {
          console.warn("Aviso na checagem da whitelist de alunos:", errWhitelist);
        }

        // 2. Criação do Usuário no Supabase Auth com status 'pendente'
        const { data, error } = await supabase.auth.signUp({
          email: emailTrim,
          password,
          options: {
            data: {
              nome: nome.trim() || emailTrim.split("@")[0],
              role: "aluno",
              status: "pendente",
            },
          },
        });

        if (error) {
          setErrorMsg(traduzirErroSupabase(error.message));
          setLoading(false);
          return;
        }

        if (data.user) {
          const userId = data.user.id;
          const userNome = nome.trim() || emailTrim.split("@")[0];

          // 3. GRAVAÇÃO OBRIGATÓRIA NO BANCO DE DADOS (Tabela de Alunos / Profiles)
          let gravouComSucesso = false;
          let ultimoErroMsg = "";

          // Tentativa 1: Gravar com status na tabela alunos
          const { error: errAlunosStatus } = await supabase.from("alunos").upsert({
            id: userId,
            nome: userNome,
            email: emailTrim,
            status: "pendente",
          });

          if (!errAlunosStatus) {
            gravouComSucesso = true;
          } else {
            console.warn("Falha ao salvar aluno com status (possível ausência da coluna no banco):", errAlunosStatus);
            ultimoErroMsg = errAlunosStatus.message;

            // Tentativa 2: Fallback sem a coluna status (caso a migração SQL ainda não tenha sido rodada)
            const { error: errAlunosCompat } = await supabase.from("alunos").upsert({
              id: userId,
              nome: userNome,
              email: emailTrim,
            });

            if (!errAlunosCompat) {
              gravouComSucesso = true;
            } else {
              ultimoErroMsg = errAlunosCompat.message;
            }
          }

          // Tentativa 3: Também espelhar na tabela profiles se ela existir
          try {
            await supabase.from("profiles").upsert({
              id: userId,
              nome: userNome,
              email: emailTrim,
              status: "pendente",
            });
          } catch (_) {}

          // Se nenhuma tentativa de gravação no banco deu certo, NÃO SILENCIAR!
          if (!gravouComSucesso) {
            console.error("Erro crítico ao gravar aluno no banco:", ultimoErroMsg);
            setErrorMsg(
              `Conta criada na autenticação, mas houve falha ao registrar na lista de alunos (${ultimoErroMsg}). Por favor, contate o suporte.`
            );
            setLoading(false);
            return;
          }

          // Se auto-confirm logou o usuário, desloga imediatamente para que não acesse sem aprovação
          try {
            await supabase.auth.signOut();
          } catch (eSo) {
            console.warn("SignOut pós-cadastro:", eSo);
          }

          // Exibe tela informativa pós-cadastro
          setCadastroPendenteInfo(true);
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
          const userEmail = (data.user.email || "").toLowerCase();
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
            }, 600);
            return;
          }

          // Checar status da conta do aluno
          let statusAluno = data.user.user_metadata?.status || "ativo";
          try {
            const { data: aDb } = await supabase
              .from("alunos")
              .select("status")
              .eq("id", data.user.id)
              .maybeSingle();

            if (aDb && aDb.status) {
              statusAluno = aDb.status;
            }
          } catch (eDb) {
            console.warn("Aviso ao validar status do aluno no login:", eDb);
          }

          if (statusAluno === "pendente") {
            setErrorMsg(
              "A sua conta está aguardando liberação do administrador. Você receberá a confirmação em breve."
            );
            try {
              await supabase.auth.signOut();
            } catch (eSo) {}
            return;
          }

          if (statusAluno === "bloqueado") {
            setErrorMsg(
              "Seu acesso está suspenso ou bloqueado pelo administrador. Entre em contato com o suporte."
            );
            try {
              await supabase.auth.signOut();
            } catch (eSo) {}
            return;
          }

          setSuccessMsg("Login realizado com sucesso! Redirecionando...");
          const destinoFinal =
            redirectTo && redirectTo !== "/login" ? redirectTo : "/dashboard";

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

          <button
            type="button"
            onClick={() => {
              setCadastroPendenteInfo(false);
              setIsSignUp(false);
              setPassword("");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="w-full py-3 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl text-xs hover:opacity-90 transition cursor-pointer shadow-md"
          >
            Voltar para a Tela de Login
          </button>
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
