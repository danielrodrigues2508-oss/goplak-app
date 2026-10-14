export type TipoKit = "start" | "pro" | "master";

export interface KitItem {
  id: TipoKit;
  nome: string;
  qtd: number;
  preco: number;
  badge: string;
  badgeCor: string;
  desc: string;
  permiteEscolhaCor: boolean;
  potencialVenda: number;
}

export interface KitsDisponiveis {
  start: boolean;
  pro: boolean;
  master: boolean;
}

export const KITS_DISPONIVEIS_PADRAO: KitsDisponiveis = {
  start: true,
  pro: false,
  master: false,
};

export const KITS_CATALOGO: Record<TipoKit, KitItem> = {
  start: {
    id: "start",
    nome: "Kit Start",
    qtd: 10,
    preco: 170.0,
    badge: "Padrão Lançamento",
    badgeCor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    desc: "10 unidades • R$ 17,00/un • Padrão de Turma: 5 Pretas e 5 Azuis",
    permiteEscolhaCor: false,
    potencialVenda: 800.0,
  },
  pro: {
    id: "pro",
    nome: "Kit Pro",
    qtd: 30,
    preco: 510.0,
    badge: "🔥 Mais Vendido",
    badgeCor: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-xs",
    desc: "30 unidades • R$ 17,00/un • Permite escolha de cores",
    permiteEscolhaCor: true,
    potencialVenda: 2400.0,
  },
  master: {
    id: "master",
    nome: "Kit Master",
    qtd: 50,
    preco: 800.0,
    badge: "🚀 Escala",
    badgeCor: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
    desc: "50 unidades • R$ 16,00/un • Máximo faturamento e menor custo por unidade",
    permiteEscolhaCor: true,
    potencialVenda: 4000.0,
  },
};

export function encodeKitsToCode(kits: KitsDisponiveis): number {
  let mask = 0;
  if (kits.start) mask |= 1;
  if (kits.pro) mask |= 2;
  if (kits.master) mask |= 4;
  return 100 + mask;
}

export function decodeKitsFromCode(code: number | null | undefined): KitsDisponiveis {
  if (typeof code === "number" && code >= 100 && code <= 107) {
    const mask = code - 100;
    return {
      start: (mask & 1) !== 0,
      pro: (mask & 2) !== 0,
      master: (mask & 4) !== 0,
    };
  }
  return { ...KITS_DISPONIVEIS_PADRAO };
}
