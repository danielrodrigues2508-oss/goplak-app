"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";
import {
  Layers,
  CheckCircle2,
  Package,
  DollarSign,
  PlusCircle,
  Download,
  Users,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  Trophy,
  Crown,
  Medal,
  Award,
  X,
  Gift,
  LogOut,
  Eye,
  Check,
  XCircle,
  MapPin,
  ExternalLink,
  FileText,
  Paperclip,
  Filter,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Bell,
  PackagePlus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  Boxes,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { exportarLoteEmFatiasZip, COST_PER_UNIT, DisplayItem } from "@/lib/exportGraficaZip";
import {
  KitsDisponiveis,
  KITS_DISPONIVEIS_PADRAO,
  KITS_CATALOGO,
  encodeKitsToCode,
  decodeKitsFromCode,
} from "@/lib/kitsConfig";


interface ConfigFabrica {
  id?: string;
  custo_unitario_display: number;
  estoque_displays_prontos: number;
  media_saida_diaria: number;
}

interface CaixaFabricaItem {
  id: string;
  pedido_id?: string | null;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  descricao: string;
  valor: number;
  custo_mercadoria: number;
  lucro_liquido: number;
  created_at?: string;
}


interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface PodioAluno {
  posicao: number;
  alunoId: string;
  nome: string;
  email?: string;
  quantidade: number;
}

interface PlacaRecord {
  id?: string;
  codigo: string;
  status: "virgem" | "ativa" | "bloqueada";
  valor_venda?: number;
  pedido_id?: string;
  lote_id?: string;
  aluno_id?: string;
  nome_empresa?: string;
  link_google_review?: string;
  whatsapp_feedback?: string;
  escudo_ativo?: boolean;
  total_scans?: number;
  activated_at?: string;
  data_ativacao?: string;
  responsavel_nome?: string;
  whatsapp_contato?: string;
  outras_vendas?: any;
  servicos_adicionais?: Array<{
    id?: string;
    descricao: string;
    valor: number | string;
    tipo_cobranca: "unico" | "recorrente";
  }>;
  created_at?: string;
  updated_at?: string;
}

// Helper para calcular o Faturamento Total Real do Admin (Display + Múltiplos Serviços Adicionais)
export function calcularFaturamentoTotalPlacaAdmin(placa: {
  valor_venda?: number;
  outras_vendas?: any;
  servicos_adicionais?: any;
  nome_empresa?: string;
}): number {
  const valorDisplay = Number(placa.valor_venda) || (placa.valor_venda === 0 ? 0 : 80.0);
  let valorServicos = 0;

  // 1. Caso servicos_adicionais seja um Array
  if (Array.isArray(placa.servicos_adicionais) && placa.servicos_adicionais.length > 0) {
    placa.servicos_adicionais.forEach((s: any) => {
      const v = typeof s?.valor === "number" ? s.valor : parseFloat(String(s?.valor || "0").replace(",", "."));
      if (!isNaN(v) && v > 0) {
        valorServicos += v;
      }
    });
  }

  // 2. Caso outras_vendas exista (seja Array ou Objeto único)
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

  // 3. Extração da anotação composta em nome_empresa (ex: [Serviço: Otimização R$ 150 (Único) | Serviço: Fotos R$ 200 (Único)])
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

interface LoteExport {
  id: string;
  data: string;
  alunoNome: string;
  alunoEmail?: string;
  alunoId?: string;
  quantidade: number;
  valorTotal?: number;
  modeloCor?: string;
  enderecoEntrega?: any;
  comprovanteUrl?: string;
  codigoInicio: string;
  codigoFim: string;
  status: string;
  temLoteGerado: boolean;
  codigoRastreio?: string;
  transportadora?: string;
  aprovadoEm?: string;
  enviadoEm?: string;
  entregueEm?: string;
  createdAt?: string;
  observacao?: string;
  motivoRecusa?: string;
}

const extrairNumeroCodigo = (cod: string | undefined | null): number => {
  if (!cod) return 0;
  const match = cod.match(/\d+/g);
  return match ? parseInt(match.join(""), 10) : 0;
};

const obterProximosNumerosLivres = (
  quantidadeDesejada: number,
  placasOuCodigos: ({ codigo?: string } | string)[]
): number[] => {
  const usados = new Set<number>();
  placasOuCodigos.forEach((item) => {
    const cod = typeof item === "string" ? item : item?.codigo;
    const n = extrairNumeroCodigo(cod);
    if (n > 0) usados.add(n);
  });
  const disponiveis: number[] = [];
  let candidato = 1;
  const totalNecessario = quantidadeDesejada > 0 ? quantidadeDesejada : 1;
  while (disponiveis.length < totalNecessario) {
    if (!usados.has(candidato)) {
      disponiveis.push(candidato);
    }
    candidato++;
  }
  return disponiveis;
};

const extrairQtdCores = (lote: { quantidade?: number; modeloCor?: string; observacao?: string }): { pretas: number; azuis: number } => {
  const str = (lote.modeloCor || lote.observacao || "").toLowerCase();
  const total = Number(lote.quantidade) || 10;
  let pretas = 0;
  let azuis = 0;

  const matchPretas = str.match(/(\d+)\s*(?:un|x)?\s*preta/);
  const matchAzuis = str.match(/(\d+)\s*(?:un|x)?\s*azul/);

  if (matchPretas) pretas = parseInt(matchPretas[1], 10);
  if (matchAzuis) azuis = parseInt(matchAzuis[1], 10);

  if (pretas === 0 && azuis === 0) {
    if (str.includes("100% preta") || (str.includes("preta") && !str.includes("azul"))) {
      pretas = total;
      azuis = 0;
    } else if (str.includes("100% azul") || (str.includes("azul") && !str.includes("preta"))) {
      pretas = 0;
      azuis = total;
    } else {
      // Padrão Misto 50/50
      pretas = Math.ceil(total / 2);
      azuis = Math.floor(total / 2);
    }
  }
  return { pretas, azuis };
};

export default function PainelDistribuidorAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [gerandoPedidoId, setGerandoPedidoId] = useState<string | null>(null);
  const [exportandoId, setExportandoId] = useState<string | null>(null);
  const [feedbackSucesso, setFeedbackSucesso] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [toastHovered, setToastHovered] = useState(false);

  // Filtro de Pedidos (Todos, Aguardando, Aprovados, Recusados)
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendentes" | "aprovados" | "recusados">("todos");
  const [popoverNotificacoesAberto, setPopoverNotificacoesAberto] = useState(false);
  const [pedidoDestacadoId, setPedidoDestacadoId] = useState<string | null>(null);

  // Modal de Comprovante Bancário
  const [pedidoSelecionadoComprovante, setPedidoSelecionadoComprovante] = useState<LoteExport | null>(null);
  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false);

  // Modal de Recusa de Pedido
  const [pedidoRecusando, setPedidoRecusando] = useState<LoteExport | null>(null);
  const [modalRecusarAberto, setModalRecusarAberto] = useState(false);
  const [motivoRecusaInput, setMotivoRecusaInput] = useState("");
  const [processandoAcaoId, setProcessandoAcaoId] = useState<string | null>(null);

  // Modal de Endereço Completo
  const [enderecoVisualizando, setEnderecoVisualizando] = useState<{ alunoNome: string; endereco: any } | null>(null);
  const [modalEnderecoAberto, setModalEnderecoAberto] = useState(false);

  // Modal de Exclusão de Pedido & Estorno
  const [pedidoExcluindo, setPedidoExcluindo] = useState<LoteExport | null>(null);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [excluindoPedido, setExcluindoPedido] = useState(false);

  // Modal de Emissão Manual de Lotes & Seletor de Cores
  const [modalEmissaoManualAberto, setModalEmissaoManualAberto] = useState(false);
  const [tipoEmissaoManual, setTipoEmissaoManual] = useState<"venda_aluno" | "reposicao_propria">("reposicao_propria");
  const [opcaoCorManual, setOpcaoCorManual] = useState<"misto" | "preta" | "azul" | "personalizado">("misto");
  const [qtdPretaManual, setQtdPretaManual] = useState<number>(10);
  const [qtdAzulManual, setQtdAzulManual] = useState<number>(10);

  // Modal de Despacho e Rastreio
  const [modalDespachoAberto, setModalDespachoAberto] = useState(false);
  const [pedidoDespachando, setPedidoDespachando] = useState<LoteExport | null>(null);
  const [transportadoraInput, setTransportadoraInput] = useState("Correios");
  const [rastreioInput, setRastreioInput] = useState("");
  const [salvandoDespacho, setSalvandoDespacho] = useState(false);

  // Gestão de Caixa Real & Estoque Físico da Fábrica
  const [configFabricaId, setConfigFabricaId] = useState<string | null>(null);
  const [custoUnitarioDisplay, setCustoUnitarioDisplay] = useState<number>(COST_PER_UNIT);
  const [estoqueDisplaysProntos, setEstoqueDisplaysProntos] = useState<number>(0);
  const [mediaSaidaDiaria, setMediaSaidaDiaria] = useState<number>(2.5);
  const [itensCaixa, setItensCaixa] = useState<CaixaFabricaItem[]>([]);

  // Disponibilidade de Kits para Alunos (Lançamento)
  const [kitsDisponiveis, setKitsDisponiveis] = useState<KitsDisponiveis>(KITS_DISPONIVEIS_PADRAO);
  const [salvandoKits, setSalvandoKits] = useState(false);


  // Modal de Lançamento de Despesa / Frete
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [despesaCategoria, setDespesaCategoria] = useState<"Frete" | "Embalagem" | "Reposição Fornecedor" | "Outros">("Frete");
  const [despesaDescricao, setDespesaDescricao] = useState("");
  const [despesaValor, setDespesaValor] = useState("");
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);

  // Modal de Reposição de Estoque de Fornecedor
  const [modalReposicaoAberto, setModalReposicaoAberto] = useState(false);
  const [reposicaoQtd, setReposicaoQtd] = useState<number>(100);
  const [reposicaoCustoUnitario, setReposicaoCustoUnitario] = useState<string>(COST_PER_UNIT.toFixed(2));
  const [reposicaoLancarDespesa, setReposicaoLancarDespesa] = useState<boolean>(true);
  const [salvandoReposicao, setSalvandoReposicao] = useState(false);

  // Modal de Extrato do Caixa & Exportação PDF
  const [modalExtratoCaixaAberto, setModalExtratoCaixaAberto] = useState(false);
  const [filtroMesExtrato, setFiltroMesExtrato] = useState<string>("todos");
  const [gerandoPdfExtrato, setGerandoPdfExtrato] = useState(false);

  // Modal de Ajuste Direto / Calibração de Estoque da Fábrica
  const [modalAjustarEstoqueAberto, setModalAjustarEstoqueAberto] = useState(false);
  const [inputNovoEstoque, setInputNovoEstoque] = useState<number>(0);
  const [salvandoAjusteEstoque, setSalvandoAjusteEstoque] = useState(false);

  // Gestão de Placas / Displays Ativados & Modal de Edição pelo Admin
  const [abaPrincipal, setAbaPrincipal] = useState<"pedidos" | "placas">("pedidos");
  const [filtroPlacaStatus, setFiltroPlacaStatus] = useState<"todas" | "ativas" | "virgens">("todas");
  const [buscaPlaca, setBuscaPlaca] = useState("");
  const [modalEditarPlacaAberto, setModalEditarPlacaAberto] = useState(false);
  const [placaEditandoAdmin, setPlacaEditandoAdmin] = useState<PlacaRecord | null>(null);
  const [editNomeLoja, setEditNomeLoja] = useState("");
  const [editResponsavel, setEditResponsavel] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editLinkGoogle, setEditLinkGoogle] = useState("");
  const [editValorVenda, setEditValorVenda] = useState("80.00");
  const [editServicosAdmin, setEditServicosAdmin] = useState<Array<{
    id: string;
    descricao: string;
    valor: string;
    tipo_cobranca: "unico" | "recorrente";
  }>>([]);
  const [salvandoEdicaoPlaca, setSalvandoEdicaoPlaca] = useState(false);

  // Métricas Consolidadas
  const [totalProduzidas, setTotalProduzidas] = useState(0);
  const [totalAtivas, setTotalAtivas] = useState(0);
  const [totalVirgens, setTotalVirgens] = useState(0);
  const [volumeTransacionado, setVolumeTransacionado] = useState(0);

  // Sequenciamento Numérico Real & Reaproveitamento Inteligente
  const [maiorCodigoNumero, setMaiorCodigoNumero] = useState(0);
  const [placasCadastradas, setPlacasCadastradas] = useState<PlacaRecord[]>([]);

  // Lista de Alunos e Lotes
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<string>("");
  const [quantidadeLote, setQuantidadeLote] = useState<number>(20);
  const [lotes, setLotes] = useState<LoteExport[]>([]);

  // Top Display (Líder do Mês e Pódio)
  const [topLider, setTopLider] = useState<{
    nome: string;
    email?: string;
    quantidade: number;
  } | null>(null);
  const [podioAlunos, setPodioAlunos] = useState<PodioAluno[]>([]);
  const [modalPodioAberto, setModalPodioAberto] = useState(false);
  const [gerandoPremio, setGerandoPremio] = useState(false);

  // Verificação de Autorização de Administrador
  const checkAdminSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.push("/login?redirect=/admin");
        return false;
      }

      const email = (user.email || "").toLowerCase();
      const role = user.user_metadata?.role || user.app_metadata?.role || "";
      const isAdmin =
        email === "daniel.rodrigues2508@gmail.com" ||
        email.includes("admin") ||
        email.includes("daniel@goplacas") ||
        role === "admin" ||
        email === "distribuidor@goplacas.com.br";

      if (!isAdmin) {
        // Aluno comum sem privilégios de Admin -> Redireciona imediatamente para o Dashboard
        router.push("/dashboard?error=unauthorized");
        return false;
      }

      return true;
    } catch (err) {
      console.warn("Aviso ao validar sessão admin:", err);
      return false;
    }
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Erro ao deslogar:", err);
    } finally {
      router.push("/login");
    }
  };

  // Função principal de carga de dados do Admin
  const fetchAdminData = useCallback(async () => {
    try {
      setErroMsg(null);
      const isAuth = await checkAdminSession();
      if (!isAuth) {
        setLoading(false);
        return;
      }

      console.log("Iniciando busca de dados do Admin...");

      // 1. Puxar Alunos
      let listaAlunos: Aluno[] = [];
      try {
        const { data: alunosBanco, error: errAlunos } = await supabase
          .from("alunos")
          .select("id, nome, email")
          .order("created_at", { ascending: false });

        if (!errAlunos && alunosBanco && alunosBanco.length > 0) {
          listaAlunos = alunosBanco;
        } else {
          // Fallback REST direto
          const res = await fetch(`${SUPABASE_URL}/rest/v1/alunos?select=id,nome,email`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              listaAlunos = data;
            }
          }
        }
      } catch (err) {
        console.warn("Aviso ao buscar alunos:", err);
      }

      // Garantir que o usuário GOPlak esteja na lista
      const danielId = "403183b5-02f6-46a7-b448-7658c5087ec4";
      const danielEmail = "daniel.rodrigues2508@gmail.com";
      const existsDaniel = listaAlunos.some((a) => a.id === danielId || (a.email && a.email.toLowerCase() === danielEmail));
      if (!existsDaniel) {
        listaAlunos.unshift({
          id: danielId,
          nome: "GOPlak",
          email: danielEmail,
        });
      }

      // Priorizar GOPlak no topo da lista
      listaAlunos.sort((a, b) => {
        if (a.id === danielId || a.email?.toLowerCase() === danielEmail) return -1;
        if (b.id === danielId || b.email?.toLowerCase() === danielEmail) return 1;
        return (a.nome || "").localeCompare(b.nome || "");
      });

      setAlunos(listaAlunos);
      if (!alunoSelecionado && listaAlunos.length > 0) {
        setAlunoSelecionado(listaAlunos[0].id);
      }

      // 2. Query de Placas
      let listaPlacas: PlacaRecord[] = [];
      const { data: placasData, error } = await supabase
        .from("placas")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro busca placas via SDK:", error);
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/placas?select=*&order=created_at.asc`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              listaPlacas = data;
            }
          }
        } catch (restErr) {
          console.error("Erro no fallback REST de placas:", restErr);
        }
      } else if (placasData) {
        listaPlacas = placasData;
      }

      // 2.1 Ordenação rigorosa e estritamente numérica por código (GP-0001, GP-0002, ...)
      listaPlacas.sort((a, b) => extrairNumeroCodigo(a.codigo) - extrairNumeroCodigo(b.codigo));
      setPlacasCadastradas(listaPlacas);

      // 3. Cálculo das Métricas
      const total = listaPlacas.length;
      const ativas = listaPlacas.filter((p) => p.status === "ativa");
      const virgens = listaPlacas.filter((p) => p.status === "virgem");
      const volume = ativas.reduce((acc, curr) => {
        return acc + calcularFaturamentoTotalPlacaAdmin(curr);
      }, 0);

      setTotalProduzidas(total);
      setTotalAtivas(ativas.length);
      setTotalVirgens(virgens.length);
      setVolumeTransacionado(volume);

      // 4. Maior Código Numérico
      let maxInt = 0;
      listaPlacas.forEach((p) => {
        const num = extrairNumeroCodigo(p.codigo);
        if (num > maxInt) {
          maxInt = num;
        }
      });
      setMaiorCodigoNumero(maxInt);

      // 5. Puxar Lotes
      try {
        console.log("Consultando pedidos_lotes no Supabase...");
        let pedidosBanco: any[] = [];
        const { data: pData, error: errPedidos } = await supabase
          .from("pedidos_lotes")
          .select("*")
          .order("created_at", { ascending: false });

        if (errPedidos) {
          console.error("Erro na busca de pedidos_lotes via SDK:", errPedidos);
          try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_lotes?select=*&order=created_at.desc`, {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
            if (res.ok) {
              const d = await res.json();
              if (Array.isArray(d)) pedidosBanco = d;
            }
          } catch (restErr) {
            console.error("Erro no fallback REST de pedidos_lotes:", restErr);
          }
        } else if (pData) {
          pedidosBanco = pData;
        }

        // Se pedidos_lotes estiver vazio, tentar tabela 'lotes'
        if (pedidosBanco.length === 0) {
          try {
            const { data: lotesExtras } = await supabase
              .from("lotes")
              .select("*")
              .order("created_at", { ascending: false });
            if (lotesExtras && lotesExtras.length > 0) {
              pedidosBanco = lotesExtras;
            }
          } catch (errLotesTab) {
            console.log("Tabela lotes opcional:", errLotesTab);
          }
        }

        if (pedidosBanco.length > 0) {
          // Cálculo do Top Display do Mês e Pódio Top 3
          const agora = new Date();
          const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

          const pedidosMes = pedidosBanco.filter((p: any) => {
            if (p.status === "cancelado") return false;
            if (!p.created_at) return true;
            return new Date(p.created_at) >= inicioDoMes;
          });

          const totalPorAluno: Record<string, number> = {};
          pedidosMes.forEach((p: any) => {
            const aId = p.aluno_id || p.user_id || "00000000-0000-0000-0000-000000000001";
            const qtd = Number(p.quantidade) || 0;
            totalPorAluno[aId] = (totalPorAluno[aId] || 0) + qtd;
          });

          const listaPodio: PodioAluno[] = Object.entries(totalPorAluno)
            .map(([id, qtd]) => {
              const alunoObj = listaAlunos.find((a) => a.id === id);
              return {
                posicao: 0,
                alunoId: id,
                nome: alunoObj ? alunoObj.nome : (id.startsWith("aluno-demo") ? "Aluno Demo" : "Aluno Parceiro"),
                email: alunoObj?.email,
                quantidade: qtd,
              };
            })
            .filter((item) => item.quantidade > 0)
            .sort((a, b) => b.quantidade - a.quantidade)
            .map((item, idx) => ({ ...item, posicao: idx + 1 }));

          setPodioAlunos(listaPodio.slice(0, 3));

          if (listaPodio.length > 0) {
            setTopLider({
              nome: listaPodio[0].nome,
              email: listaPodio[0].email,
              quantidade: listaPodio[0].quantidade,
            });
          } else {
            setTopLider(null);
          }

          const formatados: LoteExport[] = pedidosBanco.map((ped) => {
            const dt = new Date(ped.created_at || Date.now());
            const alunoObj = listaAlunos.find((a) => a.id === ped.aluno_id || a.id === ped.user_id);
            const placasDoPedido = listaPlacas
              .filter((p) => ped.id && (p.pedido_id === ped.id || p.lote_id === ped.id))
              .sort((a, b) => extrairNumeroCodigo(a.codigo) - extrairNumeroCodigo(b.codigo));
            
            const temPlacas = placasDoPedido.length > 0;
            let codIni = temPlacas
              ? placasDoPedido[0].codigo
              : ped.codigo_inicio || (ped.intervalo ? ped.intervalo.split("→")[0]?.trim() : "");
            let codFim = temPlacas
              ? placasDoPedido[placasDoPedido.length - 1].codigo
              : ped.codigo_fim || (ped.intervalo ? ped.intervalo.split("→")[1]?.trim() : "");

            // Garantir ordenação numérica de menor para maior (ex: GP-0001 -> GP-0025)
            const nIni = extrairNumeroCodigo(codIni);
            const nFim = extrairNumeroCodigo(codFim);
            const minNum = Math.min(nIni, nFim);
            const maxNum = Math.max(nIni, nFim);
            if (minNum > 0 && maxNum > 0) {
              codIni = `GP-${String(minNum).padStart(4, "0")}`;
              codFim = `GP-${String(maxNum).padStart(4, "0")}`;
            }

            const temLote = Boolean(temPlacas || (codIni && codFim));

            let st = ped.status || "solicitado";
            const stLower = String(st).toLowerCase().trim();
            if (
              stLower === "aguardando" ||
              stLower === "aguardando aprovação" ||
              stLower === "aguardando aprovacao" ||
              stLower === "aguardando_aprovacao" ||
              stLower === "aguardando_pagamento" ||
              stLower === "pendente" ||
              stLower === "solicitado"
            ) {
              st = "solicitado";
            } else if (
              stLower === "em produção" ||
              stLower === "em producao" ||
              stLower === "em_producao" ||
              stLower === "aprovado"
            ) {
              st = "em_producao";
            } else if (stLower === "enviado") {
              st = "enviado";
            } else if (stLower === "entregue") {
              st = "entregue";
            } else if (
              stLower === "recusado" ||
              stLower === "rejeitado" ||
              stLower === "cancelado"
            ) {
              st = "recusado";
            }

            const isReposicao = (ped.observacao || "").includes("[REPOSIÇÃO PRÓPRIA");
            const nomeFinal = isReposicao
              ? "Fábrica GOPLAK (Estoque Central)"
              : alunoObj
              ? alunoObj.nome
              : (ped.destinatario || ped.aluno_nome || (ped.aluno_id ? "Aluno Parceiro" : "Distribuidor"));
            const emailFinal = isReposicao ? "fabrica@goplak.com" : (alunoObj?.email || ped.email || "");

            let compUrl = ped.comprovante_url || "";
            let modCor = ped.modelo_cor || "";
            let valTotal = Number(ped.valor_total) || 0;
            let endEntrega = ped.endereco_entrega || null;

            if (ped.observacao) {
              if (!compUrl && ped.observacao.includes("Comprovante: ")) {
                const matchC = ped.observacao.match(/Comprovante:\s*([^\s|]+)/);
                if (matchC && matchC[1] && matchC[1] !== "Anexado") compUrl = matchC[1];
              }
              if (!modCor && ped.observacao.includes("Cor: ")) {
                const matchK = ped.observacao.match(/Cor:\s*([^|]+)/);
                if (matchK) modCor = matchK[1].trim();
              }
            }

            const qtdFinal = ped.quantidade || (temPlacas ? placasDoPedido.length : 10);
            if (!valTotal) {
              valTotal = qtdFinal === 10 ? 170 : qtdFinal === 30 ? 510 : qtdFinal === 50 ? 800 : qtdFinal * 17;
            }

            return {
              id: ped.id,
              data: dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              alunoNome: nomeFinal,
              alunoEmail: emailFinal,
              alunoId: ped.aluno_id || ped.user_id,
              quantidade: qtdFinal,
              valorTotal: valTotal,
              modeloCor: modCor || (qtdFinal === 10 ? "5 Pretas / 5 Azuis" : "Misto"),
              enderecoEntrega: endEntrega,
              comprovanteUrl: compUrl,
              codigoInicio: codIni || "Não gerado",
              codigoFim: codFim || "Não gerado",
              status: st,
              temLoteGerado: temLote,
              codigoRastreio: ped.codigo_rastreio || "",
              transportadora: ped.transportadora || "Correios",
              aprovadoEm: ped.aprovado_em || "",
              enviadoEm: ped.enviado_em || "",
              entregueEm: ped.entregue_em || "",
              createdAt: ped.created_at || "",
              observacao: ped.observacao || ped.tipo || "",
              motivoRecusa: ped.motivo_recusa || "",
            };
          });
          setLotes(formatados);
          console.log("Lotes carregados no Admin:", formatados);
        } else {
          setLotes([]);
        }
      } catch (errPed) {
        console.warn("Aviso ao buscar lotes:", errPed);
      }

      // 6. Puxar Configuração da Fábrica (Estoque Físico & Custo Unitário)
      try {
        const { data: cfgData, error: cfgErr } = await supabase
          .from("config_fabrica")
          .select("*")
          .limit(1);

        if (!cfgErr && cfgData && cfgData.length > 0) {
          const cfg = cfgData[0] as any;
          setConfigFabricaId(cfg.id);
          if (cfg.custo_unitario_display !== undefined && cfg.custo_unitario_display !== null) {
            setCustoUnitarioDisplay(Number(cfg.custo_unitario_display));
          }
          if (cfg.estoque_displays_prontos !== undefined && cfg.estoque_displays_prontos !== null) {
            setEstoqueDisplaysProntos(Number(cfg.estoque_displays_prontos));
          }
          if (cfg.media_saida_diaria !== undefined && cfg.media_saida_diaria !== null) {
            setMediaSaidaDiaria(Number(cfg.media_saida_diaria));
          }

          // Disponibilidade de Kits para Alunos
          let kitsAtual: KitsDisponiveis = { ...KITS_DISPONIVEIS_PADRAO };
          if (typeof window !== "undefined") {
            const cacheKits = localStorage.getItem("goplak_kits_disponiveis");
            if (cacheKits) {
              try {
                kitsAtual = { ...kitsAtual, ...JSON.parse(cacheKits) };
              } catch (e) {}
            }
          }
          if (cfg.kits_disponiveis && typeof cfg.kits_disponiveis === "object") {
            kitsAtual = { ...kitsAtual, ...cfg.kits_disponiveis };
          } else if (cfg.dias_alerta_reposicao !== undefined && cfg.dias_alerta_reposicao !== null) {
            kitsAtual = decodeKitsFromCode(Number(cfg.dias_alerta_reposicao));
          }
          setKitsDisponiveis(kitsAtual);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("goplak_kits_disponiveis", JSON.stringify(kitsAtual));
            } catch (e) {}
          }
        } else {
          // Inserir registro inicial padrão caso a tabela esteja vazia
          try {
            const { data: insertedCfg } = await supabase
              .from("config_fabrica")
              .insert({
                custo_unitario_display: 12.30,
                estoque_displays_prontos: 0,
                media_saida_diaria: 2.5,
              })
              .select()
              .single();

            if (insertedCfg) {
              setConfigFabricaId(insertedCfg.id);
              setCustoUnitarioDisplay(Number(insertedCfg.custo_unitario_display));
              setEstoqueDisplaysProntos(Number(insertedCfg.estoque_displays_prontos));
              setMediaSaidaDiaria(Number(insertedCfg.media_saida_diaria));
            }
          } catch (initErr) {
            console.warn("Aviso ao inicializar config_fabrica padrão:", initErr);
          }
        }
      } catch (errCfg) {
        console.warn("Aviso ao consultar config_fabrica:", errCfg);
      }

      // 7. Puxar Movimentações do Caixa da Fábrica
      try {
        const { data: cxData, error: cxErr } = await supabase
          .from("caixa_fabrica")
          .select("*")
          .order("created_at", { ascending: false });

        if (!cxErr && cxData) {
          setItensCaixa(cxData);
        } else if (!cxErr) {
          setItensCaixa([]);
        }
      } catch (errCx) {
        console.warn("Aviso ao consultar caixa_fabrica:", errCx);
      }
    } catch (err) {
      console.error("Erro geral no fetchAdminData:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [alunoSelecionado]);

  useEffect(() => {
    fetchAdminData();

    // Sincronização em Tempo Real (Supabase Realtime) para o Administrador
    const channel = supabase
      .channel("admin_pedidos_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos_lotes" },
        (payload) => {
          console.log("[Realtime Admin] Novo pedido recebido:", payload);
          // 1. Toca SOMENTE quando um novo pedido é registrado no banco pelo aluno
          try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3");
            audio.volume = 0.45;
            audio.play().catch((err) => {
              console.log("Audio autoplay bloqueado ou erro:", err);
            });
          } catch (err) {
            console.log("Audio autoplay bloqueado ou erro:", err);
          }

          // 2. Alerta visual de novo pedido
          const qtd = payload.new?.quantidade || "";
          setFeedbackSucesso(`🔔 Novo pedido recebido! Lote de ${qtd} displays aguardando aprovação.`);

          // 3. Atualizar dados do painel imediatamente
          fetchAdminData();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos_lotes" },
        (payload) => {
          console.log("[Realtime Admin] Pedido atualizado:", payload);
          fetchAdminData();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pedidos_lotes" },
        () => {
          fetchAdminData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "placas" },
        (payload) => {
          console.log("[Realtime Admin] Placa alterada/inserida:", payload);
          fetchAdminData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAdminData]);

  // Auto-dismiss de 60 segundos com suporte a pauseOnHover para Toasts Flutuantes
  useEffect(() => {
    if (feedbackSucesso && !toastHovered) {
      const t = setTimeout(() => setFeedbackSucesso(null), 60000);
      return () => clearTimeout(t);
    }
  }, [feedbackSucesso, toastHovered]);

  useEffect(() => {
    if (erroMsg && !toastHovered) {
      const t = setTimeout(() => setErroMsg(null), 60000);
      return () => clearTimeout(t);
    }
  }, [erroMsg, toastHovered]);

  const diasRestantesMes = React.useMemo(() => {
    const agora = new Date();
    const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    return Math.max(1, ultimoDiaMes - agora.getDate());
  }, []);

  const pedidosAguardandoCount = React.useMemo(() => {
    return lotes.filter((l) => {
      const st = (l.status || "").toLowerCase().trim();
      return (
        st === "aguardando" ||
        st === "aguardando aprovação" ||
        st === "aguardando aprovacao" ||
        st === "solicitado" ||
        st === "pendente" ||
        st === "comprovante enviado"
      );
    }).length;
  }, [lotes]);

  const pedidosPendentes = React.useMemo(() => {
    return lotes.filter((l) => {
      const st = (l.status || "").toLowerCase().trim();
      return (
        st === "aguardando" ||
        st === "aguardando aprovação" ||
        st === "aguardando aprovacao" ||
        st === "solicitado" ||
        st === "pendente" ||
        st === "comprovante enviado"
      );
    });
  }, [lotes]);

  // Cálculos Financeiros Consolidados (Caixa Real & Estoque da Fábrica)
  const metricasFinanceiras = React.useMemo(() => {
    // 1. Filtrar lotes aprovados/ativos diretamente do banco
    const lotesAprovados = lotes.filter((l) => l.status === "em_producao" || l.status === "enviado" || l.status === "entregue");
    const idsPedidosValidos = new Set(lotesAprovados.map((l) => l.id));

    // 2. Entradas do caixa devem corresponder estritamente a pedidos aprovados ainda existentes
    const entradasCaixa = itensCaixa.filter(
      (item) => item.tipo === "ENTRADA" && (!item.pedido_id || idsPedidosValidos.has(item.pedido_id))
    );
    const saidasCaixa = itensCaixa.filter((item) => item.tipo === "SAIDA");

    let faturamentoBruto = 0;
    let custoMercadoriasVendidas = 0;

    if (lotesAprovados.length > 0) {
      if (entradasCaixa.length > 0) {
        faturamentoBruto = entradasCaixa.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
        custoMercadoriasVendidas = entradasCaixa.reduce((acc, item) => acc + (Number(item.custo_mercadoria) || 0), 0);
      } else {
        faturamentoBruto = lotesAprovados.reduce((acc, l) => acc + (Number(l.valorTotal) || 0), 0);
        const totalDisplaysVendidos = lotesAprovados.reduce((acc, l) => acc + (Number(l.quantidade) || 0), 0);
        custoMercadoriasVendidas = totalDisplaysVendidos * custoUnitarioDisplay;
      }
    }

    const despesasOperacionais = saidasCaixa.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const custosTotais = custoMercadoriasVendidas + despesasOperacionais;
    const lucroLiquidoReal = faturamentoBruto - custosTotais;

    const taxaSaida = mediaSaidaDiaria > 0 ? mediaSaidaDiaria : 2.5;
    const diasRestantesEstoque = estoqueDisplaysProntos > 0 ? estoqueDisplaysProntos / taxaSaida : 0;
    const alertaEstoqueCritico = estoqueDisplaysProntos <= 50;

    return {
      faturamentoBruto,
      custoMercadoriasVendidas,
      despesasOperacionais,
      custosTotais,
      lucroLiquidoReal,
      diasRestantesEstoque,
      alertaEstoqueCritico,
    };
  }, [itensCaixa, lotes, custoUnitarioDisplay, estoqueDisplaysProntos, mediaSaidaDiaria]);

  // Meses disponíveis para o filtro do extrato do caixa
  const mesesDisponiveisExtrato = React.useMemo(() => {
    const setMeses = new Set<string>();
    itensCaixa.forEach((item) => {
      if (item.created_at) {
        const d = new Date(item.created_at);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        setMeses.add(chave);
      }
    });
    // Se não tiver meses nos itens, adicionar mês atual
    const agora = new Date();
    const chaveAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    setMeses.add(chaveAtual);

    return Array.from(setMeses).sort().reverse();
  }, [itensCaixa]);

  // Itens do Caixa filtrados pelo seletor de mês
  const itensCaixaFiltrados = React.useMemo(() => {
    if (filtroMesExtrato === "todos") return itensCaixa;
    return itensCaixa.filter((item) => {
      if (!item.created_at) return false;
      const d = new Date(item.created_at);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return chave === filtroMesExtrato;
    });
  }, [itensCaixa, filtroMesExtrato]);

  // Métricas financeiras calculadas para o período selecionado no Extrato
  const metricasExtratoFiltrado = React.useMemo(() => {
    const lotesAprovados = lotes.filter((l) => l.status === "em_producao" || l.status === "enviado" || l.status === "entregue");
    const idsPedidosValidos = new Set(lotesAprovados.map((l) => l.id));

    const entradas = itensCaixaFiltrados.filter(
      (item) => item.tipo === "ENTRADA" && (!item.pedido_id || idsPedidosValidos.has(item.pedido_id))
    );
    const saidas = itensCaixaFiltrados.filter((item) => item.tipo === "SAIDA");

    const fatBruto = entradas.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const custosMercadorias = entradas.reduce((acc, item) => acc + (Number(item.custo_mercadoria) || 0), 0);
    const custosDespesas = saidas.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const custosTotais = custosMercadorias + custosDespesas;
    const lucroLiquido = fatBruto - custosTotais;

    return {
      faturamentoBruto: fatBruto,
      custosTotais,
      lucroLiquidoReal: lucroLiquido,
      totalEntradas: entradas.length,
      totalSaidas: saidas.length,
    };
  }, [itensCaixaFiltrados, lotes]);

  const popoverRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverNotificacoesAberto(false);
      }
    };
    if (popoverNotificacoesAberto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popoverNotificacoesAberto]);

  const handleVerPedidoNotificacao = (loteId: string) => {
    setFiltroStatus("pendentes");
    setPedidoDestacadoId(loteId);
    setPopoverNotificacoesAberto(false);

    setTimeout(() => {
      const el = document.getElementById(`pedido-row-${loteId}`) || document.getElementById("tabela-pedidos");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    setTimeout(() => {
      setPedidoDestacadoId(null);
    }, 4500);
  };

  const handleVerTodosPendentes = () => {
    setFiltroStatus("pendentes");
    setPopoverNotificacoesAberto(false);
    setTimeout(() => {
      const el = document.getElementById("tabela-pedidos");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  // Sincronizar quantidades de cores ao alterar a quantidade do lote ou a opção rápida
  useEffect(() => {
    if (opcaoCorManual === "misto") {
      setQtdPretaManual(Math.ceil(quantidadeLote / 2));
      setQtdAzulManual(Math.floor(quantidadeLote / 2));
    } else if (opcaoCorManual === "preta") {
      setQtdPretaManual(quantidadeLote);
      setQtdAzulManual(0);
    } else if (opcaoCorManual === "azul") {
      setQtdPretaManual(0);
      setQtdAzulManual(quantidadeLote);
    }
  }, [quantidadeLote, opcaoCorManual]);

  // Cálculos da Prévia Dinâmica com Reaproveitamento Inteligente (Gaps / Lacunas)
  const previewNumeros = obterProximosNumerosLivres(
    quantidadeLote > 0 ? quantidadeLote : 1,
    placasCadastradas
  );
  const previewCodigoInicio = `GP-${String(previewNumeros[0] || 1).padStart(4, "0")}`;
  const previewCodigoFim = `GP-${String(previewNumeros[previewNumeros.length - 1] || 1).padStart(4, "0")}`;

  // Gerar Novo Lote no Banco de Dados
  const handleGerarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantidadeLote <= 0) return;

    if (opcaoCorManual === "personalizado" && qtdPretaManual + qtdAzulManual !== quantidadeLote) {
      setErroMsg(`A soma das placas (${qtdPretaManual} Pretas + ${qtdAzulManual} Azuis = ${qtdPretaManual + qtdAzulManual}) deve ser exatamente igual ao total de ${quantidadeLote} displays.`);
      return;
    }

    setGerandoLote(true);
    setFeedbackSucesso(null);
    setErroMsg(null);

    try {
      // 1. Obter todos os códigos cadastrados no banco para identificar lacunas/gaps
      let checkPlacas: { codigo?: string }[] = [];
      const { data: placasData } = await supabase.from("placas").select("codigo");
      if (placasData && placasData.length > 0) {
        checkPlacas = placasData;
      } else {
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/placas?select=codigo`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) checkPlacas = data;
          }
        } catch (err) {
          console.warn("Fallback REST placas:", err);
        }
      }

      const numerosLivres = obterProximosNumerosLivres(quantidadeLote, checkPlacas);
      const codInicioStr = `GP-${String(numerosLivres[0]).padStart(4, "0")}`;
      const codFimStr = `GP-${String(numerosLivres[numerosLivres.length - 1]).padStart(4, "0")}`;

      const alunoAlvo = alunos.find((a) => a.id === alunoSelecionado) || alunos[0];
      const alunoUuid = alunoAlvo?.id || "403183b5-02f6-46a7-b448-7658c5087ec4";

      const modeloCorTexto = `${qtdPretaManual} Pretas / ${qtdAzulManual} Azuis`;

      const isReposicao = tipoEmissaoManual === "reposicao_propria";
      const unitCusto = custoUnitarioDisplay || COST_PER_UNIT;
      const valorTotalFinal = isReposicao
        ? Number((quantidadeLote * unitCusto).toFixed(2))
        : (quantidadeLote === 10 ? 170 : quantidadeLote === 20 ? 340 : quantidadeLote === 30 ? 510 : quantidadeLote === 50 ? 800 : quantidadeLote === 100 ? 1600 : quantidadeLote * 17.0);

      // 1. Inserir o pedido pai ANTES das placas com colunas estritas do banco
      const agoraIso = new Date().toISOString();
      const dadosPedido = {
        aluno_id: alunoUuid,
        quantidade: quantidadeLote,
        valor_total: valorTotalFinal,
        status: "em_producao",
        aprovado_em: agoraIso,
      };

      const { data: novoPedido, error: erroPedido } = await supabase
        .from('pedidos_lotes')
        .insert([dadosPedido])
        .select()
        .single();

      if (erroPedido) {
        console.error("Erro ao inserir pedido_lotes:", erroPedido);
        alert("Erro ao criar pedido: " + erroPedido.message);
        setErroMsg("Erro ao criar pedido: " + erroPedido.message);
        return;
      }

      const pedidoId = novoPedido.id;

      // 2. Criar as placas vinculadas ao pedido_id real gerado e aluno_id utilizando os números livres
      const novasPlacas = numerosLivres.map((num) => ({
        codigo: `GP-${String(num).padStart(4, "0")}`,
        status: "virgem" as const,
        valor_venda: 80.0,
        nome_empresa: "",
        link_google_review: "",
        whatsapp_feedback: "",
        aluno_id: alunoUuid,
        pedido_id: pedidoId,
      }));

      const { error: insertErr } = await supabase
        .from("placas")
        .insert(novasPlacas);

      if (insertErr) {
        console.error("Erro no insert de placas do Supabase:", insertErr);
        await fetch(`${SUPABASE_URL}/rest/v1/placas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(novasPlacas),
        });
      }

      // 3. Integração Automática com Caixa Real & Abatimento do Estoque Físico Central
      const custoTotalDisplays = quantidadeLote * unitCusto;
      const lucroBruto = valorTotalFinal - custoTotalDisplays;

      // Inserir registro de ENTRADA no caixa da fábrica
      try {
        await supabase.from("caixa_fabrica").insert({
          pedido_id: pedidoId || null,
          tipo: "ENTRADA",
          categoria: "Venda Lote",
          descricao: `Emissão Manual ${quantidadeLote} un - ${alunoAlvo?.nome || "Aluno Parceiro"}`,
          valor: valorTotalFinal,
          custo_mercadoria: custoTotalDisplays,
          lucro_liquido: lucroBruto,
        });
      } catch (errCaixa) {
        console.warn("Aviso ao registrar entrada em caixa_fabrica:", errCaixa);
      }

      // Abater estoque físico em config_fabrica
      try {
        let estoqueDb = estoqueDisplaysProntos;
        const { data: cfgLive } = await supabase.from("config_fabrica").select("*").limit(1);
        if (cfgLive && cfgLive.length > 0 && cfgLive[0].estoque_displays_prontos !== undefined) {
          estoqueDb = Number(cfgLive[0].estoque_displays_prontos);
        }
        const novoEstoque = Math.max(0, estoqueDb - quantidadeLote);
        if (configFabricaId) {
          await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", configFabricaId);
        } else if (cfgLive && cfgLive[0]?.id) {
          await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", cfgLive[0].id);
        } else {
          const { data: nCfg } = await supabase.from("config_fabrica").insert({
            estoque_displays_prontos: novoEstoque,
            custo_unitario_display: unitCusto,
            media_saida_diaria: mediaSaidaDiaria || 2.5,
          }).select().maybeSingle();
          if (nCfg?.id) setConfigFabricaId(nCfg.id);
        }
        setEstoqueDisplaysProntos(novoEstoque);
      } catch (eEst) {
        console.warn("Aviso ao abater estoque físico em config_fabrica:", eEst);
      }

      const msg = `Lote de ${quantidadeLote} placas (${qtdPretaManual} Pretas / ${qtdAzulManual} Azuis) criado com sucesso! Intervalo: ${codInicioStr} → ${codFimStr}. Estoque da fábrica atualizado.`;

      setFeedbackSucesso(msg);
      setModalEmissaoManualAberto(false);

      if (typeof window !== "undefined") {
        try {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (cErr) {}
      }

      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Falha ao gerar lote:", err);
      setErroMsg(`Erro ao gerar lote: ${msg}`);
      alert(`Aviso: ${msg}`);
    } finally {
      setGerandoLote(false);
    }
  };

  // Exportar Planilha da Gráfica com Imagens Físicas Reais (ExcelJS + QRCode)
  const handleBaixarPlanilhaGrafica = async (lote: LoteExport) => {
    try {
      setExportandoId(lote.id);

      // 1. Obter placas do lote com busca rigorosa
      let placasDoLote: { codigo: string; status?: string; [key: string]: any }[] = [];

      // Tentativa A: Buscar pelo pedido_id no Supabase se for UUID
      if (lote.id && !lote.id.startsWith("lote-")) {
        try {
          const { data: pPed } = await supabase
            .from("placas")
            .select("*")
            .eq("pedido_id", lote.id);

          if (pPed && pPed.length > 0) {
            placasDoLote = pPed;
          }
        } catch (ePed) {
          console.warn("Aviso ao buscar placas por pedido_id:", ePed);
        }
      }

      // Tentativa B: Se não encontrou por pedido_id, calcular por intervalo numérico de códigos
      const n1 = extrairNumeroCodigo(lote.codigoInicio) || 1;
      const n2 = extrairNumeroCodigo(lote.codigoFim) || (lote.quantidade || 25);
      const numInicio = Math.min(n1, n2);
      const numFim = Math.max(n1, n2);

      if (placasDoLote.length === 0) {
        for (let i = numInicio; i <= numFim; i++) {
          const cod = `GP-${String(i).padStart(4, "0")}`;
          placasDoLote.push({ codigo: cod, status: "virgem" });
        }
      }

      // Ordenação rigorosa estritamente numérica
      placasDoLote.sort((a, b) => extrairNumeroCodigo(a.codigo) - extrairNumeroCodigo(b.codigo));

      // Determinar Base URL para o link dinâmico da placa
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "http://localhost:3000");

      const codIniLabel = placasDoLote[0]?.codigo || `GP-${String(numInicio).padStart(4, "0")}`;
      const codFimLabel = placasDoLote[placasDoLote.length - 1]?.codigo || `GP-${String(numFim).padStart(4, "0")}`;
      
      // Resolução Dinâmica e Confiável do Destinatário
      let destinatarioNome = "";
      if (lote.alunoId) {
        const alunoObj = alunos.find((a) => a.id === lote.alunoId);
        if (alunoObj) {
          destinatarioNome = alunoObj.nome || alunoObj.email || "";
        } else {
          try {
            const { data: aData } = await supabase
              .from("alunos")
              .select("nome, email")
              .eq("id", lote.alunoId)
              .maybeSingle();
            if (aData) {
              destinatarioNome = aData.nome || aData.email || "";
            }
          } catch (eAl) {
            console.warn("Aviso busca aluno do lote:", eAl);
          }
        }
      }
      if (!destinatarioNome && lote.alunoNome && !lote.alunoNome.includes("Demo") && !lote.alunoNome.includes("Parceiro")) {
        destinatarioNome = lote.alunoNome;
      }
      if (!destinatarioNome) {
        destinatarioNome = "GOPlak";
      }

      const { pretas, azuis } = extrairQtdCores(lote);

      // Se o pedido tiver mais de 50 displays, exportar automaticamente em fatias de 50 un dentro de arquivo ZIP
      if (placasDoLote.length > 50) {
        const displays: DisplayItem[] = placasDoLote.map((p, idx) => ({
          id: p.id,
          code: p.codigo,
          model_color: idx < pretas ? "Preto" : "Azul",
          target_url: `https://www.goplak.com.br/d/${p.codigo}`,
          qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://www.goplak.com.br/d/${p.codigo}`,
        }));
        await exportarLoteEmFatiasZip(lote.id || `${codIniLabel}_${codFimLabel}`, displays);
        setFeedbackSucesso(`Pedido ${codIniLabel} a ${codFimLabel} (${placasDoLote.length} un) exportado em fatias de 50 (ZIP) com sucesso!`);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GOPLAK";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Produção Gráfica", {
        views: [{ showGridLines: true }],
      });

      // Definição das 6 Colunas da Planilha com a Cor do Display explícita
      worksheet.columns = [
        { header: "Código da Placa", key: "codigo", width: 18 },
        { header: "Cor / Modelo", key: "cor", width: 18 },
        { header: "Link Dinâmico", key: "link", width: 45 },
        { header: "QR Code Gráfica", key: "qrcode", width: 50 },
        { header: "Status de Fábrica", key: "status", width: 20 },
        { header: "Destinatário", key: "destinatario", width: 28 },
      ];

      // Estilo do Cabeçalho
      const headerRow = worksheet.getRow(1);
      headerRow.height = 32;
      headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1A1A1A" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      // Preenchimento de Cada Linha do Arquivo Excel (com divisão correta de cores)
      let currentRowIndex = 2;
      for (let i = 0; i < placasDoLote.length; i++) {
        const placa = placasDoLote[i];
        const cod = placa.codigo;
        const corPlaca = i < pretas ? "Preta" : "Azul";
        const linkDinamico = `${appBaseUrl}/r/${cod}`;
        const qrCodeGraficaUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(linkDinamico)}`;

        // Linha com altura para QR Code e dados legíveis
        const row = worksheet.addRow({
          codigo: cod,
          cor: corPlaca,
          link: linkDinamico,
          qrcode: qrCodeGraficaUrl,
          status: "Virgem",
          destinatario: destinatarioNome,
        });

        row.height = 80;
        row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

        // Estilização das células
        const cellCod = row.getCell("codigo");
        cellCod.font = { name: "Arial", size: 12, bold: true };
        
        const cellCor = row.getCell("cor");
        cellCor.font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: corPlaca === "Azul" ? "FF1D4ED8" : "FF111827" },
        };

        const cellLink = row.getCell("link");
        cellLink.font = { name: "Arial", size: 10, color: { argb: "FF0044CC" }, underline: true };

        const cellQr = row.getCell("qrcode");
        cellQr.font = { name: "Arial", size: 9, color: { argb: "FF006622" } };

        const cellStatus = row.getCell("status");
        cellStatus.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF107C41" } };

        const cellDest = row.getCell("destinatario");
        cellDest.font = { name: "Arial", size: 11 };

        // Gera e embute o QR Code visualmente no arquivo
        try {
          const qrDataUrl = await QRCode.toDataURL(linkDinamico, {
            width: 300,
            margin: 1,
            errorCorrectionLevel: "H",
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });

          const imageId = workbook.addImage({
            base64: qrDataUrl,
            extension: "png",
          });

          worksheet.addImage(imageId, {
            tl: { col: 3.15, row: currentRowIndex - 1 + 0.05 },
            ext: { width: 95, height: 95 },
          });
        } catch (eQr) {
          console.warn("Aviso ao desenhar QR code:", eQr);
        }

        currentRowIndex++;
      }

      // Gera o buffer nativo do Excel (.xlsx)
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Dispara o download no navegador
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lote_grafica_${codIniLabel}_${codFimLabel}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (err) {
      console.error("Erro ao gerar Excel para gráfica:", err);
      alert("Erro ao processar imagens no arquivo Excel.");
    } finally {
      setExportandoId(null);
    }
  };

  // Atualizar status do pedido de lote em tempo real no Supabase
  const handleUpdateStatusLote = async (loteId: string, novoStatus: string) => {
    try {
      const validos = ["solicitado", "em_producao", "enviado", "entregue"];
      const statusSanitizado = validos.includes(novoStatus) ? novoStatus : "solicitado";

      setLotes((prev) =>
        prev.map((l) => (l.id === loteId ? { ...l, status: statusSanitizado } : l))
      );

      if (loteId && !loteId.startsWith("lote-")) {
        const { error } = await supabase
          .from("pedidos_lotes")
          .update({ status: statusSanitizado })
          .eq("id", loteId);

        if (error) {
          console.error("Erro detalhado update status:", error);
          setErroMsg(`Erro: ${error.message || "Falha ao atualizar status"}`);
        } else {
          if (statusSanitizado === "entregue") {
            const loteObj = lotes.find((l) => l.id === loteId);
            if (loteObj?.alunoId) {
              try {
                await supabase
                  .from("placas")
                  .update({ aluno_id: loteObj.alunoId })
                  .eq("pedido_id", loteId);
              } catch (eSync) {
                console.warn("Aviso sync placas entregues:", eSync);
              }
            }
          }
          setFeedbackSucesso(`Status do pedido atualizado para "${statusSanitizado.replace("_", " ")}".`);
          await fetchAdminData();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro detalhado update status:", err);
      setErroMsg(`Erro: ${msg}`);
    }
  };

  // Salvar código de rastreio de envio (Correios, Loggi, Jadlog...)
  const handleSalvarRastreio = async (loteId: string, rastreio: string) => {
    const rastreioLimpo = rastreio.trim();
    console.log(`Salvando rastreio "${rastreioLimpo}" para lote ${loteId}`);

    setLotes((prev) =>
      prev.map((l) =>
        l.id === loteId
          ? {
              ...l,
              codigoRastreio: rastreioLimpo,
              status: rastreioLimpo && (l.status === "em_producao" || l.status === "solicitado") ? "enviado" : l.status,
            }
          : l
      )
    );

    if (loteId && !loteId.startsWith("lote-")) {
      try {
        const updatePayload: Record<string, string> = { codigo_rastreio: rastreioLimpo };
        if (rastreioLimpo) {
          updatePayload.status = "enviado";
        }

        const { error } = await supabase
          .from("pedidos_lotes")
          .update(updatePayload)
          .eq("id", loteId);

        if (error) {
          console.error("Erro ao salvar código de rastreio:", error);
          // Se for erro de coluna inexistente, avisar com clareza
          if (error.message?.includes("codigo_rastreio")) {
            setErroMsg("Coluna codigo_rastreio não encontrada no banco. Execute o script SQL no Supabase para criá-la.");
          } else {
            setErroMsg(`Erro ao salvar rastreio: ${error.message}`);
          }
        } else {
          setFeedbackSucesso(`Código de rastreio "${rastreioLimpo}" salvo com sucesso!`);
          await fetchAdminData();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Erro inesperado no rastreio:", err);
        setErroMsg(`Erro: ${msg}`);
      }
    }
  };

  // Gerar displays/lote a partir de um pedido solicitado pelo aluno
  const handleGerarLoteDePedido = async (lote: LoteExport) => {
    setGerandoPedidoId(lote.id);
    setFeedbackSucesso(null);
    setErroMsg(null);
    console.log("Iniciando geração de displays para o pedido solicitado:", lote);

    try {
      // 1. Consultar todos os códigos existentes para reaproveitamento inteligente
      let checkPlacas: { codigo?: string }[] = [];
      const { data: placasData, error: errPlacas } = await supabase
        .from("placas")
        .select("codigo");

      if (!errPlacas && placasData) {
        checkPlacas = placasData;
      } else {
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/placas?select=codigo`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) checkPlacas = data;
          }
        } catch (restErr) {
          console.error("Erro no fallback REST de placas:", restErr);
        }
      }

      const qtd = lote.quantidade > 0 ? lote.quantidade : 20;
      const numerosLivres = obterProximosNumerosLivres(qtd, checkPlacas);
      const codInicioStr = `GP-${String(numerosLivres[0]).padStart(4, "0")}`;
      const codFimStr = `GP-${String(numerosLivres[numerosLivres.length - 1]).padStart(4, "0")}`;

      console.log(`Sequência inteligente calculada: ${codInicioStr} a ${codFimStr} (${qtd} displays)`);

      // 2. Montar array de novas placas virgens
      const novasPlacas: PlacaRecord[] = numerosLivres.map((num) => ({
        codigo: `GP-${String(num).padStart(4, "0")}`,
        aluno_id: lote.alunoId || "00000000-0000-0000-0000-000000000001",
        pedido_id: lote.id.startsWith("lote-") ? undefined : lote.id,
        status: "virgem",
        valor_venda: 80.0,
        escudo_ativo: true,
      }));

      // 3. Inserir placas no banco
      const { error: errInsertPlacas } = await supabase
        .from("placas")
        .insert(novasPlacas);

      if (errInsertPlacas) {
        console.error("Erro ao inserir placas do lote:", errInsertPlacas);
        throw new Error(errInsertPlacas.message);
      }

      // 4. Atualizar pedido para status 'em_producao'
      if (!lote.id.startsWith("lote-")) {
        const { error: errUpPed } = await supabase
          .from("pedidos_lotes")
          .update({
            status: "em_producao",
          })
          .eq("id", lote.id);

        if (errUpPed) {
          console.warn("Aviso ao atualizar pedido:", errUpPed);
        }
      }

      setFeedbackSucesso(`Lote ${codInicioStr} a ${codFimStr} (${qtd} displays) gerado com sucesso para ${lote.alunoNome}!`);
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao gerar lote do pedido:", err);
      setErroMsg(`Falha ao gerar lote: ${msg}`);
    } finally {
      setGerandoPedidoId(null);
    }
  };

  // Aprovar Pedido e liberar Displays Virgens automaticamente
  const handleAprovarPedido = async (lote: LoteExport) => {
    setProcessandoAcaoId(lote.id);
    setFeedbackSucesso(null);
    setErroMsg(null);

    try {
      // 1. Consultar todos os códigos existentes para reaproveitamento inteligente
      let checkPlacas: { codigo?: string }[] = [];
      const { data: placasData, error: errPlacas } = await supabase
        .from("placas")
        .select("codigo");

      if (!errPlacas && placasData) {
        checkPlacas = placasData;
      } else {
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/placas?select=codigo`, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) checkPlacas = data;
          }
        } catch (restErr) {
          console.error("Erro no fallback REST de placas:", restErr);
        }
      }

      const qtd = lote.quantidade > 0 ? lote.quantidade : 10;
      const numerosLivres = obterProximosNumerosLivres(qtd, checkPlacas);
      const codInicioStr = `GP-${String(numerosLivres[0]).padStart(4, "0")}`;
      const codFimStr = `GP-${String(numerosLivres[numerosLivres.length - 1]).padStart(4, "0")}`;

      // 2. Montar array de novas placas virgens vinculadas ao aluno
      const novasPlacas: PlacaRecord[] = numerosLivres.map((num) => ({
        codigo: `GP-${String(num).padStart(4, "0")}`,
        aluno_id: lote.alunoId || "403183b5-02f6-46a7-b448-7658c5087ec4",
        pedido_id: lote.id.startsWith("lote-") ? undefined : lote.id,
        status: "virgem",
        valor_venda: 80.0,
        escudo_ativo: true,
      }));

      // 3. Inserir placas no banco
      const { error: errInsertPlacas } = await supabase
        .from("placas")
        .insert(novasPlacas);

      if (errInsertPlacas) {
        console.error("Erro ao inserir placas do pedido aprovado:", errInsertPlacas);
        throw new Error(errInsertPlacas.message);
      }

      // 4. Atualizar pedido para status 'em_producao' e salvar aprovado_em
      const agoraIso = new Date().toISOString();
      if (!lote.id.startsWith("lote-")) {
        const { error: errUpPed } = await supabase
          .from("pedidos_lotes")
          .update({
            status: "em_producao",
            aprovado_em: agoraIso,
          })
          .eq("id", lote.id);

        if (errUpPed) {
          console.warn("Fallback update status pedido:", errUpPed);
          await supabase
            .from("pedidos_lotes")
            .update({ status: "em_producao", aprovado_em: agoraIso })
            .eq("id", lote.id);
        }
      }

      // 5. Integração Automática com Caixa Real & Estoque Físico da Fábrica (Apenas para Venda Comercial de Alunos)
      const isReposicaoPropria = (lote.observacao || "").includes("[REPOSIÇÃO PRÓPRIA") || (lote.alunoNome || "").includes("Fábrica");
      if (!isReposicaoPropria) {
        let custoUnit = custoUnitarioDisplay || COST_PER_UNIT;
        let estoqueAtual = estoqueDisplaysProntos;
        try {
          const { data: cfgLive } = await supabase.from("config_fabrica").select("*").limit(1);
          if (cfgLive && cfgLive.length > 0) {
            if (cfgLive[0].custo_unitario_display !== undefined) custoUnit = Number(cfgLive[0].custo_unitario_display);
            if (cfgLive[0].estoque_displays_prontos !== undefined) estoqueAtual = Number(cfgLive[0].estoque_displays_prontos);
          }
        } catch (errCfgLive) {
          console.warn("Aviso ao consultar config_fabrica ao vivo:", errCfgLive);
        }

        const valPedido = Number(lote.valorTotal) || (qtd === 10 ? 170 : qtd === 30 ? 510 : qtd === 50 ? 800 : qtd * 17);
        const custoTotalDisplays = qtd * custoUnit;
        const lucroBruto = valPedido - custoTotalDisplays;

        // Inserir registro de ENTRADA no caixa da fábrica
        try {
          await supabase.from("caixa_fabrica").insert({
            pedido_id: lote.id.startsWith("lote-") ? null : lote.id,
            tipo: "ENTRADA",
            categoria: "Venda Lote",
            descricao: `Lote ${qtd} un - ${lote.alunoNome || "Aluno Parceiro"}`,
            valor: valPedido,
            custo_mercadoria: custoTotalDisplays,
            lucro_liquido: lucroBruto,
          });
        } catch (errCaixa) {
          console.warn("Aviso ao registrar entrada em caixa_fabrica:", errCaixa);
        }

        // Abater estoque físico em config_fabrica
        const novoEstoque = Math.max(0, estoqueAtual - qtd);
        try {
          if (configFabricaId) {
            await supabase
              .from("config_fabrica")
              .update({ estoque_displays_prontos: novoEstoque })
              .eq("id", configFabricaId);
          } else {
            const { data: newCfg } = await supabase
              .from("config_fabrica")
              .insert({
                custo_unitario_display: custoUnit,
                estoque_displays_prontos: novoEstoque,
                media_saida_diaria: mediaSaidaDiaria,
              })
              .select()
              .single();
            if (newCfg) setConfigFabricaId(newCfg.id);
          }
          setEstoqueDisplaysProntos(novoEstoque);
        } catch (errEstoque) {
          console.warn("Aviso ao abater estoque físico em config_fabrica:", errEstoque);
        }
      }

      // Celebração e feedback
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });

      setFeedbackSucesso(`🎉 Pedido aprovado! Lote ${codInicioStr} a ${codFimStr} (${qtd} displays) liberado para ${lote.alunoNome}. Caixa e Estoque atualizados!`);
      setModalComprovanteAberto(false);
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao aprovar pedido:", err);
      setErroMsg(`Falha ao aprovar pedido: ${msg}`);
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  // Lançar Despesa / Frete no Caixa da Fábrica
  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(despesaValor.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      setErroMsg("Informe um valor válido em reais (R$) para a despesa.");
      return;
    }

    setSalvandoDespesa(true);
    try {
      const { error: errInsert } = await supabase.from("caixa_fabrica").insert({
        tipo: "SAIDA",
        categoria: despesaCategoria,
        descricao: despesaDescricao.trim() || `Despesa com ${despesaCategoria}`,
        valor: val,
        custo_mercadoria: val,
        lucro_liquido: -val,
      });

      if (errInsert) throw new Error(errInsert.message);

      setFeedbackSucesso(`💸 Despesa de R$ ${val.toFixed(2)} (${despesaCategoria}) lançada no caixa com sucesso!`);
      setModalDespesaAberto(false);
      setDespesaDescricao("");
      setDespesaValor("");
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao lançar despesa:", err);
      setErroMsg(`Falha ao lançar despesa: ${msg}`);
    } finally {
      setSalvandoDespesa(false);
    }
  };

  // Repor Estoque Físico com Fornecedor
  const handleSalvarReposicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtdAdd = Number(reposicaoQtd);
    if (isNaN(qtdAdd) || qtdAdd <= 0) {
      setErroMsg("Informe uma quantidade válida de displays recebidos.");
      return;
    }

    const custoUnit = parseFloat(reposicaoCustoUnitario.replace(",", ".")) || 12.30;
    const custoTotal = qtdAdd * custoUnit;

    setSalvandoReposicao(true);
    try {
      // 1. Atualizar estoque_displays_prontos em config_fabrica
      const novoEstoque = estoqueDisplaysProntos + qtdAdd;
      if (configFabricaId) {
        await supabase
          .from("config_fabrica")
          .update({
            estoque_displays_prontos: novoEstoque,
            custo_unitario_display: custoUnit,
          })
          .eq("id", configFabricaId);
      } else {
        const { data: newCfg } = await supabase
          .from("config_fabrica")
          .insert({
            custo_unitario_display: custoUnit,
            estoque_displays_prontos: novoEstoque,
            media_saida_diaria: mediaSaidaDiaria,
          })
          .select()
          .single();
        if (newCfg) setConfigFabricaId(newCfg.id);
      }
      setEstoqueDisplaysProntos(novoEstoque);
      setCustoUnitarioDisplay(custoUnit);

      // 2. Se marcado para registrar despesa no caixa, inserir SAÍDA
      if (reposicaoLancarDespesa && custoTotal > 0) {
        await supabase.from("caixa_fabrica").insert({
          tipo: "SAIDA",
          categoria: "Reposição Fornecedor",
          descricao: `Compra de ${qtdAdd} displays prontos (${qtdAdd} un x R$ ${custoUnit.toFixed(2)})`,
          valor: custoTotal,
          custo_mercadoria: custoTotal,
          lucro_liquido: -custoTotal,
        });
      }

      setFeedbackSucesso(`📦 Estoque reposto com sucesso! +${qtdAdd} displays adicionados (Estoque Atual: ${novoEstoque} un).`);
      setModalReposicaoAberto(false);
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao repor estoque:", err);
      setErroMsg(`Falha ao repor estoque: ${msg}`);
    } finally {
      setSalvandoReposicao(false);
    }
  };

  // Abrir Modal de Ajuste Direto / Calibração de Estoque Físico
  const handleAbrirAjusteEstoque = () => {
    setInputNovoEstoque(estoqueDisplaysProntos);
    setModalAjustarEstoqueAberto(true);
  };

  // Salvar Ajuste Manual / Calibração Direta do Estoque
  const handleSalvarAjusteEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorAjustado = Math.max(0, Number(inputNovoEstoque) || 0);

    setSalvandoAjusteEstoque(true);
    try {
      if (configFabricaId) {
        await supabase
          .from("config_fabrica")
          .update({ estoque_displays_prontos: valorAjustado })
          .eq("id", configFabricaId);
      } else {
        const { data: newCfg } = await supabase
          .from("config_fabrica")
          .insert({
            estoque_displays_prontos: valorAjustado,
            custo_unitario_display: custoUnitarioDisplay || 12.30,
            media_saida_diaria: mediaSaidaDiaria || 2.5,
          })
          .select()
          .single();
        if (newCfg) setConfigFabricaId(newCfg.id);
      }

      setEstoqueDisplaysProntos(valorAjustado);
      setFeedbackSucesso(`⚖️ Estoque da fábrica calibrado com sucesso para ${valorAjustado} un!`);
      setModalAjustarEstoqueAberto(false);
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao calibrar estoque:", err);
      setErroMsg(`Falha ao ajustar estoque: ${msg}`);
    } finally {
      setSalvandoAjusteEstoque(false);
    }
  };

  // Controle de Disponibilidade de Kits para Alunos
  const handleToggleKitDisponibilidade = async (kitKey: "start" | "pro" | "master") => {
    const novoValor = !kitsDisponiveis[kitKey];
    const novoEstado: KitsDisponiveis = {
      ...kitsDisponiveis,
      [kitKey]: novoValor,
    };
    setKitsDisponiveis(novoEstado);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("goplak_kits_disponiveis", JSON.stringify(novoEstado));
      } catch (e) {}
    }

    setSalvandoKits(true);
    try {
      const code = encodeKitsToCode(novoEstado);
      if (configFabricaId) {
        await supabase
          .from("config_fabrica")
          .update({ dias_alerta_reposicao: code })
          .eq("id", configFabricaId);
      } else {
        const { data: cfgLive } = await supabase.from("config_fabrica").select("id").limit(1);
        if (cfgLive && cfgLive.length > 0) {
          await supabase
            .from("config_fabrica")
            .update({ dias_alerta_reposicao: code })
            .eq("id", cfgLive[0].id);
        }
      }
      setFeedbackSucesso(`📦 Kit ${kitKey === "start" ? "Start" : kitKey === "pro" ? "Pro" : "Master"} ${novoValor ? "liberado" : "bloqueado"} com sucesso!`);
    } catch (err) {
      console.warn("Aviso ao salvar disponibilidade de kit no Supabase:", err);
    } finally {
      setSalvandoKits(false);
    }
  };


  // Exportar Relatório em PDF Formatado do Extrato de Caixa
  const handleExportarPdfExtrato = () => {
    setGerandoPdfExtrato(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Título e Rótulo do Período
      const labelPeriodo =
        filtroMesExtrato === "todos"
          ? "Histórico Completo (Todos os Meses)"
          : (() => {
              const [ano, mes] = filtroMesExtrato.split("-");
              const d = new Date(Number(ano), Number(mes) - 1, 1);
              return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            })();

      // Cabeçalho Principal com Barra Estilizada
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("GOPLAK - EXTRATO DO CAIXA DA FÁBRICA", 14, 12);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Período de Referência: ${labelPeriodo}`, 14, 18);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 23);

      // Caixa de Resumo Executivo Financeiro
      const startY = 35;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(14, startY, 182, 24, 3, 3, "FD");

      // Coluna 1: Faturamento Bruto
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("FATURAMENTO BRUTO", 20, startY + 8);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`R$ ${metricasExtratoFiltrado.faturamentoBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, startY + 16);

      // Coluna 2: Custos & Despesas
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text("CUSTOS & SAÍDAS", 80, startY + 8);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72);
      doc.text(`R$ ${metricasExtratoFiltrado.custosTotais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 80, startY + 16);

      // Coluna 3: Lucro Líquido Real
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text("LUCRO LÍQUIDO REAL", 140, startY + 8);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(5, 150, 105);
      doc.text(`R$ ${metricasExtratoFiltrado.lucroLiquidoReal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 140, startY + 16);

      // Dados da Tabela
      const tableData = itensCaixaFiltrados.map((item) => {
        const isEntrada = item.tipo === "ENTRADA";
        const dt = item.created_at ? new Date(item.created_at) : new Date();
        const dataFormatada = `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        const valorFormatado = `${isEntrada ? "+" : "-"} R$ ${Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        const lucroFormatado = isEntrada && item.lucro_liquido !== undefined
          ? `R$ ${Number(item.lucro_liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : "-";

        return [
          dataFormatada,
          item.tipo,
          item.categoria || "Operacional",
          item.descricao,
          valorFormatado,
          lucroFormatado,
        ];
      });

      // Renderização com autoTable
      autoTable(doc, {
        startY: startY + 30,
        head: [["Data/Hora", "Tipo", "Categoria", "Descrição", "Valor (R$)", "Lucro Líq."]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "left",
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 18, fontStyle: "bold" },
          2: { cellWidth: 32 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 26, halign: "right", fontStyle: "bold" },
          5: { cellWidth: 22, halign: "right" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const val = String(data.cell.raw);
            if (val === "ENTRADA") {
              data.cell.styles.textColor = [5, 150, 105]; // emerald
            } else {
              data.cell.styles.textColor = [225, 29, 72]; // rose
            }
          }
          if (data.section === "body" && data.column.index === 4) {
            const val = String(data.cell.raw);
            if (val.startsWith("+")) {
              data.cell.styles.textColor = [5, 150, 105];
            } else {
              data.cell.styles.textColor = [225, 29, 72];
            }
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Rodapé da página
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `GOPLAK Gestão Distribuidor • Página ${i} de ${pageCount}`,
          14,
          doc.internal.pageSize.getHeight() - 8
        );
      }

      // Download do PDF
      const sanitizedPeriodo = filtroMesExtrato.replace(/[^a-zA-Z0-9-]/g, "_");
      doc.save(`GOPLAK_Extrato_Caixa_${sanitizedPeriodo}_${Date.now()}.pdf`);
      setFeedbackSucesso("📄 Relatório em PDF do Extrato gerado com sucesso!");
    } catch (errPdf) {
      console.error("Erro ao gerar PDF do extrato:", errPdf);
      alert("Erro ao gerar PDF: " + (errPdf instanceof Error ? errPdf.message : String(errPdf)));
    } finally {
      setGerandoPdfExtrato(false);
    }
  };

  // Abrir Modal de Despacho / Informar Rastreio
  const handleAbrirDespacho = (lote: LoteExport) => {
    setPedidoDespachando(lote);
    setTransportadoraInput(lote.transportadora || "Correios");
    setRastreioInput(lote.codigoRastreio || "");
    setModalDespachoAberto(true);
  };

  // Confirmar Despacho do Pedido
  const handleConfirmarDespacho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoDespachando) return;

    setSalvandoDespacho(true);
    const agoraIso = new Date().toISOString();
    const rastreioLimpo = rastreioInput.trim();
    const transpLimpa = transportadoraInput.trim() || "Correios";

    try {
      const updatePayload = {
        status: "enviado",
        codigo_rastreio: rastreioLimpo,
        transportadora: transpLimpa,
        enviado_em: agoraIso,
      };

      if (!pedidoDespachando.id.startsWith("lote-")) {
        const { error } = await supabase
          .from("pedidos_lotes")
          .update(updatePayload)
          .eq("id", pedidoDespachando.id);

        if (error) {
          console.error("Erro ao salvar despacho:", error);
          throw new Error(error.message);
        }
      }

      setLotes((prev) =>
        prev.map((l) =>
          l.id === pedidoDespachando.id
            ? {
                ...l,
                status: "enviado",
                codigoRastreio: rastreioLimpo,
                transportadora: transpLimpa,
                enviadoEm: agoraIso,
              }
            : l
        )
      );

      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.6 },
      });

      setFeedbackSucesso(`📦 Pedido de ${pedidoDespachando.alunoNome} despachado via ${transpLimpa}! Rastreio: ${rastreioLimpo || "Sem código"}`);
      setModalDespachoAberto(false);
      setPedidoDespachando(null);
      await fetchAdminData();
    } catch (err: any) {
      console.error("Erro ao despachar pedido:", err);
      setErroMsg(`Erro ao despachar pedido: ${err.message || String(err)}`);
    } finally {
      setSalvandoDespacho(false);
    }
  };

  // Confirmar Entrega do Pedido pelo Admin
  const handleMarcarEntregue = async (lote: LoteExport) => {
    setProcessandoAcaoId(lote.id);
    const agoraIso = new Date().toISOString();

    try {
      if (!lote.id.startsWith("lote-")) {
        const { error } = await supabase
          .from("pedidos_lotes")
          .update({
            status: "entregue",
            entregue_em: agoraIso,
          })
          .eq("id", lote.id);

        if (error) throw new Error(error.message);

        // Sincronizar placas virgens vinculadas ao aluno
        if (lote.alunoId) {
          try {
            await supabase
              .from("placas")
              .update({ aluno_id: lote.alunoId })
              .eq("pedido_id", lote.id);
          } catch (eSync) {
            console.warn("Aviso sync placas entregues:", eSync);
          }
        }
      }

      setLotes((prev) =>
        prev.map((l) =>
          l.id === lote.id
            ? {
                ...l,
                status: "entregue",
                entregueEm: agoraIso,
              }
            : l
        )
      );

      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 },
      });

      setFeedbackSucesso(`✅ Pedido de ${lote.alunoNome} marcado como ENTREGUE! Displays virgens liberados no estoque.`);
      await fetchAdminData();
    } catch (err: any) {
      console.error("Erro ao marcar entregue:", err);
      setErroMsg(`Erro ao marcar pedido como entregue: ${err.message || String(err)}`);
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  // Abrir Modal de Visualização do Comprovante
  const handleAbrirComprovante = (lote: LoteExport) => {
    setPedidoSelecionadoComprovante(lote);
    setModalComprovanteAberto(true);
  };

  // Abrir Modal de Recusa de Pedido
  const handleAbrirModalRecusa = (lote: LoteExport) => {
    setPedidoRecusando(lote);
    setMotivoRecusaInput("");
    setModalRecusarAberto(true);
  };

  // Confirmar Recusa do Pedido
  const handleConfirmarRecusaPedido = async () => {
    if (!pedidoRecusando) return;

    setProcessandoAcaoId(pedidoRecusando.id);
    const motivo = motivoRecusaInput.trim() || "Comprovante ilegível ou divergente";

    try {
      if (!pedidoRecusando.id.startsWith("lote-")) {
        const { error } = await supabase
          .from("pedidos_lotes")
          .update({
            status: "recusado",
            observacao: pedidoRecusando.observacao
              ? `${pedidoRecusando.observacao} | Motivo Recusa: ${motivo}`
              : `Motivo Recusa: ${motivo}`,
          })
          .eq("id", pedidoRecusando.id);

        if (error) {
          console.error("Erro ao recusar pedido:", error);
          throw new Error(error.message);
        }

        // Se o pedido estava aprovado ou gerou placas antes de ser recusado, estornar estoque e limpar caixa
        const qtdEstorno = Number(pedidoRecusando.quantidade) || 0;
        const stAntigo = (pedidoRecusando.status || "").toLowerCase().trim();
        const estavaAprovado = stAntigo === "em_producao" || stAntigo === "enviado" || stAntigo === "entregue" || pedidoRecusando.temLoteGerado;

        if (estavaAprovado) {
          // 1. Remover lançamentos no caixa_fabrica deste pedido
          try {
            await supabase.from("caixa_fabrica").delete().eq("pedido_id", pedidoRecusando.id);
          } catch (eCx) {
            console.warn("Aviso ao remover caixa_fabrica do pedido recusado:", eCx);
          }

          // 2. Devolver estoque físico para a fábrica
          if (qtdEstorno > 0) {
            try {
              let estoqueDb = estoqueDisplaysProntos;
              const { data: cfgLive } = await supabase.from("config_fabrica").select("*").limit(1);
              if (cfgLive && cfgLive.length > 0 && cfgLive[0].estoque_displays_prontos !== undefined) {
                estoqueDb = Number(cfgLive[0].estoque_displays_prontos);
              }
              const novoEstoque = estoqueDb + qtdEstorno;
              if (configFabricaId) {
                await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", configFabricaId);
              } else if (cfgLive && cfgLive[0]?.id) {
                await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", cfgLive[0].id);
              }
              setEstoqueDisplaysProntos(novoEstoque);
            } catch (eEstorno) {
              console.warn("Aviso ao devolver estoque da fábrica na recusa:", eEstorno);
            }
          }

          // 3. Remover placas geradas se existirem
          try {
            await supabase.from("placas").delete().eq("pedido_id", pedidoRecusando.id);
            await supabase.from("placas").delete().eq("lote_id", pedidoRecusando.id);
          } catch (ePl) {
            console.warn("Aviso ao remover placas do pedido recusado:", ePl);
          }
        }
      }

      setFeedbackSucesso(`Pedido de ${pedidoRecusando.alunoNome} foi marcado como Recusado.`);
      setModalRecusarAberto(false);
      setModalComprovanteAberto(false);
      setPedidoRecusando(null);
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErroMsg(`Erro ao recusar pedido: ${msg}`);
    } finally {
      setProcessandoAcaoId(null);
    }
  };

  // Abrir Modal de Exclusão de Pedido
  const handleAbrirModalExcluir = (lote: LoteExport) => {
    setPedidoExcluindo(lote);
    setModalExcluirAberto(true);
  };

  // Confirmar Exclusão do Pedido diretamente no Supabase SDK
  const handleConfirmarExclusaoPedido = async () => {
    if (!pedidoExcluindo) return;

    const orderId = pedidoExcluindo.id;
    if (!orderId || orderId === "lote-registrado") {
      console.error("ID inválido recebido para exclusão:", orderId);
      alert("ID inválido recebido para exclusão.");
      return;
    }

    setExcluindoPedido(true);
    try {
      // 1. Elimina registros dependentes na tabela caixa_fabrica (se existir vínculo)
      await supabase.from("caixa_fabrica").delete().eq("pedido_id", orderId);

      // 2. Se o pedido excluído havia abatido unidades do estoque da fábrica, devolver essa quantidade
      const qtdEstorno = Number(pedidoExcluindo.quantidade) || 0;
      const st = (pedidoExcluindo.status || "").toLowerCase().trim();
      const isAprovado = st === "em_producao" || st === "enviado" || st === "entregue" || pedidoExcluindo.temLoteGerado;
      if (isAprovado && qtdEstorno > 0) {
        try {
          let estoqueDb = estoqueDisplaysProntos;
          const { data: cfgLive } = await supabase.from("config_fabrica").select("*").limit(1);
          if (cfgLive && cfgLive.length > 0 && cfgLive[0].estoque_displays_prontos !== undefined) {
            estoqueDb = Number(cfgLive[0].estoque_displays_prontos);
          }
          const novoEstoque = estoqueDb + qtdEstorno;
          if (configFabricaId) {
            await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", configFabricaId);
          } else if (cfgLive && cfgLive[0]?.id) {
            await supabase.from("config_fabrica").update({ estoque_displays_prontos: novoEstoque }).eq("id", cfgLive[0].id);
          }
          setEstoqueDisplaysProntos(novoEstoque);
        } catch (eEstorno) {
          console.warn("Aviso ao devolver estoque da fábrica no estorno:", eEstorno);
        }
      }

      // 3. Elimina placas vinculadas
      await supabase.from("placas").delete().eq("pedido_id", orderId);
      await supabase.from("placas").delete().eq("lote_id", orderId);

      // 4. Elimina o lote principal em pedidos_lotes
      const { error: errPedido } = await supabase
        .from("pedidos_lotes")
        .delete()
        .eq("id", orderId);

      if (errPedido) {
        throw new Error(errPedido.message);
      }

      // Excluir comprovante no storage se existir
      if (pedidoExcluindo.comprovanteUrl && pedidoExcluindo.comprovanteUrl.includes("/comprovantes/")) {
        try {
          const fileName = pedidoExcluindo.comprovanteUrl.split("/").pop()?.split("?")[0];
          if (fileName) {
            await supabase.storage.from("comprovantes").remove([fileName]);
          }
        } catch (eStg) {
          console.warn("Aviso ao excluir comprovante do storage:", eStg);
        }
      }

      setModalExcluirAberto(false);
      setPedidoExcluindo(null);
      setFeedbackSucesso("Lote excluído do banco com sucesso e estoque recalculado!");

      // 5. Recarrega todos os dados (pedidos, caixa e config_fabrica) imediatamente
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao excluir do Supabase:", err);
      setErroMsg(`Erro ao excluir: ${msg}`);
      alert("Erro ao excluir: " + msg);
    } finally {
      setExcluindoPedido(false);
    }
  };

  // Abrir modal de Edição de Placa pelo Admin
  const handleAbrirEditarPlaca = (placa: PlacaRecord) => {
    setPlacaEditandoAdmin(placa);
    // Extrai nome limpo e dados extras se houver no nome_empresa ou outras_vendas
    const rawNome = placa.nome_empresa || "";
    let nomeLimpo = rawNome;
    let resp = placa.responsavel_nome || "";
    const servicosRecuperados: Array<{
      id: string;
      descricao: string;
      valor: string;
      tipo_cobranca: "unico" | "recorrente";
    }> = [];

    // 1. Recupera de servicos_adicionais se existir
    if (Array.isArray(placa.servicos_adicionais) && placa.servicos_adicionais.length > 0) {
      placa.servicos_adicionais.forEach((s, idx) => {
        servicosRecuperados.push({
          id: s.id || `admin-serv-${Date.now()}-${idx}`,
          descricao: s.descricao || "",
          valor: s.valor !== undefined && s.valor !== null ? String(s.valor) : "",
          tipo_cobranca: s.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
        });
      });
    }

    // 2. Recupera de outras_vendas
    if (servicosRecuperados.length === 0 && placa.outras_vendas) {
      if (Array.isArray(placa.outras_vendas)) {
        placa.outras_vendas.forEach((s: any, idx: number) => {
          servicosRecuperados.push({
            id: s.id || `admin-serv-${Date.now()}-${idx}`,
            descricao: s.descricao || "",
            valor: s.valor !== undefined && s.valor !== null ? String(s.valor) : "",
            tipo_cobranca: s.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
          });
        });
      } else if (typeof placa.outras_vendas === "object" && placa.outras_vendas.descricao) {
        servicosRecuperados.push({
          id: `admin-serv-${Date.now()}-0`,
          descricao: placa.outras_vendas.descricao || "",
          valor: placa.outras_vendas.valor ? String(placa.outras_vendas.valor) : "",
          tipo_cobranca: placa.outras_vendas.tipo_cobranca === "recorrente" ? "recorrente" : "unico",
        });
      }
    }

    // 3. Extrai de nome_empresa se ainda não recuperou nenhum
    if (rawNome.includes(" [") && rawNome.endsWith("]")) {
      const idx = rawNome.indexOf(" [");
      nomeLimpo = rawNome.substring(0, idx);
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
              id: `admin-serv-${Date.now()}-${sIdx++}`,
              descricao: matchServ[1].trim(),
              valor: matchServ[2].trim(),
              tipo_cobranca: matchServ[3].toLowerCase().includes("recorrente") ? "recorrente" : "unico",
            });
          }
        }
      }
    }

    setEditNomeLoja(nomeLimpo);
    setEditResponsavel(resp);
    setEditWhatsapp(placa.whatsapp_contato || placa.whatsapp_feedback || "");
    setEditLinkGoogle(placa.link_google_review || "");
    setEditValorVenda(placa.valor_venda ? String(placa.valor_venda) : "80.00");
    setEditServicosAdmin(servicosRecuperados);
    setModalEditarPlacaAberto(true);
  };

  // Salvar Edição de Placa pelo Admin diretamente no Supabase
  const handleSalvarEdicaoPlacaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placaEditandoAdmin) return;

    setSalvandoEdicaoPlaca(true);
    try {
      const nomeLimpo = editNomeLoja.trim();
      const respLimpo = editResponsavel.trim();
      const whatsLimpo = editWhatsapp.replace(/\D/g, "");
      const linkLimpo = editLinkGoogle.trim();
      const valorNum = parseFloat(editValorVenda.replace(",", ".")) || 80.0;

      // Filtra serviços válidos preenchidos
      const servicosValidos = editServicosAdmin
        .map((s) => ({
          id: s.id || `admin-serv-${Math.random().toString(36).substring(2, 9)}`,
          descricao: s.descricao.trim(),
          valor: parseFloat(String(s.valor || "0").replace(",", ".")) || 0,
          tipo_cobranca: s.tipo_cobranca === "recorrente" ? ("recorrente" as const) : ("unico" as const),
        }))
        .filter((s) => s.descricao.length > 0 || s.valor > 0);

      let linkFormatado = linkLimpo;
      if (linkFormatado && !linkFormatado.startsWith("http://") && !linkFormatado.startsWith("https://")) {
        linkFormatado = `https://${linkFormatado}`;
      }

      // Constrói nome_empresa composto com responsável e serviços adicionais para compatibilidade 100% garantida
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

      const agoraIso = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        nome_empresa: nomeEmpresaFinal,
        link_google_review: linkFormatado,
        link_destino: linkFormatado,
        whatsapp_feedback: whatsLimpo,
        valor_venda: valorNum,
      };

      // Se a placa estava virgem e está sendo configurada com link, atualiza status para ativa
      if (linkFormatado && placaEditandoAdmin.status === "virgem") {
        updatePayload.status = "ativa";
        updatePayload.activated_at = agoraIso;
      }

      // Tenta atualizar colunas estendidas caso existam
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
        .eq("id", placaEditandoAdmin.id);

      if (errEstendido) {
        console.warn("Fallback para update sem colunas extras:", errEstendido.message);
        const { error: errBase } = await supabase
          .from("placas")
          .update(updatePayload)
          .eq("id", placaEditandoAdmin.id);

        if (errBase) throw new Error(errBase.message);
      }

      // Atualiza estado local de placasCadastradas
      setPlacasCadastradas((prev) =>
        prev.map((p) =>
          p.id === placaEditandoAdmin.id
            ? {
                ...p,
                ...updatePayload,
                responsavel_nome: respLimpo,
                whatsapp_contato: whatsLimpo,
                servicos_adicionais: servicosValidos,
                outras_vendas: servicosValidos,
              }
            : p
        )
      );

      setFeedbackSucesso(`Display ${placaEditandoAdmin.codigo} atualizado com sucesso!`);
      setModalEditarPlacaAberto(false);
      setPlacaEditandoAdmin(null);

      // Re-busca os dados e recalcula o volume transacionado instantaneamente
      await fetchAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao editar display:", err);
      alert("Erro ao editar display: " + msg);
    } finally {
      setSalvandoEdicaoPlaca(false);
    }
  };

  // Abrir modal de Endereço Completo
  const handleAbrirEndereco = (lote: LoteExport) => {
    setEnderecoVisualizando({
      alunoNome: lote.alunoNome,
      endereco: lote.enderecoEntrega,
    });
    setModalEnderecoAberto(true);
  };

  // Exportar Planilha Consolidada de todos os pedidos Aprovados
  const handleExportarTodosAprovados = async () => {
    const aprovados = lotes.filter((l) => l.temLoteGerado || l.status === "em_producao" || l.status === "enviado" || l.status === "entregue");
    if (aprovados.length === 0) {
      alert("Nenhum pedido aprovado com lote gerado para exportar no momento.");
      return;
    }
    // Baixar o primeiro da lista
    await handleBaixarPlanilhaGrafica(aprovados[0]);
  };

  // Confirmar encerramento do mês e entregar 10 displays grátis ao Top 1
  const handleConfirmarPremio = async () => {
    if (!podioAlunos || podioAlunos.length === 0 || podioAlunos[0].quantidade <= 0) {
      setErroMsg("Nenhum aluno elegível no pódio para receber a premiação.");
      return;
    }

    const campeao = podioAlunos[0];
    setGerandoPremio(true);
    setFeedbackSucesso(null);
    setErroMsg(null);

    try {
      // 1. Consultar todos os códigos existentes para reaproveitamento inteligente
      let checkPlacas: { codigo?: string }[] = [];
      const { data: placasData } = await supabase.from("placas").select("codigo");
      if (placasData && placasData.length > 0) {
        checkPlacas = placasData;
      }
      const qtdPremio = 10;
      const numerosLivres = obterProximosNumerosLivres(qtdPremio, checkPlacas);
      const codInicioStr = `GP-${String(numerosLivres[0]).padStart(4, "0")}`;
      const codFimStr = `GP-${String(numerosLivres[numerosLivres.length - 1]).padStart(4, "0")}`;

      // 2. Determinar aluno destinatário
      const alunoAlvo =
        alunos.find((a) => a.id === campeao.alunoId) ||
        alunos.find((a) => a.nome === campeao.nome) ||
        alunos[0];
      const alunoUuid = alunoAlvo?.id;

      // 3. Inserir lote na tabela pedidos_lotes (mesmo payload seguro de handleGerarLote)
      let pedidoId: string | undefined = undefined;
      if (alunoUuid && alunoUuid.length > 10 && !alunoUuid.startsWith("aluno-demo")) {
        const { data: novoPed, error: errPed } = await supabase
          .from("pedidos_lotes")
          .insert([
            {
              aluno_id: alunoUuid,
              quantidade: qtdPremio,
              valor_total: 0.0,
              status: "em_producao",
              aprovado_em: new Date().toISOString(),
            },
          ])
          .select()
          .maybeSingle();

        if (errPed) {
          console.error("Falha ao criar lote prêmio:", errPed);
        } else if (novoPed) {
          pedidoId = novoPed.id;
          console.log("Lote prêmio gravado:", novoPed);
        }
      }

      // 4. Criar as 10 placas virgens vinculadas ao lote com os números livres
      const novasPlacas = numerosLivres.map((num) => ({
        codigo: `GP-${String(num).padStart(4, "0")}`,
        status: "virgem" as const,
        valor_venda: 80.0,
        nome_empresa: "",
        link_google_review: "",
        whatsapp_feedback: "",
        aluno_id: alunoUuid && !alunoUuid.startsWith("aluno-demo") ? alunoUuid : null,
        pedido_id: pedidoId || null,
      }));

      const { error: insertErr } = await supabase
        .from("placas")
        .insert(novasPlacas);

      if (insertErr) {
        console.error("Erro no insert do Supabase:", insertErr);
        await fetch(`${SUPABASE_URL}/rest/v1/placas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify(novasPlacas),
        });
      }

      // 5. Atualização de estado imediata na UI
      const dtAtual = new Date();
      const novoLoteUI: LoteExport = {
        id: pedidoId || `lote-premio-${Date.now()}`,
        data: dtAtual.toLocaleDateString("pt-BR") + " " + dtAtual.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        alunoNome: alunoAlvo?.nome || campeao.nome,
        alunoId: alunoUuid,
        quantidade: qtdPremio,
        codigoInicio: codInicioStr,
        codigoFim: codFimStr,
        status: "em_producao",
        temLoteGerado: true,
        codigoRastreio: "",
        observacao: "🎁 Prêmio Top Display",
      };

      setLotes((prev) => [novoLoteUI, ...prev]);
      setTotalProduzidas((prev) => prev + qtdPremio);
      setTotalVirgens((prev) => prev + qtdPremio);
      setMaiorCodigoNumero((prev) => Math.max(prev, ...numerosLivres));

      // 6. Confetes e Feedback Visual
      if (typeof window !== "undefined") {
        try {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 },
          });
        } catch (cErr) {
          console.warn("Confetti:", cErr);
        }
      }

      setFeedbackSucesso(
        `🏆 Parabéns a ${campeao.nome}! Lote bonificado de 10 displays (${codInicioStr} a ${codFimStr}) gerado com sucesso!`
      );
      setModalPodioAberto(false);

      // 7. Sincronização com Supabase
      await fetchAdminData();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro ao entregar prêmio do Top Display:", err);
      setErroMsg(`Erro ao processar premiação: ${msg}`);
    } finally {
      setGerandoPremio(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans p-3 sm:p-4 selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* HEADER SUPERIOR (COMPACTO COM BADGE INTEGRADA) */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> GOPLAK ADMIN
              </span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              <h1 className="text-lg lg:text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                Gestão do Distribuidor
              </h1>
              {topLider ? (
                <button
                  type="button"
                  onClick={() => setModalPodioAberto(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 transition cursor-pointer shadow-xs active:scale-95"
                  title="Ver Pódio do Mês e Bonificação"
                >
                  <span>🏆</span>
                  <span className="font-semibold">Top 1: {topLider.nome}</span>
                  <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400">({topLider.quantidade} un)</span>
                  <span className="text-[9px] bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-mono">{diasRestantesMes}d</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-700/80 dark:text-amber-400/80">
                  <span>🏆</span> Top 1 do Mês (+10 grátis)
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
              Painel central de emissão de lotes, estoque de fábrica e exportação para gráficas parceiras.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sino de Notificação Interativo com Popover / Dropdown */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setPopoverNotificacoesAberto(!popoverNotificacoesAberto)}
                title="Notificações de pedidos pendentes"
                aria-label="Notificações"
                className={`relative p-2 rounded-xl border text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer ${
                  popoverNotificacoesAberto
                    ? "bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-300 ring-2 ring-amber-400/40"
                    : "bg-white dark:bg-neutral-900 border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                {pedidosAguardandoCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-zinc-950 font-black text-[9px] flex items-center justify-center ring-2 ring-white dark:ring-neutral-900 animate-pulse">
                    {pedidosAguardandoCount}
                  </span>
                )}
              </button>

              {/* Menu Suspenso / Popover de Notificações */}
              {popoverNotificacoesAberto && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-neutral-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                        Notificações Pendentes
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      {pedidosPendentes.length} {pedidosPendentes.length === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>

                  {/* Lista de Pedidos Pendentes */}
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-100 dark:divide-neutral-800/60">
                    {pedidosPendentes.length === 0 ? (
                      <div className="py-6 text-center text-xs text-zinc-400 dark:text-neutral-500">
                        🎉 Nenhum pedido aguardando aprovação no momento.
                      </div>
                    ) : (
                      pedidosPendentes.map((ped) => (
                        <div
                          key={ped.id}
                          className="pt-2 first:pt-0 flex items-center justify-between gap-2.5 hover:bg-zinc-50 dark:hover:bg-neutral-800/40 p-1.5 rounded-xl transition"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                                {ped.alunoNome}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300">
                                {ped.quantidade} un
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-neutral-400 mt-0.5">
                              <span>{ped.data.split(" ")[0]}</span>
                              <span>•</span>
                              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                R$ {(ped.valorTotal || (ped.quantidade * 18)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleVerPedidoNotificacao(ped.id)}
                            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-bold text-[11px] px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer shrink-0"
                          >
                            Ver Pedido
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Rodapé */}
                  <div className="border-t border-zinc-200 dark:border-neutral-800 pt-2.5">
                    <button
                      type="button"
                      onClick={handleVerTodosPendentes}
                      className="w-full py-1.5 px-3 rounded-xl bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Ver Todos os Pedidos Pendentes</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
            <button
              onClick={() => {
                setRefreshing(true);
                fetchAdminData();
              }}
              title="Atualizar dados do Supabase"
              aria-label="Atualizar dados"
              className="inline-flex items-center gap-1.5 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-neutral-800 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
              <span>Sincronizar</span>
            </button>
            <button
              onClick={handleLogout}
              title="Sair da Conta (Logout)"
              aria-label="Sair da Conta"
              className="inline-flex items-center gap-1.5 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:border-rose-500/30 text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <span>Visão Aluno</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </a>
          </div>
        </header>

        {/* TOASTS FLUTUANTES (FIXED TOP-RIGHT / NÃO DESLOCAM O LAYOUT) */}
        <div
          onMouseEnter={() => setToastHovered(true)}
          onMouseLeave={() => setToastHovered(false)}
          className="fixed top-4 right-4 z-[70] max-w-sm w-full pointer-events-none space-y-2 px-3 sm:px-0"
        >
          {feedbackSucesso && (
            <div className="pointer-events-auto bg-emerald-950/95 dark:bg-neutral-900/95 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="font-medium text-emerald-100 dark:text-emerald-200 leading-snug">{feedbackSucesso}</span>
              </div>
              <button
                onClick={() => setFeedbackSucesso(null)}
                className="text-emerald-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {erroMsg && (
            <div className="pointer-events-auto bg-rose-950/95 dark:bg-neutral-900/95 border border-rose-500/40 text-rose-300 p-3.5 rounded-2xl text-xs flex items-start justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="font-medium text-rose-100 dark:text-rose-200 leading-snug">{erroMsg}</span>
              </div>
              <button
                onClick={() => setErroMsg(null)}
                className="text-rose-400/70 hover:text-white p-1 ml-2 cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ALERTA CRÍTICO INAMOVÍVEL DE ESTOQUE FÍSICO (PROJEÇÃO <= 20 DIAS OU <= 50 DISPLAYS) */}
        {metricasFinanceiras.alertaEstoqueCritico && (
          <div
            onClick={() => setModalReposicaoAberto(true)}
            className="w-full cursor-pointer bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-500/80 hover:border-amber-400 p-3 sm:p-4 rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-[1.003] group animate-in fade-in"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/40 animate-pulse shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30">
                      Alerta de Reposição de Fábrica
                    </span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300/80 font-mono font-bold">
                      Projeção: ~{Math.max(0, Math.round(metricasFinanceiras.diasRestantesEstoque))} dias
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-100 mt-1 leading-snug">
                    ⚠️ ATENÇÃO: Estoque para apenas {Math.max(0, Math.round(metricasFinanceiras.diasRestantesEstoque))} dias ({estoqueDisplaysProntos} displays restantes). Faça o pedido com o fornecedor agora!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalReposicaoAberto(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs shadow-md transition active:scale-95 whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <PackagePlus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Adicionar Displays Recebidos do Fornecedor</span>
              </button>
            </div>
          </div>
        )}

        {/* 1. CARDS DE MÉTRICAS FINANCEIRAS & ESTOQUE DA FÁBRICA */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Faturamento Bruto (Entradas) */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Faturamento Bruto</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white">
                R$ {metricasFinanceiras.faturamentoBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 dark:text-neutral-500 mt-0.5">Soma de entradas de lotes aprovados</p>
          </div>

          {/* Custos de Mercadorias / Despesas */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Custo & Despesas</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl lg:text-2xl font-black text-rose-600 dark:text-rose-400">
                R$ {metricasFinanceiras.custosTotais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 dark:text-neutral-500 mt-0.5">CMV (R$ {custoUnitarioDisplay.toFixed(2)}/un) + Fretes/Saídas</p>
          </div>

          {/* Lucro Líquido Real */}
          <div className="bg-white dark:bg-neutral-900/90 border border-emerald-500/40 rounded-2xl p-3 shadow-xs transition-colors bg-gradient-to-b from-transparent to-emerald-500/5">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Lucro Líquido Real</span>
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl lg:text-2xl font-black ${metricasFinanceiras.lucroLiquidoReal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                R$ {metricasFinanceiras.lucroLiquidoReal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 dark:text-neutral-500 mt-0.5">Entradas líquidas abatidos custos e fretes</p>
          </div>

          {/* Estoque de Displays Prontos na Fábrica */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3 shadow-xs transition-all relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Estoque na Fábrica</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAbrirAjusteEstoque}
                    className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                    title="Ajustar / Calibrar Estoque Manualmente (Ex: zerar)"
                  >
                    <span className="text-[10px] font-bold">⚙️ Calibrar</span>
                  </button>
                  <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl lg:text-3xl font-black text-amber-600 dark:text-amber-300">{estoqueDisplaysProntos}</span>
                <span className="text-xs text-zinc-500 dark:text-neutral-400">un prontos</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-md ${metricasFinanceiras.alertaEstoqueCritico ? "bg-rose-500/20 text-rose-700 dark:text-rose-300" : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"}`}>
                  ~{Math.max(0, Math.round(metricasFinanceiras.diasRestantesEstoque))} dias
                </span>
                <span className="text-[9px] text-zinc-400 dark:text-neutral-500">cobertura (saída {mediaSaidaDiaria}/d)</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-neutral-800/80 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModalReposicaoAberto(true)}
                className="flex-1 py-1 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <PackagePlus className="w-3 h-3" />
                <span>+ Repor</span>
              </button>
              <button
                type="button"
                onClick={handleAbrirAjusteEstoque}
                className="py-1 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 border border-zinc-200 dark:border-neutral-700 text-[10px] font-bold transition cursor-pointer active:scale-95"
                title="Ajustar saldo real do estoque"
              >
                <span>Ajustar</span>
              </button>
            </div>
          </div>
        </section>

        {/* BARRA COMPACTA DE MÉTRICAS OPERACIONAIS */}
        <section className="bg-white/60 dark:bg-neutral-900/60 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-neutral-500">Operação em Campo:</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-zinc-600 dark:text-neutral-300">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-500" />
              <span className="text-[11px]">Total Emitidas: <strong className="text-zinc-900 dark:text-white font-mono">{totalProduzidas}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px]">Ativas em Lojas: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{totalAtivas}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px]">Estoque Alunos: <strong className="text-amber-600 dark:text-amber-400 font-mono">{totalVirgens}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px]">Faturamento Alunos: <strong className="text-zinc-900 dark:text-white font-mono">R$ {volumeTransacionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </section>

        {/* DISPONIBILIDADE DE KITS PARA ALUNOS (LANÇAMENTO) */}
        <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-neutral-800 pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                  Disponibilidade de Kits para Alunos
                </h2>
                {salvandoKits && (
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
                Defina em tempo real quais lotes ficam liberados para compra no App do Aluno. No lançamento, mantenha apenas o Kit 10 ativo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-zinc-100 dark:bg-neutral-800 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-neutral-700">
                {Object.values(kitsDisponiveis).filter(Boolean).length} de 3 kits liberados
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* KIT START (10 UN | R$ 170,00) */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                kitsDisponiveis.start
                  ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/50 shadow-xs"
                  : "bg-zinc-50/60 dark:bg-neutral-900/40 border-zinc-200 dark:border-neutral-800 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Start (10 un)</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-neutral-300 mt-0.5">
                    R$ 170,00 <span className="text-[11px] font-normal text-zinc-500">(R$ 17,00/un)</span>
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleKitDisponibilidade("start")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    kitsDisponiveis.start ? "bg-emerald-500" : "bg-zinc-300 dark:bg-neutral-700"
                  }`}
                  title={kitsDisponiveis.start ? "Bloquear Kit Start para alunos" : "Liberar Kit Start para alunos"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      kitsDisponiveis.start ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 dark:text-neutral-400">Padrão 5 Pretas / 5 Azuis</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md border text-[10px] ${
                    kitsDisponiveis.start
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-200 dark:bg-neutral-800 text-zinc-500 border-zinc-300 dark:border-neutral-700"
                  }`}
                >
                  {kitsDisponiveis.start ? "Ativo" : "Bloqueado"}
                </span>
              </div>
            </div>

            {/* KIT PRO (30 UN | R$ 510,00) */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                kitsDisponiveis.pro
                  ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs"
                  : "bg-zinc-50/60 dark:bg-neutral-900/40 border-zinc-200 dark:border-neutral-800 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Pro (30 un)</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-neutral-300 mt-0.5">
                    R$ 510,00 <span className="text-[11px] font-normal text-zinc-500">(R$ 17,00/un)</span>
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleKitDisponibilidade("pro")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    kitsDisponiveis.pro ? "bg-emerald-500" : "bg-zinc-300 dark:bg-neutral-700"
                  }`}
                  title={kitsDisponiveis.pro ? "Bloquear Kit Pro para alunos" : "Liberar Kit Pro para alunos"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      kitsDisponiveis.pro ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 dark:text-neutral-400">Escolha de Cores</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md border text-[10px] ${
                    kitsDisponiveis.pro
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  }`}
                >
                  {kitsDisponiveis.pro ? "Ativo" : "Bloqueado"}
                </span>
              </div>
            </div>

            {/* KIT MASTER (50 UN | R$ 800,00) */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                kitsDisponiveis.master
                  ? "bg-violet-500/5 dark:bg-violet-950/20 border-violet-500/50 shadow-xs"
                  : "bg-zinc-50/60 dark:bg-neutral-900/40 border-zinc-200 dark:border-neutral-800 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">Kit Master (50 un)</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-neutral-300 mt-0.5">
                    R$ 800,00 <span className="text-[11px] font-normal text-zinc-500">(R$ 16,00/un)</span>
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleKitDisponibilidade("master")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    kitsDisponiveis.master ? "bg-emerald-500" : "bg-zinc-300 dark:bg-neutral-700"
                  }`}
                  title={kitsDisponiveis.master ? "Bloquear Kit Master para alunos" : "Liberar Kit Master para alunos"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      kitsDisponiveis.master ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 dark:text-neutral-400">Escala Máxima</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md border text-[10px] ${
                    kitsDisponiveis.master
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  }`}
                >
                  {kitsDisponiveis.master ? "Ativo" : "Bloqueado"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. GESTÃO DE PEDIDOS & GESTÃO DE PLACAS ATIVADAS */}
        <section id="tabela-pedidos" className="w-full bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-colors">
          {/* Header & Seletor de Abas Principais */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 pb-2 border-b border-zinc-200 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-neutral-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAbaPrincipal("pedidos")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  abaPrincipal === "pedidos"
                    ? "bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Gestão de Pedidos & Lotes ({lotes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaPrincipal("placas")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  abaPrincipal === "placas"
                    ? "bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4 text-sky-500" />
                <span>Gestão de Placas / Displays Ativados ({placasCadastradas.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botão Lançar Despesa / Frete */}
              <button
                type="button"
                onClick={() => setModalDespesaAberto(true)}
                className="bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold text-xs py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Registrar frete, embalagem ou despesa no caixa da fábrica"
              >
                <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>- Lançar Despesa / Frete</span>
              </button>

              {/* Botão Repor Estoque */}
              <button
                type="button"
                onClick={() => setModalReposicaoAberto(true)}
                className="bg-sky-500/10 hover:bg-sky-500/20 active:scale-95 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-bold text-xs py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Registrar recebimento de lote virgem do fornecedor"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Repor Estoque</span>
              </button>

              {/* Botão Extrato do Caixa */}
              <button
                type="button"
                onClick={() => setModalExtratoCaixaAberto(true)}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 active:scale-95 text-zinc-800 dark:text-neutral-200 font-bold text-xs py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer border border-zinc-200 dark:border-neutral-700"
                title="Visualizar extrato completo de entradas e saídas do caixa da fábrica"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Extrato Caixa</span>
              </button>

              {/* Botão Emissão Manual de Lote */}
              <button
                type="button"
                onClick={() => setModalEmissaoManualAberto(true)}
                className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold text-xs py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Abrir formulário de emissão manual de lote de displays"
              >
                <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>⚡ Emissão Manual de Lote</span>
              </button>

              {/* Botão Exportar Planilha Gráfica Geral */}
              <button
                type="button"
                onClick={handleExportarTodosAprovados}
                className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs py-1.5 px-3 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Baixar planilha gráfica consolidada dos lotes aprovados"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Planilha Gráfica</span>
              </button>
            </div>
          </div>

          {abaPrincipal === "pedidos" ? (
            <>
              {/* Barra de Filtros por Status */}
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  type="button"
                  onClick={() => setFiltroStatus("todos")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                filtroStatus === "todos"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                  : "bg-zinc-100 dark:bg-neutral-800 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-neutral-700 hover:bg-zinc-200 dark:hover:bg-neutral-700"
              }`}
            >
              Todos ({lotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("pendentes")}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filtroStatus === "pendentes"
                  ? "bg-amber-500 text-black border-amber-400 shadow-xs"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              }`}
            >
              <span>⏳ Aguardando Aprovação</span>
              <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">
                {lotes.filter((l) => l.status === "solicitado").length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("aprovados")}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filtroStatus === "aprovados"
                  ? "bg-emerald-500 text-black border-emerald-400 shadow-xs"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              <span>✅ Aprovados / Em Produção</span>
              <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">
                {lotes.filter((l) => l.status === "em_producao" || l.status === "enviado" || l.status === "entregue").length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("recusados")}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filtroStatus === "recusados"
                  ? "bg-rose-600 text-white border-rose-500 shadow-xs"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
              }`}
            >
              <span>❌ Recusados</span>
              <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">
                {lotes.filter((l) => l.status === "recusado").length}
              </span>
            </button>
          </div>

          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center text-zinc-500 dark:text-neutral-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs">Carregando pedidos do Supabase...</span>
            </div>
          ) : lotes.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 dark:text-neutral-500 text-xs">
              Nenhum pedido registrado.
            </div>
          ) : (
            <div className="w-full">
              {(() => {
                const lotesFiltrados = lotes.filter((lote) => {
                  if (filtroStatus === "pendentes") return lote.status === "solicitado";
                  if (filtroStatus === "aprovados") return lote.status === "em_producao" || lote.status === "enviado" || lote.status === "entregue";
                  if (filtroStatus === "recusados") return lote.status === "recusado";
                  return true;
                });

                if (lotesFiltrados.length === 0) {
                  return (
                    <div className="py-8 text-center text-zinc-400 dark:text-neutral-500 text-xs">
                      Nenhum pedido correspondente ao filtro selecionado.
                    </div>
                  );
                }

                return (
                  <div className="w-full max-h-[380px] overflow-y-auto overflow-x-auto pr-1 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 shadow-xs">
                        <tr className="border-b border-zinc-200 dark:border-neutral-800 text-zinc-500 dark:text-neutral-400 uppercase tracking-wider text-[11px] bg-zinc-50 dark:bg-neutral-950">
                          <th className="py-2.5 px-2.5 font-semibold">DATA</th>
                          <th className="py-2.5 px-2.5 font-semibold">ALUNO</th>
                          <th className="py-2.5 px-2.5 font-semibold text-center">QTD</th>
                          <th className="py-2.5 px-2.5 font-semibold">CORES</th>
                          <th className="py-2.5 px-2.5 font-semibold text-right">VALOR</th>
                          <th className="py-2.5 px-2.5 font-semibold text-center">ENDEREÇO</th>
                          <th className="py-2.5 px-2.5 font-semibold text-center">COMPROVANTE</th>
                          <th className="py-2.5 px-2.5 font-semibold text-center">STATUS</th>
                          <th className="py-2.5 px-2.5 font-semibold text-center">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/80 dark:divide-neutral-800/60">
                        {lotesFiltrados.map((lote) => {
                          const stLower = (lote.status || "").toLowerCase().trim();
                          const isPendente =
                            stLower === "solicitado" ||
                            stLower === "aguardando" ||
                            stLower === "aguardando aprovação" ||
                            stLower === "aguardando aprovacao" ||
                            stLower === "aguardando_aprovacao" ||
                            stLower === "pendente";
                          const isRecusado = stLower === "recusado";
                          const isAprovado = stLower === "em_producao" || stLower === "enviado" || stLower === "entregue";
                          
                          const enderecoTooltip = lote.enderecoEntrega
                            ? `${lote.enderecoEntrega.logradouro}, ${lote.enderecoEntrega.numero}${
                                lote.enderecoEntrega.complemento ? " (" + lote.enderecoEntrega.complemento + ")" : ""
                              } - ${lote.enderecoEntrega.bairro}, ${lote.enderecoEntrega.cidade}/${lote.enderecoEntrega.estado} - CEP: ${lote.enderecoEntrega.cep}${
                                lote.enderecoEntrega.ponto_referencia ? " [Ref: " + lote.enderecoEntrega.ponto_referencia + "]" : ""
                              }`
                            : "Endereço não informado";

                          return (
                            <tr
                              key={lote.id}
                              id={`pedido-row-${lote.id}`}
                              className={`transition-all duration-500 ${
                                pedidoDestacadoId === lote.id
                                  ? "bg-amber-500/20 dark:bg-amber-500/20 ring-2 ring-amber-400 dark:ring-amber-500"
                                  : "hover:bg-zinc-100/60 dark:hover:bg-neutral-950/40"
                              }`}
                            >
                              {/* DATA */}
                              <td className="py-2 px-2 text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                <span className="font-medium text-zinc-800 dark:text-neutral-200">{lote.data.split(" ")[0]}</span>{" "}
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{lote.data.split(" ")[1] || ""}</span>
                              </td>

                              {/* ALUNO */}
                              <td className="py-2 px-2">
                                <span className="font-bold text-zinc-900 dark:text-white block truncate max-w-[150px]" title={`${lote.alunoNome} ${lote.alunoEmail ? `(${lote.alunoEmail})` : ""}`}>
                                  {lote.alunoNome}
                                </span>
                                {lote.alunoEmail && (
                                  <span className="text-[10px] text-zinc-500 dark:text-neutral-400 block truncate max-w-[150px]" title={lote.alunoEmail}>
                                    {lote.alunoEmail}
                                  </span>
                                )}
                              </td>

                              {/* QTD */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-neutral-800 text-zinc-900 dark:text-white font-bold font-mono text-xs">
                                  {lote.quantidade} un
                                </span>
                              </td>

                              {/* CORES */}
                              <td className="py-2 px-2 text-[11px] whitespace-nowrap">
                                {(() => {
                                  const { pretas, azuis } = extrairQtdCores(lote);
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {pretas > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-zinc-900 text-white dark:bg-neutral-800 dark:text-zinc-200 border border-zinc-700">
                                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block"></span>
                                          {pretas} {pretas === 1 ? "Preta" : "Pretas"}
                                        </span>
                                      )}
                                      {azuis > 0 && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                                          {azuis} {azuis === 1 ? "Azul" : "Azuis"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* VALOR */}
                              <td className="py-2 px-2 text-right whitespace-nowrap">
                                <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono text-xs">
                                  R$ {(lote.valorTotal || (lote.quantidade * 18)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* ENDEREÇO */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {lote.enderecoEntrega ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirEndereco(lote)}
                                    className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                                    title={enderecoTooltip}
                                  >
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span>
                                      {lote.enderecoEntrega.cidade}/{lote.enderecoEntrega.estado}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 dark:text-neutral-500" title="Endereço padrão de cadastro">Padrão</span>
                                )}
                              </td>

                              {/* COMPROVANTE */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {lote.comprovanteUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirComprovante(lote)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] transition active:scale-95 cursor-pointer shadow-xs ${
                                      isPendente
                                        ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/40 font-bold"
                                        : "border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 font-semibold"
                                    }`}
                                    title={isPendente ? "Visualizar comprovante bancário (Pendente de Aprovação)" : "Visualizar comprovante bancário (Auditoria)"}
                                  >
                                    <Eye className={`w-3 h-3 ${isPendente ? "text-sky-600 dark:text-sky-400" : "text-zinc-400 dark:text-zinc-500"}`} />
                                    <span>Ver Anexo</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 dark:text-neutral-500 bg-zinc-100 dark:bg-neutral-800/60 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-neutral-800">
                                    Sem anexo
                                  </span>
                                )}
                              </td>

                              {/* STATUS */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isPendente && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <Clock className="w-3 h-3" />
                                    <span>Aguardando</span>
                                  </span>
                                )}
                                {isAprovado && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{lote.status === "entregue" ? "Entregue" : lote.status === "enviado" ? "Enviado" : "Em Produção"}</span>
                                  </span>
                                )}
                                {isRecusado && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                                    <XCircle className="w-3 h-3" />
                                    <span>Recusado</span>
                                  </span>
                                )}
                              </td>

                              {/* AÇÕES */}
                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isPendente ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAprovarPedido(lote)}
                                      disabled={processandoAcaoId === lote.id}
                                      className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold px-2 py-0.5 rounded-lg text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
                                      title="Aprovar pedido e liberar produção"
                                    >
                                      {processandoAcaoId === lote.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="w-3 h-3 stroke-[2.5]" />
                                          <span>Aprovar</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalRecusa(lote)}
                                      disabled={processandoAcaoId === lote.id}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Recusar pedido"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalExcluir(lote)}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Excluir Pedido"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : lote.status === "em_producao" ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirDespacho(lote)}
                                      className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold px-2.5 py-0.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
                                      title="Informar envio e código de rastreio"
                                    >
                                      <Package className="w-3 h-3" />
                                      <span>Despachar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleBaixarPlanilhaGrafica(lote)}
                                      disabled={exportandoId === lote.id}
                                      title={lote.quantidade > 50 ? "Exportar fatias de 50 un em arquivo ZIP para a gráfica" : "Baixar planilha com QR Codes físicos embutidos"}
                                      className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-emerald-500 hover:text-black dark:bg-neutral-800 dark:hover:bg-emerald-500 dark:hover:text-black text-zinc-800 dark:text-neutral-200 px-2 py-0.5 rounded-lg border border-zinc-300 dark:border-neutral-700 font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs text-xs"
                                    >
                                      {exportandoId === lote.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Download className="w-3 h-3" />
                                          <span>{lote.quantidade > 50 ? "ZIP (50un)" : "XLSX"}</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalExcluir(lote)}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Excluir Pedido"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : lote.status === "enviado" ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleMarcarEntregue(lote)}
                                      disabled={processandoAcaoId === lote.id}
                                      className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-bold px-2 py-0.5 rounded-lg text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
                                      title="Marcar pedido como entregue e creditar estoque"
                                    >
                                      {processandoAcaoId === lote.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="w-3 h-3 stroke-[2.5]" />
                                          <span>Entregue</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirDespacho(lote)}
                                      className="p-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 border border-zinc-300 dark:border-neutral-700 transition cursor-pointer text-xs"
                                      title="Editar código de rastreio"
                                    >
                                      <Package className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleBaixarPlanilhaGrafica(lote)}
                                      disabled={exportandoId === lote.id}
                                      title={lote.quantidade > 50 ? "Exportar fatias de 50 un em arquivo ZIP para a gráfica" : "Baixar planilha com QR Codes físicos embutidos"}
                                      className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-emerald-500 hover:text-black dark:bg-neutral-800 dark:hover:bg-emerald-500 dark:hover:text-black text-zinc-800 dark:text-neutral-200 px-2 py-0.5 rounded-lg border border-zinc-300 dark:border-neutral-700 font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs text-xs"
                                    >
                                      {exportandoId === lote.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Download className="w-3 h-3" />
                                          <span>{lote.quantidade > 50 ? "ZIP (50un)" : "XLSX"}</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalExcluir(lote)}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Excluir Pedido"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleBaixarPlanilhaGrafica(lote)}
                                      disabled={exportandoId === lote.id}
                                      title={lote.quantidade > 50 ? "Exportar fatias de 50 un em arquivo ZIP para a gráfica" : "Baixar planilha com QR Codes físicos embutidos"}
                                      className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-emerald-500 hover:text-black dark:bg-neutral-800 dark:hover:bg-emerald-500 dark:hover:text-black text-zinc-800 dark:text-neutral-200 px-2 py-0.5 rounded-lg border border-zinc-300 dark:border-neutral-700 font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs text-xs"
                                    >
                                      {exportandoId === lote.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Download className="w-3 h-3" />
                                          <span>{lote.quantidade > 50 ? "ZIP (50un)" : "XLSX"}</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalExcluir(lote)}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Excluir Pedido"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        /* ========================================================================= */
        /* ABA 2: GESTÃO DE PLACAS / DISPLAYS ATIVADOS (VISÃO TOTAL DO ADMIN)       */
        /* ========================================================================= */
        <div className="space-y-3 pt-1">
          {/* Barra de Busca e Filtros de Placas */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setFiltroPlacaStatus("todas")}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap ${
                  filtroPlacaStatus === "todas"
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                    : "bg-zinc-100 dark:bg-neutral-800 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-neutral-700"
                }`}
              >
                Todas ({placasCadastradas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroPlacaStatus("ativas")}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  filtroPlacaStatus === "ativas"
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-xs"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
              >
                <span>✅ Ativas em Loja</span>
                <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">
                  {placasCadastradas.filter((p) => p.status === "ativa").length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFiltroPlacaStatus("virgens")}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  filtroPlacaStatus === "virgens"
                    ? "bg-amber-500 text-black border-amber-400 shadow-xs"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                }`}
              >
                <span>⚪ Virgens / Em Estoque</span>
                <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full text-[10px]">
                  {placasCadastradas.filter((p) => p.status === "virgem").length}
                </span>
              </button>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                value={buscaPlaca}
                onChange={(e) => setBuscaPlaca(e.target.value)}
                placeholder="Buscar código, loja ou aluno..."
                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tabela de Placas */}
          {(() => {
            const buscaLower = buscaPlaca.trim().toLowerCase();
            const placasFiltradas = placasCadastradas.filter((p) => {
              if (filtroPlacaStatus === "ativas" && p.status !== "ativa") return false;
              if (filtroPlacaStatus === "virgens" && p.status !== "virgem") return false;

              if (buscaLower) {
                const alunoRel = alunos.find((a) => a.id === p.aluno_id);
                const matchCod = (p.codigo || "").toLowerCase().includes(buscaLower);
                const matchLoja = (p.nome_empresa || "").toLowerCase().includes(buscaLower);
                const matchAluno = (alunoRel?.nome || "").toLowerCase().includes(buscaLower);
                const matchResp = (p.responsavel_nome || "").toLowerCase().includes(buscaLower);
                return matchCod || matchLoja || matchAluno || matchResp;
              }
              return true;
            });

            if (placasFiltradas.length === 0) {
              return (
                <div className="py-10 text-center text-zinc-400 dark:text-neutral-500 text-xs">
                  Nenhuma placa encontrada com os filtros selecionados.
                </div>
              );
            }

            return (
              <div className="w-full max-h-[460px] overflow-y-auto overflow-x-auto pr-1 border border-zinc-200/80 dark:border-neutral-800/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 shadow-xs">
                    <tr className="border-b border-zinc-200 dark:border-neutral-800 text-zinc-500 dark:text-neutral-400 uppercase tracking-wider text-[11px] bg-zinc-50 dark:bg-neutral-950">
                      <th className="py-2.5 px-2.5 font-semibold">CÓDIGO</th>
                      <th className="py-2.5 px-2.5 font-semibold">ALUNO / DISTRIBUIDOR</th>
                      <th className="py-2.5 px-2.5 font-semibold">NOME DA LOJA</th>
                      <th className="py-2.5 px-2.5 font-semibold">RESPONSÁVEL</th>
                      <th className="py-2.5 px-2.5 font-semibold">WHATSAPP</th>
                      <th className="py-2.5 px-2.5 font-semibold">DATA / HORA ATIVAÇÃO</th>
                      <th className="py-2.5 px-2.5 font-semibold">LINK ATUAL</th>
                      <th className="py-2.5 px-2.5 font-semibold text-center">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/80 dark:divide-neutral-800/60">
                    {placasFiltradas.map((p) => {
                      const alunoRel = alunos.find((a) => a.id === p.aluno_id);
                      const isAtiva = p.status === "ativa";

                      // Formata data de ativação
                      const dataAtivacaoRaw = p.data_ativacao || p.activated_at;
                      let dataHoraFormatada = "-";
                      if (dataAtivacaoRaw) {
                        try {
                          const d = new Date(dataAtivacaoRaw);
                          dataHoraFormatada = d.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        } catch {
                          dataHoraFormatada = String(dataAtivacaoRaw);
                        }
                      } else if (isAtiva && p.created_at) {
                        try {
                          const d = new Date(p.created_at);
                          dataHoraFormatada = d.toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        } catch {}
                      }

                      // Extrair responsável se estiver embutido no nome_empresa
                      let nomeLojaDisplay = p.nome_empresa || "";
                      let respDisplay = p.responsavel_nome || "";
                      if (nomeLojaDisplay.includes(" [") && nomeLojaDisplay.endsWith("]")) {
                        const idx = nomeLojaDisplay.indexOf(" [");
                        const extra = nomeLojaDisplay.substring(idx + 2, nomeLojaDisplay.length - 1);
                        nomeLojaDisplay = nomeLojaDisplay.substring(0, idx);
                        const matchResp = extra.match(/Resp:\s*([^|\]]+)/);
                        if (matchResp && !respDisplay) {
                          respDisplay = matchResp[1].trim();
                        }
                      }

                      const whatsExibir = p.whatsapp_contato || p.whatsapp_feedback || "";
                      const linkGoogle = p.link_google_review || "";

                      return (
                        <tr key={p.id || p.codigo} className="hover:bg-zinc-50 dark:hover:bg-neutral-800/40 transition-colors">
                          {/* Código */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900 dark:text-white">
                              <span className={`w-2 h-2 rounded-full ${isAtiva ? "bg-emerald-500" : "bg-amber-400"}`} />
                              <span>{p.codigo}</span>
                            </div>
                          </td>

                          {/* Aluno / Distribuidor */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-zinc-800 dark:text-neutral-200">
                                {alunoRel?.nome || (p.aluno_id ? "Aluno Vinculado" : "Sem aluno")}
                              </span>
                              {alunoRel?.email && (
                                <span className="text-[10px] text-zinc-400 font-normal">
                                  {alunoRel.email}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nome da Loja */}
                          <td className="py-2.5 px-2.5 font-medium text-zinc-900 dark:text-white max-w-[180px] truncate" title={p.nome_empresa || ""}>
                            {nomeLojaDisplay || (
                              <span className="text-zinc-400 dark:text-neutral-500 italic">Não ativada</span>
                            )}
                          </td>

                          {/* Responsável */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap text-zinc-700 dark:text-neutral-300">
                            {respDisplay || <span className="text-zinc-400">-</span>}
                          </td>

                          {/* WhatsApp */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap font-mono text-[11px] text-zinc-700 dark:text-neutral-300">
                            {whatsExibir ? (
                              <a
                                href={`https://wa.me/55${whatsExibir.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{whatsExibir.length === 11 ? `(${whatsExibir.slice(0, 2)}) ${whatsExibir.slice(2, 7)}-${whatsExibir.slice(7)}` : whatsExibir}</span>
                              </a>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>

                          {/* Data e Horário de Ativação */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap font-mono text-[11px] text-zinc-600 dark:text-neutral-400">
                            {dataHoraFormatada}
                          </td>

                          {/* Link Atual */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap max-w-[160px] truncate">
                            {linkGoogle ? (
                              <a
                                href={linkGoogle}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                                title={linkGoogle}
                              >
                                <span className="truncate max-w-[130px]">{linkGoogle}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-zinc-400 italic">Sem link</span>
                            )}
                          </td>

                          {/* Ações: Botão Editar */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarPlaca(p)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[11px] px-2.5 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              title="Editar dados da loja e link da placa"
                            >
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </section>

        {/* MODAL DE DESPACHO E RASTREIO */}
        {modalDespachoAberto && pedidoDespachando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setModalDespachoAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Despachar Pedido & Rastreio
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    {pedidoDespachando.alunoNome} ({pedidoDespachando.quantidade} displays)
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmarDespacho} className="space-y-4">
                {/* Transportadora */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Transportadora / Forma de Envio
                  </label>
                  <select
                    value={transportadoraInput}
                    onChange={(e) => setTransportadoraInput(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 transition cursor-pointer"
                  >
                    <option value="Correios">Correios (Sedex / PAC)</option>
                    <option value="Loggi">Loggi Express</option>
                    <option value="Jadlog">Jadlog</option>
                    <option value="Azul Cargo">Azul Cargo Express</option>
                    <option value="Flash Courier">Flash Courier</option>
                    <option value="Motoboy / Próprio">Entrega Própria / Motoboy</option>
                    <option value="Retirada em Fábrica">Retirada em Fábrica</option>
                  </select>
                </div>

                {/* Código de Rastreio */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                    Código de Rastreio ou Link de Envio
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NL123456789BR ou https://rastreamento..."
                    value={rastreioInput}
                    onChange={(e) => setRastreioInput(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-violet-500 transition"
                  />
                  <p className="text-[10px] text-zinc-400 dark:text-neutral-500 mt-1">
                    O aluno receberá uma notificação em tempo real na tela com o link direto de rastreamento.
                  </p>
                </div>

                {/* Endereço de Destino Resumido */}
                {pedidoDespachando.enderecoEntrega && (
                  <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-xl p-3 text-[11px] text-zinc-600 dark:text-neutral-400">
                    <span className="font-bold text-zinc-800 dark:text-neutral-200 block mb-0.5">Endereço de Entrega:</span>
                    <span>
                      {pedidoDespachando.enderecoEntrega.logradouro}, {pedidoDespachando.enderecoEntrega.numero} - {pedidoDespachando.enderecoEntrega.bairro}, {pedidoDespachando.enderecoEntrega.cidade}/{pedidoDespachando.enderecoEntrega.estado}
                    </span>
                  </div>
                )}

                {/* Botões */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setModalDespachoAberto(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-neutral-400 hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoDespacho}
                    className="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold py-2 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
                  >
                    {salvandoDespacho ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando Despacho...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        <span>Confirmar Despacho</span>
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE EMISSÃO MANUAL DE LOTES COM SELETOR VISUAL DE CORES */}
        {modalEmissaoManualAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              {/* Botão Fechar */}
              <button
                type="button"
                onClick={() => setModalEmissaoManualAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabeçalho */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Emissão Manual de Lote
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Gere displays virgens sequenciais e credite no estoque do parceiro.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGerarLote} className="space-y-4">
                {/* 1. TIPO DE EMISSÃO (SELEÇÃO PRINCIPAL) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Tipo de Emissão do Lote
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Opção Venda para Aluno */}
                    <button
                      type="button"
                      onClick={() => setTipoEmissaoManual("venda_aluno")}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        tipoEmissaoManual === "venda_aluno"
                          ? "bg-sky-500/10 border-sky-500 text-sky-950 dark:text-sky-100 ring-2 ring-sky-500/30 shadow-xs"
                          : "bg-zinc-50 dark:bg-neutral-950 border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:bg-zinc-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        tipoEmissaoManual === "venda_aluno"
                          ? "border-sky-500 bg-sky-500"
                          : "border-zinc-400 dark:border-neutral-600"
                      }`}>
                        {tipoEmissaoManual === "venda_aluno" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-sky-500" />
                          <span>Venda para Aluno / Parceiro</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
                          Tabela comercial • Credita estoque do aluno
                        </div>
                      </div>
                    </button>

                    {/* Opção Reposição Própria (ADM) */}
                    <button
                      type="button"
                      onClick={() => setTipoEmissaoManual("reposicao_propria")}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        tipoEmissaoManual === "reposicao_propria"
                          ? "bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/30 shadow-xs"
                          : "bg-zinc-50 dark:bg-neutral-950 border-zinc-200 dark:border-neutral-800 text-zinc-600 dark:text-neutral-400 hover:bg-zinc-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        tipoEmissaoManual === "reposicao_propria"
                          ? "border-amber-500 bg-amber-500"
                          : "border-zinc-400 dark:border-neutral-600"
                      }`}>
                        {tipoEmissaoManual === "reposicao_propria" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <PackagePlus className="w-3.5 h-3.5 text-amber-500" />
                          <span>Reposição Própria (ADM)</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
                          Preço de custo (R$ {(custoUnitarioDisplay || 12.30).toFixed(2).replace(".", ",")}/un) • Fábrica
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quantidade */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider">
                      Quantidade Total de Displays
                    </label>
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-neutral-400">
                      {tipoEmissaoManual === "reposicao_propria" ? `R$ ${(custoUnitarioDisplay || 12.30).toFixed(2).replace(".", ",")}/un (Custo Fábrica)` : "Preço de Tabela Comercial"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[20, 50, 100].map((qtd) => (
                      <button
                        key={qtd}
                        type="button"
                        onClick={() => setQuantidadeLote(qtd)}
                        className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          quantidadeLote === qtd
                            ? tipoEmissaoManual === "reposicao_propria"
                              ? "bg-amber-500 text-black border-amber-400 shadow-xs"
                              : "bg-emerald-500 text-black border-emerald-400 shadow-xs"
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
                    max="1000"
                    required
                    value={quantidadeLote}
                    onChange={(e) => setQuantidadeLote(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition font-mono"
                  />
                </div>

                {/* SELETOR VISUAL DE CORES (AZUL / PRETO) */}
                <div className="space-y-3 bg-zinc-50/60 dark:bg-neutral-950/60 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-zinc-800 dark:text-neutral-200 uppercase tracking-wider">
                      Composição de Cores dos Displays
                    </label>
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {qtdPretaManual} Pretas / {qtdAzulManual} Azuis
                    </span>
                  </div>

                  {/* 4 Botões de Seleção Rápida */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpcaoCorManual("misto")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        opcaoCorManual === "misto"
                          ? "bg-emerald-500 text-black border-emerald-400 shadow-sm"
                          : "bg-white dark:bg-neutral-900 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300"
                      }`}
                    >
                      Misto 50/50
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpcaoCorManual("preta")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        opcaoCorManual === "preta"
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-700 dark:border-white shadow-sm"
                          : "bg-white dark:bg-neutral-900 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300"
                      }`}
                    >
                      100% Preta
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpcaoCorManual("azul")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        opcaoCorManual === "azul"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                          : "bg-white dark:bg-neutral-900 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300"
                      }`}
                    >
                      100% Azul
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpcaoCorManual("personalizado")}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        opcaoCorManual === "personalizado"
                          ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                          : "bg-white dark:bg-neutral-900 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-800 hover:border-zinc-300"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {/* Campos Numéricos para Modo Personalizado */}
                  {opcaoCorManual === "personalizado" && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 mb-1">
                          Qtd Pretas (un):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={quantidadeLote}
                          value={qtdPretaManual}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setQtdPretaManual(val);
                          }}
                          className="w-full bg-white dark:bg-neutral-900 border border-zinc-300 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 mb-1">
                          Qtd Azuis (un):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={quantidadeLote}
                          value={qtdAzulManual}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setQtdAzulManual(val);
                          }}
                          className="w-full bg-white dark:bg-neutral-900 border border-zinc-300 dark:border-neutral-700 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Validação de Soma para Modo Personalizado */}
                  {opcaoCorManual === "personalizado" && qtdPretaManual + qtdAzulManual !== quantidadeLote && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        A soma atual ({qtdPretaManual + qtdAzulManual} un) difere do total do lote ({quantidadeLote} un). Ajuste os valores.
                      </span>
                    </div>
                  )}

                  {/* Cards Visuais com Fotos dos Displays */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {/* Card Placa Preta */}
                    <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition ${
                      qtdPretaManual > 0
                        ? "bg-zinc-900/5 dark:bg-neutral-900 border-zinc-800/80 dark:border-neutral-700 shadow-xs"
                        : "bg-zinc-100/40 dark:bg-neutral-900/40 border-zinc-200 dark:border-neutral-800/40 opacity-40"
                    }`}>
                      <img
                        src="/placa-preta.png"
                        alt="Display Preto Google Review"
                        className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg shadow-sm"
                      />
                      <div className="mt-2 text-center">
                        <span className="block text-xs font-bold text-zinc-900 dark:text-white">
                          Display Preto
                        </span>
                        <span className="inline-block mt-0.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black">
                          {qtdPretaManual} un ({quantidadeLote > 0 ? Math.round((qtdPretaManual / quantidadeLote) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    {/* Card Placa Azul */}
                    <div className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition ${
                      qtdAzulManual > 0
                        ? "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/40 dark:border-blue-500/40 shadow-xs"
                        : "bg-zinc-100/40 dark:bg-neutral-900/40 border-zinc-200 dark:border-neutral-800/40 opacity-40"
                    }`}>
                      <img
                        src="/placa-azul.png"
                        alt="Display Azul Google Review"
                        className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg shadow-sm"
                      />
                      <div className="mt-2 text-center">
                        <span className="block text-xs font-bold text-blue-600 dark:text-blue-400">
                          Display Azul
                        </span>
                        <span className="inline-block mt-0.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                          {qtdAzulManual} un ({quantidadeLote > 0 ? Math.round((qtdAzulManual / quantidadeLote) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Destinatário */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>{tipoEmissaoManual === "reposicao_propria" ? "Titular / Unidade Produtora" : "Aluno / Parceiro Destinatário"}</span>
                  </label>
                  {tipoEmissaoManual === "reposicao_propria" ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackagePlus className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Fábrica GOPLAK • Estoque Central (ADM)</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 uppercase font-extrabold">
                        Reposição Interna
                      </span>
                    </div>
                  ) : (
                    <select
                      value={alunoSelecionado}
                      onChange={(e) => setAlunoSelecionado(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                    >
                      {alunos.map((a) => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white">
                          {a.nome} ({a.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Painel Informativo de Impacto Caixa & Estoque */}
                {tipoEmissaoManual === "reposicao_propria" ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center justify-between font-bold border-b border-amber-500/20 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Valor Total da Reposição:</span>
                      </span>
                      <span className="font-mono text-sm text-amber-800 dark:text-amber-300 font-extrabold">
                        R$ {(quantidadeLote * (custoUnitarioDisplay || COST_PER_UNIT)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-start gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span><strong>Caixa Real:</strong> Registrado como Saída / Custo Operacional (sem faturamento de revenda).</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Estoque Central:</strong> Abastece <strong>+{quantidadeLote} un</strong> displays físicos prontos na fábrica.</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-xs space-y-2 text-sky-950 dark:text-sky-100">
                    <div className="flex items-center justify-between font-bold border-b border-sky-500/20 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>Valor Total do Pedido:</span>
                      </span>
                      <span className="font-mono text-sm text-sky-800 dark:text-sky-300 font-extrabold">
                        R$ {(quantidadeLote === 10 ? 170 : quantidadeLote === 20 ? 340 : quantidadeLote === 30 ? 510 : quantidadeLote === 50 ? 800 : quantidadeLote === 100 ? 1600 : quantidadeLote * 17.0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>Caixa Real:</strong> Registra Entrada comercial e apura margem de lucro líquido.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Estoque Aluno:</strong> Displays atribuídos à conta do aluno parceiro.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prévia Dinâmica */}
                <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-3 text-xs space-y-1.5 text-zinc-600 dark:text-neutral-400">
                  <div className="flex justify-between items-center">
                    <span>Maior código cadastrado:</span>
                    <span className="text-zinc-800 dark:text-neutral-200 font-mono font-semibold">
                      {maiorCodigoNumero > 0 ? `GP-${String(maiorCodigoNumero).padStart(4, "0")}` : "Nenhum"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-200 dark:border-neutral-800">
                    <span>Próximo Lote Previsto:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {previewCodigoInicio} → {previewCodigoFim}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-zinc-200 dark:border-neutral-800 text-[11px]">
                    <span>Composição:</span>
                    <span className="font-bold text-zinc-900 dark:text-white font-mono">
                      {qtdPretaManual} Pretas + {qtdAzulManual} Azuis ({quantidadeLote} un)
                    </span>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setModalEmissaoManualAberto(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-neutral-400 hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={gerandoLote || (opcaoCorManual === "personalizado" && qtdPretaManual + qtdAzulManual !== quantidadeLote)}
                    className={`font-extrabold py-2 px-4 rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs ${
                      tipoEmissaoManual === "reposicao_propria"
                        ? "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black"
                        : "bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black"
                    }`}
                  >
                    {gerandoLote ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gerando Lote...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>
                          {tipoEmissaoManual === "reposicao_propria"
                            ? `Gerar Reposição (R$ ${(quantidadeLote * (custoUnitarioDisplay || 12.30)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`
                            : "Gerar Lote no Banco"}
                        </span>
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE VISUALIZAÇÃO DO COMPROVANTE BANCÁRIO */}
        {modalComprovanteAberto && pedidoSelecionadoComprovante && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              {/* Botão Fechar */}
              <button
                type="button"
                onClick={() => setModalComprovanteAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabeçalho */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Conferência de Comprovante PIX
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Pedido de <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pedidoSelecionadoComprovante.alunoNome}</span> ({pedidoSelecionadoComprovante.quantidade} displays)
                  </p>
                </div>
              </div>

              {/* Grid de Resumo do Pedido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-zinc-50 dark:bg-neutral-950 p-3 rounded-2xl border border-zinc-200 dark:border-neutral-800 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Aluno</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">{pedidoSelecionadoComprovante.alunoNome}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Quantidade</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{pedidoSelecionadoComprovante.quantidade} Displays</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Composição</span>
                  <span className="font-medium text-zinc-800 dark:text-neutral-200">{pedidoSelecionadoComprovante.modeloCor || "Misto"}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Valor Total</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    R$ {(pedidoSelecionadoComprovante.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Visualizador de Imagem / PDF */}
              <div className="bg-zinc-950 rounded-2xl p-2 sm:p-3 border border-zinc-800 flex flex-col items-center justify-center min-h-[260px] max-h-[480px] overflow-hidden relative">
                {pedidoSelecionadoComprovante.comprovanteUrl?.toLowerCase().endsWith(".pdf") ? (
                  <div className="text-center p-6 space-y-3">
                    <FileText className="w-12 h-12 text-sky-400 mx-auto" />
                    <p className="text-xs text-zinc-300 font-medium">Documento em Formato PDF</p>
                    <a
                      href={pedidoSelecionadoComprovante.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs shadow transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Documento PDF</span>
                    </a>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    <img
                      src={pedidoSelecionadoComprovante.comprovanteUrl}
                      alt="Comprovante de Pagamento"
                      className="max-h-[420px] max-w-full object-contain rounded-xl shadow-lg"
                    />
                    <a
                      href={pedidoSelecionadoComprovante.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir imagem original em nova aba</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Ações de Aprovação / Recusa no Rodapé do Modal */}
              <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-neutral-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setModalComprovanteAberto(false)}
                  className="bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold px-4 py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  Fechar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAbrirModalRecusa(pedidoSelecionadoComprovante)}
                    disabled={processandoAcaoId === pedidoSelecionadoComprovante.id}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold px-4 py-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Recusar Pedido</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAprovarPedido(pedidoSelecionadoComprovante)}
                    disabled={processandoAcaoId === pedidoSelecionadoComprovante.id}
                    className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold px-5 py-3 rounded-xl text-xs transition cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {processandoAcaoId === pedidoSelecionadoComprovante.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Aprovar Pedido & Liberar Displays</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE RECUSA DE PEDIDO */}
        {modalRecusarAberto && pedidoRecusando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Recusar Pedido
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Aluno: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pedidoRecusando.alunoNome}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider">
                  Motivo da Recusa (Opcional)
                </label>
                <textarea
                  value={motivoRecusaInput}
                  onChange={(e) => setMotivoRecusaInput(e.target.value)}
                  placeholder="Ex: Comprovante ilegível, valor divergente ou pagamento não identificado."
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500 transition min-h-[90px]"
                />

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalRecusarAberto(false)}
                    className="flex-1 bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-700 dark:text-neutral-300 font-semibold py-3 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmarRecusaPedido}
                    disabled={processandoAcaoId === pedidoRecusando.id}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processandoAcaoId === pedidoRecusando.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Confirmar Recusa</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PEDIDO */}
        {modalExcluirAberto && pedidoExcluindo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setModalExcluirAberto(false)}
                disabled={excluindoPedido}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Excluir Pedido
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Confirmação de exclusão permanente e estorno de valores.
                  </p>
                </div>
              </div>

              {/* Detalhes do Pedido */}
              <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 text-xs space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Aluno:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{pedidoExcluindo.alunoNome}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Quantidade:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white">{pedidoExcluindo.quantidade} Displays</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Valor Total:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {(pedidoExcluindo.valorTotal || (pedidoExcluindo.quantidade * 18)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Status Atual:</span>
                  <span className="font-bold capitalize">{pedidoExcluindo.status.replace("_", " ")}</span>
                </div>
              </div>

              {/* Aviso de Impacto */}
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1 mb-4">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Tem certeza que deseja excluir este pedido?</span>
                </p>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80 leading-relaxed">
                  Essa ação não pode ser desfeita. O pedido será removido, os lançamentos de caixa vinculados serão estornados e os displays retornarão ao estoque da fábrica.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalExcluirAberto(false)}
                  disabled={excluindoPedido}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarExclusaoPedido}
                  disabled={excluindoPedido}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {excluindoPedido ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Excluindo e Estornando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar Exclusão</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE ENDEREÇO COMPLETO */}
        {modalEnderecoAberto && enderecoVisualizando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setModalEnderecoAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Endereço de Entrega
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Destinatário: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{enderecoVisualizando.alunoNome}</span>
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-4 text-xs space-y-2 text-zinc-800 dark:text-neutral-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Logradouro / Número</span>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-white">
                    {enderecoVisualizando.endereco.logradouro}, {enderecoVisualizando.endereco.numero}
                    {enderecoVisualizando.endereco.complemento ? ` (${enderecoVisualizando.endereco.complemento})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Bairro / Cidade / UF</span>
                  <span className="font-medium">
                    {enderecoVisualizando.endereco.bairro} • {enderecoVisualizando.endereco.cidade} / {enderecoVisualizando.endereco.estado}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">CEP</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{enderecoVisualizando.endereco.cep}</span>
                </div>
                {enderecoVisualizando.endereco.ponto_referencia && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-neutral-800">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-neutral-500 block">Ponto de Referência</span>
                    <span className="italic text-zinc-600 dark:text-neutral-400">{enderecoVisualizando.endereco.ponto_referencia}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalEnderecoAberto(false)}
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DO PÓDIO MENSAL - TOP DISPLAY */}
        {modalPodioAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              {/* Botão Fechar */}
              <button
                type="button"
                onClick={() => setModalPodioAberto(false)}
                disabled={gerandoPremio}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Cabeçalho do Modal */}
              <div className="flex items-start gap-3.5 mb-6">
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-600 dark:text-amber-400 shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-mono">
                      Ciclo: {[
                        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                      ][new Date().getMonth()]}/{new Date().getFullYear()}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white mt-1">
                    Encerramento do Ciclo Mensal - Top Display
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1">
                    Confira o pódio de compras antes de liberar a bonificação automática.
                  </p>
                </div>
              </div>

              {/* Pódio dos Top 3 Alunos */}
              <div className="space-y-3 mb-6">
                {(() => {
                  const podiumSlots = [
                    {
                      posicao: 1,
                      titulo: "1º LUGAR",
                      tag: "CAMPEÃO",
                      tagClass: "bg-amber-500 text-black font-black",
                      cardBorder: "border-amber-400/80 dark:border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/30 ring-1 ring-amber-500/20 shadow-md shadow-amber-500/5",
                      iconBg: "bg-amber-500 text-black",
                      emoji: "🥇",
                      aluno: podioAlunos[0] || null,
                    },
                    {
                      posicao: 2,
                      titulo: "2º LUGAR",
                      tag: "2º LUGAR",
                      tagClass: "bg-zinc-200 dark:bg-neutral-700 text-zinc-800 dark:text-zinc-200 font-bold",
                      cardBorder: "border-zinc-300 dark:border-neutral-700 bg-zinc-50 dark:bg-neutral-800/60",
                      iconBg: "bg-zinc-200 dark:bg-neutral-700 text-zinc-800 dark:text-white",
                      emoji: "🥈",
                      aluno: podioAlunos[1] || null,
                    },
                    {
                      posicao: 3,
                      titulo: "3º LUGAR",
                      tag: "3º LUGAR",
                      tagClass: "bg-orange-500/20 text-orange-700 dark:text-orange-400 font-bold",
                      cardBorder: "border-orange-500/30 dark:border-orange-500/20 bg-orange-500/5 dark:bg-orange-950/20",
                      iconBg: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                      emoji: "🥉",
                      aluno: podioAlunos[2] || null,
                    },
                  ];

                  return podiumSlots.map((slot) => {
                    const hasAluno = Boolean(slot.aluno && slot.aluno.quantidade > 0);
                    const isPrimeiro = slot.posicao === 1;

                    return (
                      <div
                        key={slot.posicao}
                        className={`p-4 rounded-2xl border transition-all ${
                          hasAluno
                            ? slot.cardBorder
                            : "border-zinc-200 dark:border-neutral-800/80 bg-zinc-50/50 dark:bg-neutral-900/40 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${slot.iconBg}`}
                            >
                              {slot.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-bold truncate ${
                                    hasAluno
                                      ? "text-zinc-900 dark:text-white"
                                      : "text-zinc-400 dark:text-neutral-500 italic"
                                  }`}
                                >
                                  {hasAluno ? slot.aluno!.nome : "Sem concorrente"}
                                </span>
                                <span
                                  className={`text-[10px] uppercase px-2 py-0.5 rounded-full shrink-0 tracking-wider ${slot.tagClass}`}
                                >
                                  {slot.tag}
                                </span>
                              </div>
                              {hasAluno && slot.aluno!.email && (
                                <p className="text-xs text-zinc-500 dark:text-neutral-400 truncate">
                                  {slot.aluno!.email}
                                </p>
                              )}
                              {!hasAluno && (
                                <p className="text-[11px] text-zinc-400 dark:text-neutral-500">
                                  Nenhum pedido registrado nesta posição
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {hasAluno ? (
                              <>
                                <span
                                  className={`text-base font-black font-mono ${
                                    isPrimeiro
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-zinc-700 dark:text-neutral-300"
                                  }`}
                                >
                                  {slot.aluno!.quantidade}
                                </span>
                                <span className="text-[11px] text-zinc-500 dark:text-neutral-400 ml-1">
                                  displays
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-400 dark:text-neutral-600 font-mono">-</span>
                            )}
                          </div>
                        </div>

                        {isPrimeiro && hasAluno && (
                          <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
                            <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                              <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Bonificação Automática:
                            </span>
                            <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-300">
                              +10 Displays Grátis
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Banner Informativo */}
              <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 p-3.5 rounded-2xl text-xs text-sky-800 dark:text-sky-300 mb-6 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                <span>
                  Ao confirmar, um lote com <strong>10 displays virgens sequenciais</strong> será gerado e inserido no estoque do aluno campeão automaticamente sem custos.
                </span>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalPodioAberto(false)}
                  disabled={gerandoPremio}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarPremio}
                  disabled={gerandoPremio || podioAlunos.length === 0 || podioAlunos[0]?.quantidade <= 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 text-xs font-extrabold shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gerandoPremio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando 10 Displays...</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4" />
                      <span>Confirmar & Gerar 10 Displays Grátis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MODAL DE LANÇAMENTO DE DESPESA / FRETE */}
        {modalDespesaAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setModalDespesaAberto(false)}
                disabled={salvandoDespesa}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Lançar Despesa / Frete
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Registre saídas para apuração precisa do lucro líquido real.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvarDespesa} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Categoria da Despesa
                  </label>
                  <select
                    value={despesaCategoria}
                    onChange={(e) => setDespesaCategoria(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500 outline-hidden transition cursor-pointer"
                  >
                    <option value="Frete">🚚 Frete / Logística de Envio</option>
                    <option value="Embalagem">📦 Embalagens / Caixas / Fitas</option>
                    <option value="Reposição Fornecedor">🏭 Reposição Fornecedor / Fábrica</option>
                    <option value="Outros">💼 Outros Custos Operacionais</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Descrição do Gasto
                  </label>
                  <input
                    type="text"
                    value={despesaDescricao}
                    onChange={(e) => setDespesaDescricao(e.target.value)}
                    placeholder="Ex: Sedex Lote 30 displays - GOPlak"
                    className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Valor da Despesa (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-zinc-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={despesaValor}
                      onChange={(e) => setDespesaValor(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setModalDespesaAberto(false)}
                    disabled={salvandoDespesa}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoDespesa || !despesaValor}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {salvandoDespesa ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Registrando Saída...</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>Registrar Saída no Caixa</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE REPOSIÇÃO DE ESTOQUE COM FORNECEDOR */}
        {modalReposicaoAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setModalReposicaoAberto(false)}
                disabled={salvandoReposicao}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <PackagePlus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Repor Displays do Fornecedor
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Registre a chegada de novas peças para abastecer o estoque físico.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvarReposicao} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Quantidade Recebida (Unidades)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reposicaoQtd}
                    onChange={(e) => setReposicaoQtd(parseInt(e.target.value, 10) || 0)}
                    placeholder="Ex: 100"
                    className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Custo Unitário de Compra (R$/un)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-zinc-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={reposicaoCustoUnitario}
                      onChange={(e) => setReposicaoCustoUnitario(e.target.value)}
                      placeholder="12.30"
                      className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-hidden transition"
                    />
                  </div>
                </div>

                {/* Box de Resumo da Reposição */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center justify-between">
                    <span>Estoque Atual:</span>
                    <span className="font-mono font-bold">{estoqueDisplaysProntos} displays</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Novo Estoque Previsto:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {estoqueDisplaysProntos + (Number(reposicaoQtd) || 0)} displays
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 font-semibold">
                    <span>Nova Cobertura Estimada:</span>
                    <span className="font-mono">
                      ~{Math.round((estoqueDisplaysProntos + (Number(reposicaoQtd) || 0)) / (mediaSaidaDiaria || 2.5))} dias
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-zinc-600 dark:text-neutral-400">
                    <span>Custo Total do Lote:</span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">
                      R$ {((Number(reposicaoQtd) || 0) * (parseFloat(reposicaoCustoUnitario.replace(",", ".")) || 12.30)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Checkbox para lançar despesa no caixa */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={reposicaoLancarDespesa}
                    onChange={(e) => setReposicaoLancarDespesa(e.target.checked)}
                    className="mt-0.5 rounded-sm border-zinc-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs text-zinc-700 dark:text-neutral-300">
                    Lançar despesa desta compra automaticamente no Caixa da Fábrica (Saída de Fornecedor)
                  </span>
                </label>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setModalReposicaoAberto(false)}
                    disabled={salvandoReposicao}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoReposicao || !reposicaoQtd || reposicaoQtd <= 0}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {salvandoReposicao ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Abastecendo Estoque...</span>
                      </>
                    ) : (
                      <>
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Confirmar Entrada no Estoque</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE EXTRATO COMPLETO DO CAIXA COM FILTRO DE MÊS & EXPORTAÇÃO PDF */}
        {modalExtratoCaixaAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
              <button
                type="button"
                onClick={() => setModalExtratoCaixaAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800 pr-8 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Receipt className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      Extrato Financeiro do Caixa da Fábrica
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-neutral-400">
                      Histórico consolidado de entradas de lotes e despesas operacionais.
                    </p>
                  </div>
                </div>

                {/* Controles de Filtro e Exportação PDF no Topo */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Seletor de Mês */}
                  <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-neutral-700">
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-neutral-400 flex items-center gap-1">
                      📅 Mês:
                    </span>
                    <select
                      value={filtroMesExtrato}
                      onChange={(e) => setFiltroMesExtrato(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="todos" className="dark:bg-neutral-900">Todos os Meses</option>
                      {mesesDisponiveisExtrato.map((m) => {
                        const [ano, mes] = m.split("-");
                        const d = new Date(Number(ano), Number(mes) - 1, 1);
                        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                        const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
                        return (
                          <option key={m} value={m} className="dark:bg-neutral-900">
                            {labelCap}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Botão Baixar PDF do Extrato */}
                  <button
                    type="button"
                    onClick={handleExportarPdfExtrato}
                    disabled={gerandoPdfExtrato || itensCaixaFiltrados.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="Baixar relatório formatado em PDF do período filtrado"
                  >
                    {gerandoPdfExtrato ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Cards de Resumo no Topo do Extrato (Reativos ao Mês Selecionado) */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <div className="bg-zinc-50 dark:bg-neutral-950 p-3 rounded-2xl border border-zinc-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Faturamento Bruto</span>
                    <span className="text-[9px] text-zinc-400 font-mono">({metricasExtratoFiltrado.totalEntradas} entradas)</span>
                  </div>
                  <span className="text-base font-black text-zinc-900 dark:text-white font-mono">
                    R$ {metricasExtratoFiltrado.faturamentoBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-neutral-950 p-3 rounded-2xl border border-zinc-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-rose-500 block">Custos & Saídas</span>
                    <span className="text-[9px] text-rose-400 font-mono">({metricasExtratoFiltrado.totalSaidas} saídas)</span>
                  </div>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                    R$ {metricasExtratoFiltrado.custosTotais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-neutral-950 p-3 rounded-2xl border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Lucro Líquido Real</span>
                  <span className={`text-base font-black font-mono ${metricasExtratoFiltrado.lucroLiquidoReal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                    R$ {metricasExtratoFiltrado.lucroLiquidoReal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de Lançamentos Filtrados */}
              <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-neutral-800 rounded-2xl divide-y divide-zinc-100 dark:divide-neutral-800">
                {itensCaixaFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 dark:text-neutral-500">
                    Nenhum lançamento encontrado no período selecionado ({filtroMesExtrato === "todos" ? "geral" : filtroMesExtrato}).
                  </div>
                ) : (
                  itensCaixaFiltrados.map((item) => {
                    const isEntrada = item.tipo === "ENTRADA";
                    const dt = item.created_at ? new Date(item.created_at) : new Date();
                    return (
                      <div key={item.id} className="p-3 hover:bg-zinc-50 dark:hover:bg-neutral-800/40 flex items-center justify-between gap-3 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                              isEntrada
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {item.tipo}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                                {item.descricao}
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-neutral-500 px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-neutral-800">
                                {item.categoria}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 dark:text-neutral-500">
                              {dt.toLocaleDateString("pt-BR")} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`font-mono font-bold text-xs ${isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {isEntrada ? "+ " : "- "} R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                          {isEntrada && item.lucro_liquido !== undefined && (
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Lucro: R$ {Number(item.lucro_liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-4 mt-2 flex justify-between items-center">
                <span className="text-xs text-zinc-400 dark:text-neutral-500">
                  {itensCaixaFiltrados.length} {itensCaixaFiltrados.length === 1 ? "registro exibido" : "registros exibidos"}
                </span>
                <button
                  type="button"
                  onClick={() => setModalExtratoCaixaAberto(false)}
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Fechar Extrato
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE AJUSTE DIRETO / CALIBRAÇÃO DE ESTOQUE DA FÁBRICA */}
        {modalAjustarEstoqueAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setModalAjustarEstoqueAberto(false)}
                disabled={salvandoAjusteEstoque}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Package className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Calibrar Estoque da Fábrica
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Ajuste direto para sincronizar com a contagem física real ou zerar.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvarAjusteEstoque} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-neutral-400 uppercase tracking-wider mb-1">
                    Novo Saldo de Estoque Real (Unidades)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={inputNovoEstoque}
                    onChange={(e) => setInputNovoEstoque(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full bg-zinc-50 dark:bg-neutral-800/80 border border-zinc-200 dark:border-neutral-700 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-hidden transition"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-1">
                    Digite <strong className="text-zinc-700 dark:text-neutral-200">0</strong> caso todos os pedidos tenham sido excluídos e o estoque inicial deva ser zerado.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                  <div className="flex justify-between">
                    <span>Estoque Registrado Atual:</span>
                    <strong className="font-mono">{estoqueDisplaysProntos} un</strong>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Novo Saldo a Salvar:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">{inputNovoEstoque} un</strong>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setInputNovoEstoque(0)}
                    className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    Zerar Saldo (0 un)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAjustarEstoqueAberto(false)}
                    disabled={salvandoAjusteEstoque}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoAjusteEstoque}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {salvandoAjusteEstoque ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando Saldo...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar Novo Estoque</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE EDIÇÃO DE PLACA / DISPLAY PELO ADMIN */}
        {modalEditarPlacaAberto && placaEditandoAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setModalEditarPlacaAberto(false)}
                className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer p-1 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                  {placaEditandoAdmin.codigo}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Editar Display {placaEditandoAdmin.codigo}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">
                    Altere os dados da loja, responsável, contato e link de avaliação do Google.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvarEdicaoPlacaAdmin} className="space-y-3.5">
                {/* Nome do Comércio / Estabelecimento */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    Nome da Loja / Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={salvandoEdicaoPlaca}
                    value={editNomeLoja}
                    onChange={(e) => setEditNomeLoja(e.target.value)}
                    placeholder="Ex: Pizzaria Bella Roma"
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Responsável & WhatsApp (Grid 2 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                      Responsável
                    </label>
                    <input
                      type="text"
                      disabled={salvandoEdicaoPlaca}
                      value={editResponsavel}
                      onChange={(e) => setEditResponsavel(e.target.value)}
                      placeholder="Ex: Mariana Silva"
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                      WhatsApp de Contato
                    </label>
                    <input
                      type="text"
                      disabled={salvandoEdicaoPlaca}
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Link do Google Maps / Avaliação */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    Link do Google Maps / Avaliação
                  </label>
                  <input
                    type="url"
                    disabled={salvandoEdicaoPlaca}
                    value={editLinkGoogle}
                    onChange={(e) => setEditLinkGoogle(e.target.value)}
                    placeholder="https://g.page/r/.../review"
                    className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-sky-500"
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
                      Dica: Abra o gerador, localize a empresa, copie o link de avaliação direta e cole no campo acima.
                    </p>
                  </div>
                </div>

                {/* Valor de Venda (R$) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                    Valor do Display (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-zinc-500 font-bold">R$</span>
                    <input
                      type="text"
                      disabled={salvandoEdicaoPlaca}
                      value={editValorVenda}
                      onChange={(e) => setEditValorVenda(e.target.value)}
                      placeholder="80,00"
                      className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Bloco de Múltiplos Serviços Adicionais (Dinâmico) */}
                <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Outras Vendas / Serviços Adicionais</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {editServicosAdmin.length} {editServicosAdmin.length === 1 ? "adicionado" : "adicionados"}
                    </span>
                  </div>

                  {editServicosAdmin.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 dark:text-neutral-400 italic py-1">
                      Nenhum serviço adicional vinculado. Clique no botão abaixo para adicionar (ex: Otimização GMN, Fotos 360, etc.).
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {editServicosAdmin.map((servico, idx) => (
                        <div
                          key={servico.id || idx}
                          className="p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-neutral-800 rounded-xl space-y-2 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              disabled={salvandoEdicaoPlaca}
                              placeholder="Descrição (ex: Otimização Google Meu Negócio, Fotos...)"
                              value={servico.descricao}
                              onChange={(e) => {
                                const novaLista = [...editServicosAdmin];
                                novaLista[idx].descricao = e.target.value;
                                setEditServicosAdmin(novaLista);
                              }}
                              className="w-full bg-transparent border-0 border-b border-zinc-200 dark:border-neutral-800 px-1 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 font-medium"
                            />
                            <button
                              type="button"
                              disabled={salvandoEdicaoPlaca}
                              onClick={() => {
                                setEditServicosAdmin(editServicosAdmin.filter((_, i) => i !== idx));
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
                                disabled={salvandoEdicaoPlaca}
                                placeholder="150,00"
                                value={servico.valor}
                                onChange={(e) => {
                                  const novaLista = [...editServicosAdmin];
                                  novaLista[idx].valor = e.target.value;
                                  setEditServicosAdmin(novaLista);
                                }}
                                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-lg pl-7 pr-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <select
                                disabled={salvandoEdicaoPlaca}
                                value={servico.tipo_cobranca}
                                onChange={(e) => {
                                  const novaLista = [...editServicosAdmin];
                                  novaLista[idx].tipo_cobranca = e.target.value as "unico" | "recorrente";
                                  setEditServicosAdmin(novaLista);
                                }}
                                className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
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
                    disabled={salvandoEdicaoPlaca}
                    onClick={() => {
                      setEditServicosAdmin([
                        ...editServicosAdmin,
                        {
                          id: `admin-serv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                          descricao: "",
                          valor: "",
                          tipo_cobranca: "unico",
                        },
                      ]);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>👉 + Adicionar Outro Serviço</span>
                  </button>
                </div>

                {/* Botões do Rodapé */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setModalEditarPlacaAberto(false)}
                    disabled={salvandoEdicaoPlaca}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 dark:text-neutral-400 hover:bg-zinc-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoEdicaoPlaca}
                    className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {salvandoEdicaoPlaca ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando Alterações...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Salvar Display no Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

