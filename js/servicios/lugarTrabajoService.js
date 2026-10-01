/** servicio de casetas */

function normalizarLugar(item) {
    if (!item) return null;
    return {
        idLugarTrabajo: item.idLugarTrabajo || item.idCasetas || item.id,
        idCasetas: item.idCasetas || item.idLugarTrabajo || item.id,
        nombreLugar: item.nombreLugar || item.nombreCaseta || item.nombre || 'Caseta',
        nombreCaseta: item.nombreCaseta || item.nombreLugar || item.nombre || 'Caseta',
        tipoLugar: item.tipoLugar || 'Caseta',
        capacidadLugar: item.capacidadLugar ?? item.capacidadCaseta ?? item.capacidad ?? 3,
        capacidadCaseta: item.capacidadCaseta ?? item.capacidadLugar ?? item.capacidad ?? 3,
        direccionLugar: item.direccionLugar || item.direccionCaseta || item.Dirección || '',
        direccionCaseta: item.direccionCaseta || item.direccionLugar || item.Dirección || '',
        telefonoLugar: item.telefonoLugar || item.telefonoCaseta || item.Teléfono || '',
        telefonoCaseta: item.telefonoCaseta || item.telefonoLugar || item.Teléfono || ''
    };
}

function prepararPayload(lugar) {
    const nombre = String(lugar.nombreLugar || lugar.nombreCaseta || lugar.nombre || '').trim().slice(0, 50);
    const Dirección = String(lugar.direccionLugar || lugar.direccionCaseta || lugar.Dirección || '').trim().slice(0, 100);
    const Teléfono = String(lugar.telefonoLugar || lugar.telefonoCaseta || lugar.Teléfono || '').trim().slice(0, 20);
    let capacidad = Number(lugar.capacidadLugar ?? lugar.capacidadCaseta ?? lugar.capacidad ?? 3);
    if (!capacidad || capacidad < 1) capacidad = 1;
    let tipo = lugar.tipoLugar === 'Oficina' ? 'Oficina' : 'Caseta';

    const payload = {
        nombreLugar: nombre,
        tipoLugar: tipo,
        capacidadLugar: capacidad,
        direccionLugar: Dirección,
        telefonoLugar: Teléfono
    };

    const id = lugar.idLugarTrabajo || lugar.idCasetas || lugar.id;
    if (id) {
        payload.idLugarTrabajo = Number(id);
    }
    return payload;
}

export async function getLugaresTrabajo() {
    try {
        const res = await apiFetch('/lugarTrabajo');
        const lista = Array.isArray(res) ? res : (res?.data || []);
        return lista.map(normalizarLugar);
    } catch (error) {
        console.warn('Aviso en getLugaresTrabajo:', error.message);
        return [];
    }
}

export async function getLugarTrabajo(id) {
    try {
        const res = await apiFetch(`/lugarTrabajo/${id}`);
        return normalizarLugar(res);
    } catch (error) {
        console.warn(`Aviso en getLugarTrabajo(${id}):`, error.message);
        return null;
    }
}

export async function createLugarTrabajo(lugar) {
    const body = prepararPayload(lugar);
    return await apiFetch('/lugarTrabajo', {
        method: "POST",
        body: body
    });
}

export async function actualizarLugarTrabajo(id, lugar) {
    const body = prepararPayload(lugar);
    return await apiFetch(`/lugarTrabajo/${id}`, {
        method: "PUT",
        body: body
    });
}

export async function deleteLugarTrabajo(id) {
    await apiFetch(`/lugarTrabajo/${id}`, { method: "DELETE" });
    return true;
}
