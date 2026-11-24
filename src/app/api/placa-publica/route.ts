import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vbbaasuardhevgudyrxi.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_LZO7dhUojnqVHY_k14Od7w_xIpaL0xC";

export function getClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Normaliza código para buscar no banco
export function normalizarCodigo(raw: string): string[] {
  const limpo = (raw || "").trim().toUpperCase();
  const variacoes = [limpo];

  // Se veio sem hífen (ex: GP0002 -> GP-0002)
  if (/^GP\d+$/.test(limpo)) {
    variacoes.push(`GP-${limpo.slice(2)}`);
  }
  // Se veio só número (ex: 0002 ou 2 -> GP-0002)
  if (/^\d+$/.test(limpo)) {
    variacoes.push(`GP-${limpo.padStart(4, "0")}`);
  }
  // Se veio com hífen e zeros (ex: GP-2 -> GP-0002)
  const matchHifen = limpo.match(/^GP-(\d+)$/);
  if (matchHifen) {
    variacoes.push(`GP-${matchHifen[1].padStart(4, "0")}`);
  }

  return Array.from(new Set(variacoes));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("codigo") || "";
  const codigo = decodeURIComponent(rawCode).trim().toUpperCase();

  if (!codigo) {
    return NextResponse.json(
      { success: false, error: "Código da placa não fornecido" },
      { status: 400 }
    );
  }

  const supabase = getClient();
  const codigosParaBuscar = normalizarCodigo(codigo);

  try {
    let placa: any = null;

    for (const cod of codigosParaBuscar) {
      const { data, error } = await supabase
        .from("placas")
        .select("*")
        .ilike("codigo", cod)
        .maybeSingle();

      if (!error && data) {
        placa = data;
        break;
      }
    }

    if (!placa) {
      return NextResponse.json(
        { success: true, encontrada: false, placa: null },
        { status: 404 }
      );
    }

    let linkDestino = (
      placa.link_google_review ||
      placa.link_destino ||
      placa.url_destino ||
      ""
    ).trim();

    if (linkDestino && !linkDestino.startsWith("http://") && !linkDestino.startsWith("https://")) {
      linkDestino = `https://${linkDestino}`;
    }

    return NextResponse.json(
      {
        success: true,
        encontrada: true,
        placa: {
          ...placa,
          link_google_review: linkDestino,
          link_destino: linkDestino,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro na busca pública da placa:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const supabase = getClient();
    const { data: p } = await supabase
      .from("placas")
      .select("total_scans")
      .eq("id", id)
      .maybeSingle();

    if (p && typeof p.total_scans === "number") {
      await supabase
        .from("placas")
        .update({ total_scans: (p.total_scans || 0) + 1 })
        .eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (_) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      codigo,
      nome_empresa,
      link_google_review,
      whatsapp_feedback,
      valor_venda,
      aluno_id,
      status,
    } = body;

    if (!id && !codigo) {
      return NextResponse.json(
        { success: false, error: "ID ou código da placa não fornecido" },
        { status: 400 }
      );
    }

    let linkFormatado = (link_google_review || "").trim();
    if (linkFormatado && !linkFormatado.startsWith("http://") && !linkFormatado.startsWith("https://")) {
      linkFormatado = `https://${linkFormatado}`;
    }

    const supabase = getClient();
    const ADMIN_ID = "403183b5-02f6-46a7-b448-7658c5087ec4";

    // 1. Busca a placa alvo para verificar se é virgem e quem é o dono atual
    let targetPlaca: any = null;
    try {
      let qBusca = supabase
        .from("placas")
        .select("id, codigo, aluno_id, status, nome_empresa, link_google_review");
      if (id) {
        qBusca = qBusca.eq("id", id);
      } else {
        qBusca = qBusca.ilike("codigo", String(codigo).trim().toUpperCase());
      }
      const { data: dTarget } = await qBusca.maybeSingle();
      targetPlaca = dTarget;
    } catch (_) {}

    // 2. Troca automática 1-por-1:
    // Se a placa alvo for VIRGEM e estiver sendo vinculada a um aluno diferente:
    // Se o aluno já possuir placas virgens no estoque dele (ex: Bonni com 10),
    // transfere a placa física escaneada para o aluno e devolve 1 placa virgem antiga do estoque dele para o Admin ("GOPlak"),
    // mantendo o saldo total sempre exato (ex: 10 em estoque -> 1 nova física + 9 antigas).
    if (targetPlaca && aluno_id && aluno_id !== ADMIN_ID && targetPlaca.aluno_id !== aluno_id) {
      const isPlacaVirgem =
        targetPlaca.status === "virgem" ||
        (!targetPlaca.nome_empresa && !targetPlaca.link_google_review);

      if (isPlacaVirgem) {
        try {
          const { data: placasDoAluno } = await supabase
            .from("placas")
            .select("id, codigo, status, nome_empresa, link_google_review, created_at")
            .eq("aluno_id", aluno_id);

          const virgensDoAluno = (placasDoAluno || []).filter(
            (p: any) =>
              p.id !== targetPlaca.id &&
              (p.status === "virgem" || (!p.nome_empresa && !p.link_google_review)) &&
              (!p.nome_empresa || p.nome_empresa.trim() === "") &&
              (!p.link_google_review || p.link_google_review.trim() === "")
          );

          if (virgensDoAluno.length > 0) {
            // Devolve 1 placa virgem antiga do aluno para o estoque virgem do Admin
            const placaParaDevolver = virgensDoAluno[virgensDoAluno.length - 1];
            await supabase
              .from("placas")
              .update({
                aluno_id: ADMIN_ID,
                status: "virgem",
                nome_empresa: "",
                link_google_review: "",
                whatsapp_feedback: "",
                valor_venda: 80,
                activated_at: null,
              })
              .eq("id", placaParaDevolver.id);

            console.log(
              `[Auto-Troca 1-por-1] Placa ${placaParaDevolver.codigo} devolvida para Admin ao vincular ${targetPlaca.codigo} ao aluno ${aluno_id}`
            );
          }
        } catch (errSwap) {
          console.warn("Aviso ao realizar troca 1-por-1 de placa virgem:", errSwap);
        }
      }
    }

    const updatePayload: Record<string, any> = {
      status: status || "ativa",
    };
    if (status === "ativa" || (!status && linkFormatado)) {
      updatePayload.activated_at = new Date().toISOString();
    } else if (status === "virgem") {
      updatePayload.activated_at = null;
    }

    if (nome_empresa !== undefined) updatePayload.nome_empresa = (nome_empresa || "").trim();
    if (linkFormatado) updatePayload.link_google_review = linkFormatado;
    if (whatsapp_feedback !== undefined) {
      updatePayload.whatsapp_feedback = String(whatsapp_feedback).replace(/\D/g, "");
    }
    if (valor_venda !== undefined) {
      updatePayload.valor_venda = parseFloat(String(valor_venda).replace(",", ".")) || 80;
    }
    if (aluno_id) updatePayload.aluno_id = aluno_id;

    let query = supabase.from("placas").update(updatePayload);
    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.ilike("codigo", String(codigo).trim().toUpperCase());
    }

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      console.error("Erro no update server-side da placa:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      placa: {
        ...data,
        link_google_review: linkFormatado || data?.link_google_review || "",
        link_destino: linkFormatado || data?.link_google_review || "",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro no PATCH de placa:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
