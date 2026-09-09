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
let documentos = {};
let currentProcesoId = null;
let archivosSeleccionados = [];
let userNombres = {};
let DRIVE_OPERATIONS_URL = null;

// ============================================
// DOM ELEMENTS
// ============================================
const statusMessage = document.getElementById('statusMessage');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const userName = document.getElementById('userName');

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

// ===== PROCESO PANEL =====
const procesoPanel = document.getElementById('procesoPanel');
const cerrarProcesoPanelBtn = document.getElementById('cerrarProcesoPanelBtn');
const cancelarProcesoBtn = document.getElementById('cancelarProcesoBtn');
const nuevoProcesoBtn = document.getElementById('nuevoProcesoBtn');
const procesoPanelTitulo = document.getElementById('procesoPanelTitulo');
const procesoForm = document.getElementById('procesoForm');
const procesoId = document.getElementById('procesoId');
const procesoUsuario = document.getElementById('procesoUsuario');
const procesoCodigo = document.getElementById('procesoCodigo');
const procesoPrioridad = document.getElementById('procesoPrioridad');
const procesoEstado = document.getElementById('procesoEstado');
const procesoFechaLimite = document.getElementById('procesoFechaLimite');
const procesoDescripcion = document.getElementById('procesoDescripcion');
const procesoNotas = document.getElementById('procesoNotas');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const documentosLista = document.getElementById('documentosLista');

// ===== MODAL =====
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

        procesoUsuario.innerHTML = '<option value="">Seleccionar usuario...</option>';
        usuarios.forEach(u => {
            const option = document.createElement('option');
            option.value = u.user_id;
            option.textContent = `${u.nombres_apellidos} (${u.email})`;
            procesoUsuario.appendChild(option);
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
                    <button class="btn-action btn-info" onclick="editarProceso('${p.procesos_id}')">
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
// FUNCIÓN: ABRIR PANEL NUEVO PROCESO
// ============================================
function abrirNuevoProceso() {
    currentProcesoId = null;
    procesoPanelTitulo.textContent = '📝 Nuevo Proceso';
    procesoForm.reset();
    procesoId.value = '';
    procesoCodigo.value = '';
    procesoCodigo.disabled = false;
    procesoUsuario.value = '';
    procesoEstado.value = 'pendiente';
    procesoPrioridad.value = 'normal';
    procesoFechaLimite.value = '';
    procesoDescripcion.value = '';
    procesoNotas.value = '';
    documentosLista.innerHTML = '<p class="text-secondary text-small">No hay documentos subidos.</p>';
    archivosSeleccionados = [];
    procesoPanel.style.right = '0';
}

// ============================================
// FUNCIÓN: ABRIR PANEL EDITAR PROCESO
// ============================================
window.editarProceso = async function(procesoId) {
    try {
        const { data: proceso, error } = await supabase
            .from('procesos')
            .select('*')
            .eq('procesos_id', procesoId)
            .single();

        if (error) throw error;

        currentProcesoId = procesoId;
        procesoPanelTitulo.textContent = `✏️ Editar: ${proceso.codigo_proceso}`;
        procesoId.value = proceso.procesos_id;
        procesoCodigo.value = proceso.codigo_proceso;
        procesoCodigo.disabled = true;
        procesoUsuario.value = proceso.user_id || '';
        procesoEstado.value = proceso.estado || 'pendiente';
        procesoPrioridad.value = proceso.prioridad || 'normal';
        procesoFechaLimite.value = proceso.fecha_limite ? proceso.fecha_limite.split('T')[0] : '';
        procesoDescripcion.value = proceso.descripcion || '';
        procesoNotas.value = proceso.notas_internas || '';

        await cargarDocumentosProceso(procesoId);

        procesoPanel.style.right = '0';

    } catch (error) {
        console.error('❌ Error cargando proceso:', error);
        mostrarStatus('⚠️ Error al cargar el proceso', 'error');
    }
};

// ============================================
// FUNCIÓN: CARGAR DOCUMENTOS DEL PROCESO
// ============================================
async function cargarDocumentosProceso(procesoId) {
    try {
        const { data, error } = await supabase
            .from('info')
            .select('*')
            .eq('procesos_id', procesoId)
            .order('subido_en', { ascending: false });

        if (error) throw error;

        documentos[procesoId] = data || [];
        renderDocumentos(procesoId);

    } catch (error) {
        console.error('❌ Error cargando documentos:', error);
    }
}

// ============================================
// FUNCIÓN: RENDERIZAR DOCUMENTOS
// ============================================
function renderDocumentos(procesoId) {
    const docs = documentos[procesoId] || [];
    
    if (docs.length === 0) {
        documentosLista.innerHTML = '<p class="text-secondary text-small">No hay documentos subidos.</p>';
        return;
    }

    documentosLista.innerHTML = docs.map(doc => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--sigatt-border);">
            <div>
                <strong style="font-size: 0.9rem;">${doc.name_documento}</strong>
                <span class="text-small text-secondary" style="margin-left: var(--spacing-sm);">
                    ${doc.subido_en ? new Date(doc.subido_en).toLocaleDateString('es-ES') : ''}
                </span>
                ${doc.anotacion ? `<br><span class="text-small text-secondary">📝 ${doc.anotacion}</span>` : ''}
            </div>
            <div style="display: flex; gap: var(--spacing-xs);">
                <button class="btn-action btn-info" onclick="verDocumentoAdmin('${doc.info_id}')">👁️</button>
                <button class="btn-action btn-danger" onclick="eliminarDocumento('${doc.info_id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============================================
// FUNCIÓN: SUBIR DOCUMENTOS (CON DRIVE)
// ============================================
async function subirDocumentos(procesoId, files) {
    if (!procesoId) {
        mostrarStatus('⚠️ Guarda el proceso primero antes de subir documentos.', 'error');
        return;
    }

    // Obtener el proceso para conocer el código
    const { data: proceso, error } = await supabase
        .from('procesos')
        .select('codigo_proceso')
        .eq('procesos_id', procesoId)
        .single();

    if (error || !proceso) {
        mostrarStatus('⚠️ Error obteniendo el proceso.', 'error');
        return;
    }

    for (const file of files) {
        try {
            // Subir archivo a Google Drive
            const driveResult = await callDriveOperations('upload-file', {
                folderName: proceso.codigo_proceso,
                file: await file.arrayBuffer(),
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream'
            });

            // Guardar en la base de datos
            const { data, error: dbError } = await supabase
                .from('info')
                .insert({
                    procesos_id: procesoId,
                    name_documento: file.name,
                    documento: driveResult.webViewLink,
                    drive_file_id: driveResult.fileId,
                    tamanio_bytes: file.size,
                    mime_type: file.type,
                    extension: file.name.split('.').pop(),
                    es_publico: true,
                    subido_por: 'admin'
                })
                .select();

            if (dbError) {
                console.error('❌ Error guardando documento en BD:', dbError);
                mostrarStatus(`⚠️ Error guardando ${file.name}`, 'error');
            }

        } catch (error) {
            console.error(`❌ Error subiendo ${file.name}:`, error);
            mostrarStatus(`⚠️ Error subiendo ${file.name}: ${error.message}`, 'error');
        }
    }

    await cargarDocumentosProceso(procesoId);
    mostrarStatus('✅ Documentos subidos correctamente', 'exito');
}

// ============================================
// FUNCIÓN: ELIMINAR DOCUMENTO (CON DRIVE)
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
// FUNCIÓN: ELIMINAR PROCESO
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
// FUNCIÓN: EJECUTAR ACCIÓN DEL MODAL
// ============================================
async function ejecutarAccion() {
    if (!modalAction || !modalData) return;

    try {
        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = 'Procesando...';

        if (modalAction === 'eliminar_documento') {
            // Obtener el drive_file_id antes de eliminar
            const { data: doc, error: getError } = await supabase
                .from('info')
                .select('drive_file_id')
                .eq('info_id', modalData.infoId)
                .single();

            if (getError) throw getError;

            // Eliminar de Google Drive
            if (doc?.drive_file_id) {
                await callDriveOperations('delete-file', { fileId: doc.drive_file_id });
            }

            // Eliminar de la base de datos
            const { error } = await supabase
                .from('info')
                .delete()
                .eq('info_id', modalData.infoId);

            if (error) throw error;
            await cargarDocumentosProceso(currentProcesoId);
            mostrarStatus('✅ Documento eliminado', 'exito');
        }

        if (modalAction === 'eliminar_proceso') {
            // Eliminar documentos de Drive asociados al proceso
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
// EVENTOS DEL MODAL
// ============================================
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
// EVENTOS: CERRAR PANEL
// ============================================
function cerrarProcesoPanel() {
    procesoPanel.style.right = '-100%';
}

if (cerrarProcesoPanelBtn) {
    cerrarProcesoPanelBtn.addEventListener('click', cerrarProcesoPanel);
}
if (cancelarProcesoBtn) {
    cancelarProcesoBtn.addEventListener('click', cerrarProcesoPanel);
}

// ============================================
// EVENTO: DROPZONE
// ============================================
if (dropzone) {
    dropzone.addEventListener('click', () => fileInput?.click());
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--sigatt-blue)';
        dropzone.style.background = 'var(--sigatt-light-blue)';
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--sigatt-border)';
        dropzone.style.background = 'transparent';
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--sigatt-border)';
        dropzone.style.background = 'transparent';
        if (currentProcesoId && e.dataTransfer.files.length > 0) {
            subirDocumentos(currentProcesoId, e.dataTransfer.files);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (currentProcesoId && e.target.files.length > 0) {
            subirDocumentos(currentProcesoId, e.target.files);
            fileInput.value = '';
        }
    });
}

// ============================================
// EVENTO: GUARDAR PROCESO
// ============================================
if (procesoForm) {
    procesoForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            user_id: procesoUsuario.value || null,
            codigo_proceso: procesoCodigo.value.trim(),
            prioridad: procesoPrioridad.value,
            estado: procesoEstado.value,
            fecha_limite: procesoFechaLimite.value || null,
            descripcion: procesoDescripcion.value.trim(),
            notas_internas: procesoNotas.value.trim(),
        };

        try {
            let procesoIdResult;

            if (procesoId.value) {
                // Actualizar proceso
                const { error } = await supabase
                    .from('procesos')
                    .update(data)
                    .eq('procesos_id', procesoId.value);

                if (error) throw error;
                procesoIdResult = procesoId.value;
                mostrarStatus('✅ Proceso actualizado correctamente', 'exito');
            } else {
                // Crear proceso
                const { data: newProceso, error } = await supabase
                    .from('procesos')
                    .insert([data])
                    .select()
                    .single();

                if (error) throw error;
                procesoIdResult = newProceso.procesos_id;
                mostrarStatus('✅ Proceso creado correctamente', 'exito');
            }

            // Crear carpeta en Google Drive
            try {
                await callDriveOperations('create-folder', {
                    folderName: data.codigo_proceso
                });
                console.log(`📁 Carpeta creada para: ${data.codigo_proceso}`);
            } catch (driveError) {
                console.warn('⚠️ Error creando carpeta en Drive:', driveError);
                mostrarStatus('⚠️ Proceso guardado, pero hubo error al crear la carpeta', 'warning');
            }

            await cargarProcesos();
            cerrarProcesoPanel();

        } catch (error) {
            console.error('❌ Error guardando proceso:', error);
            mostrarStatus('❌ Error al guardar: ' + error.message, 'error');
        }
    });
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

        const { data: user } = await supabase
            .from('usuarios')
            .select('nombres_apellidos')
            .eq('user_id', session.user.id)
            .single();

        if (user) {
            userName.textContent = user.nombres_apellidos || 'Admin';
        }

        // Obtener URL de Drive Operations desde variables de entorno
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
