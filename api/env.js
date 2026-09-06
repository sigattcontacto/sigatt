// api/env.js - Serverless Function de Vercel
export default function handler(req, res) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Variables que se exponen al frontend (solo las que empiezan con NEXT_PUBLIC_ o VITE_)
  const env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY,
    VITE_RECAPTCHA_ACTION: process.env.VITE_RECAPTCHA_ACTION || 'registro_usuario',
    VITE_VERIFY_RECAPTCHA_URL: process.env.VITE_VERIFY_RECAPTCHA_URL
  };

  // Verificar que todas las variables existen
  const missing = Object.keys(env).filter(key => !env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️ Variables faltantes: ${missing.join(', ')}`);
  }

  return res.status(200).json(env);
}
