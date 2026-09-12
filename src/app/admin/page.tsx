"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
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
  LogOut
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";


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
  created_at?: string;
  updated_at?: string;
}

interface LoteExport {
  id: string;
  data: string;
  alunoNome: string;
  alunoId?: string;
  quantidade: number;
  codigoInicio: string;
  codigoFim: string;
  status: string;
  temLoteGerado: boolean;
  codigoRastreio?: string;
  observacao?: string;
}

const extrairNumeroCodigo = (cod: string | undefined | null): number => {
  if (!cod) return 0;
  const match = cod.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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

  // Métricas Consolidadas
  const [totalProduzidas, setTotalProduzidas] = useState(0);
  const [totalAtivas, setTotalAtivas] = useState(0);
  const [totalVirgens, setTotalVirgens] = useState(0);
  const [volumeTransacionado, setVolumeTransacionado] = useState(0);

  // Sequenciamento Numérico Real
  const [maiorCodigoNumero, setMaiorCodigoNumero] = useState(0);

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

      // Garantir que o usuário Daniel Rodrigues esteja na lista
      const danielId = "403183b5-02f6-46a7-b448-7658c5087ec4";
      const danielEmail = "daniel.rodrigues2508@gmail.com";
      const existsDaniel = listaAlunos.some((a) => a.id === danielId || (a.email && a.email.toLowerCase() === danielEmail));
      if (!existsDaniel) {
        listaAlunos.unshift({
          id: danielId,
          nome: "Daniel Rodrigues",
          email: danielEmail,
        });
      }

      // Priorizar Daniel Rodrigues no topo da lista
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

      // 3. Cálculo das Métricas
      const total = listaPlacas.length;
      const ativas = listaPlacas.filter((p) => p.status === "ativa");
      const virgens = listaPlacas.filter((p) => p.status === "virgem");
      const volume = ativas.reduce((acc, curr) => {
        const val = Number(curr.valor_venda);
        return acc + (isNaN(val) ? 80.0 : val);
      }, 0);

      setTotalProduzidas(total);
      setTotalAtivas(ativas.length);
      setTotalVirgens(virgens.length);
      setVolumeTransacionado(volume);

      // 4. Maior Código Numérico
      let maxInt = 0;
      listaPlacas.forEach((p) => {
        if (p.codigo) {
          const numeros = p.codigo.match(/\d+/g);
          if (numeros && numeros.length > 0) {
            const num = parseInt(numeros.join(""), 10);
            if (!isNaN(num) && num > maxInt) {
              maxInt = num;
            }
          }
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
            if (st === "Em Produção" || st === "em produção") st = "em_producao";
            if (st === "pendente") st = "solicitado";

            const nomeFinal = alunoObj ? alunoObj.nome : (ped.destinatario || ped.aluno_nome || (ped.aluno_id ? "Aluno Parceiro" : "Distribuidor"));

            return {
              id: ped.id,
              data: dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              alunoNome: nomeFinal,
              alunoId: ped.aluno_id || ped.user_id,
              quantidade: ped.quantidade || (temPlacas ? placasDoPedido.length : 10),
              codigoInicio: codIni || "Não gerado",
              codigoFim: codFim || "Não gerado",
              status: st,
              temLoteGerado: temLote,
              codigoRastreio: ped.codigo_rastreio || "",
              observacao: ped.observacao || ped.tipo || "",
            };
          });
          setLotes(formatados);
          console.log("Lotes carregados no Admin:", formatados);
        } else if (listaPlacas.length > 0) {
          const p1 = listaPlacas[0]?.codigo || "GP-0001";
          const pFim = listaPlacas[listaPlacas.length - 1]?.codigo || `GP-${String(listaPlacas.length).padStart(4, "0")}`;
          const n1 = parseInt((p1 || "").match(/\d+/)?.[0] || "0", 10);
          const n2 = parseInt((pFim || "").match(/\d+/)?.[0] || "0", 10);
          const minCod = Math.min(n1, n2);
          const maxCod = Math.max(n1, n2);

          setLotes([
            {
              id: "lote-registrado",
              data: new Date().toLocaleDateString("pt-BR") + " 10:00",
              alunoNome: listaAlunos[0]?.nome || "Daniel Rodrigues",
              quantidade: listaPlacas.length,
              codigoInicio: `GP-${String(minCod).padStart(4, "0")}`,
              codigoFim: `GP-${String(maxCod).padStart(4, "0")}`,
              status: "entregue",
              temLoteGerado: true,
            },
          ]);
        } else {
          setLotes([]);
        }
      } catch (errPed) {
        console.warn("Aviso ao buscar lotes:", errPed);
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
  }, [fetchAdminData]);

  // Cálculos da Prévia Dinâmica
  const proximoInicio = maiorCodigoNumero + 1;
  const proximoFim = maiorCodigoNumero + (quantidadeLote > 0 ? quantidadeLote : 1);
  const previewCodigoInicio = `GP-${String(proximoInicio).padStart(4, "0")}`;
  const previewCodigoFim = `GP-${String(proximoFim).padStart(4, "0")}`;

  // Gerar Novo Lote no Banco de Dados
  const handleGerarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantidadeLote <= 0) return;

    setGerandoLote(true);
    setFeedbackSucesso(null);
    setErroMsg(null);

    try {
      let maxAtual = maiorCodigoNumero;
      const { data: checkPlacas } = await supabase.from("placas").select("codigo");
      if (checkPlacas && checkPlacas.length > 0) {
        checkPlacas.forEach((p) => {
          if (p.codigo) {
            const numeros = p.codigo.match(/\d+/g);
            if (numeros && numeros.length > 0) {
              const num = parseInt(numeros.join(""), 10);
              if (!isNaN(num) && num > maxAtual) maxAtual = num;
            }
          }
        });
      }

      const inicio = maxAtual + 1;
      const fim = maxAtual + quantidadeLote;
      const codInicioStr = `GP-${String(inicio).padStart(4, "0")}`;
      const codFimStr = `GP-${String(fim).padStart(4, "0")}`;

      const alunoAlvo = alunos.find((a) => a.id === alunoSelecionado) || alunos[0];
      const alunoUuid = alunoAlvo?.id || "403183b5-02f6-46a7-b448-7658c5087ec4";

      // 1. Criar novo registro independente na tabela pedidos_lotes (INSERT estrito)
      let pedidoId: string | undefined = undefined;
      const payloadPedido = {
        aluno_id: alunoUuid,
        quantidade: quantidadeLote,
        valor_total: quantidadeLote * 35.0,
        status: "solicitado",
      };

      try {
        const { data: novoPed, error: errPed } = await supabase
          .from("pedidos_lotes")
          .insert([payloadPedido])
          .select()
          .maybeSingle();

        if (!errPed && novoPed?.id) {
          pedidoId = novoPed.id;
        } else {
          // Fallback REST direto
          const resRest = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_lotes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify(payloadPedido),
          });
          if (resRest.ok) {
            const arr = await resRest.json();
            if (Array.isArray(arr) && arr[0]?.id) {
              pedidoId = arr[0].id;
            }
          }
        }
      } catch (ePed) {
        console.error("Erro ao inserir pedido_lote:", ePed);
      }

      // 2. Criar as placas vinculadas ao pedidoId e aluno_id
      const novasPlacas = [];
      for (let i = inicio; i <= fim; i++) {
        novasPlacas.push({
          codigo: `GP-${String(i).padStart(4, "0")}`,
          status: "virgem",
          valor_venda: 80.0,
          nome_empresa: "",
          link_google_review: "",
          whatsapp_feedback: "",
          aluno_id: alunoUuid,
          pedido_id: pedidoId || null,
        });
      }

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

      const msg = `Lote de ${quantidadeLote} placas criado com sucesso! Intervalo: ${codInicioStr} → ${codFimStr}`;
      setFeedbackSucesso(msg);

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
      
      // Resolução Dinâmica e Confiável do Destinatário (Coluna E)
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
        destinatarioNome = "Daniel Rodrigues";
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "TagPlak";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Produção Gráfica", {
        views: [{ showGridLines: true }],
      });

      // Definição das 5 Colunas obrigatórias
      worksheet.columns = [
        { header: "Código da Placa", key: "codigo", width: 18 },
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

      // Preenchimento de Cada Linha do Arquivo Excel (garantindo todas as linhas preenchidas)
      let currentRowIndex = 2;
      for (const placa of placasDoLote) {
        const cod = placa.codigo;
        const linkDinamico = `${appBaseUrl}/r/${cod}`;
        const qrCodeGraficaUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(linkDinamico)}`;

        // Linha com altura para QR Code e dados legíveis
        const row = worksheet.addRow({
          codigo: cod,
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
            tl: { col: 2.15, row: currentRowIndex - 1 + 0.05 },
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
      // 1. Obter maior código numérico atual no banco
      let maxAtual = 0;
      const { data: checkPlacas, error: errPlacas } = await supabase
        .from("placas")
        .select("codigo");

      if (!errPlacas && checkPlacas) {
        checkPlacas.forEach((p) => {
          if (p.codigo) {
            const numeros = p.codigo.match(/\d+/g);
            if (numeros && numeros.length > 0) {
              const num = parseInt(numeros.join(""), 10);
              if (!isNaN(num) && num > maxAtual) maxAtual = num;
            }
          }
        });
      }

      const qtd = lote.quantidade > 0 ? lote.quantidade : 20;
      const inicio = maxAtual + 1;
      const fim = maxAtual + qtd;
      const codInicioStr = `GP-${String(inicio).padStart(4, "0")}`;
      const codFimStr = `GP-${String(fim).padStart(4, "0")}`;

      console.log(`Sequência calculada: ${codInicioStr} a ${codFimStr} (${qtd} displays)`);

      // 2. Montar array de novas placas virgens
      const novasPlacas: PlacaRecord[] = [];
      for (let i = inicio; i <= fim; i++) {
        const codigoFormatado = `GP-${String(i).padStart(4, "0")}`;
        novasPlacas.push({
          codigo: codigoFormatado,
          aluno_id: lote.alunoId || "00000000-0000-0000-0000-000000000001",
          pedido_id: lote.id.startsWith("lote-") ? undefined : lote.id,
          status: "virgem",
          valor_venda: 80.0,
          escudo_ativo: true,
        });
      }

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
            codigo_inicio: codInicioStr,
            codigo_fim: codFimStr,
          })
          .eq("id", lote.id);

        if (errUpPed) {
          console.warn("Aviso ao atualizar pedido com códigos (tentando update simples de status):", errUpPed);
          await supabase
            .from("pedidos_lotes")
            .update({ status: "em_producao" })
            .eq("id", lote.id);
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
      // 1. Obter maior código numérico atual no banco
      let maxAtual = maiorCodigoNumero;
      const { data: checkPlacas } = await supabase.from("placas").select("codigo");
      if (checkPlacas && checkPlacas.length > 0) {
        checkPlacas.forEach((p) => {
          if (p.codigo) {
            const numeros = p.codigo.match(/\d+/g);
            if (numeros && numeros.length > 0) {
              const num = parseInt(numeros.join(""), 10);
              if (!isNaN(num) && num > maxAtual) maxAtual = num;
            }
          }
        });
      }

      const qtdPremio = 10;
      const inicio = maxAtual + 1;
      const fim = maxAtual + qtdPremio;
      const codInicioStr = `GP-${String(inicio).padStart(4, "0")}`;
      const codFimStr = `GP-${String(fim).padStart(4, "0")}`;

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

      // 4. Criar as 10 placas virgens vinculadas ao lote
      const novasPlacas = [];
      for (let i = inicio; i <= fim; i++) {
        novasPlacas.push({
          codigo: `GP-${String(i).padStart(4, "0")}`,
          status: "virgem",
          valor_venda: 80.0,
          nome_empresa: "",
          link_google_review: "",
          whatsapp_feedback: "",
          aluno_id: alunoUuid && !alunoUuid.startsWith("aluno-demo") ? alunoUuid : null,
          pedido_id: pedidoId || null,
        });
      }

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
      setMaiorCodigoNumero(fim);

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
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans p-6 lg:p-10 selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER SUPERIOR */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> TagPlak Admin
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              Gestão do Distribuidor
            </h1>
            <p className="text-xs lg:text-sm text-zinc-500 dark:text-neutral-400 mt-1">
              Painel central de emissão de lotes, estoque de fábrica e exportação para gráficas parceiras.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => {
                setRefreshing(true);
                fetchAdminData();
              }}
              title="Atualizar dados do Supabase"
              aria-label="Atualizar dados"
              className="inline-flex items-center gap-2 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
              <span>Sincronizar</span>
            </button>
            <button
              onClick={handleLogout}
              title="Sair da Conta (Logout)"
              aria-label="Sair da Conta"
              className="inline-flex items-center gap-2 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-neutral-800 text-zinc-700 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-neutral-800 hover:border-rose-500/30 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md active:scale-95 cursor-pointer"
            >
              <span>Visão Aluno</span>
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </a>
          </div>
        </header>

        {/* FEEDBACKS VISUAIS */}
        {feedbackSucesso && (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{feedbackSucesso}</span>
            </div>
            <button onClick={() => setFeedbackSucesso(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {erroMsg && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{erroMsg}</span>
            </div>
            <button onClick={() => setErroMsg(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* 1. CARDS DE MÉTRICAS CONSOLIDADAS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Produzidas */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-3">
              <span className="text-xs uppercase font-bold tracking-wider">Total Produzidas</span>
              <Layers className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900 dark:text-white">{totalProduzidas}</span>
              <span className="text-xs text-zinc-500 dark:text-neutral-400">displays</span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-neutral-500 mt-2">Emissão total registrada</p>
          </div>

          {/* Ativas no Mercado */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-3">
              <span className="text-xs uppercase font-bold tracking-wider">Ativas no Mercado</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{totalAtivas}</span>
              <span className="text-xs text-zinc-500 dark:text-neutral-400">em lojas</span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-neutral-500 mt-2">Displays gerando avaliações</p>
          </div>

          {/* Estoque Virgem */}
          <div className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-3">
              <span className="text-xs uppercase font-bold tracking-wider">Estoque Virgem</span>
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600 dark:text-amber-300">{totalVirgens}</span>
              <span className="text-xs text-zinc-500 dark:text-neutral-400">prontas</span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-neutral-500 mt-2">Disponíveis para ativação</p>
          </div>

          {/* Volume Transacionado */}
          <div className="bg-white dark:bg-neutral-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between text-zinc-500 dark:text-neutral-400 mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Volume de Vendas</span>
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-zinc-900 dark:text-white">
                R$ {volumeTransacionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-neutral-500 mt-2">Faturado pelos alunos em campo</p>
          </div>
        </section>

        {/* CARD DE DESTAQUE: TOP DISPLAY (ULTRA COMPACTO) */}
        {(() => {
          const agora = new Date();
          const ultimoDiaMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
          const diasRestantesMes = Math.max(1, ultimoDiaMes - agora.getDate());

          return (
            <section className="bg-amber-50/70 dark:bg-amber-950/10 border border-amber-300/80 dark:border-amber-500/30 rounded-2xl py-2.5 px-4 shadow-sm transition-colors flex items-center justify-between gap-4">
              {/* Lado Esquerdo */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wide shrink-0 flex items-center gap-1">
                  <span>🏆</span> TOP 1 DO MÊS
                </span>
                <span className="hidden sm:inline text-zinc-300 dark:text-neutral-700">•</span>
                {topLider ? (
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">
                    <span className="font-semibold">{topLider.nome}</span>
                    {topLider.email && (
                      <span className="text-xs text-zinc-500 dark:text-neutral-400 ml-1.5 font-normal">
                        ({topLider.email})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 dark:text-neutral-400 italic">
                    Nenhum pedido registrado no mês atual
                  </span>
                )}
              </div>

              {/* Lado Direito */}
              <div className="flex items-center gap-3 shrink-0">
                {topLider && (
                  <span className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {topLider.quantidade} displays
                  </span>
                )}
                <span className="text-xs text-amber-800 dark:text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                  Encerra em {diasRestantesMes} {diasRestantesMes === 1 ? "dia" : "dias"}
                </span>
                <button
                  type="button"
                  onClick={() => setModalPodioAberto(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                  title="Finalizar ciclo mensal e entregar bonificação do Top Display"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Finalizar Mês & Entregar Prêmio</span>
                </button>
              </div>
            </section>
          );
        })()}

        {/* 2. GRID PRINCIPAL: GERAÇÃO DE LOTE & HISTÓRICO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SEÇÃO: GERAR NOVO LOTE */}
          <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm dark:shadow-xl lg:col-span-1 transition-colors">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
              <PlusCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Gerar Novo Lote de Displays</h2>
            </div>

            <form onSubmit={handleGerarLote} className="space-y-5">
              {/* Quantidade */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Quantidade de Displays
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[20, 50, 100].map((qtd) => (
                    <button
                      key={qtd}
                      type="button"
                      onClick={() => setQuantidadeLote(qtd)}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        quantidadeLote === qtd
                          ? "bg-emerald-500 text-black border-emerald-400 shadow-sm"
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
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-base font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Aluno Destinatário */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Aluno / Parceiro Destinatário
                </label>
                <select
                  value={alunoSelecionado}
                  onChange={(e) => setAlunoSelecionado(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500 transition cursor-pointer"
                >
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id} className="bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white">
                      {a.nome} ({a.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Prévia Dinâmica do Próximo Lote */}
              <div className="bg-zinc-50 dark:bg-neutral-950 border border-zinc-200/80 dark:border-neutral-800/80 rounded-2xl p-4 text-xs space-y-2 text-zinc-600 dark:text-neutral-400">
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
                <div className="text-[11px] text-zinc-500 dark:text-neutral-500">
                  Total de <strong>{quantidadeLote}</strong> novos displays virgens sequenciais.
                </div>
              </div>

              {/* Botão de Criação */}
              <button
                type="submit"
                disabled={gerandoLote}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-extrabold py-3.5 px-4 rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {gerandoLote ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando Lote no Banco...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                    <span>Gerar Lote no Banco</span>
                  </span>
                )}
              </button>
            </form>
          </section>

          {/* SEÇÃO: EXPORTAÇÃO GRÁFICA & TABELA DE LOTES */}
          <section className="bg-white dark:bg-neutral-900/90 border border-zinc-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm dark:shadow-xl lg:col-span-2 transition-colors">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Exportação Gráfica</h2>
              </div>
              <span className="text-xs text-zinc-500 dark:text-neutral-400 font-mono">{lotes.length} lotes emitidos</span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-500 dark:text-neutral-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs">Carregando lotes do Supabase...</span>
              </div>
            ) : lotes.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 dark:text-neutral-500 text-xs">
                Nenhum lote registrado. Gere seu primeiro lote ao lado!
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full table-fixed text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-neutral-800 text-zinc-500 dark:text-neutral-400 uppercase tracking-wider">
                      <th className="px-2 pb-3 font-semibold w-[85px] text-[11px] text-zinc-500 dark:text-zinc-400">Data / Lote</th>
                      <th className="px-2 pb-3 font-semibold w-[110px] text-xs">Destinatário</th>
                      <th className="px-2 pb-3 font-semibold w-[48px] text-center text-xs">Qtd</th>
                      <th className="px-2 pb-3 font-semibold w-[130px] text-[11px] font-mono text-zinc-600 dark:text-zinc-300">Intervalo</th>
                      <th className="px-2 pb-3 font-semibold w-[125px] text-center">Status</th>
                      <th className="px-2 pb-3 font-semibold w-[135px] text-center">Rastreio</th>
                      <th className="px-2 pb-3 font-semibold w-[75px] text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/80 dark:divide-neutral-800/60">
                    {lotes.map((lote) => (
                      <tr key={lote.id} className="hover:bg-zinc-100/60 dark:hover:bg-neutral-950/40 transition">
                        <td className="px-2 py-2.5 w-[85px] text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                          <div className="font-medium text-zinc-800 dark:text-neutral-200 truncate">{lote.data.split(" ")[0]}</div>
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{lote.data.split(" ")[1] || ""}</div>
                        </td>
                        <td className="px-2 py-2.5 w-[110px] text-xs text-zinc-800 dark:text-neutral-300 font-medium" title={lote.alunoNome}>
                          <span className="truncate block" title={lote.alunoNome}>
                            {lote.alunoNome}
                          </span>
                          {lote.observacao && (
                            <span className="inline-block text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded mt-0.5 truncate max-w-full" title={lote.observacao}>
                              {lote.observacao}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 w-[48px] text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {lote.quantidade}
                        </td>
                        <td className="px-2 py-2.5 w-[130px] text-[11px] font-mono text-zinc-700 dark:text-zinc-300 truncate">
                          {lote.temLoteGerado ? (
                            <span
                              className="bg-zinc-100 dark:bg-neutral-950 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-neutral-800 text-zinc-800 dark:text-neutral-200 truncate inline-block max-w-full"
                              title={`${lote.codigoInicio} → ${lote.codigoFim}`}
                            >
                              {lote.codigoInicio} → {lote.codigoFim}
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-neutral-500 italic text-[10px] bg-zinc-100/60 dark:bg-neutral-950/60 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-neutral-800/80">
                              Aguardando
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 w-[125px] text-center">
                          {lote.temLoteGerado ? (
                            <select
                              value={lote.status || "solicitado"}
                              onChange={(e) => handleUpdateStatusLote(lote.id, e.target.value)}
                              className={`w-full text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none transition ${
                                lote.status === "solicitado"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : lote.status === "em_producao"
                                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                  : lote.status === "enviado"
                                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                                  : lote.status === "entregue"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-zinc-100 dark:bg-neutral-800 text-zinc-700 dark:text-neutral-300 border-zinc-200 dark:border-neutral-700"
                              }`}
                            >
                              <option value="solicitado" className="bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400">
                                Solicitado
                              </option>
                              <option value="em_producao" className="bg-white dark:bg-neutral-900 text-sky-600 dark:text-sky-400">
                                Em Produção
                              </option>
                              <option value="enviado" className="bg-white dark:bg-neutral-900 text-violet-600 dark:text-violet-400">
                                Enviado
                              </option>
                              <option value="entregue" className="bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400">
                                Entregue
                              </option>
                            </select>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 w-full">
                              🟡 Solicitado
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 w-[135px] text-center">
                          <input
                            type="text"
                            placeholder="Código ou Link"
                            defaultValue={lote.codigoRastreio || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (lote.codigoRastreio || "")) {
                                handleSalvarRastreio(lote.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSalvarRastreio(lote.id, (e.target as HTMLInputElement).value);
                              }
                            }}
                            className="w-full bg-zinc-50 dark:bg-neutral-950 border border-zinc-300 dark:border-neutral-800 focus:border-violet-500 rounded-lg px-2 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-neutral-600 transition truncate"
                            title={lote.codigoRastreio || "Digite código ou link e pressione Enter"}
                          />
                        </td>
                        <td className="px-2 py-2.5 w-[75px] text-center">
                          {!lote.temLoteGerado ? (
                            <button
                              onClick={() => handleGerarLoteDePedido(lote)}
                              disabled={gerandoPedidoId === lote.id}
                              title="Gerar códigos e displays virgens para este pedido"
                              className="w-full inline-flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black px-2 py-1 rounded-lg font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow text-xs"
                            >
                              {gerandoPedidoId === lote.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <PlusCircle className="w-3 h-3 stroke-[2.5]" />
                                  <span>Gerar</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBaixarPlanilhaGrafica(lote)}
                              disabled={exportandoId === lote.id}
                              title="Baixar planilha com QR Codes físicos embutidos"
                              className="w-full inline-flex items-center justify-center gap-1 bg-zinc-100 hover:bg-emerald-500 hover:text-black dark:bg-neutral-800 dark:hover:bg-emerald-500 dark:hover:text-black text-zinc-800 dark:text-neutral-200 px-2 py-1 rounded-lg border border-zinc-300 dark:border-neutral-700 font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm text-xs"
                            >
                              {exportandoId === lote.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Download className="w-3 h-3" />
                                  <span>XLSX</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

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
      </div>
    </main>
  );
}

