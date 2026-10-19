import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.hostname || '';
  const pathname = request.nextUrl.pathname;

  // Verifica se o host corresponde à Comunidade Display 3K
  const isDisplay3KHost =
    host.includes('comunidadedisplay3k.goplak.com.br') ||
    host.includes('comunidade-display-3k.vercel.app');

  // Se o host incluir os domínios da comunidade e o caminho for a raiz (/), faz rewrite para /display3k
  if (isDisplay3KHost && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/display3k';
    return NextResponse.rewrite(url);
  }

  // Nos demais domínios (goplak.com.br, localhost, etc.), segue o fluxo padrão
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware a todas as rotas exceto arquivos estáticos e rotas de sistema/api
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
