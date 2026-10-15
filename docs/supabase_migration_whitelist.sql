-- ==============================================================================
-- GOPLAK - MIGRATION: SEGURANÇA NO CADASTRO DE ALUNOS
-- 1. Whitelist de E-mails Autorizados (alunos_autorizados)
-- 2. Controle de Status de Acesso na Tabela alunos
-- ==============================================================================

-- 1. TABELA DE ALUNOS AUTORIZADOS (WHITELIST)
CREATE TABLE IF NOT EXISTS public.alunos_autorizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nome TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela alunos_autorizados
ALTER TABLE public.alunos_autorizados ENABLE ROW LEVEL SECURITY;

-- Política de leitura: autenticados e anônimos (necessário para checagem no formulário de cadastro)
DROP POLICY IF EXISTS "Permitir leitura de alunos autorizados" ON public.alunos_autorizados;
CREATE POLICY "Permitir leitura de alunos autorizados"
ON public.alunos_autorizados FOR SELECT
TO authenticated, anon
USING (true);

-- Política de gerenciamento: autenticados e anônimos (para inclusão e exclusão no painel admin)
DROP POLICY IF EXISTS "Permitir gerenciamento de alunos autorizados" ON public.alunos_autorizados;
CREATE POLICY "Permitir gerenciamento de alunos autorizados"
ON public.alunos_autorizados FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 2. ADICIONAR COLUNA STATUS NA TABELA ALUNOS
ALTER TABLE public.alunos 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';

-- Garantir que os administradores e alunos existentes sejam marcados como 'ativo'
UPDATE public.alunos 
SET status = 'ativo' 
WHERE status IS NULL 
   OR status = ''
   OR email IN (
       'daniel@goplacas.com.br',
       'admin@goplacas.com.br',
       'distribuidor@goplacas.com.br',
       'daniel.rodrigues2508@gmail.com'
   );

-- 3. ÍNDICES DE BUSCA RÁPIDA
CREATE INDEX IF NOT EXISTS idx_alunos_autorizados_email ON public.alunos_autorizados(email);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_email ON public.alunos(email);
