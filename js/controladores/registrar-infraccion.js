/** registro de infracciones */

import { createInfraccion, InfraccionesService } from '../servicios/infraccionesService.js';
import { getPersonas } from '../servicios/personasService.js';
import { getVisitas } from '../servicios/visitasService.js';
import { getPropiedades } from '../servicios/propiedadesService.js';
import { buscarVehiculoPorMatricula, createVehiculo } from '../servicios/vehiculosService.js';

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

let gravedadActual = 'leve';
let causanteActual = 'Residente';
let transporteActual = 'Vehicular';
let residentesCache = [];
let visitasCache = [];
let propiedadesCache = [];

function seleccionarGravedad(tarjeta, tipo) {
    document.querySelectorAll('.tarjeta-gravedad-registro-infraccion, .tarjeta-gravedad-registro-Infracción').forEach(function (c) {
        c.classList.remove('seleccionada', 'leve-sel', 'moderada-sel', 'grave-sel');
    });

    tarjeta.classList.add('seleccionada');
    if (tipo === 'leve')     tarjeta.classList.add('leve-sel');
    if (tipo === 'moderada') tarjeta.classList.add('moderada-sel');
    if (tipo === 'grave')    tarjeta.classList.add('grave-sel');

    gravedadActual = tipo;
}

function seleccionarOpcion(tarjeta, grupo) {
    const contenedorPadre = tarjeta.closest('.dos-columnas-registro-infraccion') || tarjeta.closest('.dos-columnas-registro-Infracción') || tarjeta.parentElement;
    if (contenedorPadre) {
        contenedorPadre.querySelectorAll('.tarjeta-opcion-registro-infraccion, .tarjeta-opcion-registro-Infracción').forEach(function (c) {
            c.classList.remove('seleccionada');
        });
    }
    tarjeta.classList.add('seleccionada');

    const elNombre = tarjeta.querySelector('.nombre-opcion-registro-infraccion, .nombre-opcion-registro-Infracción');
    const nombreOpcion = elNombre ? elNombre.textContent.trim() : '';

    if (grupo === 'causante') {
        causanteActual = nombreOpcion;
        actualizarCamposCausante();
    }
    if (grupo === 'transporte') {
        transporteActual = nombreOpcion;
        actualizarCamposTransporte();
    }
}

function actualizarCamposCausante() {
    const wrapResidente = document.getElementById('ri-nombre-residente-envoltura');
    const wrapVisitante  = document.getElementById('ri-nombre-visitante-envoltura');

    const esResidente = (causanteActual || '').toLowerCase() === 'residente';
    if (wrapResidente) {
        wrapResidente.classList.toggle('oculto-registro-infraccion', !esResidente);
        wrapResidente.classList.toggle('oculto-registro-Infracción', !esResidente);
        wrapResidente.style.display = esResidente ? '' : 'none';
    }
    if (wrapVisitante) {
        wrapVisitante.classList.toggle('oculto-registro-infraccion', esResidente);
        wrapVisitante.classList.toggle('oculto-registro-Infracción', esResidente);
        wrapVisitante.style.display = esResidente ? 'none' : '';
    }

    actualizarInfoResidente();
}

function actualizarCamposTransporte() {
    const wrapMatricula = document.getElementById('ri-matricula-envoltura') || document.getElementById('ri-Matrícula-envoltura');
    const esVehicular = (transporteActual || '').toLowerCase() === 'vehicular';
    if (wrapMatricula) {
        wrapMatricula.classList.toggle('oculto-registro-infraccion', !esVehicular);
        wrapMatricula.classList.toggle('oculto-registro-Infracción', !esVehicular);
        wrapMatricula.style.display = esVehicular ? '' : 'none';
    }
    if (!esVehicular) {
        const mat = document.getElementById('ri-matricula') || document.getElementById('ri-Matrícula');
        if (mat) mat.value = '';
        limpiarError('Matrícula');
        limpiarError('matricula');
    }
}

async function cargarDatos() {
    try {
        const [personas, visitas, propiedades] = await Promise.all([
            getPersonas().catch(() => []),
            getVisitas().catch(() => []),
            getPropiedades().catch(() => [])
        ]);
        residentesCache = Array.isArray(personas) ? personas : [];
        visitasCache = Array.isArray(visitas) ? visitas : [];
        propiedadesCache = Array.isArray(propiedades) ? propiedades : [];
    } catch (e) {
        residentesCache = [];
        visitasCache = [];
        propiedadesCache = [];
    }
    poblarSelectsResidentes();
    poblarSelectVisitas(null);
}

function poblarSelectsResidentes() {
    const opciones = residentesCache.map(function (r) {
        const id = r.idPersona || r.id;
        const nom = `${r.nombrePersona || r.firstName || ''} ${r.apellidoPersona || r.lastName || ''}`.trim();
        return `<option value="${escapeHtml(id)}">${escapeHtml(nom)}</option>`;
    }).join('');

    ['ri-residente-seleccionar', 'ri-residente-seleccionar-visita'].forEach(function (id) {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">Seleccione un residente...</option>' + opciones;
            if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(select);
        }
    });
}

function poblarSelectVisitas(filtroResidenteId) {
    const select = document.getElementById('ri-nombre');
    if (!select) return;

    if (!filtroResidenteId) {
        select.innerHTML = '<option value="">Seleccione un residente primero...</option>';
        select.disabled = true;
        if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(select);
        return;
    }
    const visitas = visitasCache
        .filter(v => String(v.fkPersona || '') === String(filtroResidenteId))
        .sort((a, b) => String(b.fechaVisita || '').localeCompare(String(a.fechaVisita || '')));
    const opciones = visitas.map(function (v) {
        const id = v.idVisita || v.id;
        const nombre = escapeHtml(v.nombreVisitante || v.nombre || 'Visitante');
        const fecha = v.fechaVisita ? ` · ${escapeHtml(String(v.fechaVisita).slice(0, 10))}` : '';
        return `<option value="${escapeHtml(id)}">${nombre}${fecha}</option>`;
    }).join('');

    select.disabled = !visitas.length;
    select.innerHTML = visitas.length
        ? '<option value="">Seleccione un visitante...</option>' + opciones
        : '<option value="">Este residente no tiene visitas registradas</option>';
    if (window.sincronizarSelectCustom) window.sincronizarSelectCustom(select);
}

function residenteSeleccionadoId() {
    if ((causanteActual || '').toLowerCase() === 'residente') {
        const el = document.getElementById('ri-residente-seleccionar');
        return el ? el.value : '';
    }
    const el = document.getElementById('ri-residente-seleccionar-visita');
    return el ? el.value : '';
}

function datosHogar(r) {
    if (!r) return { direccionTexto: '—', nucleoTexto: '—' };
    const prop = propiedadesCache.find(p => String(p.fkPropietario || p.fkPersona || p.idPersona) === String(r.idPersona || r.id));
    let direccionTexto = '';
    if (prop) {
        const num = prop.numeroCasa || prop.numCasa || '';
        const calle = prop.calle || prop.direccion || '';
        const pol = prop.poligono ? `Polígono ${prop.poligono}` : '';
        direccionTexto = [num ? `Casa #${num}` : '', pol, calle].filter(Boolean).join(', ');
    }
    direccionTexto = direccionTexto || r.direccionPropiedad || r.direccion || 'Sin propiedad asignada';
    const nucleoTexto = r.nucleoFamiliar || (r.apellidoPersona ? `Familia ${r.apellidoPersona}` : '—');
    return { direccionTexto, nucleoTexto };
}

function actualizarInfoResidente() {
    const id = residenteSeleccionadoId();
    const r = residentesCache.find(x => String(x.idPersona || x.id) === String(id));

    const elDireccion = document.getElementById('ri-direccion-valor') || document.getElementById('ri-info-Dirección');
    const elNucleo = document.getElementById('ri-nucleo-valor') || document.getElementById('ri-info-nucleo');
    const panelInfo = document.getElementById('ri-nucleo-info') || document.getElementById('ri-info-residente-panel');

    if (r) {
        const { direccionTexto, nucleoTexto } = datosHogar(r);

        if (elDireccion) elDireccion.textContent = direccionTexto;
        if (elNucleo) elNucleo.textContent = nucleoTexto;
        if (panelInfo) panelInfo.style.display = 'block';

        // Auto-completar DUI si es residente
        if ((causanteActual || '').toLowerCase() === 'residente') {
            const duiInput = document.getElementById('ri-dui');
            if (duiInput && (r.duiPersona || r.dui)) {
                duiInput.value = r.duiPersona || r.dui;
            }
        }
    } else {
        if (elDireccion) elDireccion.textContent = '—';
        if (elNucleo) elNucleo.textContent = '—';
    }
}

function alSeleccionarVisita() {
    const select = document.getElementById('ri-nombre');
    if (!select) return;
    const id = select.value;
    const v = visitasCache.find(x => (x.idVisita || x.id) == id);
    if (!v) return;

    const duiEl = document.getElementById('ri-dui');
    const matEl = document.getElementById('ri-matricula') || document.getElementById('ri-Matrícula');
    if (duiEl && (v.duiVisitante || v.dui)) duiEl.value = v.duiVisitante || v.dui;
    if (matEl && (v.matriculaVehiculo || v.Matrícula)) matEl.value = v.matriculaVehiculo || v.Matrícula;
}

function limpiarError(campo) {
    const errorEl = document.getElementById('ri-error-' + campo) || document.getElementById('ri-error-' + (campo === 'descripcion' ? 'desc' : campo));
    const inputEl = document.getElementById('ri-' + campo);
    if (errorEl) errorEl.classList.remove('mostrar');
    if (inputEl) inputEl.classList.remove('invalido');
    if (inputEl?._customDesplegableWrapper) inputEl._customDesplegableWrapper.classList.remove('invalido');
}

function marcarError(campo, mensaje) {
    const errorEl = document.getElementById('ri-error-' + campo) || document.getElementById('ri-error-' + (campo === 'descripcion' ? 'desc' : campo));
    const inputEl = document.getElementById('ri-' + campo);
    if (errorEl) {
        if (mensaje) errorEl.textContent = mensaje;
        errorEl.classList.add('mostrar');
    }
    if (inputEl) inputEl.classList.add('invalido');
    if (inputEl?._customDesplegableWrapper) inputEl._customDesplegableWrapper.classList.add('invalido');
}

function validarFormulario() {
    let Válido = true;
    ['descripcion', 'Descripción', 'nombre', 'dui', 'matricula', 'Matrícula', 'costo'].forEach(limpiarError);

    const descEl = document.getElementById('ri-descripcion') || document.getElementById('ri-Descripción');
    const desc = descEl?.value.trim();
    if (!desc || desc.length < 10) {
        marcarError('descripcion', 'Escribe una descripción de al menos 10 caracteres');
        Válido = false;
    }

    limpiarError('residente');
    const resId = residenteSeleccionadoId();
    if (!resId) {
        marcarError('residente', causanteActual === 'Residente' ? 'Seleccione el residente causante' : 'Seleccione el residente que recibió la visita');
        Válido = false;
    }

    const dui = document.getElementById('ri-dui')?.value.trim();
    if (dui && !/^\d{8}-\d$/.test(dui)) {
        marcarError('dui', 'Ingrese un DUI válido (00000000-0)');
        Válido = false;
    }

    if ((transporteActual || '').toLowerCase() === 'vehicular') {
        const placa = document.getElementById('ri-matricula')?.value.trim();
        if (!placa) {
            marcarError('matricula', 'La placa es obligatoria en una infracción vehicular');
            Válido = false;
        } else if (!/^[A-Z]{1,2}\d{3}-\d{3}$/.test(placa)) {
            marcarError('matricula', 'Formato de placa: P000-000');
            Válido = false;
        }
    }

    if (causanteActual === 'Visitante') {
        const visId = document.getElementById('ri-nombre')?.value;
        if (!visId) { marcarError('nombre', 'Seleccione un visitante'); Válido = false; }
    }

    const costo = document.getElementById('ri-costo')?.value.trim();
    if (!costo || isNaN(costo) || parseFloat(costo) <= 0) {
        marcarError('costo', 'El monto debe ser mayor a $0.00');
        Válido = false;
    }

    if (!Válido) {
        const primero = document.querySelector('.mensaje-error-registro-infraccion.mostrar');
        if (primero) primero.closest('.tarjeta-seccion-infraccion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return Válido;
}

function abrirDetalle() {
    if (!validarFormulario()) return;
    if (window.KeeperValida && !window.KeeperValida.revisar(['ri-dui', 'ri-matricula', 'ri-costo'])) return;

    const resId = residenteSeleccionadoId();
    const r = residentesCache.find(x => (x.idPersona || x.id) == resId);
    let nombre = r ? `${r.nombrePersona || r.firstName || ''} ${r.apellidoPersona || r.lastName || ''}`.trim() : '—';
    let residenteRelacionado = '—';
    let Dirección = '—';
    let nucleo = '—';

    const hogar = datosHogar(r);
    Dirección = hogar.direccionTexto;
    nucleo = hogar.nucleoTexto;
    if (causanteActual === 'Residente') {
        residenteRelacionado = nombre;
    } else {
        const visId = document.getElementById('ri-nombre')?.value;
        const v = visitasCache.find(x => (x.idVisita || x.id) == visId);
        if (v) nombre = v.nombreVisitante || v.nombre || 'Visitante';
        residenteRelacionado = r ? `${r.nombrePersona || r.firstName || ''} ${r.apellidoPersona || r.lastName || ''}`.trim() : '—';
    }

    const duiVal = document.getElementById('ri-dui')?.value || (causanteActual === 'Residente' && r ? r.duiPersona : '') || '—';
    const matVal = (transporteActual === 'Vehicular') ? ((document.getElementById('ri-matricula') || document.getElementById('ri-Matrícula'))?.value || 'N/A') : 'No aplica';
    const costoVal = '$' + parseFloat(document.getElementById('ri-costo')?.value || 0).toFixed(2);
    const descVal = (document.getElementById('ri-descripcion') || document.getElementById('ri-Descripción'))?.value || '—';

    const setOvl = (id, altId, val) => { 
        const el = document.getElementById(id) || (altId ? document.getElementById(altId) : null); 
        if (el) el.textContent = val; 
    };
    
    setOvl('ovl-desc', null, descVal);
    setOvl('ovl-grav-texto', null, gravedadActual.charAt(0).toUpperCase() + gravedadActual.slice(1));
    setOvl('ovl-causante', null, causanteActual);
    setOvl('ovl-nombre', null, nombre);
    setOvl('ovl-residente', null, residenteRelacionado);
    setOvl('ovl-direccion', 'ovl-Dirección', Dirección);
    setOvl('ovl-nucleo', null, nucleo);
    setOvl('ovl-transporte', null, transporteActual);
    setOvl('ovl-dui', null, duiVal);
    setOvl('ovl-matricula', 'ovl-Matrícula', matVal);
    setOvl('ovl-costo', null, costoVal);

    const gravCircle = document.getElementById('ovl-grav-circle');
    if (gravCircle) {
        gravCircle.className = 'ovl-grav-circle ' + gravedadActual + '-circle';
    }

    const matWrap = document.getElementById('ovl-matricula-envoltura') || document.getElementById('ovl-Matrícula-envoltura');
    if (matWrap) {
        matWrap.style.display = (transporteActual === 'Vehicular') ? '' : 'none';
    }

    const capa = document.getElementById('capa');
    if (capa) capa.classList.add('activo');
}

function cerrarDetalle(event) {
    const capa = document.getElementById('capa');
    if (!capa) return;
    if (event) {
        if (event.target.id === 'capa') capa.classList.remove('activo');
    } else {
        capa.classList.remove('activo');
    }
}

let enviandoInfraccion = false;
async function confirmarInfraccion() {
    if (enviandoInfraccion) return;
    enviandoInfraccion = true;
    const botonAplicar = document.getElementById('ri-btn-aplicar');
    if (botonAplicar) { botonAplicar.disabled = true; botonAplicar.dataset.texto = botonAplicar.innerHTML; botonAplicar.textContent = 'Guardando…'; }
    const costo = parseFloat(document.getElementById('ri-costo')?.value || 0);
    const Descripción = ((document.getElementById('ri-descripcion') || document.getElementById('ri-Descripción'))?.value || 'Infracción registrada desde caseta').trim();

    try {
        if (!(costo > 0)) throw new Error('Ingresa el monto de la infracción (mayor a $0.00).');

        // gravedad
        const gravedades = await InfraccionesService.obtenerGravedades();
        const gravedad = gravedades.find(g => window.claveGravedad(window.nombreGravedad(g)) === gravedadActual);
        if (!gravedad) throw new Error(`La gravedad "${gravedadActual}" no existe en la base de datos.`);
        const idGravedad = window.idGravedad(gravedad);
        if (idGravedad == null) throw new Error('La gravedad seleccionada no tiene un identificador válido en la API.');

        // 1 empleado que registra
        const yo = await window.CredentialsStore.verificarSesion();
        const fkEmpleado = yo?.id;
        if (!fkEmpleado) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

        // 2. Resolver actor (Residente o Visitante)
        let fkPersonas = null;
        let fkVisita = null;
        if (causanteActual === 'Residente') {
            fkPersonas = residenteSeleccionadoId() || null;
        } else {
            const visVal = document.getElementById('ri-nombre')?.value;
            if (visVal) fkVisita = Number(visVal);
        }

        // 3. Resolver vehículo si es transporte vehicular
        let fkVehiculos = null;
        if (transporteActual === 'Vehicular') {
            const mat = ((document.getElementById('ri-matricula') || document.getElementById('ri-Matrícula'))?.value || '').trim().toUpperCase();
            if (mat) {
                try {
                    const veh = await buscarVehiculoPorMatricula(mat);
                    if (veh && (veh.idVehiculo || veh.id)) {
                        fkVehiculos = veh.idVehiculo || veh.id;
                    } else {
                        const nuevoVeh = await createVehiculo({
                            matriculaVehiculo: mat,
                            tipoVehiculo: 'Automóvil',
                            marcaVehiculo: 'Genérico',
                            modeloVehiculo: 'Estándar'
                        });
                        fkVehiculos = nuevoVeh?.data?.idVehiculo || nuevoVeh?.idVehiculo || nuevoVeh?.id;
                    }
                } catch (eVeh) {
                    console.warn('Aviso al asociar vehículo:', eVeh.message);
                }
            }
        }

        // 4. Crear el Incidente correspondiente
        const fechaHoraIso = fechaHoraLocalISO();
        const payloadIncidente = {
            fkEmpleado: fkEmpleado,
            tipoActor: causanteActual === 'Residente' ? 'Residente' : 'Visitante',
            tipoIncidente: transporteActual === 'Vehicular' ? 'Vehicular' : 'Peatonal',
            fechaHoraIncidente: fechaHoraIso,
            lugarIncidente: 'Condominio Keeper',
            descripcionIncidente: Descripción,
            evidenciaUrl: null,
            fkPersonas: fkPersonas,
            fkVisita: fkVisita,
            fkVehiculos: fkVehiculos
        };

        // sin incidente no hay infraccion
        const resIncidente = await InfraccionesService.registrarIncidente(payloadIncidente);
        const incCreado = resIncidente?.data || resIncidente;
        const idIncidente = incCreado?.idIncidente || incCreado?.id;
        if (!idIncidente) throw new Error('La API no devolvió el incidente registrado.');

        // 5. Crear la Infracción asociada
        const payloadInfraccion = {
            fkTipoInfraccion: idGravedad,
            fkIncidente: idIncidente,
            monto: costo,
            estado: 'Pendiente'
        };

        await createInfraccion(payloadInfraccion);
        cerrarDetalle();
        limpiarFormulario();
        if (window.mostrarAlertaNotificacion) {
            window.mostrarAlertaNotificacion(`Infracción (${gravedadActual.toUpperCase()}) registrada con éxito`, 'success', '¡Infracción Guardada!');
        }
    } catch (err) {
        if (window.mostrarAlertaNotificacion) {
            window.mostrarAlertaNotificacion('Error al registrar la infracción: ' + err.message, 'error');
        }
    } finally {
        enviandoInfraccion = false;
        if (botonAplicar) { botonAplicar.disabled = false; if (botonAplicar.dataset.texto) botonAplicar.innerHTML = botonAplicar.dataset.texto; }
    }
}

function limpiarFormulario() {
    ['ri-descripcion', 'ri-nombre', 'ri-dui', 'ri-matricula', 'ri-costo', 'ri-residente-seleccionar', 'ri-residente-seleccionar-visita']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    ['descripcion', 'nombre', 'dui', 'matricula', 'costo', 'residente'].forEach(limpiarError);
    ['ri-residente-seleccionar', 'ri-residente-seleccionar-visita'].forEach(id => {
        const el = document.getElementById(id);
        if (el && window.sincronizarSelectCustom) window.sincronizarSelectCustom(el);
    });
    poblarSelectVisitas(null);
    const primeraGravedad = document.querySelector('.tarjeta-gravedad-registro-infraccion');
    if (primeraGravedad) seleccionarGravedad(primeraGravedad, 'leve');
    actualizarInfoResidente();
}

document.addEventListener('DOMContentLoaded', async function () {
    await cargarDatos();
    actualizarCamposCausante();
    actualizarCamposTransporte();

    const resSelect = document.getElementById('ri-residente-seleccionar');
    if (resSelect) resSelect.addEventListener('change', actualizarInfoResidente);

    const resVisitaSelect = document.getElementById('ri-residente-seleccionar-visita');
    if (resVisitaSelect) resVisitaSelect.addEventListener('change', function () {
        poblarSelectVisitas(resVisitaSelect.value || null);
        actualizarInfoResidente();
    });

    const visSelect = document.getElementById('ri-nombre');
    if (visSelect) visSelect.addEventListener('change', alSeleccionarVisita);

    const duiInput = document.getElementById('ri-dui');
    if (duiInput) {
        duiInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\D/g, "");
            if (value.length > 8) {
                value = value.substring(0, 8) + "-" + value.substring(8, 9);
            }
            e.target.value = value;
        });
    }

    const matriculaInput = document.getElementById('ri-matricula') || document.getElementById('ri-Matrícula');
    if (matriculaInput) {
        matriculaInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        });
    }

    // Al corregir un campo se quita su mensaje de error
    const camposError = { 'ri-descripcion': 'descripcion', 'ri-dui': 'dui', 'ri-matricula': 'matricula', 'ri-costo': 'costo', 'ri-nombre': 'nombre',
        'ri-residente-seleccionar': 'residente', 'ri-residente-seleccionar-visita': 'residente' };
    Object.entries(camposError).forEach(([id, campo]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const quitar = () => { limpiarError(campo); if (campo === 'residente') el._customDesplegableWrapper?.classList.remove('invalido'); };
        el.addEventListener('input', quitar);
        el.addEventListener('change', quitar);
    });

    document.querySelectorAll('.tarjeta-gravedad-registro-infraccion, .tarjeta-opcion-registro-infraccion').forEach(t => {
        t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
    });
});

// Globalizar funciones para botones en HTML
window.seleccionarGravedad = seleccionarGravedad;
window.seleccionarOpcion   = seleccionarOpcion;
window.abrirDetalle        = abrirDetalle;
window.cerrarDetalle       = cerrarDetalle;
window.confirmarInfraccion = confirmarInfraccion;
window.confirmarInfracción = confirmarInfraccion;
window.limpiarFormulario   = limpiarFormulario;
