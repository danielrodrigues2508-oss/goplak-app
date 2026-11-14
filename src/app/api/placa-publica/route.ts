import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vbbaasuardhevgudyrxi.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_LZO7dhUojnqVHY_k14Od7w_xIpaL0xC";

function getClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Normaliza código para buscar no banco
function normalizarCodigo(raw: string): string[] {
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

    const linkDestino = (
      placa.link_google_review ||
      placa.link_destino ||
      placa.url_destino ||
      ""
    ).trim();

    return NextResponse.json(
      {
        success: true,
        encontrada: true,
        placa: {
          ...placa,
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
