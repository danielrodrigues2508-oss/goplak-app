-- ========================================================
-- BACKUP DE SCHEMA: TAGPLAK (SISTEMA DE DISPLAYS INTELIGENTES)
-- Versão Homologada: v1.0.0-homologado
-- Data: 2026-09-12
-- ========================================================

-- 1. TABELA ALUNOS / PARCEIROS
CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    meta_mensal_reais NUMERIC DEFAULT 2000.00,
    preco_padrao_display NUMERIC DEFAULT 80.00,
    telefone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Alunos
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para todos autenticados"
ON public.alunos FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir upsert/insert de perfil"
ON public.alunos FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);


-- 2. TABELA PEDIDOS_LOTES (EMISSÕES / LOTES)
CREATE TABLE IF NOT EXISTS public.pedidos_lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
    nome_destinatario TEXT,
    quantidade INTEGER NOT NULL,
    intervalo_inicio TEXT,
    intervalo_fim TEXT,
    status TEXT DEFAULT 'solicitado', -- 'solicitado', 'em_producao', 'enviado', 'entregue', 'cancelado'
    codigo_rastreio TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Pedidos / Lotes
ALTER TABLE public.pedidos_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de lotes"
ON public.pedidos_lotes FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir criacao e atualizacao de lotes"
ON public.pedidos_lotes FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);


-- 3. TABELA PLACAS (DISPLAYS INTELIGENTES)
CREATE TABLE IF NOT EXISTS public.placas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL, -- Ex: GP-0001
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE SET NULL,
    pedido_id UUID REFERENCES public.pedidos_lotes(id) ON DELETE SET NULL,
    nome_empresa TEXT,
    link_destino TEXT,
    link_google_review TEXT,
    url_destino TEXT,
    whatsapp_feedback TEXT,
    status TEXT DEFAULT 'virgem', -- 'virgem', 'ativa'
    valor_venda NUMERIC DEFAULT 80.00,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Placas
ALTER TABLE public.placas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de placas"
ON public.placas FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir gerenciamento de placas"
ON public.placas FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);


-- 4. TABELA DESPESAS_RUA (HISTÓRICO FINANCEIRO DE CAMPO)
CREATE TABLE IF NOT EXISTS public.despesas_rua (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL, -- 'transporte', 'alimentacao', 'outros'
    descricao TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Despesas de Rua
ALTER TABLE public.despesas_rua ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de despesas"
ON public.despesas_rua FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Permitir cadastro de despesas"
ON public.despesas_rua FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- ========================================================
-- FIM DO SCHEMA BACKUP
-- ========================================================
