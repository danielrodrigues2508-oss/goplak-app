"use client";

import React, { useState, useEffect, useCallback } from "react";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
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
  AlertCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";


interface Aluno {
  id: string;
  nome: string;
  email: string;
}

interface PlacaRecord {
  id?: string;
  codigo: string;
  status: "virgem" | "ativa" | "bloqueada";
  valor_venda?: number;
  pedido_id?: string;
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
}

export default function PainelDistribuidorAdmin() {
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

  // Top Display (Líder do Mês)
  const [topLider, setTopLider] = useState<{
    nome: string;
    email?: string;
    quantidade: number;
  } | null>(null);

  // Função principal de carga de dados do Admin
  const fetchAdminData = useCallback(async () => {
    try {
      setErroMsg(null);
      console.log("Iniciando busca de dados do Admin...");

      // 1. Puxar Alunos
      let listaAlunos: Aluno[] = [];
      try {
        const { data: alunosBanco, error: errAlunos } = await supabase
          .from("alunos")
          .select("id, nome, email");

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

      if (listaAlunos.length === 0) {
        listaAlunos = [
          { id: "aluno-demo-1", nome: "Daniel Silva (Distribuidor)", email: "daniel@goplacas.com.br" },
          { id: "aluno-demo-2", nome: "Lucas Mendes", email: "lucas@goplacas.com.br" },
        ];
      }
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

        if (pedidosBanco.length > 0) {
          // Cálculo do Top Display do Mês (Líder)
          const agora = new Date();
          const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

          const pedidosMes = pedidosBanco.filter((p: any) => {
            if (p.status === "cancelado") return false;
            if (!p.created_at) return true;
            return new Date(p.created_at) >= inicioDoMes;
          });

          const totalPorAluno: Record<string, number> = {};
          pedidosMes.forEach((p: any) => {
            const aId = p.aluno_id || "00000000-0000-0000-0000-000000000001";
            const qtd = Number(p.quantidade) || 0;
            totalPorAluno[aId] = (totalPorAluno[aId] || 0) + qtd;
          });

          let maxQtd = 0;
          let topId = "";
          for (const [id, qtd] of Object.entries(totalPorAluno)) {
            if (qtd > maxQtd) {
              maxQtd = qtd;
              topId = id;
            }
          }

          if (topId && maxQtd > 0) {
            const alunoObj = listaAlunos.find((a) => a.id === topId);
            setTopLider({
              nome: alunoObj ? alunoObj.nome : "Aluno Parceiro",
              email: alunoObj ? alunoObj.email : undefined,
              quantidade: maxQtd,
            });
          } else {
            setTopLider(null);
          }

          const formatados: LoteExport[] = pedidosBanco.map((ped) => {
            const dt = new Date(ped.created_at || Date.now());
            const alunoObj = listaAlunos.find((a) => a.id === ped.aluno_id);
            const placasDoPedido = listaPlacas.filter((p) => p.pedido_id === ped.id);
            
            const temPlacas = placasDoPedido.length > 0;
            const codIni = temPlacas ? placasDoPedido[0].codigo : (ped.codigo_inicio || "");
            const codFim = temPlacas ? placasDoPedido[placasDoPedido.length - 1].codigo : (ped.codigo_fim || "");
            const temLote = Boolean(temPlacas || (ped.codigo_inicio && ped.codigo_fim));

            let st = ped.status || "solicitado";
            if (st === "pendente") st = "solicitado";

            return {
              id: ped.id,
              data: dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              alunoNome: alunoObj ? alunoObj.nome : (ped.aluno_id ? "Aluno Parceiro" : "Distribuidor"),
              alunoId: ped.aluno_id,
              quantidade: ped.quantidade || 20,
              codigoInicio: codIni || "Não gerado",
              codigoFim: codFim || "Não gerado",
              status: st,
              temLoteGerado: temLote,
              codigoRastreio: ped.codigo_rastreio || "",
            };
          });
          setLotes(formatados);
          console.log("Lotes carregados no Admin:", formatados);
        } else if (listaPlacas.length > 0) {
          const p1 = listaPlacas[0]?.codigo || "GP-0001";
          const pFim = listaPlacas[listaPlacas.length - 1]?.codigo || `GP-${String(listaPlacas.length).padStart(4, "0")}`;
          setLotes([
            {
              id: "lote-registrado",
              data: new Date().toLocaleDateString("pt-BR") + " 10:00",
              alunoNome: listaAlunos[0]?.nome || "Daniel Silva (Demo)",
              quantidade: listaPlacas.length,
              codigoInicio: p1,
              codigoFim: pFim,
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
      const alunoUuid = alunoAlvo?.id;

      let pedidoId: string | undefined = undefined;
      if (alunoUuid && alunoUuid.length > 10 && !alunoUuid.startsWith("aluno-demo")) {
        const { data: novoPed, error: errPed } = await supabase
          .from("pedidos_lotes")
          .insert([
            {
              aluno_id: alunoUuid,
              quantidade: quantidadeLote,
              valor_total: quantidadeLote * 35.0,
              status: "pago",
            },
          ])
          .select()
          .maybeSingle();

        if (!errPed && novoPed) {
          pedidoId = novoPed.id;
        }
      }

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
      const numerosInicio = lote.codigoInicio.match(/\d+/g);
      const numerosFim = lote.codigoFim.match(/\d+/g);

      const numInicio = numerosInicio ? parseInt(numerosInicio.join(""), 10) : 1;
      const numFim = numerosFim ? parseInt(numerosFim.join(""), 10) : lote.quantidade;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GoPlacas";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Produção Gráfica", {
        views: [{ showGridLines: true }],
      });

      // Definição das Colunas
      worksheet.columns = [
        { header: "Código da Placa", key: "codigo", width: 18 },
        { header: "Link Dinâmico (QR Code)", key: "link", width: 45 },
        { header: "QR Code Gráfica", key: "qrcode", width: 20 },
        { header: "Status de Fábrica", key: "status", width: 22 },
        { header: "Destinatário", key: "destinatario", width: 25 },
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

      // Itera gerando e inserindo as imagens físicas
      let currentRowIndex = 2;
      for (let i = numInicio; i <= numFim; i++) {
        const cod = `GP-${String(i).padStart(4, "0")}`;
        const linkDinamico = `https://goplacas.com.br/d/${cod}`;

        // Linha com altura adequada para a imagem (90pt)
        const row = worksheet.addRow({
          codigo: cod,
          link: linkDinamico,
          qrcode: "",
          status: "Virgem (Pronta para Ativação)",
          destinatario: lote.alunoNome,
        });

        row.height = 90;
        row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

        // Estilização das células
        const cellCod = row.getCell("codigo");
        cellCod.font = { name: "Arial", size: 12, bold: true };
        
        const cellLink = row.getCell("link");
        cellLink.font = { name: "Arial", size: 10, color: { argb: "FF0044CC" }, underline: true };

        // Gera QR Code em alta definição (Base64 PNG)
        const qrDataUrl = await QRCode.toDataURL(linkDinamico, {
          width: 300,
          margin: 1,
          errorCorrectionLevel: "H",
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        // Adiciona a imagem física ao Workbook
        const imageId = workbook.addImage({
          base64: qrDataUrl,
          extension: "png",
        });

        // Ancoragem exata dentro da célula da Coluna C (índice 2)
        worksheet.addImage(imageId, {
          tl: { col: 2.12, row: currentRowIndex - 1 + 0.06 },
          ext: { width: 108, height: 108 },
        });

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
      anchor.download = `lote_grafica_${lote.codigoInicio}_${lote.codigoFim}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (err) {
      console.error("Erro ao gerar Excel com imagens físicas:", err);
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
          setFeedbackSucesso(`Status do pedido atualizado para "${statusSanitizado.replace("_", " ")}".`);
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

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-zinc-900 dark:text-neutral-100 font-sans p-6 lg:p-10 selection:bg-emerald-500 selection:text-black transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER SUPERIOR */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> GoPlacas Admin
              </span>
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-mono font-medium">
                Supabase Live
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
                        <td className="px-2 py-2.5 w-[110px] text-xs truncate text-zinc-800 dark:text-neutral-300 font-medium" title={lote.alunoNome}>
                          <span className="truncate block" title={lote.alunoNome}>
                            {lote.alunoNome}
                          </span>
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
                              {lote.codigoInicio}→{lote.codigoFim}
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
      </div>
    </main>
  );
}

