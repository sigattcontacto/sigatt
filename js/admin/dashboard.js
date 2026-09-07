// js/admin/dashboard.js
import { supabase } from '../supabase-config.js';
import { protegerRuta, cerrarSesion } from './auth.js';

// ============================================
// CONFIGURACIÓN
// ============================================
const PAGE_SIZE = 10;
let currentPage = 1;
let solicitudes = [];
let filteredSolicitudes = [];

// ============================================
// DOM ELEMENTS
// ============================================
const tableBody = document.getElementById('solicitudesTableBody');
const searchInput = document.getElementById('searchInput');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationInfo = document.getElementById('paginationInfo');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const refreshBtn = document.getElementById('refreshBtn');
const pendingCount = document.getElementById('pendingCount');
const approvedCount = document.getElementById('approvedCount');
const rejectedCount = document.getElementById('rejectedCount');
const totalUsers = document.getElementById('totalUsers');

// Modal
const modal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

let modalAction = null;
let modalData = null;

// ============================================
// FUNCIÓN: CARGAR DATOS DEL DASHBOARD
// ============================================
async function cargarDashboard() {
    try {
        // 1. Cargar estadísticas
        await cargarEstadisticas();

        // 2. Cargar solicitudes pendientes
        await cargarSolicitudes();

        // 3. Actualizar tabla
        renderTabla();

        console.log('✅ Dashboard actualizado');
    } catch (error) {
        console.error('❌ Error cargando dashboard:', error);
    }
}

// ============================================
// FUNCIÓN: CARGAR ESTADÍSTICAS
// ============================================
async function cargarEstadisticas() {
    try {
        // Solicitudes pendientes
        const { count: pending } = await supabase
            .from('usuarios_pendientes')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'pendiente');

        // Solicitudes aprobadas
        const { count: approved } = await supabase
            .from('usuarios_pendientes')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'aprobado');

        // Solicitudes rechazadas
        const { count: rejected } = await supabase
            .from('usuarios_pendientes')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'rechazado');

        // Total usuarios
        const { count: users } = await supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true });

        pendingCount.textContent = pending || 0;
        approvedCount.textContent = approved || 0;
        rejectedCount.textContent = rejected || 0;
        totalUsers.textContent = users || 0;

    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}

// ============================================
// FUNCIÓN: CARGAR SOLICITUDES
// ============================================
async function cargarSolicitudes() {
    try {
        const { data, error } = await supabase
            .from('usuarios_pendientes')
            .select('*')
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: false });

        if (error) throw error;

        solicitudes = data || [];
        filteredSolicitudes = [...solicitudes];
        currentPage = 1;

        console.log(`📋 ${filteredSolicitudes.length} solicitudes pendientes`);

    } catch (error) {
        console.error('❌ Error cargando solicitudes:', error);
        solicitudes = [];
        filteredSolicitudes = [];
    }
}

// ============================================
// FUNCIÓN: RENDERIZAR TABLA
// ============================================
function renderTabla() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    
    // Filtrar
    if (searchTerm) {
        filteredSolicitudes = solicitudes.filter(s => 
            s.nombres_apellidos?.toLowerCase().includes(searchTerm) ||
            s.email?.toLowerCase().includes(searchTerm) ||
            s.num_celular?.includes(searchTerm)
        );
    } else {
        filteredSolicitudes = [...solicitudes];
    }

    // Paginación
    const total = filteredSolicitudes.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageData = filteredSolicitudes.slice(start, end);

    // Actualizar info de paginación
    paginationInfo.textContent = `Mostrando ${total > 0 ? start + 1 : 0} - ${end} de ${total}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    // Renderizar filas
    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: var(--spacing-xl); color: var(--sigatt-text-secondary);">
                    ${searchTerm ? 'No se encontraron solicitudes con ese filtro' : 'No hay solicitudes pendientes'}
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = pageData.map(s => `
        <tr>
            <td><strong>${s.nombres_apellidos || 'Sin nombre'}</strong></td>
            <td>${s.email || 'Sin email'}</td>
            <td>${s.num_celular || 'Sin teléfono'}</td>
            <td>${s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-action btn-success" onclick="aprobarSolicitud('${s.id}', '${s.nombres_apellidos}')">
                        ✅ Aprobar
                    </button>
                    <button class="btn-action btn-danger" onclick="rechazarSolicitud('${s.id}', '${s.nombres_apellidos}')">
                        ❌ Rechazar
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// FUNCIÓN: APROBAR SOLICITUD
// ============================================
window.aprobarSolicitud = function(id, nombre) {
    modalTitle.textContent = '✅ Aprobar solicitud';
    modalMessage.textContent = `¿Estás seguro de aprobar la solicitud de "${nombre}"? Se creará el usuario y se enviará la notificación.`;
    modalConfirmBtn.className = 'btn btn-success';
    modalConfirmBtn.textContent = 'Aprobar';
    modalAction = 'aprobar';
    modalData = { id, nombre };
    modal.style.display = 'flex';
};

// ============================================
// FUNCIÓN: RECHAZAR SOLICITUD
// ============================================
window.rechazarSolicitud = function(id, nombre) {
    modalTitle.textContent = '❌ Rechazar solicitud';
    modalMessage.textContent = `¿Estás seguro de rechazar la solicitud de "${nombre}"? Se enviará la notificación y se eliminará.`;
    modalConfirmBtn.className = 'btn btn-danger';
    modalConfirmBtn.textContent = 'Rechazar';
    modalAction = 'rechazar';
    modalData = { id, nombre };
    modal.style.display = 'flex';
};

// ============================================
// FUNCIÓN: EJECUTAR ACCIÓN DEL MODAL
// ============================================
// dashboard.js - Sección de ejecutarAccion
async function ejecutarAccion() {
    if (!modalAction || !modalData) return;

    const { id, nombre } = modalData;
    // ✅ URL CORRECTA
    const url = `${window.ENV?.VITE_SUPABASE_URL}/functions/v1/aprobar-usuario`;

    try {
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = 'Procesando...';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pending_id: id,
                accion: modalAction,
                motivo: modalAction === 'rechazar' ? 'Rechazado por el administrador' : null
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Error al procesar la solicitud');
        }

        // Recargar dashboard
        await cargarDashboard();

        // Cerrar modal
        cerrarModal();

        // Mostrar notificación
        const mensaje = modalAction === 'aprobar' 
            ? `✅ Solicitud de "${nombre}" aprobada exitosamente`
            : `❌ Solicitud de "${nombre}" rechazada`;
        alert(mensaje);

    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ Error al procesar: ' + error.message);
        cerrarModal();
    }
}

// ============================================
// FUNCIÓN: CERRAR MODAL
// ============================================
function cerrarModal() {
    modal.style.display = 'none';
    modalAction = null;
    modalData = null;
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.textContent = 'Confirmar';
}

// ============================================
// EVENTOS DEL MODAL
// ============================================
modalConfirmBtn.addEventListener('click', ejecutarAccion);
modalCancelBtn.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
});

// ============================================
// EVENTO: BÚSQUEDA
// ============================================
if (searchInput) {
    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTabla();
    });
}

// ============================================
// EVENTO: PAGINACIÓN
// ============================================
prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTabla();
    }
});

nextPageBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredSolicitudes.length / PAGE_SIZE);
    if (currentPage < totalPages) {
        currentPage++;
        renderTabla();
    }
});

// ============================================
// EVENTO: REFRESCAR
// ============================================
refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Cargando...';
    await cargarDashboard();
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = 'Actualizar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: var(--spacing-xs);"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
});

// ============================================
// EVENTO: CERRAR SESIÓN
// ============================================
logoutBtn?.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        const result = await cerrarSesion();
        if (result.success) {
            window.location.href = '/admin/login.html';
        } else {
            alert('❌ Error al cerrar sesión: ' + result.error);
        }
    }
});

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
    // 1. Proteger la ruta (redirigir a login si no está autenticado)
    const session = await protegerRuta();
    
    if (session) {
        // Mostrar nombre del usuario
        const { data: user } = await supabase
            .from('usuarios')
            .select('nombres_apellidos')
            .eq('user_id', session.user.id)
            .single();

        if (user) {
            userName.textContent = user.nombres_apellidos || 'Admin';
        }

        // 2. Cargar dashboard
        await cargarDashboard();

        // 3. Auto-refrescar cada 60 segundos
        setInterval(cargarDashboard, 60000);
    }
}

// Iniciar
init();
