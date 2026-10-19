'use client';

import { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Check, ShieldCheck, Zap, Lock } from 'lucide-react';

const BASE_CHECKOUT_URL = 'https://pay.cakto.com.br/zinqjoq_1217460';

export default function Display3KLaunch() {
  // CONFIGURAÇÃO DO DELAY:
  // Vídeo de 8m48s (528s) - Oferta revelada aos 518s (faltando 10 segundos para o término)
  const VIDEO_DURATION_SECONDS: number = 518;

  const [showOffer, setShowOffer] = useState(() => VIDEO_DURATION_SECONDS <= 0);
  const [isPlayingWithSound, setIsPlayingWithSound] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Controle do Delay da Oferta via Timer (sincronizado com o início do áudio)
  useEffect(() => {
    if (VIDEO_DURATION_SECONDS <= 0) return;
    if (!isPlayingWithSound) return;

    const timer = setTimeout(() => {
      setShowOffer(true);
    }, VIDEO_DURATION_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [VIDEO_DURATION_SECONDS, isPlayingWithSound]);

  // Alterna exclusivamente Pausar/Reproduzir mantendo a barra de tempo bloqueada
  const togglePlayPause = () => {
    if (!iframeRef.current?.contentWindow) return;

    if (isPaused) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
      setIsPaused(false);
    } else {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
      setIsPaused(true);
    }
  };

  // Preserva e repassa parâmetros de rastreamento (UTMs, SRC, SCK) para o checkout
  const handleCheckoutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && window.location.search) {
      const separator = BASE_CHECKOUT_URL.includes('?') ? '&' : '?';
      e.currentTarget.href = `${BASE_CHECKOUT_URL}${separator}${window.location.search.replace(/^\?/, '')}`;
    }
  };

  return (
    <main className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-start px-4 py-6 antialiased selection:bg-emerald-500 selection:text-black font-sans">
      
      {/* Selo Minimalista de Abertura Oficial */}
      <div className="flex items-center gap-2 mb-4 bg-zinc-900/90 border border-zinc-800/80 px-3.5 py-1.5 rounded-full shadow-inner">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-zinc-300 tracking-wider uppercase">
          Acesso Exclusivo • Comunidade Display 3K
        </span>
      </div>

      {/* CONTAINER DO VÍDEO VERTICAL (Proporção 9:16 - Estilo Reels/Stories) */}
      <div className="w-full max-w-[360px] sm:max-w-[380px] bg-zinc-950 p-2 rounded-3xl border border-zinc-800/80 shadow-[0_0_50px_rgba(0,0,0,0.85)]">
        <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/50 flex flex-col items-center justify-center">
          
          <iframe
            ref={iframeRef}
            key={isPlayingWithSound ? 'sound-on' : 'sound-muted'}
            className="w-full h-full rounded-2xl border-0 pointer-events-none"
            src={
              isPlayingWithSound
                ? "https://www.youtube.com/embed/ryzldjAvKVo?autoplay=1&controls=0&disablekb=1&loop=1&playlist=ryzldjAvKVo&playsinline=1&rel=0&modestbranding=1&cc_load_policy=0&enablejsapi=1"
                : "https://www.youtube.com/embed/ryzldjAvKVo?autoplay=1&mute=1&controls=0&disablekb=1&loop=1&playlist=ryzldjAvKVo&playsinline=1&rel=0&modestbranding=1&cc_load_policy=0&enablejsapi=1"
            }
            title="Vídeo de Apresentação Display 3K"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />

          {/* Camada interativa: Iniciar com som ou Alternar Pausa/Reprodução */}
          {!isPlayingWithSound ? (
            <button
              type="button"
              onClick={() => {
                setIsPlayingWithSound(true);
                setIsPaused(false);
              }}
              className="absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all hover:bg-black/30 cursor-pointer p-6 group text-center"
              aria-label="Ativar som do vídeo"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500 group-hover:bg-emerald-400 border-2 border-emerald-300/80 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.7)] transform group-hover:scale-105 group-active:scale-95 transition-all mb-4">
                <Volume2 className="w-10 h-10 text-black fill-black animate-pulse" />
              </div>
              <span className="bg-emerald-500 group-hover:bg-emerald-400 text-black font-black text-sm px-5 py-2.5 rounded-full uppercase tracking-wider shadow-lg">
                Toque para Ouvir
              </span>
              <p className="text-xs text-zinc-300 mt-2.5 font-medium drop-shadow">
                O seu vídeo já começou • Clique para ativar o som
              </p>
            </button>
          ) : (
            /* Botão de sobreposição invisível: permite APENAS pausar/reproduzir */
            <button
              type="button"
              onClick={togglePlayPause}
              className="absolute inset-0 z-10 w-full h-full flex flex-col items-center justify-center bg-transparent cursor-pointer select-none"
              aria-label={isPaused ? "Continuar vídeo" : "Pausar vídeo"}
            >
              {isPaused && (
                <div className="flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-5 rounded-2xl border border-zinc-700/80 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/90 border border-emerald-300 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.6)] mb-2">
                    <Play className="w-8 h-8 text-black fill-black ml-1" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Vídeo Pausado</span>
                  <span className="text-[11px] text-zinc-300 mt-0.5">Toque para continuar</span>
                </div>
              )}
            </button>
          )}

        </div>

        {/* Indicador de Som / Status */}
        <p className="text-center text-[11px] text-zinc-400 mt-2.5 flex items-center justify-center gap-1.5 pb-1">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          {!isPlayingWithSound
            ? "Clique no vídeo para assistir com som"
            : isPaused
            ? "Vídeo pausado • Toque para continuar"
            : "Toque no vídeo para pausar / continuar"}
        </p>
      </div>

      {/* SEÇÃO REVELADA APÓS O VÍDEO TERMINAR (ENTREGÁVEIS + CTA) */}
      {showOffer && (
        <section className="w-full max-w-[420px] mt-6 flex flex-col items-center transition-all duration-700 ease-out opacity-100 translate-y-0">
          
          {/* Botão de Compra Principal */}
          <a
            href={BASE_CHECKOUT_URL}
            onClick={handleCheckoutClick}
            className="w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg py-4 px-6 rounded-2xl shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:shadow-[0_0_50px_rgba(16,185,129,0.55)] transform active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Quero Entrar na Comunidade
          </a>

          {/* Micro Prova de Segurança */}
          <div className="flex items-center justify-center gap-2.5 text-[11px] text-zinc-400 mt-2.5">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-emerald-400" /> Pagamento Seguro</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Liberação Imediata</span>
            <span>•</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> 7 Dias de Garantia</span>
          </div>

          {/* Card dos Entregáveis (O que vão receber) */}
          <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 mt-6 backdrop-blur">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider text-center mb-4">
              Tudo o que você recebe ao entrar hoje:
            </h3>

            <div className="space-y-2.5">
              {/* Item 1 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                </div>
                <h4 className="text-xs font-bold text-white">Mentoria Ao vivo Display 3K</h4>
              </div>

              {/* Item 2 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                </div>
                <h4 className="text-xs font-bold text-white">Grupo Exclusivo da Comunidade</h4>
              </div>

              {/* Item 3 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                </div>
                <h4 className="text-xs font-bold text-white">Suporte e Acompanhamento</h4>
              </div>

              {/* Item 4 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                </div>
                <h4 className="text-xs font-bold text-white">App gestão plaquinhas</h4>
              </div>

              {/* Item 5 */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                </div>
                <h4 className="text-xs font-bold text-white">Fornecedor a R$16 e R$17 reais a unidade</h4>
              </div>
            </div>

            {/* Caixa de Oferta Fundadora */}
            <div className="mt-5 pt-4 border-t border-zinc-800/80 text-center">
              <span className="text-[11px] text-zinc-500 line-through">Valor oficial: R$ 297,00</span>
              <div className="text-3xl font-black text-emerald-400 mt-0.5">
                R$ 97,00
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                Vagas exclusivas para os membros do Grupo VIP
              </p>
            </div>

            {/* Segundo Botão de CTA */}
            <a
              href={BASE_CHECKOUT_URL}
              onClick={handleCheckoutClick}
              className="mt-4 block w-full text-center bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl border border-zinc-700 transition-all uppercase tracking-wider cursor-pointer"
            >
              Garantir Minha Vaga por R$ 97
            </a>
          </div>

        </section>
      )}

      {/* Rodapé Minimalista */}
      <footer className="mt-12 text-center text-[10px] text-zinc-600">
        <p>© GOPLAK • Todos os direitos reservados.</p>
      </footer>

    </main>
  );
}
