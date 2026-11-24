import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "ID do usuário não fornecido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminMatrizId = "403183b5-02f6-46a7-b448-7658c5087ec4";

    // 1. Antes de excluir, transferir todas as placas do aluno para o estoque da matriz GOPlak (impedir perda de placas)
    if (userId) {
      try {
        await adminClient.from("placas").update({ aluno_id: adminMatrizId }).eq("aluno_id", userId);
      } catch (errPlacas) {
        console.warn("Aviso ao transferir placas via userId na API:", errPlacas);
      }
    }
    if (email) {
      try {
        const { data: alunoDb } = await adminClient
          .from("alunos")
          .select("id")
          .ilike("email", String(email).trim().toLowerCase())
          .maybeSingle();
        if (alunoDb?.id) {
          await adminClient.from("placas").update({ aluno_id: adminMatrizId }).eq("aluno_id", alunoDb.id);
        }
      } catch (errPlacasEmail) {
        console.warn("Aviso ao transferir placas via email na API:", errPlacasEmail);
      }
    }

    // 2. Deletar da tabela public.alunos EXCLUSIVAMENTE pelo email
    if (email) {
      await adminClient.from("alunos").delete().ilike("email", String(email).trim().toLowerCase());
    } else if (userId) {
      await adminClient.from("alunos").delete().eq("id", userId);
    }

    // 3. Tentar deletar do Supabase Auth se chave de serviço estiver configurada
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch (authErr: any) {
        console.warn("Aviso ao deletar usuário do Auth:", authErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Aluno ${email || userId} excluído com sucesso.`,
    });
  } catch (error: any) {
    console.error("Erro na rota de exclusão de aluno:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao excluir aluno" },
      { status: 500 }
    );
  }
}
