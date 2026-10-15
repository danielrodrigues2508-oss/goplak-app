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

    // 1. Deletar da tabela alunos
    await adminClient.from("alunos").delete().eq("id", userId);

    // 2. Deletar da tabela profiles caso exista
    try {
      await adminClient.from("profiles").delete().eq("id", userId);
    } catch (_) {}

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
