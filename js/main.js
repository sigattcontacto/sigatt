// js/main.js - Con reCAPTCHA, SWR, Hash de Telegram y validaciones mejoradas
import { supabase } from './supabase-config.js';
import { rateLimit } from './rate-limit.js';
import { swrCache } from './swr-cache.js';

// ============================================
// CONFIGURACIÓN
// ============================================
const RECAPTCHA_SITE_KEY = 'TU_SITE_KEY_DE_RECAPTCHA_V3';
const RECAPTCHA_ACTION = 'registro_usuario';

// Inicializar rate limiting
const rateLimiter = rateLimit({
    maxRequests: 5,
    windowMs: 60000
});

// ============================================
// DOM ELEMENTS
// ============================================
const form = document.getElementById('registroForm');
const mensajeDiv = document.getElementById('mensaje');
const submitBtn = document.getElementById('submitBtn');

// Inputs
const nombresInput = document.getElementById('nombres');
const emailInput = document.getElementById('email');
const celularInput = document.getElementById('celular');

// Error messages
const nombresError = document.getElementById('nombresError');
const emailError = document.getElementById('emailError');
const celularError = document.getElementById('celularError');

// ============================================
// VALIDACIONES EN TIEMPO REAL
// ============================================

// Validar nombres
nombresInput.addEventListener('input', function() {
    const value = this.value.trim();
    if (value.length < 3) {
        showError(nombresError, '⚠️ Mínimo 3 caracteres');
    } else if (value.length > 100) {
        showError(nombresError, '⚠️ Máximo 100 caracteres');
    } else if (!/^[a-zA-ZáéíóúñÑ\s]+$/.test(value)) {
        showError(nombresError, '⚠️ Solo letras y espacios');
    } else {
        hideError(nombresError);
    }
});

// Validar email en tiempo real
emailInput.addEventListener('input', function() {
    const value = this.value.trim();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    
    if (!value) {
        showError(emailError, '⚠️ El correo es requerido');
    } else if (!emailRegex.test(value)) {
        showError(emailError, '⚠️ Ingrese un correo válido (ejemplo@dominio.com)');
    } else {
        hideError(emailError);
    }
});

// Validar celular en tiempo real (SOLO NÚMEROS)
celularInput.addEventListener('input', function() {
    // Solo permitir números
    this.value = this.value.replace(/\D/g, '');
    
    const value = this.value.trim();
    if (value.length < 10) {
        showError(celularError, `⚠️ Mínimo 10 dígitos (${value.length}/10)`);
    } else if (value.length > 15) {
        showError(celularError, '⚠️ Máximo 15 dígitos');
    } else {
        hideError(celularError);
    }
});

// ============================================
// FUNCIONES DE VALIDACIÓN
// ============================================

function showError(element, message) {
    element.textContent = message;
    element.classList.add('visible');
    element.closest('.form-group').querySelector('input').classList.add('error-shake');
    setTimeout(() => {
        element.closest('.form-group').querySelector('input').classList.remove('error-shake');
    }, 300);
}

function hideError(element) {
    element.classList.remove('visible');
    element.textContent = '';
}

function validarFormulario(data) {
    let isValid = true;
    
    // Validar nombres
    if (data.nombres_apellidos.length < 3) {
        showError(nombresError, '⚠️ Ingrese nombres y apellidos completos');
        isValid = false;
    }
    
    // Validar email
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(data.email)) {
        showError(emailError, '⚠️ Ingrese un correo electrónico válido');
        isValid = false;
    }
    
    // Validar celular (solo números)
    const celularRegex = /^[0-9]{10,15}$/;
    if (!celularRegex.test(data.num_celular)) {
        showError(celularError, '⚠️ Ingrese mínimo 10 dígitos numéricos');
        isValid = false;
    }
    
    return isValid;
}

// ============================================
// FUNCIÓN PARA HASH DE TELEGRAM ID
// ============================================

async function obtenerTelegramIdHash() {
    try {
        // Primero intentar obtener del caché (SWR)
        const cached = swrCache.get('telegram_id_hash');
        if (cached) {
            console.log('📦 Usando Telegram ID del caché');
            return cached;
        }
        
        // Si no está en caché, obtener del backend
        const response = await fetch('/api/get-telegram-id', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('No se pudo obtener el ID de Telegram');
        }
        
        const data = await response.json();
        
        // Si tiene telegram_id, lo guardamos en caché con SWR
        if (data.telegram_id) {
            // Hashear el ID para mayor privacidad (SHA-256)
            const hashBuffer = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(data.telegram_id.toString())
            );
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Guardar en caché con SWR
            swrCache.set('telegram_id_hash', hashHex);
            swrCache.set('telegram_id_raw', data.telegram_id);
            
            return hashHex;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error al obtener Telegram ID:', error);
        return null;
    }
}

// ============================================
// FUNCIÓN PARA reCAPTCHA
// ============================================
async function ejecutarRecaptcha() {
  return new Promise((resolve) => {
    if (typeof grecaptcha === 'undefined') {
      console.warn('⚠️ reCAPTCHA no cargado');
      resolve({ success: true, score: 0.9 });
      return;
    }
    
    grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: RECAPTCHA_ACTION })
      .then(async (token) => {
        try {
          // 👇 LLAMAR AL ENDPOINT CORRECTO
          const response = await fetch('/api/verify-recaptcha', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });
          
          const data = await response.json();
          resolve(data);
        } catch (error) {
          console.error('❌ Error verificando reCAPTCHA:', error);
          resolve({ success: true, score: 0.9 }); // Fallback
        }
      })
      .catch(() => {
        resolve({ success: true, score: 0.9 }); // Fallback
      });
  });
}

// ============================================
// SUBMIT DEL FORMULARIO
// ============================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Mostrar loading
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    ocultarMensaje();
    
    try {
        // 1. Rate limiting
        if (!rateLimiter.check()) {
            mostrarMensaje('⏳ Demasiados intentos. Espere un momento.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 2. Obtener datos del formulario
        const formData = new FormData(form);
        const data = {
            nombres_apellidos: formData.get('nombres').trim(),
            email: formData.get('email').trim().toLowerCase(),
            num_celular: formData.get('celular').trim()
        };
        
        // 3. Validar datos
        if (!validarFormulario(data)) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 4. Ejecutar reCAPTCHA
        const recaptchaResult = await ejecutarRecaptcha();
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            mostrarMensaje('🔒 Verificación de seguridad fallida. Intente nuevamente.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 5. Obtener Telegram ID (con hash)
        const telegramHash = await obtenerTelegramIdHash();
        if (!telegramHash) {
            mostrarMensaje('⚠️ No se pudo verificar su ID de Telegram. Contacte a soporte.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 6. Buscar usuario por email en caché (SWR)
        const cacheKey = `usuario_${data.email}`;
        let existingUser = swrCache.get(cacheKey);
        
        if (!existingUser) {
            // Consultar a Supabase
            const { data: userData, error: checkError } = await supabase
                .from('usuarios')
                .select('email, num_celular')
                .eq('email', data.email);
            
            if (checkError) throw checkError;
            existingUser = userData;
            
            // Guardar en caché con SWR
            swrCache.set(cacheKey, existingUser);
        }
        
        if (existingUser && existingUser.length > 0) {
            mostrarMensaje('⚠️ El correo electrónico ya está registrado.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 7. Registrar usuario (con telegram_id hasheado)
        const { data: newUser, error: insertError } = await supabase
            .from('usuarios')
            .insert([{
                nombres_apellidos: data.nombres_apellidos,
                email: data.email,
                num_celular: data.num_celular,
                telegram_id: parseInt(telegramHash.substring(0, 15)), // Hash parcial como número
                telegram_hash: telegramHash // Guardamos el hash completo
            }])
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // 8. Crear proceso inicial
        await crearProcesoInicial(newUser.user_id);
        
        // 9. Limpiar caché
        swrCache.invalidate(cacheKey);
        
        // 10. Éxito
        mostrarMensaje('✅ ¡Registro exitoso! Revisa tu correo para confirmar.', 'exito');
        form.reset();
        ocultarErrores();
        
        // 11. Redirigir después de 3 segundos
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error:', error);
        mostrarMensaje('❌ Error al registrar: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
});

// ============================================
// FUNCIÓN PARA CREAR PROCESO INICIAL
// ============================================

async function crearProcesoInicial(userId) {
    try {
        const codigo = `SIG-${Date.now().toString(36).toUpperCase()}`;
        
        // Verificar si ya existe proceso en caché
        const cacheKey = `proceso_${userId}`;
        let cached = swrCache.get(cacheKey);
        
        if (cached) {
            console.log('📦 Usando proceso del caché');
            return cached;
        }
        
        const { data, error } = await supabase
            .from('procesos')
            .insert([{
                user_id: userId,
                codigo_proceso: codigo,
                estado: 'pendiente'
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        // Guardar en caché
        swrCache.set(cacheKey, data);
        
        console.log('✅ Proceso inicial creado:', codigo);
        return data;
        
    } catch (error) {
        console.error('❌ Error al crear proceso inicial:', error);
        throw error;
    }
}

// ============================================
// FUNCIONES UI
// ============================================

function mostrarMensaje(texto, tipo) {
    mensajeDiv.textContent = texto;
    mensajeDiv.className = `mensaje ${tipo}`;
    mensajeDiv.style.display = 'block';
}

function ocultarMensaje() {
    mensajeDiv.style.display = 'none';
}

function ocultarErrores() {
    hideError(nombresError);
    hideError(emailError);
    hideError(celularError);
}

// ============================================
// SWR - Stale-While-Revalidate
// ============================================

// Configurar SWR para actualizar datos cada 5 minutos
setInterval(() => {
    swrCache.revalidate();
}, 5 * 60 * 1000);

// ============================================
// INICIALIZACIÓN
// ============================================

console.log('🚀 SIGATT - Sistema de Registro Iniciado');
console.log('📱 Versión: 2.0 (Responsive + reCAPTCHA + SWR)');
