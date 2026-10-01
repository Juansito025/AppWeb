/** propiedades */

import {
    getPropiedades,
    getPropiedadesPaginado,
    getPropiedad,
    createPropiedad,
    actualizarPropiedad,
    deletePropiedad
} from '../servicios/propiedadesService.js';

import { getPersonas } from '../servicios/personasService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/** Color sólido de la pastilla de estado de la propiedad */
function colorEstadoPropiedad(estado) {
    const e = String(estado || '').toLowerCase();
    if (e === 'habitada') return '#10b981';
    if (e === 'desocupada') return '#505870';
    if (e.startsWith('en construc')) return '#f59e0b';
    if (e === 'en venta') return '#2473F5';
    return '#505870';
}

// ── Estado Local ─────────────────────────────────────────────────────────────
let propiedades = [];
let personas = [];
let secciones = [];        // /secciones
let tiposPropiedad = [];   // /tiposPropiedades
let busqueda = '';
let filtroEstado = 'all';
let filtroPisos = 'all';
let paginaActual = 1;
const itemsPorPagina = 8;
let propiedadSeleccionada = null;

// ── Referencias DOM ──────────────────────────────────────────────────────────
const tablaCuerpo = document.getElementById('tabla-cuerpo');
const etiquetaTotal = document.getElementById('etiqueta-total');
const entradaBusqueda = document.getElementById('entrada-busqueda');
const paginacionContenedor = document.getElementById('paginacion-propiedades');

// Modales
const panelAgregar = document.getElementById('panel-agregar');
const formAgregar = document.getElementById('form-agregar');
const btnAbrirAgregar = document.getElementById('btn-abrir-agregar');
const btnCerrarAgregar = document.getElementById('btn-cerrar-agregar');
const btnCancelarAgregar = document.getElementById('btn-cancelar-agregar');

const panelDetalle = document.getElementById('panel-detalle');
const formDetalle = document.getElementById('form-detalle');
const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle');
const btnCancelarDetalle = document.getElementById('btn-cerrar-detalle-cancelar') || document.getElementById('btn-cancelar-detalle');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista();
    }

    await Promise.all([
        cargarPersonas(),
        cargarCatalogos()
    ]);
    await cargarPropiedades();

    configurarBusquedaYFiltros();
    configurarModales();
});

// ── Carga de Datos ───────────────────────────────────────────────────────────
/** secciones y tipos */
async function cargarCatalogos() {
    const lista = (r) => Array.isArray(r) ? r : (r?.data || []);
    [secciones, tiposPropiedad] = await Promise.all([
        apiFetch('/secciones', { silencioso: true }).then(lista).catch(() => []),
        apiFetch('/tiposPropiedades', { silencioso: true }).then(lista).catch(() => [])
    ]);
    const llenar = (id, datos, valor, texto, vacio) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = datos.length
            ? '<option value="" disabled selected>Selecciona…</option>' + datos.map(d => `<option value="${escapeHtml(d[valor])}">${escapeHtml(d[texto])}</option>`).join('')
            : `<option value="">${vacio}</option>`;
        if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(sel);
    };
    ['agregar-seccion', 'detalle-seccion'].forEach(id => llenar(id, secciones, 'idSecciones', 'nombreSeccion', 'No hay secciones registradas'));
    ['agregar-tipo-propiedad', 'detalle-tipo-propiedad'].forEach(id => llenar(id, tiposPropiedad, 'idTipoPropiedad', 'nombreTipoPropiedad', 'No hay tipos registrados'));
}

const nombreSeccion = (id) => secciones.find(s => String(s.idSecciones) === String(id))?.nombreSeccion || (id ? `Sección #${id}` : 'Sin sección');
const nombreTipo = (id) => tiposPropiedad.find(t => String(t.idTipoPropiedad) === String(id))?.nombreTipoPropiedad || (id ? `Tipo #${id}` : 'Sin tipo');

async function cargarPersonas() {
    try {
        const res = await getPersonas();
        personas = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        personas = [];
    }
    poblarSelectsPropietario();
}

function poblarSelectsPropietario() {
    const selAgr = document.getElementById('agregar-propietario');
    const selDet = document.getElementById('detalle-propietario');

    const opciones = '<option value="">-- Sin propietario asignado --</option>' +
        personas.map(p => {
            const id = p.idPersona || p.idPropietario || p.id;
            const nom = `${p.nombrePersona || ''} ${p.apellidoPersona || ''}`.trim() || p.correoPersona || `Persona #${id}`;
            const dui = p.duiPersona ? ` (DUI: ${p.duiPersona})` : '';
            return `<option value="${escapeHtml(id)}">${escapeHtml(nom)}${escapeHtml(dui)}</option>`;
        }).join('');

    if (selAgr) selAgr.innerHTML = opciones;
    if (selDet) selDet.innerHTML = opciones;
}

async function cargarPropiedades() {
    if (tablaCuerpo) {
        tablaCuerpo.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">Cargando propiedades...</td></tr>`;
    }
    try {
        const res = await getPropiedades();
        propiedades = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        propiedades = [];
        console.warn('Error al cargar propiedades:', e.message);
    }
    renderizarTabla();
}

// ── Renderizado de Tabla con Búsqueda, Filtros y Paginación ───────────────────
async function renderizarTabla() {
    if (!tablaCuerpo) return;

    const listaFiltrada = propiedades.filter(p => {
        const cod = (p.codigo || p.codigoPropiedad || '').toLowerCase();
        const dir = (p.calle || p.direccionPropiedad || '').toLowerCase();
        const termino = busqueda.toLowerCase().trim();

        const coincideTexto = !termino || cod.includes(termino) || dir.includes(termino);

        let coincideEstado = true;
        if (filtroEstado !== 'all') {
            coincideEstado = (p.estado || '').toLowerCase() === filtroEstado.toLowerCase();
        }

        let coincidePisos = true;
        if (filtroPisos !== 'all') {
            coincidePisos = String(p.niveles || 1) === filtroPisos;
        }

        return coincideTexto && coincideEstado && coincidePisos;
    });

    if (etiquetaTotal) {
        etiquetaTotal.textContent = `Propiedades Totales: ${listaFiltrada.length}`;
    }

    if (listaFiltrada.length === 0) {
        tablaCuerpo.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px 16px; color: #94a3b8;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>No se encontraron propiedades con los criterios aplicados</span>
                    </div>
                </td>
            </tr>
        `;
        renderizarPaginacion(0);
        return;
    }

    let totalPaginas;
    let itemsPagina = null;

    if (!busqueda.trim() && filtroEstado === 'all' && filtroPisos === 'all') {
        try {
            // paginacion desde la api
            const pagina = await getPropiedadesPaginado(paginaActual, itemsPorPagina);
            if (pagina.totalPaginas > 0 && paginaActual > pagina.totalPaginas) {
                paginaActual = pagina.totalPaginas;
                return renderizarTabla();
            }
            totalPaginas = pagina.totalPaginas;
            itemsPagina = pagina.contenido;
            if (etiquetaTotal) etiquetaTotal.textContent = `Propiedades Totales: ${pagina.totalElementos}`;
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

    tablaCuerpo.innerHTML = itemsPagina.map(p => {
        const id = p.idPropiedad || p.id;
        const cod = p.codigo || p.codigoPropiedad || `P-${id}`;
        const dir = p.calle || p.direccionPropiedad || 'Calle Principal';
        const pisos = p.niveles || 1;
        const estado = p.estado || 'Habitada';
        const secId = p.fkSeccion?.idSeccion || p.fkSeccion || null;
        const secNombre = p.fkSeccion?.nombreSeccion || nombreSeccion(secId);

        // Obtener Propietario
        const idDueno = p.fkPersona || p.fkPropietario;
        const dueno = personas.find(per => String(per.idPersona || per.idPropietario || per.id) === String(idDueno));
        const nombreDueno = dueno ? `${dueno.nombrePersona || ''} ${dueno.apellidoPersona || ''}`.trim() : 'Sin asignar';

        return `
            <tr data-id="${escapeHtml(id)}">
                <td><strong style="color:var(--text-primary, #ffffff);">${escapeHtml(cod)}</strong></td>
                <td><span style="color:#94a3b8; font-size:13px;">${escapeHtml(secNombre)}</span></td>
                <td><span style="color:#cbd5e1; font-size:13px;">${escapeHtml(dir)}</span></td>
                <td><span style="color:#cbd5e1; font-size:13px;">${escapeHtml(pisos)} ${pisos === 1 ? 'piso' : 'pisos'}</span></td>
                <td><span style="color:#94a3b8; font-size:13px;">${escapeHtml(nombreDueno)}</span></td>
                <td>
                    <span style="padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; background:${colorEstadoPropiedad(estado)}; color:#ffffff;">
                        ${escapeHtml(estado)}
                    </span>
                </td>
                <td class="col-acciones">
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn-accion-editar" data-id="${escapeHtml(id)}" title="Editar propiedad" style="background:#2473F5; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button type="button" class="btn-accion-eliminar" data-id="${escapeHtml(id)}" title="Eliminar propiedad" style="background:#ef4444; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;">
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

function conectarEventosTabla() {
    document.querySelectorAll('.btn-accion-editar').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            await abrirModalDetalle(id);
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

    // Filtro Estado
    const filtroActivador = document.getElementById('filtro-estado-activador');
    const filtroPanel = document.getElementById('filtro-estado-panel');
    const filtroTexto = document.getElementById('filtro-estado-activador-texto');

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
    }

    // Filtro Pisos
    const pisosActivador = document.getElementById('filtro-pisos-activador');
    const pisosPanel = document.getElementById('filtro-pisos-panel');
    const pisosTexto = document.getElementById('filtro-pisos-activador-texto');

    if (pisosActivador && pisosPanel) {
        pisosActivador.onclick = (e) => {
            e.stopPropagation();
            pisosPanel.classList.toggle('abierto');
        };

        pisosPanel.querySelectorAll('.selector-opcion').forEach(opt => {
            opt.onclick = () => {
                pisosPanel.querySelectorAll('.selector-opcion').forEach(o => o.classList.remove('seleccionado'));
                opt.classList.add('seleccionado');
                filtroPisos = opt.getAttribute('data-value');
                if (pisosTexto) pisosTexto.textContent = opt.getAttribute('data-label');
                pisosPanel.classList.remove('abierto');
                paginaActual = 1;
                renderizarTabla();
            };
        });
    }

    document.addEventListener('click', () => {
        if (filtroPanel) filtroPanel.classList.remove('abierto');
        if (pisosPanel) pisosPanel.classList.remove('abierto');
    });
}

// ── Modales ──────────────────────────────────────────────────────────────────
function configurarModales() {
    if (btnAbrirAgregar) {
        btnAbrirAgregar.onclick = () => {
            if (formAgregar) formAgregar.reset();
            poblarSelectsPropietario();
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
            await guardarNuevaPropiedad();
        };
    }

    if (formDetalle) {
        formDetalle.onsubmit = async (e) => {
            e.preventDefault();
            await guardarEdicionPropiedad();
        };
    }
}

// ── Crear Propiedad ──────────────────────────────────────────────────────────
async function guardarNuevaPropiedad() {
    const nombre = document.getElementById('agregar-nombre')?.value.trim();
    const direccion = (document.getElementById('agregar-direcciOn') || document.getElementById('agregar-Dirección') || document.getElementById('agregar-direccion'))?.value.trim();
    const seccion = (document.getElementById('agregar-seccion') || document.getElementById('agregar-Sección'))?.value;
    const tipo = document.getElementById('agregar-tipo-propiedad')?.value;
    const pisos = document.getElementById('agregar-pisos')?.value;
    const estado = document.getElementById('agregar-estado')?.value || 'Habitada';
    const idPropietario = document.getElementById('agregar-propietario')?.value || null;

    if (!nombre || !direccion || !seccion || !tipo) {
        if (window.Swal) {
            Swal.fire({
                title: 'Campos requeridos',
                text: 'Completa el código, la dirección, la sección y el tipo de propiedad.',
                icon: 'warning',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        return;
    }

    const payload = {
        codigo: nombre,
        calle: direccion,
        niveles: Number(pisos || 1),
        estado: estado,
        fkSeccion: seccion ? Number(seccion) : null,
        fkTipoPropiedad: tipo ? Number(tipo) : null,
        fkPropietario: idPropietario || null,
        fkPersona: idPropietario || null
    };

    try {
        if (window.Swal) Swal.showLoading();
        await createPropiedad(payload);
        panelAgregar.classList.remove('activo');
        if (window.Swal) {
            Swal.fire({
                title: '¡Éxito!',
                text: 'Propiedad creada y registrada correctamente.',
                icon: 'success',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        await cargarPropiedades();
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo crear la propiedad: ' + err.message,
                icon: 'error',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

// ── Abrir y Editar Propiedad ─────────────────────────────────────────────────
async function abrirModalDetalle(id) {
    propiedadSeleccionada = propiedades.find(p => String(p.idPropiedad || p.id) === String(id));
    if (!propiedadSeleccionada) {
        try {
            propiedadSeleccionada = await getPropiedad(id);
        } catch (e) { return; }
    }
    if (!propiedadSeleccionada) return;

    poblarSelectsPropietario();

    document.getElementById('detalle-id').value = id;
    document.getElementById('detalle-nombre').value = propiedadSeleccionada.codigo || propiedadSeleccionada.codigoPropiedad || '';
    
    const inputDir = document.getElementById('detalle-direcciOn') || document.getElementById('detalle-Dirección') || document.getElementById('detalle-direccion');
    if (inputDir) inputDir.value = propiedadSeleccionada.calle || propiedadSeleccionada.direccionPropiedad || '';

    const inputSec = document.getElementById('detalle-seccion') || document.getElementById('detalle-Sección');
    if (inputSec) inputSec.value = propiedadSeleccionada.fkSeccion?.idSeccion || propiedadSeleccionada.fkSeccion || 1;

    const inputTipo = document.getElementById('detalle-tipo-propiedad');
    if (inputTipo) inputTipo.value = propiedadSeleccionada.fkTipoPropiedad?.idTipoPropiedad || propiedadSeleccionada.fkTipoPropiedad || 1;

    const inputPisos = document.getElementById('detalle-pisos');
    if (inputPisos) inputPisos.value = propiedadSeleccionada.niveles || 1;

    const inputEstado = document.getElementById('detalle-estado');
    if (inputEstado) inputEstado.value = propiedadSeleccionada.estado || 'Habitada';

    const inputProp = document.getElementById('detalle-propietario');
    if (inputProp) inputProp.value = propiedadSeleccionada.fkPropietario || propiedadSeleccionada.fkPersona || '';

    // habilitar edicion
    const inputs = formDetalle.querySelectorAll('input, select');
    inputs.forEach(el => el.removeAttribute('disabled'));

    panelDetalle.classList.add('activo');
}

async function guardarEdicionPropiedad() {
    if (!propiedadSeleccionada) return;
    const id = document.getElementById('detalle-id')?.value;
    const nombre = document.getElementById('detalle-nombre')?.value.trim();
    const direccion = (document.getElementById('detalle-direcciOn') || document.getElementById('detalle-Dirección') || document.getElementById('detalle-direccion'))?.value.trim();
    const seccion = (document.getElementById('detalle-seccion') || document.getElementById('detalle-Sección'))?.value;
    const tipo = document.getElementById('detalle-tipo-propiedad')?.value;
    const pisos = document.getElementById('detalle-pisos')?.value;
    const estado = document.getElementById('detalle-estado')?.value;
    const idPropietario = document.getElementById('detalle-propietario')?.value || null;

    const payload = {
        idPropiedad: Number(id),
        codigo: nombre,
        calle: direccion,
        niveles: Number(pisos || 1),
        estado: estado,
        fkSeccion: seccion ? Number(seccion) : null,
        fkTipoPropiedad: tipo ? Number(tipo) : null,
        fkPropietario: idPropietario || null,
        fkPersona: idPropietario || null
    };

    try {
        if (window.Swal) Swal.showLoading();
        await actualizarPropiedad(id, payload);
        panelDetalle.classList.remove('activo');
        if (window.Swal) {
            Swal.fire({
                title: '¡Actualizado!',
                text: 'Propiedad actualizada correctamente.',
                icon: 'success',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        await cargarPropiedades();
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo actualizar la propiedad: ' + err.message,
                icon: 'error',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}

// ── Confirmar y Eliminar Propiedad ───────────────────────────────────────────
async function confirmarEliminar(id) {
    const p = propiedades.find(item => String(item.idPropiedad || item.id) === String(id));
    const nombre = p ? (p.codigo || p.calle) : 'esta propiedad';

    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Eliminar propiedad?',
            text: `Se eliminarán los registros de ${escapeHtml(nombre)}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: '#0a0f1c',
            color: '#ffffff'
        });

        if (!result.isConfirmed) return;
    }

    try {
        await deletePropiedad(id);
        propiedades = propiedades.filter(item => String(item.idPropiedad || item.id) !== String(id));
        if (window.Swal) {
            Swal.fire({
                title: 'Eliminado',
                text: 'La propiedad fue eliminada con éxito.',
                icon: 'success',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
        renderizarTabla();
    } catch (err) {
        if (window.Swal) {
            Swal.fire({
                title: 'Error',
                text: 'No se pudo eliminar la propiedad: ' + err.message,
                icon: 'error',
                confirmButtonColor: '#2473F5',
                background: '#0a0f1c',
                color: '#ffffff'
            });
        }
    }
}
