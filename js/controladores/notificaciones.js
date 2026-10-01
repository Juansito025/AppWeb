/** notificaciones */

import { getNotificaciones, createNotificacion, actualizarNotificacion, deleteNotificacion } from '../servicios/notificacionesService.js';
import { getEmpleados } from '../servicios/empleadosService.js';

function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let notificacionesCache = [];
let empleadosCache = [];
let tabActual = 'todas';

const TIPO_CONFIG = {
    urgente:     { cardClass: 'urgente', iconWrap: 'urgente-icono', dot: 'sin-leer',       dotSm: 'rojo',   badgeClass: 'insignia-urgente',     badgeLabel: 'URGENTE',     colorSolido: '#dc2626' },
    alerta:      { cardClass: 'alerta',  iconWrap: 'alerta-icono',  dot: 'sin-leer',       dotSm: 'rojo',   badgeClass: 'insignia-alerta',      badgeLabel: 'ALERTA',      colorSolido: '#dc2626' },
    informativa: { cardClass: '',        iconWrap: 'azul-icono',    dot: 'sin-leer-azul',  dotSm: 'azul',  badgeClass: 'insignia-informativa', badgeLabel: 'INFORMATIVA', colorSolido: '#2563eb' },
    resuelta:    { cardClass: '',        iconWrap: 'verde-icono',   dot: 'sin-leer-verde', dotSm: 'verde', badgeClass: 'insignia-resuelta',    badgeLabel: 'RESUELTA',    colorSolido: '#059669' }
};

function tiempoRelativo(iso) {
    if (!iso) return 'Reciente';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return 'Justo ahora';
    if (min < 60) return `Hace ${min} min`;
    const horas = Math.round(min / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.round(horas / 24);
    return `Hace ${dias} d`;
}

function esLeida(n) {
    return n.leidaNotificacion === 's' || n.leidaNotificacion === 'S' || n.leida === true;
}

function parsearNotificacion(n) {
    const rawMsg = n.mensajeNotificacion || n.mensaje || '';
    let tipo = n.tipo || 'informativa';
    let Título = n.Título || 'Notificación del Sistema';
    let mensajeBody = rawMsg;

    const match = rawMsg.match(/^\[(URGENTE|ALERTA|INFORMATIVA|RESUELTA)\]\s*(.*?):\s*(.*)$/i);
    if (match) {
        tipo = match[1].toLowerCase();
        Título = match[2].trim();
        mensajeBody = match[3].trim();
    } else {
        const match2 = rawMsg.match(/^(.*?):\s*(.*)$/);
        if (match2) {
            Título = match2[1].trim();
            mensajeBody = match2[2].trim();
        }
    }

    let destinatario = 'Todos los usuarios (General)';
    let esIndividual = false;
    if (n.fkEmpleado) {
        const emp = empleadosCache.find(e => (e.idEmpleado || e.id) == n.fkEmpleado);
        if (emp) {
            destinatario = `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() || emp.correoEmpleado || 'Empleado';
            esIndividual = true;
        } else {
            destinatario = 'Empleado asignado';
            esIndividual = true;
        }
    }

    return { tipo, Título, mensaje: mensajeBody, destinatario, esIndividual, fkEmpleado: n.fkEmpleado };
}

function obtenerMiIdEmpleado() {
    try {
        const str = sessionStorage.getItem('keeper_sesion') || sessionStorage.getItem('KEEPER_CURRENT_USER');
        if (str) {
            const u = JSON.parse(str);
            return u.id || u.idEmpleado || u.emp_uuid_empleado || u.uuid || u.id_empleado || null;
        }
    } catch (_) {}
    return null;
}

function obtenerRolUsuario() {
    try {
        const str = sessionStorage.getItem('keeper_sesion') || sessionStorage.getItem('KEEPER_CURRENT_USER');
        if (str) {
            const u = JSON.parse(str);
            return String(u.role || u.rol || '').toLowerCase();
        }
    } catch (_) {}
    return '';
}

function esParaMi(n) {
    // Todos los empleados autenticados pueden ver las notificaciones del sistema
    return true;
}

function coincideConTab(n, tab) {
    const leida = esLeida(n);
    const parsed = parsearNotificacion(n);
    const miId = obtenerMiIdEmpleado();

    if (tab === 'todas') return true;
    if (tab === 'mis-notificaciones') {
        if (!n.fkEmpleado) return true;
        if (!miId) return true;
        return String(n.fkEmpleado).toLowerCase() === String(miId).toLowerCase();
    }
    if (tab === 'sin-leer') return !leida;
    if (tab === 'alertas') return parsed.tipo === 'urgente' || parsed.tipo === 'alerta';
    if (tab === 'informativas') return parsed.tipo === 'informativa' || parsed.tipo === 'resuelta' || !parsed.tipo;
    return true;
}

function actualizarBadges(all) {
    const total = all.length;
    const miId = obtenerMiIdEmpleado();
    const soloParaMi = all.filter(n => {
        if (!n.fkEmpleado) return true;
        if (!miId) return true;
        return String(n.fkEmpleado).toLowerCase() === String(miId).toLowerCase();
    }).length;
    const sinLeer = all.filter(n => !esLeida(n)).length;
    const alertas = all.filter(n => {
        const p = parsearNotificacion(n);
        return p.tipo === 'urgente' || p.tipo === 'alerta';
    }).length;
    const informativas = all.filter(n => {
        const p = parsearNotificacion(n);
        return p.tipo === 'informativa' || p.tipo === 'resuelta' || !p.tipo;
    }).length;

    const setBadge = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setBadge('insignia-todas', total);
    setBadge('insignia-mis-notificaciones', soloParaMi);
    setBadge('insignia-sin-leer', sinLeer);
    setBadge('insignia-alertas', alertas);
    setBadge('insignia-informativas', informativas);

    if (window.actualizarBadgeNotificaciones) {
        window.actualizarBadgeNotificaciones(sinLeer);
    }
}

let paginaActualNotif = 1;
const ITEMS_POR_PAGINA = 10;

function renderizarNotificaciones() {
    const esAdminNotif = String(obtenerRolUsuario() || '').toLowerCase().includes('admin');
    const contenedor = document.getElementById('notif-lista');
    if (!contenedor) return;

    const filtroTexto = (document.getElementById('notif-busqueda')?.value || '').toLowerCase().trim();

    const filtradas = notificacionesCache.filter(n => {
        if (!coincideConTab(n, tabActual)) return false;
        if (!filtroTexto) return true;
        const p = parsearNotificacion(n);
        return p.Título.toLowerCase().includes(filtroTexto) ||
               p.mensaje.toLowerCase().includes(filtroTexto) ||
               p.destinatario.toLowerCase().includes(filtroTexto);
    });

    if (!filtradas.length) {
        contenedor.innerHTML = `
            <div class="notif-vacio" style="text-align: center; padding: 48px 16px; color: #8892a8;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <p style="font-size: 15px; font-weight: 500; margin: 0;">No hay notificaciones para mostrar</p>
                <p style="font-size: 13px; margin-top: 4px;">Las nuevas alertas y mensajes aparecerán aquí</p>
            </div>
        `;
        if (window.renderizarPaginacion) {
            window.renderizarPaginacion('paginacion-notificaciones', 0, ITEMS_POR_PAGINA, 1, () => {});
        }
        return;
    }

    const totalPaginas = Math.ceil(filtradas.length / ITEMS_POR_PAGINA) || 1;
    if (paginaActualNotif > totalPaginas) paginaActualNotif = totalPaginas;

    const inicio = (paginaActualNotif - 1) * ITEMS_POR_PAGINA;
    const paginaItems = filtradas.slice(inicio, inicio + ITEMS_POR_PAGINA);

    contenedor.innerHTML = paginaItems.map(n => {
        const id = n.idNotificacion || n.id;
        const leida = esLeida(n);
        const p = parsearNotificacion(n);
        const cfg = TIPO_CONFIG[p.tipo] || TIPO_CONFIG.informativa;
        const tiempo = tiempoRelativo(n.fechaCreacionNotificacion || n.fecha);

        const svgIcono = (p.tipo === 'urgente' || p.tipo === 'alerta')
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
            : (p.tipo === 'resuelta'
                ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
                : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
            );

        return `
            <div class="notif-tarjeta ${escapeHtml(cfg.cardClass)} ${leida ? '' : 'no-leida'}" data-id="${escapeHtml(id)}" style="display: flex; gap: 16px; padding: 16px; border-radius: 12px; margin-bottom: 10px; background: #13192b; border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.2s;">
                <div class="notif-icono-envoltura ${escapeHtml(cfg.iconWrap)}" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: none !important;">
                    ${svgIcono}
                </div>
                <div class="notif-cuerpo" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="color: #ffffff; font-size: 15px;">${escapeHtml(p.Título)}</strong>
                            ${cfg.badgeLabel ? `<span class="etiqueta-tipo ${escapeHtml(cfg.badgeClass)}">${escapeHtml(cfg.badgeLabel)}</span>` : ''}
                            ${!leida ? `<span class="punto-sin-leer ${escapeHtml(cfg.dotSm)}" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>` : ''}
                        </div>
                        <span style="font-size: 12px; color: #94a3b8;">${escapeHtml(tiempo)}</span>
                    </div>
                    <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #cbd5e1; line-height: 1.45;">${escapeHtml(p.mensaje)}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; flex-wrap: wrap; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${p.esIndividual ? `
                                <span style="display: inline-flex; align-items: center; gap: 5px; background: #2563eb; color:#ffffff; border:none; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Dirigida a: ${escapeHtml(p.destinatario)}
                                </span>
                            ` : `
                                <span style="display: inline-flex; align-items: center; gap: 5px; background: #059669; color:#ffffff; border:none; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    Difusión general (Todos)
                                </span>
                            `}
                        </div>
                        <div class="notif-acciones-fila">
                            <button type="button" class="btn-ver-notificacion btn-accion-notif" data-id="${escapeHtml(id)}" title="Ver notificación completa">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            ${!leida ? `
                            <button type="button" class="btn-marcar-individual btn-accion-notif btn-accion-check" data-id="${escapeHtml(id)}" title="Marcar como leída">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            ` : ''}
                            ${esAdminNotif ? `
                            <button type="button" class="btn-eliminar-notificacion btn-accion-notif btn-accion-trash" data-id="${escapeHtml(id)}" title="Eliminar notificación">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.renderizarPaginacion) {
        window.renderizarPaginacion('paginacion-notificaciones', filtradas.length, ITEMS_POR_PAGINA, paginaActualNotif, function (nuevaPag) {
            paginaActualNotif = nuevaPag;
            renderizarNotificaciones();
        });
    }

    // Ver / Leer en modal
    contenedor.querySelectorAll('.btn-ver-notificacion').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const notif = notificacionesCache.find(n => String(n.idNotificacion || n.id) === String(id));
            if (notif) abrirModalDetalleNotificacion(notif);
        });
    });

    // eliminar
    contenedor.querySelectorAll('.btn-eliminar-notificacion').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const ok = window.swalEliminar ? await window.swalEliminar('¿Eliminar notificación?', 'Se borrará para todos los destinatarios.') : true;
            if (!ok) return;
            try {
                await deleteNotificacion(id);
                notificacionesCache = notificacionesCache.filter(n => String(n.idNotificacion || n.id) !== String(id));
                actualizarBadges(notificacionesCache);
                renderizarNotificaciones();
                if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Notificación eliminada.', 'success');
            } catch (err) {
                if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('No se pudo eliminar: ' + err.message, 'error');
            }
        });
    });

    contenedor.querySelectorAll('.btn-marcar-individual').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const notif = notificacionesCache.find(n => (n.idNotificacion || n.id) == id);
            if (notif) {
                notif.leidaNotificacion = 's';
                actualizarBadges(notificacionesCache);
                renderizarNotificaciones();
                try {
                    await actualizarNotificacion(id, { ...notif, leidaNotificacion: 's' });
                } catch (_) {}
            }
        });
    });
}


// ── Modal Detalle de Notificación (Leer completa) ───────────────────
async function abrirModalDetalleNotificacion(notif) {
    const p = parsearNotificacion(notif);
    const cfg = TIPO_CONFIG[p.tipo] || TIPO_CONFIG.informativa;
    const modal = document.getElementById('panel-detalle-notif');
    if (!modal) return;

    const elTitulo = document.getElementById('detalle-notif-titulo');
    const elTipoBadge = document.getElementById('detalle-notif-tipo-badge');
    const elIcono = document.getElementById('detalle-notif-icono');
    const elSvg = document.getElementById('detalle-notif-svg');
    const elMensaje = document.getElementById('detalle-notif-mensaje');
    const elDestinatario = document.getElementById('detalle-notif-destinatario');
    const elFecha = document.getElementById('detalle-notif-fecha');
    const elEstadoBadge = document.getElementById('detalle-notif-estado-badge');

    const esAlerta = (p.tipo === 'urgente' || p.tipo === 'alerta');
    const colorSolido = esAlerta ? '#dc2626' : (p.tipo === 'resuelta' ? '#059669' : '#2563eb');

    if (elTitulo) elTitulo.textContent = p.Título || 'Notificación';

    if (elIcono) {
        elIcono.style.background = colorSolido;
        elIcono.style.border = 'none';
        elIcono.style.boxShadow = `0 4px 14px ${colorSolido}55`;
    }

    if (elSvg) {
        elSvg.innerHTML = esAlerta
            ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
            : (p.tipo === 'resuelta'
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                : '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
            );
    }

    if (elTipoBadge) {
        elTipoBadge.textContent = cfg.badgeLabel || (esAlerta ? 'ALERTA' : 'INFORMATIVA');
        elTipoBadge.style.background = colorSolido;
        elTipoBadge.style.color = '#ffffff';
        elTipoBadge.style.border = 'none';
    }

    if (elMensaje) elMensaje.textContent = p.mensaje || '';
    if (elDestinatario) elDestinatario.textContent = p.destinatario || 'Difusión general';
    
    const fechaRaw = notif.fechaCreacionNotificacion || notif.fecha;
    if (elFecha) {
        if (fechaRaw) {
            try {
                const d = new Date(fechaRaw);
                elFecha.textContent = !isNaN(d.getTime()) ? d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : String(fechaRaw).slice(0, 16);
            } catch (_) {
                elFecha.textContent = String(fechaRaw);
            }
        } else {
            elFecha.textContent = 'Fecha no disponible';
        }
    }

    const leida = esLeida(notif);
    if (elEstadoBadge) {
        elEstadoBadge.textContent = leida ? 'Leída' : 'Sin leer';
        elEstadoBadge.style.background = leida ? '#059669' : '#dc2626';
        elEstadoBadge.style.color = '#ffffff';
        elEstadoBadge.style.border = 'none';
    }

    modal.classList.add('activo');

    // Al abrirla para leerla, marcarla automáticamente como leída si no lo estaba
    if (!leida) {
        notif.leidaNotificacion = 's';
        actualizarBadges(notificacionesCache);
        renderizarNotificaciones();
        try {
            const id = notif.idNotificacion || notif.id;
            await actualizarNotificacion(id, { ...notif, leidaNotificacion: 's' });
        } catch (_) {}
    }
}

// ── Cargar Notificaciones ──────────────────────────────────────────
async function cargarNotificaciones() {
    try {
        const datos = await getNotificaciones();
        notificacionesCache = Array.isArray(datos) ? datos : [];
    } catch (_) {
        notificacionesCache = [];
    }
    actualizarBadges(notificacionesCache);
    renderizarNotificaciones();
}

async function cargarEmpleadosSelect() {
    try {
        const emps = await getEmpleados();
        empleadosCache = Array.isArray(emps) ? emps : [];
    } catch (_) {
        empleadosCache = [];
    }
    poblarSelectDestinatarios();
}

let destinatariosSeleccionados = new Set(['todos']);

function actualizarTextoDestinatarios() {
    const inputOculto = document.getElementById('redactar-destino');
    const textoActivador = document.getElementById('texto-destino');
    if (!textoActivador || !inputOculto) return;

    if (destinatariosSeleccionados.has('todos')) {
        textoActivador.textContent = 'Todos los usuarios (Difusión general)';
        inputOculto.value = 'todos';
        return;
    }

    const ids = Array.from(destinatariosSeleccionados);
    if (ids.length === 0) {
        textoActivador.textContent = 'Seleccionar destinatario(s)...';
        inputOculto.value = '';
    } else if (ids.length === 1) {
        const emp = empleadosCache.find(e => String(e.idEmpleado || e.id) === String(ids[0]));
        const nom = emp ? `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() : `Empleado #${ids[0]}`;
        textoActivador.textContent = nom;
        inputOculto.value = JSON.stringify(ids);
    } else {
        textoActivador.textContent = `${ids.length} destinatarios seleccionados`;
        inputOculto.value = JSON.stringify(ids);
    }
}

function poblarSelectDestinatarios() {
    const contenedor = document.getElementById('lista-opciones-destino');
    if (!contenedor) return;

    const Sesión = (window.CredentialsStore && window.CredentialsStore.getSession) ? window.CredentialsStore.getSession() : null;
    const rolSesion = String(Sesión?.role || Sesión?.rol || '').toLowerCase();
    const esAdmin = rolSesion.includes('admin');
    const idPropio = Sesión?.id;

    const empleadosVisibles = empleadosCache.filter(emp => String(emp.idEmpleado || emp.id) !== String(idPropio));

    if (!esAdmin) {
        destinatariosSeleccionados = new Set();
        if (empleadosVisibles.length > 0) {
            destinatariosSeleccionados.add(String(empleadosVisibles[0].idEmpleado || empleadosVisibles[0].id));
        }
    } else if (destinatariosSeleccionados.size === 0) {
        destinatariosSeleccionados = new Set(['todos']);
    }

    let html = '';

    if (esAdmin) {
        const checkTodos = destinatariosSeleccionados.has('todos') ? 'checked' : '';
        html += `
            <div class="selector-opcion-item item-destinatario-opcion ${checkTodos ? 'seleccionado' : ''}" data-valor="todos" style="display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.06);">
                <input type="checkbox" class="chk-destinatario-multi" data-valor="todos" ${checkTodos} style="width:16px; height:16px; accent-color:#2473F5; cursor:pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icono-opcion"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <div class="texto-opcion" style="flex:1;">
                    <strong>Todos los Empleados</strong>
                    <span style="font-size:11px; color:#94a3b8;">Difusión general a todo el personal</span>
                </div>
            </div>
        `;
    }

    empleadosVisibles.forEach((emp) => {
        const id = String(emp.idEmpleado || emp.id);
        const nombre = `${emp.nombreEmpleado || ''} ${emp.apellidoEmpleado || ''}`.trim() || emp.correoEmpleado || 'Empleado';
        const rol = (emp.rol && emp.rol.nombreRol) ? emp.rol.nombreRol : (emp.rol || 'Personal');
        const estaMarcado = destinatariosSeleccionados.has(id);
        html += `
            <div class="selector-opcion-item item-destinatario-opcion ${estaMarcado ? 'seleccionado' : ''}" data-valor="${escapeHtml(id)}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer;">
                <input type="checkbox" class="chk-destinatario-multi" data-valor="${escapeHtml(id)}" ${estaMarcado ? 'checked' : ''} style="width:16px; height:16px; accent-color:#2473F5; cursor:pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icono-opcion"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <div class="texto-opcion" style="flex:1;">
                    <strong>${escapeHtml(nombre)}</strong>
                    <span style="font-size:11px; color:#94a3b8;">${escapeHtml(rol)}</span>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = html;
    actualizarTextoDestinatarios();

    contenedor.querySelectorAll('.item-destinatario-opcion').forEach(item => {
        item.addEventListener('click', function (e) {
            const chk = this.querySelector('.chk-destinatario-multi');
            const val = this.dataset.valor;
            if (e.target !== chk) {
                chk.checked = !chk.checked;
            }

            if (val === 'todos') {
                if (chk.checked) {
                    destinatariosSeleccionados.clear();
                    destinatariosSeleccionados.add('todos');
                    contenedor.querySelectorAll('.chk-destinatario-multi').forEach(c => {
                        if (c !== chk) c.checked = false;
                    });
                    contenedor.querySelectorAll('.item-destinatario-opcion').forEach(it => {
                        if (it !== item) it.classList.remove('seleccionado');
                    });
                    item.classList.add('seleccionado');
                } else {
                    destinatariosSeleccionados.delete('todos');
                    item.classList.remove('seleccionado');
                }
            } else {
                const chkTodos = contenedor.querySelector('.chk-destinatario-multi[data-valor="todos"]');
                if (chkTodos) chkTodos.checked = false;
                destinatariosSeleccionados.delete('todos');
                const itemTodos = contenedor.querySelector('.item-destinatario-opcion[data-valor="todos"]');
                if (itemTodos) itemTodos.classList.remove('seleccionado');

                if (chk.checked) {
                    destinatariosSeleccionados.add(val);
                    item.classList.add('seleccionado');
                } else {
                    destinatariosSeleccionados.delete(val);
                    item.classList.remove('seleccionado');
                }
            }
            actualizarTextoDestinatarios();
        });
    });

    const inputBuscarDestinatario = document.getElementById('input-buscar-destinatario');
    if (inputBuscarDestinatario) {
        inputBuscarDestinatario.addEventListener('input', function () {
            const termino = this.value.trim().toLowerCase();
            contenedor.querySelectorAll('.selector-opcion-item').forEach(item => {
                const texto = item.textContent.toLowerCase();
                item.style.display = (!termino || texto.includes(termino)) ? 'flex' : 'none';
            });
        });
    }
}



// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    await Promise.all([
        cargarEmpleadosSelect(),
        cargarNotificaciones()
    ]);

    const gatilloDestino = document.getElementById('gatillo-destino');
    const desplegableDestino = document.getElementById('desplegable-destino');
    if (gatilloDestino && desplegableDestino) {
        gatilloDestino.addEventListener('click', function (e) {
            e.stopPropagation();
            desplegableDestino.classList.toggle('abierto');
        });
        document.addEventListener('click', function (e) {
            if (!desplegableDestino.contains(e.target)) {
                desplegableDestino.classList.remove('abierto');
            }
        });
    }

    const notifLista = document.getElementById('notif-lista');
    const btnMarcarTodo = document.getElementById('btn-marcar-todo');

    document.querySelectorAll('.notif-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('activo'));
            this.classList.add('activo');
            tabActual = this.dataset.tab;
            paginaActualNotif = 1;
            renderizarNotificaciones();
        });
    });

    const inputBusqueda = document.getElementById('notif-busqueda');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            paginaActualNotif = 1;
            renderizarNotificaciones();
        });
    }

    if (btnMarcarTodo) {
        btnMarcarTodo.addEventListener('click', async function () {
            const promesas = notificacionesCache.map(n => {
                const id = n.idNotificacion || n.id;
                n.leidaNotificacion = 's';
                return actualizarNotificacion(id, { ...n, leidaNotificacion: 's' }).catch(() => null);
            });
            actualizarBadges(notificacionesCache);
            renderizarNotificaciones();
            await Promise.all(promesas);
        });
    }

    const btnAbrirRedactar = document.getElementById('btn-abrir-redactar-notif');
    const panelRedactar = document.getElementById('panel-redactar-notif');
    const formRedactar = document.getElementById('form-redactar-notif');

    if (btnAbrirRedactar && panelRedactar) {
        btnAbrirRedactar.addEventListener('click', function () {
            poblarSelectDestinatarios();
            if (formRedactar) formRedactar.reset();
            panelRedactar.classList.add('activo');
        });
    }

    const btnCerrarRedactar = document.getElementById('btn-cerrar-redactar-notif');
    if (btnCerrarRedactar) {
        btnCerrarRedactar.addEventListener('click', () => panelRedactar.classList.remove('activo'));
    }

    const btnCancelarRedactar = document.getElementById('btn-cancelar-redactar-notif');
    if (btnCancelarRedactar) {
        btnCancelarRedactar.addEventListener('click', () => panelRedactar.classList.remove('activo'));
    }

    if (panelRedactar) {
        panelRedactar.addEventListener('click', function (e) {
            if (e.target === panelRedactar) panelRedactar.classList.remove('activo');
        });
    }

    // Handlers para cerrar el modal de Detalle de Notificación
    const panelDetalle = document.getElementById('panel-detalle-notif');
    const btnCerrarDetalle = document.getElementById('btn-cerrar-detalle-notif');
    const btnEntendidoDetalle = document.getElementById('btn-entendido-detalle-notif');
    if (btnCerrarDetalle && panelDetalle) {
        btnCerrarDetalle.addEventListener('click', () => panelDetalle.classList.remove('activo'));
    }
    if (btnEntendidoDetalle && panelDetalle) {
        btnEntendidoDetalle.addEventListener('click', () => panelDetalle.classList.remove('activo'));
    }
    if (panelDetalle) {
        panelDetalle.addEventListener('click', function (e) {
            if (e.target === panelDetalle) panelDetalle.classList.remove('activo');
        });
    }

    if (formRedactar) {
        formRedactar.addEventListener('submit', async function (e) {
            e.preventDefault();
            const destino = document.getElementById('redactar-destino')?.value || '';
            const tipo = document.getElementById('redactar-tipo')?.value || 'informativa';
            const Título = (document.getElementById('redactar-titulo') || document.getElementById('redactar-Título'))?.value.trim() || 'Aviso';
            const mensaje = document.getElementById('redactar-mensaje')?.value.trim();

            if (!mensaje) {
                if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('El mensaje no puede estar vacío', 'warning');
                return;
            }

            // Resolver lista de destinatarios (uno, varios o todos)
            let listaDestinos = [];
            if (destino === 'todos' || destinatariosSeleccionados.has('todos')) {
                listaDestinos = empleadosCache.map(emp => emp.idEmpleado || emp.id).filter(Boolean);
            } else if (destino.startsWith('[')) {
                try {
                    listaDestinos = JSON.parse(destino);
                } catch (_) {
                    listaDestinos = Array.from(destinatariosSeleccionados);
                }
            } else if (destino) {
                listaDestinos = [destino];
            } else {
                listaDestinos = Array.from(destinatariosSeleccionados);
            }

            if (listaDestinos.length === 0) {
                if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Selecciona al menos un destinatario', 'warning');
                return;
            }

            const sesionActual = (window.CredentialsStore && window.CredentialsStore.getSession) ? window.CredentialsStore.getSession() : null;
            const esAdminActual = String(sesionActual?.role || sesionActual?.rol || '').toLowerCase().includes('admin');
            if ((destino === 'todos' || destinatariosSeleccionados.has('todos')) && !esAdminActual) {
                if (window.mostrarAlertaNotificacion) window.mostrarAlertaNotificacion('Solo un Administrador puede enviar a todos los empleados', 'warning');
                return;
            }

            const mensajeCompleto = `[${tipo.toUpperCase()}] ${Título}: ${mensaje}`;

            try {
                const hoyIso = fechaHoraLocalISO();

                for (const idEmp of listaDestinos) {
                    await createNotificacion({
                        fkEmpleado: idEmp,
                        mensajeNotificacion: mensajeCompleto,
                        fechaCreacionNotificacion: hoyIso,
                        leidaNotificacion: 'n'
                    });
                }

                if (panelRedactar) panelRedactar.classList.remove('activo');
                if (window.mostrarAlertaNotificacion) {
                    const cant = listaDestinos.length;
                    const msgExito = cant > 1 
                        ? `Notificación enviada exitosamente a ${cant} destinatarios.` 
                        : 'Notificación enviada exitosamente.';
                    window.mostrarAlertaNotificacion(msgExito, 'success', '¡Aviso Enviado!');
                }
                await cargarNotificaciones();
            } catch (err) {
                if (window.mostrarAlertaNotificacion) {
                    window.mostrarAlertaNotificacion('Error al enviar notificación: ' + err.message, 'error');
                }
            }
        });
    }
});
