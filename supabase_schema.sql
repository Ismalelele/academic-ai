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

-- =========================================================================
-- Disable Row Level Security (RLS) on all tables for ease of deployment.
-- (If you want to secure these tables later, you can enable RLS and add policies).
-- =========================================================================
ALTER TABLE public.carpetas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuntes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_chat DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloques_clases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.excepciones_horario DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_grupos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_miembros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensajes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_library DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_ratings DISABLE ROW LEVEL SECURITY;
