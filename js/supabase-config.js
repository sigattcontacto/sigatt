// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Leer variables desde el objeto global window.ENV
const supabaseUrl = window.ENV?.VITE_SUPABASE_URL;
const supabaseAnonKey = window.ENV?.VITE_SUPABASE_ANON_KEY;

// Validación estricta
if (!supabaseUrl) {
    throw new Error('❌ VITE_SUPABASE_URL no está configurada en window.ENV');
}
if (!supabaseAnonKey) {
    throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en window.ENV');
}

// ✅ EXPORTACIÓN CORRECTA: usando "export" en lugar de "export default"
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase configurado correctamente desde window.ENV');
