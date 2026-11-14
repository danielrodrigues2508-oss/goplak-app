import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const params = await context.params;
  const codigo = params.codigo;
  const url = new URL(`/p/${codigo}`, request.url);
  return NextResponse.redirect(url, 307);
}
