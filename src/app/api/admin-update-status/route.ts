import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alunoId, email, status } = body;

    if (!alunoId && !email) {
      return NextResponse.json(
        { success: false, error: "ID ou E-mail do aluno não fornecido" },
        { status: 400 }
      );
    }

    const novoStatus = (status || "ativo") as "ativo" | "pendente" | "bloqueado";
    const whatsValor = novoStatus === "ativo" ? "aprovado" : novoStatus;
    const emailLimpo = email ? String(email).trim().toLowerCase() : "";

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://vbbaasuardhevgudyrxi.supabase.co";
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_LZO7dhUojnqVHY_k14Od7w_xIpaL0xC";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let atualizouComSucesso = false;
    let detalhesErro = "";

    // 1. Atualizar na coluna whatsapp por ID e por E-mail
    try {
      if (alunoId) {
        const { data: dWhats, error: errWhats } = await adminClient
          .from("alunos")
          .update({ whatsapp: whatsValor })
          .eq("id", alunoId)
          .select();

        if (!errWhats && dWhats && dWhats.length > 0) {
          atualizouComSucesso = true;
        } else if (errWhats) {
          detalhesErro = errWhats.message;
        }
      }

      if (emailLimpo) {
        const { data: dWhatsEmail, error: errWhatsEmail } = await adminClient
          .from("alunos")
          .update({ whatsapp: whatsValor })
          .ilike("email", emailLimpo)
          .select();

        if (!errWhatsEmail && dWhatsEmail && dWhatsEmail.length > 0) {
          atualizouComSucesso = true;
        }
      }
    } catch (eW: any) {
      detalhesErro = eW.message;
    }

    // 2. Tentar atualizar também na coluna status
    try {
      if (alunoId) {
        await adminClient
          .from("alunos")
          .update({ status: novoStatus })
          .eq("id", alunoId);
      }
      if (emailLimpo) {
        await adminClient
          .from("alunos")
          .update({ status: novoStatus })
          .ilike("email", emailLimpo);
      }
    } catch (_) {}

    // 3. Fallback REST direto com service/anon key
    try {
      if (alunoId) {
        const patchRes = await fetch(`${supabaseUrl}/rest/v1/alunos?id=eq.${alunoId}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ whatsapp: whatsValor }),
        });
        if (patchRes.ok) {
          const patched = await patchRes.json();
          if (Array.isArray(patched) && patched.length > 0) atualizouComSucesso = true;
        }
      }

      if (emailLimpo) {
        const patchResEmail = await fetch(`${supabaseUrl}/rest/v1/alunos?email=ilike.${encodeURIComponent(emailLimpo)}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ whatsapp: whatsValor }),
        });
        if (patchResEmail.ok) {
          const patchedE = await patchResEmail.json();
          if (Array.isArray(patchedE) && patchedE.length > 0) atualizouComSucesso = true;
        }
      }
    } catch (fErr: any) {
      console.warn("Aviso no fallback fetch da rota admin-update-status:", fErr);
    }

    // 4. Se serviceRoleKey estiver disponível, atualiza metadata no Supabase Auth
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && alunoId) {
      try {
        await adminClient.auth.admin.updateUserById(alunoId, {
          user_metadata: { status: novoStatus },
        });
      } catch (authErr) {
        console.warn("Aviso ao atualizar user_metadata no Auth:", authErr);
      }
    }

    return NextResponse.json({
      success: true,
      alunoId,
      status: novoStatus,
      whatsapp: whatsValor,
      atualizouBanco: atualizouComSucesso,
      detalhes: detalhesErro || undefined,
    });
  } catch (error: any) {
    console.error("Erro na rota de atualização de status do aluno:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno ao atualizar status" },
      { status: 500 }
    );
  }
}
