/** ficha del residente */
import { cargarDatosBase, fichaResidente } from '../servicios/residenteDatosService.js';
import { generarReporteInfracciones, generarTarjetaAcceso, generarQrConLogo, contenidoQrPase } from '../servicios/documentosKeeper.js';

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;

function fecha(valor, conHora = false) {
    if (!valor) return '—';
    const t = String(valor);
    const d = new Date(t.length <= 10 ? `${t}T12:00:00` : t);
    if (Number.isNaN(d.getTime())) return t;
    return conHora
        ? d.toLocaleString('es-SV', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CLASE_ESTADO = {
    Pendiente: 'estado-rojo', Pagada: 'estado-verde', Impugnada: 'estado-ambar', Anulada: 'estado-gris',
    Aprobada: 'estado-verde', Desaprobada: 'estado-rojo', Expirada: 'estado-gris'
};
const pildora = (texto) => `<span class="ficha-pildora ${CLASE_ESTADO[texto] || ''}">${escapeHtml(texto || '—')}</span>`;
const filaVacia = (cols, texto) => `<tr><td colspan="${cols}" class="ficha-vacia">${escapeHtml(texto)}</td></tr>`;

const idPersona = new URLSearchParams(location.search).get('id');
let ficha = null;
let emisor = 'Administración';
let ocupado = false;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) await window.CredentialsStore.protegerVista();
    try {
        const yo = await window.CredentialsStore?.verificarSesion?.();
        if (yo) emisor = yo.nombreCompleto || yo.username || yo.email || emisor;
    } catch (_) { /* se usa el texto por defecto */ }

    configurarPestanas();
    $('btn-reporte-pdf').addEventListener('click', descargarReporte);
    $('btn-imprimir-tarjeta').addEventListener('click', () => imprimirTarjeta(false));
    $('btn-reemplazar-tarjeta').addEventListener('click', () => imprimirTarjeta(true));

    if (!idPersona) {
        $('ficha-estado').textContent = 'No se indicó qué residente mostrar. Vuelve a la lista de residentes.';
        return;
    }
    await cargar();
});

async function cargar() {
    const base = await cargarDatosBase();
    ficha = fichaResidente(idPersona, base);
    if (!ficha) {
        $('ficha-estado').textContent = 'No se encontró el residente. Puede que haya sido eliminado.';
        return;
    }
    $('ficha-estado').hidden = true;
    $('ficha-contenido').hidden = false;
    document.title = `${ficha.nombre} | Keeper`;
    pintar();
    ['btn-reporte-pdf', 'btn-imprimir-tarjeta', 'btn-reemplazar-tarjeta'].forEach(id => { $(id).disabled = false; });
}

function pintar() {
    const p = ficha.persona;
    const foto = $('ficha-foto');
    foto.src = p.fotoUrlPersona || window.AVATAR_DEFECTO;
    foto.onerror = () => { foto.onerror = null; foto.src = window.AVATAR_DEFECTO; };
    foto.alt = ficha.nombre;
    $('ficha-nombre').textContent = ficha.nombre;
    $('ficha-tipo').textContent = p.tipoPersona || 'Residente';
    $('ficha-dui').textContent = p.duiPersona || '—';
    $('ficha-telefono').textContent = p.telefonoPersona || '—';
    $('ficha-correo').textContent = p.emailPersona || '—';
    $('ficha-ingreso').textContent = fecha(p.fechaEntradaColonia);
    $('ficha-propiedad').textContent = ficha.propiedades.map(pr => pr.descripcion).join(', ') || 'Sin propiedad asignada';

    const r = ficha.resumen;
    $('kpi-infracciones').textContent = r.cantidad;
    $('kpi-pendiente').textContent = dinero(r.totalPendiente);
    $('kpi-pagado').textContent = dinero(r.totalPagado);
    $('kpi-visitas').textContent = ficha.visitas.length;
    $('kpi-accesos').textContent = ficha.accesos.length;

    $('tabla-infracciones').innerHTML = ficha.infracciones.length
        ? ficha.infracciones.map(i => `
            <tr>
                <td>${escapeHtml(fecha(i.fecha))}</td>
                <td class="ficha-motivo">${escapeHtml(i.motivo)}</td>
                <td>${escapeHtml(i.lugar || '—')}</td>
                <td class="ficha-capital">${escapeHtml(i.gravedad || '—')}</td>
                <td style="text-align:right; font-variant-numeric:tabular-nums">${escapeHtml(dinero(i.monto))}</td>
                <td>${pildora(i.estado)}</td>
                <td style="text-align:center">
                    <button type="button" class="btn-cambiar-estado-deuda" data-id="${escapeHtml(i.idInfraccion)}" data-estado="${escapeHtml(i.estado)}" data-monto="${escapeHtml(dinero(i.monto))}" data-motivo="${escapeHtml(i.motivo)}" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:5px 12px; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 2px 6px rgba(37,99,235,0.35); transition:all 0.2s;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Modificar estado
                    </button>
                </td>
            </tr>`).join('')
        : filaVacia(7, 'El residente no registra infracciones.');
    conectarEventosDeuda();

    $('tabla-visitas').innerHTML = ficha.visitas.length
        ? ficha.visitas.map(v => `
            <tr>
                <td>${escapeHtml(fecha(v.fechaVisita))}</td>
                <td>${escapeHtml(v.nombreVisitante)}</td>
                <td>${escapeHtml(v.duiVisitante || '—')}</td>
                <td>${pildora(v.estado)}</td>
            </tr>`).join('')
        : filaVacia(4, 'El residente no tiene visitas registradas.');

    $('tabla-accesos').innerHTML = ficha.accesos.length
        ? ficha.accesos.map(a => `
            <tr>
                <td>${escapeHtml(fecha(a.horaEntrada, true))}</td>
                <td>${escapeHtml(a.quien)}</td>
                <td>${escapeHtml(a.metodoAcceso === 'QR' ? 'Código QR' : 'Manual')}</td>
            </tr>`).join('')
        : filaVacia(3, 'Todavía no hay entradas registradas.');

    pintarPase();
}

async function pintarPase() {
    const cont = $('ficha-pase-qr');
    if (!ficha.pase) {
        cont.innerHTML = '<div class="ficha-pase-vacio">Sin pase vigente</div>';
        $('ficha-pase-estado').textContent = 'Sin pase activo';
        $('ficha-pase-vigencia').textContent = 'Al imprimir la tarjeta se crea uno nuevo.';
        return;
    }
    $('ficha-pase-estado').textContent = 'Pase activo';
    $('ficha-pase-vigencia').textContent = `Válido hasta ${fecha(ficha.pase.duracionPase)}`;
    try {
        const src = await generarQrConLogo(contenidoQrPase(ficha.pase.idPaseAcceso), { lado: 300 });
        cont.innerHTML = `<img src="${src}" alt="Código QR del pase de ${escapeHtml(ficha.nombre)}">`;
    } catch (e) {
        cont.innerHTML = '<div class="ficha-pase-vacio">No se pudo dibujar el QR</div>';
    }
}

function configurarPestanas() {
    document.querySelectorAll('.ficha-pestanas button').forEach(boton => {
        boton.addEventListener('click', () => {
            document.querySelectorAll('.ficha-pestanas button').forEach(b => {
                const activo = b === boton;
                b.classList.toggle('activo', activo);
                b.setAttribute('aria-selected', String(activo));
            });
            document.querySelectorAll('.ficha-panel').forEach(panel => {
                panel.hidden = panel.dataset.panel !== boton.dataset.pestana;
            });
        });
    });
}

async function conBoton(id, tarea) {
    if (ocupado) return;
    ocupado = true;
    const boton = $(id);
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.classList.add('cargando');
    try {
        await tarea();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'No se pudo completar', text: e.message || 'Error inesperado', background: '#0a0f1c', color: '#fff' });
    } finally {
        boton.innerHTML = original;
        boton.disabled = false;
        boton.classList.remove('cargando');
        ocupado = false;
    }
}

function descargarReporte() {
    return conBoton('btn-reporte-pdf', async () => {
        const numero = await generarReporteInfracciones(ficha, emisor);
        Swal.fire({ icon: 'success', title: 'Reporte generado', html: `Documento <strong>${escapeHtml(numero)}</strong> descargado.`, timer: 2600, showConfirmButton: false, background: '#0a0f1c', color: '#fff' });
    });
}

/** Crea un pase personal nuevo (1 año). */
async function crearPasePersonal() {
    const hoy = fechaLocalISO();
    const [y, m, d] = hoy.split('-').map(Number);
    const fin = fechaLocalISO(new Date(y + 1, m - 1, d));
    return apiFetch('/paseAccesoQR', {
        method: 'POST',
        body: { tipoPase: 'Propietario', fechaInicioPase: hoy, duracionPase: fin, paseActivo: 's', fkPersonas: ficha.persona.idPersona }
    });
}

/** desactivar pases del residente */
async function desactivarPasesPersonales(base) {
    const activos = base.pases.filter(p => p.tipoPase === 'Propietario'
        && String(p.fkPersonas).toLowerCase() === String(ficha.persona.idPersona).toLowerCase()
        && String(p.paseActivo).toLowerCase() === 's');
    for (const p of activos) {
        await apiFetch(`/paseAccesoQR/${p.idPaseAcceso}`, { method: 'PATCH', body: { paseActivo: 'n' } });
    }
    return activos.length;
}

function imprimirTarjeta(reemplazar) {
    const id = reemplazar ? 'btn-reemplazar-tarjeta' : 'btn-imprimir-tarjeta';
    return conBoton(id, async () => {
        if (reemplazar) {
            const r = await Swal.fire({
                icon: 'warning',
                title: '¿Reemplazar la tarjeta?',
                html: `Se desactivará el pase actual de <strong>${escapeHtml(ficha.nombre)}</strong>: la tarjeta impresa anterior
                       y el QR de su celular dejarán de funcionar. Su app mostrará el nuevo código automáticamente.`,
                showCancelButton: true,
                confirmButtonText: 'Sí, reemplazar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#ef4444',
                background: '#0a0f1c',
                color: '#fff'
            });
            if (!r.isConfirmed) return;
            const base = await cargarDatosBase();
            await desactivarPasesPersonales(base);
            await crearPasePersonal();
        } else if (!ficha.pase) {
            const r = await Swal.fire({
                icon: 'question',
                title: 'El residente no tiene un pase vigente',
                text: 'Se creará un pase personal válido por un año y se imprimirá la tarjeta.',
                showCancelButton: true,
                confirmButtonText: 'Crear e imprimir',
                cancelButtonText: 'Cancelar',
                background: '#0a0f1c',
                color: '#fff'
            });
            if (!r.isConfirmed) return;
            await crearPasePersonal();
        }

        // datos actualizados
        const base = await cargarDatosBase();
        ficha = fichaResidente(idPersona, base);
        pintar();
        if (!ficha.pase) throw new Error('La API no devolvió un pase vigente para el residente.');
        await generarTarjetaAcceso(ficha, ficha.pase);
        Swal.fire({
            icon: 'success',
            title: reemplazar ? 'Tarjeta reemplazada' : 'Tarjeta lista',
            text: 'Se descargó el PDF para imprimir a tamaño real.',
            timer: 2600,
            showConfirmButton: false,
            background: '#0a0f1c',
            color: '#fff'
        });
    });
}

function conectarEventosDeuda() {
    document.querySelectorAll('.btn-cambiar-estado-deuda').forEach(btn => {
        btn.onclick = async () => {
            const idInf = btn.dataset.id;
            const estadoActual = btn.dataset.estado;
            const monto = btn.dataset.monto;
            const motivo = btn.dataset.motivo;

            const { value: nuevoEstado } = await Swal.fire({
                title: 'Modificar Estado de la Deuda',
                html: `
                    <div style="text-align:left; font-size:13.5px; margin-bottom:12px; color:#cbd5e1; background:rgba(255,255,255,0.04); padding:12px; border-radius:8px;">
                        <p style="margin:0 0 6px 0;"><strong>Motivo:</strong> ${escapeHtml(motivo)}</p>
                        <p style="margin:0 0 6px 0;"><strong>Monto:</strong> <span style="color:#10b981; font-weight:700;">${escapeHtml(monto)}</span></p>
                        <p style="margin:0;"><strong>Estado actual:</strong> <span style="font-weight:700; color:#38bdf8;">${escapeHtml(estadoActual)}</span></p>
                    </div>
                    <p style="font-size:13px; color:#94a3b8; text-align:left; margin-bottom:6px;">Selecciona el nuevo estado:</p>
                `,
                input: 'select',
                inputOptions: {
                    'Pendiente': 'Pendiente',
                    'Pagada': 'Pagada',
                    'Impugnada': 'Impugnada',
                    'Anulada': 'Anulada'
                },
                inputValue: estadoActual,
                showCancelButton: true,
                confirmButtonText: 'Guardar cambios',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#2563eb',
                cancelButtonColor: '#475569',
                background: '#0a0f1c',
                color: '#fff'
            });

            if (!nuevoEstado || nuevoEstado === estadoActual) return;

            try {
                await apiFetch(`/infracciones/${idInf}`, {
                    method: 'PATCH',
                    body: { estado: nuevoEstado }
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Estado de deuda actualizado',
                    text: `La infracción ahora está: ${nuevoEstado}`,
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#0a0f1c',
                    color: '#fff'
                });

                const base = await cargarDatosBase();
                ficha = fichaResidente(idPersona, base);
                pintar();
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo actualizar',
                    text: err.message || 'Error al actualizar el estado de la deuda.',
                    background: '#0a0f1c',
                    color: '#fff'
                });
            }
        };
    });
}
