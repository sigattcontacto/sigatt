// js/admin/auth.js
import { getSupabase } from '../supabase-config.js';

// ============================================
// DOM ELEMENTS
// ============================================
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');

// ============================================
// FUNCIÓN: VERIFICAR SESIÓN
// ============================================
export async function verificarSesion() {
    try {
        const supabase = getSupabase(); // ✅ Obtener cliente correctamente
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            console.log('ℹ️ No hay sesión activa');
            return null;
        }

        // Verificar que el usuario sea admin
  console.log('🔍 Consultando usuario con ID:', session.user.id);
console.log('🔍 Tipo de ID:', typeof session.user.id);

const { data: user, error: userError } = await supabase
    .from('usuarios')
    .select('rol, nombres_apellidos')
    .eq('email', session.user.email)  // ✅ Usar email en lugar de user_id
    .maybeSingle();

console.log('🔍 Resultado de la consulta:', user);
console.log('🔍 Error de la consulta:', userError);

        if (userError || !user) {
            console.error('❌ Error verificando rol:', userError);
            await supabase.auth.signOut();
            return null;
        }

        if (user.rol !== 'admin') {
            console.warn('⛔ Usuario no es admin');
            await supabase.auth.signOut();
            return null;
        }

        console.log('✅ Sesión activa y usuario admin:', session.user.email);
        return session;
    } catch (error) {
        console.error('❌ Error en verificarSesion:', error);
        return null;
    }
}

// ============================================
// FUNCIÓN: INICIAR SESIÓN
// ============================================
export async function iniciarSesion(email, password, rememberMe) {
    try {
        const supabase = getSupabase();

        if (!email || !email.includes('@')) {
            return { success: false, error: 'Correo electrónico inválido' };
        }

        if (!password || password.length < 6) {
            return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
        }

        // Iniciar sesión
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password,
            options: { persistSession: rememberMe }
        });

        if (error) {
            console.error('❌ Error de login:', error);
            return { success: false, error: error.message };
        }

        // Verificar rol
        const { data: user, error: userError } = await supabase
            .from('usuarios')
            .select('rol, nombres_apellidos')
            .eq('user_id', data.user.id)
            .maybeSingle();

        if (userError || !user) {
            await supabase.auth.signOut();
            return { success: false, error: 'Usuario no encontrado en el sistema' };
        }

        if (user.rol !== 'admin') {
            await supabase.auth.signOut();
            return { success: false, error: 'Acceso denegado: no tienes permisos de administrador' };
        }

        console.log('✅ Login exitoso:', data.user.email);
        return { 
            success: true, 
            user: { ...data.user, nombres_apellidos: user.nombres_apellidos }
        };

    } catch (error) {
        console.error('❌ Error en iniciarSesion:', error);
        return { success: false, error: 'Error inesperado al iniciar sesión' };
    }
}

// ============================================
// FUNCIÓN: CERRAR SESIÓN
// ============================================
export async function cerrarSesion() {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log('✅ Sesión cerrada correctamente');
        return { success: true };
    } catch (error) {
        console.error('❌ Error cerrando sesión:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// FUNCIÓN: PROTEGER RUTA
// ============================================
export async function protegerRuta() {
    const session = await verificarSesion();
    if (!session) {
        window.location.href = '/admin/login.html';
        return null;
    }
    return session;
}

// ============================================
// EVENT: LOGIN FORM
// ============================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        loginError.style.display = 'none';
        loginError.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Ingresando...';

        try {
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;

            const result = await iniciarSesion(email, password, rememberMe);

            if (result.success) {
                window.location.href = '/admin/index.html';
            } else {
                loginError.textContent = '❌ ' + result.error;
                loginError.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Ingresar <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
            }
        } catch (error) {
            console.error('❌ Error:', error);
            loginError.textContent = '❌ Error inesperado. Intenta nuevamente.';
            loginError.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Ingresar <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
        }
    });
}
