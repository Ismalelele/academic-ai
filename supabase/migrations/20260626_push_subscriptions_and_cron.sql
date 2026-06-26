-- =============================================================================
-- MIGRACIÓN v2: Push Subscriptions + pg_cron Scheduler
-- (Re-ejecutable de forma segura: usa ALTER TABLE en vez de CREATE TABLE IF NOT EXISTS)
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ejecuta este script COMPLETO en el SQL Editor de Supabase
--    (Dashboard → SQL Editor → New Query → Paste → Run)
-- 2. Habilita pg_cron en: Dashboard → Database → Extensions → "pg_cron" → Enable
-- 3. Reemplaza SERVICE_ROLE_KEY_AQUI con tu clave real desde:
--    Dashboard → Project Settings → API → service_role (secret)
-- =============================================================================


-- ─── PARTE 1A: Crear la tabla si no existe ────────────────────────────────────
-- Si ya existía con el schema viejo (sin columna endpoint), la sección 1B
-- añade la columna faltante de forma segura.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id_suscripcion    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint          TEXT,                   -- puede ser NULL en tablas ya existentes
    subscription_json JSONB NOT NULL,
    dispositivo       TEXT,
    fecha_creacion    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ─── PARTE 1B: Añadir columna endpoint si no existe (fix para tablas previas) ─
-- Si la tabla ya existía sin la columna 'endpoint', este bloque la agrega.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'push_subscriptions'
          AND column_name  = 'endpoint'
    ) THEN
        ALTER TABLE public.push_subscriptions ADD COLUMN endpoint TEXT;
        RAISE NOTICE 'Columna endpoint añadida a push_subscriptions.';
    ELSE
        RAISE NOTICE 'Columna endpoint ya existe en push_subscriptions.';
    END IF;
END $$;

-- ─── PARTE 1C: Poblar endpoint desde subscription_json para filas existentes ──
-- Si ya había suscripciones con el schema viejo, extraemos el endpoint del JSON.
UPDATE public.push_subscriptions
SET endpoint = subscription_json->>'endpoint'
WHERE endpoint IS NULL
  AND subscription_json->>'endpoint' IS NOT NULL;

-- ─── PARTE 1D: Ahora que endpoint tiene datos, aplicar NOT NULL y UNIQUE ──────
DO $$
BEGIN
    -- Borrar filas sin endpoint (suscripciones corruptas / inrecuperables)
    DELETE FROM public.push_subscriptions WHERE endpoint IS NULL;

    -- Añadir NOT NULL si aún no está
    BEGIN
        ALTER TABLE public.push_subscriptions ALTER COLUMN endpoint SET NOT NULL;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'NOT NULL ya aplicado o no necesario: %', SQLERRM;
    END;

    -- Añadir constraint UNIQUE si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_push_endpoint'
          AND conrelid = 'public.push_subscriptions'::regclass
    ) THEN
        ALTER TABLE public.push_subscriptions
            ADD CONSTRAINT unique_push_endpoint UNIQUE (endpoint);
        RAISE NOTICE 'Constraint UNIQUE (endpoint) añadida.';
    ELSE
        RAISE NOTICE 'Constraint UNIQUE (endpoint) ya existe.';
    END IF;
END $$;

-- ─── PARTE 1E: Índice y RLS ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_owner_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_all" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_service_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_service_all" ON public.push_subscriptions
    FOR ALL TO service_role
    USING  (true)
    WITH CHECK (true);


-- ─── PARTE 2: pg_cron + pg_net → invocar Edge Function cada minuto ───────────
-- REQUISITO: pg_cron debe estar habilitado en Dashboard → Database → Extensions

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar el job si ya existía (evita duplicados al re-ejecutar)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'academic-push-alerts') THEN
        PERFORM cron.unschedule('academic-push-alerts');
        RAISE NOTICE 'Job anterior eliminado.';
    END IF;
END $$;

-- Programar la llamada a la Edge Function cada minuto
-- ⚠️ REEMPLAZA 'SERVICE_ROLE_KEY_AQUI' con tu service_role key real
SELECT cron.schedule(
    'academic-push-alerts',
    '* * * * *',
    $$
    SELECT net.http_post(
        url     := 'https://eoggsvzqyhuuucrobhpp.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer key'
        ),
        body    := '{"type": "academic_alerts"}'::jsonb
    );
    $$
);


-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────────────
-- Query 1: Columnas actuales de push_subscriptions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'push_subscriptions'
ORDER BY ordinal_position;

-- Query 2: Suscripciones guardadas
SELECT user_id, endpoint, dispositivo, fecha_creacion
FROM public.push_subscriptions
ORDER BY fecha_creacion DESC;

-- Query 3: Estado del cron job (columnas correctas de cron.job)
SELECT jobid, jobname, schedule, active, database
FROM cron.job
WHERE jobname = 'academic-push-alerts';

-- Query 4: Últimas ejecuciones del cron (columnas correctas de cron.job_run_details)
-- Nota: cron.job_run_details NO tiene columna 'jobname' — hay que hacer JOIN con cron.job
SELECT
    j.jobname,
    r.start_time,
    r.end_time,
    r.status,
    r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
WHERE j.jobname = 'academic-push-alerts'
ORDER BY r.start_time DESC
LIMIT 10;
