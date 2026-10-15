-- ==============================================================================
-- GOPLAK - MIGRATION: SEGURANÇA NO CADASTRO DE ALUNOS
-- 1. Whitelist de E-mails Autorizados (alunos_autorizados)
-- 2. Controle de Status de Acesso na Tabela alunos
-- 3. View/Alias profiles para compatibilidade total
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

-- Garantir RLS aberto e permissivo na tabela alunos para leitura e cadastro
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de alunos" ON public.alunos;
CREATE POLICY "Permitir leitura publica de alunos"
ON public.alunos FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Permitir insercao e edicao de alunos" ON public.alunos;
CREATE POLICY "Permitir insercao e edicao de alunos"
ON public.alunos FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 3. COMPATIBILIDADE: CRIAR VIEW PROFILES APONTANDO PARA ALUNOS
CREATE OR REPLACE VIEW public.profiles AS
SELECT 
  id,
  nome,
  email,
  status,
  created_at
FROM public.alunos;

-- 4. ÍNDICES DE BUSCA RÁPIDA
CREATE INDEX IF NOT EXISTS idx_alunos_autorizados_email ON public.alunos_autorizados(email);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_email ON public.alunos(email);
