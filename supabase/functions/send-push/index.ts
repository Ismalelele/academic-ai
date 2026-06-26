// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "npm:web-push@3.6.7";

// Configure Web Push VAPID keys
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:academic-ai-notifications@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  // Este error es crítico: sin claves VAPID, ninguna notificación push puede enviarse.
  // Confíguralas en: Supabase Dashboard → Project Settings → Edge Functions → Secrets
  console.error(
    `[send-push] VAPID keys missing! Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Supabase Secrets.`,
    `VAPID_PUBLIC_KEY present: ${!!VAPID_PUBLIC_KEY}, VAPID_PRIVATE_KEY present: ${!!VAPID_PRIVATE_KEY}`
  );
}

// Initialize Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const createNotificationPayload = (title: string, body: string, data: Record<string, unknown> = {}) => JSON.stringify({
  title,
  body,
  data,
  icon: "/logo.png",
  badge: "/badge.svg",
});

const sendPushToSubscriptions = async (subscriptions: Array<{ id_suscripcion: any; user_id: string; subscription_json: any }>, notificationPayload: string) => {
  const pushPromises = subscriptions.map(async (sub) => {
    try {
      const subJson = typeof sub.subscription_json === "string"
        ? JSON.parse(sub.subscription_json)
        : sub.subscription_json;

      await webpush.sendNotification(subJson, notificationPayload);
      console.log(`Successfully sent push to user: ${sub.user_id}`);
    } catch (err: any) {
      console.error(`Failed to send push to user: ${sub.user_id}`, err);
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`Removing expired subscription ID: ${sub.id_suscripcion} for user: ${sub.user_id}`);
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id_suscripcion", sub.id_suscripcion);
      }
    }
  });

  await Promise.all(pushPromises);
};

const handleAcademicAlerts = async (payload: any) => {
  const now = payload.now ? new Date(payload.now) : new Date();
  const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const targetUserIds = payload.user_id ? [payload.user_id] : (payload.user_ids || []);

  if (targetUserIds.length === 0) {
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .neq("user_id", null);

    if (subsErr) {
      console.error("Error fetching subscriptions for academic alerts:", subsErr);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = Array.from(new Set((subs || []).map((sub: any) => sub.user_id).filter(Boolean)));
    targetUserIds.push(...uniqueUserIds);
  }

  for (const userId of targetUserIds) {
    try {
      const { data: horarioData, error: horarioErr } = await supabase
        .from("horarios")
        .select("id_horario")
        .eq("user_id", userId)
        .order("fecha_subida", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (horarioErr) {
        console.error(`Error fetching schedule for user ${userId}:`, horarioErr);
        continue;
      }

      const reminders: Array<{ title: string; body: string; data: Record<string, unknown> }> = [];

      if (horarioData?.id_horario) {
        const { data: bloquesData } = await supabase
          .from("bloques_clases")
          .select("*")
          .eq("id_horario", horarioData.id_horario);

        (bloquesData || []).forEach((bloque: any) => {
          if (bloque.dia_semana !== currentDay) return;
          const [startH, startM] = (bloque.hora_inicio || "00:00").split(":").map(Number);
          const [endH, endM] = (bloque.hora_fin || "00:00").split(":").map(Number);
          const startMins = startH * 60 + startM;
          const endMins = endH * 60 + endM;

          // Ventana de ±1 minuto para absorber el jitter del cron scheduler.
          // Un comparador exacto (=== 15) falla si el cron se dispara con 1s de desface.
          const minsUntilStart = startMins - currentMins;
          const minsAfterEnd   = currentMins - endMins;

          if (minsUntilStart >= 14 && minsUntilStart <= 16) {
            reminders.push({
              title: "📚 Clase Próxima",
              body: `Tu clase de ${bloque.asignatura || "tu materia"} empieza en 15 minutos.`,
              data: { url: "/horario", type: "academic_class_start" },
            });
          }

          if (minsAfterEnd >= 4 && minsAfterEnd <= 6) {
            reminders.push({
              title: "✅ Fin de Clase",
              body: `Terminó tu clase de ${bloque.asignatura || "tu materia"}. Repasa tus apuntes.`,
              data: { url: "/horario", type: "academic_class_end" },
            });
          }
        });
      }

      const { data: estudioData } = await supabase
        .from("planificacion_estudio")
        .select("bloques_json")
        .eq("user_id", userId)
        .maybeSingle();

      const studyBlocks = Array.isArray(estudioData?.bloques_json) ? estudioData.bloques_json : [];
      studyBlocks.forEach((block: any) => {
        if (block.day !== currentDay) return;
        const startMins = (block.startH || 0) * 60 + (block.startM || 0);
        const minsUntilBlock = startMins - currentMins;
        if (minsUntilBlock >= 4 && minsUntilBlock <= 16) {
          reminders.push({
            title: "📚 Bloque de Estudio",
            body: `Tu bloque de estudio para '${block.taskTitle || block.title || "Estudio"}' empieza en ${minsUntilBlock} minutos.`,
            data: { url: "/horario", type: "academic_study_block" },
          });
        }
      });

      if (reminders.length === 0) continue;

      const { data: subs, error: subsErr } = await supabase
        .from("push_subscriptions")
        .select("id_suscripcion, user_id, subscription_json")
        .eq("user_id", userId);

      if (subsErr) {
        console.error(`Error fetching push subscriptions for user ${userId}:`, subsErr);
        continue;
      }

      const notifications = reminders.map((reminder) => {
        const payloadJson = createNotificationPayload(reminder.title, reminder.body, reminder.data);
        return { notificationPayload: payloadJson, userId };
      });

      for (const notification of notifications) {
        if (!subs || subs.length === 0) continue;
        await sendPushToSubscriptions(subs, notification.notificationPayload);
      }
    } catch (error) {
      console.error(`General error processing academic alerts for user ${userId}:`, error);
    }
  }

  return new Response(JSON.stringify({ message: "Academic alerts processed successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

Deno.serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload));

    if (payload?.type === "academic_alerts" || payload?.action === "academic_alerts") {
      return await handleAcademicAlerts(payload);
    }

    // Webhook from Supabase table 'chat_mensajes' on INSERT
    const newMsg = payload.record;
    if (!newMsg || !newMsg.id_grupo) {
      return new Response(JSON.stringify({ error: "Invalid payload, missing message record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch group title
    const { data: grupo, error: grupoErr } = await supabase
      .from("chat_grupos")
      .select("titulo")
      .eq("id_grupo", newMsg.id_grupo)
      .single();

    if (grupoErr) {
      console.error("Error fetching group details:", grupoErr);
    }
    const groupTitle = grupo?.titulo || "Grupo de Estudio";

    // 2. Find members of this group (excluding the message sender)
    // We want all members where status is accepted ('aceptado') and notifications are active
    const { data: miembros, error: miembrosErr } = await supabase
      .from("chat_miembros")
      .select("user_id")
      .eq("id_grupo", newMsg.id_grupo)
      .eq("estado", "aceptado")
      .eq("notificaciones_activas", true)
      .neq("user_id", newMsg.user_id);

    if (miembrosErr) {
      console.error("Error fetching group members:", miembrosErr);
      return new Response(JSON.stringify({ error: "Failed to fetch members" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userIds = miembros?.map((m: { user_id: string }) => m.user_id) || [];
    if (userIds.length === 0) {
      console.log("No members to notify (excluding the sender).");
      return new Response(JSON.stringify({ message: "No members to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Fetch push subscriptions for all target users
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id_suscripcion, user_id, subscription_json")
      .in("user_id", userIds);

    if (subsErr) {
      console.error("Error fetching push subscriptions:", subsErr);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!subs || subs.length === 0) {
      console.log("No active push subscriptions found for these members.");
      return new Response(JSON.stringify({ message: "No active subscriptions" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Sending push notifications to ${subs.length} device(s)...`);

    // 4. Construct push notification payload
    const notificationPayload = JSON.stringify({
      title: groupTitle,
      body: `${newMsg.user_name}: ${newMsg.texto}`,
      data: {
        url: `/chats`,
        id_grupo: newMsg.id_grupo,
      },
    });

    await sendPushToSubscriptions(subs, notificationPayload);

    return new Response(JSON.stringify({ message: "Notifications processed successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("General error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
