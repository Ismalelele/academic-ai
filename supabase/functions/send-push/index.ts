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
  const pushOptions = {
    TTL: 300,
    urgency: "high"
  };

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      const subJson = typeof sub.subscription_json === "string" 
        ? JSON.parse(sub.subscription_json) 
        : sub.subscription_json;
      await webpush.sendNotification(subJson, payload, pushOptions);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id_suscripcion", sub.id_suscripcion);
      }
      console.error(`Error enviando push a ${sub.user_id}:`, err);
    }
  }));
};

// --- LÓGICA DE ALERTAS ACADÉMICAS CON TIMEZONE DINÁMICO ---
const handleAcademicAlerts = async () => {
  // 1. Obtener todos los usuarios con suscripciones push registradas
  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .neq("user_id", null);

  if (subsError || !subs) return;
  const uniqueUserIds = [...new Set(subs.map(s => s.user_id))];

  for (const userId of uniqueUserIds) {
    // Recuperar todos los dispositivos activos del alumno
    const { data: userSubs = [] } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
    if (!userSubs || userSubs.length === 0) continue;

    // Descargar datos académicos del alumno una sola vez
    const { data: horario } = await supabase.from("horarios")
      .select("id_horario")
      .eq("user_id", userId)
      .order("fecha_subida", { ascending: false })
      .limit(1)
      .maybeSingle();

    let bloquesClases = [];
    if (horario) {
      const { data: bClases } = await supabase.from("bloques_clases").select("*").eq("id_horario", horario.id_horario);
      bloquesClases = bClases || [];
    }

    const { data: estudioData } = await supabase.from("planificacion_estudio")
      .select("bloques_json")
      .eq("user_id", userId)
      .maybeSingle();
    const studyBlocks = Array.isArray(estudioData?.bloques_json) ? estudioData.bloques_json : [];

    // Evaluar cada dispositivo de forma aislada respetando su zona horaria nativa
    for (const sub of userSubs) {
      try {
        const userTimezone = sub.timezone || "America/Santiago";
        
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: userTimezone,
          hour: "numeric",
          minute: "numeric",
          weekday: "short",
          hour12: false
        });
        
        const parts = formatter.formatToParts(new Date());
        const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
        const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
        const weekday = parts.find(p => p.type === "weekday")?.value || "Mon";
        
        const daysMap = { "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6 };
        const currentDay = daysMap[weekday] ?? 0;
        const currentMins = hour * 60 + minute;

        // A) Evaluación de Ramos/Clases
        for (const b of bloquesClases) {
          if (Number(b.dia_semana) !== currentDay) continue;
          const [h, m] = b.hora_inicio.split(":").map(Number);
          const startMins = h * 60 + m;
          
          const classDiff = startMins - currentMins;
          if (classDiff > 14 && classDiff <= 15) {
            const payload = createPayload("📚 Clase Próxima", `Tu clase de ${b.asignatura} empieza en 15 minutos.`, { type: "academic_class" });
            await sendPushToSubscriptions([sub], payload);
          }
        }

        // B) Verificación de Bloques de Estudio (IA Planificador)
        for (const block of studyBlocks) {
          if (Number(block.day) !== currentDay) continue;
          const bStartMins = Number(block.startH || 0) * 60 + Number(block.startM || 0);
          
          const studyDiff = bStartMins - currentMins;
          if (studyDiff > 14 && studyDiff <= 15) {
            const blockTitle = block.taskTitle || block.title || "Estudio Planificado";
            const payload = createPayload("📖 Bloque de Estudio", `Tu sesión para "${blockTitle}" empieza en 15 minutos.`, { type: "academic_study" });
            await sendPushToSubscriptions([sub], payload);
          }
        }
      } catch (err) {
        console.error(`Error procesando huso horario para sub de usuario ${userId}:`, err);
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

    // 1. Cron Job: Alertas Académicas periódicas
    if (payload?.type === "academic_alerts") {
      await handleAcademicAlerts();
      return new Response(JSON.stringify({ message: "Academic alerts processed" }), { status: 200 });
    }

    // 2. Webhook: Chat en tiempo real
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