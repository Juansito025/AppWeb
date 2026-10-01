/** servicio de turnos */

// horas en minutos
function minutosAHora(mins) {
    if (typeof mins === 'string' && mins.includes(':')) return mins;
    const total = Number(mins);
    if (Number.isNaN(total)) return '08:00';
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizarTurno(t) {
    if (!t) return null;
    const hInicio = minutosAHora(t.horaInicioTurno ?? t.horaInicio ?? '08:00');
    const hSalida = minutosAHora(t.horaSalidaTurno ?? t.horaSalida ?? '17:00');
    const dInicio = t.diaInicio || 'Lunes';
    const dSalida = t.diaSalida || t.diaTerminar || 'Viernes';

    return {
        idTurno: t.idTurno || t.id,
        id: t.idTurno || t.id,
        nombreTurno: t.nombreTurno || t.nombre || 'Turno',
        nombre: t.nombreTurno || t.nombre || 'Turno',
        horaInicioTurno: hInicio,
        horaInicio: hInicio,
        horaSalidaTurno: hSalida,
        horaSalida: hSalida,
        diaInicio: String(dInicio),
        diaSalida: String(dSalida),
        diaTerminar: String(dSalida)
    };
}

function normalizarDetalle(d) {
    if (!d) return null;
    // lugar del turno
    const idLugar = d.fkLugar ?? d.fkLugarTrabajo ?? d.fkCaseta ?? null;
    return {
        idDetalleTurno: d.idDetalleTurno || d.id,
        id: d.idDetalleTurno || d.id,
        fkEmpleado: d.fkEmpleado,
        fkTurno: d.fkTurno,
        fkLugar: idLugar,
        fkLugarTrabajo: idLugar,
        fkLugarCaseta: idLugar,
        fkCaseta: idLugar,
        estadoturno: d.estadoturno || d.estadoTurno || 's'
    };
}

export async function getTurnos() {
    try {
        const data = await apiFetch('/turnos');
        const lista = Array.isArray(data) ? data : (data?.data || []);
        return lista.map(normalizarTurno);
    } catch (error) {
        console.warn("Aviso en getTurnos:", error.message);
        return [];
    }
}

export async function getTurno(id) {
    try {
        const data = await apiFetch(`/turnos/${id}`);
        return normalizarTurno(data?.data || data);
    } catch (e) {
        return null;
    }
}

function horaMinutos(hStr) {
    if (typeof hStr === 'number') return hStr;
    if (!hStr || typeof hStr !== 'string') return 480;
    const parts = hStr.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60 + m) % 1440;
}

export async function createTurno(turno) {
    const hIni = String(turno.horaInicioTurno || turno.horaInicio || '08:00');
    const hFin = String(turno.horaSalidaTurno || turno.horaSalida || '17:00');
    const dFin = String(turno.diaSalida || turno.diaTerminar || '');

    // horas del turno
    const payload = {
        idTurno: turno.idTurno || turno.id,
        nombreTurno: String(turno.nombreTurno || turno.nombre || '').trim(),
        horaInicioTurno: horaMinutos(hIni),
        horaSalidaTurno: horaMinutos(hFin),
        diaInicio: String(turno.diaInicio || ''),
        diaSalida: dFin
    };
    return await apiFetch('/turnos', {
        method: "POST",
        body: payload
    });
}

export async function actualizarTurno(id, turno) {
    const hIni = String(turno.horaInicioTurno || turno.horaInicio || '08:00');
    const hFin = String(turno.horaSalidaTurno || turno.horaSalida || '17:00');
    const dFin = String(turno.diaSalida || turno.diaTerminar || '');

    const payload = {
        idTurno: Number(id),
        nombreTurno: String(turno.nombreTurno || turno.nombre || '').trim(),
        horaInicioTurno: horaMinutos(hIni),
        horaSalidaTurno: horaMinutos(hFin),
        diaInicio: String(turno.diaInicio || ''),
        diaSalida: dFin
    };
    return await apiFetch(`/turnos/${id}`, {
        method: "PUT",
        body: payload
    });
}

export async function deleteTurno(id) {
    await apiFetch(`/turnos/${id}`, {
        method: "DELETE"
    });
    return true;
}

export async function getDetalleTurnos() {
    const res = await apiFetch('/detalleTurnos');
    const lista = Array.isArray(res) ? res : (res?.data || []);
    return lista.map(normalizarDetalle);
}

// detalles del turno
export async function getDetalleTurnosPorTurno(idTurno) {
    const todos = await getDetalleTurnos();
    return todos.filter(d => String(d.fkTurno) === String(idTurno));
}

export async function createDetalleTurno(detalle) {
    const idLugar = detalle.fkLugar ? Number(detalle.fkLugar) : (detalle.fkLugarCaseta ? Number(detalle.fkLugarCaseta) : (detalle.fkLugarTrabajo ? Number(detalle.fkLugarTrabajo) : (detalle.fkCaseta ? Number(detalle.fkCaseta) : null)));
    const estado = (detalle.estadoturno || detalle.estadoTurno || 's').toLowerCase().slice(0, 1);

    // DetalleTurnoDTO.fkLugar es el nombre real del campo en el backend.
    const payload = {
        fkEmpleado: detalle.fkEmpleado,
        fkTurno: Number(detalle.fkTurno),
        fkLugar: idLugar,
        estadoturno: estado
    };

    return await apiFetch('/detalleTurnos', {
        method: "POST",
        body: payload
    });
}

export async function deleteDetalleTurno(id) {
    await apiFetch(`/detalleTurnos/${id}`, { method: "DELETE" });
    return true;
}

export async function actualizarDetalleTurno(id, detalle) {
    const idLugar = detalle.fkLugar ? Number(detalle.fkLugar) : (detalle.fkLugarCaseta ? Number(detalle.fkLugarCaseta) : (detalle.fkLugarTrabajo ? Number(detalle.fkLugarTrabajo) : (detalle.fkCaseta ? Number(detalle.fkCaseta) : null)));
    const estado = (detalle.estadoturno || detalle.estadoTurno || 's').toLowerCase().slice(0, 1);

    const payload = {
        idDetalleTurno: Number(id),
        fkEmpleado: detalle.fkEmpleado,
        fkTurno: Number(detalle.fkTurno),
        fkLugar: idLugar,
        estadoturno: estado
    };

    return await apiFetch(`/detalleTurnos/${id}`, {
        method: "PUT",
        body: payload
    });
}
