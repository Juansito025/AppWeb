/** servicio de notificaciones */

export async function getNotificaciones() {
    try {
        const res = await apiFetch('/notificaciones');
        return Array.isArray(res) ? res : (res?.data || []);
    } catch (error) {
        return [];
    }
}

export async function getNotificacion(id) {
    try {
        return await apiFetch(`/notificaciones/${id}`);
    } catch (error) {
        console.error("getNotificacion:", error);
        throw error;
    }
}

function prepararPayload(Notificación) {
    let Sesión = null;
    try {
        Sesión = (window.CredentialsStore ? window.CredentialsStore.getSession() : null);
    } catch (e) {}

    const empleadoId = Notificación.fkEmpleado || (Sesión && (Sesión.idEmpleado || Sesión.id));

    let leida = String(Notificación.leidaNotificacion || Notificación.leida || 'n').toLowerCase();
    if (leida !== 's' && leida !== 'n') {
        leida = (leida === 'true' || leida === '1' || leida === 'si') ? 's' : 'n';
    }

    let fecha = Notificación.fechaCreacionNotificacion || Notificación.fecha;
    if (!fecha) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    } else if (typeof fecha === 'string' && fecha.length > 19) {
        fecha = fecha.slice(0, 19);
    }

    const mensaje = String(Notificación.mensajeNotificacion || Notificación.mensaje || Notificación.cuerpoNotificacion || Notificación.tituloNotificacion || 'Aviso del sistema').slice(0, 500);

    const payload = {
        fkEmpleado: empleadoId,
        mensajeNotificacion: mensaje,
        fechaCreacionNotificacion: fecha,
        leidaNotificacion: leida
    };

    if (Notificación.idNotificacion || Notificación.id) {
        payload.idNotificacion = Number(Notificación.idNotificacion || Notificación.id);
    }

    return payload;
}

export async function createNotificacion(Notificación) {
    const payload = prepararPayload(Notificación);
    return await apiFetch('/notificaciones', {
        method: 'POST',
        body: payload
    });
}

export async function actualizarNotificacion(id, Notificación) {
    const payload = prepararPayload({ ...Notificación, idNotificacion: id });
    return await apiFetch(`/notificaciones/${id}`, {
        method: 'PUT',
        body: payload
    });
}

export async function deleteNotificacion(id) {
    await apiFetch(`/notificaciones/${id}`, {
        method: 'DELETE'
    });
    return true;
}
