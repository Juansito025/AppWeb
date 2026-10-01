/** residentes */

import {
    getPersonas,
    getPersonasPaginado,
    getPersona,
    createPersona,
    actualizarPersona,
    deletePersona
} from '../servicios/personasService.js';

import {
    getPropiedades,
    actualizarPropiedad
} from '../servicios/propiedadesService.js';

import { getInfraccionesDetalladas, actualizarInfraccion, deleteInfraccion } from '../servicios/infraccionesService.js';
import { infraccionesDe } from '../servicios/residenteDatosService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── Estado Local ─────────────────────────────────────────────────────────────
let personas = [];
let propiedades = [];
let busqueda = '';
let filtroTipo = 'all';
let paginaActual = 1;
const itemsPorPagina = 8;
let personaSeleccionada = null;

// ── Referencias DOM ──────────────────────────────────────────────────────────
const tablaCuerpo = document.getElementById('tabla-cuerpo');
const etiquetaTotal = document.getElementById('etiqueta-total');
const entradaBusqueda = document.getElementById('entrada-busqueda');
const paginacionContenedor = document.getElementById('paginacion-residentes');

// Modales
const panelResidente = document.getElementById('panel-residente');
const formResidente = document.getElementById('residente-form');
const panelTitulo = document.getElementById('panel-titulo') || document.getElementById('panel-Título');
const btnAbrirAgregar = document.getElementById('btn-abrir-agregar');
const btnCerrarPanel = document.getElementById('btn-cerrar-panel');
const btnCancelarPanel = document.getElementById('btn-cancelar-panel');
const btnEliminarResidente = document.getElementById('btn-eliminar-residente');
const btnVerInfracciones = document.getElementById('btn-ver-infracciones-residente');
const btnGuardarResidente = document.getElementById('btn-guardar-residente');

// Campos condicionales
const tipoSelect = document.getElementById('residente-tipo-select');
const propietarioCampos = document.getElementById('propietario-campos');
const familiaCampos = document.getElementById('familia-campos');
const selectPropiedades = document.getElementById('residente-propiedad');
const selectResponsable = document.getElementById('residente-propietario-responsable');

// Modal Infracciones
const panelInfraccionesLista = document.getElementById('panel-infracciones-lista');
const btnCerrarInfracciones = document.getElementById('btn-cerrar-infracciones-lista');
const contenedorInfracciones = document.getElementById('infp-lista-contenedor');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) {
        await window.CredentialsStore.protegerVista();
    }

    await Promise.all([
        cargarPropiedades(),
        cargarResidentes()
    ]);

    configurarBusquedaYFiltros();
    configurarModales();
});

// ── Carga de Datos ───────────────────────────────────────────────────────────
async function cargarPropiedades() {
    try {
        const res = await getPropiedades();
        propiedades = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        propiedades = [];
    }
    poblarSelectPropiedades();
}

async function cargarResidentes() {
    if (tablaCuerpo) {
        tablaCuerpo.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">Cargando residentes...</td></tr>`;
    }
    try {
        const res = await getPersonas();
        personas = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        personas = [];
        console.warn('Error al cargar residentes:', e.message);
    }
    poblarSelectResponsables();
    renderizarTabla();
}

function poblarSelectPropiedades(propiedadesSeleccionadas = []) {
    if (!selectPropiedades) return;
    selectPropiedades.innerHTML = '';
    propiedades.forEach(p => {
        const id = p.idPropiedad || p.id;
        const cod = p.Código || p.codigoPropiedad || `Propiedad #${id}`;
        const dir = p.calle || p.direccionPropiedad || '';
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${cod} - ${dir}`;
        if (propiedadesSeleccionadas.includes(Number(id)) || propiedadesSeleccionadas.includes(String(id))) {
            opt.selected = true;
        }
        selectPropiedades.appendChild(opt);
    });
}

function poblarSelectResponsables() {
    if (!selectResponsable) return;
    selectResponsable.innerHTML = '<option value="">Seleccionar propietario responsable...</option>';
    const propietarios = personas.filter(p => (p.tipoPersona || '').toLowerCase() === 'propietario');
    propietarios.forEach(p => {
        const id = p.idPersona || p.idPropietario || p.id;
        const nombre = `${p.nombrePersona || ''} ${p.apellidoPersona || ''}`.trim() || p.emailPersona;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${nombre} (DUI: ${p.duiPersona || 'N/A'})`;
        selectResponsable.appendChild(opt);
    });
}

// ── Renderizado de Tabla con Búsqueda y Filtros ───────────────────────────────
async function renderizarTabla() {
    if (!tablaCuerpo) return;

    const listaFiltrada = personas.filter(p => {
        const nombreCompleto = `${p.nombrePersona || ''} ${p.apellidoPersona || ''}`.toLowerCase();
        const dui = (p.duiPersona || '').toLowerCase();
        const tel = (p.telefonoPersona || '').toLowerCase();
        const email = (p.emailPersona || '').toLowerCase();
        const termino = busqueda.toLowerCase().trim();

        const coincideTexto = !termino || nombreCompleto.includes(termino) || dui.includes(termino) || tel.includes(termino) || email.includes(termino);

        let coincideTipo = true;
        const tipoActual = (p.tipoPersona || '').toLowerCase();
        if (filtroTipo === 'owner') coincideTipo = tipoActual === 'propietario';
        if (filtroTipo === 'family') coincideTipo = tipoActual === 'familiar';
        if (filtroTipo === 'tenant') coincideTipo = tipoActual === 'inquilino';

        return coincideTexto && coincideTipo;
    });

    if (etiquetaTotal) {
        etiquetaTotal.textContent = `Residentes Totales: ${listaFiltrada.length}`;
    }

    if (listaFiltrada.length === 0) {
        tablaCuerpo.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px 16px; color: #94a3b8;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <span>No se encontraron residentes con los criterios aplicados</span>
                    </div>
                </td>
            </tr>
        `;
        renderizarPaginacion(0);
        return;
    }

    let totalPaginas;
    let itemsPagina = null;

    if (!busqueda.trim() && filtroTipo === 'all') {
        try {
            // paginacion desde la api
            const pagina = await getPersonasPaginado(paginaActual, itemsPorPagina);
            if (pagina.totalPaginas > 0 && paginaActual > pagina.totalPaginas) {
                paginaActual = pagina.totalPaginas;
                return renderizarTabla();
            }
            totalPaginas = pagina.totalPaginas;
            itemsPagina = pagina.contenido;
            if (etiquetaTotal) etiquetaTotal.textContent = `Residentes Totales: ${pagina.totalElementos}`;
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
        const id = p.idPersona || p.idPropietario || p.id;
        const nombre = `${p.nombrePersona || 'Sin nombre'} ${p.apellidoPersona || ''}`.trim();
        const dui = p.duiPersona || 'N/A';
        const tel = p.telefonoPersona || 'N/A';
        const tipo = p.tipoPersona || 'Propietario';
        const foto = p.fotoUrlPersona || p.fotoPersona || window.AVATAR_DEFECTO;

        const props = propiedades.filter(pr => String(pr.fkPersona || pr.fkPropietario) === String(id));
        const dirTexto = props.length > 0 ? props.map(pr => pr.codigo || pr.calle).join(', ') : 'Sin propiedad';

        return `
            <tr data-id="${escapeHtml(id)}">
                <td>
                    <img src="${escapeHtml(foto)}" alt="${escapeHtml(nombre)}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; " onerror="this.onerror=null;this.src=window.AVATAR_DEFECTO">
                </td>
                <td>
                    <div style="font-weight:600; color:var(--text-primary, #ffffff);">${escapeHtml(nombre)}</div>
                    <div style="font-size:12px; color:#94a3b8;">${escapeHtml(p.emailPersona || '')}</div>
                </td>
                <td style="color:#cbd5e1; font-size:13px;">${escapeHtml(dui)}</td>
                <td style="color:#cbd5e1; font-size:13px;">${escapeHtml(tel)}</td>
                <td style="color:#cbd5e1; font-size:13px;">${escapeHtml(dirTexto)}</td>
                <td>
                    <span style="padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; background:#2473F5; color:#ffffff;">
                        ${escapeHtml(tipo)}
                    </span>
                    ${p.fechaSalidaColonia ? `<span class="insignia-ya-no-reside" title="Salió el ${escapeHtml(String(p.fechaSalidaColonia).slice(0, 10))}">Ya no reside</span>` : ''}
                </td>
                <td class="col-acciones">
                    <div style="display:inline-flex; gap:8px;">
                        <a href="./ficha-residente.html?id=${encodeURIComponent(id)}" class="btn-accion-ficha" title="Ver ficha, reporte PDF y tarjeta QR" style="background:#1146D0; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; text-decoration:none;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/></svg>
                            Ficha
                        </a>
                        <button type="button" class="btn-accion-editar" data-id="${escapeHtml(id)}" title="Editar residente" style="background:#2473F5; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                        </button>
                        <button type="button" class="btn-accion-eliminar" data-id="${escapeHtml(id)}" title="Eliminar residente" style="background:#ef4444; color:#ffffff; border:none; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
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

    const filtroActivador = document.getElementById('filtro-tipo-activador');
    const filtroPanel = document.getElementById('filtro-tipo-panel');
    const filtroTexto = document.getElementById('filtro-tipo-activador-texto');

    if (filtroActivador && filtroPanel) {
        filtroActivador.onclick = (e) => {
            e.stopPropagation();
            filtroPanel.classList.toggle('abierto');
        };

        filtroPanel.querySelectorAll('.selector-opcion').forEach(opt => {
            opt.onclick = () => {
                filtroPanel.querySelectorAll('.selector-opcion').forEach(o => o.classList.remove('seleccionado'));
                opt.classList.add('seleccionado');
                filtroTipo = opt.getAttribute('data-value');
                if (filtroTexto) filtroTexto.textContent = opt.getAttribute('data-label');
                filtroPanel.classList.remove('abierto');
                paginaActual = 1;
                renderizarTabla();
            };
        });

        document.addEventListener('click', (e) => {
            if (!filtroPanel.contains(e.target) && !filtroActivador.contains(e.target)) {
                filtroPanel.classList.remove('abierto');
            }
        });
    }

    if (tipoSelect) {
        tipoSelect.onchange = () => {
            const val = tipoSelect.value;
            if (val === 'Propietario') {
                if (propietarioCampos) propietarioCampos.style.display = 'block';
                if (familiaCampos) familiaCampos.style.display = 'none';
            } else {
                if (propietarioCampos) propietarioCampos.style.display = 'none';
                if (familiaCampos) familiaCampos.style.display = 'block';
            }
        };
    }
}

// ── Configuración de Modales ─────────────────────────────────────────────────
function configurarModales() {
    if (btnAbrirAgregar) {
        btnAbrirAgregar.onclick = () => {
            personaSeleccionada = null;
            if (formResidente) formResidente.reset();
            document.getElementById('residente-id').value = '';
            if (panelTitulo) panelTitulo.textContent = 'Agregar residente';
            if (btnEliminarResidente) btnEliminarResidente.style.display = 'none';
            if (btnVerInfracciones) btnVerInfracciones.style.display = 'none';
            if (btnGuardarResidente) btnGuardarResidente.textContent = 'Crear residente';
            poblarSelectPropiedades([]);
            poblarSelectResponsables();
            if (tipoSelect) tipoSelect.value = 'Propietario';
            if (propietarioCampos) propietarioCampos.style.display = 'block';
            if (familiaCampos) familiaCampos.style.display = 'none';

            // Resetear fechas
            const inputNacimiento = document.getElementById('residente-nacimiento');
            const inputEntrada = document.getElementById('residente-entrada-colonia');
            const inputSalida = document.getElementById('residente-salida-colonia');
            if (inputNacimiento) inputNacimiento.value = '';
            // fecha de entrada
            if (inputEntrada) inputEntrada.value = fechaLocalISO();
            if (inputSalida) inputSalida.value = '';
            configurarCamposFecha(false);

            // Resetear foto
            const inputFoto = document.getElementById('residente-foto-entrada');
            const imgPreview = document.getElementById('residente-foto-img');
            const iconInicial = document.getElementById('residente-foto-inicial');
            if (inputFoto) inputFoto.value = '';
            if (imgPreview) { imgPreview.src = '../img/logo-Global.png'; imgPreview.style.display = 'none'; }
            if (iconInicial) iconInicial.style.display = 'flex';

            panelResidente.classList.add('activo');
        };
    }

    // Configurar listener para preview de foto
    const inputFoto = document.getElementById('residente-foto-entrada');
    const imgPreview = document.getElementById('residente-foto-img');
    const iconInicial = document.getElementById('residente-foto-inicial');
    const btnQuitarFoto = document.getElementById('residente-foto-quitar');

    if (inputFoto && imgPreview) {
        inputFoto.addEventListener('change', () => {
            const file = inputFoto.files && inputFoto.files[0];
            if (file) {
                imgPreview.src = URL.createObjectURL(file);
                imgPreview.style.display = 'block';
                if (iconInicial) iconInicial.style.display = 'none';
            }
        });
    }

    if (btnQuitarFoto) {
        btnQuitarFoto.onclick = () => {
            if (inputFoto) inputFoto.value = '';
            if (imgPreview) { imgPreview.src = '../img/logo-Global.png'; imgPreview.style.display = 'none'; }
            if (iconInicial) iconInicial.style.display = 'flex';
            if (personaSeleccionada) personaSeleccionada.fotoUrlPersona = null;
        };
    }

    if (btnCerrarPanel) btnCerrarPanel.onclick = () => panelResidente.classList.remove('activo');
    if (btnCancelarPanel) btnCancelarPanel.onclick = () => panelResidente.classList.remove('activo');

    if (formResidente) {
        formResidente.onsubmit = async (e) => {
            e.preventDefault();
            await guardarResidente();
        };
    }

    if (btnEliminarResidente) {
        btnEliminarResidente.onclick = async () => {
            if (personaSeleccionada) {
                const id = personaSeleccionada.idPersona || personaSeleccionada.idPropietario || personaSeleccionada.id;
                panelResidente.classList.remove('activo');
                await confirmarEliminar(id);
            }
        };
    }

    if (btnVerInfracciones) {
        btnVerInfracciones.onclick = async () => {
            if (personaSeleccionada) {
                const id = personaSeleccionada.idPersona || personaSeleccionada.idPropietario || personaSeleccionada.id;
                await mostrarInfraccionesPersona(id);
            }
        };
    }

    if (btnCerrarInfracciones) {
        btnCerrarInfracciones.onclick = () => panelInfraccionesLista.classList.remove('activo');
    }
}

// ── Fechas del residente ─────────────────────────────────────────────────────
const FECHA_MINIMA_NACIMIENTO = '1900-01-01';

/** fechas al crear */
function configurarCamposFecha(esEdicion, fechaEntrada = '') {
    const hoy = fechaLocalISO();
    const nacimiento = document.getElementById('residente-nacimiento');
    const salida = document.getElementById('residente-salida-colonia');
    const campoSalida = document.getElementById('residente-campo-salida');
    if (nacimiento) { nacimiento.min = FECHA_MINIMA_NACIMIENTO; nacimiento.max = hoy; }
    if (salida) { salida.min = fechaEntrada || ''; salida.max = hoy; }
    if (campoSalida) campoSalida.hidden = !esEdicion;
}

/** Devuelve el mensaje de error o '' si las fechas son coherentes. */
function validarFechasResidente(nacimiento, entrada, salida) {
    const hoy = fechaLocalISO();
    const valida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(new Date(`${f}T12:00:00`).getTime());
    if (nacimiento) {
        if (!valida(nacimiento)) return 'La fecha de nacimiento no es válida.';
        if (nacimiento > hoy) return 'La fecha de nacimiento no puede ser futura.';
        if (nacimiento < FECHA_MINIMA_NACIMIENTO) return 'La fecha de nacimiento no es válida.';
    }
    if (salida) {
        if (!valida(salida)) return 'La fecha de salida no es válida.';
        if (salida > hoy) return 'La fecha de salida no puede ser futura.';
        if (entrada && salida < entrada) return 'La fecha de salida no puede ser anterior a la fecha de entrada.';
    }
    return '';
}

// ── Guardar / Editar Residente ───────────────────────────────────────────────
async function guardarResidente() {
    const id = document.getElementById('residente-id')?.value;
    const nombre = document.getElementById('residente-nombre')?.value.trim();
    const apellido = document.getElementById('residente-apellido')?.value.trim();
    const dui = document.getElementById('residente-dui')?.value.trim();
    const telInput = document.getElementById('residente-telefono') || document.getElementById('residente-Teléfono');
    const telefono = telInput ? telInput.value.trim() : '';
    const email = document.getElementById('residente-email')?.value.trim();
    const password = document.getElementById('residente-password')?.value.trim();
    const fechaNacimiento = document.getElementById('residente-nacimiento')?.value || null;
    // fecha de entrada
    const fechaEntrada = id
        ? (String(personaSeleccionada?.fechaEntradaColonia || '').slice(0, 10) || fechaLocalISO())
        : fechaLocalISO();
    // fecha de salida
    const fechaSalida = id ? (document.getElementById('residente-salida-colonia')?.value || null) : null;
    const tipo = document.getElementById('residente-tipo-select')?.value || 'Propietario';
    const idResponsable = document.getElementById('residente-propietario-responsable')?.value || null;

    if (!nombre || !apellido || !telefono || !email) {
        if (window.Swal) Swal.fire('Campos requeridos', 'Por favor llena los campos obligatorios (Nombre, Apellido, Teléfono, Correo).', 'warning');
        return;
    }

    const errorFecha = validarFechasResidente(fechaNacimiento, fechaEntrada, fechaSalida);
    if (errorFecha) {
        if (window.Swal) Swal.fire('Fecha no válida', errorFecha, 'warning');
        return;
    }

    // al crear es obligatoria; al editar solo se valida si se escribio una nueva
    if (!id || password) {
        const errorPass = window.errorContrasena ? window.errorContrasena(password) : (String(password || '').length < 8 ? 'La contraseña debe tener al menos 8 caracteres.' : '');
        if (errorPass) {
            if (window.Swal) Swal.fire(!id && !password ? 'Contraseña requerida' : 'Contraseña no válida', errorPass + '.', 'warning');
            return;
        }
    }

    if (tipo !== 'Propietario' && !idResponsable) {
        if (window.Swal) Swal.fire('Responsable requerido', 'Para familiares o inquilinos debes seleccionar al Propietario Responsable.', 'warning');
        return;
    }

    const fileFoto = document.getElementById('residente-foto-entrada')?.files?.[0];
    // subir foto
    const fotoUrlPersona = personaSeleccionada?.fotoUrlPersona || null;
    if (fileFoto && window.FotosService) {
        try {
            window.FotosService.validarImagen(fileFoto);
        } catch (e) {
            if (window.Swal) Swal.fire('Foto no válida', e.message, 'warning');
            return;
        }
    }

    const payload = {
        idPersona: id || null,
        nombrePersona: nombre,
        apellidoPersona: apellido,
        tipoPersona: tipo,
        emailPersona: email,
        duiPersona: dui || null,
        telefonoPersona: telefono,
        fotoUrlPersona: fotoUrlPersona,
        passwordHashPersona: password || null,
        fechaNacimientoPersona: fechaNacimiento,
        fechaEntradaColonia: fechaEntrada,
        fechaSalidaColonia: fechaSalida,
        idPersonaResponsable: tipo !== 'Propietario' ? idResponsable : null
    };

    try {
        if (window.Swal) Swal.showLoading();
        let guardado = null;
        if (id) {
            guardado = await actualizarPersona(id, payload);
        } else {
            guardado = await createPersona(payload);
        }

        const idGenerado = id || (guardado?.idPersona || guardado?.id || guardado?.data?.idPersona);

        let avisoFoto = '';
        if (fileFoto && idGenerado && window.FotosService) {
            try {
                await window.FotosService.subirFotoPersona(idGenerado, fileFoto);
            } catch (e) {
                avisoFoto = ' Pero la foto no se pudo subir: ' + e.message;
            }
        }

        if (tipo === 'Propietario' && selectPropiedades && idGenerado) {
            const propsSeleccionadas = Array.from(selectPropiedades.selectedOptions).map(o => o.value);
            for (const propId of propsSeleccionadas) {
                const propActual = propiedades.find(pr => String(pr.idPropiedad || pr.id) === String(propId));
                if (propActual) {
                    await actualizarPropiedad(propId, {
                        ...propActual,
                        fkPersona: idGenerado,
                        fkPropietario: idGenerado
                    }).catch(() => {});
                }
            }
        }

        panelResidente.classList.remove('activo');
        if (window.Swal) Swal.fire(avisoFoto ? 'Guardado con aviso' : '¡Éxito!', 'Residente guardado exitosamente.' + avisoFoto, avisoFoto ? 'warning' : 'success');
        await Promise.all([cargarPropiedades(), cargarResidentes()]);
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo guardar el residente: ' + err.message, 'error');
    }
}

// ── Abrir Modal Edición ──────────────────────────────────────────────────────
async function abrirModalEditar(id) {
    personaSeleccionada = personas.find(p => String(p.idPersona || p.idPropietario || p.id) === String(id));
    if (!personaSeleccionada) {
        try {
            personaSeleccionada = await getPersona(id);
        } catch (e) { return; }
    }
    if (!personaSeleccionada) return;

    document.getElementById('residente-id').value = id;
    document.getElementById('residente-nombre').value = personaSeleccionada.nombrePersona || '';
    document.getElementById('residente-apellido').value = personaSeleccionada.apellidoPersona || '';
    document.getElementById('residente-dui').value = personaSeleccionada.duiPersona || '';
    const elTel = document.getElementById('residente-telefono') || document.getElementById('residente-Teléfono');
    if (elTel) elTel.value = personaSeleccionada.telefonoPersona || '';
    document.getElementById('residente-email').value = personaSeleccionada.emailPersona || '';
    document.getElementById('residente-password').value = '';

    const inputNacimiento = document.getElementById('residente-nacimiento');
    const inputEntrada = document.getElementById('residente-entrada-colonia');
    const inputSalida = document.getElementById('residente-salida-colonia');
    if (inputNacimiento) inputNacimiento.value = personaSeleccionada.fechaNacimientoPersona ? personaSeleccionada.fechaNacimientoPersona.slice(0, 10) : '';
    if (inputEntrada) inputEntrada.value = personaSeleccionada.fechaEntradaColonia ? personaSeleccionada.fechaEntradaColonia.slice(0, 10) : fechaLocalISO();
    if (inputSalida) inputSalida.value = personaSeleccionada.fechaSalidaColonia ? personaSeleccionada.fechaSalidaColonia.slice(0, 10) : '';
    configurarCamposFecha(true, inputEntrada ? inputEntrada.value : '');

    const tipo = personaSeleccionada.tipoPersona || 'Propietario';
    if (tipoSelect) tipoSelect.value = tipo;

    const propsDelPropietario = propiedades.filter(pr => String(pr.fkPersona || pr.fkPropietario) === String(id)).map(pr => pr.idPropiedad || pr.id);
    poblarSelectPropiedades(propsDelPropietario);
    poblarSelectResponsables();

    if (tipo === 'Propietario') {
        if (propietarioCampos) propietarioCampos.style.display = 'block';
        if (familiaCampos) familiaCampos.style.display = 'none';
    } else {
        if (propietarioCampos) propietarioCampos.style.display = 'none';
        if (familiaCampos) familiaCampos.style.display = 'block';
        if (selectResponsable && personaSeleccionada.idPersonaResponsable) {
            selectResponsable.value = personaSeleccionada.idPersonaResponsable;
        }
    }

    if (panelTitulo) panelTitulo.textContent = 'Editar residente';
    if (btnEliminarResidente) btnEliminarResidente.style.display = 'inline-block';
    if (btnGuardarResidente) btnGuardarResidente.textContent = 'Guardar cambios';

    // Cargar foto existente
    const imgPreview = document.getElementById('residente-foto-img');
    const iconInicial = document.getElementById('residente-foto-inicial');
    const inputFoto = document.getElementById('residente-foto-entrada');
    if (inputFoto) inputFoto.value = '';
    if (personaSeleccionada.fotoUrlPersona) {
        if (imgPreview) {
            imgPreview.src = personaSeleccionada.fotoUrlPersona;
            imgPreview.style.display = 'block';
        }
        if (iconInicial) iconInicial.style.display = 'none';
    } else {
        if (imgPreview) {
            imgPreview.src = '../img/logo-Global.png';
            imgPreview.style.display = 'none';
        }
        if (iconInicial) iconInicial.style.display = 'flex';
    }

    panelResidente.classList.add('activo');
}

// ── Confirmar y Eliminar ─────────────────────────────────────────────────────
async function confirmarEliminar(id) {
    const p = personas.find(item => String(item.idPersona || item.idPropietario || item.id) === String(id));
    const nombre = p ? `${p.nombrePersona} ${p.apellidoPersona}` : 'este residente';

    if (window.Swal) {
        const result = await Swal.fire({
            title: '¿Eliminar residente?',
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
        await deletePersona(id);
        personas = personas.filter(item => String(item.idPersona || item.idPropietario || item.id) !== String(id));
        if (window.Swal) Swal.fire('Eliminado', 'El residente fue eliminado con éxito.', 'success');
        renderizarTabla();
    } catch (err) {
        if (window.Swal) Swal.fire('Error', 'No se pudo eliminar el residente: ' + err.message, 'error');
    }
}

// ── Ver Infracciones del Residente ───────────────────────────────────────────
async function mostrarInfraccionesPersona(idPersona) {
    if (!contenedorInfracciones) return;
    contenedorInfracciones.innerHTML = '<p style="color:#94a3b8; padding:20px; text-align:center;">Cargando infracciones...</p>';
    panelInfraccionesLista.classList.add('activo');

    try {
        // infracciones del residente
        const aLista = (r) => Array.isArray(r) ? r : (r?.data || []);
        const [infracciones, incidentes, gravedades] = await Promise.all([
            getInfraccionesDetalladas().then(aLista),
            apiFetch('/incidentes', { silencioso: true }).then(aLista).catch(() => []),
            apiFetch('/gravedadInfracciones', { silencioso: true }).then(aLista).catch(() => [])
        ]);
        const infraccionesPersona = infraccionesDe(idPersona, { infracciones, incidentes, gravedades });

        if (infraccionesPersona.length === 0) {
            contenedorInfracciones.innerHTML = '<p style="color:#94a3b8; padding:20px; text-align:center;">No registra infracciones activas.</p>';
            return;
        }

        const estados = ['Pendiente', 'Pagada', 'Impugnada', 'Anulada'];
        contenedorInfracciones.innerHTML = infraccionesPersona.map(inf => {
            const idInf = inf.idInfraccion || inf.id;
            const estadoActual = inf.estado || 'Pendiente';
            return `
            <div class="infp-item" data-id-Infracción="${escapeHtml(idInf)}" style="padding:14px; background:#ffffff08; border:1px solid #ffffff14; border-radius:8px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#ffffff;">Infracción #${escapeHtml(idInf)}</strong>
                    <span style="background:#ef4444; color:#ffffff; padding:2px 8px; border-radius:4px; font-size:11px;">$${escapeHtml(Number(inf.monto || 0).toFixed(2))}</span>
                </div>
                <p style="color:#94a3b8; font-size:13px; margin:6px 0;">${escapeHtml(inf.motivo || 'Infracción de convivencia')}</p>
                <div style="display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;">
                    <label style="font-size:12px; color:#64748b;">Estado:</label>
                    <select class="infp-select-estado seleccion-formulario" style="flex:1; min-width:120px;">
                        ${estados.map(e => `<option value="${escapeHtml(e)}" ${e === estadoActual ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}
                    </select>
                    <button type="button" class="btn-primary infp-btn-guardar" style="padding:4px 10px; font-size:12px;">Guardar</button>
                    <button type="button" class="btn-secondary infp-btn-eliminar" style="padding:4px 10px; font-size:12px;">Eliminar</button>
                </div>
            </div>
        `;
        }).join('');

        contenedorInfracciones.querySelectorAll('.infp-item').forEach(item => {
            const idInf = item.getAttribute('data-id-Infracción');
            const infraccionOriginal = infraccionesPersona.find(i => String(i.idInfraccion || i.id) === String(idInf));

            const btnGuardar = item.querySelector('.infp-btn-guardar');
            const selectEstado = item.querySelector('.infp-select-estado');
            if (btnGuardar && selectEstado) {
                btnGuardar.onclick = async () => {
                    const nuevoEstado = selectEstado.value;
                    btnGuardar.disabled = true;
                    try {
                        const { idInfraccion, fkTipoInfraccion, fkIncidente, monto } = infraccionOriginal;
                        await actualizarInfraccion(idInf, { idInfraccion, fkTipoInfraccion, fkIncidente, monto, estado: nuevoEstado });
                        if (window.Swal) Swal.fire('Actualizado', 'El estado de la infracción fue actualizado.', 'success');
                    } catch (err) {
                        if (window.Swal) Swal.fire('Error', 'No se pudo actualizar la infracción: ' + err.message, 'error');
                    } finally {
                        btnGuardar.disabled = false;
                    }
                };
            }

            const btnEliminar = item.querySelector('.infp-btn-eliminar');
            if (btnEliminar) {
                btnEliminar.onclick = async () => {
                    let confirmado = true;
                    if (window.Swal) {
                        const result = await Swal.fire({
                            title: '¿Eliminar infracción?',
                            text: 'Esta acción no se puede deshacer.',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Eliminar',
                            cancelButtonText: 'Cancelar'
                        });
                        confirmado = result.isConfirmed;
                    }
                    if (!confirmado) return;

                    try {
                        await deleteInfraccion(idInf);
                        item.remove();
                        if (window.Swal) Swal.fire('Eliminada', 'La infracción fue eliminada.', 'success');
                        if (!contenedorInfracciones.querySelector('.infp-item')) {
                            contenedorInfracciones.innerHTML = '<p style="color:#94a3b8; padding:20px; text-align:center;">No registra infracciones activas.</p>';
                        }
                    } catch (err) {
                        if (window.Swal) Swal.fire('Error', 'No se pudo eliminar la infracción: ' + err.message, 'error');
                    }
                };
            }
        });
    } catch (e) {
        contenedorInfracciones.innerHTML = '<p style="color:#ef4444; padding:20px; text-align:center;">No se pudieron cargar las infracciones.</p>';
    }
}