// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ✅ USAR LA URL DEL PROYECTO
const supabaseUrl = window.ENV?.VITE_SUPABASE_URL;
const supabaseAnonKey = window.ENV?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('❌ VITE_SUPABASE_URL no está configurada en window.ENV');
}
if (!supabaseAnonKey) {
    throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en window.ENV');
}

console.log('✅ Supabase configurado correctamente desde window.ENV');

// ✅ CREAR CLIENTE ÚNICO
let supabaseInstance = null;

export function getSupabase() {
    if (!supabaseInstance) {
        console.log('🔄 Creando cliente de Supabase...');
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,          // ✅ Persistir sesión en localStorage
                autoRefreshToken: true,        // ✅ Refrescar token automáticamente
                detectSessionInUrl: true,      // ✅ Detectar sesión en la URL
                storage: localStorage          // ✅ Usar localStorage para guardar la sesión
            }
        });
    }
    return supabaseInstance;
}

// ✅ Exportar el cliente de forma directa (sin Proxy)
// Esto es para compatibilidad con código que espera "supabase"
export const supabase = getSupabase();

// ⚠️ No usar Proxy que bloquee el acceso
