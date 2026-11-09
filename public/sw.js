// Service Worker Mínimo para Suporte PWA (GOPLAK)
// Sem cache agressivo: todas as requisições passam direto pela rede para garantir
// que atualizações do banco de dados (Supabase) e telas ocorram 100% em tempo real.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Evento fetch pass-through para cumprir critérios de instalação de PWA
self.addEventListener("fetch", (event) => {
  // Rede direta sem intercepção de cache
  return;
});
