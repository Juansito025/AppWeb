/** casetas */

import {
    getLugaresTrabajo,
    getLugarTrabajo,
    createLugarTrabajo,
    actualizarLugarTrabajo,
    deleteLugarTrabajo
} from '../servicios/lugarTrabajoService.js';

import {
    getTurnos,
    getDetalleTurnos,
    createDetalleTurno,
    deleteDetalleTurno
} from '../servicios/turnosService.js';

import { getEmpleados } from '../servicios/empleadosService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── Estado Local ─────────────────────────────────────────────────────────────
let casetas = [];
let detallesTurnos = [];
let empleados = [];
let turnos = [];
let busqueda = '';
let filtroEstado = 'Todos';
let paginaActual = 1;
const itemsPorPagina = 8;
let casetaSeleccionada = null;

// ── Referencias DOM ──────────────────────────────────────────────────────────
const tablaCuerpo = document.getElementById('casetas-cuerpo-tabla');
const etiquetaTotal = document.getElementById('casetas-total-etiqueta');
const entradaBusqueda = document.getElementById('casetas-entrada-buscar');
const paginacionContenedor = document.getElementById('paginacion-casetas');

// Modales
const panelAgregar = document.getElementById('panel-agregar-caseta');
const formAgregar = document.getElementById('form-agregar-caseta');
const btnAbrirAgregar = document.getElementById('btn-abrir-agregar-caseta');
const btnCerrarAgregar = document.getElementById('btn-cerrar-agregar');
const btnCancelarAgregar = document.getElementById('btn-cancelar-agregar');

const panelDetalle = document.getElementById('panel-detalle-caseta');
const formDetalle = document.getElementById('form-detalle-caseta');
const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle');
const btnCancelarDetalle = document.getElementById('btn-cancelar-detalle');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista();
    }

    await cargarCasetas();
    configurarBusquedaYFiltros();
    configurarModales();
});

// ── Carga de Datos ───────────────────────────────────────────────────────────
async function cargarCasetas() {
    if (tablaCuerpo) {
        tablaCuerpo.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">Cargando casetas y puestos...</td></tr>`;
    }
    try {
        const [resCasetas, resDetalles, resEmps, resTurnos] = await Promise.all([
            getLugaresTrabajo().catch(() => []),
            getDetalleTurnos().catch(() => []),
            getEmpleados().catch(() => []),
            getTurnos().catch(() => [])
        ]);
        casetas = Array.isArray(resCasetas) ? resCasetas : (resCasetas?.data || []);
        detallesTurnos = Array.isArray(resDetalles) ? resDetalles : (resDetalles?.data || []);
        empleados = Array.isArray(resEmps) ? resEmps : (resEmps?.data || []);
        turnos = Array.isArray(resTurnos) ? resTurnos : (resTurnos?.data || []);
    } catch (e) {
        casetas = [];
        console.warn('Error al cargar datos de casetas:', e.message);
    }
    renderizarTabla();
}

// ── Renderizado de Tabla ─────────────────────────────────────────────────────
function renderizarTabla() {
    if (!tablaCuerpo) return;

    const listaFiltrada = casetas.filter(c => {
        const nom = (c.nombreLugar || c.nombreCaseta || '').toLowerCase();
        const dir = (c.direccionLugar || c.direccionCaseta || '').toLowerCase();
        const tel = (c.telefonoLugar || c.telefonoCaseta || '').toLowerCase();
        const termino = busqueda.toLowerCase().trim();

        const coincideTexto = !termino || nom.includes(termino) || dir.includes(termino) || tel.includes(termino);
        const coincideTipo = filtroEstado === 'Todos' || (c.tipoLugar || 'Caseta') === filtroEstado;
        return coincideTexto && coincideTipo;
    });

    if (etiquetaTotal) {
        etiquetaTotal.textContent = `Casetas Totales: ${listaFiltrada.length}`;
    }

    if (listaFiltrada.length === 0) {
        tablaCuerpo.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px 16px; color: #94a3b8;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>No se encontraron casetas registradas</span>
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

    tablaCuerpo.innerHTML = itemsPagina.map(c => {
        const id = c.idLugarTrabajo || c.idCasetas || c.id;
        const nombre = c.nombreLugar || c.nombreCaseta || `Caseta #${id}`;
        const tipo = c.tipoLugar || 'Caseta';
        const tel = c.telefonoLugar || c.telefonoCaseta || 'Sin teléfono';
        const dir = c.direccionLugar || c.direccionCaseta || 'Acceso Principal';
        const cap = c.capacidadLugar ?? c.capacidadCaseta ?? 3;
        const guardiasCaseta = detallesTurnos.filter(d => String(d.fkLugar || d.fkLugarTrabajo || d.fkCaseta) === String(id));

        return `
            <tr data-id="${escapeHtml(id)}">
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; border-radius:8px; background:#2473F5; display:flex; align-items:center; justify-content:center; color:#ffffff;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <strong style="color:var(--text-primary, #ffffff);">${escapeHtml(nombre)}</strong>
                    </div>
                </td>
                <td><span style="color:#cbd5e1; font-size:13px;">${escapeHtml(tipo)}</span></td>
                <td><span style="color:#cbd5e1; font-size:13px;">${escapeHtml(tel)}</span></td>
                <td><span style="color:#cbd5e1; font-size:13px;">${escapeHtml(dir)}</span></td>
                <td>
                    <span style="display:inline-flex; align-items:center; gap:6px; background:${guardiasCaseta.length > 0 ? '#2473F5' : '#1e293b'}; color:${guardiasCaseta.length > 0 ? '#ffffff' : '#94a3b8'}; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">
                        ${guardiasCaseta.length} / ${escapeHtml(cap)} guardias
                    </span>
                </td>
                <td>
                    <span style="padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; background:#10b981; color:#ffffff;">
                        Operativa
                    </span>
                </td>
                <td class="col-acciones">
                    <div style="display:inline-flex; gap:8px;">
                        <button type="button" class="btn-accion-editar" data-id="${escapeHtml(id)}" title="Editar caseta" style="background:#2473F5; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button type="button" class="btn-accion-eliminar" data-id="${escapeHtml(id)}" title="Eliminar caseta" style="background:#ef4444; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
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
                border: none;
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
    document.querySelectorAll('.btn-accion-editar').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await abrirModalEditar(id);
        };
    });

    document.querySelectorAll('.btn-accion-eliminar').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await confirmarEliminar(id);
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

    const filtroActivador = document.getElementById('casetas-filtro-estado-activador');
    const filtroPanel = document.getElementById('casetas-filtro-estado-panel');
    const filtroTexto = document.getElementById('casetas-filtro-estado-activador-texto');

    if (filtroActivador && filtroPanel) {
        filtroActivador.onclick = (e) => {
            e.stopPropagation();
            filtroPanel.classList.toggle('abierto');
        };

        filtroPanel.querySelectorAll('.selector-opcion').forEach(opt => {
            opt.onclick = () => {
                filtroPanel.querySelectorAll('.selector-opcion').forEach(o => o.classList.remove('seleccionado'));
                opt.classList.add('seleccionado');
                filtroEstado = opt.getAttribute('data-value');
                if (filtroTexto) filtroTexto.textContent = opt.getAttribute('data-label');
                filtroPanel.classList.remove('abierto');
                paginaActual = 1;
                renderizarTabla();
            };
        });

        document.addEventListener('click', () => {
            if (filtroPanel) filtroPanel.classList.remove('abierto');
        });
    }
}

// ── Modales ──────────────────────────────────────────────────────────────────
function configurarModales() {
    if (btnAbrirAgregar) {
        btnAbrirAgregar.onclick = () => {
            if (formAgregar) formAgregar.reset();
            panelAgregar.classList.add('activo');
        };
    }

    if (btnCerrarAgregar) btnCerrarAgregar.onclick = () => panelAgregar.classList.remove('activo');
    if (btnCancelarAgregar) btnCancelarAgregar.onclick = () => panelAgregar.classList.remove('activo');

    if (btnCerrarDetalle) btnCerrarDetalle.onclick = () => panelDetalle.classList.remove('activo');
    if (btnCancelarDetalle) btnCancelarDetalle.onclick = () => panelDetalle.classList.remove('activo');

    if (formAgregar) {
        formAgregar.onsubmit = async (e) => {
            e.preventDefault();
            await guardarNuevaCaseta();
        };
    }

    if (formDetalle) {
        formDetalle.onsubmit = async (e) => {
            e.preventDefault();
            await guardarEdicionCaseta();
        };
    }
}

// ── Guardar Nueva Caseta ─────────────────────────────────────────────────────
async function guardarNuevaCaseta() {
    const nombre = document.getElementById('agregar-nombre')?.value.trim();
    const tipo = document.getElementById('agregar-tipo')?.value || 'Caseta';
    const capacidad = document.getElementById('agregar-capacidad')?.value;
    const Teléfono = (document.getElementById('agregar-telefono') || document.getElementById('agregar-Teléfono'))?.value.trim();
    const Dirección = (document.getElementById('agregar-direccion') || document.getElementById('agregar-Dirección'))?.value.trim();

    if (!nombre || !Dirección || !Teléfono) {
        if (window.Swal) Swal.fire('Campos requeridos', 'Completa los campos obligatorios.', 'warning');
        return;
    }

    const payload = {
        nombreLugar: nombre,
        nombreCaseta: nombre,
        tipoLugar: tipo,
        capacidadLugar: Number(capacidad || 3),
        capacidadCaseta: Number(capacidad || 3),
        telefonoLugar: Teléfono,
        telefonoCaseta: Teléfono,
        direccionLugar: Dirección,
        direccionCaseta: Dirección
    };

    try {
        if (window.Swal) Swal.showLoading();
        await createLugarTrabajo(payload);
        panelAgregar.classList.remove('activo');
        if (window.Swal) Swal.fire('¡Éxito!', 'Lugar de trabajo registrado exitosamente.', 'success');
        await cargarCasetas();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo guardar: ' + err.message, 'error');
    }
}

// ── Abrir y Editar Caseta ────────────────────────────────────────────────────
async function abrirModalEditar(id) {
    casetaSeleccionada = casetas.find(c => String(c.idLugarTrabajo || c.idCasetas || c.id) === String(id));
    if (!casetaSeleccionada) {
        try {
            casetaSeleccionada = await getLugarTrabajo(id);
        } catch (e) { return; }
    }
    if (!casetaSeleccionada) return;

    if (document.getElementById('detalle-nombre')) {
        document.querySelectorAll('#form-detalle-caseta input, #form-detalle-caseta select, #form-detalle-caseta textarea').forEach(el => el.removeAttribute('disabled'));
        document.getElementById('detalle-nombre').value = casetaSeleccionada.nombreLugar || casetaSeleccionada.nombreCaseta || '';
        document.getElementById('detalle-tipo').value = casetaSeleccionada.tipoLugar || 'Caseta';
        document.getElementById('detalle-capacidad').value = casetaSeleccionada.capacidadLugar ?? casetaSeleccionada.capacidadCaseta ?? 3;
        
        const elTel = document.getElementById('detalle-telefono') || document.getElementById('detalle-Teléfono');
        if (elTel) elTel.value = casetaSeleccionada.telefonoLugar || casetaSeleccionada.telefonoCaseta || '';
        const elDir = document.getElementById('detalle-direccion') || document.getElementById('detalle-Dirección');
        if (elDir) elDir.value = casetaSeleccionada.direccionLugar || casetaSeleccionada.direccionCaseta || '';
        
        renderizarGuardiasCaseta(id);
        panelDetalle.classList.add('activo');
    }
}

function renderizarGuardiasCaseta(idCaseta) {
    const contenedor = document.getElementById('detalle-guardias-lista');
    if (!contenedor) return;

    const asignados = detallesTurnos.filter(d => String(d.fkLugar || d.fkLugarTrabajo || d.fkCaseta) === String(idCaseta));

    if (asignados.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding:12px; color:#64748b; font-size:12px;">
                No hay guardias asignados a esta caseta actualmente.
            </div>
        `;
    } else {
        contenedor.innerHTML = asignados.map(d => {
            const idDetalle = d.idDetalleTurno || d.id;
            const emp = empleados.find(e => String(e.idEmpleado || e.id) === String(d.fkEmpleado || d.idEmpleado));
            const tur = turnos.find(t => String(t.idTurno || t.id) === String(d.fkTurno || d.idTurno));
            const nomEmp = emp ? `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() : `Guardia #${d.fkEmpleado}`;
            const nomTur = tur ? (tur.nombreTurno || tur.nombre) : `Turno #${d.fkTurno}`;
            const estaActivo = (d.estadoturno || d.estadoTurno || 's').toLowerCase() === 's';

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:6px 10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:7px; height:7px; border-radius:50%; background:${estaActivo ? '#10b981' : '#ef4444'};" title="${estaActivo ? 'En servicio' : 'Fuera de servicio'}"></span>
                        <div>
                            <div style="color:#ffffff; font-size:12px; font-weight:600;">${escapeHtml(nomEmp)}</div>
                            <div style="color:#60a5fa; font-size:10px;">Turno: ${escapeHtml(nomTur)}</div>
                        </div>
                    </div>
                    <button type="button" class="btn-quitar-guardia-caseta" data-id="${idDetalle}" title="Quitar de esta caseta" style="background:#ef4444; color:#ffffff; border:none; border-radius:5px; padding:3px 8px; font-size:10px; font-weight:600; cursor:pointer;">
                        ✕ Quitar
                    </button>
                </div>
            `;
        }).join('');

        contenedor.querySelectorAll('.btn-quitar-guardia-caseta').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idDet = btn.getAttribute('data-id');
                try {
                    await deleteDetalleTurno(idDet);
                    detallesTurnos = detallesTurnos.filter(d => String(d.idDetalleTurno || d.id) !== String(idDet));
                    renderizarGuardiasCaseta(idCaseta);
                    renderizarTabla();
                    if (window.Swal) Swal.fire({ title: 'Guardia removido', text: 'El guardia fue removido de esta caseta.', icon: 'success', timer: 1500, showConfirmButton: false });
                } catch (err) {
                    if (window.Swal) Swal.fire('Error', 'No se pudo remover: ' + err.message, 'error');
                }
            };
        });
    }

    // Configurar bloque para añadir varios guardias
    const bloqueAsignar = document.getElementById('bloque-asignar-guardias-caseta');
    const btnToggleBloque = document.getElementById('btn-toggle-seccion-asignar-caseta');
    if (bloqueAsignar) bloqueAsignar.style.display = 'none';

    if (btnToggleBloque && bloqueAsignar) {
        btnToggleBloque.onclick = (e) => {
            e.preventDefault();
            const abierto = bloqueAsignar.style.display === 'block';
            bloqueAsignar.style.display = abierto ? 'none' : 'block';
            btnToggleBloque.textContent = abierto ? '+ Añadir varios guardias' : 'Cerrar asignación';
        };
    }

    // Poblar turnos
    const selTurno = document.getElementById('caseta-asig-turno');
    if (selTurno) {
        selTurno.innerHTML = '<option value="">Seleccionar turno operativo...</option>';
        turnos.forEach(t => {
            const idT = t.idTurno || t.id;
            const nomT = t.nombreTurno || t.nombre || `Turno #${idT}`;
            const opt = document.createElement('option');
            opt.value = idT;
            opt.textContent = `${nomT} (${t.horaInicio || '08:00'} - ${t.horaSalida || '17:00'})`;
            selTurno.appendChild(opt);
        });
        if (turnos.length > 0 && !selTurno.value) {
            selTurno.selectedIndex = 1;
        }
    }

    // Poblar lista de guardias disponibles para asignar
    const contDisponibles = document.getElementById('contenedor-guardias-disponibles-caseta');
    if (contDisponibles) {
        if (empleados.length === 0) {
            contDisponibles.innerHTML = `<div style="text-align:center; padding:8px; color:#64748b; font-size:11px;">No hay empleados registrados</div>`;
        } else {
            contDisponibles.innerHTML = empleados.map(emp => {
                const idEmp = String(emp.idEmpleado || emp.id);
                const nom = `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() || emp.correoEmpleado || `Empleado #${idEmp}`;
                const dui = emp.duiEmpleado || 'N/A';
                const rol = (emp.fkRol && (emp.fkRol.nombreRol || emp.fkRol.nombre)) || emp.rol || 'Personal';

                // Verificar si ya está en esta caseta
                const yaEnEstaCaseta = asignados.some(d => String(d.fkEmpleado || d.idEmpleado) === idEmp);

                if (yaEnEstaCaseta) {
                    return `
                        <div class="fila-guardia-caseta-opt" data-texto="${nom.toLowerCase()} ${dui.toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:rgba(255,255,255,0.02); border-radius:6px; opacity:0.6;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:not-allowed; font-size:12px; color:#94a3b8;">
                                <input type="checkbox" disabled checked style="width:14px; height:14px;">
                                <span>${escapeHtml(nom)} <small style="color:#64748b;">(${escapeHtml(rol)})</small></span>
                            </label>
                            <span style="font-size:10px; color:#10b981; font-weight:600;">✓ Ya asignado</span>
                        </div>
                    `;
                }

                return `
                    <div class="fila-guardia-caseta-opt" data-texto="${nom.toLowerCase()} ${dui.toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:rgba(255,255,255,0.03); border-radius:6px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#ffffff;">
                            <input type="checkbox" class="chk-guardia-caseta" value="${escapeHtml(idEmp)}" style="width:14px; height:14px; accent-color:#2473F5; cursor:pointer;">
                            <span>${escapeHtml(nom)} <small style="color:#94a3b8;">(${escapeHtml(rol)})</small></span>
                        </label>
                        <span style="font-size:10px; color:#64748b;">DUI: ${escapeHtml(dui)}</span>
                    </div>
                `;
            }).join('');
        }
    }

    // Buscador en modal caseta
    const inputBuscar = document.getElementById('input-buscar-guardias-caseta');
    if (inputBuscar) {
        inputBuscar.value = '';
        inputBuscar.oninput = (e) => {
            const val = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.fila-guardia-caseta-opt').forEach(fila => {
                const txt = fila.getAttribute('data-texto') || '';
                fila.style.display = (!val || txt.includes(val)) ? 'flex' : 'none';
            });
        };
    }

    // Botón seleccionar todos
    const btnSelectTodos = document.getElementById('btn-caseta-todos-guardias');
    if (btnSelectTodos) {
        btnSelectTodos.onclick = (e) => {
            e.preventDefault();
            const chks = document.querySelectorAll('.chk-guardia-caseta');
            if (chks.length === 0) return;
            const todosMarcados = Array.from(chks).every(c => c.checked);
            chks.forEach(c => c.checked = !todosMarcados);
            btnSelectTodos.textContent = todosMarcados ? 'Seleccionar todos' : 'Deseleccionar todos';
        };
    }

    // Botón asignar seleccionados en lote
    const btnGuardarAsig = document.getElementById('btn-guardar-asignaciones-caseta');
    if (btnGuardarAsig) {
        btnGuardarAsig.onclick = async (e) => {
            e.preventDefault();
            const idTurno = document.getElementById('caseta-asig-turno')?.value;
            if (!idTurno) {
                if (window.Swal) Swal.fire('Turno requerido', 'Por favor selecciona un turno operativo.', 'warning');
                return;
            }

            const seleccionados = Array.from(document.querySelectorAll('.chk-guardia-caseta:checked')).map(c => c.value);
            if (seleccionados.length === 0) {
                if (window.Swal) Swal.fire('Ningún guardia seleccionado', 'Marca las casillas de los guardias que deseas asignar.', 'warning');
                return;
            }

            try {
                if (window.Swal) Swal.showLoading();
                for (const idEmp of seleccionados) {
                    await createDetalleTurno({
                        fkEmpleado: idEmp,
                        fkTurno: Number(idTurno),
                        fkLugar: Number(idCaseta),
                        estadoturno: 's'
                    });
                }
                const resDetalles = await getDetalleTurnos().catch(() => []);
                detallesTurnos = Array.isArray(resDetalles) ? resDetalles : (resDetalles?.data || []);
                renderizarGuardiasCaseta(idCaseta);
                renderizarTabla();
                if (window.Swal) Swal.fire('¡Éxito!', `${seleccionados.length} guardia(s) asignado(s) exitosamente a esta caseta.`, 'success');
            } catch (err) {
                if (window.Swal) Swal.fire('Error', 'No se pudieron asignar los guardias: ' + err.message, 'error');
            }
        };
    }
}

async function guardarEdicionCaseta() {
    if (!casetaSeleccionada) return;
    const id = casetaSeleccionada.idLugarTrabajo || casetaSeleccionada.idCasetas || casetaSeleccionada.id;

    const nombre = document.getElementById('detalle-nombre')?.value.trim();
    const tipo = document.getElementById('detalle-tipo')?.value;
    const capacidad = document.getElementById('detalle-capacidad')?.value;
    const Teléfono = (document.getElementById('detalle-telefono') || document.getElementById('detalle-Teléfono'))?.value.trim();
    const Dirección = (document.getElementById('detalle-direccion') || document.getElementById('detalle-Dirección'))?.value.trim();

    const payload = {
        idLugarTrabajo: id,
        idCasetas: id,
        nombreLugar: nombre,
        nombreCaseta: nombre,
        tipoLugar: tipo,
        capacidadLugar: Number(capacidad || 3),
        capacidadCaseta: Number(capacidad || 3),
        telefonoLugar: Teléfono,
        telefonoCaseta: Teléfono,
        direccionLugar: Dirección,
        direccionCaseta: Dirección
    };

    try {
        if (window.Swal) Swal.showLoading();
        await actualizarLugarTrabajo(id, payload);
        panelDetalle.classList.remove('activo');
        if (window.Swal) Swal.fire('¡Actualizado!', 'Lugar de trabajo actualizado correctamente.', 'success');
        await cargarCasetas();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo actualizar: ' + err.message, 'error');
    }
}

// ── Confirmar y Eliminar Caseta ──────────────────────────────────────────────
async function confirmarEliminar(id) {
    const c = casetas.find(item => String(item.idLugarTrabajo || item.idCasetas || item.id) === String(id));
    const nombre = c ? (c.nombreLugar || c.nombreCaseta) : 'este lugar de trabajo';

    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Eliminar caseta?',
            text: `Se eliminarán los registros de ${escapeHtml(nombre)}.`,
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
        await deleteLugarTrabajo(id);
        casetas = casetas.filter(item => String(item.idLugarTrabajo || item.idCasetas || item.id) !== String(id));
        if (window.Swal) Swal.fire('Eliminado', 'La caseta fue eliminada.', 'success');
        renderizarTabla();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo eliminar: ' + err.message, 'error');
    }
}
