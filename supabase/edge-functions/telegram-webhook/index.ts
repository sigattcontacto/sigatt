// supabase/edge-functions/telegram-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CONFIGURACIÓN
// ============================================
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;
const WEBAPP_URL = Deno.env.get('WEBAPP_URL') || 'https://sigatt.vercel.app';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// SERVER
// ============================================
serve(async (req) => {
  try {
    // Verificar método
    if (req.method !== 'POST') {
      return new Response('Método no permitido', { status: 405 });
    }

    // Obtener payload
    const body = await req.json();
    console.log('📨 Webhook recibido:', JSON.stringify(body, null, 2));

    // Procesar mensaje
    if (body.message) {
      await handleMessage(body.message);
    } else if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// MANEJAR MENSAJES
// ============================================
async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const username = message.from?.username || 'Usuario';
  
  // Buscar usuario en Supabase
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('telegram_id', chatId)
    .single();

  // Si no está registrado
  if (!usuario) {
    // Guardar chat_id temporal
    await savePendingUser(chatId, username);
    
    await sendMessage(
      chatId,
      `👋 ¡Hola ${username}! Bienvenido a SIGATT.\n\n` +
      `Para continuar, por favor regístrate en nuestro sistema:\n` +
      `${WEBAPP_URL}/registro\n\n` +
      `🔑 Tu ID de Telegram es: \`${chatId}\`\n` +
      `(Este ID se vinculará automáticamente con tu registro)`
    );
    return;
  }

  // Usuario registrado - procesar comandos
  await processCommand(chatId, text, usuario);
}

// ============================================
// PROCESAR COMANDOS
// ============================================
async function processCommand(chatId: number, text: string, usuario: any) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      await sendMessage(
        chatId,
        `👋 ¡Hola ${usuario.nombres_apellidos}!\n` +
        `Bienvenido de vuelta a SIGATT.\n\n` +
        `Comandos disponibles:\n` +
        `/mis_procesos - Ver tus procesos\n` +
        `/estado - Ver estado de tu registro\n` +
        `/ayuda - Ayuda y soporte`
      );
      break;

    case '/mis_procesos':
      await getMisProcesos(chatId, usuario.user_id);
      break;

    case '/estado':
      await getEstado(chatId, usuario);
      break;

    case '/ayuda':
      await sendMessage(
        chatId,
        `📚 Ayuda SIGATT\n\n` +
        `• Para ver tus procesos: /mis_procesos\n` +
        `• Para ver tu estado: /estado\n` +
        `• Contacta a soporte: soporte@sigatt.com\n\n` +
        `📱 También puedes acceder a tu panel en:\n` +
        `${WEBAPP_URL}/dashboard`
      );
      break;

    default:
      await sendMessage(
        chatId,
        `❓ Comando no reconocido.\n` +
        `Escribe /ayuda para ver los comandos disponibles.`
      );
  }
}

// ============================================
// FUNCIONES DE CONSULTA
// ============================================
async function getMisProcesos(chatId: number, userId: string) {
  const { data: procesos, error } = await supabase
    .from('procesos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !procesos || procesos.length === 0) {
    await sendMessage(
      chatId,
      `📋 No tienes procesos activos.\n` +
      `Para iniciar un proceso, contacta a nuestro equipo.`
    );
    return;
  }

  let mensaje = '📋 <b>Tus Procesos</b>\n\n';
  
  procesos.forEach((p, index) => {
    const emoji = p.estado === 'completado' ? '✅' : 
                  p.estado === 'en_progreso' ? '🔄' : '⏳';
    
    mensaje += `${index + 1}. ${emoji} <b>${p.codigo_proceso}</b>\n`;
    mensaje += `   Estado: ${p.estado}\n`;
    mensaje += `   Prioridad: ${p.prioridad}\n`;
    if (p.descripcion) {
      mensaje += `   📝 ${p.descripcion}\n`;
    }
    mensaje += `   📅 ${new Date(p.created_at).toLocaleDateString()}\n\n`;
  });

  await sendMessage(chatId, mensaje);
}

async function getEstado(chatId: number, usuario: any) {
  const { data: procesos } = await supabase
    .from('procesos')
    .select('count')
    .eq('user_id', usuario.user_id)
    .single();

  await sendMessage(
    chatId,
    `📊 <b>Estado de tu cuenta</b>\n\n` +
    `👤 Usuario: ${usuario.nombres_apellidos}\n` +
    `📧 Email: ${usuario.email}\n` +
    `📱 Estado: ${usuario.status || 'Activo'}\n` +
    `📋 Procesos: ${procesos?.count || 0}\n` +
    `📅 Registrado: ${new Date(usuario.created_at).toLocaleDateString()}`
  );
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
async function savePendingUser(chatId: number, username: string) {
  try {
    // Guardar en tabla de usuarios pendientes
    const { error } = await supabase
      .from('usuarios_pendientes')
      .upsert({
        telegram_id: chatId,
        username: username,
        intentos: 0,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error guardando usuario pendiente:', error);
    }
  } catch (error) {
    console.error('Error en savePendingUser:', error);
  }
}

async function sendMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error enviando mensaje:', error);
    }
  } catch (error) {
    console.error('Error en sendMessage:', error);
  }
}

// ============================================
// MANEJAR CALLBACK QUERY (botones)
// ============================================
async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  // Procesar callbacks según necesidad
  console.log('Callback:', data);
  
  // Responder al callback
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQuery.id,
      text: '✅ Procesando...'
    })
  });
}
