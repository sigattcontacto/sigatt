// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Función para obtener el cliente de Supabase (NO se ejecuta inmediatamente)
export function getSupabaseClient() {
    // Esperar a que window.ENV exista
    const supabaseUrl = window.ENV?.VITE_SUPABASE_URL;
    const supabaseAnonKey = window.ENV?.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
        throw new Error('❌ VITE_SUPABASE_URL no está configurada en window.ENV');
    }
    if (!supabaseAnonKey) {
        throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en window.ENV');
    }

    console.log('✅ Supabase configurado correctamente desde window.ENV');
    return createClient(supabaseUrl, supabaseAnonKey);
}

// Exportar una instancia perezosa (lazy) que se crea cuando se necesita
let supabaseInstance = null;

export function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = getSupabaseClient();
    }
    return supabaseInstance;
}

// Esto queda para compatibilidad, pero lanza un error si se usa antes de window.ENV
export const supabase = new Proxy({}, {
    get(target, prop) {
        throw new Error('❌ No uses "supabase" directamente. Usa getSupabase() después de que window.ENV esté listo.');
    }
});
