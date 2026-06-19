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
  console.warn("VAPID keys are missing from environment variables.");
}

// Initialize Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Send notifications concurrently
    const pushPromises = subs.map(async (sub: { id_suscripcion: any; user_id: string; subscription_json: any }) => {
      try {
        const subJson = typeof sub.subscription_json === "string" 
          ? JSON.parse(sub.subscription_json) 
          : sub.subscription_json;

        await webpush.sendNotification(subJson, notificationPayload);
        console.log(`Successfully sent push to user: ${sub.user_id}`);
      } catch (err: any) {
        console.error(`Failed to send push to user: ${sub.user_id}`, err);
        // Clean up expired or invalid subscriptions
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
