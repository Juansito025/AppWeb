/** escaner de qr */

import { getVisitas, marcarEstadoVisita } from '../servicios/visitasService.js';
import { validarPaseQR, registrarAcceso } from '../servicios/pasesQRService.js';
import { getDetalleTurnos } from '../servicios/turnosService.js';
import { getInfraccionesDetalladas } from '../servicios/infraccionesService.js';
import { infraccionesDe } from '../servicios/residenteDatosService.js';
import { getPersona } from '../servicios/personasService.js';
import { getPropiedades } from '../servicios/propiedadesService.js';
// servicio de sesion
const AuthService = window.AuthService;

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let personaActual = null;
let html5QrScanner = null;
let camaraActiva = false;

function mostrarEstadoQR(estado) {
    const zonas = {
        marco:     document.getElementById('qr-estado-marco'),
        camara:    document.getElementById('qr-estado-camara'),
        cargando:  document.getElementById('qr-estado-cargando'),
        foto:      document.getElementById('qr-estado-foto'),
        rechazado: document.getElementById('qr-estado-rechazado')
    };
    const panel = document.getElementById('qr-panel');

    Object.keys(zonas).forEach(function (key) {
        if (zonas[key]) zonas[key].classList.toggle('qr-oculto', key !== estado);
    });

    if (panel) {
        panel.classList.toggle('qr-panel-cargando', estado === 'cargando');
        panel.classList.toggle('panel-rechazado-qr', estado === 'rechazado');
    }
}

const CAMPOS = ['valor-nombre', 'valor-dui', 'valor-casa', 'valor-hora', 'valor-tipo', 'valor-vehiculo', 'valor-telefono'];

function pintarDatos(persona) {
    const setTxt = (id, altId, val) => {
        const el = document.getElementById(id) || (altId ? document.getElementById(altId) : null);
        if (el) el.textContent = val;
    };
    setTxt('valor-nombre', null, persona.nombre || '—');
    setTxt('valor-dui', null, persona.dui || '—');
    setTxt('valor-casa', null, persona.casa || '—');
    setTxt('valor-hora', null, persona.horaEstimada || persona.hora || '—');
    setTxt('valor-tipo', null, persona.tipo || 'Peatonal');
    setTxt('valor-vehiculo', 'valor-Vehículo', persona.vehiculo || persona.Vehículo || (persona.tipo === 'Vehículo' || persona.tipo === 'Vehicular' ? 'Registrado' : 'N/A (peatonal)'));
    setTxt('valor-telefono', 'valor-Teléfono', persona.telefono || persona.Teléfono || '—');

    const fotoImg = document.getElementById('qr-foto-persona-img');
    const placeholderEl = document.getElementById('qr-foto-persona-placeholder');
    if (persona.foto) {
        if (fotoImg) {
            fotoImg.src = persona.foto;
            fotoImg.style.display = 'block';
        }
        if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
        if (fotoImg) {
            fotoImg.src = '../img/logo-Global.png';
            fotoImg.style.display = 'none';
        }
        if (placeholderEl) placeholderEl.style.display = 'flex';
    }

    CAMPOS.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('qr-valor-cargado');
    });
}

function limpiarDatos() {
    CAMPOS.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = 'Esperando escaneo…';
            el.classList.remove('qr-valor-cargado');
        }
    });
    const fotoImg = document.getElementById('qr-foto-persona-img');
    const placeholderEl = document.getElementById('qr-foto-persona-placeholder');
    if (fotoImg) {
        fotoImg.src = '../img/logo-Global.png';
        fotoImg.style.display = 'none';
    }
    if (placeholderEl) placeholderEl.style.display = 'flex';
}

// ── Iniciar Cámara Real con Html5Qrcode ────────────────────────────────
async function iniciarEscaneoCamara() {
    if (camaraActiva) return;

    mostrarEstadoQR('camara');
    const btnEscanear = document.getElementById('btn-escanear');
    if (btnEscanear) btnEscanear.disabled = true;

    try {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('Librería Html5Qrcode no encontrada.');
        }

        if (!html5QrScanner) {
            html5QrScanner = new Html5Qrcode('qr-reader');
        }

        camaraActiva = true;

        const config = {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0
        };

        await html5QrScanner.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            onScanError
        );

    } catch (err) {
        camaraActiva = false;
        console.warn('Error al iniciar cámara:', err);

        Swal.fire({
            icon: 'warning',
            title: 'Cámara no disponible',
            text: 'No se pudo acceder a la cámara del dispositivo. Verifica los permisos de la cámara.',
            background: '#0a0f1c',
            color: '#ffffff',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#2473F5'
        }).then(() => {
            volverAEscanear();
        });
    }
}

async function detenerCamara() {
    if (html5QrScanner && camaraActiva) {
        try {
            await html5QrScanner.stop();
            html5QrScanner.clear();
        } catch (e) {
            console.warn('Error al detener cámara:', e);
            try { html5QrScanner.clear(); } catch(e2){}
        }
        camaraActiva = false;
    }
    volverAEscanear();
}

function onScanError(errorMessage) {
    // Silencioso mientras busca el QR en cada fotograma
}

// ── Callback al Detectar un QR ─────────────────────────────────────────
async function onScanSuccess(decodedText) {
    if (!camaraActiva) return;
    
    // Detener cámara inmediatamente al detectar
    if (html5QrScanner) {
        try {
            await html5QrScanner.stop();
        } catch (e) {}
        camaraActiva = false;
    }

    mostrarEstadoQR('cargando');

    // Procesar payload detectado
    await procesarCodigoQR(decodedText);
}

// ── Procesar contenido del QR ──────────────────────────────────────────
async function procesarCodigoQR(rawText) {
    try {
        const texto = String(rawText || '').trim();
        if (!texto) {
            throw new Error('El código QR está vacío.');
        }

        let datos;
        try {
            datos = JSON.parse(texto);
        } catch (e) {
            datos = { keeper: 'pase-acceso-qr', paseId: texto };
        }

        // validar el pase en la api
        const paseId = String(datos.paseId || datos.idPaseAcceso || '').trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paseId)) {
            throw new Error('El QR no contiene un pase válido de Keeper');
        }

        {
            const pase = await validarPaseQR(paseId);

            const esResidente = pase.tipoPase === 'Propietario';

            if (esResidente) {
                const idPersona = pase.fkPersonas;
                let persona = null;
                if (idPersona) {
                    persona = await getPersona(idPersona).catch(() => null);
                }

                let nombreCasa = '';
                if (!nombreCasa && idPersona) {
                    try {
                        const props = await getPropiedades();
                        const prop = props.find(p => String(p.fkPropietario).toLowerCase() === String(idPersona).toLowerCase());
                        if (prop) {
                            nombreCasa = prop.nombrePropiedad || prop.calle || prop.codigo || '';
                        }
                    } catch (_) {}
                }
                if (!nombreCasa) nombreCasa = 'Residencia Asignada';

                const nombreCompleto = persona 
                    ? `${persona.nombrePersona || ''} ${persona.apellidoPersona || ''}`.trim()
                    : 'Residente';

                personaActual = {
                    id: idPersona || pase.idPaseAcceso,
                    tipoOrigen: 'residente',
                    nombre: nombreCompleto,
                    dui: persona?.duiPersona || '—',
                    casa: nombreCasa,
                    horaEstimada: 'Acceso Permanente 24/7',
                    tipo: `Residente (${persona?.tipoPersona || 'Propietario'})`,
                    Vehículo: 'Acceso Peatonal / Vehicular Registrado',
                    Teléfono: persona?.telefonoPersona || '—',
                    estado: 'activo',
                    foto: persona?.fotoUrlPersona || '',
                    pase: pase,
                    paseId: pase.idPaseAcceso || paseId,
                };

            } else {
                // Es Pase de Visita
                const visitas = await getVisitas();
                const visitaEncontrada = visitas.find(v =>
                    pase.fkVisitas && String(v.idVisitas || v.idVisita || v.id) === String(pase.fkVisitas)
                );

                if (visitaEncontrada) {
                    personaActual = {
                        id: visitaEncontrada.idVisita || visitaEncontrada.id,
                        tipoOrigen: 'paseQR',
                        nombre: visitaEncontrada.nombreVisitante || 'Visitante',
                        dui: visitaEncontrada.duiVisitante || '—',
                        casa: visitaEncontrada.nombreAnfitrion || '—',
                        horaEstimada: visitaEncontrada.fechaVisita || '—',
                        tipo: visitaEncontrada.tipoTransporte || 'Peatonal',
                        Vehículo: (visitaEncontrada.tipoTransporte === 'Vehicular' || visitaEncontrada.tipoTransporte === 'Vehículo') ? 'Vehicular' : 'N/A (peatonal)',
                        Teléfono: visitaEncontrada.telefonoVisitante || '—',
                        estado: 'activo',
                        foto: '',
                        pase: pase,
                        paseId: pase.idPaseAcceso || paseId,
                        fkVisitante: visitaEncontrada.fkVisitante || null,
                    };
                } else {
                    throw new Error('La visita asociada al pase no existe en el sistema');
                }
            }
        }

        pintarDatos(personaActual);
        mostrarEstadoQR('foto');
        
        // Ocultar botones de inicio de escaneo y mostrar botones de resultado
        ocultarBotonesIniciales();
        const botonesResultado = document.getElementById('qr-botones-resultado');
        if (botonesResultado) botonesResultado.classList.remove('qr-oculto');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: personaActual.tipoOrigen === 'residente' 
                ? 'Pase de Residente verificado' 
                : 'Código QR de Visita válido',
            showConfirmButton: false,
            timer: 2500,
            background: '#0a0f1c',
            color: '#fff'
        });

    } catch (err) {
        console.error('Error al procesar QR:', err);
        mostrarEstadoQR('rechazado');
        const motivoEl = document.getElementById('qr-motivo-mostrado');
        if (motivoEl) motivoEl.textContent = err.message || 'Pase inválido';
        Swal.fire({
            toast: false,
            position: 'center',
            icon: 'error',
            title: 'QR rechazado',
            text: err.message || 'El pase no existe, está inactivo o expiró.',
            background: '#0a0f1c',
            color: '#fff'
        });
        volverAEscanear();
    }
}

function ocultarBotonesIniciales() {
    const el = document.getElementById('btn-escanear');
    if (el) el.style.display = 'none';
}

function mostrarBotonesIniciales() {
    const el = document.getElementById('btn-escanear');
    if (el) el.style.display = '';
}

function volverAEscanear() {
    mostrarEstadoQR('marco');
    limpiarDatos();
    personaActual = null;
    mostrarBotonesIniciales();
    const btnScan = document.getElementById('btn-escanear');
    if (btnScan) btnScan.disabled = false;
    const botonesResultado = document.getElementById('qr-botones-resultado');
    if (botonesResultado) botonesResultado.classList.add('qr-oculto');
}

async function permitirAcceso() {
    if (!personaActual) return;

    try {
        // Usuario real de la sesión (cookie), no datos guardados en el navegador
        const yo = await window.CredentialsStore.verificarSesion();
        if (!yo) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

        const detalles = await getDetalleTurnos();
        const miTurno = detalles.find(d =>
            String(d.fkEmpleado).toLowerCase() === String(yo.id).toLowerCase()
            && String(d.estadoturno).toLowerCase() === 's'
        );
        if (!miTurno) {
            throw new Error('No tienes un turno activo asignado. Pide al administrador que te asigne a una caseta.');
        }

        await registrarAcceso({
            metodoAcceso: 'QR',
            horaEntrada: fechaHoraLocalISO(),
            fkPasesAcceso: personaActual.paseId,
            fkDetalleTurno: miTurno.idDetalleTurno || miTurno.id
        });

        // la visita queda aprobada para que el dashboard la muestre
        let avisoVisita = '';
        if (personaActual.tipoOrigen === 'paseQR' && personaActual.id) {
            try {
                await marcarEstadoVisita(personaActual.id, 'Aprobada');
            } catch (eVis) {
                console.warn('No se pudo marcar la visita como aprobada:', eVis.message);
                avisoVisita = `<br><small style="color:#f59e0b;">El acceso quedó registrado, pero la visita no se pudo marcar como aprobada: ${escapeHtml(eVis.message)}</small>`;
            }
        }

        await Swal.fire({
            toast: false,
            position: 'center',
            icon: 'success',
            title: '¡Acceso Permitido!',
            html: `Se autorizó el ingreso de <strong>${escapeHtml(personaActual.nombre)}</strong> correctamente.<br><small style="color:#94a3b8;">${escapeHtml(personaActual.casa)}</small>${avisoVisita}`,
            timer: avisoVisita ? undefined : 2600,
            showConfirmButton: !!avisoVisita,
            background: '#0a0f1c',
            color: '#fff'
        });

    } catch (e) {
        await Swal.fire({
            toast: false,
            position: 'center',
            icon: 'error',
            title: 'Acceso no registrado',
            text: e.message || 'La API no pudo registrar el acceso.',
            background: '#0a0f1c',
            color: '#fff'
        });
    }

    volverAEscanear();
}

function abrirModalMotivo() {
    if (!personaActual) return;

    document.querySelectorAll('input[name="motivoRechazo"]').forEach(function (r) { r.checked = false; });
    const otroInput = document.getElementById('motivo-otro-texto');
    if (otroInput) {
        otroInput.value = '';
        otroInput.classList.add('qr-oculto');
    }
    const btnConfirm = document.getElementById('btn-confirmar-rechazo');
    if (btnConfirm) btnConfirm.disabled = true;
    document.querySelectorAll('.motivo-opcion').forEach(function (op) { op.classList.remove('motivo-seleccionada'); });

    const modal = document.getElementById('modal-motivo-rechazo');
    if (modal) modal.classList.add('activo');
}

function cerrarModalMotivo() {
    const modal = document.getElementById('modal-motivo-rechazo');
    if (modal) modal.classList.remove('activo');
}

function actualizarSeleccionMotivo() {
    const seleccionado = document.querySelector('input[name="motivoRechazo"]:checked');
    const textareaOtro = document.getElementById('motivo-otro-texto');
    const btnConfirmar = document.getElementById('btn-confirmar-rechazo');

    document.querySelectorAll('.motivo-opcion').forEach(function (op) {
        const input = op.querySelector('input');
        if (input) op.classList.toggle('motivo-seleccionada', input.checked);
    });

    if (!seleccionado) {
        if (btnConfirmar) btnConfirmar.disabled = true;
        if (textareaOtro) textareaOtro.classList.add('qr-oculto');
        return;
    }

    if (seleccionado.value === 'Otro') {
        if (textareaOtro) {
            textareaOtro.classList.remove('qr-oculto');
            if (btnConfirmar) btnConfirmar.disabled = textareaOtro.value.trim().length === 0;
        }
    } else {
        if (textareaOtro) textareaOtro.classList.add('qr-oculto');
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}

async function confirmarRechazo() {
    const seleccionado = document.querySelector('input[name="motivoRechazo"]:checked');
    if (!seleccionado || !personaActual) return;

    const textareaOtro = document.getElementById('motivo-otro-texto');
    const motivoFinal = seleccionado.value === 'Otro'
        ? (textareaOtro ? textareaOtro.value.trim() : 'Otro motivo')
        : seleccionado.value;

    if (!motivoFinal) return;

    // rechazar entrada
    cerrarModalMotivo();
    const persona = personaActual;

    // la visita queda desaprobada para que el dashboard la muestre en rechazados
    let avisoVisita = '';
    if (persona.tipoOrigen === 'paseQR' && persona.id) {
        try {
            await marcarEstadoVisita(persona.id, 'Desaprobada');
        } catch (eVis) {
            console.warn('No se pudo marcar la visita como desaprobada:', eVis.message);
            avisoVisita = ` (No se pudo actualizar la visita: ${eVis.message})`;
        }
    }

    const motivoEl = document.getElementById('qr-motivo-mostrado');
    if (motivoEl) motivoEl.textContent = 'Motivo: ' + motivoFinal;
    mostrarEstadoQR('rechazado');

    const botonesResultado = document.getElementById('qr-botones-resultado');
    if (botonesResultado) botonesResultado.classList.add('qr-oculto');

    await Swal.fire({
        toast: false,
        position: 'center',
        icon: 'error',
        title: 'Acceso Denegado',
        text: `Motivo: ${motivoFinal}${avisoVisita}`,
        timer: avisoVisita ? undefined : 2500,
        showConfirmButton: !!avisoVisita,
        background: '#0a0f1c',
        color: '#fff'
    });

    volverAEscanear();
}

const GRAVEDAD_TEXTO = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' };

async function verInfracciones() {
    const contenedor = document.getElementById('infp-lista-contenedor');
    if (!contenedor) return;

    contenedor.innerHTML = '<p class="infp-vacio">Consultando historial en base de datos...</p>';
    document.getElementById('panel-infracciones-lista')?.classList.add('activo');

    try {
        // infracciones de la persona
        const aLista = (r) => Array.isArray(r) ? r : (r?.data || []);
        const [todas, incidentes, gravedades] = await Promise.all([
            getInfraccionesDetalladas().then(aLista),
            apiFetch('/incidentes', { silencioso: true }).then(aLista).catch(() => []),
            apiFetch('/gravedadInfracciones', { silencioso: true }).then(aLista).catch(() => [])
        ]);
        let infracciones = [];
        if (personaActual?.tipoOrigen === 'residente') {
            infracciones = infraccionesDe(personaActual.id, { infracciones: todas, incidentes, gravedades });
        } else if (personaActual?.fkVisitante) {
            // incidentes del visitante
            const visitas = await getVisitas().catch(() => []);
            const idsVisitas = new Set(visitas
                .filter(v => String(v.fkVisitante).toLowerCase() === String(personaActual.fkVisitante).toLowerCase())
                .map(v => String(v.idVisitas || v.idVisita || v.id)));
            const incVisitante = incidentes.filter(i => i.fkVisita != null && idsVisitas.has(String(i.fkVisita)));
            infracciones = todas
                .filter(inf => incVisitante.some(i => String(i.idIncidente) === String(inf.fkIncidente)))
                .map(inf => {
                    const inc = incVisitante.find(i => String(i.idIncidente) === String(inf.fkIncidente));
                    return { ...inf, motivo: inc.descripcionIncidente, fecha: inc.fechaHoraIncidente, lugar: inc.lugarIncidente, gravedad: window.gravedadDeInfraccion(inf, gravedades) };
                });
        }
        const fechaCorta = (f) => f ? new Date(String(f).length <= 10 ? `${f}T12:00:00` : f).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';

        if (!infracciones.length) {
            contenedor.innerHTML = '<p class="infp-vacio">No hay incidentes registrados para esta persona en la base de datos.</p>';
        } else {
            contenedor.innerHTML = infracciones.map(function (inf) {
                const id = inf.idInfraccion || inf.id;
                const causante = personaActual?.nombre || 'Incidente';
                const grav = window.claveGravedad(inf.gravedad) || 'sin-dato';
                const desc = inf.motivo || 'Sin descripción';
                const fecha = `${fechaCorta(inf.fecha)} · $${Number(inf.monto || 0).toFixed(2)} · ${inf.estado || 'Pendiente'}`;
                const residente = inf.lugar || 'Sin lugar';

                return `
                    <button type="button" class="infp-item" data-id="${escapeHtml(id)}">
                        <span class="infp-item-punto infp-punto-${escapeHtml(grav)}"></span>
                        <span class="infp-item-cuerpo">
                            <span class="infp-item-titulo">${escapeHtml(causante)} — ${escapeHtml(GRAVEDAD_TEXTO[grav] || inf.gravedad || 'Sin gravedad')}</span>
                            <span class="infp-item-desc">${escapeHtml(desc)}</span>
                            <span class="infp-item-meta">${escapeHtml(fecha)} · Lugar: ${escapeHtml(residente)}</span>
                        </span>
                        <span class="infp-item-flecha">→</span>
                    </button>
                `;
            }).join('');
        }
    } catch (e) {
        contenedor.innerHTML = '<p class="infp-vacio">Error al consultar incidentes en la API.</p>';
    }
}

// ── Inicialización de Eventos ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    let usuarioActual = null;
    try {
        usuarioActual = await AuthService.obtenerUsuarioActual();
    } catch (e) {
        console.warn('Error al verificar sesión:', e);
    }

    if (!usuarioActual) {
        window.location.href = '../Index.html';
        return;
    }

    const userEl = document.getElementById('sidebar-nombre-usuario');
    if (userEl && usuarioActual) {
        const nombre = usuarioActual.firstName || usuarioActual.nombreEmpleado || '';
        const apellido = usuarioActual.lastName || usuarioActual.apellidoEmpleado || '';
        userEl.textContent = `${nombre} ${apellido}`.trim() || 'Usuario';
    }

    const btnEscanear = document.getElementById('btn-escanear');
    const btnDetenerCam = document.getElementById('btn-detener-camara');
    const btnPermitir = document.getElementById('btn-permitir');
    const btnDenegar  = document.getElementById('btn-denegar');
    const btnInfracciones = document.getElementById('btn-infracciones');

    if (btnEscanear) btnEscanear.addEventListener('click', iniciarEscaneoCamara);
    if (btnDetenerCam) btnDetenerCam.addEventListener('click', detenerCamara);
    if (btnPermitir) btnPermitir.addEventListener('click', permitirAcceso);
    if (btnDenegar) btnDenegar.addEventListener('click', abrirModalMotivo);
    if (btnInfracciones) btnInfracciones.addEventListener('click', verInfracciones);

    const btnCancRechazo = document.getElementById('btn-cancelar-rechazo');
    if (btnCancRechazo) btnCancRechazo.addEventListener('click', cerrarModalMotivo);

    const btnConfRechazo = document.getElementById('btn-confirmar-rechazo');
    if (btnConfRechazo) btnConfRechazo.addEventListener('click', confirmarRechazo);

    document.querySelectorAll('input[name="motivoRechazo"]').forEach(function (radio) {
        radio.addEventListener('change', actualizarSeleccionMotivo);
    });
    const textareaOtro = document.getElementById('motivo-otro-texto');
    if (textareaOtro) textareaOtro.addEventListener('input', actualizarSeleccionMotivo);

    const modalMotivo = document.getElementById('modal-motivo-rechazo');
    if (modalMotivo) {
        modalMotivo.addEventListener('click', function (event) {
            if (event.target === this) cerrarModalMotivo();
        });
    }

    const panelLista = document.getElementById('panel-infracciones-lista');
    if (panelLista) {
        const btnCerrarInf = document.getElementById('btn-cerrar-infracciones-lista');
        if (btnCerrarInf) {
            btnCerrarInf.addEventListener('click', function () {
                panelLista.classList.remove('activo');
            });
        }
        panelLista.addEventListener('click', function (event) {
            if (event.target === panelLista) panelLista.classList.remove('activo');
        });
    }
});
