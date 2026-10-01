/** dashboard */

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// carga del modulo
const getVisitas = () => (window.getVisitas ? window.getVisitas() : window.apiFetch('/visitas/paginado?page=0&size=10'));
const getTareas = () => (window.getTareas ? window.getTareas() : window.apiFetch(`/tareas/empleado/${idEmpleado}`));
const actualizarEstadoTarea = (id, estado) => (window.actualizarEstadoTarea ? window.actualizarEstadoTarea(id, estado) : window.apiFetch(`/tareas/${id}/estado`, { method: 'PATCH', body: { estado } }));
const getPersonas = () => (window.getPersonas ? window.getPersonas() : window.apiFetch('/personas'));
const getPropiedades = () => (window.getPropiedades ? window.getPropiedades() : window.apiFetch('/propiedades'));
const getPasesQR = () => (window.getPasesQR ? window.getPasesQR() : window.apiFetch('/paseAccesoQR'));

// ── Estado Local ─────────────────────────────────────────────────────────────
let visitas = [];
let personas = [];
let propiedades = [];
let pasesQR = [];
const CLASE_ESTADO = { Aprobada: 'estado-aprobada', Desaprobada: 'estado-rechazada', Rechazada: 'estado-rechazada', Expirada: 'estado-expirada', Pendiente: 'estado-pendiente' };
let tareas = [];
let busqueda = '';
let filtroCardActual = 'totales'; // 'totales' | 'aceptados' | 'rechazados' | 'vehiculos'
let filtroTareaEstado = 'todos';

// Estado de paginación para cada tabla de visitas
let paginaProgramadas = 1;
let paginaNoProgramadas = 1;
let paginaRechazados = 1;
let paginaAceptados = 1;
const ITEMS_POR_PAGINA_VISITAS = 6;

// ── Referencias DOM ──────────────────────────────────────────────────────────
const fechaActualEl = document.getElementById('fecha-actual');
const tableroBusqueda = document.getElementById('tablero-busqueda');

// Tarjetas de Estadísticas
const cardTotales = document.getElementById('card-totales');
const cardAceptados = document.getElementById('card-aceptados');
const cardRechazados = document.getElementById('card-rechazados');
const cardVehiculos = document.getElementById('card-vehiculos');

const statTotales = document.getElementById('stat-totales');
const statAceptados = document.getElementById('stat-aceptados');
const statRechazados = document.getElementById('stat-rechazados');
const statVehiculos = document.getElementById('stat-vehiculos');

// Secciones de Tablas
const secProgramadas = document.getElementById('seccion-visitas-programadas') || document.getElementById('Sección-visitas-programadas');
const secNoProgramadas = document.getElementById('seccion-visitas-no-programadas') || document.getElementById('Sección-visitas-no-programadas');
const secRechazados = document.getElementById('seccion-accesos-rechazados') || document.getElementById('Sección-accesos-rechazados');
const secAceptados = document.getElementById('contenedor-aceptados');

// Cuerpos de Tablas
const cuerpoProgramadas = document.getElementById('cuerpo-tabla-programadas');
const cuerpoNoProgramadas = document.getElementById('cuerpo-tabla-no-programadas');
const cuerpoRechazados = document.getElementById('cuerpo-tabla-rechazados');
const cuerpoAceptados = document.getElementById('cuerpo-tabla-aceptados');

// Tareas Widget
const btnAbrirTareas = document.getElementById('btn-abrir-tareas-tablero');
const panelTareas = document.getElementById('panel-tareas-guardia');
const btnCerrarTareas = document.getElementById('btn-cerrar-tareas-guardia');
const badgeTareas = document.getElementById('contador-tareas-badge');
const contenedorTareas = document.getElementById('tareas-guardia-lista');
const tabsFiltroTareas = document.querySelectorAll('.tab-filtro-tarea');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista();
    }

    establecerFechaActual();
    configurarBusqueda();
    configurarTarjetasFiltro();
    configurarModalTareas();

    await Promise.all([
        cargarDatosDashboard(),
        cargarTareas()
    ]);
});

// ── Fecha Actual ─────────────────────────────────────────────────────────────
function establecerFechaActual() {
    if (!fechaActualEl) return;
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    fechaActualEl.textContent = hoy.toLocaleDateString('es-ES', opciones);
}

// ── Carga y Normalización de Datos del Dashboard ──────────────────────────────
async function cargarDatosDashboard() {
    try {
        const [visitasRes, personasRes, propRes, pasesRes, visitantesRes] = await Promise.all([
            getVisitas().catch(() => []),
            getPersonas().catch(() => []),
            getPropiedades().catch(() => []),
            getPasesQR().catch(() => []),
            window.apiFetch('/visitantes', { silencioso: true }).catch(() => [])
        ]);
        const visitantes = Array.isArray(visitantesRes) ? visitantesRes : (visitantesRes?.data || []);
        const mapaVisitantes = new Map(visitantes.map(x => [String(x.idVisitante).toLowerCase(), x]));

        visitas = Array.isArray(visitasRes) ? visitasRes : (visitasRes?.data || []);
        personas = Array.isArray(personasRes) ? personasRes : (personasRes?.data || []);
        propiedades = Array.isArray(propRes) ? propRes : (propRes?.data || []);
        pasesQR = Array.isArray(pasesRes) ? pasesRes : (pasesRes?.data || []);

        // Enriquecer visitas con anfitriones y propiedades
        const mapaPersonas = new Map(personas.map(p => [String(p.idPersona || p.id), p]));
        const mapaPases = new Map(pasesQR.map(pq => [String(pq.fkVisitas || pq.fkVisita), pq]));

        visitas = visitas.map(v => {
            const persona = mapaPersonas.get(String(v.fkPersona)) || {};
            const visitante = mapaVisitantes.get(String(v.fkVisitante).toLowerCase()) || {};
            const pase = mapaPases.get(String(v.idVisita || v.idVisitas || v.id));
            const nombreAnfitrion = persona.nombrePersona 
                ? `${persona.nombrePersona} ${persona.apellidoPersona || ''}`.trim() 
                : (v.nombreAnfitrion || 'Residente');
            
            const prop = propiedades.find(pr => String(pr.fkPropietario || pr.fkPersona) === String(v.fkPersona));
            const destino = prop ? (prop.codigo || prop.calle || `Casa #${prop.idPropiedad}`) : (nombreAnfitrion || 'Residencia');
            const esProgramada = !!pase || (v.tipoAcceso && v.tipoAcceso.toLowerCase().includes('qr')) || (v.fechaVisita && v.fechaVisita !== '');

            return {
                ...v,
                nombreVisitante: v.nombreVisitante || `${visitante.nombreVisitante || ''} ${visitante.apellidoVisitante || ''}`.trim() || 'Visitante',
                duiVisitante: v.duiVisitante || visitante.duiVisitante || '',
                tipoTransporte: v.tipoTransporte || (v.fkVehiculos ? 'Vehicular' : 'Peatonal'),
                nombreAnfitrion,
                destino,
                residenteDestino: nombreAnfitrion,
                esProgramada,
                tienePaseQR: !!pase
            };
        });

    } catch (e) {
        console.warn('Error cargando datos del dashboard:', e.message);
        visitas = [];
    }

    actualizarMetricas();
    renderizarTablasVisitas();
}

// ── Animación y Métricas de Contadores ────────────────────────────────────────
function animarContador(el, objetivo) {
    if (!el) return;
    const target = Number(objetivo) || 0;
    if (target === 0) {
        el.textContent = '0';
        return;
    }
    let actual = 0;
    const paso = Math.max(1, Math.ceil(target / 20));
    const temporizador = setInterval(() => {
        actual = Math.min(actual + paso, target);
        el.textContent = actual;
        if (actual >= target) clearInterval(temporizador);
    }, 25);
}

function esAceptado(v) {
    const est = (v.estado || v.estadoVisita || '').toLowerCase();
    return est === 'aprobada' || est === 'aprobado' || est === 'aceptado' || est === 'aceptada' || est === 'activo' || est === 'completada';
}

function esRechazado(v) {
    const est = (v.estado || v.estadoVisita || '').toLowerCase();
    return est === 'desaprobada' || est === 'rechazado' || est === 'rechazada' || est === 'expirada' || est === 'inactivo';
}

function esVehicular(v) {
    const tp = (v.tipoTransporte || v.transporte || '').toLowerCase();
    return tp.includes('vehic') || tp.includes('vehíc') || tp.includes('carro') || tp.includes('auto') || !!v.fkVehiculos;
}

function actualizarMetricas() {
    const total = visitas.length;
    const aceptados = visitas.filter(esAceptado).length;
    const rechazados = visitas.filter(esRechazado).length;
    const vehiculos = visitas.filter(esVehicular).length;

    animarContador(statTotales, total);
    animarContador(statAceptados, aceptados);
    animarContador(statRechazados, rechazados);
    animarContador(statVehiculos, vehiculos);
}

// ── Configuración de Tarjetas como Filtros de Tablas (Sin Modales) ────────────
function configurarTarjetasFiltro() {
    const cards = [
        { el: cardTotales, filtro: 'totales' },
        { el: cardAceptados, filtro: 'aceptados' },
        { el: cardRechazados, filtro: 'rechazados' },
        { el: cardVehiculos, filtro: 'vehiculos' }
    ];

    cards.forEach(({ el, filtro }) => {
        if (!el) return;
        el.onclick = () => aplicarFiltroCard(filtro);
        el.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                aplicarFiltroCard(filtro);
            }
        };
    });
}

function aplicarFiltroCard(filtro) {
    filtroCardActual = filtro;
    paginaProgramadas = 1;
    paginaNoProgramadas = 1;
    paginaRechazados = 1;
    paginaAceptados = 1;

    // Actualizar clase activo en las tarjetas
    [cardTotales, cardAceptados, cardRechazados, cardVehiculos].forEach(c => c?.classList.remove('activo'));
    if (filtro === 'totales') cardTotales?.classList.add('activo');
    if (filtro === 'aceptados') cardAceptados?.classList.add('activo');
    if (filtro === 'rechazados') cardRechazados?.classList.add('activo');
    if (filtro === 'vehiculos') cardVehiculos?.classList.add('activo');

    // Mostrar / Ocultar secciones de tablas según el card seleccionado
    if (secProgramadas) secProgramadas.classList.toggle('oculto-card', filtro === 'aceptados' || filtro === 'rechazados');
    if (secNoProgramadas) secNoProgramadas.classList.toggle('oculto-card', filtro === 'aceptados' || filtro === 'rechazados');
    if (secRechazados) secRechazados.classList.toggle('oculto-card', filtro === 'aceptados');
    if (secAceptados) secAceptados.classList.toggle('oculto-card', filtro === 'rechazados');

    renderizarTablasVisitas();
}

// ── Renderizado de Tablas de Visitas con Paginación ──────────────────────────
function iconoTransporte(tipo) {
    if (tipo === 'Vehículo' || tipo === 'Vehicular') {
        return `<span class="visita-transporte-item"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Vehicular</span>`;
    }
    return `<span class="visita-transporte-item"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/></svg>Peatonal</span>`;
}

function renderizarPaginacionVisitas(contenedorId, paginaActual, totalPaginas, onCambioPagina) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        return;
    }

    let botonesPaginas = '';
    for (let i = 1; i <= totalPaginas; i++) {
        const esActiva = i === paginaActual;
        botonesPaginas += `
            <button type="button" class="btn-pag-num ${esActiva ? 'activo' : ''}" data-pagina="${i}" style="
                min-width: 32px; height: 32px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
                border: 1px solid ${esActiva ? '#2473F5' : 'rgba(255,255,255,0.1)'};
                background: ${esActiva ? 'linear-gradient(135deg, #2473F5, #1d4ed8)' : 'rgba(255,255,255,0.05)'};
                color: ${esActiva ? '#ffffff' : '#94a3b8'};
            ">${i}</button>
        `;
    }

    contenedor.innerHTML = `
        <div class="keeper-paginacion-wrap" style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:14px; padding:6px 0;">
            <button type="button" class="btn-pag-ant" ${paginaActual === 1 ? 'disabled' : ''} style="
                padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: ${paginaActual === 1 ? 'not-allowed' : 'pointer'};
                border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: ${paginaActual === 1 ? '#475569' : '#ffffff'};
                display: inline-flex; align-items: center; gap: 4px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Anterior
            </button>
            <div style="display:flex; gap:4px;">
                ${botonesPaginas}
            </div>
            <button type="button" class="btn-pag-sig" ${paginaActual === totalPaginas ? 'disabled' : ''} style="
                padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: ${paginaActual === totalPaginas ? 'not-allowed' : 'pointer'};
                border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: ${paginaActual === totalPaginas ? '#475569' : '#ffffff'};
                display: inline-flex; align-items: center; gap: 4px;
            ">
                Siguiente
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>
    `;

    const btnAnt = contenedor.querySelector('.btn-pag-ant');
    const btnSig = contenedor.querySelector('.btn-pag-sig');
    if (btnAnt) btnAnt.onclick = () => { if (paginaActual > 1) onCambioPagina(paginaActual - 1); };
    if (btnSig) btnSig.onclick = () => { if (paginaActual < totalPaginas) onCambioPagina(paginaActual + 1); };
    contenedor.querySelectorAll('.btn-pag-num').forEach(btn => {
        btn.onclick = () => {
            const p = Number(btn.getAttribute('data-pagina'));
            if (p && p !== paginaActual) onCambioPagina(p);
        };
    });
}

function renderizarTablasVisitas() {
    const termino = busqueda.toLowerCase().trim();
    let filtradas = visitas.filter(v => {
        const nom = (v.nombreVisitante || v.nombre || '').toLowerCase();
        const resi = (v.nombreAnfitrion || v.residenteDestino || v.destino || '').toLowerCase();
        const est = (v.estado || v.estadoVisita || '').toLowerCase();
        return !termino || nom.includes(termino) || resi.includes(termino) || est.includes(termino);
    });

    // Si el card seleccionado es vehículos, filtramos solo los vehiculares
    if (filtroCardActual === 'vehiculos') {
        filtradas = filtradas.filter(esVehicular);
    }

    // visitas programadas y no programadas
    const hoyISO = fechaLocalISO();
    const esDeHoy = (v) => String(v.fechaVisita || '').slice(0, 10) === hoyISO;
    const programadas = filtradas.filter(v => !esDeHoy(v));
    const noProgramadas = filtradas.filter(esDeHoy);
    const rechazados = filtradas.filter(esRechazado);
    const aceptados = filtradas.filter(esAceptado);

    // 1. Tabla: Visitas Programadas (5 columnas uniformes con paginación)
    if (cuerpoProgramadas) {
        if (programadas.length === 0) {
            cuerpoProgramadas.innerHTML = `<tr><td colspan="5" class="tabla-vacia" style="text-align:center; padding:24px;">No hay visitas programadas ${escapeHtml(filtroCardActual === 'vehiculos' ? 'vehiculares' : '')}.</td></tr>`;
            renderizarPaginacionVisitas('paginacion-programadas', 1, 0, () => {});
        } else {
            const totalPaginasProg = Math.ceil(programadas.length / ITEMS_POR_PAGINA_VISITAS) || 1;
            if (paginaProgramadas > totalPaginasProg) paginaProgramadas = totalPaginasProg;
            const inicio = (paginaProgramadas - 1) * ITEMS_POR_PAGINA_VISITAS;
            const items = programadas.slice(inicio, inicio + ITEMS_POR_PAGINA_VISITAS);

            cuerpoProgramadas.innerHTML = items.map(v => {
                const nom = v.nombreVisitante || v.nombre || 'Visitante';
                const resi = v.nombreAnfitrion || v.residenteDestino || v.destino || 'Residente';
                const tipo = v.tipoTransporte || 'Peatonal';
                const hora = v.fechaVisita || v.horaEntrada || 'Programada';
                const est = v.estado || v.estadoVisita || 'Pendiente';
                const clase = CLASE_ESTADO[est] || 'estado-pendiente';
                return `
                    <tr>
                        <td><strong>${escapeHtml(nom)}</strong></td>
                        <td>${escapeHtml(resi)}</td>
                        <td>${iconoTransporte(tipo)}</td>
                        <td>${escapeHtml(hora)}</td>
                        <td><span class="pildora-estado ${clase}">${escapeHtml(est)}</span></td>
                    </tr>
                `;
            }).join('');

            renderizarPaginacionVisitas('paginacion-programadas', paginaProgramadas, totalPaginasProg, (p) => {
                paginaProgramadas = p;
                renderizarTablasVisitas();
            });
        }
    }

    // 2. Tabla: Visitas No Programadas (5 columnas con paginación)
    if (cuerpoNoProgramadas) {
        if (noProgramadas.length === 0) {
            cuerpoNoProgramadas.innerHTML = `<tr><td colspan="5" class="tabla-vacia" style="text-align:center; padding:24px;">No se registran visitas no programadas ${escapeHtml(filtroCardActual === 'vehiculos' ? 'vehiculares' : '')}.</td></tr>`;
            renderizarPaginacionVisitas('paginacion-noprogramadas', 1, 0, () => {});
        } else {
            const totalPaginasNoProg = Math.ceil(noProgramadas.length / ITEMS_POR_PAGINA_VISITAS) || 1;
            if (paginaNoProgramadas > totalPaginasNoProg) paginaNoProgramadas = totalPaginasNoProg;
            const inicio = (paginaNoProgramadas - 1) * ITEMS_POR_PAGINA_VISITAS;
            const items = noProgramadas.slice(inicio, inicio + ITEMS_POR_PAGINA_VISITAS);

            cuerpoNoProgramadas.innerHTML = items.map(v => {
                const nom = v.nombreVisitante || v.nombre || 'Visitante';
                const resi = v.nombreAnfitrion || v.residenteDestino || v.destino || 'Sin asignar';
                const tipo = v.tipoTransporte || 'Peatonal';
                const hora = v.fechaVisita || v.horaEntrada || 'Registrada';
                const est = v.estado || v.estadoVisita || 'Aprobada';
                return `
                    <tr>
                        <td><strong>${escapeHtml(nom)}</strong></td>
                        <td>${escapeHtml(resi)}</td>
                        <td>${iconoTransporte(tipo)}</td>
                        <td>${escapeHtml(hora)}</td>
                        <td><span class="pildora-estado ${CLASE_ESTADO[est] || 'estado-pendiente'}">${escapeHtml(est)}</span></td>
                    </tr>
                `;
            }).join('');

            renderizarPaginacionVisitas('paginacion-noprogramadas', paginaNoProgramadas, totalPaginasNoProg, (p) => {
                paginaNoProgramadas = p;
                renderizarTablasVisitas();
            });
        }
    }

    // 3 accesos rechazados
    if (cuerpoRechazados) {
        if (rechazados.length === 0) {
            cuerpoRechazados.innerHTML = `<tr><td colspan="4" class="tabla-vacia" style="text-align:center; padding:24px;">No hay accesos rechazados registrados.</td></tr>`;
            renderizarPaginacionVisitas('paginacion-rechazados', 1, 0, () => {});
        } else {
            const totalPaginasRech = Math.ceil(rechazados.length / ITEMS_POR_PAGINA_VISITAS) || 1;
            if (paginaRechazados > totalPaginasRech) paginaRechazados = totalPaginasRech;
            const inicio = (paginaRechazados - 1) * ITEMS_POR_PAGINA_VISITAS;
            const items = rechazados.slice(inicio, inicio + ITEMS_POR_PAGINA_VISITAS);

            cuerpoRechazados.innerHTML = items.map((v, index) => {
                const nom = v.nombreVisitante || v.nombre || 'Visitante';
                const dest = v.destino || v.nombreAnfitrion || 'Residencia';
                const hora = v.fechaVisita || v.horaEntrada || 'Hoy';
                const est = v.estado || 'Desaprobada';
                const indiceReal = inicio + index;

                return `
                    <tr>
                        <td><strong>${escapeHtml(nom)}</strong></td>
                        <td>${escapeHtml(dest)}</td>
                        <td>${escapeHtml(hora)}</td>
                        <td>
                            <button type="button" class="btn-ojo-motivo" data-idx="${escapeHtml(indiceReal)}" title="Ver motivo de rechazo" aria-label="Ver motivo de rechazo">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Asignar evento clic al botón del ojo en cada fila
            cuerpoRechazados.querySelectorAll('.btn-ojo-motivo').forEach(btn => {
                btn.onclick = () => {
                    const idx = Number(btn.getAttribute('data-idx'));
                    const rechItem = rechazados[idx];
                    if (!rechItem) return;

                    const nom = rechItem.nombreVisitante || rechItem.nombre || 'Visitante';
                    const dest = rechItem.destino || rechItem.nombreAnfitrion || 'Residencia';
                    const hora = rechItem.fechaVisita || rechItem.horaEntrada || 'Hoy';
                    const motivo = rechItem.motivoRechazo || `El acceso fue denegado porque el residente ${dest} desaprobó la solicitud o el código de pase no era válido.`;

                    mostrarModalMotivo(nom, dest, hora, motivo);
                };
            });

            renderizarPaginacionVisitas('paginacion-rechazados', paginaRechazados, totalPaginasRech, (p) => {
                paginaRechazados = p;
                renderizarTablasVisitas();
            });
        }
    }

    // 4. Tabla: Accesos Programados Aceptados (5 columnas uniformes y paginación)
    if (cuerpoAceptados) {
        if (aceptados.length === 0) {
            cuerpoAceptados.innerHTML = `<tr><td colspan="5" class="tabla-vacia" style="text-align:center; padding:24px;">No hay accesos programados aceptados ${escapeHtml(filtroCardActual === 'vehiculos' ? 'vehiculares' : '')}.</td></tr>`;
            renderizarPaginacionVisitas('paginacion-aceptados', 1, 0, () => {});
        } else {
            const totalPaginasAcept = Math.ceil(aceptados.length / ITEMS_POR_PAGINA_VISITAS) || 1;
            if (paginaAceptados > totalPaginasAcept) paginaAceptados = totalPaginasAcept;
            const inicio = (paginaAceptados - 1) * ITEMS_POR_PAGINA_VISITAS;
            const items = aceptados.slice(inicio, inicio + ITEMS_POR_PAGINA_VISITAS);

            cuerpoAceptados.innerHTML = items.map(v => {
                const nom = v.nombreVisitante || v.nombre || 'Visitante';
                const dest = v.destino || v.nombreAnfitrion || 'Residencia';
                const transp = v.tipoTransporte || 'Peatonal';
                const hora = v.fechaVisita || v.horaEntrada || 'Confirmada';
                const est = v.estado || 'Aprobada';
                return `
                    <tr>
                        <td><strong>${escapeHtml(nom)}</strong></td>
                        <td>${escapeHtml(dest)}</td>
                        <td>${iconoTransporte(transp)}</td>
                        <td>${escapeHtml(hora)}</td>
                        <td><span class="pildora-estado estado-aprobada">${escapeHtml(est)}</span></td>
                    </tr>
                `;
            }).join('');

            renderizarPaginacionVisitas('paginacion-aceptados', paginaAceptados, totalPaginasAcept, (p) => {
                paginaAceptados = p;
                renderizarTablasVisitas();
            });
        }
    }
}

// ── Modal de Motivo de Rechazo (SweetAlert2) ──────────────────────────────────
function mostrarModalMotivo(visitante, destino, hora, motivo) {
    if (window.Swal) {
        const esClaro = document.body.getAttribute('data-theme') === 'light';
        Swal.fire({
            title: 'Motivo del Rechazo de Acceso',
            html: `
                <div style="text-align: left; background: ${esClaro ? '#ffffff' : '#ffffff08'}; border: 1px solid ${esClaro ? '#cbd5e1' : '#ef444440'}; border-radius: 12px; padding: 18px; color: ${esClaro ? '#000000' : '#cbd5e1'}; font-size: 14px; line-height: 1.6;">
                    <div style="margin-bottom: 8px;"><strong style="color:${esClaro ? '#000000' : '#ffffff'};">Visitante:</strong> ${escapeHtml(visitante)}</div>
                    <div style="margin-bottom: 8px;"><strong style="color:${esClaro ? '#000000' : '#ffffff'};">Destino / Casa:</strong> ${escapeHtml(destino)}</div>
                    <div style="margin-bottom: 8px;"><strong style="color:${esClaro ? '#000000' : '#ffffff'};">Hora de Registro:</strong> ${escapeHtml(hora)}</div>
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid ${esClaro ? '#cbd5e1' : '#ffffff14'};">
                        <strong style="color:${esClaro ? '#0284c7' : '#ef4444'}; display:block; margin-bottom:4px;">Causa por la que no se dejó pasar:</strong>
                        <span style="color:${esClaro ? '#000000' : '#f87171'};">${escapeHtml(motivo)}</span>
                    </div>
                </div>
            `,
            icon: esClaro ? 'info' : 'error',
            iconColor: esClaro ? '#0284c7' : '#ef4444',
            background: esClaro ? '#ffffff' : '#0a0f1c',
            color: esClaro ? '#000000' : '#ffffff',
            confirmButtonColor: esClaro ? '#0284c7' : '#2473F5',
            confirmButtonText: 'Entendido'
        });
    } else {
        alert(`Motivo de Rechazo:\nVisitante: ${visitante}\nDestino: ${destino}\nMotivo: ${motivo}`);
    }
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────
function configurarBusqueda() {
    let timeout = null;
    if (tableroBusqueda) {
        tableroBusqueda.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                busqueda = e.target.value;
                paginaProgramadas = 1;
                paginaNoProgramadas = 1;
                paginaRechazados = 1;
                paginaAceptados = 1;
                renderizarTablasVisitas();
            }, 200);
        });
    }
}

// ── Tareas Widget ────────────────────────────────────────────────────────────
async function cargarTareas() {
    try {
        const res = await getTareas();
        tareas = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        tareas = [];
    }

    if (badgeTareas) {
        const pendientes = tareas.filter(t => {
            const est = (t.estadoTarea || t.estado || '').toLowerCase();
            return est === 'pendiente' || est === 'en progreso';
        }).length;
        badgeTareas.textContent = pendientes;
    }
    renderizarListaTareas();
}

function renderizarListaTareas() {
    if (!contenedorTareas) return;

    const filtradas = tareas.filter(t => {
        if (filtroTareaEstado === 'todos') return true;
        const est = (t.estadoTarea || t.estado || '').toLowerCase();
        return est === filtroTareaEstado.toLowerCase();
    });

    if (filtradas.length === 0) {
        contenedorTareas.innerHTML = `<p style="text-align:center; color:#64748b; font-size:14px; padding:20px;">No hay tareas en este estado.</p>`;
        return;
    }

    contenedorTareas.innerHTML = filtradas.map(t => {
        const id = t.idTarea || t.id;
        const Título = t.titulo || t.tituloTarea || `Tarea #${id}`;
        const desc = t.descripcion || t.descripcionTarea || 'Sin descripción detallada.';
        const estado = t.estadoTarea || t.estado || 'Pendiente';
        const esProgreso = (estado.toLowerCase() === 'pendiente' || estado.toLowerCase() === 'en progreso');
        const badgeClase = esProgreso ? 'badge-estado-tarea progreso' : (estado.toLowerCase() === 'completada' ? 'badge-estado-tarea completada' : 'badge-estado-tarea cancelada');

        return `
            <div class="item-tarea-guardia">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong class="titulo-tarea-guardia">${escapeHtml(Título)}</strong>
                    <span class="${escapeHtml(badgeClase)}">
                        ${escapeHtml(estado)}
                    </span>
                </div>
                <p class="desc-tarea-guardia">${escapeHtml(desc)}</p>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    ${esProgreso ? `
                        <button type="button" class="btn-completar-tarea" data-id="${escapeHtml(id)}">
                            ✓ Completar
                        </button>
                        <button type="button" class="btn-cancelar-tarea" data-id="${escapeHtml(id)}">
                            ✕ Cancelar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    contenedorTareas.querySelectorAll('.btn-completar-tarea').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await cambiarEstadoTarea(id, 'Completada');
        };
    });

    contenedorTareas.querySelectorAll('.btn-cancelar-tarea').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await cambiarEstadoTarea(id, 'Cancelada');
        };
    });
}

async function cambiarEstadoTarea(id, nuevoEstado) {
    try {
        await actualizarEstadoTarea(id, nuevoEstado);
        if (window.Swal) Swal.fire('Actualizado', `Tarea marcada como ${nuevoEstado}.`, 'success');
        await cargarTareas();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo actualizar la tarea: ' + err.message, 'error');
    }
}

function configurarModalTareas() {
    if (btnAbrirTareas) {
        btnAbrirTareas.onclick = () => {
            if (panelTareas) panelTareas.classList.add('activo');
        };
    }

    if (btnCerrarTareas) {
        btnCerrarTareas.onclick = () => {
            if (panelTareas) panelTareas.classList.remove('activo');
        };
    }

    tabsFiltroTareas.forEach(tab => {
        tab.onclick = () => {
            tabsFiltroTareas.forEach(t => t.classList.remove('activo'));
            tab.classList.add('activo');
            filtroTareaEstado = tab.getAttribute('data-filtro');
            renderizarListaTareas();
        };
    });
}
