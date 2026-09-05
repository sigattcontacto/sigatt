import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar método
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Método no permitido' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener token de autorización
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Verificar token con Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener ID de Telegram del usuario desde Supabase
    const { data: userData, error: dbError } = await supabase
      .from('usuarios')
      .select('telegram_id, telegram_hash')
      .eq('user_id', user.id)
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = no encontrado
      throw dbError;
    }

    // Si el usuario ya tiene Telegram ID, devolverlo
    if (userData && userData.telegram_id) {
      return new Response(
        JSON.stringify({
          telegram_id: userData.telegram_id,
          telegram_hash: userData.telegram_hash,
          exists: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Si no tiene, intentar obtener el ID de Telegram a través del bot
    // (Se puede implementar un sistema de vinculación)
    
    return new Response(
      JSON.stringify({
        telegram_id: null,
        telegram_hash: null,
        exists: false,
        message: 'Usuario no vinculado con Telegram'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error en get-telegram-id:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
