/** servicio de vehiculos */

export async function getVehiculos() {
    try {
        const res = await apiFetch('/vehiculos');
        return Array.isArray(res) ? res : (res?.data || []);
    } catch (error) {
        console.warn("Aviso en getVehiculos:", error.message);
        return [];
    }
}

export async function getVehiculo(id) {
    return await apiFetch(`/vehiculos/${id}`);
}

function prepararPayloadVehiculo(v) {
    const mat = (v.matriculaVehiculo || v.matricula || v.placa || '').replace(/\s+/g, '').toUpperCase();
    return {
        idVehiculo: v.idVehiculo || v.id,
        tipoVehiculo: v.tipoVehiculo || v.tipo || 'Automóvil',
        marcaVehiculo: v.marcaVehiculo || v.marca || 'Sedán',
        modeloVehiculo: v.modeloVehiculo || v.modelo || 'Estándar',
        matriculaVehiculo: mat
    };
}

export async function createVehiculo(vehiculo) {
    const payload = prepararPayloadVehiculo(vehiculo);
    return await apiFetch('/vehiculos', {
        method: "POST",
        body: payload
    });
}

export async function actualizarVehiculo(id, vehiculo) {
    const payload = prepararPayloadVehiculo(vehiculo);
    return await apiFetch(`/vehiculos/${id}`, {
        method: "PUT",
        body: payload
    });
}

export async function deleteVehiculo(id) {
    await apiFetch(`/vehiculos/${id}`, { method: "DELETE" });
    return true;
}

/** buscar por matricula */
export async function buscarVehiculoPorMatricula(matricula) {
    try {
        const res = await apiFetch(`/vehiculos/matricula/${encodeURIComponent(matricula)}`);
        if (!res || Array.isArray(res)) return null;
        return res;
    } catch (error) {
        return null;
    }
}
