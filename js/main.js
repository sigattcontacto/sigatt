// js/main.js - Con flujo de token seguro
import { supabase } from './supabase-config.js';
import { rateLimit } from './rate-limit.js';
import { swrCache } from './swr-cache.js';
import { loadEnv } from './config-loader.js';

// ============================================
// CONFIGURACIÓN
// ============================================
let supabaseClient;
let RECAPTCHA_SITE_KEY;
let RECAPTCHA_ACTION;
let VERIFY_RECAPTCHA_URL;
let VALIDAR_TOKEN_URL;

// Token y telegram_id obtenidos del backend
let telegramId = null;
let tokenValido = false;
let datosPrecargados = {};

// Rate limiting
const rateLimiter = rateLimit({
    maxRequests: 5,
    windowMs: 60000
});

// ============================================
// DOM ELEMENTS
// ============================================
const form = document.getElementById('registroForm');
const mensajeDiv = document.getElementById('mensaje');
const statusMessage = document.getElementById('statusMessage');
const submitBtn = document.getElementById('submitBtn');
const formContainer = document.getElementById('formContainer');

const nombresInput = document.getElementById('nombres');
const emailInput = document.getElementById('email');
const celularInput = document.getElementById('celular');

const nombresError = document.getElementById('nombresError');
const emailError = document.getElementById('emailError');
const celularError = document.getElementById('celularError');

// ============================================
// FUNCIÓN PARA OBTENER EL TOKEN DE LA URL
// ============================================
function getTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

// ============================================
// FUNCIÓN PARA VALIDAR EL TOKEN
// ============================================
async function validarToken(token) {
    try {
        console.log('🔍 Validando token...');
        
        const response = await fetch(VALIDAR_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Endpoint de validación no encontrado. Verifica que la Edge Function esté desplegada.');
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Token inválido o expirado');
        }

        // Guardar el telegram_id y los datos precargados
        telegramId = data.telegram_id;
        tokenValido = true;
        datosPrecargados = {
            nombres_apellidos: data.nombres_apellidos || '',
            email: data.email || '',
            num_celular: data.num_celular || ''
        };

        // Verificar estado del usuario
        if (data.estado === 'bloqueado') {
            mostrarStatus('⛔ Tu acceso ha sido bloqueado. Contacta a soporte.', 'error');
            formContainer.style.display = 'none';
            return false;
        }

        if (data.estado === 'rechazado') {
            mostrarStatus(`⚠️ Tu solicitud fue rechazada. Motivo: ${data.motivo_rechazo || 'No especificado'}`, 'error');
            formContainer.style.display = 'none';
            return false;
        }

        console.log('✅ Token válido. Telegram ID:', telegramId);
        return true;

    } catch (error) {
        console.error('❌ Error validando token:', error);
        mostrarStatus(`⚠️ ${error.message}`, 'error');
        formContainer.style.display = 'none';
        return false;
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
                    const response = await fetch(VERIFY_RECAPTCHA_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ token }),
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const data = await response.json();
                    resolve(data);
                } catch (error) {
                    console.error('❌ Error verificando reCAPTCHA:', error);
                    resolve({ success: true, score: 0.9 });
                }
            })
            .catch(() => {
                resolve({ success: true, score: 0.9 });
            });
    });
}

// ============================================
// VALIDACIONES EN TIEMPO REAL
// ============================================
function setupRealTimeValidations() {
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

    emailInput.addEventListener('input', function() {
        const value = this.value.trim();
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
        
        if (!value) {
            showError(emailError, '⚠️ El correo es requerido');
        } else if (!emailRegex.test(value)) {
            showError(emailError, '⚠️ Ingrese un correo válido');
        } else {
            hideError(emailError);
        }
    });

    celularInput.addEventListener('input', function() {
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
}

// ============================================
// FUNCIONES UI
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

function mostrarMensaje(texto, tipo) {
    mensajeDiv.textContent = texto;
    mensajeDiv.className = `mensaje ${tipo}`;
    mensajeDiv.style.display = 'block';
}

function mostrarStatus(texto, tipo = 'info') {
    if (statusMessage) {
        statusMessage.textContent = texto;
        statusMessage.className = `mensaje ${tipo}`;
        statusMessage.style.display = 'block';
    }
}

function ocultarMensaje() {
    mensajeDiv.style.display = 'none';
}

function ocultarStatus() {
    if (statusMessage) {
        statusMessage.style.display = 'none';
    }
}

function validarFormulario(data) {
    let isValid = true;
    
    if (data.nombres_apellidos.length < 3) {
        showError(nombresError, '⚠️ Ingrese nombres y apellidos completos');
        isValid = false;
    }
    
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(data.email)) {
        showError(emailError, '⚠️ Ingrese un correo electrónico válido');
        isValid = false;
    }
    
    const celularRegex = /^[0-9]{10,15}$/;
    if (!celularRegex.test(data.num_celular)) {
        showError(celularError, '⚠️ Ingrese mínimo 10 dígitos numéricos');
        isValid = false;
    }
    
    return isValid;
}

// ============================================
// SUBMIT DEL FORMULARIO
// ============================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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
        
        // 2. Verificar que el token sea válido
        if (!tokenValido || !telegramId) {
            mostrarMensaje('⚠️ Sesión inválida. Por favor, inicia el registro desde el bot de Telegram.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 3. Obtener datos del formulario
        const formData = new FormData(form);
        const data = {
            nombres_apellidos: formData.get('nombres').trim(),
            email: formData.get('email').trim().toLowerCase(),
            num_celular: formData.get('celular').trim(),
            telegram_id: telegramId
        };
        
        // 4. Validar datos
        if (!validarFormulario(data)) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 5. Ejecutar reCAPTCHA
        const recaptchaResult = await ejecutarRecaptcha();
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            mostrarMensaje('🔒 Verificación de seguridad fallida. Intente nuevamente.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
        
        // 6. Verificar email duplicado en usuarios
        const { data: existingUser, error: checkError } = await supabaseClient
            .from('usuarios')
            .select('email')
            .eq('email', data.email);
        
        if (checkError) throw checkError;
        
        if (existingUser && existingUser.length > 0) {
            mostrarMensaje('⚠️ El correo electrónico ya está registrado.', 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }

        // 7. Verificar si el email ya está en pendientes (aprobado o pendiente)
        const { data: pendingCheck, error: pendingError } = await supabaseClient
            .from('usuarios_pendientes')
            .select('estado, telegram_id')
            .eq('email', data.email)
            .maybeSingle();

        if (pendingCheck) {
            if (pendingCheck.estado === 'pendiente') {
                mostrarMensaje('⚠️ Ya existe una solicitud pendiente con este correo.', 'error');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                return;
            }
            if (pendingCheck.estado === 'aprobado') {
                mostrarMensaje('⚠️ Este correo ya fue aprobado. Contacta a soporte.', 'error');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                return;
            }
        }
        
        // 8. Registrar usuario en tabla principal
        const { data: newUser, error: insertError } = await supabaseClient
            .from('usuarios')
            .insert([data])
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // 9. Crear proceso inicial
        await crearProcesoInicial(newUser.user_id);
        
        // 10. Actualizar estado en usuarios_pendientes a 'aprobado'
        const token = getTokenFromURL();
        if (token) {
            await supabaseClient
                .from('usuarios_pendientes')
                .update({ 
                    usado: true, 
                    usado_en: new Date().toISOString(),
                    estado: 'aprobado',
                    nombres_apellidos: data.nombres_apellidos,
                    email: data.email,
                    num_celular: data.num_celular
                })
                .eq('token_temporal', token);
            console.log('✅ Token marcado como usado y estado actualizado a aprobado');
        }
        
        // 11. Éxito
        mostrarMensaje('✅ ¡Registro exitoso! Revisa tu correo para confirmar.', 'exito');
        form.reset();
        
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
        
        const { data, error } = await supabaseClient
            .from('procesos')
            .insert([{
                user_id: userId,
                codigo_proceso: codigo,
                estado: 'pendiente'
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        console.log('✅ Proceso inicial creado:', codigo);
        return data;
        
    } catch (error) {
        console.error('❌ Error al crear proceso inicial:', error);
        throw error;
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
    try {
        // 1. Cargar variables de entorno
        const env = await loadEnv();
        RECAPTCHA_SITE_KEY = env.VITE_RECAPTCHA_SITE_KEY;
        RECAPTCHA_ACTION = env.VITE_RECAPTCHA_ACTION || 'registro_usuario';
        VERIFY_RECAPTCHA_URL = env.VITE_VERIFY_RECAPTCHA_URL;
        VALIDAR_TOKEN_URL = env.VITE_VALIDAR_TOKEN_URL;

        // Validar que la URL de validación existe
        if (!VALIDAR_TOKEN_URL) {
            console.warn('⚠️ VITE_VALIDAR_TOKEN_URL no configurada en Vercel');
            mostrarStatus('⚠️ Error de configuración. Contacte a soporte.', 'error');
            formContainer.style.display = 'none';
            return;
        }

        // 2. Inicializar Supabase
        supabaseClient = supabase;

        // 3. Obtener token de la URL
        const token = getTokenFromURL();
        
        if (token) {
            // 4. Validar el token
            mostrarStatus('🔍 Verificando tu acceso...', 'info');
            const valido = await validarToken(token);
            
            if (!valido) {
                formContainer.style.display = 'none';
                return;
            }

            // 5. Token válido → Mostrar formulario y precargar datos
            ocultarStatus();
            formContainer.style.display = 'block';
            
            // 6. Precargar datos si existen
            if (datosPrecargados.nombres_apellidos) {
                nombresInput.value = datosPrecargados.nombres_apellidos;
            }
            if (datosPrecargados.email) {
                emailInput.value = datosPrecargados.email;
            }
            if (datosPrecargados.num_celular) {
                celularInput.value = datosPrecargados.num_celular;
            }
            
            setupRealTimeValidations();
            
            console.log('🚀 SIGATT - Registro Seguro Iniciado');
            console.log('📱 Versión: 2.0 (Token Seguro + reCAPTCHA + SWR)');
            console.log('✅ Token válido. Telegram ID:', telegramId);
        } else {
            // Sin token → Mostrar mensaje informativo
            mostrarStatus('ℹ️ Para registrarte, inicia el proceso desde el bot de Telegram.', 'info');
            formContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
        mostrarStatus('⚠️ Error de configuración. Contacte a soporte.', 'error');
        formContainer.style.display = 'none';
    }
}

// ============================================
// INICIAR APLICACIÓN
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
