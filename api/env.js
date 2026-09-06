// api/env.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // ✅ TODAS las variables que necesita el frontend
  const env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY,
    VITE_RECAPTCHA_ACTION: process.env.VITE_RECAPTCHA_ACTION || 'registro_usuario',
    VITE_VERIFY_RECAPTCHA_URL: process.env.VITE_VERIFY_RECAPTCHA_URL,
    VITE_GET_TELEGRAM_ID_URL: process.env.VITE_GET_TELEGRAM_ID_URL,
    VITE_VALIDAR_TOKEN_URL: process.env.VITE_VALIDAR_TOKEN_URL  // ✅ ¡ESTA FALTA!
  };

  const missing = Object.keys(env).filter(key => !env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️ Variables faltantes: ${missing.join(', ')}`);
  }

  return res.status(200).json(env);
}
