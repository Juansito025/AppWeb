/** visita sin cita */
import { getPersonas } from '../servicios/personasService.js';
import { getPropiedades } from '../servicios/propiedadesService.js';
import { getDetalleTurnos } from '../servicios/turnosService.js';
import { registrarAcceso } from '../servicios/pasesQRService.js';

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
const lista = (r) => (Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []));
const $ = (id) => document.getElementById(id);
const INTERVALO = 3000;
const TIEMPO_TOTAL = 300; // 5 minutos

let residentes = [];
let residenteElegido = null;
let solicitud = null;
let temporizadorConsulta = null;
let temporizadorReloj = null;
let venceEn = 0;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) await window.CredentialsStore.protegerVista();
    configurarFormulario();
    $('vsc-nueva').addEventListener('click', reiniciar);
    $('vsc-registrar').addEventListener('click', registrarEntradaAprobada);
    $('vsc-por-llamada').addEventListener('click', registrarPorLlamada);
    await cargarResidentes();
});

async function cargarResidentes() {
    const [personas, propiedades] = await Promise.all([getPersonas(), getPropiedades().catch(() => [])]);
    const props = lista(propiedades);
    const hoy = fechaLocalISO();
    residentes = personas
        .filter(p => !p.fechaSalidaColonia || String(p.fechaSalidaColonia) > hoy)
        .map(p => {
            const id = p.idPersona;
            const responsable = p.idPersonaResponsable;
            const prop = props.find(pr => String(pr.fkPropietario).toLowerCase() === String(id).toLowerCase())
                || (responsable && props.find(pr => String(pr.fkPropietario).toLowerCase() === String(responsable).toLowerCase()));
            return {
                id,
                nombre: `${p.nombrePersona || ''} ${p.apellidoPersona || ''}`.trim() || 'Residente',
                casa: prop ? [prop.codigo, prop.calle].filter(Boolean).join(' · ') : 'Sin propiedad',
                tipo: p.tipoPersona || '',
                telefono: p.telefonoPersona || ''
            };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    pintarLista('');
}

function pintarLista(texto) {
    const cont = $('vsc-lista-residentes');
    const t = texto.toLowerCase().trim();
    const encontrados = residentes.filter(r => !t || r.nombre.toLowerCase().includes(t) || r.casa.toLowerCase().includes(t)).slice(0, 6);
    cont.innerHTML = encontrados.length
        ? encontrados.map(r => `
            <button type="button" role="option" class="vsc-opcion" data-id="${escapeHtml(r.id)}">
                <strong>${escapeHtml(r.nombre)}</strong><span>${escapeHtml(r.casa)}${r.tipo ? ' · ' + escapeHtml(r.tipo) : ''}</span>
            </button>`).join('')
        : `<p class="vsc-sin">${residentes.length ? 'No hay residentes con ese nombre o casa.' : 'Cargando residentes…'}</p>`;
    cont.querySelectorAll('.vsc-opcion').forEach(b => b.addEventListener('click', () => elegirResidente(b.dataset.id)));
}

function elegirResidente(id) {
    residenteElegido = residentes.find(r => String(r.id) === String(id)) || null;
    const caja = $('vsc-residente-elegido');
    if (!residenteElegido) { caja.hidden = true; return; }
    caja.hidden = false;
    caja.innerHTML = `<div><strong>${escapeHtml(residenteElegido.nombre)}</strong><span>${escapeHtml(residenteElegido.casa)}</span></div>
        <button type="button" class="vsc-cambiar" id="vsc-cambiar">Cambiar</button>`;
    $('vsc-lista-residentes').hidden = true;
    $('vsc-buscar-residente').closest('.vsc-campo').hidden = true;
    $('vsc-cambiar').addEventListener('click', () => {
        residenteElegido = null;
        caja.hidden = true;
        $('vsc-lista-residentes').hidden = false;
        const buscador = $('vsc-buscar-residente');
        buscador.closest('.vsc-campo').hidden = false;
        buscador.focus();
    });
}

function configurarFormulario() {
    $('vsc-buscar-residente').addEventListener('input', e => pintarLista(e.target.value));
    const dui = $('vsc-dui');
    dui.addEventListener('input', () => {
        const n = dui.value.replace(/\D/g, '').slice(0, 9);
        dui.value = n.length > 8 ? `${n.slice(0, 8)}-${n.slice(8)}` : n;
    });
    const tel = $('vsc-telefono');
    tel.addEventListener('input', () => {
        const n = tel.value.replace(/\D/g, '').slice(0, 8);
        tel.value = n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
    });
    $('form-solicitud').addEventListener('submit', enviarSolicitud);
}

function validar() {
    if (!residenteElegido) return 'Elige al residente que visita.';
    if (!$('vsc-nombre').value.trim()) return 'Escribe el nombre del visitante.';
    if (!$('vsc-apellido').value.trim()) return 'Escribe el apellido del visitante.';
    if (!/^\d{8}-\d$/.test($('vsc-dui').value.trim())) return 'El DUI debe tener el formato 00000000-0.';
    const tel = $('vsc-telefono').value.trim();
    if (tel && !/^\d{4}-\d{4}$/.test(tel)) return 'El teléfono debe tener el formato 0000-0000.';
    return '';
}

/** buscar o registrar visitante */
async function obtenerVisitante() {
    const dui = $('vsc-dui').value.trim();
    const existentes = lista(await apiFetch('/visitantes', { silencioso: true }).catch(() => []));
    const previo = existentes.find(v => String(v.duiVisitante || '').trim() === dui);
    if (previo) return previo;
    return apiFetch('/visitantes', {
        method: 'POST',
        body: {
            nombreVisitante: $('vsc-nombre').value.trim(),
            apellidoVisitante: $('vsc-apellido').value.trim(),
            duiVisitante: dui,
            telefonoVisitante: $('vsc-telefono').value.trim() || null,
            tipoVisitante: $('vsc-tipo').value
        }
    });
}

async function enviarSolicitud(e) {
    e.preventDefault();
    const error = validar();
    $('vsc-error').textContent = error;
    if (error) return;
    const boton = $('vsc-enviar');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
        const visitante = await obtenerVisitante();
        const idVisitante = visitante?.idVisitante || visitante?.id;
        if (!idVisitante) throw new Error('La API no devolvió el visitante registrado.');
        solicitud = await apiFetch('/solicitudes-visita', {
            method: 'POST',
            body: { fkPersona: residenteElegido.id, fkVisitante: idVisitante }
        });
        $('form-solicitud').classList.add('vsc-bloqueado');
        mostrarSeguimiento();
        iniciarConsulta();
    } catch (err) {
        $('vsc-error').textContent = err.message || 'No se pudo enviar la solicitud.';
    } finally {
        boton.disabled = false;
        boton.textContent = 'Enviar solicitud al residente';
    }
}

// ── Seguimiento ───────────────────────────────────────────────────────────────
function iniciarConsulta() {
    detenerConsulta();
    venceEn = Date.now() + Number(solicitud.segundosRestantes ?? TIEMPO_TOTAL) * 1000;
    temporizadorReloj = setInterval(pintarReloj, 1000);
    pintarReloj();
    temporizadorConsulta = setInterval(consultar, INTERVALO);
}

function detenerConsulta() {
    clearInterval(temporizadorConsulta);
    clearInterval(temporizadorReloj);
    temporizadorConsulta = temporizadorReloj = null;
}

async function consultar() {
    if (!solicitud) return;
    try {
        solicitud = await apiFetch(`/solicitudes-visita/${solicitud.idSolicitud}`, { silencioso: true });
        if (solicitud.estado === 'Pendiente') {
            venceEn = Date.now() + Number(solicitud.segundosRestantes || 0) * 1000;
        } else {
            detenerConsulta();
        }
        mostrarSeguimiento();
    } catch (err) {
        if (err.status === 404) {
            // solicitud perdida
            detenerConsulta();
            solicitud = { ...solicitud, estado: 'Perdida' };
            mostrarSeguimiento();
        }
    }
}

function pintarReloj() {
    const restante = Math.max(0, Math.round((venceEn - Date.now()) / 1000));
    $('vsc-reloj').textContent = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`;
    $('vsc-progreso').style.width = `${Math.min(100, (restante / TIEMPO_TOTAL) * 100)}%`;
    if (restante <= 0) consultar();
}

const ESTADOS = {
    Pendiente: { clase: 'espera', pildora: 'Esperando respuesta', titulo: (s) => `Esperando a ${s.nombreResidente || 'el residente'}` },
    Aprobada: { clase: 'aprobada', pildora: 'Aprobada', titulo: (s) => `${s.nombreResidente || 'El residente'} aprobó la visita` },
    Rechazada: { clase: 'rechazada', pildora: 'Rechazada', titulo: (s) => `${s.nombreResidente || 'El residente'} rechazó la visita` },
    Expirada: { clase: 'expirada', pildora: 'Sin respuesta', titulo: () => 'El residente no respondió a tiempo' },
    Perdida: { clase: 'expirada', pildora: 'Solicitud perdida', titulo: () => 'La solicitud ya no existe' }
};

function mostrarSeguimiento() {
    const s = solicitud;
    const e = ESTADOS[s.estado] || ESTADOS.Pendiente;
    const visitante = `${s.nombreVisitante || ''} ${s.apellidoVisitante || ''}`.trim() || 'El visitante';
    $('vsc-vacio').hidden = true;
    $('vsc-seguimiento').hidden = false;
    $('vsc-estado').className = `vsc-tarjeta vsc-estado ${e.clase}`;
    $('vsc-pildora').textContent = e.pildora;
    $('vsc-titulo').textContent = e.titulo(s);
    const detalles = {
        Pendiente: `${visitante} espera en la entrada. La solicitud apareció en la app del residente.`,
        Aprobada: s.registrado
            ? `La entrada de ${visitante} quedó registrada.`
            : `${visitante} puede pasar. Registra la entrada para dejar constancia.`,
        Rechazada: `No permitas el ingreso de ${visitante}.`,
        Expirada: `No dejes pasar a ${visitante} sin la autorización del residente.`,
        Perdida: 'Se perdió la solicitud (la API pudo reiniciarse). Envíala de nuevo.'
    };
    $('vsc-detalle').textContent = detalles[s.estado] || '';
    const pendiente = s.estado === 'Pendiente';
    $('vsc-reloj').hidden = !pendiente;
    $('vsc-progreso').parentElement.hidden = !pendiente;
    $('vsc-registrar').hidden = !(s.estado === 'Aprobada' && !s.registrado);
    const sinRespuesta = s.estado === 'Expirada' && !s.registrado;
    $('vsc-por-llamada').hidden = !sinRespuesta;
    const llamar = $('vsc-llamar');
    llamar.hidden = !sinRespuesta;
    llamar.innerHTML = sinRespuesta
        ? (s.telefonoResidente
            ? `Puedes llamar al residente: <a href="tel:${escapeHtml(s.telefonoResidente)}">${escapeHtml(s.telefonoResidente)}</a>`
            : 'El residente no tiene teléfono registrado.')
        : '';
}

// ── Registro de la entrada ────────────────────────────────────────────────────
async function miTurnoActivo() {
    const yo = await window.CredentialsStore.verificarSesion();
    if (!yo) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    const detalles = await getDetalleTurnos();
    const turno = detalles.find(d => String(d.fkEmpleado).toLowerCase() === String(yo.id).toLowerCase()
        && String(d.estadoturno).toLowerCase() === 's');
    if (!turno) throw new Error('No tienes un turno activo asignado. Pide al administrador que te asigne a una caseta.');
    return turno.idDetalleTurno || turno.id;
}

async function conBoton(boton, tarea) {
    boton.disabled = true;
    try {
        await tarea();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'No se registró la entrada', text: err.message || 'Error inesperado', background: '#0a0f1c', color: '#fff' });
    } finally {
        boton.disabled = false;
    }
}

function registrarEntradaAprobada() {
    return conBoton($('vsc-registrar'), async () => {
        if (!solicitud?.idPaseAcceso) throw new Error('La solicitud no tiene un pase de acceso.');
        await registrarAcceso({ metodoAcceso: 'QR', fkPasesAcceso: solicitud.idPaseAcceso, fkDetalleTurno: await miTurnoActivo() });
        solicitud = { ...solicitud, registrado: true };
        mostrarSeguimiento();
        Swal.fire({ icon: 'success', title: 'Entrada registrada', timer: 2000, showConfirmButton: false, background: '#0a0f1c', color: '#fff' });
    });
}

function registrarPorLlamada() {
    return conBoton($('vsc-por-llamada'), async () => {
        const r = await Swal.fire({
            icon: 'question',
            title: '¿El residente autorizó por teléfono?',
            text: 'Se registrará la visita como aprobada por llamada y la entrada quedará a tu nombre.',
            showCancelButton: true,
            confirmButtonText: 'Sí, autorizó',
            cancelButtonText: 'Cancelar',
            background: '#0a0f1c',
            color: '#fff'
        });
        if (!r.isConfirmed) return;
        const fkDetalleTurno = await miTurnoActivo();
        const visita = await apiFetch('/visitas', {
            method: 'POST',
            body: { fkPersona: solicitud.fkPersona, fkVisitante: solicitud.fkVisitante, fechaVisita: fechaLocalISO(), estado: 'Aprobada' }
        });
        const idVisita = visita?.idVisitas || visita?.idVisita;
        if (!idVisita) throw new Error('La API no devolvió la visita registrada.');
        await registrarAcceso({ metodoAcceso: 'Manual', fkVisitas: idVisita, fkDetalleTurno });
        solicitud = { ...solicitud, estado: 'Aprobada', registrado: true, nombreResidente: solicitud.nombreResidente };
        mostrarSeguimiento();
        $('vsc-pildora').textContent = 'Aprobada por llamada';
        Swal.fire({ icon: 'success', title: 'Entrada registrada', timer: 2000, showConfirmButton: false, background: '#0a0f1c', color: '#fff' });
    });
}

function reiniciar() {
    detenerConsulta();
    solicitud = null;
    $('form-solicitud').reset();
    $('form-solicitud').classList.remove('vsc-bloqueado');
    $('vsc-error').textContent = '';
    $('vsc-seguimiento').hidden = true;
    $('vsc-vacio').hidden = false;
    $('vsc-estado').className = 'vsc-tarjeta vsc-estado';
    residenteElegido = null;
    $('vsc-residente-elegido').hidden = true;
    $('vsc-lista-residentes').hidden = false;
    $('vsc-buscar-residente').closest('.vsc-campo').hidden = false;
    pintarLista('');
}
