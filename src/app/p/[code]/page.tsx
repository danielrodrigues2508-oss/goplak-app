import { cookies } from "next/headers";
import { getClient, normalizarCodigo } from "@/app/api/placa-publica/route";
import DisplayRedirectClient from "./DisplayRedirectClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function DisplayPage({ params }: Props) {
  const resolvedParams = await params;
  const rawCode = resolvedParams.code || "";
  const codigo = decodeURIComponent(rawCode).trim().toUpperCase();

  let placa: any = null;
  let erro = false;

  try {
    const supabase = getClient();
    const codigosParaBuscar = normalizarCodigo(codigo);

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
  } catch (e) {
    console.error("Erro ao buscar placa no servidor:", e);
    erro = true;
  }

  let linkDestino = (
    placa?.link_google_review ||
    placa?.link_destino ||
    placa?.url_destino ||
    ""
  ).trim();

  if (linkDestino && !linkDestino.startsWith("http://") && !linkDestino.startsWith("https://")) {
    linkDestino = `https://${linkDestino}`;
  }

  // Verifica cookies para ver se já é proprietário ou admin
  const cookieStore = await cookies();
  const alunoIdCookie = cookieStore.get("goplak_aluno_id")?.value;
  const adminCookie = cookieStore.get("goplak_admin")?.value === "1";
  const isOwnerByCookie = Boolean(
    placa?.aluno_id && alunoIdCookie && placa.aluno_id === alunoIdCookie
  );
  const isOwnerOrAdminByCookie = adminCookie || isOwnerByCookie;

  return (
    <>
      {/* SE A PLACA POSSUIR LINK DE DESTINO:
          Injeta script no topo do HTML que executa em 0ms no navegador.
          Se o visitante não tiver sessão de proprietário ou admin no localStorage,
          redireciona IMEDIATAMENTE para o Google sem esperar React ou hidratação! */}
      {linkDestino && !isOwnerOrAdminByCookie && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var rawAluno = localStorage.getItem("goplak_aluno_logado");
                  if (rawAluno) {
                    var a = JSON.parse(rawAluno);
                    if (a && (a.id === "${placa?.aluno_id || ''}" || a.codigo === "${placa?.aluno_id || ''}")) {
                      return;
                    }
                  }
                  for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i) || "";
                    if (k.indexOf("auth-token") !== -1 || k.indexOf("sb-") === 0) {
                      var v = localStorage.getItem(k);
                      if (v && (v.indexOf("admin") !== -1 || v.indexOf("daniel") !== -1)) {
                        return;
                      }
                    }
                  }
                } catch(e) {}
                if (navigator.sendBeacon) {
                  navigator.sendBeacon("/api/placa-publica?id=${encodeURIComponent(placa?.id || '')}");
                }
                window.location.replace(${JSON.stringify(linkDestino)});
              })();
            `,
          }}
        />
      )}

      <DisplayRedirectClient
        codigo={codigo}
        initialPlaca={
          placa
            ? {
                ...placa,
                link_google_review: linkDestino,
                link_destino: linkDestino,
              }
            : null
        }
        naoEncontradaInicial={!placa && !erro}
      />
    </>
  );
}
