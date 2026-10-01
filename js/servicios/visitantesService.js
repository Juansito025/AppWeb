/** servicio de visitantes */

export async function getVisitantes() {
    try {
        const res = await apiFetch('/visitantes');
        return Array.isArray(res) ? res : (res?.data || []);
    } catch (error) {
        console.warn("Aviso en getVisitantes:", error.message);
        return [];
    }
}

export async function getVisitante(id) {
    return await apiFetch(`/visitantes/${id}`);
}

export async function createVisitante(visitante) {
    const payload = {
        nombreVisitante: visitante.nombreVisitante || visitante.nombre || '',
        apellidoVisitante: visitante.apellidoVisitante || visitante.apellido || '',
        tipoVisitante: visitante.tipoVisitante || visitante.tipo || '',
        fotoVisitante: visitante.fotoVisitante || visitante.foto || null,
        duiVisitante: visitante.duiVisitante || visitante.dui || '',
        telefonoVisitante: visitante.telefonoVisitante || visitante.Teléfono || ''
    };
    return await apiFetch('/visitantes', {
        method: "POST",
        body: payload
    });
}

export async function actualizarVisitante(id, visitante) {
    return await apiFetch(`/visitantes/${id}`, {
        method: "PUT",
        body: visitante
    });
}

export async function deleteVisitante(id) {
    await apiFetch(`/visitantes/${id}`, { method: "DELETE" });
    return true;
}
