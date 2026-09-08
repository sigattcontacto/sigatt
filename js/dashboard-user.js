// js/dashboard-user.js
import { getSupabase } from './supabase-config.js';
import { loadEnv } from './config-loader.js';

// ============================================
// CONFIGURACIÓN
// ============================================
const PAGE_SIZE = 10;
let currentPage = 1;
let procesos = [];
let filteredProcesos = [];
let supabase = null;
let userId = null;
let VALIDAR_TOKEN_URL = null;
let allDocuments = [];

// ============================================
// DOM ELEMENTS
// ============================================
const statusMessage = document.getElementById('statusMessage');
const dashboardContent = document.getElementById('dashboardContent');
const userName = document.getElementById('userName');
const userInfo = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');

const totalProcesos = document.getElementById('totalProcesos');
const enProgreso = document.getElementById('enProgreso');
const completados = document.getElementById('completados');
const totalDocumentos = document.getElementById('totalDocumentos');

const tableBody = document.getElementById('procesosTableBody');
const searchInput = document.getElementById('searchInput');
const filtroEstado = document.getElementById('filtroEstado');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationInfo = document.getElementById('paginationInfo');

// Panel lateral de detalle
const detallePanel = document.getElementById('detallePanel');
const cerrarDetalleBtn = document.getElementById('cerrarDetalleBtn');
const detalleCodigo = document.getElementById('detalleCodigo');
const detalleEstado = document.getElementById('detalleEstado');
const detallePrioridad = document.getElementById('detallePrioridad');
const detalleFecha = document.getElementById('detalleFecha');
const detalleDescripcion = document.getElementById('detalleDescripcion');
const detalleHistorial = document.getElementById('detalleHistorial');
const detalleDocumentos = document.getElementById('detalleDocumentos');

// Modal de documento
const documentoModal = document.getElementById('documentoModal');
const documentoModalTitulo = document.getElementById('documentoModalTitulo');
const documentoModalContenido = document.getElementById('documentoModalContenido');
const documentoModalCerrarBtn = document.getElementById('documentoModalCerrarBtn');

// ============================================
// FUNCIÓN: OBTENER TOKEN DE LA URL
// ============================================
function getTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

// ============================================
// FUNCIÓN: VALIDAR TOKEN
// ============================================
async function validarToken(token) {
    try {
        const response = await fetch(VALIDAR_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Token inválido o expirado');
        }

        if (!data.telegram_id) {
            throw new Error('Token no asociado a un usuario válido');
        }

        console.log('✅ Token válido. Telegram ID:', data.telegram_id);
        return data;

    } catch (error) {
        console.error('❌ Error validando token:', error);
        throw error;
    }
}

// ============================================
// FUNCIÓN: CARGAR USUARIO
// ============================================
async function cargarUsuario(telegramId) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('user_id, nombres_apellidos, email, num_celular, estado')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Usuario no encontrado');

        userId = data.user_id;
        userName.textContent = data.nombres_apellidos;
        userInfo.textContent = `${data.nombres_apellidos} · ${data.email}`;

        return data;

    } catch (error) {
        console.error('❌ Error cargando usuario:', error);
        throw error;
    }
}

// ============================================
// FUNCIÓN: CARGAR PROCESOS
// ============================================
async function cargarProcesos() {
    try {
        const { data, error } = await supabase
            .from('procesos')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        procesos = data || [];
        filteredProcesos = [...procesos];
        currentPage = 1;

        // Actualizar estadísticas
        const total = procesos.length;
        const enProgresoCount = procesos.filter(p => p.estado === 'en_progreso').length;
        const completadosCount = procesos.filter(p => p.estado === 'completado').length;

        totalProcesos.textContent = total;
        enProgreso.textContent = enProgresoCount;
        completados.textContent = completadosCount;

        // Cargar documentos
        await cargarDocumentos();

        renderTabla();

    } catch (error) {
        console.error('❌ Error cargando procesos:', error);
        mostrarStatus('⚠️ Error al cargar los procesos.', 'error');
    }
}

// ============================================
// FUNCIÓN: CARGAR DOCUMENTOS
// ============================================
async function cargarDocumentos() {
    try {
        const procesoIds = procesos.map(p => p.procesos_id);
        
        if (procesoIds.length === 0) {
            totalDocumentos.textContent = '0';
            allDocuments = [];
            return;
        }

        const { data, error } = await supabase
            .from('info')
            .select('*')
            .in('procesos_id', procesoIds);

        if (error) throw error;

        allDocuments = data || [];
        totalDocumentos.textContent = allDocuments.length;

    } catch (error) {
        console.error('❌ Error cargando documentos:', error);
        allDocuments = [];
    }
}

// ============================================
// FUNCIÓN: OBTENER DOCUMENTOS POR PROCESO
// ============================================
function getDocumentosByProceso(procesoId) {
    return allDocuments.filter(doc => doc.procesos_id === procesoId);
}

// ============================================
// FUNCIÓN: RENDERIZAR TABLA
// ============================================
function renderTabla() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const estadoFiltro = filtroEstado?.value || 'todos';

    filteredProcesos = procesos.filter(p => {
        const matchEstado = estadoFiltro === 'todos' || p.estado === estadoFiltro;
        const matchSearch = p.codigo_proceso?.toLowerCase().includes(searchTerm) ||
                           p.descripcion?.toLowerCase().includes(searchTerm);
        return matchEstado && matchSearch;
    });

    const total = filteredProcesos.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageData = filteredProcesos.slice(start, end);

    paginationInfo.textContent = `Mostrando ${total > 0 ? start + 1 : 0} - ${end} de ${total}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: var(--spacing-xl); color: var(--sigatt-text-secondary);">
                    ${searchTerm || estadoFiltro !== 'todos' ? 'No se encontraron procesos con ese filtro' : 'No tienes procesos registrados'}
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = pageData.map(p => {
        const estadoEmoji = p.estado === 'completado' ? '✅' : 
                           p.estado === 'en_progreso' ? '🔄' : '⏳';
        const estadoClass = p.estado === 'completado' ? 'status-aprobado' :
                           p.estado === 'en_progreso' ? 'status-pendiente' : 'status-rechazado';
        
        return `
            <tr>
                <td><strong>${p.codigo_proceso}</strong></td>
                <td><span class="status-badge ${estadoClass}">${estadoEmoji} ${p.estado || 'pendiente'}</span></td>
                <td>${p.prioridad || 'normal'}</td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : 'N/A'}</td>
                <td style="text-align: center;">
                    <button class="btn-action btn-info" onclick="abrirDetalle('${p.procesos_id}')">
                        📄 Ver Detalle
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// FUNCIÓN: ABRIR PANEL DE DETALLE
// ============================================
window.abrirDetalle = function(procesoId) {
    const proceso = procesos.find(p => p.procesos_id === procesoId);
    if (!proceso) return;

    // Encabezado
    detalleCodigo.textContent = `📄 ${proceso.codigo_proceso}`;
    detalleEstado.textContent = `${proceso.estado || 'pendiente'}`;
    detalleEstado.className = `status-badge ${
        proceso.estado === 'completado' ? 'status-aprobado' :
        proceso.estado === 'en_progreso' ? 'status-pendiente' : 'status-rechazado'
    }`;
    detallePrioridad.textContent = `Prioridad: ${proceso.prioridad || 'normal'}`;
    detalleFecha.textContent = `${proceso.created_at ? new Date(proceso.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}`;
    detalleDescripcion.textContent = proceso.descripcion || 'Sin descripción.';

    // Historial de estados (simulado con línea de tiempo)
    // Como no tenemos tabla de historial, simulamos con los estados básicos
    const estadosHistoria = [
        { estado: 'pendiente', fecha: proceso.created_at, descripcion: 'Proceso creado' },
    ];
    if (proceso.estado === 'en_progreso' || proceso.estado === 'completado') {
        estadosHistoria.push({ 
            estado: 'en_progreso', 
            fecha: proceso.updated_at || proceso.created_at, 
            descripcion: 'Proceso en revisión' 
        });
    }
    if (proceso.estado === 'completado') {
        estadosHistoria.push({ 
            estado: 'completado', 
            fecha: proceso.updated_at, 
            descripcion: 'Proceso completado' 
        });
    }

    detalleHistorial.innerHTML = estadosHistoria.map((item, index) => {
        const isActive = item.estado === proceso.estado;
        const emoji = item.estado === 'completado' ? '✅' : 
                     item.estado === 'en_progreso' ? '🔄' : '⏳';
        return `
            <div style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-md); position: relative; padding-left: 24px; border-left: 2px solid ${isActive ? 'var(--sigatt-blue)' : 'var(--sigatt-border)'};">
                <div style="position: absolute; left: -8px; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: ${isActive ? 'var(--sigatt-blue)' : 'var(--sigatt-border)'}; border: 2px solid white; box-shadow: 0 0 0 2px ${isActive ? 'var(--sigatt-blue)' : 'var(--sigatt-border)'};"></div>
                <div>
                    <p style="font-weight: var(--font-weight-medium); margin: 0;">${emoji} ${item.descripcion}</p>
                    <p style="font-size: 0.75rem; color: var(--sigatt-text-secondary); margin: 0;">${item.fecha ? new Date(item.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
            </div>
        `;
    }).join('');

    // Documentos
    const docs = getDocumentosByProceso(procesoId);
    
    if (docs.length === 0) {
        detalleDocumentos.innerHTML = '<p class="text-secondary text-small">No hay documentos asociados a este proceso.</p>';
    } else {
        detalleDocumentos.innerHTML = docs.map(doc => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--sigatt-border);">
                <div>
                    <strong style="font-size: 0.9rem;">${doc.name_documento}</strong>
                    <span class="text-small text-secondary" style="margin-left: var(--spacing-sm);">
                        ${doc.tipo_documento || 'Documento'} · ${doc.subido_en ? new Date(doc.subido_en).toLocaleDateString('es-ES') : ''}
                    </span>
                </div>
                <button class="btn-action btn-info" onclick="verDocumento('${doc.info_id}')">
                    👁️ Ver
                </button>
            </div>
        `).join('');
    }

    // Abrir panel
    detallePanel.style.right = '0';
};

// ============================================
// FUNCIÓN: CERRAR PANEL DE DETALLE
// ============================================
function cerrarDetalle() {
    detallePanel.style.right = '-100%';
}

cerrarDetalleBtn.addEventListener('click', cerrarDetalle);

// Cerrar al hacer clic fuera (en el overlay)
document.addEventListener('click', (e) => {
    if (detallePanel.style.right === '0px') {
        const rect = detallePanel.getBoundingClientRect();
        if (e.clientX > rect.right || e.clientX < rect.left) {
            cerrarDetalle();
        }
    }
});

// ============================================
// FUNCIÓN: VER DOCUMENTO
// ============================================
window.verDocumento = function(infoId) {
    const documento = allDocuments.find(d => d.info_id === infoId);
    if (!documento) {
        alert('⚠️ Documento no encontrado');
        return;
    }

    documentoModalTitulo.textContent = `📎 ${documento.name_documento}`;

    const url = documento.documento;
    const mimeType = documento.mime_type || '';

    let html = '';

    if (mimeType.includes('pdf') || url.includes('.pdf')) {
        html = `
            <embed src="${url}" type="application/pdf" style="width: 100%; height: 70vh; border: none; border-radius: var(--radius-md);">
            <p class="text-small text-secondary" style="margin-top: var(--spacing-sm);">
                📌 Si no puedes ver el PDF, <a href="${url}" target="_blank">descárgalo aquí</a>.
            </p>
        `;
    } else if (mimeType.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        html = `
            <img src="${url}" alt="${documento.name_documento}" style="max-width: 100%; max-height: 70vh; border-radius: var(--radius-md);">
        `;
    } else {
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        html = `
            <iframe src="${viewerUrl}" style="width: 100%; height: 70vh; border: none; border-radius: var(--radius-md);"></iframe>
            <p class="text-small text-secondary" style="margin-top: var(--spacing-sm);">
                📌 Si no puedes ver el archivo, <a href="${url}" target="_blank">descárgalo aquí</a>.
            </p>
        `;
    }

    documentoModalContenido.innerHTML = html;
    documentoModal.style.display = 'flex';
};

// ============================================
// FUNCIONES UI
// ============================================
function mostrarStatus(texto, tipo = 'info') {
    statusMessage.textContent = texto;
    statusMessage.className = `mensaje ${tipo}`;
    statusMessage.style.display = 'block';
}

function ocultarStatus() {
    statusMessage.style.display = 'none';
}

// ============================================
// EVENTOS DE MODALES
// ============================================
documentoModalCerrarBtn.addEventListener('click', () => {
    documentoModal.style.display = 'none';
});

documentoModal.addEventListener('click', (e) => {
    if (e.target === documentoModal) documentoModal.style.display = 'none';
});

// ============================================
// EVENTOS DE BÚSQUEDA Y FILTRO
// ============================================
searchInput?.addEventListener('input', () => {
    currentPage = 1;
    renderTabla();
});

filtroEstado?.addEventListener('change', () => {
    currentPage = 1;
    renderTabla();
});

// ============================================
// EVENTOS DE PAGINACIÓN
// ============================================
prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTabla();
    }
});

nextPageBtn?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredProcesos.length / PAGE_SIZE);
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
    await cargarProcesos();
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = 'Actualizar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: var(--spacing-xs);"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
});

// ============================================
// EVENTO: CERRAR SESIÓN
// ============================================
logoutBtn?.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        try {
            const supabaseClient = getSupabase();
            await supabaseClient.auth.signOut();
            window.location.href = '/';
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error);
            alert('❌ Error al cerrar sesión');
        }
    }
});

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
    try {
        const env = await loadEnv();
        VALIDAR_TOKEN_URL = env.VITE_VALIDAR_TOKEN_URL;

        if (!VALIDAR_TOKEN_URL) {
            throw new Error('VITE_VALIDAR_TOKEN_URL no configurada en Vercel');
        }

        supabase = getSupabase();

        const token = getTokenFromURL();
        
        if (!token) {
            mostrarStatus('🔒 No se encontró token de acceso. Por favor, solicita uno desde el bot de Telegram.', 'error');
            dashboardContent.style.display = 'none';
            return;
        }

        mostrarStatus('🔍 Verificando tu acceso...', 'info');
        const tokenData = await validarToken(token);

        await cargarUsuario(tokenData.telegram_id);
        await cargarProcesos();

        ocultarStatus();
        dashboardContent.style.display = 'block';

        setInterval(cargarProcesos, 60000);

        console.log('🚀 Dashboard de usuario iniciado');

    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
        mostrarStatus(`⚠️ ${error.message || 'Error al cargar el dashboard'}`, 'error');
        dashboardContent.style.display = 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
