import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const params = await context.params;
  const code = params.code;
  const url = new URL(`/d/${code}`, request.url);
  return NextResponse.redirect(url, 307);
}
