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
  Crown,
  ArrowRight,
  ArrowLeft,
  Building,
  Navigation,
  Paperclip,
  Upload,
  FileText,
  Trash2,
  Bell,
  PlusCircle,
  Search
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  ponto_referencia?: string;
}

export type TipoKit = "start" | "pro" | "master";
export type ModeloCor = "misto" | "preta" | "azul";

export interface KitItem {
  id: TipoKit;
  nome: string;
  qtd: number;
  preco: number;
  badge: string;
  badgeCor: string;
  desc: string;
  permiteEscolhaCor: boolean;
  potencialVenda: number;
}

export const KITS_CATALOGO: Record<TipoKit, KitItem> = {
  start: {
    id: "start",
    nome: "Kit Start",
    qtd: 10,
    preco: 170.0,
    badge: "Padrão Lançamento",
    badgeCor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    desc: "Padrão de Turma: 5 Pretas e 5 Azuis",
    permiteEscolhaCor: false,
    potencialVenda: 800.0,
  },
  pro: {
    id: "pro",
    nome: "Kit Pro",
    qtd: 30,
    preco: 540.0,
    badge: "Mais Vendido",
    badgeCor: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-xs",
    desc: "Ideal para alta tração e velocidade em campo",
    permiteEscolhaCor: true,
    potencialVenda: 2400.0,
  },
  master: {
    id: "master",
    nome: "Kit Master",
    qtd: 50,
    preco: 850.0,
    badge: "Escala",
    badgeCor: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
    desc: "Máximo faturamento e menor custo por unidade",
    permiteEscolhaCor: true,
    potencialVenda: 4000.0,
  },
};

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
  valor_total?: number;
  modelo_cor?: string;
  codigo_rastreio?: string;
  transportadora?: string;
  aprovado_em?: string;
  enviado_em?: string;
  entregue_em?: string;
  codigo_inicio?: string;
  codigo_fim?: string;
  observacao?: string;
  motivo_recusa?: string;
  comprovante_url?: string;
  created_at: string;
}

interface PlacaVirgemItem {
  id: string;
  codigo: string;
}

export interface ServicoAdicionalItem {
  id: string;
  descricao: string;
  valor: number | string;
  tipo_cobranca: "unico" | "recorrente";
}

export interface PlacaAtivaItem {
  id: string;
  codigo: string;
  nome_empresa?: string;
  link_destino?: string;
  link_google_review?: string;
  url_destino?: string;
  whatsapp_feedback?: string;
  status: string;
  valor_venda?: number;
  responsavel_nome?: string;
  whatsapp_contato?: string;
  outras_vendas?: any;
  servicos_adicionais?: ServicoAdicionalItem[];
  activated_at?: string;
  data_ativacao?: string;
  updated_at?: string;
  created_at?: string;
  aluno_id?: string;
}

// Helper para calcular o Faturamento Total Real (Display + Múltiplos Serviços Adicionais)
export function calcularFaturamentoTotalPlaca(placa: {
  valor_venda?: number;
  outras_vendas?: any;
  servicos_adicionais?: ServicoAdicionalItem[] | any;
  nome_empresa?: string;
}): number {
  const valorDisplay = Number(placa.valor_venda) || (placa.valor_venda === 0 ? 0 : 80.0);
  let valorServicos = 0;

  // 1. Caso a lista dinâmica servicos_adicionais exista como Array
  if (Array.isArray(placa.servicos_adicionais) && placa.servicos_adicionais.length > 0) {
    placa.servicos_adicionais.forEach((s: any) => {
      const v = typeof s?.valor === "number" ? s.valor : parseFloat(String(s?.valor || "0").replace(",", "."));
      if (!isNaN(v) && v > 0) {
        valorServicos += v;
      }
    });
  }

  // 2. Caso o objeto estruturado outras_vendas exista (seja array ou objeto único)
  if (valorServicos === 0 && placa.outras_vendas) {
    if (Array.isArray(placa.outras_vendas)) {
      placa.outras_vendas.forEach((s: any) => {
        const v = typeof s?.valor === "number" ? s.valor : parseFloat(String(s?.valor || "0").replace(",", "."));
        if (!isNaN(v) && v > 0) {
          valorServicos += v;
        }
      });
    } else if (typeof placa.outras_vendas === "object") {
      const valObj = Number(placa.outras_vendas.valor);
      if (!isNaN(valObj) && valObj > 0) {
        valorServicos += valObj;
      }
    }
  }

  // 3. Extração caso os serviços estejam formatados na string nome_empresa (ex: [Serviço: Otimização R$ 150 (Único) | Serviço: Fotos R$ 200 (Único)])
  if (valorServicos === 0 && placa.nome_empresa && placa.nome_empresa.includes("[") && placa.nome_empresa.includes("]")) {
    const matches = placa.nome_empresa.matchAll(/Servi[çc]o:[^R]*R\$\s*([\d.,]+)/gi);
    for (const match of matches) {
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(parsed) && parsed > 0) {
          valorServicos += parsed;
        }
      }
    }
  }

  return valorDisplay + valorServicos;
}

export type TipoFiltroPeriodo = "hoje" | "semana" | "mes" | "personalizado";

export default function DashboardAluno() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Informações do Aluno
  const [alunoId, setAlunoId] = useState<string>("00000000-0000-0000-0000-000000000001");
  const [alunoNome, setAlunoNome] = useState<string>("GOPlak");

  // Métricas Principais
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [precoPorDisplay, setPrecoPorDisplay] = useState(80.0);
  const [displaysVirgens, setDisplaysVirgens] = useState(0);
  const [displaysVendidosHoje, setDisplaysVendidosHoje] = useState(0);
  const [displaysVendidosSemana, setDisplaysVendidosSemana] = useState(0);
  const [metaSemanalDisplays, setMetaSemanalDisplays] = useState(20);

  // Modal de Edição de Meta Semanal
  const [modalEditarMetaAberto, setModalEditarMetaAberto] = useState(false);
  const [inputMetaSemanal, setInputMetaSemanal] = useState("20");
  const [inputPrecoDisplay, setInputPrecoDisplay] = useState("80,00");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

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

  // Modal 3: Solicitar Novo Lote (Etapa 1: Endereço, Etapa 2: Catálogo e Cores, Etapa 3: Pagamento & Comprovante)
  const [modalSolicitarAberto, setModalSolicitarAberto] = useState(false);
  const [etapaSolicitacao, setEtapaSolicitacao] = useState<1 | 2 | 3>(1);
  const [enderecoSalvo, setEnderecoSalvo] = useState<EnderecoEntrega | null>(null);
  const [editandoEndereco, setEditandoEndereco] = useState(false);

  // Campos do Formulário de Endereço
  const [cepInput, setCepInput] = useState("");
  const [logradouroInput, setLogradouroInput] = useState("");
  const [numeroInput, setNumeroInput] = useState("");
  const [complementoInput, setComplementoInput] = useState("");
  const [bairroInput, setBairroInput] = useState("");
  const [cidadeInput, setCidadeInput] = useState("");
  const [estadoInput, setEstadoInput] = useState("");
  const [pontoReferenciaInput, setPontoReferenciaInput] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroEndereco, setErroEndereco] = useState<string | null>(null);

  // Seleções do Catálogo de Kits e Opções de Cores
  const [kitSelecionado, setKitSelecionado] = useState<TipoKit>("pro");
  const [corKitPro, setCorKitPro] = useState<ModeloCor>("misto");
  const [corKitMaster, setCorKitMaster] = useState<ModeloCor>("misto");
  const [solicitandoDisplays, setSolicitandoDisplays] = useState(false);
  const [avisoSucessoPedido, setAvisoSucessoPedido] = useState<string | null>(null);

  // Etapa 3: Pagamento e Upload de Comprovante
  const [arquivoComprovante, setArquivoComprovante] = useState<File | null>(null);
  const [nomeArquivoComprovante, setNomeArquivoComprovante] = useState<string>("");
  const [previewComprovante, setPreviewComprovante] = useState<string | null>(null);
  const [copiouChavePix, setCopiouChavePix] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);

  // Histórico de Pedidos de Displays do Aluno
  const [pedidosAluno, setPedidosAluno] = useState<PedidoDisplay[]>([]);
  const setPedidos = setPedidosAluno;
  const [abaPedidos, setAbaPedidos] = useState<"andamento" | "concluidos">("andamento");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [pedidoRecemCriadoId, setPedidoRecemCriadoId] = useState<string | null>(null);
  const [destacarNovoPedido, setDestacarNovoPedido] = useState<boolean>(false);

  // Separação reativa de pedidos em andamento vs concluídos
  const pedidosEmAndamento = useMemo(() => {
    return pedidosAluno.filter((p) => {
      const st = (p.status || "").toLowerCase().trim();
      return st !== "entregue" && st !== "concluido";
    });
  }, [pedidosAluno]);

  const pedidosConcluidos = useMemo(() => {
    return pedidosAluno.filter((p) => {
      const st = (p.status || "").toLowerCase().trim();
      return st === "entregue" || st === "concluido";
    });
  }, [pedidosAluno]);

  // Placas Ativas do Aluno & Controles de Busca, Filtro por Mês e Paginação
  const [placasAtivas, setPlacasAtivas] = useState<PlacaAtivaItem[]>([]);
  const [buscaPlacasAtivas, setBuscaPlacasAtivas] = useState<string>("");
  const [filtroMesPlacasAtivas, setFiltroMesPlacasAtivas] = useState<string>("todos");
  const [paginaPlacasAtivas, setPaginaPlacasAtivas] = useState<number>(1);
  const ITENS_POR_PAGINA_PLACAS = 2; // Definido temporariamente como 2 para testes conforme solicitado

  // Modal 4: Editar Dados Completos da Placa
  const [modalEditarLinkAberto, setModalEditarLinkAberto] = useState(false);
  const [placaEditando, setPlacaEditando] = useState<PlacaAtivaItem | null>(null);
  const [editNomeLojaAluno, setEditNomeLojaAluno] = useState("");
  const [editResponsavelAluno, setEditResponsavelAluno] = useState("");
  const [editWhatsappAluno, setEditWhatsappAluno] = useState("");
  const [novoLinkDestino, setNovoLinkDestino] = useState("");
  const [editValorDisplayAluno, setEditValorDisplayAluno] = useState("80.00");
  const [editServicosAluno, setEditServicosAluno] = useState<ServicoAdicionalItem[]>([]);
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
  const [toastHovered, setToastHovered] = useState<boolean>(false);

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
          .select("*");

        let encontrouAluno = false;
        if (todosAlunos && todosAlunos.length > 0) {
          todosAlunos.forEach((a: any) => {
            if (a.id) alunosMap[a.id] = a.nome;
            if (a.id === currentUserId || (a.email && a.email.toLowerCase() === currentUserEmail)) {
              alunoDbId = a.id;
              if (a.nome) {
                setAlunoNome(a.nome);
              }
              if (a.cep || a.logradouro || a.cidade) {
                const endCarregado: EnderecoEntrega = {
                  cep: a.cep || "",
                  logradouro: a.logradouro || "",
                  numero: a.numero || "",
                  complemento: a.complemento || "",
                  bairro: a.bairro || "",
                  cidade: a.cidade || "",
                  estado: a.estado || "",
                  ponto_referencia: a.ponto_referencia || "",
                };
                setEnderecoSalvo(endCarregado);
                setCepInput(endCarregado.cep);
                setLogradouroInput(endCarregado.logradouro);
                setNumeroInput(endCarregado.numero);
                setComplementoInput(endCarregado.complemento || "");
                setBairroInput(endCarregado.bairro);
                setCidadeInput(endCarregado.cidade);
                setEstadoInput(endCarregado.estado);
                setPontoReferenciaInput(endCarregado.ponto_referencia || "");
                setEditandoEndereco(false);
              }
              if (a.meta_semanal_displays !== undefined && a.meta_semanal_displays !== null) {
                const parsedMeta = Number(a.meta_semanal_displays);
                if (!isNaN(parsedMeta) && parsedMeta > 0) {
                  setMetaSemanalDisplays(parsedMeta);
                  setInputMetaSemanal(String(parsedMeta));
                }
              }
              if (a.preco_padrao_display !== undefined && a.preco_padrao_display !== null) {
                const parsedPreco = Number(a.preco_padrao_display);
                if (!isNaN(parsedPreco) && parsedPreco > 0) {
                  setPrecoPorDisplay(parsedPreco);
                  setInputPrecoDisplay(parsedPreco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }
              }
              encontrouAluno = true;
            }
          });
        }

        // Se não veio do banco, tentar recuperar meta e endereço do localStorage ou metadata
        if (typeof window !== "undefined") {
          try {
            // Recuperar Meta e Preço se ainda nos valores padrão
            const cacheMeta = localStorage.getItem("goplak_meta_semanal") || localStorage.getItem("tagplak_meta_semanal");
            const metaMeta = currentUser.user_metadata?.meta_semanal_displays;
            const metaFinal = Number(metaMeta || cacheMeta);
            if (!isNaN(metaFinal) && metaFinal > 0) {
              setMetaSemanalDisplays(metaFinal);
              setInputMetaSemanal(String(metaFinal));
            }

            const cachePreco = localStorage.getItem("goplak_preco_display") || localStorage.getItem("tagplak_preco_display");
            const metaPreco = currentUser.user_metadata?.preco_por_display || currentUser.user_metadata?.preco_padrao_display;
            const precoFinal = Number(metaPreco || cachePreco);
            if (!isNaN(precoFinal) && precoFinal > 0) {
              setPrecoPorDisplay(precoFinal);
              setInputPrecoDisplay(precoFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            }

            const cacheEnd = localStorage.getItem("goplak_aluno_endereco") || localStorage.getItem("tagplak_aluno_endereco");
            const metaEnd = currentUser.user_metadata?.endereco;
            const endFallback = cacheEnd ? JSON.parse(cacheEnd) : metaEnd;
            if (endFallback && endFallback.logradouro) {
              setEnderecoSalvo((prev) => prev || endFallback);
              setCepInput((prev) => prev || endFallback.cep || "");
              setLogradouroInput((prev) => prev || endFallback.logradouro || "");
              setNumeroInput((prev) => prev || endFallback.numero || "");
              setComplementoInput((prev) => prev || endFallback.complemento || "");
              setBairroInput((prev) => prev || endFallback.bairro || "");
              setCidadeInput((prev) => prev || endFallback.cidade || "");
              setEstadoInput((prev) => prev || endFallback.estado || "");
              setPontoReferenciaInput((prev) => prev || endFallback.ponto_referencia || "");
            }
          } catch (eCache) {}
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
        responsavel_nome: p.responsavel_nome,
        whatsapp_contato: p.whatsapp_contato,
        outras_vendas: p.outras_vendas,
        activated_at: p.activated_at,
        data_ativacao: p.data_ativacao,
        updated_at: p.updated_at,
        created_at: p.created_at,
        aluno_id: p.aluno_id || currentUserId,
      }));
      setPlacasAtivas(listaAtivasFormatada);

      // Displays ativados hoje (fuso horário local)
      const ativadasHoje = ativas.filter((p) => {
        const dataRef = p.data_ativacao || p.activated_at || p.created_at;
        if (!dataRef) return false;
        return isMesmoDiaLocal(dataRef);
      });

      const fatHoje = ativadasHoje.reduce((acc, curr) => {
        return acc + calcularFaturamentoTotalPlaca(curr);
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

    // Sincronização em Tempo Real (Supabase Realtime) para o Aluno
    const channel = supabase
      .channel("aluno_pedidos_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos_lotes" },
        (payload) => {
          console.log("[Realtime Aluno] Pedido atualizado:", payload);
          const pNew = payload.new;
          if (!pNew) return;

          // 1. Atualização instantânea do estado local (sem necessidade de F5)
          setPedidosAluno((prev) =>
            prev.map((p) => (p.id === pNew.id ? { ...p, ...pNew } : p))
          );

          const isMeuPedido =
            pNew?.aluno_id === alunoId ||
            pNew?.user_id === alunoId ||
            (alunoId && pNew?.aluno_id && String(pNew.aluno_id).toLowerCase() === String(alunoId).toLowerCase());

          if (isMeuPedido) {
            const stLower = (pNew?.status || "").toLowerCase().trim();
            // Notificação comemorativa se o pedido foi aprovado (100% silencioso)
            if (stLower === "em_producao" || stLower === "em produção" || stLower === "aprovado") {
              confetti({
                particleCount: 130,
                spread: 70,
                origin: { y: 0.6 },
              });

              setAvisoSucessoPedido(
                `🎉 Seu pedido de ${pNew.quantidade} displays foi aprovado e entrou em produção!`
              );
            } else if (stLower === "enviado") {
              setAvisoSucessoPedido(
                `🚚 Seu pedido de ${pNew.quantidade} displays foi enviado via ${pNew.transportadora || "Correios"}! Acompanhe o rastreio abaixo.`
              );
            } else if (stLower === "entregue" || stLower === "concluido") {
              confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
              });

              setAvisoSucessoPedido(
                `📦 Seu lote de displays foi marcado como ENTREGUE! Seus displays virgens foram liberados no estoque para ativação.`
              );
            } else if (stLower === "recusado" || stLower === "rejeitado") {
              setAvisoSucessoPedido(
                `⚠️ Seu pedido foi marcado como Recusado. Motivo: ${pNew.motivo_recusa || "Comprovante divergente"}`
              );
            }
          }

          // Atualizar dados em segundo plano
          carregarDadosDoBanco();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos_lotes" },
        (payload) => {
          const pNew = payload.new as PedidoDisplay;
          if (pNew && pNew.id) {
            setPedidosAluno((prev) => [pNew, ...prev.filter((p) => p.id !== pNew.id)]);
          }
          carregarDadosDoBanco();
        }
      )
      // Escuta reativa instantânea de ativações e edições de placas (Sem F5)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "placas" },
        (payload) => {
          console.log("[Realtime Aluno] Placa alterada/ativada:", payload);
          carregarDadosDoBanco();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarDadosDoBanco, alunoId]);

  // Auto-dismiss de 60 segundos com suporte a pauseOnHover para Toasts Flutuantes
  useEffect(() => {
    if (avisoSucessoPedido && !toastHovered) {
      const t = setTimeout(() => setAvisoSucessoPedido(null), 60000);
      return () => clearTimeout(t);
    }
  }, [avisoSucessoPedido, toastHovered]);

  useEffect(() => {
    if (avisoSucessoAtivacao && !toastHovered) {
      const t = setTimeout(() => setAvisoSucessoAtivacao(null), 60000);
      return () => clearTimeout(t);
    }
  }, [avisoSucessoAtivacao, toastHovered]);

  useEffect(() => {
    if (avisoSucessoLink && !toastHovered) {
      const t = setTimeout(() => setAvisoSucessoLink(null), 60000);
      return () => clearTimeout(t);
    }
  }, [avisoSucessoLink, toastHovered]);

  useEffect(() => {
    if (avisoNaoAutorizado && !toastHovered) {
      const t = setTimeout(() => setAvisoNaoAutorizado(null), 60000);
      return () => clearTimeout(t);
    }
  }, [avisoNaoAutorizado, toastHovered]);

  useEffect(() => {
    if (erroQuerySupabase && !toastHovered) {
      const t = setTimeout(() => setErroQuerySupabase(null), 60000);
      return () => clearTimeout(t);
    }
  }, [erroQuerySupabase, toastHovered]);

  const diasRestantesMes = useMemo(() => {
    const agora = new Date();
    const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    return Math.max(1, ultimoDiaMes - agora.getDate());
  }, []);

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
      return acc + calcularFaturamentoTotalPlaca(curr);
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

  // Helper para normalização de texto insensível a maiúsculas e acentos
  const normalizarTexto = (texto: string) => {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Filtros Dinâmicos e Paginação de "MINHAS PLACAS ATIVAS"
  const mesesDisponiveisPlacas = useMemo(() => {
    const mesesSet = new Set<string>();
    placasAtivas.forEach((p) => {
      const dtStr = p.activated_at || p.data_ativacao || p.created_at || p.updated_at;
      if (dtStr) {
        const d = new Date(dtStr);
        if (!isNaN(d.getTime())) {
          const ano = d.getFullYear();
          const mes = String(d.getMonth() + 1).padStart(2, "0");
          mesesSet.add(`${ano}-${mes}`);
        }
      }
    });

    const lista = Array.from(mesesSet).sort().reverse();
    return lista.map((item) => {
      const [ano, mes] = item.split("-");
      const dataRef = new Date(Number(ano), Number(mes) - 1, 1);
      const nomeMes = dataRef.toLocaleDateString("pt-BR", { month: "long" });
      const capitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
      return {
        valor: item,
        label: `${capitalizado}/${ano}`,
      };
    });
  }, [placasAtivas]);

  // Define automaticamente o mês inicial selecionado com base na venda mais recente
  useEffect(() => {
    if (mesesDisponiveisPlacas.length > 0) {
      setFiltroMesPlacasAtivas((prev) => {
        // Se ainda não foi definido ou estava no padrão inicial "todos"
        if (prev === "todos" || !mesesDisponiveisPlacas.some((m) => m.valor === prev)) {
          return mesesDisponiveisPlacas[0].valor;
        }
        return prev;
      });
    }
  }, [mesesDisponiveisPlacas]);

  const placasAtivasFiltradas = useMemo(() => {
    const termoNormalizado = normalizarTexto(buscaPlacasAtivas);

    return placasAtivas.filter((p) => {
      // 1. Filtro por Mês (Pertence ao mês selecionado OU mês="todos")
      if (filtroMesPlacasAtivas !== "todos") {
        const dtStr = p.activated_at || p.data_ativacao || p.created_at || p.updated_at;
        if (!dtStr) return false;
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return false;
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const chaveMes = `${ano}-${mes}`;
        if (chaveMes !== filtroMesPlacasAtivas) return false;
      }

      // 2. Filtro por Busca Textual (insensível a maiúsculas/minúsculas e acentos)
      if (termoNormalizado) {
        const codigo = normalizarTexto(p.codigo || "");
        const loja = normalizarTexto(p.nome_empresa || "");
        const resp = normalizarTexto(p.responsavel_nome || "");
        const whats = normalizarTexto(p.whatsapp_contato || p.whatsapp_feedback || "");

        // Se houver anotações embutidas em nome_empresa (ex: [Resp: Carlos]), também busca nelas
        const matches =
          codigo.includes(termoNormalizado) ||
          loja.includes(termoNormalizado) ||
          resp.includes(termoNormalizado) ||
          whats.includes(termoNormalizado);

        if (!matches) return false;
      }

      return true;
    });
  }, [placasAtivas, buscaPlacasAtivas, filtroMesPlacasAtivas]);

  const totalPaginasPlacas = useMemo(() => {
    return Math.max(1, Math.ceil(placasAtivasFiltradas.length / ITENS_POR_PAGINA_PLACAS));
  }, [placasAtivasFiltradas.length, ITENS_POR_PAGINA_PLACAS]);

  const placasAtivasPaginadas = useMemo(() => {
    const inicio = (paginaPlacasAtivas - 1) * ITENS_POR_PAGINA_PLACAS;
    return placasAtivasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA_PLACAS);
  }, [placasAtivasFiltradas, paginaPlacasAtivas, ITENS_POR_PAGINA_PLACAS]);

  // Redefinir página caso a busca ou filtro reduza o total de páginas
  useEffect(() => {
    if (paginaPlacasAtivas > totalPaginasPlacas) {
      setPaginaPlacasAtivas(1);
    }
  }, [totalPaginasPlacas, paginaPlacasAtivas]);

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

  // 3. HANDLERS DO MODAL DE SOLICITAÇÃO DE NOVO LOTE (ETAPA 1 & ETAPA 2)
  const handleCepChange = async (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 8);
    const formatado = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 8)}` : raw;
    setCepInput(formatado);
    setErroEndereco(null);

    if (raw.length === 8) {
      setBuscandoCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (data.erro) {
            setErroEndereco("CEP não encontrado. Preencha o endereço manualmente.");
          } else {
            if (data.logradouro) setLogradouroInput(data.logradouro);
            if (data.bairro) setBairroInput(data.bairro);
            if (data.localidade) setCidadeInput(data.localidade);
            if (data.uf) setEstadoInput(data.uf);
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar CEP:", e);
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleAvancarParaKits = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !cepInput.trim() ||
      !logradouroInput.trim() ||
      !numeroInput.trim() ||
      !bairroInput.trim() ||
      !cidadeInput.trim() ||
      !estadoInput.trim()
    ) {
      setErroEndereco("Por favor, preencha todos os campos obrigatórios do endereço (CEP, Rua, Número, Bairro, Cidade, Estado).");
      return;
    }

    const endAtual: EnderecoEntrega = {
      cep: cepInput.trim(),
      logradouro: logradouroInput.trim(),
      numero: numeroInput.trim(),
      complemento: complementoInput.trim(),
      bairro: bairroInput.trim(),
      cidade: cidadeInput.trim(),
      estado: estadoInput.trim().toUpperCase(),
      ponto_referencia: pontoReferenciaInput.trim(),
    };

    setEnderecoSalvo(endAtual);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("goplak_aluno_endereco", JSON.stringify(endAtual));
      } catch (e) {}
    }

    setErroEndereco(null);
    setEditandoEndereco(false);
    setEtapaSolicitacao(2);
  };

  const handleGerarPedidoPix = async () => {
    const endAtual: EnderecoEntrega = enderecoSalvo || {
      cep: cepInput.trim(),
      logradouro: logradouroInput.trim(),
      numero: numeroInput.trim(),
      complemento: complementoInput.trim(),
      bairro: bairroInput.trim(),
      cidade: cidadeInput.trim(),
      estado: estadoInput.trim().toUpperCase(),
      ponto_referencia: pontoReferenciaInput.trim(),
    };

    if (!endAtual.logradouro || !endAtual.numero || !endAtual.cidade) {
      setEtapaSolicitacao(1);
      setErroEndereco("Por favor, confirme seu endereço completo antes de gerar o pedido.");
      return;
    }

    setEtapaSolicitacao(3);
  };

  const handleCopiarChavePix = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText("contato@goplak.com.br");
      setCopiouChavePix(true);
      setTimeout(() => setCopiouChavePix(false), 2500);
    }
  };

  const handleSelecionarArquivoComprovante = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("O arquivo é muito grande. O limite máximo permitido é 15MB.");
      return;
    }

    setArquivoComprovante(file);
    setNomeArquivoComprovante(file.name);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewComprovante(url);
    } else {
      setPreviewComprovante(null);
    }
  };

  const handleRemoverComprovante = () => {
    setArquivoComprovante(null);
    setNomeArquivoComprovante("");
    if (previewComprovante) {
      URL.revokeObjectURL(previewComprovante);
      setPreviewComprovante(null);
    }
  };

  const handleConcluirPedidoComprovante = async () => {
    if (!arquivoComprovante) {
      alert("Por favor, anexe o comprovante de pagamento antes de concluir.");
      return;
    }

    setEnviandoComprovante(true);

    const kit = KITS_CATALOGO[kitSelecionado];
    const endAtual = enderecoSalvo || {
      cep: cepInput.trim(),
      logradouro: logradouroInput.trim(),
      numero: numeroInput.trim(),
      complemento: complementoInput.trim(),
      bairro: bairroInput.trim(),
      cidade: cidadeInput.trim(),
      estado: estadoInput.trim(),
      ponto_referencia: pontoReferenciaInput.trim(),
    };

    let corEscolhida: ModeloCor = "misto";
    if (kitSelecionado === "pro") corEscolhida = corKitPro;
    if (kitSelecionado === "master") corEscolhida = corKitMaster;

    let corDesc =
      kitSelecionado === "start"
        ? "5 Pretas + 5 Azuis"
        : corEscolhida === "misto"
        ? kitSelecionado === "pro"
          ? "15 Pretas + 15 Azuis"
          : "25 Pretas + 25 Azuis"
        : corEscolhida === "preta"
        ? `${kit.qtd}x Placa Preta (100% Preta)`
        : `${kit.qtd}x Placa Azul (100% Azul)`;

    const enderecoTexto = `${endAtual.logradouro}, ${endAtual.numero}${
      endAtual.complemento ? " (" + endAtual.complemento + ")" : ""
    } - ${endAtual.bairro}, ${endAtual.cidade}/${endAtual.estado} - CEP: ${endAtual.cep}${
      endAtual.ponto_referencia ? " [Ref: " + endAtual.ponto_referencia + "]" : ""
    }`;

    try {
      // 1. Upload do Comprovante (Supabase Storage prioritário + Fallback API)
      let comprovanteUrl = "";
      const fileExt = arquivoComprovante.name.split(".").pop() || "png";
      const sanitizedName = arquivoComprovante.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `comprovantes/${alunoId || "aluno"}_${Date.now()}_${sanitizedName}`;

      try {
        const { data: stData, error: stErr } = await supabase.storage
          .from("comprovantes")
          .upload(filePath, arquivoComprovante, {
            cacheControl: "3600",
            upsert: true,
          });

        if (!stErr && stData) {
          const { data: pubData } = supabase.storage
            .from("comprovantes")
            .getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            comprovanteUrl = pubData.publicUrl;
          }
        } else if (stErr) {
          console.warn("Aviso upload Supabase Storage:", stErr);
        }
      } catch (stEx) {
        console.warn("Exceção upload Supabase Storage:", stEx);
      }

      // Fallback para API local se storage não retornou URL pública
      if (!comprovanteUrl) {
        try {
          const formData = new FormData();
          formData.append("file", arquivoComprovante);
          const resUpload = await fetch("/api/upload-comprovante", {
            method: "POST",
            body: formData,
          });
          const uploadJson = await resUpload.json();
          if (uploadJson.success && uploadJson.url) {
            comprovanteUrl = uploadJson.url;
          }
        } catch (errUp) {
          console.warn("Fallback upload API local falhou:", errUp);
        }
      }

      // 2. Gravar em pedidos_lotes com status inicial obrigatório 'Aguardando' e comprovante_url
      const payloadLote = {
        aluno_id: alunoId,
        quantidade: kit.qtd,
        valor_total: kit.preco,
        status: "Aguardando",
        comprovante_url: comprovanteUrl,
      };

      let novoPedidoId: string | null = null;
      const { data: insertedData, error: errPed } = await supabase
        .from("pedidos_lotes")
        .insert([payloadLote])
        .select("id")
        .maybeSingle();

      if (!errPed && insertedData?.id) {
        novoPedidoId = insertedData.id;
      } else if (errPed) {
        console.error("Erro ao gravar pedido_lote:", errPed);
        alert("Erro ao gravar pedido: " + errPed.message);
        return;
      }

      // 3. Notificar via API / WhatsApp
      try {
        await fetch("/api/notify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alunoNome: alunoNome || "GOPlak",
            quantidade: kit.qtd,
            kitNome: kit.nome,
            valorTotal: kit.preco,
            cor: corDesc,
            endereco: enderecoTexto,
            comprovanteUrl: comprovanteUrl,
          }),
        });
      } catch (errNotify) {
        console.warn("Aviso ao notificar pedido:", errNotify);
      }

      // 4. Celebração visual
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });

      // 5. Toast / Feedback de sucesso no topo
      setAvisoSucessoPedido(
        "✅ Pedido enviado com sucesso! O comprovante já está em análise pela nossa equipe. Acompanhe o status abaixo."
      );

      // 6. Limpar formulários e fechar modal imediatamente
      setArquivoComprovante(null);
      setNomeArquivoComprovante("");
      setPreviewComprovante(null);
      setModalSolicitarAberto(false);
      setEtapaSolicitacao(1);

      // 7. Abrir seção Meus Pedidos, ativar pulso temporário de destaque e auto-scroll suave
      setSecaoMeusPedidosAberta(true);
      if (novoPedidoId) {
        setPedidoRecemCriadoId(novoPedidoId);
      }
      setDestacarNovoPedido(true);

      setTimeout(() => {
        setDestacarNovoPedido(false);
        setPedidoRecemCriadoId(null);
      }, 4500);

      await carregarDadosDoBanco();

      // Rolagem suave até a seção Meus Pedidos
      setTimeout(() => {
        const section = document.getElementById("meus-pedidos");
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 250);
    } catch (err: any) {
      console.error("Erro inesperado ao gerar pedido com comprovante:", err);
      alert("Erro ao processar seu pedido: " + (err.message || String(err)));
    } finally {
      setEnviandoComprovante(false);
    }
  };

  // 4. ABRIR E SALVAR EDIÇÃO COMPLETA DA PLACA PELO ALUNO
  const handleAbrirEditarLink = (placa: PlacaAtivaItem) => {
    setPlacaEditando(placa);
    
    // Decompõe nome_empresa caso contenha anotações extras como [Resp: ...] ou [Serviço: ...]
    const rawNome = placa.nome_empresa || "";
    let nomeLojaLimpo = rawNome;
    let resp = placa.responsavel_nome || "";
    const servicosRecuperados: ServicoAdicionalItem[] = [];

    // 1. Recupera de servicos_adicionais se existir
    if (Array.isArray(placa.servicos_adicionais) && placa.servicos_adicionais.length > 0) {
      placa.servicos_adicionais.forEach((s, idx) => {
        servicosRecuperados.push({
          id: s.id || `serv-${Date.now()}-${idx}`,
          descricao: s.descricao || "",
          valor: s.valor !== undefined && s.valor !== null ? String(s.valor) : "",
          tipo_cobranca: s.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
        });
      });
    }

    // 2. Recupera de outras_vendas se ainda não tiver preenchido lista
    if (servicosRecuperados.length === 0 && placa.outras_vendas) {
      if (Array.isArray(placa.outras_vendas)) {
        placa.outras_vendas.forEach((s: any, idx: number) => {
          servicosRecuperados.push({
            id: s.id || `serv-${Date.now()}-${idx}`,
            descricao: s.descricao || "",
            valor: s.valor !== undefined && s.valor !== null ? String(s.valor) : "",
            tipo_cobranca: s.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
          });
        });
      } else if (typeof placa.outras_vendas === "object" && placa.outras_vendas.descricao) {
        servicosRecuperados.push({
          id: `serv-${Date.now()}-0`,
          descricao: placa.outras_vendas.descricao || "",
          valor: placa.outras_vendas.valor ? String(placa.outras_vendas.valor) : "",
          tipo_cobranca: placa.outras_vendas.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
        });
      }
    }

    // 3. Extrai anotações de nome_empresa caso ainda esteja vazio
    if (rawNome.includes(" [") && rawNome.endsWith("]")) {
      const idx = rawNome.indexOf(" [");
      nomeLojaLimpo = rawNome.substring(0, idx);
      const extraPart = rawNome.substring(idx + 2, rawNome.length - 1);
      
      const matchResp = extraPart.match(/Resp:\s*([^|\]]+)/);
      if (matchResp && !resp) {
        resp = matchResp[1].trim();
      }

      if (servicosRecuperados.length === 0) {
        const matchesServ = extraPart.matchAll(/Servi[çc]o:\s*([^R]+)R\$\s*([\d.,]+)\s*\(([^)]+)\)/gi);
        let sIdx = 0;
        for (const matchServ of matchesServ) {
          if (matchServ && matchServ[1]) {
            servicosRecuperados.push({
              id: `serv-${Date.now()}-${sIdx++}`,
              descricao: matchServ[1].trim(),
              valor: matchServ[2].trim(),
              tipo_cobranca: matchServ[3].toLowerCase().includes("recorrente") ? "recorrente" : "unico",
            });
          }
        }
      }
    }

    setEditNomeLojaAluno(nomeLojaLimpo);
    setEditResponsavelAluno(resp);
    setEditWhatsappAluno(placa.whatsapp_contato || placa.whatsapp_feedback || "");
    setNovoLinkDestino(placa.link_destino || placa.link_google_review || placa.url_destino || "");
    setEditValorDisplayAluno(placa.valor_venda ? String(placa.valor_venda) : "80.00");
    setEditServicosAluno(servicosRecuperados);
    setModalEditarLinkAberto(true);
  };

  const handleSalvarNovoLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placaEditando) return;

    setSalvandoLink(true);
    try {
      const nomeLimpo = editNomeLojaAluno.trim();
      const respLimpo = editResponsavelAluno.trim();
      const whatsLimpo = editWhatsappAluno.replace(/\D/g, "");
      const linkLimpo = novoLinkDestino.trim();
      const valorDisplayNum = parseFloat(editValorDisplayAluno.replace(",", ".")) || 80.0;

      // Filtra serviços válidos
      const servicosValidos = editServicosAluno
        .map((s) => ({
          id: s.id || `serv-${Math.random().toString(36).substring(2, 9)}`,
          descricao: s.descricao.trim(),
          valor: parseFloat(String(s.valor || "0").replace(",", ".")) || 0,
          tipo_cobranca: s.tipo_cobranca === "recorrente" ? ("recorrente" as const) : ("unico" as const),
        }))
        .filter((s) => s.descricao.length > 0 || s.valor > 0);

      let linkFormatado = linkLimpo;
      if (linkFormatado && !linkFormatado.startsWith("http://") && !linkFormatado.startsWith("https://")) {
        linkFormatado = `https://${linkFormatado}`;
      }

      // Monta anotações extras dentro de nome_empresa para compatibilidade 100% garantida
      let nomeEmpresaFinal = nomeLimpo;
      const partesExtras: string[] = [];
      if (respLimpo) partesExtras.push(`Resp: ${respLimpo}`);
      
      servicosValidos.forEach((s) => {
        const valTxt = s.valor > 0 ? `R$ ${s.valor}` : "";
        const cobrancaTxt = s.tipo_cobranca === "recorrente" ? "Recorrente/Mês" : "Único";
        partesExtras.push(`Serviço: ${s.descricao} ${valTxt} (${cobrancaTxt})`.trim());
      });

      if (partesExtras.length > 0) {
        nomeEmpresaFinal = `${nomeLimpo} [${partesExtras.join(" | ")}]`;
      }

      const updatePayload: Record<string, any> = {
        nome_empresa: nomeEmpresaFinal,
        link_google_review: linkFormatado,
        link_destino: linkFormatado,
        whatsapp_feedback: whatsLimpo,
        valor_venda: valorDisplayNum,
      };

      if (linkFormatado && placaEditando.status === "virgem") {
        updatePayload.status = "ativa";
        updatePayload.activated_at = new Date().toISOString();
      }

      // Tenta enviar com colunas estendidas caso o banco as tenha
      const payloadEstendido: Record<string, any> = {
        ...updatePayload,
        responsavel_nome: respLimpo,
        whatsapp_contato: whatsLimpo,
        servicos_adicionais: servicosValidos,
        outras_vendas: servicosValidos.length > 0 ? servicosValidos : null,
      };

      const { error: errEstendido } = await supabase
        .from("placas")
        .update(payloadEstendido)
        .eq("id", placaEditando.id);

      if (errEstendido) {
        console.warn("Fallback update campos base na placa:", errEstendido.message);
        // Fallback para schema base caso colunas novas não existam
        const { error: errBase } = await supabase
          .from("placas")
          .update({
            nome_empresa: nomeEmpresaFinal,
            link_google_review: linkFormatado,
            whatsapp_feedback: whatsLimpo,
            valor_venda: valorDisplayNum,
          })
          .eq("id", placaEditando.id);

        if (errBase) throw new Error(errBase.message);
      }

      // Atualiza o estado da lista localmente na hora sem reload
      setPlacasAtivas((prev) =>
        prev.map((item) =>
          item.id === placaEditando.id
            ? {
                ...item,
                nome_empresa: nomeEmpresaFinal,
                link_destino: linkFormatado,
                link_google_review: linkFormatado,
                url_destino: linkFormatado,
                whatsapp_feedback: whatsLimpo,
                whatsapp_contato: whatsLimpo,
                responsavel_nome: respLimpo,
                valor_venda: valorDisplayNum,
                servicos_adicionais: servicosValidos,
                outras_vendas: servicosValidos,
              }
            : item
        )
      );

      // Dispara feedback visual e fecha o modal
      setAvisoSucessoLink(`Display ${placaEditando.codigo} atualizado com sucesso!`);
      setModalEditarLinkAberto(false);
      setPlacaEditando(null);

      // Re-executa busca geral para recalcular todos os cards financeiros imediatamente
      await carregarDadosDoBanco();
    } catch (err: any) {
      console.error("Erro inesperado ao salvar dados da placa:", err);
      alert("Ocorreu um erro ao salvar as alterações: " + (err.message || String(err)));
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

  const handleAbrirEditarMeta = () => {
    setInputMetaSemanal(String(metaSemanalDisplays));
    setInputPrecoDisplay(precoPorDisplay.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setModalEditarMetaAberto(true);
  };

  const handleSalvarMetaSemanal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const novaMetaNum = parseInt(inputMetaSemanal.replace(/\D/g, ""), 10);
    if (isNaN(novaMetaNum) || novaMetaNum <= 0) {
      alert("Por favor, informe uma meta válida em quantidade de displays (ex: 20).");
      return;
    }

    // Limpar formatação monetária (remover R$, espaços e converter formato brasileiro ou americano)
    const strPreco = String(inputPrecoDisplay).trim();
    let novoPrecoNum = 0;
    if (strPreco.includes(",")) {
      novoPrecoNum = parseFloat(strPreco.replace(/[^0-9,-]/g, "").replace(",", ".")) || 0;
    } else {
      novoPrecoNum = parseFloat(strPreco.replace(/[^0-9.-]/g, "")) || 0;
    }
    const precoFinal = novoPrecoNum > 0 ? novoPrecoNum : precoPorDisplay;

    setSalvandoMeta(true);
    try {
      // 1. Atualizar estado local imediatamente
      setMetaSemanalDisplays(novaMetaNum);
      setPrecoPorDisplay(precoFinal);

      // 2. Salvar em localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("goplak_meta_semanal", String(novaMetaNum));
          localStorage.setItem("goplak_preco_display", String(precoFinal));
        } catch (eCache) {
          console.warn("Aviso ao salvar meta em cache:", eCache);
        }
      }

      // 3. Atualizar no Auth User Metadata
      try {
        await supabase.auth.updateUser({
          data: {
            meta_semanal_displays: novaMetaNum,
            preco_por_display: precoFinal,
          },
        });
      } catch (eAuth) {
        console.warn("Aviso ao salvar meta no Auth:", eAuth);
      }

      // 4. Atualizar na tabela alunos se o registro existir
      if (alunoId) {
        try {
          await supabase
            .from("alunos")
            .update({
              meta_semanal_displays: novaMetaNum,
              preco_padrao_display: precoFinal,
            })
            .eq("id", alunoId);
        } catch (eAlu) {
          console.warn("Aviso ao salvar meta na tabela alunos:", eAlu);
        }
      }

      setModalEditarMetaAberto(false);
      setAvisoSucessoLink(`Meta semanal atualizada para ${novaMetaNum} displays! 🎯`);
    } catch (err: any) {
      console.error("Erro ao salvar meta semanal:", err);
      alert("Erro ao salvar meta: " + (err.message || String(err)));
    } finally {
      setSalvandoMeta(false);
    }
  };

  const handleCopiarRastreio = (id: string, codigo: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(codigo);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2500);
    }
  };

  const formatarHoraCurta = (dtStr?: string | null) => {
    if (!dtStr) return "";
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return "";
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes} ${hora}:${min}`;
  };

  const handleConfirmarRecebimentoAluno = async (pedidoId: string) => {
    try {
      const agoraIso = new Date().toISOString();
      const { error } = await supabase
        .from("pedidos_lotes")
        .update({
          status: "entregue",
          entregue_em: agoraIso,
        })
        .eq("id", pedidoId);

      if (error) {
        console.warn("Aviso ao confirmar entrega no Supabase:", error);
      }

      setPedidosAluno((prev) =>
        prev.map((p) =>
          p.id === pedidoId ? { ...p, status: "entregue", entregue_em: agoraIso } : p
        )
      );

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });

      setAvisoSucessoPedido(
        "🎉 Entrega confirmada com sucesso! Seus displays virgens foram liberados no estoque."
      );
      await carregarDadosDoBanco();
    } catch (err: any) {
      console.error("Erro ao confirmar recebimento:", err);
      alert("Erro ao confirmar recebimento: " + (err.message || String(err)));
    }
  };

  const carregarDados = carregarDadosDoBanco;

  const handleDeleteLote = async (orderId: string) => {
    if (!orderId || !confirm("Deseja realmente excluir este pedido?")) return;
    
    try {
      // Remove placas filhas vinculadas
      await supabase.from('placas').delete().eq('pedido_id', orderId);
      
      // Remove o lote
      const { error } = await supabase.from('pedidos_lotes').delete().eq('id', orderId);
      
      if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
      }
      
      // Recarrega a listagem mantendo os QR codes intactos
      await carregarDados();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  const handleDeleteOrder = handleDeleteLote;

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
      <header className="flex items-center justify-between py-3 mb-4 border-b border-zinc-200 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">GOPLAK</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2 mt-0.5">
            Meu Dashboard <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 inline" />
          </h1>
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            <span className="text-zinc-500 dark:text-neutral-400 text-xs sm:text-sm whitespace-nowrap">
              Parceiro: <strong className="font-semibold text-zinc-800 dark:text-neutral-200">{alunoNome}</strong>
            </span>
            {rankingLiderDisplays > 0 ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 text-xs font-medium rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs">
                🏆 {isAlunoLider
                  ? `Top 1 do Mês: ${rankingAlunoDisplays} displays (+10 grátis) • ${diasRestantesMes}d`
                  : `Top 1: ${rankingLiderNome} (${rankingLiderDisplays} un) • ${diasRestantesMes}d`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 text-xs font-medium rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-700/80 dark:text-amber-400/80">
                🏆 Top 1 do Mês: +10 displays grátis
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMasterAdmin && (
            <button
              onClick={() => router.push("/admin")}
              title="Acessar Painel Administrador Master"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-500/30 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Admin</span>
            </button>
          )}

          {/* Sino de Notificação Rápida */}
          <button
            onClick={() => {
              const sec = document.getElementById("meus-pedidos");
              if (sec) {
                setSecaoMeusPedidosAberta(true);
                sec.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            title="Avisos e Pedidos em Andamento"
            aria-label="Notificações"
            className="relative p-2 rounded-xl bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {pedidosAluno.some((p) => p.status === "enviado" || p.status === "Aguardando" || p.status === "em_producao") && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900 animate-pulse" />
            )}
          </button>

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

      {/* TOASTS FLUTUANTES (FIXED TOP-RIGHT / NÃO DESLOCAM O LAYOUT) */}
      <div
        onMouseEnter={() => setToastHovered(true)}
        onMouseLeave={() => setToastHovered(false)}
        className="fixed top-4 right-4 z-[70] max-w-sm w-full pointer-events-none space-y-2 px-3 sm:px-0"
      >
        {avisoNaoAutorizado && (
          <div className="pointer-events-auto bg-rose-950/95 dark:bg-neutral-900/95 border border-rose-500/40 text-rose-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="font-medium text-rose-100 dark:text-rose-200 leading-snug">{avisoNaoAutorizado}</span>
            </div>
            <button
              onClick={() => setAvisoNaoAutorizado(null)}
              className="text-rose-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {erroQuerySupabase && (
          <div className="pointer-events-auto bg-amber-950/95 dark:bg-neutral-900/95 border border-amber-500/40 text-amber-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span className="font-medium text-amber-100 dark:text-amber-200 leading-snug">{erroQuerySupabase}</span>
            </div>
            <button
              onClick={() => setErroQuerySupabase(null)}
              className="text-amber-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {avisoSucessoAtivacao && (
          <div className="pointer-events-auto bg-emerald-950/95 dark:bg-neutral-900/95 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="font-medium text-emerald-100 dark:text-emerald-200 leading-snug">{avisoSucessoAtivacao}</span>
            </div>
            <button
              onClick={() => setAvisoSucessoAtivacao(null)}
              className="text-emerald-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {avisoSucessoPedido && (
          <div className="pointer-events-auto bg-emerald-950/95 dark:bg-neutral-900/95 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="font-medium text-emerald-100 dark:text-emerald-200 leading-snug">{avisoSucessoPedido}</span>
            </div>
            <button
              onClick={() => setAvisoSucessoPedido(null)}
              className="text-emerald-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {avisoSucessoLink && (
          <div className="pointer-events-auto bg-emerald-950/95 dark:bg-neutral-900/95 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="font-medium text-emerald-100 dark:text-emerald-200 leading-snug">{avisoSucessoLink}</span>
            </div>
            <button
              onClick={() => setAvisoSucessoLink(null)}
              className="text-emerald-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div>
        {/* ========================================================
            SESSÃO 1: PERFORMANCE DO DIA
            ======================================================== */}
        <div className="space-y-3">

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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAbrirEditarMeta}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 transition active:scale-95 cursor-pointer"
                      title="Definir meta semanal de displays"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Editar Meta</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleComemorarMeta}
                      className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition cursor-pointer"
                    >
                      Celebrar 🎉
                    </button>
                  </div>
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
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm dark:shadow-xl transition-colors space-y-4">
                
                {/* 1. BARRA DE FILTROS INCONDICIONAL: Busca + Seletor de Mês */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={buscaPlacasAtivas}
                      onChange={(e) => {
                        setBuscaPlacasAtivas(e.target.value);
                        setPaginaPlacasAtivas(1);
                      }}
                      placeholder="🔍 Buscar por loja, responsável ou código..."
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition font-medium"
                    />
                    {buscaPlacasAtivas && (
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaPlacasAtivas("");
                          setPaginaPlacasAtivas(1);
                        }}
                        className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-neutral-200 text-xs p-0.5 cursor-pointer"
                        title="Limpar busca"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div>
                    <select
                      value={filtroMesPlacasAtivas}
                      onChange={(e) => {
                        setFiltroMesPlacasAtivas(e.target.value);
                        setPaginaPlacasAtivas(1);
                      }}
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition font-medium cursor-pointer"
                    >
                      <option value="todos">Todos os Meses</option>
                      {mesesDisponiveisPlacas.map((m) => (
                        <option key={m.valor} value={m.valor}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. CONTEÚDO: Lista de Placas ou Mensagem de Vazio */}
                {placasAtivasFiltradas.length === 0 ? (
                  <div className="py-6 text-center space-y-2 border border-dashed border-zinc-200 dark:border-neutral-800 rounded-2xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-neutral-400">
                      {placasAtivas.length === 0
                        ? "Nenhuma placa ativada em campo ainda."
                        : "Nenhuma placa encontrada com os filtros selecionados."}
                    </p>
                    {placasAtivas.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 dark:text-neutral-500">
                        Clique no botão <strong className="text-emerald-600 dark:text-emerald-400">+</strong> flutuante para ativar seu primeiro display!
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBuscaPlacasAtivas("");
                          setFiltroMesPlacasAtivas("todos");
                        }}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Limpar filtros de busca
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {placasAtivasPaginadas.map((placa) => {
                      const rawLink = (placa.link_destino || placa.link_google_review || placa.url_destino || "").trim();
                      const linkExibicao = rawLink ? rawLink.replace(/^https?:\/\//i, "") : "Nenhum link configurado";
                      const linkHref = rawLink
                        ? rawLink.startsWith("http://") || rawLink.startsWith("https://")
                          ? rawLink
                          : `https://${rawLink}`
                        : "#";
                      const dtAtivacao = placa.activated_at || placa.data_ativacao || placa.updated_at || placa.created_at;
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

                {/* 3. RODAPÉ DE PAGINAÇÃO: Limpo e Centralizado */}
                <div className="pt-3 border-t border-zinc-100 dark:border-neutral-800 flex items-center justify-center gap-3 text-xs">
                  <button
                    type="button"
                    disabled={paginaPlacasAtivas <= 1}
                    onClick={() => setPaginaPlacasAtivas((prev) => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-neutral-800 bg-zinc-50 dark:bg-neutral-950 font-bold text-xs text-zinc-700 dark:text-neutral-300 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer shadow-sm"
                  >
                    Anterior
                  </button>

                  <span className="font-mono text-xs font-semibold text-zinc-600 dark:text-neutral-400 px-2 py-1">
                    Página <strong className="text-zinc-900 dark:text-white font-bold">{paginaPlacasAtivas}</strong> de{" "}
                    <strong className="text-zinc-900 dark:text-white font-bold">{totalPaginasPlacas}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={paginaPlacasAtivas >= totalPaginasPlacas}
                    onClick={() => setPaginaPlacasAtivas((prev) => Math.min(totalPaginasPlacas, prev + 1))}
                    className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-neutral-800 bg-zinc-50 dark:bg-neutral-950 font-bold text-xs text-zinc-700 dark:text-neutral-300 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer shadow-sm"
                  >
                    Próxima
                  </button>
                </div>
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
        <div className="mt-7" id="meus-pedidos">
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
              <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-sm dark:shadow-xl transition-colors">
                {/* Abas de Visualização: Em Andamento vs Histórico Concluído */}
                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-neutral-800/80 p-1 rounded-2xl mb-3.5 border border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setAbaPedidos("andamento")}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      abaPedidos === "andamento"
                        ? "bg-white dark:bg-neutral-900 text-violet-700 dark:text-violet-300 shadow-xs border border-zinc-200/80 dark:border-neutral-700"
                        : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <span>🚀 Em Andamento</span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      abaPedidos === "andamento"
                        ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                        : "bg-zinc-200 dark:bg-neutral-700 text-zinc-600 dark:text-neutral-400"
                    }`}>
                      {pedidosEmAndamento.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbaPedidos("concluidos")}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      abaPedidos === "concluidos"
                        ? "bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 shadow-xs border border-zinc-200/80 dark:border-neutral-700"
                        : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <span>📦 Histórico Concluído</span>
                    <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      abaPedidos === "concluidos"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-zinc-200 dark:bg-neutral-700 text-zinc-600 dark:text-neutral-400"
                    }`}>
                      {pedidosConcluidos.length}
                    </span>
                  </button>
                </div>

                {(() => {
                  const listaExibida = abaPedidos === "andamento" ? pedidosEmAndamento : pedidosConcluidos;

                  if (listaExibida.length === 0) {
                    if (abaPedidos === "andamento") {
                      return (
                        <div className="py-7 text-center space-y-2 text-xs text-zinc-400 dark:text-neutral-500">
                          <p className="font-semibold text-zinc-700 dark:text-neutral-300 text-sm">
                            Nenhum pedido em andamento no momento.
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-neutral-400 max-w-xs mx-auto">
                            Todos os seus pedidos foram entregues ou você ainda não solicitou um novo lote de displays.
                          </p>
                          <button
                            type="button"
                            onClick={() => setModalSolicitarAberto(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-2 rounded-xl transition cursor-pointer mt-2 shadow-xs active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Solicitar Novo Lote</span>
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="py-7 text-center text-xs text-zinc-400 dark:text-neutral-500 space-y-1">
                          <p className="font-medium text-zinc-700 dark:text-neutral-300">
                            Nenhum pedido concluído no histórico ainda.
                          </p>
                          <p className="text-[11px]">
                            Quando seus lotes forem entregues e confirmados, eles aparecerão aqui.
                          </p>
                        </div>
                      );
                    }
                  }

                  return (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {listaExibida.map((ped, idx) => {
                      const dt = new Date(ped.created_at || Date.now());
                      const isRecemCriado = destacarNovoPedido && (ped.id === pedidoRecemCriadoId || idx === 0);
                      const stLower = (ped.status || "").toLowerCase().trim();
                      const isAguardando =
                        stLower === "aguardando" ||
                        stLower === "aguardando aprovação" ||
                        stLower === "aguardando aprovacao" ||
                        stLower === "aguardando_aprovacao" ||
                        stLower === "aguardando_pagamento" ||
                        stLower === "solicitado" ||
                        stLower === "pendente";
                      const isProducao =
                        stLower === "em_producao" ||
                        stLower === "em produção" ||
                        stLower === "em producao" ||
                        stLower === "aprovado";
                      const isEnviado = stLower === "enviado";
                      const isEntregue = stLower === "entregue" || stLower === "concluido";
                      const isRecusado = stLower === "recusado" || stLower === "rejeitado" || stLower === "cancelado";

                      const statusLabel = isAguardando
                        ? "🟡 Aguardando Aprovação"
                        : isProducao
                        ? "🟢 Em Produção / Aprovado"
                        : isEnviado
                        ? "🟣 Enviado (Em Trânsito)"
                        : isEntregue
                        ? "✅ Entregue"
                        : isRecusado
                        ? "❌ Recusado"
                        : ped.status;

                      const statusStyle = isAguardando
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : isProducao
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : isEnviado
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                        : isEntregue
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
                        : isRecusado
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                        : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700";

                      const statusLegenda = isAguardando
                        ? "Comprovante em análise pela equipe"
                        : isProducao
                        ? "Produzindo displays na fábrica"
                        : isEntregue
                        ? "Displays entregues e disponíveis para ativação."
                        : isRecusado
                        ? (ped.motivo_recusa ? `Recusado: ${ped.motivo_recusa}` : "Pedido recusado pela administração.")
                        : null;

                      const rastreioTrim = (ped.codigo_rastreio || "").trim();
                      const isUrlRastreio = rastreioTrim.startsWith("http://") || rastreioTrim.startsWith("https://");
                      const urlRastreioFinal = isUrlRastreio
                        ? rastreioTrim
                        : `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(rastreioTrim)}`;

                      // Estados das 5 etapas da Timeline
                      const s1Done = true;
                      const s1Time = formatarHoraCurta(ped.created_at);

                      const s2Done = isProducao || isEnviado || isEntregue || !!ped.aprovado_em;
                      const s2Active = isAguardando && !isRecusado;
                      const s2Time = formatarHoraCurta(ped.aprovado_em || (s2Done ? ped.created_at : null));

                      const s3Done = isEnviado || isEntregue;
                      const s3Active = isProducao;

                      const s4Done = isEntregue;
                      const s4Active = isEnviado;
                      const s4Time = formatarHoraCurta(ped.enviado_em);

                      const s5Done = isEntregue;
                      const s5Time = formatarHoraCurta(ped.entregue_em);

                      return (
                        <div
                          key={ped.id}
                          className={`bg-zinc-50 dark:bg-neutral-950/70 border rounded-2xl p-4 space-y-3.5 text-xs transition-all duration-500 ${
                            isRecemCriado
                              ? "ring-2 ring-amber-400 dark:ring-amber-500 border-amber-400/80 shadow-lg shadow-amber-500/10 animate-pulse"
                              : "border-zinc-200 dark:border-neutral-800/80"
                          }`}
                        >
                          {/* Cabeçalho do Card */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900 dark:text-white text-sm">{ped.quantidade} displays</span>
                              <span className="text-[11px] text-zinc-500 dark:text-neutral-400">
                                • {dt.toLocaleDateString("pt-BR")}
                              </span>
                              {ped.observacao && (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full truncate max-w-[140px]" title={ped.observacao}>
                                  {ped.observacao}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusStyle}`}>
                                {statusLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(ped.id)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Excluir este pedido"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Conteúdo Principal: Recusado ou Stepper Timeline */}
                          {isRecusado ? (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-rose-700 dark:text-rose-400">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="font-bold text-xs">Pedido Recusado</div>
                                <p className="text-[11px] opacity-90">
                                  {ped.motivo_recusa || "Comprovante divergente ou pedido cancelado pela administração."}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 pt-1">
                              {/* Linha do Tempo de 5 Etapas */}
                              <div className="relative flex items-start justify-between px-0.5">
                                {/* Barra Traseira de Progresso */}
                                <div className="absolute top-2.5 left-4 right-4 h-0.5 bg-zinc-200 dark:bg-neutral-800 -z-0" />

                                {/* 1. Realizado */}
                                <div className="flex flex-col items-center text-center relative z-10 w-14">
                                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-neutral-900">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                  <span className="text-[9.5px] font-bold text-zinc-800 dark:text-neutral-200 mt-1.5 leading-tight">
                                    1. Realizado
                                  </span>
                                  {s1Time && <span className="text-[8.5px] font-mono text-zinc-500 dark:text-neutral-400 leading-tight">{s1Time}</span>}
                                </div>

                                {/* 2. Aprovado */}
                                <div className="flex flex-col items-center text-center relative z-10 w-14">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-neutral-900 ${
                                      s2Done
                                        ? "bg-emerald-500 text-black"
                                        : s2Active
                                        ? "bg-amber-500 text-black animate-pulse ring-amber-400/40"
                                        : "bg-zinc-200 dark:bg-neutral-800 text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    {s2Done ? <Check className="w-3 h-3 stroke-[3]" /> : s2Active ? <Clock className="w-3 h-3" /> : "2"}
                                  </div>
                                  <span
                                    className={`text-[9.5px] font-bold mt-1.5 leading-tight ${
                                      s2Done
                                        ? "text-zinc-800 dark:text-neutral-200"
                                        : s2Active
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    2. Aprovado
                                  </span>
                                  {s2Done && s2Time ? (
                                    <span className="text-[8.5px] font-mono text-zinc-500 dark:text-neutral-400 leading-tight">{s2Time}</span>
                                  ) : s2Active ? (
                                    <span className="text-[8.5px] text-amber-600 dark:text-amber-400 leading-tight">Análise</span>
                                  ) : null}
                                </div>

                                {/* 3. Produção */}
                                <div className="flex flex-col items-center text-center relative z-10 w-14">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-neutral-900 ${
                                      s3Done
                                        ? "bg-emerald-500 text-black"
                                        : s3Active
                                        ? "bg-emerald-500 text-black animate-pulse ring-emerald-400/40"
                                        : "bg-zinc-200 dark:bg-neutral-800 text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    {s3Done ? <Check className="w-3 h-3 stroke-[3]" /> : s3Active ? <Package className="w-3 h-3" /> : "3"}
                                  </div>
                                  <span
                                    className={`text-[9.5px] font-bold mt-1.5 leading-tight ${
                                      s3Done
                                        ? "text-zinc-800 dark:text-neutral-200"
                                        : s3Active
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    3. Produção
                                  </span>
                                  {s3Active && <span className="text-[8.5px] text-emerald-600 dark:text-emerald-400 leading-tight">Fábrica</span>}
                                </div>

                                {/* 4. Enviado */}
                                <div className="flex flex-col items-center text-center relative z-10 w-14">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-neutral-900 ${
                                      s4Done
                                        ? "bg-emerald-500 text-black"
                                        : s4Active
                                        ? "bg-violet-500 text-white animate-pulse ring-violet-400/40"
                                        : "bg-zinc-200 dark:bg-neutral-800 text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    {s4Done ? <Check className="w-3 h-3 stroke-[3]" /> : s4Active ? <Truck className="w-3 h-3" /> : "4"}
                                  </div>
                                  <span
                                    className={`text-[9.5px] font-bold mt-1.5 leading-tight ${
                                      s4Done
                                        ? "text-zinc-800 dark:text-neutral-200"
                                        : s4Active
                                        ? "text-violet-600 dark:text-violet-400"
                                        : "text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    4. Enviado
                                  </span>
                                  {s4Time ? (
                                    <span className="text-[8.5px] font-mono text-zinc-500 dark:text-neutral-400 leading-tight">{s4Time}</span>
                                  ) : s4Active ? (
                                    <span className="text-[8.5px] text-violet-600 dark:text-violet-400 leading-tight">Em trânsito</span>
                                  ) : null}
                                </div>

                                {/* 5. Entregue */}
                                <div className="flex flex-col items-center text-center relative z-10 w-14">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-4 ring-white dark:ring-neutral-900 ${
                                      s5Done
                                        ? "bg-emerald-500 text-black"
                                        : "bg-zinc-200 dark:bg-neutral-800 text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    {s5Done ? <Check className="w-3 h-3 stroke-[3]" /> : "5"}
                                  </div>
                                  <span
                                    className={`text-[9.5px] font-bold mt-1.5 leading-tight ${
                                      s5Done
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-zinc-400 dark:text-neutral-600"
                                    }`}
                                  >
                                    5. Entregue
                                  </span>
                                  {s5Time ? (
                                    <span className="text-[8.5px] font-mono text-zinc-500 dark:text-neutral-400 leading-tight">{s5Time}</span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Card de Rastreio & Ações */}
                              {(isEnviado || isEntregue || rastreioTrim) && (
                                <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800/80 space-y-2">
                                  {rastreioTrim && (
                                    <div className="flex items-center justify-between gap-2 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/30 p-2.5 rounded-xl">
                                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-violet-700 dark:text-violet-300 min-w-0">
                                        <Truck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                                        <div className="truncate">
                                          {ped.transportadora && <span className="font-bold mr-1 text-[10px] uppercase text-violet-800 dark:text-violet-300">[{ped.transportadora}]</span>}
                                          <span className="font-bold truncate" title={rastreioTrim}>
                                            {isUrlRastreio ? "Link de Envio" : rastreioTrim}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleCopiarRastreio(ped.id, rastreioTrim)}
                                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-200 px-2 py-1 rounded-lg transition cursor-pointer"
                                          title="Copiar código de rastreio"
                                        >
                                          {copiadoId === ped.id ? (
                                            <>
                                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                              <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
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
                                          className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 dark:bg-violet-500/20 dark:hover:bg-violet-500/30 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-lg border border-violet-500/30 transition cursor-pointer"
                                          title="Acompanhar entrega em nova aba"
                                        >
                                          <span>Rastrear</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {isEnviado && (
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmarRecebimentoAluno(ped.id)}
                                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>Confirmar Recebimento do Lote</span>
                                    </button>
                                  )}

                                  {isEntregue && (
                                    <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>Lote entregue! Displays virgens liberados no estoque.</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Legenda de status */}
                              {!rastreioTrim && !isEnviado && !isEntregue && statusLegenda && (
                                <div className={`text-[11px] font-medium pt-1 ${
                                  isAguardando
                                    ? "text-amber-600 dark:text-amber-400/90"
                                    : isProducao
                                    ? "text-emerald-600 dark:text-emerald-400/90"
                                    : "text-zinc-500 dark:text-neutral-500"
                                }`}>
                                  {statusLegenda}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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

      {/* MODAL 3: SOLICITAR NOVO LOTE (ETAPA 1: ENDEREÇO & ETAPA 2: CATÁLOGO E CORES) */}
      {modalSolicitarAberto && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Solicitar Novo Lote de Displays
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-none pb-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border transition whitespace-nowrap ${
                        etapaSolicitacao === 1
                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                          : etapaSolicitacao > 1
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-100 dark:bg-neutral-800 text-zinc-500 border-zinc-200 dark:border-neutral-700"
                      }`}
                    >
                      1. Endereço
                    </span>
                    <span className="text-zinc-400 text-xs shrink-0">➔</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border transition whitespace-nowrap ${
                        etapaSolicitacao === 2
                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                          : etapaSolicitacao > 2
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-100 dark:bg-neutral-800 text-zinc-500 border-zinc-200 dark:border-neutral-700"
                      }`}
                    >
                      2. Kits & Cores
                    </span>
                    <span className="text-zinc-400 text-xs shrink-0">➔</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border transition whitespace-nowrap ${
                        etapaSolicitacao === 3
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
                          : "bg-zinc-100 dark:bg-neutral-800 text-zinc-500 border-zinc-200 dark:border-neutral-700"
                      }`}
                    >
                      3. Pagamento
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalSolicitarAberto(false);
                  setEtapaSolicitacao(1);
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ========================================================
                ETAPA 1: ENDEREÇO DE ENTREGA
                ======================================================== */}
            {etapaSolicitacao === 1 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {enderecoSalvo && !editandoEndereco ? (
                  /* Resumo do Endereço Salvo */
                  <div className="space-y-4">
                    <div className="bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/60 rounded-2xl p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Entregar em:
                        </span>
                        <span className="text-[10px] font-mono bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-md">
                          Cadastrado
                        </span>
                      </div>

                      <div className="text-zinc-800 dark:text-neutral-200 space-y-0.5 pt-1">
                        <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                          {enderecoSalvo.logradouro}, {enderecoSalvo.numero}
                          {enderecoSalvo.complemento ? ` (${enderecoSalvo.complemento})` : ""}
                        </p>
                        <p className="text-zinc-600 dark:text-neutral-400">
                          Bairro {enderecoSalvo.bairro} • {enderecoSalvo.cidade} / {enderecoSalvo.estado}
                        </p>
                        <p className="font-mono text-[11px] text-zinc-500 dark:text-neutral-500">
                          CEP: {enderecoSalvo.cep}
                          {enderecoSalvo.ponto_referencia ? ` • Ref: ${enderecoSalvo.ponto_referencia}` : ""}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-sky-200/80 dark:border-sky-900/50 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setEditandoEndereco(true)}
                          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Alterar Endereço</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setModalSolicitarAberto(false)}
                        className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEtapaSolicitacao(2)}
                        className="flex-1 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Avançar para Escolha do Lote</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Formulário de Endereço com Busca Automática ViaCEP */
                  <form onSubmit={handleAvancarParaKits} className="space-y-3.5">
                    {erroEndereco && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{erroEndereco}</span>
                      </div>
                    )}

                    {/* CEP */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider">
                          CEP *
                        </label>
                        {buscandoCep && (
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Buscando endereço...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="00000-000"
                        maxLength={9}
                        value={cepInput}
                        onChange={(e) => handleCepChange(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                        autoFocus
                      />
                    </div>

                    {/* Logradouro (Rua / Avenida) */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                        Rua / Avenida *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Av. Paulista ou Rua das Flores"
                        value={logradouroInput}
                        onChange={(e) => setLogradouroInput(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    {/* Número e Complemento */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-1">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                          Número *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="123"
                          value={numeroInput}
                          onChange={(e) => setNumeroInput(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                          Complemento (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Apto 42, Sala 3, Bloco B"
                          value={complementoInput}
                          onChange={(e) => setComplementoInput(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                    </div>

                    {/* Bairro, Cidade e UF */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-5">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                          Bairro *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Bairro"
                          value={bairroInput}
                          onChange={(e) => setBairroInput(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                          Cidade *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Cidade"
                          value={cidadeInput}
                          onChange={(e) => setCidadeInput(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                          UF *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={2}
                          placeholder="SP"
                          value={estadoInput}
                          onChange={(e) => setEstadoInput(e.target.value.toUpperCase())}
                          className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-2 py-2 text-xs font-bold text-center text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 uppercase transition"
                        />
                      </div>
                    </div>

                    {/* Ponto de Referência */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-neutral-300 uppercase tracking-wider mb-1">
                        Ponto de Referência (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Próximo à padaria, portão branco..."
                        value={pontoReferenciaInput}
                        onChange={(e) => setPontoReferenciaInput(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition"
                      />
                    </div>

                    {/* Botões */}
                    <div className="pt-2 flex gap-3">
                      {enderecoSalvo && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoEndereco(false);
                            setErroEndereco(null);
                          }}
                          className="bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold px-4 py-3 rounded-xl text-xs transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-1 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Avançar para Escolha do Lote</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ========================================================
                ETAPA 2: CATÁLOGO DE KITS & PREVIEW VISUAL DE CORES
                ======================================================== */}
            {etapaSolicitacao === 2 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Header de Resumo de Endereço com botão voltar */}
                <div className="flex items-center justify-between bg-zinc-50 dark:bg-neutral-950/70 border border-zinc-200 dark:border-neutral-800 p-2.5 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span className="text-zinc-600 dark:text-neutral-400 truncate">
                      {enderecoSalvo?.logradouro}, {enderecoSalvo?.numero} • {enderecoSalvo?.cidade}/{enderecoSalvo?.estado}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEtapaSolicitacao(1)}
                    className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0 cursor-pointer ml-2"
                  >
                    Alterar
                  </button>
                </div>

                {/* 3 CARDS VERTICAIS DE KITS */}
                <div className="space-y-3">
                  {/* CARD 1: KIT START (10 UN | R$ 170,00) */}
                  <div
                    onClick={() => setKitSelecionado("start")}
                    className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                      kitSelecionado === "start"
                        ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500 ring-2 ring-amber-500/30"
                        : "bg-white dark:bg-neutral-900 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Start</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                            Padrão Lançamento
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
                          10 unidades • R$ 17,00/un
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-zinc-900 dark:text-white">R$ 170,00</span>
                        <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          Venda: R$ 800,00
                        </span>
                      </div>
                    </div>

                    {/* Mensagem Padrão de Turma + Imagens em Destaque Centralizado */}
                    <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-neutral-800/80 flex flex-col items-center gap-2.5">
                      <div className="flex items-center justify-center gap-4 sm:gap-6 w-full py-1">
                        <div className="flex flex-col items-center">
                          <img
                            src="/placa-preta.png"
                            alt="Placa Preta Google"
                            className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                          />
                          <span className="text-xs font-bold text-zinc-700 dark:text-neutral-300 mt-1.5 font-mono">
                            5x Preta
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <img
                            src="/placa-azul.png"
                            alt="Placa Azul Google"
                            className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                          />
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
                            5x Azul
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-amber-700 dark:text-amber-400/90 bg-amber-500/10 border border-amber-500/20 py-1.5 px-3 rounded-md inline-block mt-2 text-center font-medium">
                        Pacote padrão 50/50. Escolha de cor individual liberada a partir de 30 unidades.
                      </span>
                    </div>
                  </div>

                  {/* CARD 2: KIT PRO (30 UN | R$ 540,00 - DESTAQUE VERDE) */}
                  <div
                    onClick={() => setKitSelecionado("pro")}
                    className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                      kitSelecionado === "pro"
                        ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/40 shadow-sm"
                        : "bg-white dark:bg-neutral-900 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Pro</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 shadow-xs">
                            🔥 Mais Vendido
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
                          30 unidades • R$ 18,00/un
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-emerald-700 dark:text-emerald-400">R$ 540,00</span>
                        <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          Venda: R$ 2.400,00
                        </span>
                      </div>
                    </div>

                    {/* Botões de Cores e Preview Interativo em Alta Definição */}
                    <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-neutral-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 dark:text-neutral-300">
                          Escolha as Cores:
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-neutral-400">
                          {corKitPro === "misto" ? "15 Pretas / 15 Azuis" : corKitPro === "preta" ? "30 Pretas" : "30 Azuis"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("pro");
                            setCorKitPro("misto");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitPro === "misto" && kitSelecionado === "pro"
                              ? "bg-emerald-500 text-black border-emerald-400 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          Misto 15/15
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("pro");
                            setCorKitPro("preta");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitPro === "preta" && kitSelecionado === "pro"
                              ? "bg-zinc-900 text-white border-zinc-700 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          100% Preta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("pro");
                            setCorKitPro("azul");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitPro === "azul" && kitSelecionado === "pro"
                              ? "bg-blue-600 text-white border-blue-400 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          100% Azul
                        </button>
                      </div>

                      {/* Preview Visual das Artes em Alta Definição */}
                      <div className="flex items-center justify-center w-full py-1.5">
                        {corKitPro === "misto" && (
                          <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
                            <div className="flex flex-col items-center">
                              <img
                                src="/placa-preta.png"
                                alt="Placa Preta Google"
                                className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                              />
                              <span className="text-xs font-bold text-zinc-700 dark:text-neutral-300 mt-1.5 font-mono">
                                15x Preta
                              </span>
                            </div>
                            <div className="flex flex-col items-center">
                              <img
                                src="/placa-azul.png"
                                alt="Placa Azul Google"
                                className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                              />
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
                                15x Azul
                              </span>
                            </div>
                          </div>
                        )}
                        {corKitPro === "preta" && (
                          <div className="flex flex-col items-center justify-center w-full">
                            <img
                              src="/placa-preta.png"
                              alt="Placa Preta Google"
                              className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                            />
                            <span className="text-xs font-bold text-zinc-800 dark:text-neutral-200 mt-1.5 font-mono">
                              30x Placa Preta (100% Preta)
                            </span>
                          </div>
                        )}
                        {corKitPro === "azul" && (
                          <div className="flex flex-col items-center justify-center w-full">
                            <img
                              src="/placa-azul.png"
                              alt="Placa Azul Google"
                              className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                            />
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
                              30x Placa Azul (100% Azul)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: KIT MASTER (50 UN | R$ 850,00) */}
                  <div
                    onClick={() => setKitSelecionado("master")}
                    className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                      kitSelecionado === "master"
                        ? "bg-violet-500/5 dark:bg-violet-950/20 border-violet-500 ring-2 ring-violet-500/30"
                        : "bg-white dark:bg-neutral-900 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Master</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                            Escala
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
                          50 unidades • R$ 17,00/un
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-zinc-900 dark:text-white">R$ 850,00</span>
                        <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          Venda: R$ 4.000,00
                        </span>
                      </div>
                    </div>

                    {/* Botões de Cores e Preview */}
                    <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-neutral-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 dark:text-neutral-300">
                          Escolha as Cores:
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-neutral-400">
                          {corKitMaster === "misto" ? "25 Pretas / 25 Azuis" : corKitMaster === "preta" ? "50 Pretas" : "50 Azuis"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("master");
                            setCorKitMaster("misto");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitMaster === "misto" && kitSelecionado === "master"
                              ? "bg-violet-600 text-white border-violet-400 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          Misto 25/25
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("master");
                            setCorKitMaster("preta");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitMaster === "preta" && kitSelecionado === "master"
                              ? "bg-zinc-900 text-white border-zinc-700 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          100% Preta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setKitSelecionado("master");
                            setCorKitMaster("azul");
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            corKitMaster === "azul" && kitSelecionado === "master"
                              ? "bg-blue-600 text-white border-blue-400 shadow-sm"
                              : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                          }`}
                        >
                          100% Azul
                        </button>
                      </div>

                      {/* Preview das Artes em Alta Definição */}
                      <div className="flex items-center justify-center w-full py-1.5">
                        {corKitMaster === "misto" && (
                          <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
                            <div className="flex flex-col items-center">
                              <img
                                src="/placa-preta.png"
                                alt="Placa Preta Google"
                                className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                              />
                              <span className="text-xs font-bold text-zinc-700 dark:text-neutral-300 mt-1.5 font-mono">
                                25x Preta
                              </span>
                            </div>
                            <div className="flex flex-col items-center">
                              <img
                                src="/placa-azul.png"
                                alt="Placa Azul Google"
                                className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                              />
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
                                25x Azul
                              </span>
                            </div>
                          </div>
                        )}
                        {corKitMaster === "preta" && (
                          <div className="flex flex-col items-center justify-center w-full">
                            <img
                              src="/placa-preta.png"
                              alt="Placa Preta Google"
                              className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                            />
                            <span className="text-xs font-bold text-zinc-800 dark:text-neutral-200 mt-1.5 font-mono">
                              50x Placa Preta (100% Preta)
                            </span>
                          </div>
                        )}
                        {corKitMaster === "azul" && (
                          <div className="flex flex-col items-center justify-center w-full">
                            <img
                              src="/placa-azul.png"
                              alt="Placa Azul Google"
                              className="w-28 h-28 object-contain rounded-lg shadow-md border border-slate-700/50"
                            />
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
                              50x Placa Azul (100% Azul)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumo Final & Botão PIX */}
                {(() => {
                  const kit = KITS_CATALOGO[kitSelecionado];
                  return (
                    <div className="pt-2 space-y-3">
                      <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3.5 text-xs space-y-1">
                        <div className="flex justify-between items-center text-zinc-700 dark:text-neutral-300">
                          <span>Destinatário:</span>
                          <span className="font-semibold text-zinc-900 dark:text-white">{alunoNome}</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-700 dark:text-neutral-300">
                          <span>Potencial de Faturamento:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            R$ {kit.potencialVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEtapaSolicitacao(1)}
                          className="bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold px-4 py-3.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Voltar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEtapaSolicitacao(3)}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Ir para Pagamento • R$ {kit.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ⚡</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ========================================================
                ETAPA 3: PAGAMENTO & UPLOAD DE COMPROVANTE
                ======================================================== */}
            {etapaSolicitacao === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* 1. Resumo do Pedido */}
                {(() => {
                  const kit = KITS_CATALOGO[kitSelecionado];
                  let corDesc = "5 Pretas + 5 Azuis";
                  if (kitSelecionado === "pro") {
                    corDesc = corKitPro === "misto" ? "15 Pretas + 15 Azuis" : corKitPro === "preta" ? "30x Placa Preta (100% Preta)" : "30x Placa Azul (100% Azul)";
                  } else if (kitSelecionado === "master") {
                    corDesc = corKitMaster === "misto" ? "25 Pretas + 25 Azuis" : corKitMaster === "preta" ? "50x Placa Preta (100% Preta)" : "50x Placa Azul (100% Azul)";
                  }

                  const endAtual = enderecoSalvo || {
                    cep: cepInput.trim(),
                    logradouro: logradouroInput.trim(),
                    numero: numeroInput.trim(),
                    complemento: complementoInput.trim(),
                    bairro: bairroInput.trim(),
                    cidade: cidadeInput.trim(),
                    estado: estadoInput.trim(),
                    ponto_referencia: pontoReferenciaInput.trim(),
                  };

                  return (
                    <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Resumo do Pedido
                          </span>
                          <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                            {kit.nome} • {kit.qtd} Displays
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-neutral-400 font-medium mt-0.5">
                            Cores: <span className="text-zinc-900 dark:text-white font-semibold">{corDesc}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-400 block">
                            Total a Pagar
                          </span>
                          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                            R$ {kit.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Endereço de entrega resumido */}
                      <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate text-zinc-600 dark:text-neutral-400">
                          <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span className="truncate">
                            {endAtual.logradouro}, {endAtual.numero} • {endAtual.cidade}/{endAtual.estado}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEtapaSolicitacao(1)}
                          className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0 ml-2 cursor-pointer"
                        >
                          Alterar
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Área da Chave PIX */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Chave PIX (E-mail)
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                      GOPLAK Oficial
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-emerald-500/30 rounded-xl p-2.5">
                    <span className="flex-1 font-mono font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate selection:bg-emerald-500 selection:text-black">
                      contato@goplak.com.br
                    </span>
                    <button
                      type="button"
                      onClick={handleCopiarChavePix}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold text-xs shadow-sm transition cursor-pointer shrink-0"
                    >
                      {copiouChavePix ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar PIX</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-600 dark:text-neutral-400 leading-tight">
                    💡 Transfira o valor exato pelo app do seu banco e anexe o comprovante abaixo.
                  </p>
                </div>

                {/* 3. Área de Upload do Comprovante */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider">
                    Comprovante de Pagamento *
                  </label>

                  {!arquivoComprovante ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-neutral-700 hover:border-emerald-500 dark:hover:border-emerald-500/70 bg-zinc-50 dark:bg-neutral-950/60 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition group">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={handleSelecionarArquivoComprovante}
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-110 transition">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        📎 Selecionar Comprovante (PNG, JPG ou PDF)
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-neutral-500 mt-0.5">
                        Clique para buscar ou arraste seu arquivo até aqui
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-neutral-950 border border-emerald-500/40 rounded-2xl p-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {nomeArquivoComprovante}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-neutral-400">
                            {(arquivoComprovante.size / (1024 * 1024)).toFixed(2)} MB • Pronto para envio
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoverComprovante}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1 shrink-0 ml-2"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Ações do Rodapé */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEtapaSolicitacao(2)}
                    disabled={enviandoComprovante}
                    className="bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold px-4 py-3.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConcluirPedidoComprovante}
                    disabled={!arquivoComprovante || enviandoComprovante}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {enviandoComprovante ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando Comprovante...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Concluir Pedido e Enviar Comprovante</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
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

            <form onSubmit={handleSalvarNovoLink} className="space-y-3.5">
              {/* Nome da Loja / Estabelecimento */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nome da Loja / Estabelecimento *</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={salvandoLink}
                  placeholder="Ex: Pizzaria Bella Roma"
                  value={editNomeLojaAluno}
                  onChange={(e) => setEditNomeLojaAluno(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Responsável & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    disabled={salvandoLink}
                    placeholder="Ex: Carlos Eduardo"
                    value={editResponsavelAluno}
                    onChange={(e) => setEditResponsavelAluno(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    WhatsApp de Contato
                  </label>
                  <input
                    type="tel"
                    disabled={salvandoLink}
                    placeholder="(11) 99999-9999"
                    value={editWhatsappAluno}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let f = digits;
                      if (digits.length > 2) f = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                      if (digits.length > 7) f = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                      setEditWhatsappAluno(f);
                    }}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* URL de Destino (Google Review / Link) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>Link do Google Maps / Avaliação *</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="Ex: https://maps.app.goo.gl/... ou https://g.page/r/..."
                  value={novoLinkDestino}
                  onChange={(e) => setNovoLinkDestino(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-emerald-500 transition"
                />

                <div className="mt-1.5 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => window.open('https://share.google/YGTkj3nJeNNbyMYFJ', '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-start gap-1.5 w-fit px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-bold transition active:scale-[0.98] cursor-pointer"
                  >
                    <span>🔍 Gerar Link de Avaliação no Google</span>
                    <ExternalLink className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                  </button>
                  <p className="text-[10px] text-zinc-500 dark:text-neutral-400">
                    Dica: Abra o gerador, localize a empresa, copie o link de avaliação direta e cole acima.
                  </p>
                </div>
              </div>

              {/* Valor do Display */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                  <span>Valor do Display (R$)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-zinc-500 font-bold">R$</span>
                  <input
                    type="text"
                    disabled={salvandoLink}
                    value={editValorDisplayAluno}
                    onChange={(e) => setEditValorDisplayAluno(e.target.value)}
                    placeholder="80,00"
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-zinc-900 dark:text-neutral-200 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              {/* Bloco de Múltiplos Serviços Adicionais (Dinâmico) */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-neutral-950/60 border border-zinc-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Outras Vendas / Serviços Adicionais</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {editServicosAluno.length} {editServicosAluno.length === 1 ? "adicionado" : "adicionados"}
                  </span>
                </div>

                {editServicosAluno.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 dark:text-neutral-400 italic py-1">
                    Nenhum serviço adicional vinculado. Clique no botão abaixo para adicionar (ex: Otimização GMN, Fotos 360, etc.).
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {editServicosAluno.map((servico, idx) => (
                      <div
                        key={servico.id || idx}
                        className="p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            disabled={salvandoLink}
                            placeholder="Descrição (ex: Otimização Google Meu Negócio, Fotos...)"
                            value={servico.descricao}
                            onChange={(e) => {
                              const novaLista = [...editServicosAluno];
                              novaLista[idx].descricao = e.target.value;
                              setEditServicosAluno(novaLista);
                            }}
                            className="w-full bg-transparent border-0 border-b border-zinc-200 dark:border-neutral-800 px-1 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 font-medium"
                          />
                          <button
                            type="button"
                            disabled={salvandoLink}
                            onClick={() => {
                              setEditServicosAluno(editServicosAluno.filter((_, i) => i !== idx));
                            }}
                            className="text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded transition cursor-pointer"
                            title="Remover serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-[11px] text-zinc-500 font-bold">R$</span>
                            <input
                              type="text"
                              disabled={salvandoLink}
                              placeholder="150,00"
                              value={servico.valor}
                              onChange={(e) => {
                                const novaLista = [...editServicosAluno];
                                novaLista[idx].valor = e.target.value;
                                setEditServicosAluno(novaLista);
                              }}
                              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-lg pl-7 pr-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <select
                              disabled={salvandoLink}
                              value={servico.tipo_cobranca}
                              onChange={(e) => {
                                const novaLista = [...editServicosAluno];
                                novaLista[idx].tipo_cobranca = e.target.value as "unico" | "recorrente";
                                setEditServicosAluno(novaLista);
                              }}
                              className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              <option value="unico">Pagamento Único</option>
                              <option value="recorrente">Mensal / Recorrente</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  disabled={salvandoLink}
                  onClick={() => {
                    setEditServicosAluno([
                      ...editServicosAluno,
                      {
                        id: `serv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        descricao: "",
                        valor: "",
                        tipo_cobranca: "unico",
                      },
                    ]);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>👉 + Adicionar Outro Serviço</span>
                </button>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalEditarLinkAberto(false);
                    setPlacaEditando(null);
                  }}
                  className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoLink}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {salvandoLink ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </span>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEFINIR META SEMANAL */}
      {modalEditarMetaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setModalEditarMetaAberto(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 rounded-2xl">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Definir Meta Semanal
                </h3>
                <p className="text-xs text-zinc-500 dark:text-neutral-400">
                  Configure seu objetivo pessoal de ativação de displays
                </p>
              </div>
            </div>

            <form onSubmit={handleSalvarMetaSemanal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                  Quantos displays você quer ativar por semana? *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={inputMetaSemanal}
                    onChange={(e) => setInputMetaSemanal(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-base font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 dark:text-neutral-500">
                    displays / sem
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Valor estimado por display (R$)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Opcional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 dark:text-neutral-500">
                    R$
                  </span>
                  <input
                    type="text"
                    value={inputPrecoDisplay}
                    onChange={(e) => setInputPrecoDisplay(e.target.value)}
                    placeholder="80,00"
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-1">
                  Usado para calcular a projeção financeira estimada de fechamento da semana.
                </p>
              </div>

              {/* Prévia do montante total */}
              {(() => {
                const qtd = Number(inputMetaSemanal.replace(/\D/g, "")) || 0;
                // Limpar formatação monetária (remover R$, pontos de milhar e converter vírgula se houver)
                const valorUnitario = typeof inputPrecoDisplay === "number"
                  ? inputPrecoDisplay
                  : (() => {
                      const str = String(inputPrecoDisplay).trim();
                      if (str.includes(",")) {
                        return parseFloat(str.replace(/[^0-9,-]/g, "").replace(",", ".")) || 0;
                      }
                      return parseFloat(str.replace(/[^0-9.-]/g, "")) || 0;
                    })();

                const faturamentoEstimado = qtd * valorUnitario;
                if (qtd <= 0) return null;

                return (
                  <div className="p-3 rounded-2xl bg-violet-500/5 border border-violet-500/15 flex items-center justify-between">
                    <span className="text-xs text-zinc-600 dark:text-neutral-300 font-medium">
                      Faturamento estimado com a meta batida:
                    </span>
                    <span className="text-xs font-black text-violet-600 dark:text-violet-400">
                      {faturamentoEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                );
              })()}

              {/* Botões */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalEditarMetaAberto(false)}
                  className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoMeta}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {salvandoMeta ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </span>
                  ) : (
                    <span>Salvar Meta</span>
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


