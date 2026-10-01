/** turnos */

import {
    getTurnos,
    getTurno,
    createTurno,
    actualizarTurno,
    deleteTurno,
    getDetalleTurnos,
    createDetalleTurno,
    deleteDetalleTurno,
    actualizarDetalleTurno
} from '../servicios/turnosService.js';

import { getEmpleados } from '../servicios/empleadosService.js';
import { getLugaresTrabajo } from '../servicios/lugarTrabajoService.js';

// ── Estado Local ─────────────────────────────────────────────────────────────
let turnos = [];
let detallesTurnos = [];
let empleados = [];
let casetas = [];
let busqueda = '';
let filtroEstado = 'all';
let paginaActual = 1;
const itemsPorPagina = 6;
let turnosDesplegados = new Set();
let turnoSeleccionado = null;
let idTurnoModalAsignacion = null;
let nombreTurnoModalAsignacion = '';

// ── Referencias DOM ──────────────────────────────────────────────────────────
const tablaCuerpo = document.getElementById('tabla-cuerpo');
const etiquetaTotal = document.getElementById('etiqueta-total');
const entradaBusqueda = document.getElementById('entrada-busqueda');
const paginacionContenedor = document.getElementById('paginacion-turnos');

// Modales
const panelAgregar = document.getElementById('panel-agregar-turno');
const formAgregar = document.getElementById('form-agregar-turno');
const panelTitulo = document.getElementById('panel-turno-titulo') || document.getElementById('panel-turno-Título');
const btnAbrirAgregar = document.getElementById('btn-abrir-agregar');
const btnCerrarAgregar = document.getElementById('btn-cerrar-agregar-turno');
const btnCancelarAgregar = document.getElementById('btn-cancelar-agregar-turno');

const panelAsignar = document.getElementById('panel-asignar-guardia');
const formAsignar = document.getElementById('form-asignar-guardia');
const btnCerrarAsignar = document.getElementById('btn-cerrar-asignar-guardia');
const btnCancelarAsignar = document.getElementById('btn-cancelar-asignar-guardia');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista();
    }

    await Promise.all([
        cargarEmpleadosYCasetas(),
        cargarTurnos()
    ]);

    configurarBusquedaYFiltros();
    configurarModales();
    configurarPreajustesHora();
});

// ── Carga de Datos ───────────────────────────────────────────────────────────
async function cargarEmpleadosYCasetas() {
    try {
        const [resEmp, resCas] = await Promise.all([
            getEmpleados().catch(() => []),
            getLugaresTrabajo().catch(() => [])
        ]);
        empleados = Array.isArray(resEmp) ? resEmp : (resEmp?.data || []);
        casetas = Array.isArray(resCas) ? resCas : (resCas?.data || []);
    } catch (e) {
        empleados = [];
        casetas = [];
    }
    poblarSelectsAsignacion();
}

async function cargarTurnos() {
    if (tablaCuerpo) {
        tablaCuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Cargando turnos...</td></tr>`;
    }
    try {
        const [resTurnos, resDetalles] = await Promise.all([
            getTurnos().catch(() => []),
            getDetalleTurnos().catch(() => [])
        ]);
        turnos = Array.isArray(resTurnos) ? resTurnos : (resTurnos?.data || []);
        detallesTurnos = Array.isArray(resDetalles) ? resDetalles : (resDetalles?.data || []);
    } catch (e) {
        turnos = [];
        detallesTurnos = [];
        console.warn('Error al cargar turnos:', e.message);
    }
    renderizarTabla();
}

function poblarSelectsAsignacion() {
    const selEmp = document.getElementById('asig-fk-empleado');
    const selCas = document.getElementById('asig-fk-caseta');

    if (selEmp) {
        selEmp.innerHTML = '<option value="">Seleccionar guardia...</option>';
        empleados.forEach(e => {
            const id = e.idEmpleado || e.id;
            const nombre = `${e.nombreEmpleado || ''} ${e.apellidoEmpleado || ''}`.trim() || e.correoEmpleado;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${nombre} (DUI: ${e.duiEmpleado || 'N/A'})`;
            selEmp.appendChild(opt);
        });
    }

    if (selCas) {
        selCas.innerHTML = '<option value="">Seleccionar caseta...</option>';
        casetas.forEach(c => {
            const id = c.idLugarTrabajo || c.idCasetas || c.id;
            const nombre = c.nombreLugar || c.nombreCaseta || `Caseta #${id}`;
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nombre;
            selCas.appendChild(opt);
        });
    }
}

// ── Renderizado de Tabla ─────────────────────────────────────────────────────
function renderizarTabla() {
    if (!tablaCuerpo) return;

    const listaFiltrada = turnos.filter(t => {
        const nom = (t.nombreTurno || t.nombre || '').toLowerCase();
        const termino = busqueda.toLowerCase().trim();

        // Buscar guardias asignados a este turno
        const idT = String(t.idTurno || t.id);
        const asignaciones = detallesTurnos.filter(d => String(d.fkTurno || d.idTurno) === idT);
        const nombresGuardias = asignaciones.map(d => {
            const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(d.fkEmpleado || d.idEmpleado));
            return emp ? `${emp.nombreEmpleado} ${emp.apellidoEmpleado}`.toLowerCase() : '';
        }).join(' ');

        const coincideTexto = !termino || nom.includes(termino) || nombresGuardias.includes(termino);

        // Filtro por Estado
        let coincideEstado = true;
        if (filtroEstado !== 'all') {
            const tieneGuardiasActivos = asignaciones.some(d => (d.estadoturno || d.estadoTurno || '').toLowerCase() === 's');
            let estadoCalculado = 'programado';
            if (tieneGuardiasActivos) {
                estadoCalculado = 'en-curso';
            } else if (asignaciones.length > 0 && !tieneGuardiasActivos) {
                estadoCalculado = 'finalizado';
            } else {
                estadoCalculado = 'programado';
            }
            coincideEstado = (filtroEstado === estadoCalculado);
        }

        return coincideTexto && coincideEstado;
    });

    if (etiquetaTotal) {
        etiquetaTotal.textContent = `Turnos Totales: ${listaFiltrada.length}`;
    }

    if (listaFiltrada.length === 0) {
        const NOMBRE_ESTADO = { programado: 'Programado', 'en-curso': 'En curso', finalizado: 'Finalizado' };
        let mensajeVacio = 'Aún no hay turnos configurados. Usa “Agregar turno” para crear el primero.';
        if (turnos.length && filtroEstado !== 'all') mensajeVacio = `No hay turnos en estado “${NOMBRE_ESTADO[filtroEstado] || filtroEstado}”${busqueda.trim() ? ' que coincidan con la búsqueda' : ''}.`;
        else if (turnos.length && busqueda.trim()) mensajeVacio = 'Ningún turno coincide con la búsqueda.';
        tablaCuerpo.innerHTML = `
            <tr class="fila-turno-vacia">
                <td colspan="5">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>${escapeHtml(mensajeVacio)}</span>
                    </div>
                </td>
            </tr>
        `;
        renderizarPaginacion(0);
        return;
    }

    const totalPaginas = Math.ceil(listaFiltrada.length / itemsPorPagina);
    if (paginaActual > totalPaginas) paginaActual = totalPaginas || 1;
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const itemsPagina = listaFiltrada.slice(inicio, fin);

    tablaCuerpo.innerHTML = itemsPagina.map(t => {
        const id = t.idTurno || t.id;
        const nombre = t.nombreTurno || t.nombre || `Turno #${id}`;
        const horaInicio = t.horaInicio || '06:00';
        const horaFin = t.horaSalida || '18:00';
        const diaInicio = t.diaInicio || 'Lunes';
        const diaFin = t.diaTerminar || t.diaFin || 'Viernes';

        // Guardias asignados
        const asignaciones = detallesTurnos.filter(d => String(d.fkTurno || d.idTurno) === String(id));
        
        let filasSubtablaGuardias = '';
        if (asignaciones.length === 0) {
            filasSubtablaGuardias = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 12px; color: #64748b; font-size: 12px;">
                        Sin personal de seguridad asignado a este turno. Haz clic en <strong style="color:#60a5fa;">+ Asignar Personal</strong> para agregar guardias.
                    </td>
                </tr>
            `;
        } else {
            filasSubtablaGuardias = asignaciones.map(d => {
                const idDetalle = d.idDetalleTurno || d.id;
                const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(d.fkEmpleado || d.idEmpleado));
                const cas = casetas.find(c => String(c.idLugarTrabajo || c.idCasetas || c.id) === String(d.fkLugarCaseta || d.fkLugarTrabajo || d.fkLugar));
                const nomEmp = emp ? `${emp.nombreEmpleado} ${emp.apellidoEmpleado}` : 'Guardia de Seguridad';
                const nomCas = cas ? (cas.nombreLugar || cas.nombreCaseta) : 'Caseta de Seguridad';
                const estaActivo = (d.estadoturno || d.estadoTurno || 's').toLowerCase() === 's';

                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 8px 12px; color: #ffffff; font-weight: 500;">
                            <div style="display:inline-flex; align-items:center; gap:8px;">
                                <div style="width:24px; height:24px; border-radius:50%; background:#2473F5; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">
                                    ${escapeHtml(nomEmp.charAt(0))}
                                </div>
                                <span>${escapeHtml(nomEmp)}</span>
                            </div>
                        </td>
                        <td style="padding: 8px 12px; color: #94a3b8; font-size: 12px;">
                            <span style="display:inline-flex; align-items:center; gap:5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2473F5" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                ${escapeHtml(nomCas)}
                            </span>
                        </td>
                        <td style="padding: 8px 12px;">
                            <button type="button" class="btn-toggle-detalle-turno" data-id="${idDetalle}" data-activo="${estaActivo}" title="Alternar estado de servicio" style="background:${estaActivo ? '#10b981' : '#ef4444'}; border:none; color:#ffffff; border-radius:12px; padding:3px 10px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                                <span style="width:6px; height:6px; border-radius:50%; background:currentColor; display:inline-block;"></span>
                                <span>${estaActivo ? 'En Servicio' : 'Fuera de Servicio'}</span>
                            </button>
                        </td>
                        <td style="padding: 8px 12px; text-align: right;">
                            <button type="button" class="btn-quitar-asignacion" data-id="${idDetalle}" title="Quitar guardia de este turno" style="background:#ef4444; border:none; color:#ffffff; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>Quitar</span>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const estaDesplegado = turnosDesplegados.has(String(id));

        return `
            <tr data-id="${id}" style="border-bottom:none;">
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:#2473F5; display:inline-block;"></span>
                        <strong style="color:var(--text-primary, #ffffff); font-size:14px;">${escapeHtml(nombre)}</strong>
                    </div>
                </td>
                <td><span style="color:#cbd5e1; font-size:13px; font-weight:500;">${horaInicio} - ${horaFin}</span></td>
                <td><span style="color:#cbd5e1; font-size:13px;">${diaInicio} a ${diaFin}</span></td>
                <td>
                    <button type="button" class="btn-toggle-subtabla" data-turno="${id}" title="${estaDesplegado ? 'Ocultar guardias' : 'Ver guardias asignados'}" style="cursor:pointer; display:inline-flex; align-items:center; gap:8px; background:${asignaciones.length > 0 ? '#2473F5' : '#1a2238'}; color:${asignaciones.length > 0 ? '#ffffff' : '#94a3b8'}; border:none; padding:5px 12px; border-radius:12px; font-size:12px; font-weight:600; transition:all 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>${asignaciones.length} ${asignaciones.length === 1 ? 'Guardia' : 'Guardias'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform: ${estaDesplegado ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                </td>
                <td class="col-acciones">
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn-asignar-guardia" data-id="${id}" data-nombre="${escapeHtml(nombre)}" title="Asignar Personal" style="background:#1146D0; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; ">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Asignar Personal</span>
                        </button>
                        <button type="button" class="btn-editar-turno" data-id="${id}" title="Editar Turno" style="background:#2473F5; border:none; color:#ffffff; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            <span>Editar</span>
                        </button>
                        <button type="button" class="btn-eliminar-turno" data-id="${id}" title="Eliminar Turno" style="background:#ef4444; border:none; color:#ffffff; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
            <tr class="fila-subtabla-guardias" data-turno="${id}" style="display: ${estaDesplegado ? 'table-row' : 'none'};">
                <td colspan="5" style="padding: 0 16px 14px 16px; border-bottom: 2px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.12);">
                    <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden;">
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">
                            <span style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">
                                Sub-tabla: Personal de Seguridad Asignado
                            </span>
                            <span style="font-size:11px; color:#64748b;">
                                ${asignaciones.length} asignación(es) activa(s)
                            </span>
                        </div>
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="color:#64748b; font-size:11px; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2);">
                                    <th style="padding:6px 12px; font-weight:600;">Guardia</th>
                                    <th style="padding:6px 12px; font-weight:600;">Caseta Asignada</th>
                                    <th style="padding:6px 12px; font-weight:600;">Estado de Servicio</th>
                                    <th style="padding:6px 12px; font-weight:600; text-align:right;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasSubtablaGuardias}
                            </tbody>
                        </table>
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

function conectarEventosTabla() {
    // Alternar subtabla desplegable de guardias
    document.querySelectorAll('.btn-toggle-subtabla').forEach(btn => {
        btn.onclick = () => {
            const idTurno = String(btn.getAttribute('data-turno'));
            if (turnosDesplegados.has(idTurno)) {
                turnosDesplegados.delete(idTurno);
            } else {
                turnosDesplegados.add(idTurno);
            }
            renderizarTabla();
        };
    });
    // Asignar Guardia
    document.querySelectorAll('.btn-asignar-guardia').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            const nom = btn.getAttribute('data-nombre');
            abrirModalAsignarPersonal(id, nom);
        };
    });

    // Editar Turno
    document.querySelectorAll('.btn-editar-turno').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await abrirModalEditarTurno(id);
        };
    });

    // Eliminar Turno
    document.querySelectorAll('.btn-eliminar-turno').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await confirmarEliminarTurno(id);
        };
    });

    // Quitar Guardia asignado
    document.querySelectorAll('.btn-quitar-asignacion').forEach(btn => {
        btn.onclick = async () => {
            const idDetalle = btn.getAttribute('data-id');
            await quitarAsignacion(idDetalle);
        };
    });

    // Toggle Estado Turno Guardia
    document.querySelectorAll('.btn-toggle-detalle-turno').forEach(btn => {
        btn.onclick = async () => {
            const idDetalle = btn.getAttribute('data-id');
            const activo = btn.getAttribute('data-activo') === 'true';
            await alternarDetalleTurno(idDetalle, activo);
        };
    });
}

// ── Búsqueda y Filtros ───────────────────────────────────────────────────────
function configurarBusquedaYFiltros() {
    let timeout = null;
    if (entradaBusqueda) {
        entradaBusqueda.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
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

// ── Modales ──────────────────────────────────────────────────────────────────
function configurarModales() {
    if (btnAbrirAgregar) {
        btnAbrirAgregar.onclick = () => {
            turnoSeleccionado = null;
            if (formAgregar) formAgregar.reset();
            if (panelTitulo) panelTitulo.textContent = 'Crear nuevo turno maestro';
            panelAgregar.classList.add('activo');
        };
    }

    if (btnCerrarAgregar) btnCerrarAgregar.onclick = () => panelAgregar.classList.remove('activo');
    if (btnCancelarAgregar) btnCancelarAgregar.onclick = () => panelAgregar.classList.remove('activo');

    if (btnCerrarAsignar) btnCerrarAsignar.onclick = () => panelAsignar.classList.remove('activo');
    if (btnCancelarAsignar) btnCancelarAsignar.onclick = () => panelAsignar.classList.remove('activo');

    if (formAgregar) {
        formAgregar.onsubmit = async (e) => {
            e.preventDefault();
            await guardarTurno();
        };
    }

    if (formAsignar) {
        formAsignar.onsubmit = async (e) => {
            e.preventDefault();
            await guardarAsignacionGuardia();
        };
    }

    const btnSelectTodos = document.getElementById('btn-seleccionar-todos-guardias');
    if (btnSelectTodos) {
        btnSelectTodos.onclick = () => {
            const chks = document.querySelectorAll('.chk-guardia-disponible');
            if (chks.length === 0) return;
            const todosMarcados = Array.from(chks).every(c => c.checked);
            chks.forEach(c => c.checked = !todosMarcados);
            btnSelectTodos.textContent = todosMarcados ? 'Seleccionar todos disponibles' : 'Deseleccionar todos';
        };
    }

    const inputBuscarModal = document.getElementById('input-buscar-guardias-modal');
    if (inputBuscarModal) {
        inputBuscarModal.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.fila-guardia-modal').forEach(fila => {
                const txt = fila.getAttribute('data-texto') || '';
                fila.style.display = (!val || txt.includes(val)) ? 'flex' : 'none';
            });
        });
    }
}

// ── Crear / Editar Turno ─────────────────────────────────────────────────────
async function guardarTurno() {
    const nombre = document.getElementById('turno-nombre')?.value.trim();
    const horaInicio = document.getElementById('turno-hora-inicio')?.value;
    const horaFin = document.getElementById('turno-hora-salida')?.value;
    const diaInicio = document.getElementById('turno-dia-inicio')?.value;
    const diaFin = document.getElementById('turno-dia-salida')?.value;

    if (!nombre || !horaInicio || !horaFin || !diaInicio || !diaFin) {
        if (window.Swal) Swal.fire('Campos requeridos', 'Por favor llena todos los campos del turno.', 'warning');
        return;
    }

    const payload = {
        nombreTurno: nombre,
        horaInicio: horaInicio,
        horaSalida: horaFin,
        diaInicio: diaInicio,
        diaTerminar: diaFin
    };

    try {
        if (window.Swal) Swal.showLoading();
        if (turnoSeleccionado) {
            const id = turnoSeleccionado.idTurno || turnoSeleccionado.id;
            await actualizarTurno(id, { idTurno: id, ...payload });
        } else {
            await createTurno(payload);
        }
        panelAgregar.classList.remove('activo');
        if (window.Swal) Swal.fire('¡Éxito!', 'Turno guardado correctamente.', 'success');
        await cargarTurnos();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo guardar el turno: ' + err.message, 'error');
    }
}

async function abrirModalEditarTurno(id) {
    turnoSeleccionado = turnos.find(t => String(t.idTurno || t.id) === String(id));
    if (!turnoSeleccionado) return;

    document.getElementById('turno-nombre').value = turnoSeleccionado.nombreTurno || turnoSeleccionado.nombre || '';
    document.getElementById('turno-hora-inicio').value = turnoSeleccionado.horaInicio || '06:00';
    document.getElementById('turno-hora-salida').value = turnoSeleccionado.horaSalida || '18:00';
    document.getElementById('texto-hora-inicio').textContent = textoHora(turnoSeleccionado.horaInicio || '06:00');
    document.getElementById('texto-hora-salida').textContent = textoHora(turnoSeleccionado.horaSalida || '18:00');
    document.getElementById('turno-dia-inicio').value = turnoSeleccionado.diaInicio || 'Lunes';
    document.getElementById('turno-dia-salida').value = turnoSeleccionado.diaTerminar || turnoSeleccionado.diaFin || 'Viernes';

    if (panelTitulo) panelTitulo.textContent = 'Editar turno maestro';
    panelAgregar.classList.add('activo');
}

async function confirmarEliminarTurno(id) {
    const t = turnos.find(item => String(item.idTurno || item.id) === String(id));
    const nombre = t ? (t.nombreTurno || t.nombre) : 'este turno';

    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Eliminar turno?',
            text: `Se eliminará el turno "${nombre}" y sus asignaciones.`,
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
        await deleteTurno(id);
        if (window.Swal) Swal.fire('Eliminado', 'El turno ha sido eliminado.', 'success');
        await cargarTurnos();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo eliminar el turno: ' + err.message, 'error');
    }
}

// ── Asignación de Guardias (Lote y Validación de Activos) ────────────────────
function abrirModalAsignarPersonal(id, nom) {
    idTurnoModalAsignacion = id;
    nombreTurnoModalAsignacion = nom || `Turno #${id}`;

    const inputId = document.getElementById('asig-fk-turno');
    const inputNom = document.getElementById('asig-turno-nombre');
    const inputBuscar = document.getElementById('input-buscar-guardias-modal');
    if (inputId) inputId.value = id;
    if (inputNom) inputNom.value = nombreTurnoModalAsignacion;
    if (inputBuscar) inputBuscar.value = '';

    // Poblar casetas
    const selCas = document.getElementById('asig-fk-caseta');
    if (selCas) {
        selCas.innerHTML = '<option value="">Seleccionar caseta...</option>';
        casetas.forEach(c => {
            const idC = c.idLugarTrabajo || c.idCasetas || c.id;
            const nomC = c.nombreLugar || c.nombreCaseta || `Caseta #${idC}`;
            const opt = document.createElement('option');
            opt.value = idC;
            opt.textContent = nomC;
            selCas.appendChild(opt);
        });
        if (casetas.length > 0 && !selCas.value) {
            selCas.selectedIndex = 1;
        }
    }

    renderizarListasModalAsignacion();
    if (panelAsignar) panelAsignar.classList.add('activo');
}

function renderizarListasModalAsignacion() {
    if (!idTurnoModalAsignacion) return;

    const contDisponibles = document.getElementById('contenedor-lista-guardias-disponibles');
    const contActuales = document.getElementById('lista-guardias-actuales-turno');
    const badgeTotal = document.getElementById('badge-total-guardias-turno');

    // 1. Guardias actuales asignados a este turno
    const asignacionesEsteTurno = detallesTurnos.filter(d => String(d.fkTurno || d.idTurno) === String(idTurnoModalAsignacion));
    if (badgeTotal) {
        badgeTotal.textContent = `${asignacionesEsteTurno.length} guardias`;
    }

    if (contActuales) {
        if (asignacionesEsteTurno.length === 0) {
            contActuales.innerHTML = `
                <div style="text-align:center; padding:12px; color:#64748b; font-size:12px;">
                    No hay guardias asignados actualmente a este turno.
                </div>
            `;
        } else {
            contActuales.innerHTML = asignacionesEsteTurno.map(d => {
                const idDetalle = d.idDetalleTurno || d.id;
                const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(d.fkEmpleado || d.idEmpleado));
                const cas = casetas.find(c => String(c.idLugarTrabajo || c.idCasetas || c.id) === String(d.fkLugarCaseta || d.fkLugarTrabajo || d.fkLugar));
                const nomEmp = emp ? `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() : `Guardia #${d.fkEmpleado}`;
                const nomCas = cas ? (cas.nombreLugar || cas.nombreCaseta) : 'Caseta General';
                const estaActivo = (d.estadoturno || d.estadoTurno || 's').toLowerCase() === 's';

                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${estaActivo ? '#10b981' : '#ef4444'};" title="${estaActivo ? 'En servicio' : 'Fuera de servicio'}"></span>
                            <div>
                                <div style="color:#ffffff; font-size:13px; font-weight:600;">${nomEmp}</div>
                                <div style="color:#2473F5; font-size:11px;">Caseta: ${nomCas}</div>
                            </div>
                        </div>
                        <button type="button" class="btn-quitar-asignacion-modal" data-id="${idDetalle}" title="Quitar guardia del turno" style="background:#ef4444; color:#ffffff; border:none; border-radius:6px; padding:4px 8px; font-size:11px; font-weight:600; cursor:pointer;">
                            ✕ Quitar
                        </button>
                    </div>
                `;
            }).join('');

            contActuales.querySelectorAll('.btn-quitar-asignacion-modal').forEach(btn => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    const idDet = btn.getAttribute('data-id');
                    await quitarAsignacion(idDet, true);
                };
            });
        }
    }

    // 2. Lista de guardias disponibles / ocupados
    if (contDisponibles) {
        if (empleados.length === 0) {
            contDisponibles.innerHTML = `<div style="text-align:center; padding:12px; color:#64748b; font-size:12px;">No hay empleados registrados</div>`;
            return;
        }

        contDisponibles.innerHTML = empleados.map(e => {
            const idEmp = String(e.idEmpleado || e.id);
            const nom = `${e.nombreEmpleado || ''} ${e.apellidoEmpleado || ''}`.trim() || e.correoEmpleado || `Empleado #${idEmp}`;
            const dui = e.duiEmpleado || 'N/A';

            // Buscar si ya tiene una asignación activa (estadoturno === 's')
            const asignacionActiva = detallesTurnos.find(d => 
                String(d.fkEmpleado || d.idEmpleado) === idEmp && 
                (d.estadoturno || d.estadoTurno || '').toLowerCase() === 's'
            );

            let checkboxHtml = '';
            let etiquetaEstadoHtml = '';

            if (asignacionActiva) {
                const esMismoTurno = String(asignacionActiva.fkTurno || asignacionActiva.idTurno) === String(idTurnoModalAsignacion);
                if (esMismoTurno) {
                    checkboxHtml = `<input type="checkbox" disabled style="opacity:0.4; cursor:not-allowed; width:16px; height:16px;">`;
                    etiquetaEstadoHtml = `<span style="background:#10b981; color:#ffffff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; border:none;">✓ Ya en este turno</span>`;
                } else {
                    const turnoOtro = turnos.find(t => String(t.idTurno || t.id) === String(asignacionActiva.fkTurno || asignacionActiva.idTurno));
                    const nomOtro = turnoOtro ? (turnoOtro.nombreTurno || turnoOtro.nombre) : `Turno #${asignacionActiva.fkTurno}`;
                    checkboxHtml = `<input type="checkbox" disabled title="Ya está activo en ${nomOtro}" style="opacity:0.4; cursor:not-allowed; width:16px; height:16px;">`;
                    etiquetaEstadoHtml = `<span style="background:#f59e0b; color:#ffffff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; border:none;">Ocupado: ${nomOtro}</span>`;
                }
            } else {
                checkboxHtml = `<input type="checkbox" class="chk-guardia-disponible" value="${idEmp}" style="cursor:pointer; width:16px; height:16px; accent-color:#2473F5;">`;
                etiquetaEstadoHtml = `<span style="background:#2473F5; color:#ffffff; font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px;">Disponible</span>`;
            }

            return `
                <div class="fila-guardia-modal" data-texto="${nom.toLowerCase()} ${dui.toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; margin:0;">
                        ${checkboxHtml}
                        <div>
                            <span style="color:#ffffff; font-size:13px; font-weight:500;">${nom}</span>
                            <span style="color:#64748b; font-size:11px; margin-left:6px;">DUI: ${dui}</span>
                        </div>
                    </label>
                    <div>
                        ${etiquetaEstadoHtml}
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function guardarAsignacionGuardia() {
    const idTurno = idTurnoModalAsignacion || document.getElementById('asig-fk-turno')?.value;
    const idCaseta = document.getElementById('asig-fk-caseta')?.value;

    if (!idTurno) {
        if (window.Swal) {
            Swal.fire({
                title: 'Atención',
                text: 'No hay un turno seleccionado.',
                icon: 'warning',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        return;
    }

    if (!idCaseta) {
        if (window.Swal) {
            Swal.fire({
                title: 'Caseta requerida',
                text: 'Por favor selecciona la caseta a la que se asignarán los guardias.',
                icon: 'warning',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        return;
    }

    const checksSeleccionados = Array.from(document.querySelectorAll('.chk-guardia-disponible:checked'));
    if (checksSeleccionados.length === 0) {
        if (window.Swal) {
            Swal.fire({
                title: 'Ningún guardia seleccionado',
                text: 'Marca la casilla de al menos un guardia disponible para agregarlo.',
                icon: 'warning',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        return;
    }

    try {
        if (window.Swal) {
            Swal.fire({
                title: 'Asignando guardias...',
                text: `Guardando asignación de ${checksSeleccionados.length} guardia(s)...`,
                allowOutsideClick: false,
                background: '#0a0f1c',
                color: '#ffffff',
                didOpen: () => Swal.showLoading()
            });
        }

        let asignadosCount = 0;
        for (const chk of checksSeleccionados) {
            const idEmpleado = chk.value;
            await createDetalleTurno({
                fkTurno: Number(idTurno),
                fkEmpleado: idEmpleado,
                fkLugarCaseta: Number(idCaseta),
                estadoturno: 's'
            });
            asignadosCount++;
        }

        await cargarTurnos();
        renderizarListasModalAsignacion();

        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: '¡Guardias Asignados!',
                text: `Se agregaron exitosamente ${asignadosCount} guardia(s) al turno.`,
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error de asignación',
                text: 'No se pudieron asignar algunos guardias: ' + err.message,
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

async function quitarAsignacion(idDetalle, esDesdeModal = false) {
    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Quitar guardia?',
            text: 'Se removerá al guardia de este turno.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, quitar',
            cancelButtonText: 'Cancelar',
            background: '#0a0f1c',
            color: '#ffffff'
        });

        if (!result.isConfirmed) return;
    }

    try {
        await deleteDetalleTurno(idDetalle);
        await cargarTurnos();
        if (esDesdeModal || (panelAsignar && panelAsignar.classList.contains('activo'))) {
            renderizarListasModalAsignacion();
        }
        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: 'Removido',
                text: 'El guardia fue retirado del turno correctamente.',
                timer: 1800,
                showConfirmButton: false,
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo remover: ' + err.message,
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

async function alternarDetalleTurno(idDetalle, estaActivo) {
    const det = detallesTurnos.find(d => String(d.idDetalleTurno || d.id) === String(idDetalle));
    if (!det) return;

    try {
        await actualizarDetalleTurno(idDetalle, {
            ...det,
            estadoturno: estaActivo ? 'n' : 's'
        });
        if (window.Swal) {
            await Swal.fire({
                icon: 'success',
                title: estaActivo ? 'Guardia fuera de servicio' : 'Guardia activado en turno',
                text: estaActivo ? 'El guardia ha quedado fuera de servicio.' : 'El guardia está ahora activo en su caseta.',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        await cargarTurnos();
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cambiar el estado: ' + err.message,
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

// ── Selector de hora (24 h) ──────────────────────────────────────────────────
/** formato de hora */
function textoHora(hhmm) {
    const [h = '00', m = '00'] = String(hhmm || '').split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

function configurarSelectorHora(sufijo) {
    const activador = document.getElementById(`btn-activador-hora-${sufijo}`);
    const panel = document.getElementById(`panel-hora-${sufijo}`);
    const texto = document.getElementById(`texto-hora-${sufijo}`);
    const valor = document.getElementById(`turno-hora-${sufijo}`);
    const selHora = document.getElementById(`select-h-${sufijo}`);
    const selMin = document.getElementById(`select-m-${sufijo}`);
    const btnFijar = document.getElementById(`btn-aplicar-hora-${sufijo}`);
    if (!activador || !panel || !valor) return null;

    // horas del dia
    if (selHora && !selHora.options.length) {
        for (let h = 0; h < 24; h++) {
            const hh = String(h).padStart(2, '0');
            selHora.add(new Option(hh, hh));
        }
    }

    const fijar = (hhmm) => {
        valor.value = textoHora(hhmm);
        if (texto) texto.textContent = valor.value;
        panel.querySelectorAll('.selector-hora-chip').forEach(c => c.classList.toggle('seleccionado', c.dataset.hora === valor.value));
        const [h, m] = valor.value.split(':');
        if (selHora) selHora.value = h;
        if (selMin && [...selMin.options].some(o => o.value === m)) selMin.value = m;
        panel.classList.remove('abierto');
    };

    activador.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.selector-hora-panel.abierto').forEach(p => { if (p !== panel) p.classList.remove('abierto'); });
        panel.classList.toggle('abierto');
    };
    panel.querySelectorAll('.selector-hora-chip').forEach(chip => {
        chip.textContent = textoHora(chip.dataset.hora);
        chip.onclick = () => fijar(chip.dataset.hora);
    });
    if (btnFijar) btnFijar.onclick = () => fijar(`${selHora?.value || '00'}:${selMin?.value || '00'}`);
    fijar(valor.value || '00:00');
    return panel;
}

function configurarPreajustesHora() {
    const paneles = ['inicio', 'salida'].map(configurarSelectorHora).filter(Boolean);
    // cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        // no cerrar si se redibujo
        if (!document.contains(e.target) || e.target.closest('.selector-hora-panel, .selector-hora-activador')) return;
        paneles.forEach(p => p.classList.remove('abierto'));
    });
}
