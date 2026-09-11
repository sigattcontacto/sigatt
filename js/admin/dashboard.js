// js/admin/dashboard.js
import { getSupabase } from '../supabase-config.js';
import { protegerRuta, cerrarSesion } from './auth.js';

// ============================================
// CONFIGURACIÓN
// ============================================
const PAGE_SIZE = 10;
let currentPage = 1;
let procesos = [];
let filteredProcesos = [];
let supabase = null;
let usuarios = [];
let userNombres = {};
let DRIVE_OPERATIONS_URL = null;
let currentProcesoId = null;
let adminUserId = null;
let adminNombre = null;

// ============================================
// DOM ELEMENTS - GENERALES
// ============================================
const statusMessage = document.getElementById('statusMessage');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const userName = document.getElementById('userName');
const nuevoProcesoBtn = document.getElementById('nuevoProcesoBtn');

const totalProcesos = document.getElementById('totalProcesos');
const activos = document.getElementById('activos');
const completados = document.getElementById('completados');
const totalDocumentos = document.getElementById('totalDocumentos');

const tableBody = document.getElementById('procesosTableBody');
const searchInput = document.getElementById('searchInput');
const filtroEstado = document.getElementById('filtroEstado');
const filtroPrioridad = document.getElementById('filtroPrioridad');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationInfo = document.getElementById('paginationInfo');

// ===== MODAL 1: NUEVO PROCESO =====
const nuevoProcesoModal = document.getElementById('nuevoProcesoModal');
const nuevoProcesoForm = document.getElementById('nuevoProcesoForm');
const nuevoProcesoUsuario = document.getElementById('nuevoProcesoUsuario');
const nuevoProcesoCodigo = document.getElementById('nuevoProcesoCodigo');
const nuevoProcesoPrioridad = document.getElementById('nuevoProcesoPrioridad');
const nuevoProcesoEstado = document.getElementById('nuevoProcesoEstado');
const nuevoProcesoDescripcion = document.getElementById('nuevoProcesoDescripcion');
const cerrarNuevoProcesoBtn = document.getElementById('cerrarNuevoProcesoBtn');
const cancelarNuevoProcesoBtn = document.getElementById('cancelarNuevoProcesoBtn');

// ===== MODAL 2: EDITAR PROCESO =====
const editarProcesoModal = document.getElementById('editarProcesoModal');
const editarProcesoForm = document.getElementById('editarProcesoForm');
const editarProcesoId = document.getElementById('editarProcesoId');
const editarProcesoTitulo = document.getElementById('editarProcesoTitulo');
const editarProcesoCodigoDisplay = document.getElementById('editarProcesoCodigoDisplay');
const editarProcesoUsuarioDisplay = document.getElementById('editarProcesoUsuarioDisplay');
const editarProcesoFechaDisplay = document.getElementById('editarProcesoFechaDisplay');
const editarProcesoDescripcion = document.getElementById('editarProcesoDescripcion');
const editarProcesoEstado = document.getElementById('editarProcesoEstado');
const editarProcesoPrioridad = document.getElementById('editarProcesoPrioridad');
const cerrarEditarProcesoBtn = document.getElementById('cerrarEditarProcesoBtn');
const cancelarEditarProcesoBtn = document.getElementById('cancelarEditarProcesoBtn');
const guardarCambiosProcesoBtn = document.getElementById('guardarCambiosProcesoBtn');

// Sub-formulario de documento
const agregarDocumentoBtn = document.getElementById('agregarDocumentoBtn');
const subFormularioDocumento = document.getElementById('subFormularioDocumento');
const nuevoDocNombre = document.getElementById('nuevoDocNombre');
const nuevoDocDescripcion = document.getElementById('nuevoDocDescripcion');
const nuevoDocArchivo = document.getElementById('nuevoDocArchivo');
const guardarDocumentoBtn = document.getElementById('guardarDocumentoBtn');
const cancelarDocumentoBtn = document.getElementById('cancelarDocumentoBtn');
const documentosTablaBody = document.getElementById('documentosTablaBody');

// ===== MODAL DE CONFIRMACIÓN =====
const modal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

let modalAction = null;
let modalData = null;

// ============================================
// FUNCIÓN: LLAMAR A DRIVE OPERATIONS
// ============================================
async function callDriveOperations(action, data) {
    try {
        const response = await fetch(DRIVE_OPERATIONS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data }),
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Error en operación de Drive');
        }
        return result;
    } catch (error) {
        console.error(`❌ Error en ${action}:`, error);
        throw error;
    }
}

// ============================================
// FUNCIÓN: CONVERTIR ARCHIVO A BASE64
// ============================================
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// FUNCIÓN: CARGAR USUARIOS
// ============================================
async function cargarUsuarios() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('user_id, nombres_apellidos, email')
            .eq('rol', 'usuario')
            .order('nombres_apellidos');

        if (error) throw error;
        usuarios = data || [];

        userNombres = {};
        usuarios.forEach(u => {
            userNombres[u.user_id] = u.nombres_apellidos;
        });

        nuevoProcesoUsuario.innerHTML = '<option value="">Seleccionar usuario...</option>';
        usuarios.forEach(u => {
            const option = document.createElement('option');
            option.value = u.user_id;
            option.textContent = `${u.nombres_apellidos} (${u.email})`;
            nuevoProcesoUsuario.appendChild(option);
        });

    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        mostrarStatus('⚠️ Error al cargar usuarios', 'error');
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
            .order('created_at', { ascending: false });

        if (error) throw error;

        procesos = data || [];
        filteredProcesos = [...procesos];
        currentPage = 1;

        const total = procesos.length;
        const activosCount = procesos.filter(p => p.estado === 'activo' || p.estado === 'en_revision').length;
        const completadosCount = procesos.filter(p => p.estado === 'completado').length;

        totalProcesos.textContent = total;
        activos.textContent = activosCount;
        completados.textContent = completadosCount;

        await contarDocumentos();
        renderTabla();

    } catch (error) {
        console.error('❌ Error cargando procesos:', error);
    }
}

// ============================================
// FUNCIÓN: CONTAR DOCUMENTOS
// ============================================
async function contarDocumentos() {
    try {
        const { count, error } = await supabase
            .from('info')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        totalDocumentos.textContent = count || 0;

    } catch (error) {
        console.error('❌ Error contando documentos:', error);
    }
}

// ============================================
// FUNCIÓN: RENDERIZAR TABLA
// ============================================
function renderTabla() {
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const estadoFiltro = filtroEstado?.value || 'todos';
    const prioridadFiltro = filtroPrioridad?.value || 'todas';

    filteredProcesos = procesos.filter(p => {
        const matchEstado = estadoFiltro === 'todos' || p.estado === estadoFiltro;
        const matchPrioridad = prioridadFiltro === 'todas' || p.prioridad === prioridadFiltro;
        const matchSearch = p.codigo_proceso?.toLowerCase().includes(searchTerm) ||
                           p.descripcion?.toLowerCase().includes(searchTerm);
        return matchEstado && matchPrioridad && matchSearch;
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
                <td colspan="6" style="text-align: center; padding: var(--spacing-xl); color: var(--sigatt-text-secondary);">
                    ${searchTerm || estadoFiltro !== 'todos' || prioridadFiltro !== 'todas' ? 'No se encontraron procesos con ese filtro' : 'No hay procesos registrados'}
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = pageData.map(p => {
        const estadoEmoji = p.estado === 'completado' ? '✅' : 
                           p.estado === 'activo' ? '🔄' : 
                           p.estado === 'en_revision' ? '🔍' : 
                           p.estado === 'archivado' ? '📦' : '⏳';
        const estadoClass = p.estado === 'completado' ? 'status-aprobado' :
                           p.estado === 'activo' ? 'status-pendiente' : 'status-rechazado';
        
        const nombreUsuario = p.user_id ? (userNombres[p.user_id] || 'Sin asignar') : 'Sin asignar';
        
        return `
            <tr>
                <td><strong>${p.codigo_proceso}</strong></td>
                <td>${nombreUsuario}</td>
                <td><span class="status-badge ${estadoClass}">${estadoEmoji} ${p.estado || 'pendiente'}</span></td>
                <td>${p.prioridad || 'normal'}</td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : 'N/A'}</td>
                <td style="text-align: center;">
                    <button class="btn-action btn-info" onclick="abrirEditarProceso('${p.procesos_id}')">
                        ✏️ Editar
                    </button>
                    <button class="btn-action btn-danger" onclick="eliminarProceso('${p.procesos_id}')">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODAL 1: ABRIR NUEVO PROCESO
// ============================================
function abrirNuevoProceso() {
    nuevoProcesoForm.reset();
    nuevoProcesoUsuario.value = '';
    nuevoProcesoCodigo.value = '';
    nuevoProcesoPrioridad.value = 'normal';
    nuevoProcesoEstado.value = 'pendiente';
    nuevoProcesoDescripcion.value = '';
    nuevoProcesoModal.style.display = 'flex';
}

// ============================================
// MODAL 1: GUARDAR NUEVO PROCESO
// ============================================
nuevoProcesoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        user_id: nuevoProcesoUsuario.value || null,
        codigo_proceso: nuevoProcesoCodigo.value.trim(),
        prioridad: nuevoProcesoPrioridad.value,
        estado: nuevoProcesoEstado.value,
        descripcion: nuevoProcesoDescripcion.value.trim()
    };

    if (!data.codigo_proceso) {
        mostrarStatus('⚠️ El código del proceso es requerido', 'error');
        return;
    }

    try {
        // Crear proceso en Supabase
        const { data: newProceso, error } = await supabase
            .from('procesos')
            .insert([data])
            .select()
            .single();

        if (error) throw error;

        // Crear carpeta en Google Drive
        try {
            await callDriveOperations('create-folder', {
                folderName: data.codigo_proceso
            });
            console.log(`📁 Carpeta creada para: ${data.codigo_proceso}`);
        } catch (driveError) {
            console.warn('⚠️ Error creando carpeta en Drive:', driveError);
        }

        mostrarStatus('✅ Proceso creado correctamente', 'exito');
        nuevoProcesoModal.style.display = 'none';
        await cargarProcesos();

    } catch (error) {
        console.error('❌ Error guardando proceso:', error);
        mostrarStatus('❌ Error al guardar: ' + error.message, 'error');
    }
});

// ============================================
// MODAL 2: ABRIR EDITAR PROCESO
// ============================================
window.abrirEditarProceso = async function(procesoIdParam) {
    try {
        const { data: proceso, error } = await supabase
            .from('procesos')
            .select('*')
            .eq('procesos_id', procesoIdParam)
            .single();

        if (error) throw error;

        currentProcesoId = procesoIdParam;

        // Llenar información no editable
        editarProcesoTitulo.textContent = `✏️ Editar Proceso: ${proceso.codigo_proceso}`;
        editarProcesoCodigoDisplay.textContent = proceso.codigo_proceso;
        editarProcesoUsuarioDisplay.textContent = proceso.user_id ? (userNombres[proceso.user_id] || 'Sin asignar') : 'Sin asignar';
        editarProcesoFechaDisplay.textContent = proceso.created_at ? new Date(proceso.created_at).toLocaleDateString('es-ES') : 'N/A';

        // Llenar formulario
        editarProcesoId.value = proceso.procesos_id;
        editarProcesoDescripcion.value = proceso.descripcion || '';
        editarProcesoEstado.value = proceso.estado || 'pendiente';
        editarProcesoPrioridad.value = proceso.prioridad || 'normal';

        // Cargar documentos
        await cargarDocumentosProceso(procesoIdParam);

        // Ocultar sub-formulario
        subFormularioDocumento.style.display = 'none';

        // Abrir modal
        editarProcesoModal.style.display = 'flex';

    } catch (error) {
        console.error('❌ Error cargando proceso:', error);
        mostrarStatus('⚠️ Error al cargar el proceso', 'error');
    }
};

// ============================================
// MODAL 2: CARGAR DOCUMENTOS DEL PROCESO
// ============================================
async function cargarDocumentosProceso(procesoId) {
    try {
        const { data, error } = await supabase
            .from('info')
            .select('*')
            .eq('procesos_id', procesoId)
            .order('subido_en', { ascending: false });

        if (error) throw error;

        renderDocumentos(data || []);

    } catch (error) {
        console.error('❌ Error cargando documentos:', error);
    }
}

// ============================================
// MODAL 2: RENDERIZAR DOCUMENTOS
// ============================================
function renderDocumentos(docs) {
    if (docs.length === 0) {
        documentosTablaBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: var(--spacing-lg); color: var(--sigatt-text-secondary);">
                    No hay documentos cargados.
                </td>
            </tr>
        `;
        return;
    }

    documentosTablaBody.innerHTML = docs.map((doc, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${doc.name_documento}</strong></td>
            <td>${doc.anotacion || '<span class="text-secondary text-xs">Sin descripción</span>'}</td>
            <td>
                <a href="${doc.documento}" target="_blank" class="btn-action btn-info" style="text-decoration: none;">
                    👁️ Ver
                </a>
            </td>
            <td style="text-align: center;">
                <button class="btn-action btn-danger" onclick="eliminarDocumento('${doc.info_id}')" style="padding: 4px 8px;">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// MODAL 2: GUARDAR CAMBIOS DEL PROCESO
// ============================================
guardarCambiosProcesoBtn.addEventListener('click', async () => {
    const procesoId = editarProcesoId.value;
    if (!procesoId) return;

    const data = {
        descripcion: editarProcesoDescripcion.value.trim(),
        estado: editarProcesoEstado.value,
        prioridad: editarProcesoPrioridad.value
    };

    try {
        const { error } = await supabase
            .from('procesos')
            .update(data)
            .eq('procesos_id', procesoId);

        if (error) throw error;

        mostrarStatus('✅ Proceso actualizado correctamente', 'exito');
        editarProcesoModal.style.display = 'none';
        await cargarProcesos();

    } catch (error) {
        console.error('❌ Error actualizando proceso:', error);
        mostrarStatus('❌ Error al actualizar: ' + error.message, 'error');
    }
});

// ============================================
// MODAL 2: MOSTRAR SUB-FORMULARIO DE DOCUMENTO
// ============================================
agregarDocumentoBtn.addEventListener('click', () => {
    subFormularioDocumento.style.display = 'block';
    nuevoDocNombre.value = '';
    nuevoDocDescripcion.value = '';
    nuevoDocArchivo.value = '';
});

// ============================================
// MODAL 2: CANCELAR SUB-FORMULARIO
// ============================================
cancelarDocumentoBtn.addEventListener('click', () => {
    subFormularioDocumento.style.display = 'none';
});

// ============================================
// MODAL 2: GUARDAR DOCUMENTO (SUB-FORMULARIO)
// ============================================
guardarDocumentoBtn.addEventListener('click', async () => {
    const procesoId = editarProcesoId.value;
    const nombre = nuevoDocNombre.value.trim();
    const descripcion = nuevoDocDescripcion.value.trim();
    const archivo = nuevoDocArchivo.files[0];

    if (!procesoId) {
        mostrarStatus('⚠️ No hay proceso seleccionado', 'error');
        return;
    }
    if (!nombre) {
        mostrarStatus('⚠️ El nombre del documento es requerido', 'error');
        return;
    }
    if (!archivo) {
        mostrarStatus('⚠️ Debes seleccionar un archivo', 'error');
        return;
    }

    try {
        // Obtener el código del proceso
        const { data: proceso, error: procesoError } = await supabase
            .from('procesos')
            .select('codigo_proceso')
            .eq('procesos_id', procesoId)
            .single();

        if (procesoError) throw procesoError;

        // Convertir archivo a base64
        const base64 = await fileToBase64(archivo);

        // Subir a Google Drive
        mostrarStatus('📤 Subiendo archivo a Drive...', 'info');
        const driveResult = await callDriveOperations('upload-file', {
            folderName: proceso.codigo_proceso,
            file: base64,
            fileName: archivo.name,
            mimeType: archivo.type || 'application/octet-stream'
        });

        // Guardar en Supabase
        const { error: dbError } = await supabase
            .from('info')
            .insert({
                procesos_id: procesoId,
                name_documento: nombre,
                documento: driveResult.webViewLink,
                drive_file_id: driveResult.fileId,
                anotacion: descripcion || null,
                tamanio_bytes: archivo.size,
                mime_type: archivo.type,
                extension: archivo.name.split('.').pop(),
                es_publico: true,
                subido_por: adminUserId
            });

        if (dbError) throw dbError;

        mostrarStatus('✅ Documento guardado correctamente', 'exito');
        subFormularioDocumento.style.display = 'none';
        nuevoDocNombre.value = '';
        nuevoDocDescripcion.value = '';
        nuevoDocArchivo.value = '';

        // Recargar documentos
        await cargarDocumentosProceso(procesoId);

    } catch (error) {
        console.error('❌ Error guardando documento:', error);
        mostrarStatus('❌ Error: ' + error.message, 'error');
    }
});

// ============================================
// MODAL 2: ELIMINAR DOCUMENTO
// ============================================
window.eliminarDocumento = function(infoId) {
    modalTitle.textContent = '🗑️ Eliminar Documento';
    modalMessage.textContent = '¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.';
    modalConfirmBtn.className = 'btn btn-danger';
    modalConfirmBtn.textContent = 'Eliminar';
    modalAction = 'eliminar_documento';
    modalData = { infoId };
    modal.style.display = 'flex';
};

// ============================================
// MODAL 2: ELIMINAR PROCESO
// ============================================
window.eliminarProceso = function(procesoId) {
    modalTitle.textContent = '🗑️ Eliminar Proceso';
    modalMessage.textContent = '¿Estás seguro de eliminar este proceso? Se eliminarán también todos sus documentos.';
    modalConfirmBtn.className = 'btn btn-danger';
    modalConfirmBtn.textContent = 'Eliminar';
    modalAction = 'eliminar_proceso';
    modalData = { procesoId };
    modal.style.display = 'flex';
};

// ============================================
// FUNCIÓN: EJECUTAR ACCIÓN DEL MODAL DE CONFIRMACIÓN
// ============================================
async function ejecutarAccion() {
    if (!modalAction || !modalData) return;

    try {
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = 'Procesando...';

        if (modalAction === 'eliminar_documento') {
            const { data: doc, error: getError } = await supabase
                .from('info')
                .select('drive_file_id')
                .eq('info_id', modalData.infoId)
                .single();

            if (getError) throw getError;

            if (doc?.drive_file_id) {
                await callDriveOperations('delete-file', { fileId: doc.drive_file_id });
            }

            const { error } = await supabase
                .from('info')
                .delete()
                .eq('info_id', modalData.infoId);

            if (error) throw error;
            
            await cargarDocumentosProceso(currentProcesoId);
            mostrarStatus('✅ Documento eliminado', 'exito');
        }

        if (modalAction === 'eliminar_proceso') {
            const { data: docs, error: docsError } = await supabase
                .from('info')
                .select('drive_file_id')
                .eq('procesos_id', modalData.procesoId);

            if (!docsError && docs) {
                for (const doc of docs) {
                    if (doc.drive_file_id) {
                        try {
                            await callDriveOperations('delete-file', { fileId: doc.drive_file_id });
                        } catch (e) {
                            console.warn(`⚠️ No se pudo eliminar archivo ${doc.drive_file_id}:`, e);
                        }
                    }
                }
            }

            const { error } = await supabase
                .from('procesos')
                .delete()
                .eq('procesos_id', modalData.procesoId);

            if (error) throw error;
            await cargarProcesos();
            mostrarStatus('✅ Proceso eliminado', 'exito');
        }

        cerrarModal();

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarStatus('❌ Error al procesar: ' + error.message, 'error');
        cerrarModal();
    }
}

function cerrarModal() {
    modal.style.display = 'none';
    modalAction = null;
    modalData = null;
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.textContent = 'Confirmar';
}

// ============================================
// EVENTOS DE CIERRE DE MODALES
// ============================================
// Modal 1
cerrarNuevoProcesoBtn.addEventListener('click', () => nuevoProcesoModal.style.display = 'none');
cancelarNuevoProcesoBtn.addEventListener('click', () => nuevoProcesoModal.style.display = 'none');
nuevoProcesoModal.addEventListener('click', (e) => {
    if (e.target === nuevoProcesoModal) nuevoProcesoModal.style.display = 'none';
});

// Modal 2
cerrarEditarProcesoBtn.addEventListener('click', () => editarProcesoModal.style.display = 'none');
cancelarEditarProcesoBtn.addEventListener('click', () => editarProcesoModal.style.display = 'none');
editarProcesoModal.addEventListener('click', (e) => {
    if (e.target === editarProcesoModal) editarProcesoModal.style.display = 'none';
});

// Modal de confirmación
modalConfirmBtn.addEventListener('click', ejecutarAccion);
modalCancelBtn.addEventListener('click', cerrarModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
});

// ============================================
// EVENTO: NUEVO PROCESO
// ============================================
if (nuevoProcesoBtn) {
    nuevoProcesoBtn.addEventListener('click', abrirNuevoProceso);
}

// ============================================
// EVENTOS: REFRESCAR
// ============================================
refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Cargando...';
    await cargarProcesos();
    await cargarUsuarios();
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = 'Actualizar';
});

// ============================================
// EVENTO: CERRAR SESIÓN
// ============================================
logoutBtn?.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        const result = await cerrarSesion();
        if (result.success) {
            window.location.href = '/admin/login.html';
        }
    }
});

// ============================================
// EVENTOS DE BÚSQUEDA Y FILTROS
// ============================================
searchInput?.addEventListener('input', () => {
    currentPage = 1;
    renderTabla();
});

filtroEstado?.addEventListener('change', () => {
    currentPage = 1;
    renderTabla();
});

filtroPrioridad?.addEventListener('change', () => {
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
// FUNCIONES UI
// ============================================
function mostrarStatus(texto, tipo = 'info') {
    if (statusMessage) {
        statusMessage.textContent = texto;
        statusMessage.className = `mensaje ${tipo}`;
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function init() {
    try {
        supabase = getSupabase();

        const session = await protegerRuta();
        if (!session) return;

        adminUserId = session.user.id;

        const { data: user } = await supabase
            .from('usuarios')
            .select('nombres_apellidos')
            .eq('user_id', session.user.id)
            .single();

        if (user) {
            adminNombre = user.nombres_apellidos || 'Admin';
            userName.textContent = adminNombre;
        }

        const env = await import('../config-loader.js').then(m => m.loadEnv());
        DRIVE_OPERATIONS_URL = env.VITE_DRIVE_OPERATIONS_URL;

        if (!DRIVE_OPERATIONS_URL) {
            console.warn('⚠️ VITE_DRIVE_OPERATIONS_URL no configurada');
        }

        await cargarUsuarios();
        await cargarProcesos();

        setInterval(cargarProcesos, 60000);

        console.log('🚀 Panel de Administración iniciado');

    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
    }
}

init();
