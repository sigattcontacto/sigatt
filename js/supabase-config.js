// js/supabase-config.js - VERSIÓN CORREGIDA
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadEnv } from './config-loader.js';

// Cargar variables de entorno de forma asíncrona
let supabaseInstance = null;

export async function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const env = await loadEnv();
  
  if (!env.VITE_SUPABASE_URL) {
    throw new Error('❌ VITE_SUPABASE_URL no está configurada en Vercel');
  }
  if (!env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('❌ VITE_SUPABASE_ANON_KEY no está configurada en Vercel');
  }

  supabaseInstance = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  console.log('✅ Supabase configurado correctamente');
  return supabaseInstance;
}
