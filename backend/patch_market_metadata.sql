-- Parche de esquema idempotente para public.market_metadata (Spec 1.5)
-- Ejecutar en el SQL Editor de Supabase antes de correr el pipeline o migrate_metadata().

ALTER TABLE public.market_metadata
    ADD COLUMN IF NOT EXISTS spy_history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_run TEXT;

-- Forzar recarga inmediata del schema cache de PostgREST (evita error PGRST204)
NOTIFY pgrst, 'reload schema';
