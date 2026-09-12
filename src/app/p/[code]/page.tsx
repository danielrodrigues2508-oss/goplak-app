import React from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, AlertCircle, QrCode, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export default async function DisplayRedirectPage({ params }: Props) {
  const resolvedParams = await params;
  const rawCode = resolvedParams.code || "";
  const codigo = decodeURIComponent(rawCode).trim().toUpperCase();

  // 1. Consulta no Supabase pelo código da placa
  let placa: {
    id?: string;
    codigo: string;
    status: string;
    nome_empresa?: string;
    link_google_review?: string;
    url_destino?: string;
    acessos?: number;
    scans?: number;
  } | null = null;

  try {
    const { data, error } = await supabase
      .from("placas")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();

    if (!error && data) {
      placa = data;
    }
  } catch (err) {
    console.warn("Erro ao buscar placa no Supabase:", err);
  }

  // 2. Regras de Redirecionamento e Validação
  if (placa) {
    const rawUrl = (placa.url_destino || placa.link_google_review || "").trim();

    // Se estiver ativa e possuir URL de destino válida
    if (placa.status === "ativa" && rawUrl) {
      // Formatação de URL segura
      let destinoFinal = rawUrl;
      if (!destinoFinal.startsWith("http://") && !destinoFinal.startsWith("https://")) {
        destinoFinal = `https://${destinoFinal}`;
      }

      // Opcional: tentar incrementar contagem de acessos/scans se a coluna existir
      try {
        if (typeof placa.acessos === "number") {
          await supabase
            .from("placas")
            .update({ acessos: (placa.acessos || 0) + 1 })
            .eq("id", placa.id);
        } else if (typeof placa.scans === "number") {
          await supabase
            .from("placas")
            .update({ scans: (placa.scans || 0) + 1 })
            .eq("id", placa.id);
        }
      } catch {
        // Silencioso se não houver coluna de métricas
      }

      // Redirecionamento imediato
      redirect(destinoFinal);
    }

    // Se a placa existir, mas o status for 'virgem' ou não tiver URL cadastrada
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 transition-colors selection:bg-emerald-500 selection:text-black">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Badge de Código */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold">
            <QrCode className="w-3.5 h-3.5" />
            <span>{placa.codigo || codigo}</span>
          </div>

          {/* Ícone de Destaque */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>

          {/* Mensagem Principal */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Este display ainda não foi ativado.
            </h1>
            <p className="text-sm text-zinc-600 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
              Fale com seu consultor GoPlacas para configurar e vincular seu estabelecimento.
            </p>
          </div>

          {/* Detalhes do Display */}
          <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 text-xs text-left space-y-2">
            <div className="flex justify-between items-center text-zinc-500 dark:text-neutral-400">
              <span>Status do Display:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider text-[10px]">
                {placa.status === "virgem" ? "Virgem / Aguardando Ativação" : placa.status}
              </span>
            </div>
            {placa.nome_empresa && (
              <div className="flex justify-between items-center text-zinc-500 dark:text-neutral-400">
                <span>Estabelecimento:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{placa.nome_empresa}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-zinc-500 dark:text-neutral-400">
              <span>Tecnologia:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> GoPlacas Smart NFC & QR
              </span>
            </div>
          </div>

          {/* Rodapé / Ação */}
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 transition shadow-sm"
            >
              <span>Conhecer a GoPlacas</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Se a placa não existir no banco
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 transition-colors selection:bg-emerald-500 selection:text-black">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Ícone de Erro */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto shadow-inner">
          <AlertCircle className="w-8 h-8" />
        </div>

        {/* Mensagem de Não Encontrado */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Display GoPlacas não encontrado.
          </h1>
          <p className="text-sm text-zinc-600 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
            O código <span className="font-mono font-bold text-zinc-800 dark:text-neutral-200">"{codigo}"</span> não foi localizado em nossa base de dados.
          </p>
        </div>

        {/* Rodapé / Voltar */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 transition"
          >
            <span>Ir para a Página Inicial</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
