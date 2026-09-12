import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { alunoNome, quantidade, codigoInicio, codigoFim } = body;

    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
    const apiKey = process.env.CALLMEBOT_API_KEY;

    let mensagem = "🔔 *GoPlacas Alerta*\nHá um novo pedido de display pendente no sistema.\n";
    if (alunoNome) mensagem += `👤 Aluno: ${alunoNome}\n`;
    if (quantidade) mensagem += `📦 Quantidade: ${quantidade} displays\n`;
    if (codigoInicio && codigoFim) mensagem += `🏷️ Intervalo: ${codigoInicio} a ${codigoFim}\n`;
    mensagem += "Acesse o painel para verificar: https://goplacas.com.br/admin";

    console.log("Notificação de pedido:", { alunoNome, quantidade, adminPhoneConfigurado: !!adminPhone });

    if (adminPhone && apiKey) {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        adminPhone
      )}&text=${encodeURIComponent(mensagem)}&apikey=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url);
      const text = await res.text();
      console.log("Resposta CallMeBot:", res.status, text);
    } else {
      console.log("CallMeBot não configurado no .env.local (ADMIN_WHATSAPP_PHONE ou CALLMEBOT_API_KEY ausentes).");
    }

    return NextResponse.json({ success: true, message: "Notificação processada com sucesso" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro na rota notify-order:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
