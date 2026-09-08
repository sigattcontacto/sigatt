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

// Modal de detalle
const procesoModal = document.getElementById('procesoModal');
const modalCerrarBtn = document.getElementById('modalCerrarBtn');
const modalTitulo = document.getElementById('modalTitulo');
const modalCodigo = document.getElementById('modalCodigo');
const modalEstado = document.getElementById('modalEstado');
const modalPrioridad = document.getElementById('modalPrioridad');
const modalFecha = document.getElementById('modalFecha');
const modalDescripcion = document.getElementById('modalDescripcion');
const modalDocumentos = document.getElementById('modalDocumentos');

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

        // Verificar que el token esté asociado al usuario
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
// FUNCIÓN: CARGAR DATOS DEL USUARIO
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

        // Cargar documentos asociados
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
        // Obtener todos los IDs de procesos
        const procesoIds = procesos.map(p => p.procesos_id);
        
        if (procesoIds.length === 0) {
            totalDocumentos.textContent = '0';
            return;
        }

        const { data, error } = await supabase
            .from('info')
            .select('*')
            .in('procesos_id', procesoIds);

        if (error) throw error;

        totalDocumentos.textContent = data?.length || 0;

        // Guardar documentos en un mapa para acceso rápido
        window.documentosMap = {};
        if (data) {
            data.forEach(doc => {
                if (!window.documentosMap[doc.procesos_id]) {
                    window.documentosMap[doc.procesos_id] = [];
                }
                window.documentosMap[doc.procesos_id].push(doc);
            });
        }

    } catch (error) {
        console.error('❌ Error cargando documentos:', error);
    }
}

// ============================================
// FUNCIÓN: RENDERIZAR TABLA
// ============================================
function renderTabla() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const estadoFiltro = filtroEstado?.value || 'todos';

    // Filtrar
    filteredProcesos = procesos.filter(p => {
        const matchEstado = estadoFiltro === 'todos' || p.estado === estadoFiltro;
        const matchSearch = p.codigo_proceso?.toLowerCase().includes(searchTerm) ||
                           p.descripcion?.toLowerCase().includes(searchTerm);
        return matchEstado && matchSearch;
    });

    // Paginación
    const total = filteredProcesos.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const pageData = filteredProcesos.slice(start, end);

    // Actualizar info de paginación
    paginationInfo.textContent = `Mostrando ${total > 0 ? start + 1 : 0} - ${end} de ${total}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    // Renderizar filas
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
                    <button class="btn-action btn-info" onclick="verDetalle('${p.procesos_id}')">
                        📄 Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// FUNCIÓN: VER DETALLE DEL PROCESO
// ============================================
window.verDetalle = function(procesoId) {
    const proceso = procesos.find(p => p.procesos_id === procesoId);
    if (!proceso) return;

    // Llenar información del proceso
    modalTitulo.textContent = `📄 ${proceso.codigo_proceso}`;
    modalCodigo.textContent = proceso.codigo_proceso;
    modalEstado.textContent = proceso.estado || 'pendiente';
    modalPrioridad.textContent = proceso.prioridad || 'normal';
    modalFecha.textContent = proceso.created_at ? new Date(proceso.created_at).toLocaleDateString('es-ES') : 'N/A';
    modalDescripcion.textContent = proceso.descripcion || 'Sin descripción';

    // Cargar documentos
    const docs = window.documentosMap?.[procesoId] || [];
    
    if (docs.length === 0) {
        modalDocumentos.innerHTML = '<p class="text-secondary text-small">No hay documentos asociados a este proceso.</p>';
    } else {
        modalDocumentos.innerHTML = docs.map(doc => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--sigatt-border);">
                <div>
                    <strong>${doc.name_documento}</strong>
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

    procesoModal.style.display = 'flex';
};

// ============================================
// FUNCIÓN: VER DOCUMENTO
// ============================================
window.verDocumento = function(infoId) {
    // Buscar el documento en el mapa
    let documento = null;
    for (const key in window.documentosMap) {
        const found = window.documentosMap[key].find(d => d.info_id === infoId);
        if (found) {
            documento = found;
            break;
        }
    }

    if (!documento) {
        alert('⚠️ Documento no encontrado');
        return;
    }

    documentoModalTitulo.textContent = `📎 ${documento.name_documento}`;

    const url = documento.documento;
    const mimeType = documento.mime_type || '';

    let html = '';

    if (mimeType.includes('pdf') || url.includes('.pdf')) {
        // PDF → incrustar
        html = `
            <embed src="${url}" type="application/pdf" style="width: 100%; height: 70vh; border: none; border-radius: var(--radius-md);">
            <p class="text-small text-secondary" style="margin-top: var(--spacing-sm);">
                📌 Si no puedes ver el PDF, <a href="${url}" target="_blank">descárgalo aquí</a>.
            </p>
        `;
    } else if (mimeType.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        // Imagen → mostrar
        html = `
            <img src="${url}" alt="${documento.name_documento}" style="max-width: 100%; max-height: 70vh; border-radius: var(--radius-md);">
        `;
    } else {
        // Otros (Word, Excel, PowerPoint) → Google Docs Viewer
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
modalCerrarBtn.addEventListener('click', () => {
    procesoModal.style.display = 'none';
});

procesoModal.addEventListener('click', (e) => {
    if (e.target === procesoModal) procesoModal.style.display = 'none';
});

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
        // 1. Cargar variables de entorno
        const env = await loadEnv();
        VALIDAR_TOKEN_URL = env.VITE_VALIDAR_TOKEN_URL;

        if (!VALIDAR_TOKEN_URL) {
            throw new Error('VITE_VALIDAR_TOKEN_URL no configurada en Vercel');
        }

        // 2. Inicializar Supabase
        supabase = getSupabase();

        // 3. Obtener token de la URL
        const token = getTokenFromURL();
        
        if (!token) {
            mostrarStatus('🔒 No se encontró token de acceso. Por favor, solicita uno desde el bot de Telegram.', 'error');
            dashboardContent.style.display = 'none';
            return;
        }

        // 4. Validar el token
        mostrarStatus('🔍 Verificando tu acceso...', 'info');
        const tokenData = await validarToken(token);

        // 5. Obtener datos del usuario
        await cargarUsuario(tokenData.telegram_id);

        // 6. Cargar procesos y documentos
        await cargarProcesos();

        // 7. Mostrar dashboard
        ocultarStatus();
        dashboardContent.style.display = 'block';

        // 8. Auto-refrescar cada 60 segundos
        setInterval(cargarProcesos, 60000);

        console.log('🚀 Dashboard de usuario iniciado');

    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
        mostrarStatus(`⚠️ ${error.message || 'Error al cargar el dashboard'}`, 'error');
        dashboardContent.style.display = 'none';
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
