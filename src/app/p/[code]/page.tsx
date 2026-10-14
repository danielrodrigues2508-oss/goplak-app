"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Sparkles,
  AlertCircle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Building2,
  Link2,
  Loader2,
  CheckCircle2,
  Lock,
  UserX,
  ExternalLink,
  User,
  Phone,
  DollarSign,
  PlusCircle,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  params: Promise<{ code: string }>;
}

function formatarTelefone(valor: string) {
  const digits = valor.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function DisplayRedirectPage({ params }: Props) {
  const router = useRouter();
  const resolvedParams = use(params);
  const rawCode = resolvedParams.code || "";
  const codigo = decodeURIComponent(rawCode).trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [placa, setPlaca] = useState<any | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);

  // Estados de sessão e permissão
  const [usuario, setUsuario] = useState<any | null>(null);
  const [placaPertenceAoUsuario, setPlacaPertenceAoUsuario] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Formulário completo de ativação do lojista
  const [nomeComercio, setNomeComercio] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [whatsappContato, setWhatsappContato] = useState("");
  const [linkGoogle, setLinkGoogle] = useState("");
  const [valorDisplay, setValorDisplay] = useState("80.00");

  // Seletor opcional: Outras Vendas / Serviços
  const [mostrarOutrasVendas, setMostrarOutrasVendas] = useState(false);
  const [servicoDescricao, setServicoDescricao] = useState("");
  const [servicoValor, setServicoValor] = useState("");
  const [servicoTipoCobranca, setServicoTipoCobranca] = useState<"unico" | "recorrente">("unico");

  const [salvando, setSalvando] = useState(false);
  const [erroAtivacao, setErroAtivacao] = useState<string | null>(null);
  const [ativadaComSucesso, setAtivadaComSucesso] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function processarDisplay() {
      setLoading(true);
      try {
        // 1. Buscar a placa no Supabase
        const { data: placaData, error: placaErr } = await supabase
          .from("placas")
          .select("*")
          .eq("codigo", codigo)
          .maybeSingle();

        if (placaErr || !placaData) {
          if (isMounted) {
            setNaoEncontrada(true);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;
        setPlaca(placaData);

        const linkDestino = (placaData.link_google_review || placaData.link_destino || placaData.url_destino || "").trim();

        // =========================================================================
        // CENÁRIO A: Placa já ativada com link_destino preenchido
        // Redireciona imediatamente para a avaliação do Google. Qualquer cliente pode acessar.
        // =========================================================================
        if (placaData.status === "ativa" && linkDestino) {
          let destinoFinal = linkDestino;
          if (!destinoFinal.startsWith("http://") && !destinoFinal.startsWith("https://")) {
            destinoFinal = `https://${destinoFinal}`;
          }

          // Incrementar contagem de scans se a coluna existir (sem travar)
          try {
            if (typeof placaData.total_scans === "number") {
              await supabase
                .from("placas")
                .update({ total_scans: (placaData.total_scans || 0) + 1 })
                .eq("id", placaData.id);
            }
          } catch {}

          window.location.href = destinoFinal;
          return;
        }

        // =========================================================================
        // CENÁRIO B: Placa virgem / sem link_destino cadastrado
        // =========================================================================
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // Se NÃO houver usuário logado: Redireciona para /login
          const redirectUrl = `/login?redirect=${encodeURIComponent(`/p/${codigo}`)}&message=${encodeURIComponent("Esta placa ainda não foi ativada. Faça login no GOPLAK para vinculá-la ao seu cliente.")}`;
          router.push(redirectUrl);
          return;
        }

        // Se HOUVER usuário logado: Validar posse
        const user = session.user;
        setUsuario(user);

        const userEmail = (user.email || "").toLowerCase();
        const userRole = user.user_metadata?.role || user.app_metadata?.role || "";
        const userIsAdmin =
          userEmail === "daniel@goplacas.com.br" ||
          userEmail === "admin@goplacas.com.br" ||
          userEmail === "daniel.rodrigues2508@gmail.com" ||
          userEmail.includes("admin") ||
          userRole === "admin";

        setIsAdmin(userIsAdmin);

        // Se for admin ou a placa pertencer ao aluno (aluno_id corresponde) ou se for placa nova sem dono
        const pertence = userIsAdmin || (placaData.aluno_id && placaData.aluno_id === user.id) || !placaData.aluno_id;
        setPlacaPertenceAoUsuario(Boolean(pertence));

        setNomeComercio(placaData.nome_empresa || "");
        setLinkGoogle(placaData.link_google_review || "");
        if (placaData.valor_venda) {
          setValorDisplay(String(placaData.valor_venda));
        }
        if (placaData.whatsapp_feedback) {
          setWhatsappContato(formatarTelefone(placaData.whatsapp_feedback));
        }
      } catch (err) {
        console.error("Erro ao carregar display:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    processarDisplay();

    return () => {
      isMounted = false;
    };
  }, [codigo, router]);

  // Salvar ativação do display
  const handleSalvarAtivacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa) return;

    const nomeLimpo = nomeComercio.trim();
    const linkLimpo = linkGoogle.trim();
    const respLimpo = nomeResponsavel.trim();
    const whatsLimpo = whatsappContato.replace(/\D/g, "");
    const valorNum = parseFloat(valorDisplay.replace(",", ".")) || 80.0;

    if (!nomeLimpo) {
      setErroAtivacao("Informe o nome do comércio / estabelecimento.");
      return;
    }
    if (!respLimpo) {
      setErroAtivacao("Informe o nome do responsável.");
      return;
    }
    if (!whatsLimpo || whatsLimpo.length < 10) {
      setErroAtivacao("Informe um WhatsApp de contato válido com DDD.");
      return;
    }
    if (!linkLimpo) {
      setErroAtivacao("Informe o link de avaliação do Google.");
      return;
    }

    setSalvando(true);
    setErroAtivacao(null);

    try {
      let urlFormatada = linkLimpo;
      if (!urlFormatada.startsWith("http://") && !urlFormatada.startsWith("https://")) {
        urlFormatada = `https://${urlFormatada}`;
      }

      const agoraIso = new Date().toISOString();

      // Monta detalhes complementares estruturados em nome_empresa se houver serviços adicionais ou responsável
      let nomeEmpresaFinal = nomeLimpo;
      const partesExtras: string[] = [];
      if (respLimpo) partesExtras.push(`Resp: ${respLimpo}`);
      if (mostrarOutrasVendas && servicoDescricao.trim()) {
        const valServ = servicoValor ? `R$ ${servicoValor}` : "";
        const cobrancaTxt = servicoTipoCobranca === "recorrente" ? "Recorrente/Mês" : "Único";
        partesExtras.push(`Serviço: ${servicoDescricao.trim()} ${valServ} (${cobrancaTxt})`.trim());
      }
      if (partesExtras.length > 0) {
        nomeEmpresaFinal = `${nomeLimpo} [${partesExtras.join(" | ")}]`;
      }

      // Payload principal 100% suportado pela tabela placas
      const updatePayload: Record<string, any> = {
        status: "ativa",
        nome_empresa: nomeEmpresaFinal,
        link_google_review: urlFormatada,
        whatsapp_feedback: whatsLimpo,
        valor_venda: valorNum,
        activated_at: agoraIso,
      };

      // Tenta também enviar as colunas solicitadas (data_ativacao, responsavel_nome, whatsapp_contato)
      const payloadEstendido: Record<string, any> = {
        ...updatePayload,
        data_ativacao: agoraIso,
        responsavel_nome: respLimpo,
        whatsapp_contato: whatsLimpo,
      };

      if (mostrarOutrasVendas && servicoDescricao.trim()) {
        payloadEstendido.outras_vendas = {
          descricao: servicoDescricao.trim(),
          valor: parseFloat(servicoValor.replace(",", ".")) || 0,
          tipo_cobranca: servicoTipoCobranca,
        };
      }

      // Se a placa não tinha aluno vinculado e o aluno logou para ativá-la, vincula o aluno
      if (!placa.aluno_id && usuario?.id && !isAdmin) {
        updatePayload.aluno_id = usuario.id;
        payloadEstendido.aluno_id = usuario.id;
      }

      let salvou = false;
      // 1. Tenta salvar com o payload estendido
      const { error: errEstendido } = await supabase
        .from("placas")
        .update(payloadEstendido)
        .eq("id", placa.id);

      if (!errEstendido) {
        salvou = true;
      } else {
        console.warn("Tentando update com schema base compatível:", errEstendido.message);
        // 2. Se o schema cache do Supabase rejeitar colunas novas, salva no schema base
        const { error: errBase } = await supabase
          .from("placas")
          .update(updatePayload)
          .eq("id", placa.id);

        if (errBase) {
          throw new Error(errBase.message);
        }
        salvou = true;
      }

      if (salvou) {
        setAtivadaComSucesso(true);
        setPlaca((prev: any) => ({
          ...prev,
          ...updatePayload,
          data_ativacao: agoraIso,
          responsavel_nome: respLimpo,
          whatsapp_contato: whatsLimpo,
        }));

        // Redireciona para o link ativado após 1.2 segundos
        setTimeout(() => {
          window.location.href = urlFormatada;
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao ativar display:", err);
      setErroAtivacao(`Falha ao ativar display: ${msg}`);
    } finally {
      setSalvando(false);
    }
  };

  // 1. Tela de Carregamento
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 flex flex-col items-center justify-center p-6 transition-colors">
        <Loader2 className="w-9 h-9 text-emerald-500 animate-spin mb-3" />
        <p className="text-xs text-zinc-500 dark:text-neutral-400 font-mono tracking-wider uppercase">
          Carregando Display {codigo}...
        </p>
      </main>
    );
  }

  // 2. Tela de Display Não Encontrado
  if (naoEncontrada || !placa) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Display GOPLAK não encontrado.
            </h1>
            <p className="text-sm text-zinc-600 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
              O código <span className="font-mono font-bold text-zinc-800 dark:text-neutral-200">"{codigo}"</span> não foi localizado em nossa base de dados.
            </p>
          </div>

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

  // 3. CENÁRIO: Placa pertence a outro aluno
  if (!placaPertenceAoUsuario) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
            <UserX className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-mono text-xs font-bold">
              <QrCode className="w-3.5 h-3.5" />
              <span>{codigo}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Acesso não autorizado
            </h1>
            <p className="text-sm text-zinc-600 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
              Esta placa não pertence ao seu lote. Apenas o aluno titular deste pedido ou a Administração podem ativá-la.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 transition shadow-sm"
            >
              <span>Voltar ao Meu Painel</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 4. CENÁRIO: Tela de Ativação do Display (Aluno Titular ou Admin Logado)
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 transition-colors selection:bg-emerald-500 selection:text-black">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-3.5 animate-in fade-in">
        {/* Cabeçalho */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold">
            <QrCode className="w-3.5 h-3.5" />
            <span>Display {codigo}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            Ativar Display {codigo}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-neutral-400 leading-tight">
            Vincule os dados para que o QR Code e NFC redirecionem para o Google.
          </p>
        </div>

        {/* Alerta de Sucesso */}
        {ativadaComSucesso && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Display ativado com sucesso!</p>
              <p className="text-[10px] opacity-90">Redirecionando para a avaliação do Google...</p>
            </div>
          </div>
        )}

        {/* Alerta de Erro */}
        {erroAtivacao && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erroAtivacao}</span>
          </div>
        )}

        {/* Formulário Completo de Ativação do Lojista */}
        <form onSubmit={handleSalvarAtivacao} className="space-y-2.5">
          {/* Nome do Comércio / Estabelecimento */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Nome do Comércio / Estabelecimento *</span>
            </label>
            <input
              type="text"
              required
              disabled={salvando || ativadaComSucesso}
              value={nomeComercio}
              onChange={(e) => setNomeComercio(e.target.value)}
              placeholder="Ex: Pizzaria Bella Roma, Barbearia Silva..."
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition font-medium"
            />
          </div>

          {/* Agrupamento Lado a Lado: Nome do Responsável (50%) + WhatsApp (50%) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-neutral-400 mb-1 truncate flex items-center gap-1">
                <User className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>Responsável *</span>
              </label>
              <input
                type="text"
                required
                disabled={salvando || ativadaComSucesso}
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                placeholder="Ex: Carlos"
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-neutral-400 mb-1 truncate flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp *</span>
              </label>
              <input
                type="tel"
                required
                disabled={salvando || ativadaComSucesso}
                value={whatsappContato}
                onChange={(e) => setWhatsappContato(formatarTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Link do Google Maps / Avaliação */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-neutral-400 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Link de Avaliação do Google *</span>
              </label>
            </div>

            <input
              type="url"
              required
              disabled={salvando || ativadaComSucesso}
              value={linkGoogle}
              onChange={(e) => setLinkGoogle(e.target.value)}
              placeholder="https://g.page/r/.../review ou link de avaliação"
              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 transition"
            />

            {/* Botão de Atalho Auxiliar para Gerador de Link Externo */}
            <div className="mt-1 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => window.open('https://share.google/YGTkj3nJeNNbyMYFJ', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center justify-start gap-1 w-fit px-2 py-0.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[10px] font-bold transition active:scale-[0.98] cursor-pointer"
              >
                <span>🔍 Gerar Link de Avaliação no Google</span>
                <ExternalLink className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Valor do Display (R$) */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-neutral-400 mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-500" />
              <span>Valor do Display (R$)</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-zinc-500 dark:text-neutral-400 font-bold">R$</span>
              <input
                type="text"
                disabled={salvando || ativadaComSucesso}
                value={valorDisplay}
                onChange={(e) => setValorDisplay(e.target.value)}
                placeholder="80,00"
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Seletor Opcional: Adicionar Outras Vendas / Serviços */}
          <div className="pt-0.5">
            <button
              type="button"
              disabled={salvando || ativadaComSucesso}
              onClick={() => setMostrarOutrasVendas(!mostrarOutrasVendas)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{mostrarOutrasVendas ? "Ocultar Outras Vendas / Serviços" : "+ Adicionar Outras Vendas / Serviços"}</span>
            </button>

            {mostrarOutrasVendas && (
              <div className="mt-2 p-3 rounded-2xl bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 space-y-2 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 dark:text-neutral-400 mb-1">
                    Descrição do Serviço / Venda
                  </label>
                  <input
                    type="text"
                    disabled={salvando || ativadaComSucesso}
                    value={servicoDescricao}
                    onChange={(e) => setServicoDescricao(e.target.value)}
                    placeholder="Ex: Gestão Mensal GMN, Fotos 360..."
                    className="w-full bg-white dark:bg-neutral-900 border border-zinc-300 dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 dark:text-neutral-400 mb-1">
                      Valor (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-[11px] text-zinc-500 font-bold">R$</span>
                      <input
                        type="text"
                        disabled={salvando || ativadaComSucesso}
                        value={servicoValor}
                        onChange={(e) => setServicoValor(e.target.value)}
                        placeholder="150,00"
                        className="w-full bg-white dark:bg-neutral-900 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-6 pr-2 py-1.5 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 dark:text-neutral-400 mb-1">
                      Cobrança
                    </label>
                    <select
                      disabled={salvando || ativadaComSucesso}
                      value={servicoTipoCobranca}
                      onChange={(e) => setServicoTipoCobranca(e.target.value as "unico" | "recorrente")}
                      className="w-full bg-white dark:bg-neutral-900 border border-zinc-300 dark:border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="unico">Pagamento Único</option>
                      <option value="recorrente">Recorrente/Mês</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Envio */}
          <div className="pt-1.5">
            <button
              type="submit"
              disabled={salvando || ativadaComSucesso}
              className="w-full py-3 px-4 rounded-xl font-extrabold text-sm bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando & Ativando...</span>
                </>
              ) : ativadaComSucesso ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Display Ativado com Sucesso!</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>Salvar & Ativar Display</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Rodapé Informativo */}
        <div className="pt-1.5 border-t border-zinc-200 dark:border-neutral-800 text-center">
          <p className="text-[11px] text-zinc-400 dark:text-neutral-500">
            Conectado como <strong className="text-zinc-700 dark:text-neutral-300">{usuario?.email}</strong>
          </p>
        </div>
      </div>
    </main>
  );
}
