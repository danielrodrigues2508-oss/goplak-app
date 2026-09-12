"use client";

import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabaseClient";
import {
  TrendingUp,
  DollarSign,
  Package,
  Target,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Wallet,
  ShoppingBag,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Truck,
  Copy,
  ExternalLink,
  Check,
  ShieldCheck,
  Store,
  Link2,
  Phone,
  QrCode
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Despesa {
  id: string;
  categoria: "transporte" | "alimentacao" | "outros";
  valor: number;
  descricao: string;
  hora: string;
  data?: string;
}

interface PedidoDisplay {
  id: string;
  quantidade: number;
  status: string;
  codigo_rastreio?: string;
  codigo_inicio?: string;
  codigo_fim?: string;
  created_at: string;
}

interface PlacaVirgemItem {
  id: string;
  codigo: string;
}

export default function DashboardAluno() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Informações do Aluno
  const [alunoId, setAlunoId] = useState<string>("00000000-0000-0000-0000-000000000001");
  const [alunoNome, setAlunoNome] = useState<string>("Daniel Silva");

  // Métricas Principais
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [precoPorDisplay] = useState(80.0);
  const [displaysVirgens, setDisplaysVirgens] = useState(0);
  const [displaysVendidosHoje, setDisplaysVendidosHoje] = useState(0);
  const [displaysVendidosSemana, setDisplaysVendidosSemana] = useState(0);
  const [metaSemanalDisplays] = useState(20);

  const [despesasHoje, setDespesasHoje] = useState<Despesa[]>([]);

  // Placas virgens disponíveis para ativação
  const [placasVirgensDisponiveis, setPlacasVirgensDisponiveis] = useState<PlacaVirgemItem[]>([]);

  // Modal 1: Ativar Novo Display em Campo (Disparado pelo Botão Flutuante +)
  const [modalAtivacaoAberto, setModalAtivacaoAberto] = useState(false);
  const [placaSelecionadaId, setPlacaSelecionadaId] = useState<string>("");
  const [formNomeEmpresa, setFormNomeEmpresa] = useState("");
  const [formLinkGoogle, setFormLinkGoogle] = useState("");
  const [formWhatsappFeedback, setFormWhatsappFeedback] = useState("");
  const [formValorVenda, setFormValorVenda] = useState("80.00");
  const [formEscudoAtivo, setFormEscudoAtivo] = useState(true);
  const [ativandoDisplay, setAtivandoDisplay] = useState(false);
  const [avisoSucessoAtivacao, setAvisoSucessoAtivacao] = useState<string | null>(null);

  // Modal 2: Adicionar Despesa de Rua (Disparado pelos botões secundários "+ Lançar")
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState<"transporte" | "alimentacao" | "outros">("transporte");
  const [novoValor, setNovoValor] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  // Modal 3: Solicitar Displays
  const [modalSolicitarAberto, setModalSolicitarAberto] = useState(false);
  const [qtdSolicitar, setQtdSolicitar] = useState<number>(20);
  const [solicitandoDisplays, setSolicitandoDisplays] = useState(false);
  const [avisoSucessoPedido, setAvisoSucessoPedido] = useState<string | null>(null);

  // Histórico de Pedidos de Displays do Aluno
  const [pedidosAluno, setPedidosAluno] = useState<PedidoDisplay[]>([]);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Ranking Top Display do Mês
  const [rankingLiderNome, setRankingLiderNome] = useState<string>("");
  const [rankingLiderDisplays, setRankingLiderDisplays] = useState<number>(0);
  const [rankingAlunoDisplays, setRankingAlunoDisplays] = useState<number>(0);
  const [isAlunoLider, setIsAlunoLider] = useState<boolean>(false);

  // Formatação de nome curto para ranking (Ex: "João P.")
  const formatarNomeCurto = (nomeCompleto: string) => {
    if (!nomeCompleto) return "Líder";
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[1][0]}.`;
  };

  // Obter data de início do dia em ISO UTC/Local
  const getInicioDoDiaISO = () => {
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    return agora.toISOString();
  };

  const getHojeDataFormatada = () => {
    return new Date().toISOString().split("T")[0];
  };

  // Buscar dados reais do Supabase
  const carregarDadosDoBanco = useCallback(async () => {
    try {
      const inicioDoDia = getInicioDoDiaISO();
      const hojeData = getHojeDataFormatada();
      const agora = new Date();
      const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      // 0. CARREGAR ALUNO E MAPA DE ALUNOS
      const alunosMap: Record<string, string> = {};
      try {
        const { data: todosAlunos } = await supabase
          .from("alunos")
          .select("id, nome");

        if (todosAlunos && todosAlunos.length > 0) {
          todosAlunos.forEach((a) => {
            if (a.id) alunosMap[a.id] = a.nome;
          });
          const alunoAtual = todosAlunos[0];
          setAlunoId(alunoAtual.id);
          setAlunoNome(alunoAtual.nome);
        }
      } catch (errAluno) {
        console.warn("Aviso ao buscar aluno:", errAluno);
      }

      // 1. PEDIDOS DO ALUNO E GLOBAIS PARA RANKING
      let pedidosData: (PedidoDisplay & { aluno_id?: string })[] = [];
      try {
        const { data: pData, error: errPed } = await supabase
          .from("pedidos_lotes")
          .select("*")
          .order("created_at", { ascending: false });

        if (!errPed && pData) {
          pedidosData = pData;
          setPedidosAluno(pData);
        }
      } catch (errPed) {
        console.warn("Aviso ao buscar pedidos:", errPed);
      }

      // Cálculo do Ranking Top Display do Mês
      const pedidosMes = pedidosData.filter((p) => {
        if (p.status === "cancelado") return false;
        if (!p.created_at) return true;
        return new Date(p.created_at) >= inicioDoMes;
      });

      const totalPorAluno: Record<string, number> = {};
      pedidosMes.forEach((p) => {
        const aId = p.aluno_id || "00000000-0000-0000-0000-000000000001";
        const qtd = Number(p.quantidade) || 0;
        totalPorAluno[aId] = (totalPorAluno[aId] || 0) + qtd;
      });

      let topAlunoId = "";
      let maxQtd = 0;
      for (const [id, qtd] of Object.entries(totalPorAluno)) {
        if (qtd > maxQtd) {
          maxQtd = qtd;
          topAlunoId = id;
        }
      }

      const qtdAlunoLogado = totalPorAluno[alunoId] || 0;
      setRankingAlunoDisplays(qtdAlunoLogado);
      setRankingLiderDisplays(maxQtd);

      if (topAlunoId && maxQtd > 0) {
        const nomeTop = topAlunoId === alunoId ? alunoNome : (alunosMap[topAlunoId] || "Parceiro Top");
        setRankingLiderNome(formatarNomeCurto(nomeTop));
        setIsAlunoLider(topAlunoId === alunoId);
      } else {
        setRankingLiderNome("");
        setIsAlunoLider(false);
      }

      // IDs de pedidos cujo status seja estritamente 'entregue'
      const pedidosEntreguesIds = new Set(
        pedidosData.filter((p) => p.status === "entregue").map((p) => p.id)
      );

      // 2. FATURAMENTO E DISPLAYS
      const { data: todasPlacas, error: errPlacas } = await supabase
        .from("placas")
        .select("id, codigo, aluno_id, pedido_id, status, valor_venda, created_at, activated_at");

      if (errPlacas) {
        console.error("Erro ao buscar placas no Supabase:", errPlacas);
      } else if (todasPlacas) {
        // Contagem e lista de displays virgens disponíveis em estoque:
        // Considera APENAS placas 'virgem' ou 'disponivel' que:
        // - Não possuem pedido_id vinculado (estoque base inicial do aluno), OU
        // - Estão associadas a um pedido com status 'entregue'
        const virgens = todasPlacas.filter((p) => {
          const isVirgem = p.status === "virgem" || p.status === "disponivel";
          if (!isVirgem) return false;

          if (p.pedido_id) {
            return pedidosEntreguesIds.has(p.pedido_id);
          }
          return true;
        });

        setDisplaysVirgens(virgens.length);
        const listaVirgensFormatada: PlacaVirgemItem[] = virgens.map((p) => ({
          id: p.id,
          codigo: p.codigo,
        }));
        setPlacasVirgensDisponiveis(listaVirgensFormatada);

        // Se a placa selecionada atual não está mais disponível, ajusta para a primeira
        if (listaVirgensFormatada.length > 0) {
          setPlacaSelecionadaId((prev) => {
            const exists = listaVirgensFormatada.some((item) => item.id === prev);
            return exists ? prev : listaVirgensFormatada[0].id;
          });
        }

        // Displays ativados
        const ativas = todasPlacas.filter((p) => p.status === "ativa");

        // Displays ativados hoje
        const ativadasHoje = ativas.filter((p) => {
          const dataRef = p.activated_at || p.created_at;
          if (!dataRef) return false;
          return new Date(dataRef) >= new Date(inicioDoDia) || dataRef.startsWith(hojeData);
        });

        const fatHoje = ativadasHoje.reduce((acc, curr) => {
          const val = Number(curr.valor_venda);
          return acc + (isNaN(val) ? 80.0 : val);
        }, 0);

        setFaturamentoHoje(fatHoje);
        setDisplaysVendidosHoje(ativadasHoje.length);
        setDisplaysVendidosSemana(ativas.length);
      }

      // 3. DESPESAS DE RUA REAIS
      const { data: despesasBanco, error: errDespesas } = await supabase
        .from("despesas_rua")
        .select("id, aluno_id, categoria, valor, descricao, created_at")
        .order("created_at", { ascending: false });

      if (errDespesas) {
        console.error("Erro ao buscar despesas_rua no Supabase:", errDespesas);
      } else if (despesasBanco) {
        const formatadas: Despesa[] = despesasBanco.map((d, index) => {
          const dt = d.created_at ? new Date(d.created_at) : new Date();
          return {
            id: d.id ? String(d.id) : `desp-${index}`,
            categoria: (d.categoria as "transporte" | "alimentacao" | "outros") || "outros",
            valor: Number(d.valor) || 0,
            descricao: d.descricao || `Despesa de ${d.categoria || "rua"}`,
            hora: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            data: d.created_at?.split("T")[0] || hojeData,
          };
        });

        const apenasHoje = formatadas.filter(
          (d) => d.data === hojeData || (d.data && d.data.startsWith(hojeData))
        );

        setDespesasHoje(apenasHoje.length > 0 ? apenasHoje : formatadas);
      }
    } catch (err) {
      console.warn("Erro ao buscar dados do Supabase:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosDoBanco();
  }, [carregarDadosDoBanco]);

  // Cálculos Automáticos
  const totalGastosRua = despesasHoje.reduce((acc, curr) => acc + curr.valor, 0);
  const lucroLiquidoHoje = faturamentoHoje - totalGastosRua;
  const potencialEstoque = displaysVirgens * precoPorDisplay;
  const displaysFaltantesMeta = Math.max(0, metaSemanalDisplays - displaysVendidosSemana);
  const percentualMeta = Math.min(100, Math.round((displaysVendidosSemana / metaSemanalDisplays) * 100));

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

  // 1. ATIVAR NOVO DISPLAY EM CAMPO (Atualiza placa virgem para ativa)
  const handleAtivarDisplay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placaSelecionadaId) {
      alert("Por favor, selecione um display virgem em estoque.");
      return;
    }
    if (!formNomeEmpresa.trim()) {
      alert("Informe o nome do estabelecimento / cliente.");
      return;
    }

    setAtivandoDisplay(true);
    setAvisoSucessoAtivacao(null);

    const placaAlvo = placasVirgensDisponiveis.find((p) => p.id === placaSelecionadaId);
    const codigoPlaca = placaAlvo ? placaAlvo.codigo : "Display";
    const valorNum = parseFloat(formValorVenda) || 80.0;

    try {
      const { error: errUpdate } = await supabase
        .from("placas")
        .update({
          status: "ativa",
          nome_empresa: formNomeEmpresa.trim(),
          link_google_review: formLinkGoogle.trim() || null,
          whatsapp_feedback: formWhatsappFeedback.replace(/\D/g, "") || null,
          valor_venda: valorNum,
          activated_at: new Date().toISOString(),
        })
        .eq("id", placaSelecionadaId);

      if (errUpdate) {
        console.error("Erro ao ativar display no Supabase:", errUpdate);
        alert(`Erro ao ativar display: ${errUpdate.message}`);
      } else {
        // Celebração com confetes
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });

        setAvisoSucessoAtivacao(
          `Display ${codigoPlaca} ativado com sucesso para "${formNomeEmpresa.trim()}"! Faturamento (+R$ ${valorNum.toFixed(2)}) e métricas atualizados.`
        );

        // Limpar formulário
        setFormNomeEmpresa("");
        setFormLinkGoogle("");
        setFormWhatsappFeedback("");
        setFormValorVenda("80.00");
        setModalAtivacaoAberto(false);

        // Recarregar dados imediatamente
        await carregarDadosDoBanco();
      }
    } catch (err) {
      console.error("Erro inesperado ao ativar display:", err);
      alert("Ocorreu um erro ao processar a ativação do display.");
    } finally {
      setAtivandoDisplay(false);
    }
  };

  // 2. SALVAR DESPESA DE RUA
  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseFloat(novoValor);
    if (!valNum || valNum <= 0) return;

    setSalvandoDespesa(true);
    const hojeStr = getHojeDataFormatada();
    const desc = novaDescricao.trim() || `Despesa de ${novaCategoria}`;

    const novaLocal: Despesa = {
      id: `temp-${Date.now()}`,
      categoria: novaCategoria,
      valor: valNum,
      descricao: desc,
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      data: hojeStr,
    };

    try {
      const { data: inserido, error } = await supabase
        .from("despesas_rua")
        .insert([
          {
            aluno_id: alunoId,
            categoria: novaCategoria,
            valor: valNum,
            descricao: desc,
          },
        ])
        .select()
        .maybeSingle();

      if (!error && inserido) {
        novaLocal.id = String(inserido.id);
      } else if (error) {
        console.error("Erro ao salvar despesa no Supabase:", error);
      }
    } catch (err) {
      console.warn("Persistindo localmente:", err);
    } finally {
      setDespesasHoje((prev) => [novaLocal, ...prev]);
      setNovoValor("");
      setNovaDescricao("");
      setSalvandoDespesa(false);
      setModalDespesaAberto(false);
    }
  };

  // 3. SOLICITAR DISPLAYS
  const handleSolicitarDisplays = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qtdSolicitar <= 0) return;

    setSolicitandoDisplays(true);
    setAvisoSucessoPedido(null);
    const valorCalculado = qtdSolicitar * 25.0;

    try {
      let pedidoSalvo = false;
      const { data: resPedido, error: errPedido } = await supabase
        .from("pedidos_lotes")
        .insert([
          {
            aluno_id: alunoId,
            quantidade: qtdSolicitar,
            valor_total: valorCalculado,
            status: "solicitado",
          },
        ])
        .select();

      if (errPedido) {
        const { data: resFallback, error: errFallback } = await supabase
          .from("pedidos_lotes")
          .insert([
            {
              aluno_id: alunoId,
              quantidade: qtdSolicitar,
              valor_total: valorCalculado,
              status: "pendente",
            },
          ])
          .select();

        if (errFallback) {
          console.error("Erro Supabase ao solicitar displays:", errFallback);
          alert(`Erro ao registrar pedido no banco: ${errFallback.message}`);
        } else {
          pedidoSalvo = true;
        }
      } else {
        pedidoSalvo = true;
      }

      // Notificar WhatsApp
      try {
        await fetch("/api/notify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alunoNome: alunoNome || "Aluno Parceiro",
            quantidade: qtdSolicitar,
          }),
        });
      } catch (errNotify) {
        console.warn("Aviso ao notificar WhatsApp:", errNotify);
      }

      if (pedidoSalvo) {
        setAvisoSucessoPedido("Pedido enviado! Seus displays entrarão em produção.");
        await carregarDadosDoBanco();
      }
      setModalSolicitarAberto(false);
    } catch (err) {
      console.error("Erro inesperado ao solicitar displays:", err);
      alert("Ocorreu um erro ao processar sua solicitação.");
    } finally {
      setSolicitandoDisplays(false);
    }
  };

  const handleComemorarMeta = () => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleCopiarRastreio = (id: string, codigo: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(codigo);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2500);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans pb-28 pt-4 px-4 sm:px-6 max-w-lg mx-auto selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      {/* Top Header Mobile */}
      <header className="flex items-center justify-between py-3 mb-5 border-b border-zinc-200 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">GoPlacas • Campo</span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Supabase Live
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2 mt-0.5">
            Meu Dashboard <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 inline" />
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => {
              setRefreshing(true);
              carregarDadosDoBanco();
            }}
            title="Atualizar dados do Supabase"
            aria-label="Atualizar dados"
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white shadow-sm transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* Alerta de Sucesso de Ativação de Display */}
      {avisoSucessoAtivacao && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{avisoSucessoAtivacao}</span>
          </div>
          <button
            onClick={() => setAvisoSucessoAtivacao(null)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerta de Sucesso de Pedido de Displays */}
      {avisoSucessoPedido && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{avisoSucessoPedido}</span>
          </div>
          <button
            onClick={() => setAvisoSucessoPedido(null)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Indicador de carregamento discreto */}
      {(loading || refreshing) && (
        <div className="mb-3 flex items-center justify-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 py-1.5 px-3 rounded-xl animate-in fade-in duration-150">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Sincronizando métricas com o Supabase...</span>
        </div>
      )}

      <div className="space-y-4">
        {/* BANNER COMPACTO: TOP DISPLAY (TOPO ABSOLUTO) */}
        {(() => {
          const agora = new Date();
          const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
          const diasRestantesMes = Math.max(1, ultimoDiaMes - agora.getDate());

          return (
            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-3.5 shadow-sm transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">🏆</span>
                  <h3 className="text-xs font-bold tracking-wider uppercase text-amber-800 dark:text-amber-400">
                    TOP DISPLAY: <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">+10 DISPLAYS GRÁTIS</span>
                  </h3>
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-neutral-400 font-mono shrink-0">
                  Encerra em {diasRestantesMes} {diasRestantesMes === 1 ? "dia" : "dias"}
                </span>
              </div>

              <div className="text-xs space-y-0.5">
                {rankingLiderDisplays === 0 ? (
                  <div className="text-zinc-600 dark:text-neutral-300 font-medium">
                    <p>Nenhum pedido registrado este mês.</p>
                    <p className="text-[11px] text-zinc-500 dark:text-neutral-400">Seja o primeiro a liderar e levar os 10 displays grátis!</p>
                  </div>
                ) : isAlunoLider ? (
                  <>
                    <p className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                      <span>👑</span>
                      <span>Você é o Líder atual com {rankingAlunoDisplays} displays!</span>
                    </p>
                    <p className="text-zinc-600 dark:text-neutral-400 text-[11px]">
                      Segue o ritmo para levar os 10 displays grátis.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-zinc-800 dark:text-neutral-200">
                      Líder atual: <strong className="text-zinc-900 dark:text-white font-bold">{rankingLiderNome}</strong>{" "}
                      <span className="text-zinc-500 dark:text-neutral-400 font-mono">({rankingLiderDisplays} displays)</span>
                    </div>
                    <div className="text-zinc-600 dark:text-neutral-400 text-[11px]">
                      Você comprou <strong className="text-zinc-800 dark:text-neutral-200 font-semibold">{rankingAlunoDisplays} displays</strong>{" "}
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        (Faltam {Math.max(1, rankingLiderDisplays - rankingAlunoDisplays + 1)} para assumir a liderança!)
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })()}

        {/* BLOCO SUPERIOR: Ritmo do Dia */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl backdrop-blur-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Ritmo de Hoje
            </h2>
            <span className="text-[11px] bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 px-2 py-0.5 rounded-md font-mono">
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Faturamento */}
            <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl p-3.5">
              <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Faturamento
              </span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                R$ {faturamentoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-zinc-500 dark:text-neutral-400">{displaysVendidosHoje} ativados hoje</span>
            </div>

            {/* Gastos de Rua com botão secundário de Lançamento */}
            <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> Gastos de Rua
                </span>
                <button
                  type="button"
                  onClick={() => setModalDespesaAberto(true)}
                  className="text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md transition active:scale-95 cursor-pointer"
                  title="Lançar gasto de rua"
                >
                  + Add Gastos
                </button>
              </div>
              <div>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                  - R$ {totalGastosRua.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-zinc-500 dark:text-neutral-400">{despesasHoje.length} lançamentos</span>
              </div>
            </div>
          </div>

          {/* Lucro Líquido em Destaque */}
          <div className="bg-gradient-to-r from-emerald-500/10 dark:from-emerald-950/50 to-emerald-500/5 dark:to-neutral-950 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Lucro Líquido Hoje
              </span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                R$ {lucroLiquidoHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-11 h-11 rounded-full bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* BLOCO CENTRAL: ESTOQUE DE DISPLAYS */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" /> ESTOQUE DE DISPLAYS
            </h2>
            <button
              onClick={() => setModalSolicitarAberto(true)}
              className="inline-flex items-center gap-1 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Solicitar Displays (+)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Displays Virgens
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-black text-zinc-900 dark:text-white">{displaysVirgens}</span>
                <span className="text-xs text-zinc-500 dark:text-neutral-400">em estoque</span>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Potencial Parado
              </span>
              <div className="mt-2">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-300">
                  R$ {potencialEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-zinc-500 dark:text-neutral-400">em potencial de venda</span>
              </div>
            </div>
          </div>
        </section>

        {/* MÓDULO DE METAS DA SEMANA */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Progresso da Semana
            </h2>
            <button
              onClick={handleComemorarMeta}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition cursor-pointer"
            >
              Celebrar 🎉
            </button>
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {displaysVendidosSemana} de {metaSemanalDisplays} displays ativados
              </span>
              <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">{percentualMeta}%</span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-zinc-100 dark:bg-neutral-950 h-3 rounded-full overflow-hidden border border-zinc-200 dark:border-neutral-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 dark:to-emerald-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${percentualMeta}%` }}
              />
            </div>

            <div className="text-xs text-zinc-500 dark:text-neutral-400 mt-2 flex items-center gap-1.5">
              {displaysFaltantesMeta > 0 ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>
                    Faltam <strong className="text-zinc-800 dark:text-neutral-200">{displaysFaltantesMeta} displays</strong> para bater a meta semanal (R$ {(displaysFaltantesMeta * precoPorDisplay).toFixed(0)} em vendas).
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <strong className="text-emerald-600 dark:text-emerald-400">Parabéns! Meta semanal superada! 🚀</strong>
                </>
              )}
            </div>
          </div>
        </section>

        {/* LISTAGEM: GASTOS DO DIA COM BOTÃO + ADD GASTOS */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-400 dark:text-neutral-400" /> GASTOS DO DIA
              </h2>
              <span className="text-xs text-zinc-500 dark:text-neutral-400">({despesasHoje.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setModalDespesaAberto(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-neutral-700 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-rose-500 dark:text-rose-400" />
              <span>+ Add Gastos</span>
            </button>
          </div>

          {despesasHoje.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-neutral-400 py-3 text-center">Nenhum gasto registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {despesasHoje.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-zinc-50 dark:bg-neutral-950/60 border border-zinc-200 dark:border-neutral-800/70 p-2.5 rounded-xl text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-800 dark:text-neutral-200 capitalize">{d.descricao}</span>
                    <span className="text-[11px] text-zinc-500 dark:text-neutral-400">
                      {d.categoria} • {d.hora}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                    - R$ {d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SEÇÃO: MEUS PEDIDOS */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Meus Pedidos
            </h2>
            <span className="text-xs text-zinc-500 dark:text-neutral-400 font-mono">{pedidosAluno.length} solicitações</span>
          </div>

          {pedidosAluno.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-400 dark:text-neutral-500">
              Você ainda não realizou pedidos de displays.
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosAluno.map((ped) => {
                const dt = new Date(ped.created_at || Date.now());
                const statusLabel =
                  ped.status === "solicitado" || ped.status === "pendente"
                    ? "🟡 Solicitado"
                    : ped.status === "em_producao"
                    ? "🔵 Em Produção"
                    : ped.status === "enviado"
                    ? "🟣 Enviado (Em Trânsito)"
                    : ped.status === "entregue"
                    ? "🟢 Entregue"
                    : ped.status;

                const statusStyle =
                  ped.status === "solicitado" || ped.status === "pendente"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : ped.status === "em_producao"
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                    : ped.status === "enviado"
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                    : ped.status === "entregue"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700";

                const rastreioTrim = (ped.codigo_rastreio || "").trim();
                const isUrlRastreio = rastreioTrim.startsWith("http://") || rastreioTrim.startsWith("https://");
                const urlRastreioFinal = isUrlRastreio
                  ? rastreioTrim
                  : `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(rastreioTrim)}`;

                return (
                  <div
                    key={ped.id}
                    className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800/80 rounded-xl p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">{ped.quantidade} displays</span>
                        <span className="text-[11px] text-zinc-500 dark:text-neutral-400">
                          • {dt.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Código de Rastreio se houver */}
                    {rastreioTrim ? (
                      <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800/80 flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/30 p-2.5 rounded-lg">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-violet-700 dark:text-violet-300 min-w-0">
                          <Truck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                          <span className="font-bold truncate" title={rastreioTrim}>
                            {isUrlRastreio ? "Link de Envio" : rastreioTrim}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopiarRastreio(ped.id, rastreioTrim)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-200 px-2.5 py-1 rounded transition cursor-pointer"
                            title="Copiar código ou link de rastreio"
                          >
                            {copiadoId === ped.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                          <a
                            href={urlRastreioFinal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 dark:bg-violet-500/20 dark:hover:bg-violet-500/30 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded border border-violet-500/30 transition cursor-pointer"
                            title="Acompanhar entrega em nova aba"
                          >
                            <span>Rastrear</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 dark:text-neutral-500 italic">
                        {ped.status === "solicitado" || ped.status === "pendente"
                          ? "Aguardando envio pelo distribuidor."
                          : "Produzindo displays na fábrica."}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* BOTÃO FLUTUANTE PRINCIPAL (+): EXCLUSIVAMENTE PARA ATIVAR NOVO DISPLAY EM CAMPO */}
      <button
        onClick={() => setModalAtivacaoAberto(true)}
        className="fixed bottom-6 right-6 sm:right-auto sm:left-1/2 sm:translate-x-44 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold p-4 rounded-full shadow-2xl flex items-center justify-center gap-2 border-2 border-emerald-300/40 transition-all z-40 group cursor-pointer"
        aria-label="Ativar Novo Display em Campo"
        title="Ativar Novo Display em Campo"
      >
        <Plus className="w-6 h-6 stroke-[3] group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* MODAL 1: ATIVAR NOVO DISPLAY EM CAMPO */}
      {modalAtivacaoAberto && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Ativar Novo Display em Campo
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-neutral-400">
                    Vincule a placa virgem ao estabelecimento do cliente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAtivacaoAberto(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {placasVirgensDisponiveis.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white text-sm">Sem displays virgens em estoque</h4>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1 max-w-xs mx-auto">
                    Você não possui placas virgens disponíveis no momento. Solicite um novo lote de displays para continuar ativando.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalAtivacaoAberto(false);
                    setModalSolicitarAberto(true);
                  }}
                  className="bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Solicitar Displays (+)
                </button>
              </div>
            ) : (
              <form onSubmit={handleAtivarDisplay} className="space-y-3.5">
                {/* Seleção do Display Virgem */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                    Display Virgem em Estoque ({placasVirgensDisponiveis.length} disponíveis)
                  </label>
                  <select
                    value={placaSelecionadaId}
                    onChange={(e) => setPlacaSelecionadaId(e.target.value)}
                    required
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    {placasVirgensDisponiveis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} (Virgem / Pronto para Ativação)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nome do Estabelecimento */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-zinc-400" /> Nome do Estabelecimento / Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Barbearia VIP, Padaria Central, Dr. Silva..."
                    value={formNomeEmpresa}
                    onChange={(e) => setFormNomeEmpresa(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
                    autoFocus
                  />
                </div>

                {/* Link Google Review */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-zinc-400" /> Link de Avaliação Google (Google Review)
                  </label>
                  <input
                    type="url"
                    placeholder="Ex: https://g.page/r/... ou https://maps.app.goo.gl/..."
                    value={formLinkGoogle}
                    onChange={(e) => setFormLinkGoogle(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* WhatsApp da Gerência / Feedback */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" /> WhatsApp do Proprietário / Gerência
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-8888"
                    value={formatarWhatsapp(formWhatsappFeedback)}
                    onChange={(e) => setFormWhatsappFeedback(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Valor Cobrado */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> Valor Cobrado na Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="5.00"
                    required
                    placeholder="80.00"
                    value={formValorVenda}
                    onChange={(e) => setFormValorVenda(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Escudo Anti-Golpe Ativo */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="escudoAtivoCheck"
                    checked={formEscudoAtivo}
                    onChange={(e) => setFormEscudoAtivo(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                  />
                  <label htmlFor="escudoAtivoCheck" className="text-xs text-zinc-700 dark:text-neutral-300 cursor-pointer select-none">
                    <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5 inline" />
                      Escudo de Reputação Ativo
                    </div>
                    <span className="text-[11px] text-zinc-500 dark:text-neutral-400 block mt-0.5">
                      Filtra notas de 1 a 3 estrelas para o WhatsApp privado e 4 a 5 para o Google Oficial.
                    </span>
                  </label>
                </div>

                {/* Botões de Ação */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAtivacaoAberto(false)}
                    className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ativandoDisplay}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {ativandoDisplay ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Ativando...</span>
                      </span>
                    ) : (
                      <span>Ativar Display 🚀</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: LANÇAR DESPESA DE RUA */}
      {modalDespesaAberto && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-500 dark:text-rose-400" /> Lançar Despesa de Rua
              </h3>
              <button
                onClick={() => setModalDespesaAberto(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarDespesa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Categoria
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["transporte", "alimentacao", "outros"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNovaCategoria(cat)}
                      className={`text-xs py-2 px-3 rounded-xl font-semibold capitalize border transition cursor-pointer ${
                        novaCategoria === cat
                          ? "bg-rose-500 text-white border-rose-400 shadow-sm"
                          : "bg-zinc-50 dark:bg-neutral-950 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.50"
                  required
                  placeholder="Ex: 15.00"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-lg font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500 transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Descrição Rápida (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Gasolina, Estacionamento, Almoço..."
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalDespesaAberto(false)}
                  className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoDespesa}
                  className="flex-1 bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {salvandoDespesa ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </span>
                  ) : (
                    <span>Confirmar Gasto</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SOLICITAR DISPLAYS */}
      {modalSolicitarAberto && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Solicitar Novos Displays
              </h3>
              <button
                onClick={() => setModalSolicitarAberto(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSolicitarDisplays} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  Escolha a Quantidade
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[20, 50, 100].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setQtdSolicitar(qtd)}
                      className={`text-xs py-2.5 px-3 rounded-xl font-bold border transition cursor-pointer ${
                        qtdSolicitar === qtd
                          ? "bg-sky-500 text-black border-sky-400 shadow-sm"
                          : "bg-zinc-50 dark:bg-neutral-950 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {qtd} displays
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={qtdSolicitar}
                  onChange={(e) => setQtdSolicitar(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                  placeholder="Ou digite outra quantidade..."
                />
              </div>

              <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3.5 text-xs space-y-1.5 text-zinc-600 dark:text-neutral-400">
                <div className="flex justify-between items-center text-zinc-700 dark:text-neutral-300">
                  <span>Destinatário:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{alunoNome}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-700 dark:text-neutral-300">
                  <span>Previsão de Potencial:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {(qtdSolicitar * precoPorDisplay).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-neutral-500 pt-1 border-t border-zinc-200 dark:border-neutral-800">
                  O distribuidor receberá seu pedido e colocará o lote em produção imediatamente.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalSolicitarAberto(false)}
                  className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={solicitandoDisplays}
                  className="flex-1 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {solicitandoDisplays ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </span>
                  ) : (
                    <span>Confirmar Pedido</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}


