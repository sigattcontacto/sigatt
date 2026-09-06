import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Las variables DEBEN estar configuradas en Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación estricta: si no existen, el sistema falla de forma controlada
if (!supabaseUrl) {
    throw new Error('❌ VITE_SUPABASE_URL no está configurada en las variables de entorno.');
}
if (!supabaseAnonKey) {
    throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en las variables de entorno.');
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase configurado correctamente desde variables de entorno.');
