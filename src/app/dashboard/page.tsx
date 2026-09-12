"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";
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
  Calendar,
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
  QrCode,
  MapPin,
  Pencil,
  LogOut,
  ChevronDown,
  ChevronUp,
  Crown
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
  observacao?: string;
  created_at: string;
}

interface PlacaVirgemItem {
  id: string;
  codigo: string;
}

interface PlacaAtivaItem {
  id: string;
  codigo: string;
  nome_empresa?: string;
  link_destino?: string;
  link_google_review?: string;
  url_destino?: string;
  whatsapp_feedback?: string;
  status: string;
  valor_venda?: number;
  activated_at?: string;
  updated_at?: string;
  created_at?: string;
  aluno_id?: string;
}

export type TipoFiltroPeriodo = "hoje" | "semana" | "mes" | "personalizado";

export default function DashboardAluno() {
  const router = useRouter();
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

  // Filtro Temporal Reativo (Hoje, Esta Semana, Este Mês, Personalizado)
  const [tipoFiltroPeriodo, setTipoFiltroPeriodo] = useState<TipoFiltroPeriodo>("hoje");
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const [todasDespesas, setTodasDespesas] = useState<Despesa[]>([]);
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

  // Placas Ativas do Aluno
  const [placasAtivas, setPlacasAtivas] = useState<PlacaAtivaItem[]>([]);

  // Modal 4: Editar Link de Destino da Placa
  const [modalEditarLinkAberto, setModalEditarLinkAberto] = useState(false);
  const [placaEditando, setPlacaEditando] = useState<PlacaAtivaItem | null>(null);
  const [novoLinkDestino, setNovoLinkDestino] = useState("");
  const [salvandoLink, setSalvandoLink] = useState(false);
  const [avisoSucessoLink, setAvisoSucessoLink] = useState<string | null>(null);

  // Ranking Top Display do Mês
  const [rankingLiderNome, setRankingLiderNome] = useState<string>("");
  const [rankingLiderDisplays, setRankingLiderDisplays] = useState<number>(0);
  const [rankingAlunoDisplays, setRankingAlunoDisplays] = useState<number>(0);
  const [isAlunoLider, setIsAlunoLider] = useState<boolean>(false);

  // Estados de Colapsar/Expandir Seções (Accordion)
  const [secaoEstoqueMetaAberta, setSecaoEstoqueMetaAberta] = useState<boolean>(true);
  const [secaoPlacasAtivasAberta, setSecaoPlacasAtivasAberta] = useState<boolean>(true);
  const [secaoGastosDiaAberta, setSecaoGastosDiaAberta] = useState<boolean>(true);
  const [secaoMeusPedidosAberta, setSecaoMeusPedidosAberta] = useState<boolean>(true);

  // Permissão de Administrador Master
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);
  const [avisoNaoAutorizado, setAvisoNaoAutorizado] = useState<string | null>(null);
  const [erroQuerySupabase, setErroQuerySupabase] = useState<string | null>(null);

  // Formatação de nome curto para ranking (Ex: "João P.")
  const formatarNomeCurto = (nomeCompleto: string) => {
    if (!nomeCompleto) return "Líder";
    const partes = nomeCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[1][0]}.`;
  };

  // Obter data local no formato YYYY-MM-DD (fuso horário do navegador)
  const getHojeDataFormatada = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Comparação de data no fuso horário local do usuário
  const isMesmoDiaLocal = (dateRef: string | Date | undefined | null) => {
    if (!dateRef) return false;
    const d = new Date(dateRef);
    if (isNaN(d.getTime())) return false;
    const agora = new Date();
    return (
      d.getDate() === agora.getDate() &&
      d.getMonth() === agora.getMonth() &&
      d.getFullYear() === agora.getFullYear()
    );
  };

  // Obter data de início do dia em ISO UTC/Local
  const getInicioDoDiaISO = () => {
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    return agora.toISOString();
  };

  // Buscar dados reais do Supabase com Isolamento Rigoroso de Aluno
  const carregarDadosDoBanco = useCallback(async () => {
    try {
      const hojeData = getHojeDataFormatada();
      const agora = new Date();
      const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      // 0. VERIFICAÇÃO DE AUTENTICAÇÃO E SESSÃO DO ALUNO
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      if (!currentUser) {
        router.push("/login?redirect=/dashboard");
        return;
      }

      const currentUserId = currentUser.id;
      const currentUserEmail = (currentUser.email || "").toLowerCase();
      const currentUserRole = currentUser.user_metadata?.role || currentUser.app_metadata?.role || "";
      const currentUserName =
        currentUser.user_metadata?.nome ||
        currentUser.email?.split("@")[0] ||
        "Aluno Parceiro";

      setAlunoId(currentUserId);
      setAlunoNome(currentUserName);

      // Validação de Administrador Master (Permissão exclusiva)
      const isUserAdmin =
        currentUserEmail === "daniel.rodrigues2508@gmail.com" ||
        currentUserEmail.includes("admin") ||
        currentUserRole === "admin" ||
        currentUserEmail === "distribuidor@goplacas.com.br";

      setIsMasterAdmin(isUserAdmin);

      // Obter ID vinculado na tabela alunos (caso divirja do auth id) e Auto-Registro / Self-Healing
      let alunoDbId = currentUserId;
      const alunosMap: Record<string, string> = {
        [currentUserId]: currentUserName,
      };
      try {
        const { data: todosAlunos } = await supabase
          .from("alunos")
          .select("id, nome, email");

        let encontrouAluno = false;
        if (todosAlunos && todosAlunos.length > 0) {
          todosAlunos.forEach((a) => {
            if (a.id) alunosMap[a.id] = a.nome;
            if (a.id === currentUserId || (a.email && a.email.toLowerCase() === currentUserEmail)) {
              alunoDbId = a.id;
              encontrouAluno = true;
            }
          });
        }

        // Self-Healing: Se não encontrou o aluno na tabela alunos, insere automaticamente
        if (!encontrouAluno && currentUserId) {
          try {
            await supabase.from("alunos").insert([{
              id: currentUserId,
              email: currentUserEmail,
              nome: currentUserName,
              meta_mensal_reais: 2000,
              preco_padrao_display: 80,
            }]);
            alunosMap[currentUserId] = currentUserName;
          } catch (eInsert) {
            console.warn("Aviso ao auto-cadastrar aluno:", eInsert);
          }
        }
      } catch (errAluno) {
        console.warn("Aviso ao buscar alunos para ranking:", errAluno);
      }

      // 1. PEDIDOS DO ALUNO E GLOBAIS PARA RANKING
      let todosPedidos: (PedidoDisplay & { aluno_id?: string })[] = [];
      let meusPedidos: (PedidoDisplay & { aluno_id?: string })[] = [];
      try {
        const { data: pData, error: errPed } = await supabase
          .from("pedidos_lotes")
          .select("*")
          .order("created_at", { ascending: false });

        if (!errPed && pData) {
          todosPedidos = pData;
          // ISOLAMENTO: Meus Pedidos exibe EXCLUSIVAMENTE os pedidos do aluno logado
          meusPedidos = pData.filter((p: any) => {
            const pUser = p.aluno_id;
            return (
              pUser === currentUserId ||
              pUser === alunoDbId ||
              pUser === currentUserEmail ||
              (typeof pUser === "string" && currentUserEmail && pUser.toLowerCase() === currentUserEmail.toLowerCase())
            );
          });
          setPedidosAluno(meusPedidos);
        }
      } catch (errPed) {
        console.warn("Aviso ao buscar pedidos:", errPed);
      }

      // Cálculo do Ranking Top Display do Mês
      const pedidosMes = todosPedidos.filter((p) => {
        if (p.status === "cancelado") return false;
        if (!p.created_at) return true;
        return new Date(p.created_at) >= inicioDoMes;
      });

      const totalPorAluno: Record<string, number> = {};
      pedidosMes.forEach((p) => {
        const aId = p.aluno_id || "desconhecido";
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

      const qtdAlunoLogado = totalPorAluno[currentUserId] || totalPorAluno[alunoDbId] || 0;
      setRankingAlunoDisplays(qtdAlunoLogado);
      setRankingLiderDisplays(maxQtd);

      if (topAlunoId && maxQtd > 0) {
        const nomeTop = (topAlunoId === currentUserId || topAlunoId === alunoDbId) ? currentUserName : (alunosMap[topAlunoId] || "Parceiro Top");
        setRankingLiderNome(formatarNomeCurto(nomeTop));
        setIsAlunoLider(topAlunoId === currentUserId || topAlunoId === alunoDbId);
      } else {
        setRankingLiderNome("");
        setIsAlunoLider(false);
      }

      // IDs de pedidos do aluno cujo status seja estritamente 'entregue'
      const pedidosEntreguesIds = new Set(
        todosPedidos
          .filter(
            (p) =>
              (p.aluno_id === currentUserId || p.aluno_id === alunoDbId) &&
              p.status === "entregue"
          )
          .map((p) => p.id)
      );

      // 2. PLACAS DO ALUNO LOGADO COM ISOLAMENTO TOTAL E FALLBACKS ROBUSTOS
      let todasPlacasAluno: any[] = [];
      let errPlacasQuery: any = null;

      try {
        const { data: placasData, error: errPlacas } = await supabase
          .from("placas")
          .select("*");

        errPlacasQuery = errPlacas;

        if (!errPlacas && placasData && placasData.length > 0) {
          todasPlacasAluno = placasData.filter((p: any) => {
            const pUser = p.aluno_id;
            if (p.pedido_id && pedidosEntreguesIds.has(p.pedido_id)) return true;
            if (!pUser) return true;
            return (
              pUser === currentUserId ||
              pUser === alunoDbId ||
              pUser === currentUserEmail ||
              (typeof pUser === "string" && currentUserEmail && pUser.toLowerCase() === currentUserEmail.toLowerCase())
            );
          });
        }
      } catch (errPlacas) {
        console.warn("[Dashboard] Erro SDK placas:", errPlacas);
        errPlacasQuery = errPlacas;
      }

      // Se SDK retornou vazio ou deu erro, consulta via REST direto com ANON_KEY
      if (todasPlacasAluno.length === 0) {
        try {
          const resRest = await fetch(`${SUPABASE_URL}/rest/v1/placas?select=*`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (resRest.ok) {
            const rData = await resRest.json();
            if (Array.isArray(rData) && rData.length > 0) {
              setErroQuerySupabase(null);
              todasPlacasAluno = rData.filter((p: any) => {
                const pUser = p.aluno_id;
                if (p.pedido_id && pedidosEntreguesIds.has(p.pedido_id)) return true;
                if (!pUser) return true;
                return (
                  pUser === currentUserId ||
                  pUser === alunoDbId ||
                  pUser === currentUserEmail ||
                  (typeof pUser === "string" && currentUserEmail && pUser.toLowerCase() === currentUserEmail.toLowerCase())
                );
              });
            }
          }
        } catch (restErr) {
          console.error("Erro no fallback REST de placas:", restErr);
        }
      }

      // Displays ativados do aluno
      const ativas = todasPlacasAluno.filter((p) => {
        const st = (p.status || "").toLowerCase();
        const isAtiva =
          st === "ativa" ||
          st === "ativada" ||
          Boolean(p.link_destino || p.link_google_review || p.url_destino);
        return isAtiva;
      });

      // IDs de pedidos em andamento (solicitado, em produção, enviado) que ainda não foram entregues
      const pedidosPendentesIds = new Set(
        todosPedidos
          .filter(
            (p) =>
              (p.aluno_id === currentUserId || p.aluno_id === alunoDbId) &&
              (p.status === "solicitado" || p.status === "em_producao" || p.status === "enviado" || p.status === "pendente")
          )
          .map((p) => p.id)
      );

      // Displays virgens utilizáveis do aluno (liberados apenas após o lote ser marcado como 'Entregue')
      const virgens = todasPlacasAluno.filter((p) => {
        const st = (p.status || "").toLowerCase();
        const isVirgem = st === "virgem" || st === "disponivel" || (!st && !p.link_google_review && !p.link_destino);
        if (!isVirgem) return false;
        // Se a placa estiver vinculada a um lote em produção/solicitado/enviado, NÃO libera estoque
        if (p.pedido_id && pedidosPendentesIds.has(p.pedido_id)) {
          return false;
        }
        return true;
      });

      // Total de displays dos lotes do aluno estritamente ENTREGUES
      const totalLotesEntreguesQtd = meusPedidos
        .filter((p) => {
          const st = (p.status || "").toLowerCase();
          return st === "entregue" || st === "concluido";
        })
        .reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0);

      const saldoLotes = Math.max(0, totalLotesEntreguesQtd - ativas.length);
      const qtdVirgensFinal = Math.max(virgens.length, saldoLotes);

      // Log Obrigatório no Terminal/Console
      console.log('DEBUG ESTOQUE:', {
        userId: currentUser?.id,
        email: currentUser?.email,
        totalVirgens: qtdVirgensFinal,
        erro: errPlacasQuery,
      });

      setDisplaysVirgens(qtdVirgensFinal);

      let listaVirgensFormatada: PlacaVirgemItem[] = virgens.map((p) => ({
        id: p.id,
        codigo: p.codigo,
      }));

      // Se lista individual estiver vazia mas houver saldo de lotes, gerar itens para permitir ativação em campo
      if (listaVirgensFormatada.length === 0 && qtdVirgensFinal > 0) {
        listaVirgensFormatada = Array.from({ length: qtdVirgensFinal }, (_, i) => ({
          id: `virtual-${i + 1}`,
          codigo: `GP-${String(i + 1).padStart(4, "0")}`,
        }));
      }

      setPlacasVirgensDisponiveis(listaVirgensFormatada);

      // Se a placa selecionada atual não está mais disponível, ajusta para a primeira
      if (listaVirgensFormatada.length > 0) {
        setPlacaSelecionadaId((prev) => {
          const exists = listaVirgensFormatada.some((item) => item.id === prev);
          return exists ? prev : listaVirgensFormatada[0].id;
        });
      }

      // Ordenar pelas ativações mais recentes
      const ativasOrdenadas = [...ativas].sort((a, b) => {
        const dtA = new Date(a.activated_at || a.updated_at || a.created_at || 0).getTime();
        const dtB = new Date(b.activated_at || b.updated_at || b.created_at || 0).getTime();
        return dtB - dtA;
      });

      const listaAtivasFormatada: PlacaAtivaItem[] = ativasOrdenadas.map((p) => ({
        id: p.id,
        codigo: p.codigo || "GP-0000",
        nome_empresa: p.nome_empresa || "Estabelecimento Parceiro",
        link_destino: p.link_destino || p.link_google_review || p.url_destino || "",
        link_google_review: p.link_google_review || "",
        url_destino: p.url_destino || "",
        whatsapp_feedback: p.whatsapp_feedback || "",
        status: p.status || "ativa",
        valor_venda: Number(p.valor_venda) || 80.0,
        activated_at: p.activated_at,
        updated_at: p.updated_at,
        created_at: p.created_at,
        aluno_id: p.aluno_id || currentUserId,
      }));
      setPlacasAtivas(listaAtivasFormatada);

      // Displays ativados hoje (fuso horário local)
      const ativadasHoje = ativas.filter((p) => {
        const dataRef = p.activated_at || p.created_at;
        if (!dataRef) return false;
        return isMesmoDiaLocal(dataRef);
      });

      const fatHoje = ativadasHoje.reduce((acc, curr) => {
        const val = Number(curr.valor_venda);
        return acc + (isNaN(val) ? 80.0 : val);
      }, 0);

      setFaturamentoHoje(fatHoje);
      setDisplaysVendidosHoje(ativadasHoje.length);
      setDisplaysVendidosSemana(ativas.length);

      // 3. DESPESAS DE RUA REAIS ISOLADAS DO ALUNO (Com persistência e fallback REST)
      let despesasAluno: any[] = [];
      let errDespQuery: any = null;
      try {
        const { data: dData, error: errDesp } = await supabase
          .from("despesas_rua")
          .select("*")
          .order("created_at", { ascending: false });

        errDespQuery = errDesp;
        if (!errDesp && dData && dData.length > 0) {
          despesasAluno = dData.filter(
            (d: any) => d.aluno_id === currentUserId || d.aluno_id === alunoDbId || !d.aluno_id
          );
        } else {
          // Fallback REST direto com ANON_KEY
          const resRest = await fetch(`${SUPABASE_URL}/rest/v1/despesas_rua?select=*&order=created_at.desc`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (resRest.ok) {
            const rData = await resRest.json();
            if (Array.isArray(rData)) {
              despesasAluno = rData.filter(
                (d: any) => d.aluno_id === currentUserId || d.aluno_id === alunoDbId || !d.aluno_id
              );
            }
          }
        }
      } catch (errDespesas) {
        console.error("Erro ao buscar despesas_rua do aluno:", errDespesas);
        errDespQuery = errDespesas;
      }

      // Log Obrigatório no Terminal/Console
      console.log('DEBUG GASTOS FETCH:', {
        userId: currentUser?.id,
        gastosRetornados: despesasAluno,
        erro: errDespQuery,
      });

      const isGastoHoje = (dateRef: string | Date | undefined | null) => {
        if (!dateRef) return true;
        const dt = typeof dateRef === "string" ? new Date(dateRef) : dateRef;
        if (isNaN(dt.getTime())) return true;
        const agora = new Date();
        return (
          dt.getDate() === agora.getDate() &&
          dt.getMonth() === agora.getMonth() &&
          dt.getFullYear() === agora.getFullYear()
        );
      };

      const formatadas: Despesa[] = despesasAluno.map((d: any, index: number) => {
        const dt = d.created_at ? new Date(d.created_at) : new Date();
        return {
          id: d.id ? String(d.id) : `desp-${index}`,
          categoria: (d.categoria as "transporte" | "alimentacao" | "outros") || "outros",
          valor: Number(d.valor) || 0,
          descricao: d.descricao || `Despesa de ${d.categoria || "rua"}`,
          hora: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          data: d.created_at || dt.toISOString(),
        };
      });

      setTodasDespesas(formatadas);

      // Filtrar estritamente despesas do dia local
      const apenasHoje = formatadas.filter((d) => isGastoHoje(d.data));
      setDespesasHoje(apenasHoje);
    } catch (err) {
      console.warn("Erro ao buscar dados do Supabase:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "unauthorized") {
        setAvisoNaoAutorizado("Acesso restrito: Você precisa de permissão de Administrador para acessar o painel Admin.");
      }
    }
    carregarDadosDoBanco();
  }, [carregarDadosDoBanco]);

  // Cálculos do Intervalo de Datas Selecionado (Hoje, Esta Semana, Este Mês, Personalizado)
  const { dataInicioRef, dataFimRef, labelPeriodo, tituloRitmo } = useMemo(() => {
    const agora = new Date();
    let inicio = new Date(agora);
    let fim = new Date(agora);
    let label = "";
    let titulo = "Ritmo de Hoje";

    if (tipoFiltroPeriodo === "hoje") {
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);
      const diaSemana = agora.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
      const diaNum = String(agora.getDate()).padStart(2, "0");
      const mesCurto = agora.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      label = `${diaSemanaCap}, ${diaNum} ${mesCurto}`;
      titulo = "Ritmo de Hoje";
    } else if (tipoFiltroPeriodo === "semana") {
      const diaSemana = agora.getDay();
      const diffSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
      inicio.setDate(agora.getDate() - diffSegunda);
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);
      const dInicio = String(inicio.getDate()).padStart(2, "0");
      const dFim = String(agora.getDate()).padStart(2, "0");
      const mesCurto = agora.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      label = `${dInicio} a ${dFim} ${mesCurto}`;
      titulo = "Ritmo da Semana";
    } else if (tipoFiltroPeriodo === "mes") {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);
      const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long" });
      const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
      label = `${nomeMesCap} ${agora.getFullYear()}`;
      titulo = "Ritmo do Mês";
    } else if (tipoFiltroPeriodo === "personalizado") {
      const [yIni, mIni, dIni] = (dataInicioPersonalizada || "").split("-").map(Number);
      const [yFim, mFim, dFim] = (dataFimPersonalizada || "").split("-").map(Number);
      
      if (yIni && mIni && dIni) {
        inicio = new Date(yIni, mIni - 1, dIni, 0, 0, 0, 0);
      } else {
        inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      }
      
      if (yFim && mFim && dFim) {
        fim = new Date(yFim, mFim - 1, dFim, 23, 59, 59, 999);
      } else {
        fim.setHours(23, 59, 59, 999);
      }
      const dIniStr = String(inicio.getDate()).padStart(2, "0");
      const mIniStr = String(inicio.getMonth() + 1).padStart(2, "0");
      const dFimStr = String(fim.getDate()).padStart(2, "0");
      const mFimStr = String(fim.getMonth() + 1).padStart(2, "0");
      label = `${dIniStr}/${mIniStr} - ${dFimStr}/${mFimStr}`;
      titulo = "Ritmo do Período";
    }

    return { dataInicioRef: inicio, dataFimRef: fim, labelPeriodo: label, tituloRitmo: titulo };
  }, [tipoFiltroPeriodo, dataInicioPersonalizada, dataFimPersonalizada]);

  // Displays ativados no período filtrado
  const placasAtivadasPeriodo = useMemo(() => {
    return placasAtivas.filter((p) => {
      const dataRef = p.activated_at || p.created_at;
      if (!dataRef) return false;
      const dt = new Date(dataRef);
      if (isNaN(dt.getTime())) return false;
      return dt.getTime() >= dataInicioRef.getTime() && dt.getTime() <= dataFimRef.getTime();
    });
  }, [placasAtivas, dataInicioRef, dataFimRef]);

  // Faturamento do período selecionado
  const faturamentoPeriodo = useMemo(() => {
    return placasAtivadasPeriodo.reduce((acc, curr) => {
      const val = Number(curr.valor_venda);
      return acc + (isNaN(val) ? 80.0 : val);
    }, 0);
  }, [placasAtivadasPeriodo]);

  const displaysVendidosPeriodo = placasAtivadasPeriodo.length;

  // Despesas filtradas no período selecionado
  const despesasPeriodo = useMemo(() => {
    return todasDespesas.filter((d) => {
      if (!d.data) return false;
      const dt = new Date(d.data);
      if (isNaN(dt.getTime())) return false;
      return dt.getTime() >= dataInicioRef.getTime() && dt.getTime() <= dataFimRef.getTime();
    });
  }, [todasDespesas, dataInicioRef, dataFimRef]);

  // Total de gastos no período
  const totalGastosPeriodo = useMemo(() => {
    return despesasPeriodo.reduce((acc, curr) => acc + curr.valor, 0);
  }, [despesasPeriodo]);

  // Lucro Líquido no período
  const lucroLiquidoPeriodo = faturamentoPeriodo - totalGastosPeriodo;

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
      let ativacaoSucesso = false;
      let erroMsgFinal = "";

      if (placaSelecionadaId.startsWith("virtual-")) {
        const payload = {
          codigo: codigoPlaca,
          status: "ativa",
          nome_empresa: formNomeEmpresa.trim(),
          link_google_review: formLinkGoogle.trim() || null,
          whatsapp_feedback: formWhatsappFeedback.replace(/\D/g, "") || null,
          valor_venda: valorNum,
          aluno_id: alunoId,
          activated_at: new Date().toISOString(),
        };

        const { error: errIns } = await supabase.from("placas").insert([payload]);
        if (!errIns) {
          ativacaoSucesso = true;
        } else {
          console.warn("Tentando fallback REST para inserir ativação:", errIns);
          try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/placas`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              ativacaoSucesso = true;
            } else {
              erroMsgFinal = `Erro ao ativar display: ${errIns.message}`;
            }
          } catch (restErr: any) {
            erroMsgFinal = `Erro de conexão ao ativar display: ${restErr.message || String(restErr)}`;
          }
        }
      } else {
        const payloadUpdate = {
          status: "ativa",
          nome_empresa: formNomeEmpresa.trim(),
          link_google_review: formLinkGoogle.trim() || null,
          whatsapp_feedback: formWhatsappFeedback.replace(/\D/g, "") || null,
          valor_venda: valorNum,
          activated_at: new Date().toISOString(),
        };

        const { error: errUpdate } = await supabase
          .from("placas")
          .update(payloadUpdate)
          .eq("id", placaSelecionadaId);

        if (!errUpdate) {
          ativacaoSucesso = true;
        } else {
          console.warn("Tentando fallback REST para update da placa:", errUpdate);
          try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/placas?id=eq.${placaSelecionadaId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify(payloadUpdate),
            });
            if (res.ok) {
              ativacaoSucesso = true;
            } else {
              erroMsgFinal = `Erro ao ativar display: ${errUpdate.message}`;
            }
          } catch (restErr: any) {
            erroMsgFinal = `Erro de conexão ao ativar display: ${restErr.message || String(restErr)}`;
          }
        }
      }

      if (!ativacaoSucesso) {
        console.error("Erro final ao ativar display:", erroMsgFinal);
        alert(erroMsgFinal || "Erro ao ativar display no banco de dados.");
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
    const valorNumerico = parseFloat(String(novoValor).trim().replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert("Por favor, informe um valor válido para a despesa (ex: 15,00 ou 25.50).");
      return;
    }

    setSalvandoDespesa(true);
    const desc = novaDescricao.trim() || `Despesa de ${novaCategoria}`;
    const agora = new Date();

    const { data: sessionData } = await supabase.auth.getSession();
    const activeUserId = sessionData?.session?.user?.id || alunoId || "470df2ce-d580-44d8-9282-fe95161b21d1";

    const payloadDespesa = {
      aluno_id: activeUserId,
      categoria: novaCategoria || "outros",
      valor: valorNumerico,
      descricao: desc,
      created_at: agora.toISOString(),
    };

    let insercaoSucesso = false;
    let errFinal: any = null;

    try {
      const { data: inserido, error } = await supabase
        .from("despesas_rua")
        .insert([payloadDespesa])
        .select()
        .maybeSingle();

      if (!error && inserido) {
        insercaoSucesso = true;
      } else {
        if (error) errFinal = error;
        // Fallback REST direto com ANON_KEY
        const resRest = await fetch(`${SUPABASE_URL}/rest/v1/despesas_rua`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(payloadDespesa),
        });
        if (resRest.ok) {
          insercaoSucesso = true;
        } else {
          const errBody = await resRest.text();
          errFinal = new Error(`Falha HTTP ${resRest.status}: ${errBody}`);
        }
      }
    } catch (err) {
      console.error("ERRO AO SALVAR GASTO:", err);
      errFinal = err;
    }

    if (!insercaoSucesso) {
      console.error("ERRO AO SALVAR GASTO:", errFinal);
      alert("Erro ao registrar gasto: " + (errFinal?.message || "Erro desconhecido"));
      setSalvandoDespesa(false);
      return;
    }

    console.log("Gasto enviado com sucesso:", { valorNumerico, categoria: novaCategoria, descricao: desc });

    // Imediatamente após o insert bem-sucedido:
    // * Fechar o modal
    // * Limpar os campos do formulário
    setNovoValor("");
    setNovaDescricao("");
    setNovaCategoria("transporte");
    setSalvandoDespesa(false);
    setModalDespesaAberto(false);

    // * Reexecutar busca completa para recalcular a soma na tela
    await carregarDadosDoBanco();
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

  // 4. ABRIR E SALVAR EDIÇÃO DE LINK DE DESTINO DA PLACA
  const handleAbrirEditarLink = (placa: PlacaAtivaItem) => {
    setPlacaEditando(placa);
    setNovoLinkDestino(placa.link_destino || placa.link_google_review || placa.url_destino || "");
    setModalEditarLinkAberto(true);
  };

  const handleSalvarNovoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placaEditando) return;

    setSalvandoLink(true);
    const linkFormatado = novoLinkDestino.trim();

    try {
      // 1. UPDATE no Supabase unicamente na coluna link_destino (SEM updated_at)
      const { error: errUpdate } = await supabase
        .from("placas")
        .update({
          link_destino: linkFormatado,
        })
        .eq("id", placaEditando.id);

      if (errUpdate) {
        console.warn("Aviso update link_destino, tentando fallback link_google_review:", errUpdate.message);
        const { error: errReview } = await supabase
          .from("placas")
          .update({
            link_google_review: linkFormatado,
          })
          .eq("id", placaEditando.id);

        if (errReview) {
          console.error("Erro ao salvar novo link:", errReview);
        }
      }

      // 2. Atualiza o estado da lista localmente na hora sem reload
      setPlacasAtivas((prev) =>
        prev.map((item) =>
          item.id === placaEditando.id
            ? {
                ...item,
                link_destino: linkFormatado,
                link_google_review: linkFormatado,
                url_destino: linkFormatado,
              }
            : item
        )
      );

      // 3. Dispara feedback visual (toast / banner de sucesso) e fecha o modal
      setAvisoSucessoLink(`Link de destino da placa ${placaEditando.codigo} atualizado com sucesso!`);
      setModalEditarLinkAberto(false);
      setPlacaEditando(null);
    } catch (err) {
      console.error("Erro inesperado ao salvar link:", err);
      alert("Ocorreu um erro ao salvar o link.");
    } finally {
      setSalvandoLink(false);
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Erro ao deslogar:", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans pb-28 pt-4 px-4 sm:px-6 max-w-lg mx-auto selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      {/* Top Header Mobile */}
      <header className="flex items-center justify-between py-3 mb-5 border-b border-zinc-200 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">TAGPLAK</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2 mt-0.5">
            Meu Dashboard <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 inline" />
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-neutral-400">
            Parceiro: <span className="font-semibold text-zinc-800 dark:text-neutral-200">{alunoNome}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMasterAdmin && (
            <button
              onClick={() => router.push("/admin")}
              title="Acessar Painel Administrador Master"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-500/30 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Painel Admin</span>
            </button>
          )}
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
          <button
            onClick={handleLogout}
            title="Sair da Conta (Logout)"
            aria-label="Sair da Conta"
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Alerta de Acesso Não Autorizado */}
      {avisoNaoAutorizado && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{avisoNaoAutorizado}</span>
          </div>
          <button
            onClick={() => setAvisoNaoAutorizado(null)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerta de Erro de Consulta ao Banco (Supabase) */}
      {erroQuerySupabase && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium">{erroQuerySupabase}</span>
          </div>
          <button
            onClick={() => setErroQuerySupabase(null)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Alerta de Sucesso de Edição de Link de Placa */}
      {avisoSucessoLink && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{avisoSucessoLink}</span>
          </div>
          <button
            onClick={() => setAvisoSucessoLink(null)}
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

      <div>
        {/* ========================================================
            SESSÃO 1: PERFORMANCE DO DIA
            ======================================================== */}
        <div className="space-y-3">
          {/* BANNER COMPACTO: TOP DISPLAY (TOPO EM LINHA ÚNICA / PILL) */}
          {(() => {
            const agora = new Date();
            const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
            const diasRestantesMes = Math.max(1, ultimoDiaMes - agora.getDate());

            return (
              <section className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 rounded-xl py-1.5 px-3 sm:px-3.5 flex items-center justify-between gap-2 text-xs sm:text-sm shadow-xs transition-colors">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="text-sm leading-none shrink-0">🏆</span>
                  <span className="text-xs text-amber-900 dark:text-amber-300 truncate">
                    <strong className="uppercase font-bold text-amber-800 dark:text-amber-400">TOP DISPLAY:</strong>{" "}
                    {rankingLiderDisplays === 0 ? (
                      <span className="font-normal text-zinc-600 dark:text-neutral-400">Sem pedidos no mês</span>
                    ) : isAlunoLider ? (
                      <span className="font-semibold text-amber-900 dark:text-amber-200">Você lidera com {rankingAlunoDisplays} displays!</span>
                    ) : (
                      <span className="font-medium text-zinc-700 dark:text-neutral-300">
                        Líder {rankingLiderNome} ({rankingLiderDisplays} displays)
                      </span>
                    )}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg font-mono">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">+10 grátis</span>
                  <span className="text-amber-600/60 dark:text-amber-400/60">•</span>
                  <span>{diasRestantesMes} {diasRestantesMes === 1 ? "dia" : "dias"}</span>
                </div>
              </section>
            );
          })()}

          {/* CARD PRINCIPAL: RITMO COM FILTRO TEMPORAL */}
          <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl backdrop-blur-sm transition-colors">
            {/* Header com Título, Indicador de Período e Filtros Rápidos (Segmented Control) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              {/* Linha de Título e Data */}
              <div className="flex items-center gap-2 shrink-0">
                <h2 className="text-xs uppercase font-bold tracking-wider text-zinc-600 dark:text-neutral-400 flex items-center gap-1.5 whitespace-nowrap">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> DESEMPENHO
                </h2>
                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium whitespace-nowrap font-mono">
                  {labelPeriodo}
                </span>
              </div>

              {/* Barra de Filtros (Segmented Control em Cápsula Única) */}
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-1 rounded-xl flex items-center gap-1 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setTipoFiltroPeriodo("hoje")}
                  className={`flex-1 sm:flex-initial text-xs px-3 py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    tipoFiltroPeriodo === "hoje"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltroPeriodo("semana")}
                  className={`flex-1 sm:flex-initial text-xs px-3 py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    tipoFiltroPeriodo === "semana"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFiltroPeriodo("mes")}
                  className={`flex-1 sm:flex-initial text-xs px-3 py-1.5 rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    tipoFiltroPeriodo === "mes"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
                  }`}
                >
                  Este Mês
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Faturamento do Período */}
              <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3.5">
                <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Faturamento
                </span>
                <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
                  R$ {faturamentoPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-zinc-500 dark:text-neutral-400">
                  {displaysVendidosPeriodo} {displaysVendidosPeriodo === 1 ? "ativado" : "ativados"} {tipoFiltroPeriodo === "hoje" ? "hoje" : "no período"}
                </span>
              </div>

              {/* Gastos de Rua do Período */}
              <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-rose-500/20 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> Gastos de Rua
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalDespesaAberto(true)}
                    className="text-[10px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md transition active:scale-95 cursor-pointer"
                    title="Lançar gasto de rua"
                  >
                    + Add Gastos
                  </button>
                </div>
                <div>
                  <p className="text-lg font-semibold text-rose-500 dark:text-rose-400 font-mono mt-1">
                    - R$ {totalGastosPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <span className="text-[10px] text-zinc-500 dark:text-neutral-400">
                    {despesasPeriodo.length} {despesasPeriodo.length === 1 ? "lançamento" : "lançamentos"}
                  </span>
                </div>
              </div>
            </div>

            {/* Lucro Líquido do Período em Destaque */}
            <div className="bg-gradient-to-r from-emerald-500/10 dark:from-emerald-950/50 to-emerald-500/5 dark:to-neutral-950 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {tipoFiltroPeriodo === "hoje" ? "LUCRO LÍQUIDO HOJE" : "LUCRO LÍQUIDO NO PERÍODO"}
                </span>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  R$ {lucroLiquidoPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-11 h-11 rounded-full bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </section>
        </div>

        {/* ========================================================
            SESSÃO 2: ESTOQUE & META (BLOCO CONJUNTO)
            ======================================================== */}
        <div className="mt-7">
          <button
            type="button"
            onClick={() => setSecaoEstoqueMetaAberta(!secaoEstoqueMetaAberta)}
            className="w-full flex items-center justify-between px-1 mb-2.5 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 hover:opacity-80 transition cursor-pointer select-none"
          >
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4" /> ESTOQUE & META
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-normal lowercase text-zinc-400 dark:text-neutral-500">
                {secaoEstoqueMetaAberta ? "recolher" : "expandir"}
              </span>
              {secaoEstoqueMetaAberta ? (
                <ChevronUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              )}
            </div>
          </button>

          {secaoEstoqueMetaAberta && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* ESTOQUE DE DISPLAYS */}
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400">
                    Inventário de Campo
                  </span>
                  <button
                    onClick={() => setModalSolicitarAberto(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Solicitar Displays (+)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-xs text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Displays Virgens
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-zinc-900 dark:text-white">{displaysVirgens}</span>
                      <span className="text-xs text-zinc-500 dark:text-neutral-400">em estoque</span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
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

              {/* PROGRESSO DA SEMANA */}
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Progresso da Semana
                  </h3>
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
            </div>
          )}
        </div>

        {/* ========================================================
            SESSÃO 3: MINHAS PLACAS ATIVAS (BLOCO INDIVIDUAL)
            ======================================================== */}
        <div className="mt-7">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <button
              type="button"
              onClick={() => setSecaoPlacasAtivasAberta(!secaoPlacasAtivasAberta)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition cursor-pointer select-none"
            >
              <span>📍</span> MINHAS PLACAS ATIVAS
              {secaoPlacasAtivasAberta ? (
                <ChevronUp className="w-4 h-4 ml-0.5" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <span className="text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {placasAtivas.length} {placasAtivas.length === 1 ? "ativada" : "ativadas"}
            </span>
          </div>

          {secaoPlacasAtivasAberta && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors">
                {placasAtivas.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-neutral-400">
                      Nenhuma placa ativada em campo ainda.
                    </p>
                    <p className="text-[11px] text-zinc-400 dark:text-neutral-500">
                      Clique no botão <strong className="text-emerald-600 dark:text-emerald-400">+</strong> flutuante para ativar seu primeiro display!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {placasAtivas.map((placa) => {
                      const rawLink = (placa.link_destino || placa.link_google_review || placa.url_destino || "").trim();
                      const linkExibicao = rawLink ? rawLink.replace(/^https?:\/\//i, "") : "Nenhum link configurado";
                      const linkHref = rawLink
                        ? rawLink.startsWith("http://") || rawLink.startsWith("https://")
                          ? rawLink
                          : `https://${rawLink}`
                        : "#";
                      const dtAtivacao = placa.activated_at || placa.updated_at || placa.created_at;
                      const dataFormatada = dtAtivacao
                        ? new Date(dtAtivacao).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "Recente";

                      return (
                        <div
                          key={placa.id}
                          className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800/80 rounded-2xl p-3.5 space-y-2.5 text-xs transition hover:border-zinc-300 dark:hover:border-neutral-700"
                        >
                          {/* Topo do Card: Código com badge verde + Data */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                                {placa.codigo}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativa
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500 dark:text-neutral-400 font-mono">
                              {dataFormatada}
                            </span>
                          </div>

                          {/* Nome do Cliente / Estabelecimento */}
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="font-semibold text-zinc-800 dark:text-neutral-200 truncate">
                              {placa.nome_empresa || "Estabelecimento Parceiro"}
                            </span>
                          </div>

                          {/* URL Atual Truncada + Link Testar + Botão Editar Link */}
                          <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 max-w-[62%]">
                              <Link2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              {rawLink ? (
                                <a
                                  href={linkHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline truncate inline-flex items-center gap-1"
                                  title={`Abrir destino: ${rawLink}`}
                                >
                                  <span className="truncate">{linkExibicao}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-[11px] text-zinc-400 italic">Sem link</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAbrirEditarLink(placa)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-700 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-neutral-900 text-zinc-700 dark:text-zinc-200 transition active:scale-95 cursor-pointer shrink-0 shadow-sm flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar Link</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* ========================================================
            SESSÃO 4: HISTÓRICO DE GASTOS (BLOCO INDIVIDUAL)
            ======================================================== */}
        <div className="mt-7">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <button
              type="button"
              onClick={() => setSecaoGastosDiaAberta(!secaoGastosDiaAberta)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:opacity-80 transition cursor-pointer select-none"
            >
              <Clock className="w-4 h-4" /> HISTÓRICO DE GASTOS
              {secaoGastosDiaAberta ? (
                <ChevronUp className="w-4 h-4 ml-0.5" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <span className="text-[11px] font-mono font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
              {despesasPeriodo.length} {despesasPeriodo.length === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>

          {secaoGastosDiaAberta && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* LISTAGEM: GASTOS DO DIA / PERÍODO COM CROMATISMO ROSE / VINHO */}
              <section className="bg-white dark:bg-neutral-900/90 border border-rose-500/40 dark:border-rose-900/60 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> {tipoFiltroPeriodo === "hoje" ? "Gastos do Dia" : "Gastos do Período"}
                    </span>
                    <span className="text-xs text-rose-500/80 dark:text-rose-400/80 font-mono">
                      (- R$ {totalGastosPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalDespesaAberto(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-500/10 dark:bg-rose-950/40 hover:bg-rose-500/20 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-500/30 dark:border-rose-800/60 px-2.5 py-1 rounded-xl transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                    <span>+ Add Gastos</span>
                  </button>
                </div>

                {despesasPeriodo.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-neutral-500 py-3 text-center">Nenhum gasto registrado neste período.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {despesasPeriodo.map((d) => {
                      const dt = d.data ? new Date(d.data) : null;
                      const dataFormatada = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between bg-zinc-50 dark:bg-neutral-950/70 border border-rose-500/20 dark:border-rose-900/40 p-2.5 rounded-2xl text-xs hover:border-rose-500/40 transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base shrink-0">
                              {d.categoria === "transporte" ? "🚗" : d.categoria === "alimentacao" ? "🍔" : "🔧"}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-800 dark:text-neutral-200 capitalize">{d.descricao}</span>
                              <span className="text-[11px] text-zinc-500 dark:text-neutral-400 capitalize">
                                {d.categoria} • {tipoFiltroPeriodo === "hoje" ? d.hora : `${dataFormatada ? dataFormatada + " às " : ""}${d.hora}`}
                              </span>
                            </div>
                          </div>
                          <span className="font-semibold font-mono text-rose-500 dark:text-rose-400">
                            - R$ {d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* ========================================================
            SESSÃO 5: MEUS PEDIDOS (BLOCO INDIVIDUAL)
            ======================================================== */}
        <div className="mt-7">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <button
              type="button"
              onClick={() => setSecaoMeusPedidosAberta(!secaoMeusPedidosAberta)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 hover:opacity-80 transition cursor-pointer select-none"
            >
              <Truck className="w-4 h-4" /> MEUS PEDIDOS
              {secaoMeusPedidosAberta ? (
                <ChevronUp className="w-4 h-4 ml-0.5" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <span className="text-[11px] font-mono font-medium bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
              {pedidosAluno.length} {pedidosAluno.length === 1 ? "solicitação" : "solicitações"}
            </span>
          </div>

          {secaoMeusPedidosAberta && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors">
                {pedidosAluno.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-400 dark:text-neutral-500">
                    Você ainda não realizou pedidos de displays.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
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
                          className="bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800/80 rounded-2xl p-3.5 space-y-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900 dark:text-white text-sm">{ped.quantidade} displays</span>
                              <span className="text-[11px] text-zinc-500 dark:text-neutral-400">
                                • {dt.toLocaleDateString("pt-BR")}
                              </span>
                              {ped.observacao && (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                  {ped.observacao}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusStyle}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Código de Rastreio se houver */}
                          {rastreioTrim ? (
                            <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800/80 flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/30 p-2.5 rounded-xl">
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
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
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
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 dark:bg-violet-500/20 dark:hover:bg-violet-500/30 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-lg border border-violet-500/30 transition cursor-pointer"
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
          )}
        </div>
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
                  Selecione a Categoria
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovaCategoria("transporte")}
                    className={`text-xs py-2.5 px-2 rounded-xl font-semibold border transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      novaCategoria === "transporte"
                        ? "bg-rose-500 text-white border-rose-400 shadow-md ring-2 ring-rose-500/30"
                        : "bg-zinc-50 dark:bg-neutral-950 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="text-base">🚗</span>
                    <span className="truncate text-[11px]">Transporte</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovaCategoria("alimentacao")}
                    className={`text-xs py-2.5 px-2 rounded-xl font-semibold border transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      novaCategoria === "alimentacao"
                        ? "bg-rose-500 text-white border-rose-400 shadow-md ring-2 ring-rose-500/30"
                        : "bg-zinc-50 dark:bg-neutral-950 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="text-base">🍔</span>
                    <span className="truncate text-[11px]">Alimentação</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovaCategoria("outros")}
                    className={`text-xs py-2.5 px-2 rounded-xl font-semibold border transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      novaCategoria === "outros"
                        ? "bg-rose-500 text-white border-rose-400 shadow-md ring-2 ring-rose-500/30"
                        : "bg-zinc-50 dark:bg-neutral-950 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="text-base">🔧</span>
                    <span className="truncate text-[11px]">Outros</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="Ex: 25,00 ou 15.50"
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
                  placeholder="Ex: Uber, Gasolina, Almoço, Estacionamento..."
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

      {/* MODAL 4: EDITAR LINK DE DESTINO DA PLACA */}
      {modalEditarLinkAberto && placaEditando && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Atualizar Destino da Placa {placaEditando.codigo}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-neutral-400">
                    Altere a URL de redirecionamento do QR Code / NFC
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalEditarLinkAberto(false);
                  setPlacaEditando(null);
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoLink} className="space-y-4">
              {/* Nome do Estabelecimento (Informativo / Leitura) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-zinc-400" /> Estabelecimento / Cliente
                </label>
                <div className="w-full bg-zinc-100 dark:bg-neutral-950/80 border border-zinc-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-neutral-200 cursor-not-allowed">
                  {placaEditando.nome_empresa || "Estabelecimento Parceiro"}
                </div>
              </div>

              {/* Input da Nova URL */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-zinc-400" /> URL de Destino (Google Review / Link) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="Ex: https://maps.app.goo.gl/... ou https://g.page/r/..."
                  value={novoLinkDestino}
                  onChange={(e) => setNovoLinkDestino(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 transition"
                  autoFocus
                />
                <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-1">
                  Insira o link oficial de avaliação do Google Meu Negócio ou endereço web.
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalEditarLinkAberto(false);
                    setPlacaEditando(null);
                  }}
                  className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoLink}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {salvandoLink ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </span>
                  ) : (
                    <span>Salvar Novo Link</span>
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


