// js/config-loader.js - Nuevo archivo para cargar variables
let envCache = null;

export async function loadEnv() {
  // Si ya están cargadas, devolverlas
  if (envCache) {
    return envCache;
  }

  try {
    const response = await fetch('/api/env');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    envCache = data;
    console.log('✅ Variables de entorno cargadas desde /api/env');
    return data;
  } catch (error) {
    console.error('❌ Error cargando variables de entorno:', error);
    throw error;
  }
}
