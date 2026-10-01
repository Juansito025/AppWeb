/** empleados */

import {
    getEmpleados,
    getEmpleadosPaginado,
    getEmpleado,
    createEmpleado,
    actualizarEmpleado,
    deleteEmpleado
} from '../servicios/empleadosService.js';

import { getLugaresTrabajo } from '../servicios/lugarTrabajoService.js';
import { getRoles } from '../servicios/rolesService.js';
import { createTarea } from '../servicios/tareasService.js';
import { createNotificacion } from '../servicios/notificacionesService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── Estado Local ─────────────────────────────────────────────────────────────
let empleados = [];
let roles = [];
let casetas = [];
let busqueda = '';
let filtroEstado = 'all';
let paginaActual = 1;
const itemsPorPagina = 8;
let empleadoSeleccionado = null;

// ── Referencias DOM ──────────────────────────────────────────────────────────
const tablaCuerpo = document.getElementById('tabla-cuerpo');
const etiquetaTotal = document.getElementById('etiqueta-total');
const entradaBusqueda = document.getElementById('entrada-busqueda');
const paginacionContenedor = document.getElementById('paginacion-empleados');

// Modales
const panelAgregar = document.getElementById('panel-agregar');
const formAgregar = document.getElementById('form-agregar');
const btnAbrirAgregar = document.getElementById('btn-abrir-agregar');
const btnCerrarAgregar = document.getElementById('btn-cerrar-agregar');
const btnCancelarAgregar = document.getElementById('btn-cancelar-agregar');

const panelDetalle = document.getElementById('panel-detalle');
const formDetalle = document.getElementById('form-detalle');
const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle');
const btnCancelarDetalle = document.getElementById('btn-cancelar-detalle');

const panelNotificar = document.getElementById('panel-notificar-empleado');
const formNotificar = document.getElementById('form-notificar-empleado');
const btnAbrirNotificar = document.getElementById('btn-abrir-notificar-empleado');
const btnCerrarNotificar = document.getElementById('btn-cerrar-notificar-empleado');
const btnCancelarNotificar = document.getElementById('btn-cancelar-notificar-empleado');

const panelAsignarTarea = document.getElementById('panel-asignar-tarea');
const formAsignarTarea = document.getElementById('form-asignar-tarea');
const btnAbrirAsignarTarea = document.getElementById('btn-abrir-asignar-tarea');
const btnCerrarAsignarTarea = document.getElementById('btn-cerrar-asignar-tarea');
const btnCancelarAsignarTarea = document.getElementById('btn-cancelar-asignar-tarea');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Proteger vista (Solo Administradores tienen acceso a la gestión de empleados)
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista('Administrador');
    }

    // 2. Cargar catálogos y datos
    await Promise.all([
        cargarRoles(),
        cargarCasetas(),
        cargarEmpleados()
    ]);

    // 3. Configurar escuchadores
    configurarBusquedaYFiltros();
    configurarModales();
});

// ── Carga de Datos ───────────────────────────────────────────────────────────
async function cargarRoles() {
    try {
        const res = await getRoles();
        roles = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        console.warn('Error cargando roles:', e);
        roles = [];
    }
    poblarSelectsRoles();
}

async function cargarCasetas() {
    try {
        const res = await getLugaresTrabajo();
        casetas = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        casetas = [];
    }
    poblarSelectsCasetas();
}

async function cargarEmpleados() {
    if (tablaCuerpo) {
        tablaCuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Cargando personal...</td></tr>`;
    }
    try {
        const res = await getEmpleados();
        empleados = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        empleados = [];
        console.warn('No se pudieron cargar empleados:', e.message);
    }
    renderizarTabla();
    poblarSelectsEmpleados();
}

function poblarSelectsRoles() {
    const selects = [document.getElementById('agregar-rol'), document.getElementById('detalle-rol')];
    selects.forEach(sel => {
        if (!sel) return;
        const actualVal = sel.value;
        sel.innerHTML = '<option value="">Seleccionar rol...</option>';
        const rolesVistos = new Set();
        roles.forEach(r => {
            const id = r.idRol || r.id;
            const nombre = r.nombreRol || r.nombre;
            if (!nombre) return;
            const clave = nombre.toLowerCase().trim();
            if (rolesVistos.has(clave)) return;
            rolesVistos.add(clave);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nombre;
            sel.appendChild(opt);
        });
        if (actualVal) sel.value = actualVal;
    });
}

function poblarSelectsCasetas() {
    const selects = [document.getElementById('agregar-caseta'), document.getElementById('detalle-caseta')];
    selects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">Ninguna / Sin asignación</option>';
        casetas.forEach(c => {
            const id = c.idLugarTrabajo || c.idCasetas || c.id;
            const nombre = c.nombreLugar || c.nombreCaseta || `Caseta #${id}`;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nombre;
            sel.appendChild(opt);
        });
    });
}

function poblarSelectsEmpleados() {
    const selTarea = document.getElementById('tarea-empleado-destino');
    const selNotif = document.getElementById('notif-empleado-destino');
    if (selTarea) {
        selTarea.innerHTML = '<option value="">Seleccionar empleado...</option>';
        empleados.forEach(e => {
            const id = e.idEmpleado || e.id;
            const nombre = `${e.nombreEmpleado || ''} ${e.apellidoEmpleado || ''}`.trim() || e.correoEmpleado || `Empleado #${id}`;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nombre;
            selTarea.appendChild(opt);
        });
    }
    if (selNotif) {
        selNotif.innerHTML = '<option value="todos">Todos los empleados</option>';
        empleados.forEach(e => {
            const id = e.idEmpleado || e.id;
            const nombre = `${e.nombreEmpleado || ''} ${e.apellidoEmpleado || ''}`.trim() || e.correoEmpleado || `Empleado #${id}`;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nombre;
            selNotif.appendChild(opt);
        });
    }
}

// ── Renderizado de Tabla con Búsqueda, Filtros y Paginación ───────────────────
async function renderizarTabla() {
    if (!tablaCuerpo) return;

    // 1. Filtrar lista
    const listaFiltrada = empleados.filter(e => {
        const nombreCompleto = `${e.nombreEmpleado || ''} ${e.apellidoEmpleado || ''}`.toLowerCase();
        const correo = (e.correoEmpleado || '').toLowerCase();
        const dui = (e.duiEmpleado || '').toLowerCase();
        const termino = busqueda.toLowerCase().trim();

        const coincideTexto = !termino || nombreCompleto.includes(termino) || correo.includes(termino) || dui.includes(termino);
        
        const isActivo = !e.fechaSalida;
        let coincideEstado = true;
        if (filtroEstado === 'on') coincideEstado = isActivo;
        if (filtroEstado === 'off') coincideEstado = !isActivo;

        return coincideTexto && coincideEstado;
    });

    // 2. Actualizar conteo total
    if (etiquetaTotal) {
        etiquetaTotal.textContent = `Empleados Totales: ${listaFiltrada.length}`;
    }

    // 3. Estado vacío
    if (listaFiltrada.length === 0) {
        tablaCuerpo.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 48px 16px; color: #94a3b8;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>No se encontraron empleados con los criterios aplicados</span>
                    </div>
                </td>
            </tr>
        `;
        renderizarPaginacion(0);
        return;
    }

    // 4. Paginación
    let totalPaginas;
    let itemsPagina = null;

    if (!busqueda.trim() && filtroEstado === 'all') {
        try {
            // paginacion desde la api
            const pagina = await getEmpleadosPaginado(paginaActual, itemsPorPagina);
            if (pagina.totalPaginas > 0 && paginaActual > pagina.totalPaginas) {
                paginaActual = pagina.totalPaginas;
                return renderizarTabla();
            }
            totalPaginas = pagina.totalPaginas;
            itemsPagina = pagina.contenido;
            if (etiquetaTotal) etiquetaTotal.textContent = `Empleados Totales: ${pagina.totalElementos}`;
        } catch (e) {
            console.warn('Paginación en la API no disponible, se pagina en el navegador:', e.message);
            itemsPagina = null;
        }
    }

    // con busqueda o filtros activos se pagina la lista filtrada
    if (!itemsPagina) {
        totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina);
        if (paginaActual > totalPaginas) paginaActual = totalPaginas || 1;
        const inicio = (paginaActual - 1) * itemsPorPagina;
        itemsPagina = listaFiltrada.slice(inicio, inicio + itemsPorPagina);
    }

    // 5. Renderizar filas
    tablaCuerpo.innerHTML = itemsPagina.map(emp => {
        const id = emp.idEmpleado || emp.id;
        const nombre = `${emp.nombreEmpleado || 'Sin nombre'} ${emp.apellidoEmpleado || ''}`.trim();
        const correo = emp.correoEmpleado || 'Sin correo';
        const dui = emp.duiEmpleado || 'N/A';
        const rolNombre = (emp.fkRol && (emp.fkRol.nombreRol || emp.fkRol.nombre)) || emp.rol || 'Vigilante';
        const foto = emp.fotoUrlEmpleado || window.AVATAR_DEFECTO;
        const isActivo = !emp.fechaSalida;

        return `
            <tr data-id="${escapeHtml(id)}">
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${escapeHtml(foto)}" alt="${escapeHtml(nombre)}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.onerror=null;this.src=window.AVATAR_DEFECTO">
                        <div>
                            <div style="font-weight:600; color:var(--text-primary, #ffffff);">${escapeHtml(nombre)}</div>
                            <div style="font-size:12px; color:#94a3b8;">DUI: ${escapeHtml(dui)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="color:#cbd5e1; font-size:13px;">${escapeHtml(correo)}</span>
                </td>
                <td>
                    <span class="pildora-rol ${rolNombre.toLowerCase() === 'administrador' ? 'rol-admin' : 'rol-vigilante'}" style="padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; background:#2473F5; color:#ffffff;">
                        ${escapeHtml(rolNombre)}
                    </span>
                </td>
                <td class="col-acciones">
                    <div style="display:inline-flex; gap:8px; align-items:center;">
                        <button type="button" class="btn-toggle-estado pildora-estado" data-id="${escapeHtml(id)}" data-activo="${escapeHtml(isActivo)}" title="Clic para alternar estado" style="padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; color:#ffffff; background:${isActivo ? '#2563eb' : '#64748b'}; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 2px 8px ${isActivo ? 'rgba(37, 99, 235, 0.4)' : 'rgba(0, 0, 0, 0.3)'};">
                            <span style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></span>
                            ${isActivo ? 'Activo' : 'Inactivo'}
                        </button>
                        <button type="button" class="btn-accion-editar" data-id="${escapeHtml(id)}" title="Editar empleado" style="background:#2473F5; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button type="button" class="btn-accion-eliminar" data-id="${escapeHtml(id)}" title="Eliminar empleado" style="background:#ef4444; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderizarPaginacion(totalPaginas);
    conectarEventosTabla();
}

function renderizarPaginacion(totalPaginas) {
    if (!paginacionContenedor) return;
    if (totalPaginas <= 1) {
        paginacionContenedor.innerHTML = '';
        return;
    }

    let botonesPaginas = '';
    for (let i = 1; i <= totalPaginas; i++) {
        const esActiva = i === paginaActual;
        botonesPaginas += `
            <button type="button" class="btn-pag-num ${esActiva ? 'activo' : ''}" data-pagina="${i}" style="
                min-width: 38px; height: 38px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
                border:none;
                background: ${esActiva ? 'linear-gradient(135deg, #2473F5, #1d4ed8)' : 'rgba(255,255,255,0.05)'};
                color: ${esActiva ? '#ffffff' : '#94a3b8'};
                
            ">${i}</button>
        `;
    }

    let html = `
        <div class="keeper-paginacion-wrap" style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:24px; padding:12px 0;">
            <button type="button" class="btn-pag-ant" ${paginaActual === 1 ? 'disabled' : ''} style="
                padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: ${paginaActual === 1 ? 'not-allowed' : 'pointer'};
                border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: ${paginaActual === 1 ? '#475569' : '#ffffff'};
                display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
            ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Anterior
            </button>
            <div style="display:flex; gap:6px;">
                ${botonesPaginas}
            </div>
            <button type="button" class="btn-pag-sig" ${paginaActual === totalPaginas ? 'disabled' : ''} style="
                padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: ${paginaActual === totalPaginas ? 'not-allowed' : 'pointer'};
                border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: ${paginaActual === totalPaginas ? '#475569' : '#ffffff'};
                display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
            ">
                Siguiente
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>
    `;
    paginacionContenedor.innerHTML = html;

    const btnAnt = paginacionContenedor.querySelector('.btn-pag-ant');
    const btnSig = paginacionContenedor.querySelector('.btn-pag-sig');
    if (btnAnt) btnAnt.onclick = () => { if (paginaActual > 1) { paginaActual--; renderizarTabla(); } };
    if (btnSig) btnSig.onclick = () => { if (paginaActual < totalPaginas) { paginaActual++; renderizarTabla(); } };
    paginacionContenedor.querySelectorAll('.btn-pag-num').forEach(btn => {
        btn.onclick = () => {
            const p = Number(btn.getAttribute('data-pagina'));
            if (p && p !== paginaActual) {
                paginaActual = p;
                renderizarTabla();
            }
        };
    });
}

// ── Eventos de Tabla (Editar, Eliminar, Toggle Estado) ─────────────────────────
function conectarEventosTabla() {
    // Editar
    document.querySelectorAll('.btn-accion-editar').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await abrirModalDetalle(id);
        };
    });

    // eliminar
    document.querySelectorAll('.btn-accion-eliminar').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await confirmarEliminacion(id);
        };
    });

    // Alternar Estado
    document.querySelectorAll('.btn-toggle-estado').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            const activo = btn.getAttribute('data-activo') === 'true';
            await alternarEstadoEmpleado(id, activo);
        };
    });
}

// ── Alternar Estado Activo / En Turno (Modal Centrado) ───────────────────────
async function alternarEstadoEmpleado(id, estaActivo) {
    const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(id));
    if (!emp) return;

    const nuevoEstado = estaActivo ? fechaLocalISO() : null;

    try {
        emp.fechaSalida = nuevoEstado;
        await actualizarEmpleado(id, emp);
        
        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: estaActivo ? 'Empleado inactivo' : 'Empleado activo',
                html: `<p style="font-size:14px; color:#cbd5e1;">El estado de <strong>${escapeHtml(emp.nombreEmpleado || '')} ${escapeHtml(emp.apellidoEmpleado || '')}</strong> fue actualizado a <span style="color:#ffffff; font-weight:700;">${estaActivo ? 'Inactivo' : 'Activo'}</span>.</p>`,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        renderizarTabla();
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error al cambiar estado',
                text: err.message,
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

// ── Confirmar y Eliminar Empleado ────────────────────────────────────────────
async function confirmarEliminacion(id) {
    const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(id));
    const nombre = emp ? `${emp.nombreEmpleado} ${emp.apellidoEmpleado}` : 'este empleado';

    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Eliminar empleado?',
            text: `Se eliminarán los datos de ${escapeHtml(nombre)}. Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;
    }

    try {
        await deleteEmpleado(id);
        empleados = empleados.filter(e => String(e.idEmpleado || e.id) !== String(id));
        if (window.Swal) {
            Swal.fire('Eliminado', 'El empleado ha sido eliminado correctamente.', 'success');
        }
        renderizarTabla();
    } catch (err) {
        if (window.Swal) {
            Swal.fire('Error', 'No se pudo eliminar el empleado: ' + err.message, 'error');
        }
    }
}

// ── Búsqueda y Filtros ───────────────────────────────────────────────────────
function configurarBusquedaYFiltros() {
    let timeoutBusqueda = null;
    if (entradaBusqueda) {
        entradaBusqueda.addEventListener('input', (e) => {
            clearTimeout(timeoutBusqueda);
            timeoutBusqueda = setTimeout(() => {
                busqueda = e.target.value;
                paginaActual = 1;
                renderizarTabla();
            }, 250);
        });
    }

    // Selector Desplegable de Estado
    const filtroContenedor = document.getElementById('filtro-estado-desplegable');
    const filtroActivador = document.getElementById('filtro-estado-activador');
    const filtroPanel = document.getElementById('filtro-estado-panel');
    const filtroTexto = document.getElementById('filtro-estado-activador-texto');

    if (filtroActivador && filtroPanel) {
        filtroActivador.onclick = (e) => {
            e.stopPropagation();
            const estaAbierto = filtroPanel.classList.contains('abierto') || filtroPanel.classList.contains('activo');
            if (estaAbierto) {
                if (filtroContenedor) filtroContenedor.classList.remove('abierto');
                filtroPanel.classList.remove('abierto', 'activo');
            } else {
                if (filtroContenedor) filtroContenedor.classList.add('abierto');
                filtroPanel.classList.add('abierto', 'activo');
            }
        };

        filtroPanel.querySelectorAll('.selector-opcion').forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                filtroPanel.querySelectorAll('.selector-opcion').forEach(o => o.classList.remove('seleccionado'));
                opt.classList.add('seleccionado');
                filtroEstado = opt.getAttribute('data-value') || 'all';
                if (filtroTexto) filtroTexto.textContent = opt.getAttribute('data-label') || 'Estado: Todos';
                if (filtroContenedor) filtroContenedor.classList.remove('abierto');
                filtroPanel.classList.remove('abierto', 'activo');
                paginaActual = 1;
                renderizarTabla();
            };
        });

        document.addEventListener('click', (e) => {
            if (!filtroPanel.contains(e.target) && !filtroActivador.contains(e.target)) {
                if (filtroContenedor) filtroContenedor.classList.remove('abierto');
                filtroPanel.classList.remove('abierto', 'activo');
            }
        });
    }

}

// ── Configuración de Modales ─────────────────────────────────────────────────
function configurarModales() {
    // Abrir modal agregar
    if (btnAbrirAgregar) {
        btnAbrirAgregar.onclick = () => {
            if (formAgregar) formAgregar.reset();
            const fotoPrevia = document.getElementById('agregar-foto-vista-previa-img');
            if (fotoPrevia) { fotoPrevia.src = '../img/logo-Global.png'; fotoPrevia.style.display = 'none'; }
            panelAgregar.classList.add('activo');
        };
    }

    // Cerrar modal agregar
    if (btnCerrarAgregar) btnCerrarAgregar.onclick = () => panelAgregar.classList.remove('activo');
    if (btnCancelarAgregar) btnCancelarAgregar.onclick = () => panelAgregar.classList.remove('activo');

    // Cerrar modal detalle
    if (btnCerrarDetalle) btnCerrarDetalle.onclick = () => panelDetalle.classList.remove('activo');
    if (btnCancelarDetalle) btnCancelarDetalle.onclick = () => panelDetalle.classList.remove('activo');

    // Manejar submit agregar
    if (formAgregar) {
        formAgregar.onsubmit = async (e) => {
            e.preventDefault();
            await guardarNuevoEmpleado();
        };
    }

    // Manejar submit editar
    if (formDetalle) {
        formDetalle.onsubmit = async (e) => {
            e.preventDefault();
            await guardarEdicionEmpleado();
        };
    }

    // Modal Notificar
    if (btnAbrirNotificar) {
        btnAbrirNotificar.onclick = () => {
            poblarSelectsEmpleados();
            panelNotificar.classList.add('activo');
        };
    }
    if (btnCerrarNotificar) btnCerrarNotificar.onclick = () => panelNotificar.classList.remove('activo');
    if (btnCancelarNotificar) btnCancelarNotificar.onclick = () => panelNotificar.classList.remove('activo');
    if (formNotificar) {
        formNotificar.onsubmit = async (e) => {
            e.preventDefault();
            await enviarNotificacionEmpleado();
        };
    }

    // Modal Asignar Tarea
    if (btnAbrirAsignarTarea) {
        btnAbrirAsignarTarea.onclick = () => {
            poblarSelectsEmpleados();
            panelAsignarTarea.classList.add('activo');
        };
    }
    if (btnCerrarAsignarTarea) btnCerrarAsignarTarea.onclick = () => panelAsignarTarea.classList.remove('activo');
    if (btnCancelarAsignarTarea) btnCancelarAsignarTarea.onclick = () => panelAsignarTarea.classList.remove('activo');
    if (formAsignarTarea) {
        formAsignarTarea.onsubmit = async (e) => {
            e.preventDefault();
            await guardarNuevaTarea();
        };
    }
}

// fotos de empleado
function fotoSeleccionadaValida(inputId) {
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file || !window.FotosService) return true;
    try {
        window.FotosService.validarImagen(file);
        return true;
    } catch (e) {
        if (window.Swal) Swal.fire('Foto no válida', e.message, 'warning');
        return false;
    }
}

async function subirFotoSiHay(inputId, idEmpleado) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file || !window.FotosService) return '';
    try {
        await window.FotosService.subirFotoEmpleado(idEmpleado, file);
        input.value = '';
        return '';
    } catch (e) {
        return ' Pero la foto no se pudo subir: ' + e.message;
    }
}

function configurarVistaPreviaFoto(inputId, imgId) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    if (!input || !img) return;
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            window.FotosService.validarImagen(file);
            img.src = await window.FotosService.leerVistaPrevia(file);
            img.style.display = 'block';
            const icono = img.parentElement?.querySelector('.icono-marcador-foto');
            if (icono) icono.style.display = 'none';
        } catch (e) {
            input.value = '';
            if (window.Swal) Swal.fire('Foto no válida', e.message, 'warning');
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    configurarVistaPreviaFoto('agregar-foto', 'agregar-foto-vista-previa-img');
    configurarVistaPreviaFoto('detalle-foto', 'detalle-foto-vista-previa-img');
});

// ── Guardar Nuevo Empleado ───────────────────────────────────────────────────
async function guardarNuevoEmpleado() {
    const nombre = document.getElementById('agregar-nombre')?.value.trim();
    const apellido = document.getElementById('agregar-apellido')?.value.trim();
    const correo = document.getElementById('agregar-correo')?.value.trim();
    const password = (document.getElementById('agregar-contrasena') || document.getElementById('agregar-Contraseña'))?.value.trim();
    const dui = document.getElementById('agregar-dui')?.value.trim();
    const telefono = (document.getElementById('agregar-telefono') || document.getElementById('agregar-Teléfono'))?.value.trim();
    const fechaNac = document.getElementById('agregar-fecha-nacimiento')?.value;
    const idRol = document.getElementById('agregar-rol')?.value;

    if (!nombre || !apellido || !correo || !password || !dui || !telefono || !fechaNac || !idRol) {
        if (window.Swal) Swal.fire('Campos incompletos', 'Por favor llena todos los campos obligatorios (*)', 'warning');
        return;
    }

    if (!fotoSeleccionadaValida('agregar-foto')) return;

    const rolObj = roles.find(r => String(r.idRol || r.id) === String(idRol)) || { idRol: Number(idRol), nombreRol: 'Vigilante' };

    const nuevo = {
        nombreEmpleado: nombre,
        apellidoEmpleado: apellido,
        correoEmpleado: correo,
        passwordEmpleado: password,
        duiEmpleado: dui,
        telefonoEmpleado: telefono,
        fechaNacimientoEmpleado: fechaNac,
        fechaInicioContrato: fechaLocalISO(),
        fotoUrlEmpleado: null,
        fkRol: { idRol: Number(idRol), nombreRol: rolObj.nombreRol || 'Vigilante' },
        idRol: Number(idRol)
    };

    try {
        if (window.Swal) Swal.showLoading();
        const creado = await createEmpleado(nuevo);
        const avisoFoto = await subirFotoSiHay('agregar-foto', creado?.idEmpleado || creado?.id);
        panelAgregar.classList.remove('activo');
        if (window.Swal) Swal.fire(avisoFoto ? 'Guardado con aviso' : '¡Éxito!', 'Empleado registrado correctamente.' + avisoFoto, avisoFoto ? 'warning' : 'success');
        await cargarEmpleados();
        poblarSelectsCasetas();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo registrar el empleado: ' + err.message, 'error');
    }
}

// ── Abrir y Editar Empleado ──────────────────────────────────────────────────
async function abrirModalDetalle(id) {
    empleadoSeleccionado = empleados.find(e => String(e.idEmpleado || e.id) === String(id));
    if (!empleadoSeleccionado) {
        try {
            empleadoSeleccionado = await getEmpleado(id);
        } catch (e) {
            return;
        }
    }
    if (!empleadoSeleccionado) return;

    // Habilitar campos
    document.querySelectorAll('#form-detalle input, #form-detalle select').forEach(el => el.removeAttribute('disabled'));

    const elNombre = document.getElementById('detalle-nombre');
    const elApellido = document.getElementById('detalle-apellido');
    const elCorreo = document.getElementById('detalle-correo');
    const elDui = document.getElementById('detalle-dui');
    const elTelefono = document.getElementById('detalle-telefono') || document.getElementById('detalle-Teléfono');
    const elFechaNac = document.getElementById('detalle-fecha-nacimiento');
    const elRol = document.getElementById('detalle-rol');
    const elPass = document.getElementById('detalle-contrasena') || document.getElementById('detalle-Contraseña');

    if (elNombre) elNombre.value = empleadoSeleccionado.nombreEmpleado || '';
    if (elApellido) elApellido.value = empleadoSeleccionado.apellidoEmpleado || '';
    if (elCorreo) elCorreo.value = empleadoSeleccionado.correoEmpleado || '';
    if (elDui) elDui.value = empleadoSeleccionado.duiEmpleado || '';
    if (elTelefono) elTelefono.value = empleadoSeleccionado.telefonoEmpleado || '';
    if (elFechaNac) elFechaNac.value = empleadoSeleccionado.fechaNacimientoEmpleado || '';
    
    const idRol = (empleadoSeleccionado.fkRol && (empleadoSeleccionado.fkRol.idRol || empleadoSeleccionado.fkRol.id)) || empleadoSeleccionado.idRol || 2;
    if (elRol) elRol.value = idRol;
    if (elPass) elPass.value = '';

    const fotoImg = document.getElementById('detalle-foto-vista-previa-img');
    if (fotoImg) {
        fotoImg.src = empleadoSeleccionado.fotoUrlEmpleado || window.AVATAR_DEFECTO;
    }

    panelDetalle.classList.add('activo');
}

async function guardarEdicionEmpleado() {
    if (!empleadoSeleccionado) return;
    const id = empleadoSeleccionado.idEmpleado || empleadoSeleccionado.id;

    const nombre = document.getElementById('detalle-nombre')?.value.trim();
    const apellido = document.getElementById('detalle-apellido')?.value.trim();
    const correo = document.getElementById('detalle-correo')?.value.trim();
    const password = (document.getElementById('detalle-contrasena') || document.getElementById('detalle-Contraseña'))?.value.trim();
    const dui = document.getElementById('detalle-dui')?.value.trim();
    const telefono = (document.getElementById('detalle-telefono') || document.getElementById('detalle-Teléfono'))?.value.trim();
    const fechaNac = document.getElementById('detalle-fecha-nacimiento')?.value;
    const idRol = document.getElementById('detalle-rol')?.value;

    if (!fotoSeleccionadaValida('detalle-foto')) return;

    const rolObj = roles.find(r => String(r.idRol || r.id) === String(idRol)) || { idRol: Number(idRol), nombreRol: 'Vigilante' };

    const payload = {
        idEmpleado: id,
        nombreEmpleado: nombre,
        apellidoEmpleado: apellido,
        correoEmpleado: correo,
        passwordEmpleado: password || null,
        duiEmpleado: dui,
        telefonoEmpleado: telefono,
        fechaNacimientoEmpleado: fechaNac,
        fechaInicioContrato: empleadoSeleccionado.fechaInicioContrato || fechaLocalISO(),
        fechaSalida: empleadoSeleccionado.fechaSalida || null,
        fotoUrlEmpleado: empleadoSeleccionado.fotoUrlEmpleado,
        fkRol: { idRol: Number(idRol), nombreRol: rolObj.nombreRol || 'Vigilante' },
        idRol: Number(idRol)
    };

    try {
        if (window.Swal) Swal.showLoading();
        await actualizarEmpleado(id, payload);
        const avisoFoto = await subirFotoSiHay('detalle-foto', id);
        panelDetalle.classList.remove('activo');
        if (window.Swal) Swal.fire(avisoFoto ? 'Actualizado con aviso' : '¡Actualizado!', 'Empleado actualizado correctamente.' + avisoFoto, avisoFoto ? 'warning' : 'success');
        await cargarEmpleados();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo actualizar: ' + err.message, 'error');
    }
}

// ── Asignar Tarea ────────────────────────────────────────────────────────────
async function guardarNuevaTarea() {
    const fkEmpleado = document.getElementById('tarea-empleado-destino')?.value;
    const Título = (document.getElementById('tarea-titulo') || document.getElementById('tarea-Título'))?.value.trim();
    const Descripción = (document.getElementById('tarea-descripcion') || document.getElementById('tarea-Descripción'))?.value.trim() || '';
    const fechaLimite = (document.getElementById('tarea-fecha-limite') || document.getElementById('tarea-fecha-Límite'))?.value || null;
    const estado = document.getElementById('tarea-estado')?.value || 'En progreso';

    if (!fkEmpleado || !Título) {
        if (window.Swal) Swal.fire('Atención', 'Selecciona un empleado y asigna un título.', 'warning');
        return;
    }

    try {
        if (window.Swal) Swal.showLoading();
        await createTarea({
            fkEmpleado: fkEmpleado,
            Título: Título,
            Descripción: Descripción,
            fechaAsignacion: fechaLocalISO(),
            fechaLimite: fechaLimite || null,
            estado: estado
        });
        if (formAsignarTarea) formAsignarTarea.reset();
        panelAsignarTarea.classList.remove('activo');
        if (window.Swal) Swal.fire('¡Tarea asignada!', 'La tarea fue asignada con éxito al empleado.', 'success');
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo asignar la tarea: ' + err.message, 'error');
    }
}

// ── Enviar Notificación ──────────────────────────────────────────────────────
async function enviarNotificacionEmpleado() {
    const destino = document.getElementById('notif-empleado-destino')?.value;
    const Título = (document.getElementById('notif-empleado-titulo') || document.getElementById('notif-empleado-Título'))?.value.trim();
    const mensaje = document.getElementById('notif-empleado-mensaje')?.value.trim();

    if (!mensaje) {
        if (window.Swal) Swal.fire('Atención', 'Escribe el mensaje de la notificación.', 'warning');
        return;
    }

    const textoCompleto = Título ? `${Título}: ${mensaje}` : mensaje;

    try {
        if (window.Swal) Swal.showLoading();
        if (destino === 'todos') {
            await Promise.all(empleados.map(e => {
                const idEmp = e.idEmpleado || e.id;
                return createNotificacion({
                    fkEmpleado: idEmp,
                    mensajeNotificacion: textoCompleto,
                    fechaCreacionNotificacion: fechaHoraLocalISO(),
                    leidaNotificacion: 'n'
                });
            }));
        } else {
            await createNotificacion({
                fkEmpleado: destino,
                mensajeNotificacion: textoCompleto,
                fechaCreacionNotificacion: fechaHoraLocalISO(),
                leidaNotificacion: 'n'
            });
        }
        if (formNotificar) formNotificar.reset();
        panelNotificar.classList.remove('activo');
        if (window.Swal) Swal.fire('Enviada', 'Notificación emitida exitosamente.', 'success');
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo enviar la notificación: ' + err.message, 'error');
    }
}
