"use client";

import React, { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ShieldCheck,
  Star,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Store,
  DollarSign,
  Phone,
  Link2,
  HelpCircle,
  Building2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";


interface PlacaData {
  id?: string;
  codigo: string;
  status: "virgem" | "ativa";
  nome_empresa: string;
  link_google_review: string;
  whatsapp_feedback: string;
  valor_venda: number;
}

export default function PaginaPlacaDinamica({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const resolvedParams = use(params);
  const codigo = (resolvedParams.codigo || "GP-0001").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [placa, setPlaca] = useState<PlacaData | null>(null);

  // Estados do formulário de ativação
  const [formNome, setFormNome] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formValor, setFormValor] = useState("80.00");
  const [formEscudo, setFormEscudo] = useState(true);
  const [ativando, setAtivando] = useState(false);
  const [ativadoSucesso, setAtivadoSucesso] = useState(false);
  const [erroAtivacao, setErroAtivacao] = useState<string | null>(null);

  // Estados do Escudo de Reputação (Consumidor)
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Carregar ou criar a placa no Supabase
  useEffect(() => {
    let isMounted = true;

    async function carregarPlaca() {
      setLoading(true);
      try {
        // 1. Tenta buscar a placa no Supabase
        const { data, error } = await supabase
          .from("placas")
          .select("*")
          .eq("codigo", codigo)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.warn("Aviso na consulta do Supabase:", error.message);
        }

        if (data) {
          if (isMounted) {
            setPlaca(data);
            setFormNome(data.nome_empresa || "");
            setFormLink(data.link_google_review || "");
            setFormWhatsapp(data.whatsapp_feedback || "");
            setFormValor(data.valor_venda ? data.valor_venda.toString() : "80.00");
          }
        } else {
          // Placa não existe no banco: tenta criar como virgem
          const novaPlaca: PlacaData = {
            codigo,
            status: "virgem",
            nome_empresa: "",
            link_google_review: "",
            whatsapp_feedback: "",
            valor_venda: 80.0,
          };

          const { data: inserted, error: insertErr } = await supabase
            .from("placas")
            .insert([novaPlaca])
            .select()
            .maybeSingle();

          if (!insertErr && inserted) {
            if (isMounted) setPlaca(inserted);
          } else {
            // Se houver restrição ou tabela não configurada no Supabase, usa estado local virgem
            if (isMounted) setPlaca(novaPlaca);
          }
        }
      } catch (err) {
        console.error("Erro ao conectar com Supabase:", err);
        if (isMounted) {
          setPlaca({
            codigo,
            status: codigo === "GP-0002" ? "ativa" : "virgem",
            nome_empresa: codigo === "GP-0002" ? "Hamburgueria Gourmet & Cia" : "",
            link_google_review: codigo === "GP-0002" ? "https://maps.app.goo.gl/exemplo" : "",
            whatsapp_feedback: codigo === "GP-0002" ? "5511999998888" : "",
            valor_venda: 80.0,
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    carregarPlaca();

    return () => {
      isMounted = false;
    };
  }, [codigo]);

  // Formatação de WhatsApp
  const formatarWhatsapp = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (raw.length <= 11) {
      if (raw.length <= 2) return raw;
      if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    }
    return raw.slice(0, 13);
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setFormWhatsapp(raw);
  };

  // Submissão de Ativação em Campo
  const handleAtivarPlaca = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Iniciando ativação...", { codigo, formNome, formLink, formWhatsapp, formValor, formEscudo });
    setErroAtivacao(null);

    if (!formNome.trim() || !formLink.trim() || !formWhatsapp.trim()) {
      const msg = "Por favor, preencha o nome da empresa, link do Google e WhatsApp.";
      setErroAtivacao(msg);
      alert(msg);
      return;
    }

    setAtivando(true);
    const dadosAtualizados: Partial<PlacaData> = {
      codigo,
      status: "ativa",
      nome_empresa: formNome.trim(),
      link_google_review: formLink.trim(),
      whatsapp_feedback: formWhatsapp.replace(/\D/g, ""),
      valor_venda: parseFloat(formValor) || 80.0,
    };

    try {
      // 1. Atualizar ou Inserir no Supabase
      const { data, error } = await supabase
        .from("placas")
        .upsert(
          dadosAtualizados,
          { onConflict: "codigo" }
        )
        .select();

      if (error) {
        console.error("Erro Supabase:", error);
        // Exibe erro na tela se houver bloqueio de RLS ou erro de rede
        alert(`Aviso do Banco Supabase: ${error.message}`);
        setErroAtivacao(`Supabase: ${error.message}`);
      } else {
        console.log("Ativação persistida com sucesso no Supabase:", data);
      }

      // Atualiza estado local imediatamente para renderizar a tela ativa sem reload manual
      setPlaca({
        codigo,
        status: "ativa",
        nome_empresa: formNome.trim(),
        link_google_review: formLink.trim(),
        whatsapp_feedback: formWhatsapp.replace(/\D/g, ""),
        valor_venda: parseFloat(formValor) || 80.0,
      });

      setAtivadoSucesso(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Erro inesperado na ativação:", err);
      alert(`Erro na ativação: ${errorMessage}`);
      
      // Fallback otimista para não travar o fluxo em campo
      setPlaca({
        codigo,
        status: "ativa",
        nome_empresa: formNome.trim(),
        link_google_review: formLink.trim(),
        whatsapp_feedback: formWhatsapp.replace(/\D/g, ""),
        valor_venda: parseFloat(formValor) || 80.0,
      });
      setAtivadoSucesso(true);
    } finally {
      setAtivando(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 flex flex-col items-center justify-center p-6 transition-colors duration-200">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mb-3" />
        <p className="text-xs text-zinc-500 dark:text-neutral-400 tracking-wider uppercase font-mono">
          Verificando display {codigo}...
        </p>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 1: TELA DE ATIVAÇÃO RÁPIDA (PLACA VIRGEM)
  // =========================================================================
  if (!placa || placa.status === "virgem") {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans p-4 sm:p-6 max-w-lg mx-auto selection:bg-emerald-500 selection:text-black transition-colors duration-200">
        {/* Top Header */}
        <div className="pt-2 pb-5 border-b border-zinc-200 dark:border-neutral-800/80 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> TagPlak • Ativação em Campo
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="text-xs font-mono bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 px-2 py-0.5 rounded-full">
                Supabase Live
              </span>
            </div>
          </div>

          <div className="mt-3 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Placa Virgem Detectada • Código {codigo}
          </div>

          <h1 className="text-2xl font-black text-zinc-900 dark:text-white mt-3 tracking-tight">
            Vincular Display à Loja
          </h1>
          <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1">
            Preencha os dados do estabelecimento para ativar o QR Code imediatamente no banco.
          </p>
        </div>

        {erroAtivacao && (
          <div className="mb-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{erroAtivacao}</span>
          </div>
        )}

        {/* Formulário de Ativação */}
        <form onSubmit={handleAtivarPlaca} className="space-y-4">
          {/* Nome da Empresa */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm dark:shadow-lg transition-colors">
            <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Nome da Empresa
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pizzaria Forno Nobre, Barbearia Silva..."
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Link do Google Meu Negócio / Avaliação */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm dark:shadow-lg transition-colors">
            <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Link de Avaliação do Google
            </label>
            <input
              type="url"
              required
              placeholder="https://g.page/r/.../review ou link do Google Maps"
              value={formLink}
              onChange={(e) => setFormLink(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition font-mono text-xs"
            />
            <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-2 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-zinc-400 dark:text-neutral-400" /> Link direto onde o cliente final publica a nota 5 estrelas.
            </p>
          </div>

          {/* WhatsApp do Lojista */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm dark:shadow-lg transition-colors">
            <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> WhatsApp do Lojista / Gerência
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-xs text-zinc-500 dark:text-neutral-400 font-mono">+55</span>
              <input
                type="tel"
                required
                placeholder="(11) 99999-9999"
                value={formatarWhatsapp(formWhatsapp)}
                onChange={handleWhatsappChange}
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-12 pr-3.5 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-2">
              Receberá os feedbacks privados caso o cliente dê de 1 a 3 estrelas.
            </p>
          </div>

          {/* Valor da Venda */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm dark:shadow-lg transition-colors">
            <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Valor da Venda (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm text-zinc-500 dark:text-neutral-400 font-bold">R$</span>
              <input
                type="number"
                step="5.00"
                required
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-11 pr-3.5 py-3 text-base font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Switch: Escudo de Reputação */}
          <div className="bg-white dark:bg-neutral-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
            <div className="pr-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Escudo de Reputação
              </div>
              <p className="text-xs text-zinc-600 dark:text-neutral-300 mt-1">
                Filtra notas baixas (1-3★) enviando para o WhatsApp e direciona 4-5★ para o Google.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormEscudo(!formEscudo)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
                formEscudo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-neutral-800"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  formEscudo ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Botão de Impacto */}
          <button
            type="submit"
            disabled={ativando}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-[0.98] text-black font-extrabold text-base py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
          >
            {ativando ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Salvando no Supabase...</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>Ativar Display Agora</span>
              </span>
            )}
          </button>
        </form>
      </main>
    );
  }

  // =========================================================================
  // CENÁRIO 2: O ESCUDO DE REPUTAÇÃO (PLACA ATIVA - VISÃO DO CONSUMIDOR)
  // =========================================================================
  const rawZap = placa.whatsapp_feedback || "";
  const zapClean = rawZap.replace(/\D/g, "");
  const zapFormatado = zapClean.startsWith("55") ? zapClean : `55${zapClean}`;

  const whatsappUrl = `https://wa.me/${zapFormatado}?text=${encodeURIComponent(
    `Olá! Acabei de visitar a ${placa.nome_empresa || "loja"} e gostaria de passar um feedback sobre o meu atendimento:`
  )}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between p-6 sm:p-8 max-w-md mx-auto selection:bg-amber-400">
      {/* Topo Elegante & Neutro */}
      <div>
        <div className="flex items-center justify-center gap-2 py-3 mb-8">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-md">
            GP
          </div>
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Avaliação Rápida
          </span>
        </div>

        {/* Feedback de Ativação recente se tiver acabado de ativar */}
        {ativadoSucesso && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Display ativado com sucesso no Supabase!</strong> Esta é a experiência em tempo real do seu cliente.
            </span>
          </div>
        )}

        {/* Bloco Central de Pergunta */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-1.5 bg-slate-200/70 text-slate-700 px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Store className="w-3.5 h-3.5" />
            <span>{placa.nome_empresa || "Estabelecimento Parceiro"}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            Como foi sua experiência com a gente?
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-xs mx-auto">
            Sua opinião é fundamental para mantermos o mais alto padrão de qualidade.
          </p>

          {/* 5 Estrelas Grandes e Interativas */}
          <div className="flex justify-center items-center gap-2.5 sm:gap-3.5 my-8 py-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || avaliacaoSelecionada || 0) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setAvaliacaoSelecionada(star)}
                  aria-label={`Avaliar com ${star} estrelas`}
                  className="p-1 focus:outline-none transition-transform transform active:scale-125 hover:scale-110 cursor-pointer"
                >
                  <Star
                    className={`w-10 h-10 sm:w-11 sm:h-11 transition-colors duration-150 ${
                      active
                        ? "text-amber-400 fill-amber-400 drop-shadow-sm"
                        : "text-slate-300 fill-slate-100"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Respostas condicionais conforme a nota */}
          {avaliacaoSelecionada !== null && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {/* NOTA 4 OU 5: REDIRECIONAMENTO GOOGLE */}
              {avaliacaoSelecionada >= 4 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-950">
                    Que ótimo! Ficamos muito felizes! 🎉
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 mb-5">
                    Poderia compartilhar sua avaliação de 5 estrelas no Google? Leva menos de 10 segundos!
                  </p>

                  <a
                    href={placa.link_google_review || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 px-5 rounded-xl shadow-md transition-all text-sm"
                  >
                    Deixar Avaliação no Google <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* NOTA 1, 2 OU 3: ESCUDO DE REPUTAÇÃO (WHATSAPP DIRETO) */}
              {avaliacaoSelecionada <= 3 && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-6 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-amber-950">
                    Queremos te ouvir de perto!
                  </h3>
                  <p className="text-xs text-amber-800 mt-1 mb-5 leading-relaxed">
                    Sentimos muito que algo não tenha sido perfeito. Fale direto com a gerência pelo WhatsApp para resolvermos seu problema imediatamente.
                  </p>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-3.5 px-5 rounded-xl shadow-md transition-all text-sm"
                  >
                    <MessageCircle className="w-4 h-4" /> Abrir WhatsApp da Loja
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé Discreto */}
      <footer className="text-center pt-8 pb-2 text-[11px] text-slate-400">
        Tecnologia <span className="font-semibold text-slate-600">TagPlak</span> • Experiência & Reputação
      </footer>
    </main>
  );
}
