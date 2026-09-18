import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vbbaasuardhevgudyrxi.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_LZO7dhUojnqVHY_k14Od7w_xIpaL0xC";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pedidoId, isAprovado, quantidade, isReposicaoPropria, comprovanteUrl } = body;

    if (!pedidoId) {
      return NextResponse.json(
        { success: false, error: "ID do pedido não informado" },
        { status: 400 }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=representation",
    };

    // 1. Tratar dependências no banco: DELETE em caixa_fabrica WHERE pedido_id = [id_do_pedido]
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caixa_fabrica?pedido_id=eq.${pedidoId}`, {
        method: "DELETE",
        headers,
      });
    } catch (eCx) {
      console.warn("Aviso ao deletar caixa_fabrica:", eCx);
    }

    // 2. DELETE em placas WHERE pedido_id = [id_do_pedido] OU lote_id = [id_do_pedido]
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/placas?pedido_id=eq.${pedidoId}`, {
        method: "DELETE",
        headers,
      });
      await fetch(`${SUPABASE_URL}/rest/v1/placas?lote_id=eq.${pedidoId}`, {
        method: "DELETE",
        headers,
      });
    } catch (ePlacas) {
      console.warn("Aviso ao deletar placas vinculadas:", ePlacas);
    }

    // 3. DELETE em pedidos_lotes WHERE id = [id_do_pedido]
    let deleteStatus = 200;
    let deleteData: any = null;

    try {
      const resDelPed = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_lotes?id=eq.${pedidoId}`, {
        method: "DELETE",
        headers,
      });
      deleteStatus = resDelPed.status;
      deleteData = await resDelPed.json().catch(() => null);
    } catch (ePed) {
      console.error("Erro ao deletar de pedidos_lotes:", ePed);
    }

    // 4. Se havia estoque para ajustar em config_fabrica
    if (isAprovado && quantidade > 0) {
      try {
        const resCfg = await fetch(`${SUPABASE_URL}/rest/v1/config_fabrica?select=*&limit=1`, {
          headers,
        });
        const cfgList = await resCfg.json().catch(() => []);
        if (Array.isArray(cfgList) && cfgList.length > 0) {
          const cfg = cfgList[0];
          const estoqueAtual = Number(cfg.estoque_displays_prontos) || 0;
          const novoEstoque = isReposicaoPropria
            ? Math.max(0, estoqueAtual - quantidade)
            : estoqueAtual + quantidade;

          await fetch(`${SUPABASE_URL}/rest/v1/config_fabrica?id=eq.${cfg.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ estoque_displays_prontos: novoEstoque }),
          });
        }
      } catch (eCfg) {
        console.warn("Aviso ao atualizar estoque em config_fabrica:", eCfg);
      }
    }

    // 5. Excluir comprovante local se existir
    if (comprovanteUrl && typeof comprovanteUrl === "string" && comprovanteUrl.startsWith("/uploads/comprovantes/")) {
      try {
        const fileName = path.basename(comprovanteUrl);
        const filePath = path.join(process.cwd(), "public", "uploads", "comprovantes", fileName);
        await unlink(filePath).catch(() => {});
      } catch (eFile) {
        console.warn("Aviso ao remover arquivo local de comprovante:", eFile);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Pedido excluído com sucesso!",
      deletedId: pedidoId,
      status: deleteStatus,
      data: deleteData,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erro interno ao excluir pedido";
    console.error("Erro na API de exclusão de pedido:", error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
