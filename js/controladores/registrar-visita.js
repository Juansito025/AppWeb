import { getPersonas } from '../servicios/personasService.js';
import { getPropiedades } from '../servicios/propiedadesService.js';
import { obtenerMiDetalleTurno } from '../servicios/turnosService.js';
import { registrarAcceso } from '../servicios/pasesQRService.js';
import { buscarVehiculoPorMatricula, createVehiculo } from '../servicios/vehiculosService.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const lista = (r) => (Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []));
const INTERVALO_CONSULTA = 3000;
const TIEMPO_TOTAL = 300;
const PLACA = /^[A-Z]{1,2}[0-9A-F]{3}-[0-9A-F]{3}$/;

let residentes = [];
let residenteElegido = null;
let solicitud = null;
let temporizadorConsulta = null;
let temporizadorReloj = null;
let venceEn = 0;
let registrado = false;
let residentesCargados = false;

function alerta(mensaje, tipo = 'error', titulo) {
    if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion(mensaje, tipo, titulo);
}

function transporte() {
    return document.querySelector('input[name="transporte"]:checked')?.value || 'Peatonal';
}

async function cargarResidentes() {
    const [personas, propiedades] = await Promise.all([getPersonas(), getPropiedades().catch(() => [])]);
    const props = lista(propiedades);
    const hoy = window.fechaLocalISO();
    const mismo = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();
    residentes = lista(personas)
        .filter(p => !p.fechaSalidaColonia || String(p.fechaSalidaColonia).slice(0, 10) > hoy)
        .map(p => {
            const prop = props.find(pr => mismo(pr.fkPropietario, p.idPersona))
                || (p.idPersonaResponsable && props.find(pr => mismo(pr.fkPropietario, p.idPersonaResponsable)));
            return {
                id: p.idPersona,
                nombre: `${p.nombrePersona || ''} ${p.apellidoPersona || ''}`.trim() || 'Residente',
                casa: prop ? [prop.codigo, prop.calle].filter(Boolean).join(' · ') : 'Sin propiedad',
                tipo: p.tipoPersona || '',
                telefono: p.telefonoPersona || ''
            };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    residentesCargados = true;
    pintarResidentes($('rv-buscar-residente').value);
}

function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function pintarResidentes(texto) {
    const cont = $('rv-lista-residentes');
    if (!cont) return;
    const t = normalizar(texto);
    const encontrados = residentes
        .filter(r => !t || normalizar(`${r.nombre} ${r.casa} ${r.tipo}`).includes(t))
        .slice(0, 8);
    if (!residentes.length) {
        cont.innerHTML = `<p class="rv-sin">${residentesCargados ? 'No hay residentes activos registrados.' : 'Cargando residentes…'}</p>`;
        return;
    }
    cont.innerHTML = encontrados.length
        ? encontrados.map(r => `
            <button type="button" role="option" class="rv-opcion" data-id="${escapeHtml(r.id)}">
                <span><strong>${escapeHtml(r.nombre)}</strong>${escapeHtml(r.tipo)}</span>
                <span class="rv-opcion-casa">${escapeHtml(r.casa)}</span>
            </button>`).join('')
        : '<p class="rv-sin">Ningún residente coincide con la búsqueda.</p>';
    cont.querySelectorAll('.rv-opcion').forEach(b => b.addEventListener('click', () => elegirResidente(b.dataset.id)));
}

function elegirResidente(id) {
    residenteElegido = residentes.find(r => String(r.id) === String(id)) || null;
    const caja = $('rv-residente-elegido');
    const buscador = $('rv-buscar-residente');
    const listaEl = $('rv-lista-residentes');
    if (!residenteElegido) {
        caja.hidden = true;
        listaEl.hidden = false;
        buscador.closest('.contenedor-icono-entrada').hidden = false;
        return;
    }
    caja.hidden = false;
    caja.innerHTML = `<div><strong>${escapeHtml(residenteElegido.nombre)}</strong><span>${escapeHtml(residenteElegido.casa)}${residenteElegido.telefono ? ' · Tel. ' + escapeHtml(residenteElegido.telefono) : ''}</span></div>
        <button type="button" class="rv-cambiar" id="rv-cambiar-residente">Cambiar</button>`;
    listaEl.hidden = true;
    buscador.closest('.contenedor-icono-entrada').hidden = true;
    $('rv-cambiar-residente').addEventListener('click', () => {
        residenteElegido = null;
        caja.hidden = true;
        listaEl.hidden = false;
        buscador.closest('.contenedor-icono-entrada').hidden = false;
        buscador.value = '';
        pintarResidentes('');
        buscador.focus();
    });
}

function actualizarTransporte() {
    const vehicular = transporte() === 'Vehicular';
    $('rv-campos-vehiculo').hidden = !vehicular;
    if (!vehicular) ['entrada-matricula', 'entrada-marca', 'entrada-modelo'].forEach(id => { $(id).value = ''; });
}

function datosFormulario() {
    return {
        nombre: $('entrada-nombre').value.trim(),
        apellido: $('entrada-apellido').value.trim(),
        telefono: $('entrada-telefono').value.trim(),
        dui: $('entrada-dui').value.trim(),
        tipoVisitante: $('seleccionar-tipo-visitante').value || 'Otro',
        transporte: transporte(),
        placa: $('entrada-matricula').value.trim().toUpperCase().replace(/\s+/g, ''),
        tipoVehiculo: $('seleccionar-tipo-vehiculo').value || 'Automóvil',
        marca: $('entrada-marca').value.trim(),
        modelo: $('entrada-modelo').value.trim(),
        observaciones: $('entrada-observaciones').value.trim()
    };
}

function validar(d) {
    if (!residenteElegido) return 'Busca y elige al residente que recibe la visita.';
    if (!d.nombre) return 'Escribe el nombre del visitante.';
    if (!d.apellido) return 'Escribe el apellido del visitante.';
    if (!/^\d{4}-\d{4}$/.test(d.telefono)) return 'El teléfono debe tener 8 números con el formato 0000-0000.';
    if (d.dui && !/^\d{8}-\d$/.test(d.dui)) return 'El DUI debe tener el formato 00000000-0.';
    if (d.transporte === 'Vehicular' && !PLACA.test(d.placa)) return 'La placa debe tener el formato P123-456.';
    return '';
}

function abrirConfirmacion() {
    if (window.KeeperValida && !window.KeeperValida.revisar(['entrada-nombre', 'entrada-apellido', 'entrada-telefono', 'entrada-dui', 'entrada-matricula'])) return;
    const d = datosFormulario();
    const error = validar(d);
    if (error) { alerta(error, 'error'); return; }
    const poner = (id, v) => { const el = $(id); if (el) el.textContent = v || '—'; };
    poner('ovl-residente', `${residenteElegido.nombre} · ${residenteElegido.casa}`);
    poner('ovl-nombre', `${d.nombre} ${d.apellido}`);
    poner('ovl-telefono', d.telefono);
    poner('ovl-dui', d.dui || 'No indicado');
    poner('ovl-transporte', d.transporte);
    const vehicular = d.transporte === 'Vehicular';
    $('ovl-div-matricula').style.display = vehicular ? '' : 'none';
    poner('ovl-matricula', vehicular ? [d.placa, d.tipoVehiculo, d.marca, d.modelo].filter(Boolean).join(' · ') : '');
    $('ovl-div-obs').style.display = d.observaciones ? '' : 'none';
    poner('ovl-observaciones', d.observaciones);
    $('capa').classList.add('activo');
}

function cerrarConfirmacion() {
    $('capa').classList.remove('activo');
}

async function obtenerVisitante(d) {
    if (d.dui) {
        const existentes = lista(await window.apiFetch('/visitantes', { silencioso: true }).catch(() => []));
        const previo = existentes.find(v => String(v.duiVisitante || '').trim() === d.dui);
        if (previo) return previo;
    }
    return window.apiFetch('/visitantes', {
        method: 'POST',
        body: {
            nombreVisitante: d.nombre,
            apellidoVisitante: d.apellido,
            tipoVisitante: d.tipoVisitante,
            duiVisitante: d.dui || null,
            telefonoVisitante: d.telefono
        }
    });
}

async function obtenerVehiculo(d) {
    if (d.transporte !== 'Vehicular') return null;
    const existente = await buscarVehiculoPorMatricula(d.placa);
    if (existente && (existente.idVehiculo || existente.id)) return existente.idVehiculo || existente.id;
    const nuevo = await createVehiculo({
        matriculaVehiculo: d.placa,
        tipoVehiculo: d.tipoVehiculo,
        marcaVehiculo: d.marca || 'Sin especificar',
        modeloVehiculo: d.modelo || 'Sin especificar'
    });
    const id = nuevo?.idVehiculo || nuevo?.id;
    if (!id) throw new Error('La API no devolvió el vehículo registrado.');
    return id;
}

async function enviarSolicitud() {
    const boton = $('rv-btn-enviar');
    const d = datosFormulario();
    const error = validar(d);
    if (error) { cerrarConfirmacion(); alerta(error, 'error'); return; }
    boton.disabled = true;
    try {
        const visitante = await obtenerVisitante(d);
        const idVisitante = visitante?.idVisitante || visitante?.id;
        if (!idVisitante) throw new Error('La API no devolvió el visitante registrado.');
        const idVehiculo = await obtenerVehiculo(d);
        solicitud = await window.apiFetch('/solicitudes-visita', {
            method: 'POST',
            body: {
                fkPersona: residenteElegido.id,
                fkVisitante: idVisitante,
                fkVehiculo: idVehiculo,
                observaciones: d.observaciones || null
            }
        });
        registrado = false;
        cerrarConfirmacion();
        $('rv-formulario').hidden = true;
        $('rv-seguimiento').hidden = false;
        mostrarSeguimiento();
        iniciarConsulta();
        $('rv-seguimiento').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        alerta(err.message || 'No se pudo enviar la visita al residente.', 'error');
    } finally {
        boton.disabled = false;
    }
}

function iniciarConsulta() {
    detenerConsulta();
    venceEn = Date.now() + Number(solicitud.segundosRestantes ?? TIEMPO_TOTAL) * 1000;
    temporizadorReloj = setInterval(pintarReloj, 1000);
    pintarReloj();
    temporizadorConsulta = setInterval(consultar, INTERVALO_CONSULTA);
}

function detenerConsulta() {
    clearInterval(temporizadorConsulta);
    clearInterval(temporizadorReloj);
    temporizadorConsulta = temporizadorReloj = null;
}

async function consultar() {
    if (!solicitud) return;
    try {
        solicitud = await window.apiFetch(`/solicitudes-visita/${solicitud.idSolicitud}`, { silencioso: true });
        if (solicitud.estado === 'Pendiente') {
            venceEn = Date.now() + Number(solicitud.segundosRestantes || 0) * 1000;
        } else {
            detenerConsulta();
        }
        mostrarSeguimiento();
    } catch (err) {
        if (err.status === 404) {
            detenerConsulta();
            solicitud = { ...solicitud, estado: 'Perdida' };
            mostrarSeguimiento();
        }
    }
}

function pintarReloj() {
    const restante = Math.max(0, Math.round((venceEn - Date.now()) / 1000));
    $('rv-reloj').textContent = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`;
    $('rv-progreso').style.width = `${Math.min(100, (restante / TIEMPO_TOTAL) * 100)}%`;
    if (restante <= 0 && solicitud?.estado === 'Pendiente') consultar();
}

const ESTADOS = {
    Pendiente: { clase: '', pildora: 'Esperando respuesta' },
    Aprobada: { clase: 'aprobada', pildora: 'Aprobada' },
    Rechazada: { clase: 'rechazada', pildora: 'Rechazada' },
    Cancelada: { clase: 'expirada', pildora: 'Cancelada' },
    Expirada: { clase: 'expirada', pildora: 'Sin respuesta' },
    Perdida: { clase: 'expirada', pildora: 'Solicitud perdida' }
};

function textoEstado(s, visitante) {
    const residente = s.nombreResidente || 'El residente';
    switch (s.estado) {
        case 'Pendiente': return [`Esperando a ${residente}`, `${visitante} espera en la entrada. El aviso ya apareció en la app del residente; si no responde, llámale.`];
        case 'Aprobada': return registrado
            ? [`Entrada registrada`, `La entrada de ${visitante} quedó registrada con su pase QR.`]
            : [s.respondidaPor === 'Llamada' ? 'Aprobada por llamada' : `${residente} aprobó la visita`, `${visitante} puede pasar. Registra la entrada para dejar constancia.`];
        case 'Rechazada': return [`${residente} rechazó la visita`, `No permitas el ingreso de ${visitante}.`];
        case 'Cancelada': return ['Solicitud cancelada', 'La solicitud se canceló desde la caseta.'];
        case 'Expirada': return ['El residente no respondió a tiempo', `Llama al residente. Si autoriza la visita por teléfono, usa el botón "El residente autorizó por llamada".`];
        default: return ['La solicitud ya no existe', 'Se perdió la solicitud (la API pudo reiniciarse). Regístrala de nuevo.'];
    }
}

function mostrarSeguimiento() {
    const s = solicitud;
    const cfg = ESTADOS[s.estado] || ESTADOS.Pendiente;
    const visitante = `${s.nombreVisitante || ''} ${s.apellidoVisitante || ''}`.trim() || 'El visitante';
    const [titulo, detalle] = textoEstado(s, visitante);
    const seg = $('rv-seguimiento');
    seg.className = `rv-seguimiento ${cfg.clase}`;
    $('rv-pildora').textContent = cfg.pildora;
    $('rv-seg-titulo').textContent = titulo;
    $('rv-seg-detalle').textContent = detalle;

    const datos = [
        ['Visitante', visitante],
        ['Residente', s.nombreResidente],
        ['DUI', s.duiVisitante || 'No indicado'],
        ['Teléfono visitante', s.telefonoVisitante],
        ['Vehículo', s.matriculaVehiculo ? [s.matriculaVehiculo, s.tipoVehiculo, s.descripcionVehiculo].filter(Boolean).join(' · ') : 'Peatonal'],
        ['Observaciones', s.observaciones]
    ].filter(([, v]) => v);
    $('rv-seg-datos').innerHTML = datos.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');

    const pendiente = s.estado === 'Pendiente';
    $('rv-reloj').hidden = !pendiente;
    $('rv-barra').hidden = !pendiente;

    const puedeLlamar = ['Pendiente', 'Expirada'].includes(s.estado);
    const tel = String(s.telefonoResidente || '').trim();
    $('rv-llamada').innerHTML = puedeLlamar
        ? (tel
            ? `<span>¿Prefieres confirmar por teléfono? Residente: <strong>${escapeHtml(tel)}</strong></span><a class="rv-btn-llamar" href="tel:${escapeHtml(tel.replace(/[^0-9+]/g, ''))}">Llamar al residente</a>`
            : '<span>El residente no tiene teléfono registrado.</span>')
        : '';

    const aprobada = s.estado === 'Aprobada';
    $('rv-qr').hidden = !(aprobada && s.idPaseAcceso);
    if (aprobada && s.idPaseAcceso) pintarQr(s.idPaseAcceso);
    $('rv-btn-registrar-entrada').hidden = !(aprobada && s.idPaseAcceso && !registrado);
    $('rv-btn-por-llamada').hidden = !puedeLlamar;
    $('rv-btn-cancelar-solicitud').hidden = !pendiente;
}

let qrPintado = null;
function pintarQr(idPase) {
    if (qrPintado === idPase) return;
    const img = $('rv-qr-img');
    const enlace = $('rv-qr-descargar');
    if (typeof QRCode === 'undefined') { $('rv-qr').hidden = true; return; }
    const temporal = document.createElement('div');
    temporal.style.cssText = 'position:fixed; left:-9999px; top:0;';
    document.body.appendChild(temporal);
    try {
        new QRCode(temporal, { text: JSON.stringify({ keeper: 'pase-acceso-qr', paseId: String(idPase) }), width: 320, height: 320, colorDark: '#0a0f1c', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
        const canvas = temporal.querySelector('canvas');
        const src = canvas ? canvas.toDataURL('image/png') : (temporal.querySelector('img')?.src || '');
        img.src = src;
        enlace.href = src;
        enlace.download = `KEEPER-PASE-${String(idPase).slice(0, 8)}.png`;
        qrPintado = idPase;
    } finally {
        temporal.remove();
    }
}

async function miTurnoActivo() {
    const yo = await window.CredentialsStore.verificarSesion();
    if (!yo) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    const turno = await obtenerMiDetalleTurno(yo.id);
    return turno.idDetalleTurno || turno.id;
}

async function conBoton(boton, tarea) {
    boton.disabled = true;
    try {
        await tarea();
    } catch (err) {
        alerta(err.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
        boton.disabled = false;
    }
}

function registrarEntrada() {
    return conBoton($('rv-btn-registrar-entrada'), async () => {
        if (!solicitud?.idPaseAcceso) throw new Error('La visita no tiene un pase de acceso.');
        await registrarAcceso({ metodoAcceso: 'QR', fkPasesAcceso: solicitud.idPaseAcceso, fkDetalleTurno: await miTurnoActivo() });
        registrado = true;
        mostrarSeguimiento();
        alerta('La entrada quedó registrada.', 'success', 'Entrada registrada');
    });
}

function aprobarPorLlamada() {
    return conBoton($('rv-btn-por-llamada'), async () => {
        const confirmado = window.swalConfirmar
            ? await window.swalConfirmar('¿El residente autorizó por teléfono?', 'La visita quedará aprobada y se generará su pase QR.', 'Sí, autorizó')
            : true;
        if (!confirmado) return;
        solicitud = await window.apiFetch(`/solicitudes-visita/${solicitud.idSolicitud}/aprobar-por-llamada`, { method: 'POST' });
        detenerConsulta();
        mostrarSeguimiento();
    });
}

function cancelarSolicitud() {
    return conBoton($('rv-btn-cancelar-solicitud'), async () => {
        solicitud = await window.apiFetch(`/solicitudes-visita/${solicitud.idSolicitud}/cancelar`, { method: 'POST' });
        detenerConsulta();
        mostrarSeguimiento();
    });
}

function limpiarFormulario() {
    ['entrada-nombre', 'entrada-apellido', 'entrada-telefono', 'entrada-dui', 'entrada-matricula', 'entrada-marca', 'entrada-modelo', 'entrada-observaciones']
        .forEach(id => { const el = $(id); if (el) { el.value = ''; el.classList.remove('invalido'); } });
    $('opt-peatonal').checked = true;
    actualizarTransporte();
    elegirResidente(null);
    $('rv-buscar-residente').value = '';
    pintarResidentes('');
}

function nuevaVisita() {
    detenerConsulta();
    solicitud = null;
    registrado = false;
    qrPintado = null;
    limpiarFormulario();
    $('rv-seguimiento').hidden = true;
    $('rv-formulario').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) await window.CredentialsStore.protegerVista();
    $('rv-buscar-residente').addEventListener('input', e => pintarResidentes(e.target.value));
    document.querySelectorAll('input[name="transporte"]').forEach(r => r.addEventListener('change', actualizarTransporte));
    $('entrada-matricula').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); });
    $('rv-btn-limpiar').addEventListener('click', limpiarFormulario);
    $('rv-btn-revisar').addEventListener('click', abrirConfirmacion);
    $('rv-btn-corregir').addEventListener('click', cerrarConfirmacion);
    $('capa').addEventListener('click', e => { if (e.target.id === 'capa') cerrarConfirmacion(); });
    $('rv-btn-enviar').addEventListener('click', enviarSolicitud);
    $('rv-btn-registrar-entrada').addEventListener('click', registrarEntrada);
    $('rv-btn-por-llamada').addEventListener('click', aprobarPorLlamada);
    $('rv-btn-cancelar-solicitud').addEventListener('click', cancelarSolicitud);
    $('rv-btn-nueva').addEventListener('click', nuevaVisita);
    actualizarTransporte();
    pintarResidentes('');
    await cargarResidentes();
});
