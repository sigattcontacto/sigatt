// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuración de Supabase
// Reemplaza con tus valores reales
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu-clave-anonima';

// Validar que las variables estén configuradas
if (!supabaseUrl || supabaseUrl === 'https://tu-proyecto.supabase.co') {
    console.warn('⚠️ VITE_SUPABASE_URL no está configurada en Vercel. Usando valor por defecto.');
}
if (!supabaseAnonKey || supabaseAnonKey === 'tu-clave-anonima') {
    console.warn('⚠️ VITE_SUPABASE_ANON_KEY no está configurada en Vercel. Usando valor por defecto.');
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase configurado correctamente');
