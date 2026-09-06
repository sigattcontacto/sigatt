// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ✅ USAR LA URL DEL PROYECTO, NO LA DE LA EDGE FUNCTION
const supabaseUrl = window.ENV?.VITE_SUPABASE_URL;        // ← Debe ser: https://pfjaclsxhxtipjawymqb.supabase.co
const supabaseAnonKey = window.ENV?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('❌ VITE_SUPABASE_URL no está configurada en window.ENV');
}
if (!supabaseAnonKey) {
    throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en window.ENV');
}

console.log('✅ Supabase configurado correctamente desde window.ENV');

// ✅ CREAR CLIENTE CON LA URL CORRECTA
export function getSupabaseClient() {
    return createClient(supabaseUrl, supabaseAnonKey);
}

// Exportar una instancia perezosa (lazy)
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
