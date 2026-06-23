-- =========================================================================
-- AcademicAI - Supabase Database Schema
-- =========================================================================
-- Paste this script directly into the SQL Editor of your Supabase project
-- to create all required tables, relations, and settings.
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. carpetas
CREATE TABLE IF NOT EXISTS public.carpetas (
    id_carpeta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT null, -- References auth.users
    nombre_carpeta TEXT NOT null,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. apuntes
CREATE TABLE IF NOT EXISTS public.apuntes (
    id_apunte UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT null, -- References auth.users
    id_carpeta UUID REFERENCES public.carpetas(id_carpeta) ON DELETE CASCADE,
    titulo_documento TEXT NOT null,
    texto_extraido TEXT,
    storage_path TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. conversaciones
CREATE TABLE IF NOT EXISTS public.conversaciones (
    id_conversacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT null, -- References auth.users
    titulo_chat TEXT NOT null,
    id_carpeta UUID REFERENCES public.carpetas(id_carpeta) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. historial_chat
CREATE TABLE IF NOT EXISTS public.historial_chat (
    id_mensaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_conversacion UUID REFERENCES public.conversaciones(id_conversacion) ON DELETE CASCADE,
    rol_emisor TEXT NOT null, -- 'USUARIO' or 'SISTEMA'
    mensaje_text TEXT NOT null,
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. tareas
CREATE TABLE IF NOT EXISTS public.tareas (
    id_tarea UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null, -- References auth.users
    titulo TEXT NOT null,
    estado TEXT NOT null, -- 'todo', 'in-progress', 'done'
    etiqueta TEXT,
    prioridad TEXT DEFAULT 'medium',
    fecha_entrega DATE,
    tiempo_estimado NUMERIC,
    tipo TEXT,
    prioridad_manual INTEGER,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. horarios
CREATE TABLE IF NOT EXISTS public.horarios (
    id_horario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null, -- References auth.users
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. bloques_clases
CREATE TABLE IF NOT EXISTS public.bloques_clases (
    id_bloque UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_horario UUID REFERENCES public.horarios(id_horario) ON DELETE CASCADE,
    dia_semana INTEGER NOT null,
    hora_inicio TEXT NOT null, -- format 'HH:MM'
    hora_fin TEXT NOT null, -- format 'HH:MM'
    asignatura TEXT NOT null,
    tipo_color TEXT
);

-- 8. excepciones_horario
CREATE TABLE IF NOT EXISTS public.excepciones_horario (
    id_excepcion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null, -- References auth.users
    id_bloque UUID REFERENCES public.bloques_clases(id_bloque) ON DELETE CASCADE,
    fecha_excepcion TEXT NOT null, -- format 'YYYY-MM-DD'
    tipo_excepcion TEXT NOT null,
    descripcion TEXT
);

-- 9. notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null, -- References auth.users
    titulo TEXT NOT null,
    mensaje TEXT NOT null,
    tipo TEXT,
    leida BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. chat_grupos
CREATE TABLE IF NOT EXISTS public.chat_grupos (
    id_grupo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT null,
    asignatura TEXT NOT null,
    codigo_invitacion TEXT UNIQUE NOT null,
    creador_id UUID NOT null, -- References auth.users
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. chat_miembros
CREATE TABLE IF NOT EXISTS public.chat_miembros (
    id_miembro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_grupo UUID REFERENCES public.chat_grupos(id_grupo) ON DELETE CASCADE,
    user_id UUID NOT null, -- References auth.users
    user_name TEXT NOT null,
    user_email TEXT NOT null,
    estado TEXT NOT null DEFAULT 'pendiente', -- 'pendiente', 'aceptado'
    notificaciones_activas BOOLEAN DEFAULT true,
    fecha_union TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_avatar TEXT,
    user_carrera TEXT,
    user_universidad TEXT,
    user_anio TEXT,
    user_bio TEXT,
    CONSTRAINT unique_group_member UNIQUE (id_grupo, user_id)
);

-- 12. chat_mensajes
CREATE TABLE IF NOT EXISTS public.chat_mensajes (
    id_mensaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_grupo UUID REFERENCES public.chat_grupos(id_grupo) ON DELETE CASCADE,
    user_id UUID, -- References auth.users (nullable, since simulated/external users might have user_id null)
    user_name TEXT NOT null,
    texto TEXT NOT null,
    fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13. group_library
CREATE TABLE IF NOT EXISTS public.group_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.chat_grupos(id_grupo) ON DELETE CASCADE,
    user_id UUID NOT null, -- References auth.users
    user_name TEXT NOT null,
    title TEXT NOT null,
    description TEXT,
    content_type TEXT,
    content_data TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 14. library_ratings
CREATE TABLE IF NOT EXISTS public.library_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.group_library(id) ON DELETE CASCADE,
    user_id UUID NOT null, -- References auth.users
    rating INTEGER NOT null,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_library_rating UNIQUE (item_id, user_id)
);

-- 15. clases_grabadas
CREATE TABLE IF NOT EXISTS public.clases_grabadas (
    id_grabacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null,
    asignatura TEXT NOT null,
    titulo TEXT NOT null,
    transcripcion TEXT NOT null,
    resumen TEXT,
    conceptos_clave TEXT[],
    preguntas_prueba JSONB,
    flashcards JSONB,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 16. pizarras_grupos
CREATE TABLE IF NOT EXISTS public.pizarras_grupos (
    id_pizarra UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_grupo UUID REFERENCES public.chat_grupos(id_grupo) ON DELETE CASCADE,
    canvas_data TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 17. planificacion_estudio
CREATE TABLE IF NOT EXISTS public.planificacion_estudio (
    user_id UUID PRIMARY KEY,
    bloques_json JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 18. calificaciones
CREATE TABLE IF NOT EXISTS public.calificaciones (
    id_calificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT null,
    asignatura TEXT NOT null,
    notas_json JSONB NOT null,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_calificaciones_user_subject UNIQUE (user_id, asignatura)
);

-- =========================================================================
-- Enable Row Level Security (RLS) on all tables for Production
-- =========================================================================
ALTER TABLE public.carpetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuntes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloques_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excepciones_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases_grabadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizarras_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planificacion_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Row Level Security (RLS) Policies
-- =========================================================================

-- 1. carpetas
DROP POLICY IF EXISTS "carpetas_owner_all" ON public.carpetas;
CREATE POLICY "carpetas_owner_all" ON public.carpetas
    FOR ALL TO authenticated USING (auth.uid() = id_usuario) WITH CHECK (auth.uid() = id_usuario);

-- 2. apuntes
DROP POLICY IF EXISTS "apuntes_owner_all" ON public.apuntes;
CREATE POLICY "apuntes_owner_all" ON public.apuntes
    FOR ALL TO authenticated USING (auth.uid() = id_usuario) WITH CHECK (auth.uid() = id_usuario);

-- 3. conversaciones
DROP POLICY IF EXISTS "conversaciones_owner_all" ON public.conversaciones;
CREATE POLICY "conversaciones_owner_all" ON public.conversaciones
    FOR ALL TO authenticated USING (auth.uid() = id_usuario) WITH CHECK (auth.uid() = id_usuario);

-- 4. historial_chat
DROP POLICY IF EXISTS "historial_chat_owner_all" ON public.historial_chat;
CREATE POLICY "historial_chat_owner_all" ON public.historial_chat
    FOR ALL TO authenticated 
    USING (id_conversacion IN (SELECT id_conversacion FROM public.conversaciones WHERE id_usuario = auth.uid()))
    WITH CHECK (id_conversacion IN (SELECT id_conversacion FROM public.conversaciones WHERE id_usuario = auth.uid()));

-- 5. tareas
DROP POLICY IF EXISTS "tareas_owner_all" ON public.tareas;
CREATE POLICY "tareas_owner_all" ON public.tareas
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. horarios
DROP POLICY IF EXISTS "horarios_owner_all" ON public.horarios;
CREATE POLICY "horarios_owner_all" ON public.horarios
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. bloques_clases
DROP POLICY IF EXISTS "bloques_clases_owner_all" ON public.bloques_clases;
CREATE POLICY "bloques_clases_owner_all" ON public.bloques_clases
    FOR ALL TO authenticated
    USING (id_horario IN (SELECT id_horario FROM public.horarios WHERE user_id = auth.uid()))
    WITH CHECK (id_horario IN (SELECT id_horario FROM public.horarios WHERE user_id = auth.uid()));

-- 8. excepciones_horario
DROP POLICY IF EXISTS "excepciones_horario_owner_all" ON public.excepciones_horario;
CREATE POLICY "excepciones_horario_owner_all" ON public.excepciones_horario
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. notificaciones
DROP POLICY IF EXISTS "notificaciones_owner_all" ON public.notificaciones;
CREATE POLICY "notificaciones_owner_all" ON public.notificaciones
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. chat_grupos
DROP POLICY IF EXISTS "chat_grupos_read_members" ON public.chat_grupos;
CREATE POLICY "chat_grupos_read_members" ON public.chat_grupos
    FOR SELECT TO authenticated
    USING (
        creador_id = auth.uid() OR 
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "chat_grupos_insert_authenticated" ON public.chat_grupos;
CREATE POLICY "chat_grupos_insert_authenticated" ON public.chat_grupos
    FOR INSERT TO authenticated WITH CHECK (creador_id = auth.uid());

DROP POLICY IF EXISTS "chat_grupos_owner_all" ON public.chat_grupos;
CREATE POLICY "chat_grupos_owner_all" ON public.chat_grupos
    FOR ALL TO authenticated USING (creador_id = auth.uid()) WITH CHECK (creador_id = auth.uid());

-- 11. chat_miembros
DROP POLICY IF EXISTS "chat_miembros_read_members" ON public.chat_miembros;
CREATE POLICY "chat_miembros_read_members" ON public.chat_miembros
    FOR SELECT TO authenticated
    USING (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid()) OR
        id_grupo IN (SELECT id_grupo FROM public.chat_grupos WHERE creador_id = auth.uid())
    );

DROP POLICY IF EXISTS "chat_miembros_insert_authenticated" ON public.chat_miembros;
CREATE POLICY "chat_miembros_insert_authenticated" ON public.chat_miembros
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "chat_miembros_owner_or_creator_all" ON public.chat_miembros;
CREATE POLICY "chat_miembros_owner_or_creator_all" ON public.chat_miembros
    FOR ALL TO authenticated 
    USING (
        user_id = auth.uid() OR 
        id_grupo IN (SELECT id_grupo FROM public.chat_grupos WHERE creador_id = auth.uid())
    )
    WITH CHECK (
        user_id = auth.uid() OR 
        id_grupo IN (SELECT id_grupo FROM public.chat_grupos WHERE creador_id = auth.uid())
    );

-- 12. chat_mensajes
DROP POLICY IF EXISTS "chat_mensajes_read_members" ON public.chat_mensajes;
CREATE POLICY "chat_mensajes_read_members" ON public.chat_mensajes
    FOR SELECT TO authenticated
    USING (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado')
    );

DROP POLICY IF EXISTS "chat_mensajes_insert_members" ON public.chat_mensajes;
CREATE POLICY "chat_mensajes_insert_members" ON public.chat_mensajes
    FOR INSERT TO authenticated
    WITH CHECK (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado') AND
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "chat_mensajes_sender_all" ON public.chat_mensajes;
CREATE POLICY "chat_mensajes_sender_all" ON public.chat_mensajes
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 13. group_library
DROP POLICY IF EXISTS "group_library_read_members" ON public.group_library;
CREATE POLICY "group_library_read_members" ON public.group_library
    FOR SELECT TO authenticated
    USING (
        group_id IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado')
    );

DROP POLICY IF EXISTS "group_library_insert_members" ON public.group_library;
CREATE POLICY "group_library_insert_members" ON public.group_library
    FOR INSERT TO authenticated
    WITH CHECK (
        group_id IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado') AND
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "group_library_owner_all" ON public.group_library;
CREATE POLICY "group_library_owner_all" ON public.group_library
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 14. library_ratings
DROP POLICY IF EXISTS "library_ratings_read_members" ON public.library_ratings;
CREATE POLICY "library_ratings_read_members" ON public.library_ratings
    FOR SELECT TO authenticated
    USING (
        item_id IN (SELECT id FROM public.group_library WHERE group_id IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado'))
    );

DROP POLICY IF EXISTS "library_ratings_owner_all" ON public.library_ratings;
CREATE POLICY "library_ratings_owner_all" ON public.library_ratings
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 15. clases_grabadas
DROP POLICY IF EXISTS "clases_grabadas_owner_all" ON public.clases_grabadas;
CREATE POLICY "clases_grabadas_owner_all" ON public.clases_grabadas
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 16. pizarras_grupos
DROP POLICY IF EXISTS "pizarras_grupos_read_members" ON public.pizarras_grupos;
CREATE POLICY "pizarras_grupos_read_members" ON public.pizarras_grupos
    FOR SELECT TO authenticated
    USING (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado')
    );

DROP POLICY IF EXISTS "pizarras_grupos_write_members" ON public.pizarras_grupos;
CREATE POLICY "pizarras_grupos_write_members" ON public.pizarras_grupos
    FOR ALL TO authenticated
    USING (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado')
    )
    WITH CHECK (
        id_grupo IN (SELECT id_grupo FROM public.chat_miembros WHERE user_id = auth.uid() AND estado = 'aceptado')
    );

-- 17. planificacion_estudio
DROP POLICY IF EXISTS "planificacion_estudio_owner_all" ON public.planificacion_estudio;
CREATE POLICY "planificacion_estudio_owner_all" ON public.planificacion_estudio
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 18. calificaciones
DROP POLICY IF EXISTS "calificaciones_owner_all" ON public.calificaciones;
CREATE POLICY "calificaciones_owner_all" ON public.calificaciones
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
