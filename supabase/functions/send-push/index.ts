// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "npm:web-push@3.6.7";

// --- CONFIGURACIÓN ---
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:academic-ai-notifications@aura.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// --- UTILIDADES ---
const createPayload = (title, body, data = {}) => JSON.stringify({
  title,
  body,
  data,
  icon: "/logo.png",
  badge: "/badge.svg"
});

const sendPushToSubscriptions = async (subscriptions, payload) => {
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      const subJson = typeof sub.subscription_json === "string" 
        ? JSON.parse(sub.subscription_json) 
        : sub.subscription_json;
      await webpush.sendNotification(subJson, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id_suscripcion", sub.id_suscripcion);
      }
      console.error(`Error enviando push a ${sub.user_id}:`, err);
    }
  }));
};

// --- LÓGICA DE ALERTAS ACADÉMICAS ---
const handleAcademicAlerts = async () => {
  // CORRECCIÓN CRÍTICA: Forzar el huso horario de Chile para evitar desfase UTC del servidor Cloud
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const weekday = parts.find(p => p.type === "weekday")?.value || "Mon";
  
  const daysMap = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6 };
  const currentDay = daysMap[weekday] ?? 0;
  const currentMins = hour * 60 + minute;

  const { data: subs } = await supabase.from("push_subscriptions").select("user_id").neq("user_id", null);
  const uniqueUserIds = [...new Set((subs || []).map(s => s.user_id))];

  for (const userId of uniqueUserIds) {
    const { data: userSubs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!userSubs || userSubs.length === 0) continue;

    // A) PROCESAR HORARIOS DE CLASES
    const { data: horario } = await supabase.from("horarios")
      .select("id_horario")
      .eq("user_id", userId)
      .order("fecha_subida", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (horario) {
      const { data: bloques } = await supabase.from("bloques_clases")
        .select("*")
        .eq("id_horario", horario.id_horario)
        .eq("dia_semana", currentDay);

      for (const b of (bloques || [])) {
        const [h, m] = b.hora_inicio.split(":").map(Number);
        const startMins = h * 60 + m;
        const minsUntilStart = startMins - currentMins;
        
        if (minsUntilStart >= 14 && minsUntilStart <= 16) {
          const payload = createPayload("📚 Clase Próxima", `Tu clase de ${b.asignatura} empieza en 15 minutos.`, { type: "academic_class_start" });
          await sendPushToSubscriptions(userSubs, payload);
        }
      }
    }

    // B) PROCESAR PLANIFICACIÓN DE ESTUDIO (BLOQUES IA)
    const { data: estudioData } = await supabase.from("planificacion_estudio")
      .select("bloques_json")
      .eq("user_id", userId)
      .maybeSingle();

    const studyBlocks = Array.isArray(estudioData?.bloques_json) ? estudioData.bloques_json : [];
    for (const block of studyBlocks) {
      if (block.day !== currentDay) continue;
      const bStartMins = (block.startH || 0) * 60 + (block.startM || 0);
      const minsUntilBlock = bStartMins - currentMins;

      if (minsUntilBlock >= 14 && minsUntilBlock <= 16) {
        const blockTitle = block.taskTitle || block.title || "Estudio";
        const payload = createPayload("📖 Bloque de Estudio", `Tu sesión para "${blockTitle}" empieza en 15 minutos.`, { type: "academic_study_block" });
        await sendPushToSubscriptions(userSubs, payload);
      }
    }
  }
};

// --- SERVIDOR Y WEBHOOKS ---
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const payload = await req.json();

    // 1. Cron Job: Alertas Académicas
    if (payload?.type === "academic_alerts") {
      await handleAcademicAlerts();
      return new Response(JSON.stringify({ message: "Academic alerts processed" }), { status: 200 });
    }

    // 2. Webhook: Chat de Base de Datos
    const newMsg = payload.record;
    if (newMsg && newMsg.id_grupo) {
      const { data: miembros } = await supabase.from("chat_miembros")
        .select("user_id")
        .eq("id_grupo", newMsg.id_grupo)
        .eq("notificaciones_activas", true)
        .neq("user_id", newMsg.user_id);
      
      const userIds = miembros?.map(m => m.user_id) || [];
      if (userIds.length > 0) {
        const { data: subs } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
        if (subs) {
          await sendPushToSubscriptions(subs, createPayload(newMsg.user_name || "Nuevo mensaje", newMsg.texto, { id_grupo: newMsg.id_grupo }));
        }
      }
      return new Response(JSON.stringify({ message: "Chat notification processed" }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Unknown payload type" }), { status: 400 });
  } catch (err) {
    console.error("Critical Execution Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});