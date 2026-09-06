// js/supabase-config.js - VERSIÓN CORREGIDA
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

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase configurado correctamente desde window.ENV');
