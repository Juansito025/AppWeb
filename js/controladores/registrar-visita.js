/** registro de visitas */

import { createVisita, getVisitas, actualizarVisita, deleteVisita } from '../servicios/visitasService.js';
import { getPersonas } from '../servicios/personasService.js';
import { createPaseQR } from '../servicios/pasesQRService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── Estado global ──────────────────────────────────────────────────
let transporteSeleccionado = '';
let residentesCache  = [];
let visitasCache     = [];

// ── Llenar select de residentes ────────────────────────────────────
async function cargarResidentes() {
    try {
        const datos = await getPersonas();
        residentesCache = Array.isArray(datos) ? datos : [];
    } catch (e) {
        residentesCache = [];
        console.warn('No se pudo cargar personas:', e.message);
    }
    llenarSelectResidentes();
}

function llenarSelectResidentes() {
    const select = document.getElementById('seleccionar-residente');
    if (!select) return;

    const seleccionActual = select.value;
    select.innerHTML = '<option value="" disabled selected>Selecciona un residente...</option>';

    residentesCache.forEach(function (r) {
        const opt  = document.createElement('option');
        opt.value  = r.idPersona || r.id || '';
        const nombre = `${r.nombrePersona || r.firstName || ''} ${r.apellidoPersona || r.lastName || ''}`.trim();
        opt.textContent = nombre;
        select.appendChild(opt);
    });

    if (seleccionActual) select.value = seleccionActual;
    if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(select);
}

function llenarSelectResidentesEn(selectEl, valorSeleccionado) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Selecciona un residente...</option>';
    residentesCache.forEach(function (r) {
        const opt  = document.createElement('option');
        opt.value  = r.idPersona || r.id || '';
        const nombre = `${r.nombrePersona || r.firstName || ''} ${r.apellidoPersona || r.lastName || ''}`.trim();
        opt.textContent = nombre;
        selectEl.appendChild(opt);
    });
    selectEl.value = valorSeleccionado || '';
    if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(selectEl);
}

// ── Cargar visitas registradas ─────────────────────────────────────
async function cargarVisitas() {
    try {
        const datos = await getVisitas();
        visitasCache = Array.isArray(datos) ? datos : [];
    } catch (e) {
        visitasCache = [];
        console.warn('No se pudo cargar visitas:', e.message);
    }
    renderPanelRenovar();
}

// ── Transporte ─────────────────────────────────────────────────────
function actualizarTransporte(tipo) {
    transporteSeleccionado = tipo;

    const hint           = document.getElementById('info-personal-ayuda');
    const fields         = document.getElementById('info-personal-campos');
    const campoMatricula = document.getElementById('campo-matricula') || document.getElementById('campo-Matrícula');
    const campoTipoVeh   = document.getElementById('campo-tipo-vehiculo') || document.getElementById('campo-tipo-Vehículo');

    if (hint)   hint.style.display   = 'none';
    if (fields) fields.style.display = '';

    const esVehiculo = tipo === 'Vehículo';
    if (campoMatricula) campoMatricula.style.display = esVehiculo ? '' : 'none';
    if (campoTipoVeh)   campoTipoVeh.style.display   = esVehiculo ? '' : 'none';

    const inputMatricula     = document.getElementById('entrada-matricula') || document.getElementById('entrada-Matrícula');
    const selectTipoVehiculo = document.getElementById('seleccionar-tipo-vehiculo') || document.getElementById('seleccionar-tipo-Vehículo');
    if (!esVehiculo) {
        if (inputMatricula)     inputMatricula.value     = '';
        if (selectTipoVehiculo) selectTipoVehiculo.value = '';
    }
}

function actualizarTransporteReset() {
    transporteSeleccionado = '';
    const el = {
        ayuda:    document.getElementById('info-personal-ayuda'),
        campos:   document.getElementById('info-personal-campos'),
        Matrícula: document.getElementById('campo-matricula') || document.getElementById('campo-Matrícula'),
        tipoVeh:  document.getElementById('campo-tipo-vehiculo') || document.getElementById('campo-tipo-Vehículo')
    };
    if (el.ayuda)    el.ayuda.style.display    = '';
    if (el.campos)   el.campos.style.display   = 'none';
    if (el.Matrícula) el.Matrícula.style.display = 'none';
    if (el.tipoVeh)  el.tipoVeh.style.display  = 'none';
}

// ── Limpiar formulario ─────────────────────────────────────────────
function cancelarFormulario() {
    const sel = document.getElementById('seleccionar-residente');
    if (sel) sel.selectedIndex = 0;
    ['entrada-nombre', 'entrada-dui', 'entrada-matricula', 'entrada-Matrícula', 'entrada-telefono', 'entrada-Teléfono', 'entrada-observaciones']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('input[name="transporte"]').forEach(r => r.checked = false);
    const sv = document.getElementById('seleccionar-tipo-vehiculo') || document.getElementById('seleccionar-tipo-Vehículo');
    if (sv) sv.value = '';
    actualizarTransporteReset();
}

// ── Abrir confirmación ─────────────────────────────────────────────
function abrirConfirmacion() {
    if (window.KeeperValida && !window.KeeperValida.revisar(['entrada-nombre', 'entrada-telefono', 'entrada-matricula'])) return;
    const elTel = document.getElementById('entrada-telefono') || document.getElementById('entrada-Teléfono');
    const camposRequeridos = [
        { el: document.getElementById('seleccionar-residente'), msg: 'Selecciona el residente a visitar' },
        { el: document.getElementById('entrada-nombre'),        msg: 'El nombre del visitante es requerido' },
        { el: elTel,                                           msg: 'El número de teléfono es requerido' }
    ];

    let esValido = true;
    const marcarError = (el) => {
        if (!el) return;
        el.classList.remove('error-entrada');
        void el.offsetWidth;
        el.classList.add('error-entrada');
        esValido = false;
    };

    for (const campo of camposRequeridos) {
        const el = campo.el;
        if (!el || !el.value.trim()) {
            if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion(campo.msg, 'error');
            marcarError(el);
        }
    }

    const formatoInvalido = (el, regex, msg) => {
        if (el && el.value.trim() && !regex.test(el.value.trim())) {
            if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion(msg, 'error');
            marcarError(el);
        }
    };
    formatoInvalido(elTel, /^[2-7]\d{3}-\d{4}$/, 'El teléfono debe tener el formato 0000-0000');
    formatoInvalido(document.getElementById('entrada-dui'), /^\d{8}-\d$/, 'El DUI debe tener el formato 00000000-0');

    if (!transporteSeleccionado) {
        if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Por favor selecciona un medio de transporte.', 'error');
        esValido = false;
    } else if (transporteSeleccionado === 'Vehículo') {
        const matriculaInput     = document.getElementById('entrada-matricula') || document.getElementById('entrada-Matrícula');
        const tipoVehiculoSelect = document.getElementById('seleccionar-tipo-vehiculo') || document.getElementById('seleccionar-tipo-Vehículo');
        if (!matriculaInput || !matriculaInput.value.trim()) {
            if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('La matrícula del vehículo es requerida', 'error');
            marcarError(matriculaInput);
        } else {
            formatoInvalido(matriculaInput, /^[A-Za-z]{1,2}[0-9A-Fa-f]{3}-[0-9A-Fa-f]{3}$/, 'La placa debe tener el formato P000-000');
        }
        if (tipoVehiculoSelect && !tipoVehiculoSelect.value) {
            if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Selecciona el tipo de vehículo', 'error');
            const envoltura = tipoVehiculoSelect._customDesplegableWrapper || tipoVehiculoSelect;
            envoltura.classList.remove('error-entrada');
            void envoltura.offsetWidth;
            envoltura.classList.add('error-entrada');
            esValido = false;
        }
    }

    if (!esValido) return;

    const select         = document.getElementById('seleccionar-residente');
    const residenteId    = select ? select.value : '';
    const residente      = residentesCache.find(r => (r.idPersona || r.id) == residenteId);
    const nombre         = (document.getElementById('entrada-nombre')?.value || '').trim();
    const Teléfono       = (elTel?.value || '').trim();
    const dui            = (document.getElementById('entrada-dui')?.value || '').trim();
    const Matrícula      = (document.getElementById('entrada-matricula') || document.getElementById('entrada-Matrícula'))?.value?.trim() || '';
    const tipoVehiculo   = (document.getElementById('seleccionar-tipo-vehiculo') || document.getElementById('seleccionar-tipo-Vehículo'))?.value || '';
    const observaciones  = (document.getElementById('entrada-observaciones')?.value || '').trim();
    const nombreResidente = residente
        ? `${residente.nombrePersona || residente.firstName || ''} ${residente.apellidoPersona || residente.lastName || ''}`.trim()
        : '';

    const setOvl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setOvl('ovl-residente',  nombreResidente || '—');
    setOvl('ovl-nombre',     nombre       || '—');
    setOvl('ovl-transporte', transporteSeleccionado || '—');
    setOvl('ovl-dui',        dui          || '—');
    setOvl('ovl-telefono',   Teléfono     || '—');
    setOvl('ovl-Teléfono',   Teléfono     || '—');

    const esVehiculo = transporteSeleccionado === 'Vehículo';
    const ovlDivMat = document.getElementById('ovl-div-matricula') || document.getElementById('ovl-div-Matrícula');
    const ovlMatEl  = document.getElementById('ovl-matricula') || document.getElementById('ovl-Matrícula');
    const ovlDivObs = document.getElementById('ovl-div-obs');
    const ovlObs    = document.getElementById('ovl-observaciones');

    if (ovlDivMat) ovlDivMat.style.display  = esVehiculo ? '' : 'none';
    if (ovlMatEl)  ovlMatEl.textContent      = esVehiculo ? `${Matrícula || '—'}${tipoVehiculo ? ' · ' + tipoVehiculo : ''}` : '—';
    if (ovlDivObs) ovlDivObs.style.display   = observaciones ? '' : 'none';
    if (ovlObs)    ovlObs.textContent        = observaciones || '—';

    const capa = document.getElementById('capa');
    if (capa) capa.classList.add('activo');
}

function cerrarConfirmacion(event) {
    if (event && event.target !== event.currentTarget && event.type === 'click' && event.target.id !== 'capa') {
        if (!event.target.closest('.ovl-btn-cancelar') && event.target.id !== 'capa') return;
    }
    const capa = document.getElementById('capa');
    if (capa) capa.classList.remove('activo');
}

function generarCodigoPaseUnico() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const entropy = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()
        : Math.random().toString(36).substring(2, 8).toUpperCase();
    return `KP-VIS-${timestamp}-${entropy}`;
}

// ── Pase QR: generar imagen, mostrar y descargar ─────────────────
/** contenido corto y solo ascii: el escaner solo necesita el id del pase */
function textoPaseQR(paseId) {
    return JSON.stringify({ keeper: 'pase-acceso-qr', paseId: String(paseId) });
}

/** genera el qr en un canvas fuera de pantalla y devuelve un png (data url) */
function generarImagenQR(texto) {
    if (typeof QRCode === 'undefined') throw new Error('No se cargó la librería de códigos QR. Revisa tu conexión y recarga la página.');
    const temporal = document.createElement('div');
    temporal.style.cssText = 'position:fixed; left:-9999px; top:0;';
    document.body.appendChild(temporal);
    try {
        new QRCode(temporal, {
            text: texto,
            width: 320,
            height: 320,
            colorDark: '#0a0f1c',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
        const canvas = temporal.querySelector('canvas');
        if (canvas) {
            // margen blanco alrededor para que cualquier lector lo detecte
            const margen = 32;
            const final = document.createElement('canvas');
            final.width = canvas.width + margen * 2;
            final.height = canvas.height + margen * 2;
            const ctx = final.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, final.width, final.height);
            ctx.drawImage(canvas, margen, margen);
            return final.toDataURL('image/png');
        }
        const img = temporal.querySelector('img');
        if (img && img.src) return img.src;
        throw new Error('El navegador no pudo dibujar el código QR.');
    } finally {
        temporal.remove();
    }
}

function nombreArchivoSeguro(texto) {
    return String(texto || 'pase').replace(/[^A-Za-z0-9_-]+/g, '-');
}

/** muestra el pase con la imagen del qr y un boton de descarga que no cierra el modal */
async function mostrarPaseQR({ titulo, mensaje, paseId, codigo, archivo, notaPie }) {
    let imagen = '';
    let errorQR = '';
    try {
        imagen = generarImagenQR(textoPaseQR(paseId));
    } catch (e) {
        console.error('Error al generar el QR:', e);
        errorQR = e.message;
    }
    const nombreArchivo = `${nombreArchivoSeguro(archivo)}.png`;

    await Swal.fire({
        title: titulo,
        html: `
            <div style="font-family: inherit; text-align: center;">
                <p style="color: #94a3b8; font-size: 14px; margin: 0 0 8px;">${mensaje}</p>
                ${imagen
                    ? `<div style="display:flex; justify-content:center; align-items:center; margin: 14px auto; padding: 12px; background: #ffffff; border-radius: 14px; width: 204px; height: 204px; box-sizing: border-box;">
                           <img src="${imagen}" alt="Código QR del pase" width="180" height="180" style="display:block; width:180px; height:180px; image-rendering: pixelated;">
                       </div>`
                    : `<p style="color:#f87171; font-size:13px; margin: 14px 0;">No se pudo generar la imagen del QR: ${escapeHtml(errorQR)}</p>`}
                <div style="font-family: monospace; font-size: 14px; font-weight: bold; color: #60a5fa; letter-spacing: 1px; margin-bottom: 10px; word-break: break-all;">
                    ${escapeHtml(codigo)}
                </div>
                ${imagen
                    ? `<a href="${imagen}" download="${escapeHtml(nombreArchivo)}" id="swal-descargar-qr"
                          style="display:inline-flex; align-items:center; gap:8px; padding:9px 16px; border-radius:10px; background:#1a2238; color:#ffffff; font-size:13px; font-weight:600; text-decoration:none; border:1px solid #2473f566; margin-bottom: 12px;">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                           Descargar QR (PNG)
                       </a>`
                    : ''}
                <div>
                    <span style="display: inline-block; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; background: #f59e0b; color: #1a1300; margin-bottom: 10px;">
                        PENDIENTE · el residente debe aprobarla en su app
                    </span>
                </div>
                <p style="font-size: 12.5px; color: #64748b; margin: 4px 0 0;">${notaPie}</p>
            </div>
        `,
        confirmButtonText: 'Listo',
        confirmButtonColor: '#2473F5',
        background: '#0a0f1c',
        color: '#ffffff',
        customClass: { popup: 'swal-keeper', confirmButton: 'btn-guardar' }
    });
}

// guardar visita
async function confirmarRegistro() {
    const select       = document.getElementById('seleccionar-residente');
    const residenteId  = select ? select.value : '';
    const residente    = residentesCache.find(r => (r.idPersona || r.id) == residenteId);
    const nombreResidente = residente ? `${residente.nombrePersona || ''} ${residente.apellidoPersona || ''}`.trim() : 'Residente';
    const nombre       = (document.getElementById('entrada-nombre')?.value || '').trim();
    const transporte   = transporteSeleccionado || 'Peatonal';
    const dui          = (document.getElementById('entrada-dui')?.value || '').trim();
    const Matrícula    = (document.getElementById('entrada-matricula') || document.getElementById('entrada-Matrícula'))?.value?.trim() || '';
    const tipoVehiculo = (document.getElementById('seleccionar-tipo-vehiculo') || document.getElementById('seleccionar-tipo-Vehículo'))?.value || '';
    const Teléfono     = (document.getElementById('entrada-telefono') || document.getElementById('entrada-Teléfono'))?.value?.trim() || '';
    const observaciones = (document.getElementById('entrada-observaciones')?.value || '').trim();
    const ahora        = fechaHoraLocalISO();

    // Generar código de pase único irrepetible
    const codigoGenerado = generarCodigoPaseUnico();

    try {
        const payload = {
            codigoQr:         codigoGenerado,
            nombreVisitante:  nombre,
            duiVisitante:     dui || null,
            telefonoVisitante: Teléfono,
            tipoTransporte:   transporte,
            tipoVisitante:    document.getElementById('seleccionar-tipo-visitante')?.value || 'Otro',
            matriculaVehiculo: Matrícula || null,
            tipoVehiculo:     tipoVehiculo || null,
            observaciones:    observaciones || null,
            horaEntrada:      ahora,
            estadoVisita:     'inactivo', // Inicia inactivo hasta que el residente lo activa desde la app móvil
            fkPersona: residenteId ? { idPersona: residenteId } : null
        };

        const resVisita = await createVisita(payload);
        const visitaCreada = resVisita?.data || resVisita;
        const idVisita = visitaCreada?.idVisitas || visitaCreada?.idVisita || visitaCreada?.id;

        let nuevoPase = null;
        let errorPase = '';
        if (idVisita) {
            try {
                const hoy = fechaLocalISO();
                const resPase = await createPaseQR({
                    tipoPase: 'Visita',
                    fechaInicioPase: hoy,
                    duracionPase: hoy,
                    paseActivo: 's',
                    fkVisitas: idVisita
                });
                nuevoPase = resPase?.data || resPase;
            } catch (ePase) {
                console.warn('Aviso al generar pase QR en backend:', ePase.message);
                errorPase = ePase.message;
            }
        }
        // generar qr
        const paseIdFinal = nuevoPase?.idPaseAcceso || nuevoPase?.id || null;
        if (!paseIdFinal) {
            const capaErr = document.getElementById('capa');
            if (capaErr) capaErr.classList.remove('activo');
            cancelarFormulario();
            if (window.Swal) Swal.fire('Visita registrada sin pase QR', 'La visita se guardó, pero la API no generó el pase QR' + (errorPase ? ': ' + errorPase : '.'), 'warning');
            return;
        }

        const capa = document.getElementById('capa');
        if (capa) capa.classList.remove('activo');
        cancelarFormulario();
        await mostrarPaseQR({
            titulo: '¡Pase QR Creado!',
            mensaje: `El pase ha sido enviado al residente <strong>${escapeHtml(nombreResidente)}</strong>.`,
            paseId: paseIdFinal,
            codigo: codigoGenerado,
            archivo: `KEEPER-PASE-${codigoGenerado}`,
            notaPie: 'El residente recibirá la notificación en su celular y al activarlo, el visitante podrá usar este código en caseta.'
        });

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al registrar',
            text: err.message || 'No se pudo generar el pase de visita',
            background: '#0a0f1c',
            color: '#fff',
            confirmButtonColor: '#ef4444'
        });
    }
}

// ── Panel Renovar (historial de visitas) ───────────────────────────
function renderPanelRenovar(filtro = '') {
    const cont = document.getElementById('lista-renovaciones');
    if (!cont) return;

    let visitas = visitasCache.slice().reverse();
    if (filtro.trim()) {
        const query = filtro.toLowerCase().trim();
        visitas = visitas.filter(v => {
            const vis = (v.nombreVisitante || v.visitorName || '').toLowerCase();
            return vis.includes(query);
        });
    }

    if (!visitas.length) {
        cont.innerHTML = '<p class="vacio-fila">Aún no hay visitas registradas.</p>';
        return;
    }

    cont.innerHTML = visitas.map(function (v) {
        const id     = v.idVisita   || v.id     || '';
        const vis    = v.nombreVisitante || v.nombre  || '—';
        const trans  = v.tipoTransporte  || v.transporte || '—';
        const hora   = v.horaEntrada     || v.hora    || '—';
        const estado = v.estadoVisita    || v.estado   || 'activo';
        const activa = estado === 'activo';
        const fecha  = hora !== '—' ? new Date(hora).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        return `
            <div class="elemento-renovacion" data-id="${escapeHtml(id)}">
                <div class="informacion-elemento-renovacion">
                    <span class="nombre-elemento-renovacion">${escapeHtml(vis)}</span>
                    <span class="metadatos-elemento-renovacion">${escapeHtml(trans)} · ${escapeHtml(fecha)}</span>
                </div>
                <span class="pildora-estado-visita ${activa ? 'activo' : 'inactivo'}">${activa ? 'Activo' : 'Inactivo'}</span>
                <div class="acciones-elemento-renovacion">
                    ${activa
                        ? `<button type="button" class="btn-mini btn-mini-desactivar" data-action="desactivar">Desactivar</button>`
                        : `<button type="button" class="btn-mini btn-mini-en" data-action="renovar">Renovar visita</button>`}
                    <button type="button" class="btn-mini btn-mini-eliminar" data-action="eliminar">Eliminar</button>
                </div>
            </div>
        `;
    }).join('');
}

function abrirPanelRenovar() {
    renderPanelRenovar();
    const panel = document.getElementById('panel-renovar');
    if (panel) panel.classList.add('activo');
}

function cerrarPanelRenovar() {
    const panel = document.getElementById('panel-renovar');
    if (panel) panel.classList.remove('activo');
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    actualizarTransporteReset();
    await cargarResidentes();

    // Búsqueda en historial
    const inputBuscar = document.getElementById('entrada-buscar-visita');
    if (inputBuscar) inputBuscar.addEventListener('input', function (e) { renderPanelRenovar(e.target.value); });

    // Panel renovar
    const btnRenovar = document.getElementById('btn-abrir-renovar');
    if (btnRenovar) btnRenovar.addEventListener('click', abrirPanelRenovar);
    const btnCerrarRen = document.getElementById('btn-cerrar-renovar');
    if (btnCerrarRen) btnCerrarRen.addEventListener('click', cerrarPanelRenovar);

    const panelRenovar = document.getElementById('panel-renovar');
    const panelEditarRen = document.getElementById('panel-editar-renovar');
    const formEditarRen = document.getElementById('form-editar-renovar');
    let visitaEnEdicion = null;

    function abrirEditarRenovar(id) {
        visitaEnEdicion = visitasCache.find(v => (v.idVisita || v.id) == id);
        if (!visitaEnEdicion) return;

        cerrarPanelRenovar();

        const elId = document.getElementById('er-id');
        const elRes = document.getElementById('er-residente');
        const elNom = document.getElementById('er-nombre');
        const elTrans = document.getElementById('er-transporte');
        const elDui = document.getElementById('er-dui');
        const elMat = document.getElementById('er-matricula') || document.getElementById('er-Matrícula');
        const elTel = document.getElementById('er-telefono') || document.getElementById('er-Teléfono');
        const elObs = document.getElementById('er-observaciones');

        if (elId) elId.value = id;
        if (elRes) {
            llenarSelectResidentesEn(elRes, visitaEnEdicion.fkPersona?.idPersona || visitaEnEdicion.idPersona || '');
        }
        if (elNom) elNom.value = visitaEnEdicion.nombreVisitante || visitaEnEdicion.nombre || '';
        if (elTrans) elTrans.value = visitaEnEdicion.tipoTransporte || visitaEnEdicion.transporte || 'Peatonal';
        if (elDui) elDui.value = visitaEnEdicion.duiVisitante || visitaEnEdicion.dui || '';
        if (elMat) elMat.value = visitaEnEdicion.matriculaVehiculo || visitaEnEdicion.Matrícula || '';
        if (elTel) elTel.value = visitaEnEdicion.telefonoVisitante || visitaEnEdicion.Teléfono || '';
        if (elObs) elObs.value = visitaEnEdicion.observaciones || '';

        const campoMat = document.getElementById('er-campo-matricula') || document.getElementById('er-campo-Matrícula');
        if (campoMat) {
            campoMat.style.display = (visitaEnEdicion.tipoTransporte === 'Vehículo') ? '' : 'none';
        }

        if (panelEditarRen) panelEditarRen.classList.add('activo');
    }

    function cerrarEditarRenovar() {
        if (panelEditarRen) panelEditarRen.classList.remove('activo');
        visitaEnEdicion = null;
    }

    const btnCancEditRen = document.getElementById('btn-cancelar-editar-renovar');
    const btnCerrarEditRenX = document.getElementById('btn-cerrar-editar-renovar');
    if (btnCancEditRen) btnCancEditRen.addEventListener('click', cerrarEditarRenovar);
    if (btnCerrarEditRenX) btnCerrarEditRenX.addEventListener('click', cerrarEditarRenovar);

    if (panelRenovar) {
        panelRenovar.addEventListener('click', async function (e) {
            if (e.target === panelRenovar) { cerrarPanelRenovar(); return; }
            const btn  = e.target.closest('button[data-action]');
            if (!btn) return;
            const item = e.target.closest('.elemento-renovacion');
            const id   = item && item.dataset.id;
            if (!id) return;

            if (btn.dataset.action === 'desactivar') {
                try {
                    await actualizarVisita(id, { estadoVisita: 'inactivo' });
                    await cargarVisitas();
                    if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Visita desactivada', 'success');
                } catch (err) {
                    if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Error al desactivar', 'error');
                }
            } else if (btn.dataset.action === 'renovar') {
                abrirEditarRenovar(id);
            } else if (btn.dataset.action === 'eliminar') {
                const confirmado = await window.swalEliminar('¿Eliminar visita?', '¿Seguro que deseas eliminar esta visita del historial?');
                if (!confirmado) return;
                try {
                    await deleteVisita(id);
                    await cargarVisitas();
                    if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Visita eliminada', 'success');
                } catch (err) {
                    if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Error al eliminar', 'error');
                }
            }
        });
    }

    // ── Enviar Formulario de Renovación Conservando Mismo QR ──
    if (formEditarRen) {
        formEditarRen.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!visitaEnEdicion) return;

            const id = document.getElementById('er-id')?.value || visitaEnEdicion.idVisita || visitaEnEdicion.id;
            const nombreVal = document.getElementById('er-nombre')?.value.trim() || '';
            const resIdVal = document.getElementById('er-residente')?.value || '';
            const transVal = document.getElementById('er-transporte')?.value || 'Peatonal';
            const duiVal = document.getElementById('er-dui')?.value.trim() || '';
            const matVal = (document.getElementById('er-matricula') || document.getElementById('er-Matrícula'))?.value?.trim() || '';
            const telVal = (document.getElementById('er-telefono') || document.getElementById('er-Teléfono'))?.value?.trim() || '';
            const obsVal = document.getElementById('er-observaciones')?.value.trim() || '';

            // Se conserva exactamente el MISMO código QR asignado
            const codigoQrExistente = visitaEnEdicion.codigoQr || visitaEnEdicion.Código || `KP-VIS-${id}`;

            try {
                const payload = {
                    codigoQr:          codigoQrExistente,
                    nombreVisitante:   nombreVal,
                    duiVisitante:      duiVal,
                    telefonoVisitante: telVal,
                    tipoTransporte:    transVal,
                    matriculaVehiculo: matVal || null,
                    observaciones:     obsVal || null,
                    horaEntrada:       fechaHoraLocalISO(),
                    estadoVisita:      'inactivo', // Inicia inactivo hasta que el residente lo active
                    fkPersona:         resIdVal ? { idPersona: resIdVal } : null
                };

                await actualizarVisita(id, payload);

                // renovar pase
                const hoyRenov = fechaLocalISO();
                const paseRenovado = await createPaseQR({
                    tipoPase: 'Visita',
                    fechaInicioPase: hoyRenov,
                    duracionPase: hoyRenov,
                    paseActivo: 's',
                    fkVisitas: id
                });
                const paseRenovadoId = paseRenovado?.idPaseAcceso || paseRenovado?.id;
                if (!paseRenovadoId) throw new Error('La API no devolvió el pase QR renovado.');
                cerrarEditarRenovar();
                await cargarVisitas();

                await mostrarPaseQR({
                    titulo: '¡Visita Renovada con Éxito!',
                    mensaje: 'Se actualizaron los datos del visitante y se generó un nuevo pase QR.',
                    paseId: paseRenovadoId,
                    codigo: codigoQrExistente,
                    archivo: `KEEPER-PASE-RENOVADO-${codigoQrExistente}`,
                    notaPie: 'Los datos fueron sincronizados en el pase. El residente podrá activarlo desde su app móvil.'
                });

            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al renovar',
                    text: err.message || 'No se pudo actualizar la visita',
                    background: '#0a0f1c',
                    color: '#fff',
                    confirmButtonColor: '#ef4444'
                });
            }
        });
    }

    // Validación de DUI en tiempo real
    const duiInput = document.getElementById('entrada-dui');
    if (duiInput) {
        duiInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 8) {
                value = value.substring(0, 8) + '-' + value.substring(8, 9);
            }
            e.target.value = value;
        });
    }

    // Formato automático de teléfono y placa
    const telInput = document.getElementById('entrada-telefono');
    if (telInput) {
        telInput.addEventListener('input', function (e) {
            let v = e.target.value.replace(/\D/g, '').slice(0, 8);
            if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
            e.target.value = v;
        });
    }
    const placaInput = document.getElementById('entrada-matricula');
    if (placaInput) {
        placaInput.addEventListener('input', function (e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        });
    }

    // Escuchar eventos de entrada de texto e interacción
    document.querySelectorAll('.entrada-formulario, .seleccion-formulario').forEach(input => {
        input.addEventListener('input', function () {
            if (this.value.trim()) this.classList.remove('error-entrada');
        });
    });
});

// Globalizar funciones usadas en onclick del HTML
window.actualizarTransporte  = actualizarTransporte;
window.abrirConfirmacion     = abrirConfirmacion;
window.cerrarConfirmacion    = cerrarConfirmacion;
window.confirmarRegistro     = confirmarRegistro;
window.cancelarFormulario    = cancelarFormulario;
