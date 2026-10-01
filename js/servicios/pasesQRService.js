/** servicio de pases qr */

function fechaHoraLocal(date) {
    const value = date || new Date();
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 19);
}

export async function getPasesQR() {
    const res = await apiFetch('/paseAccesoQR');
    return Array.isArray(res) ? res : (res?.data || []);
}

export async function getPaseQR(id) {
    return await apiFetch(`/paseAccesoQR/${id}`);
}

function formatearFecha(dateStr) {
    if (!dateStr) return fechaLocalISO();
    if (typeof dateStr === 'string' && dateStr.includes('T')) return dateStr.split('T')[0];
    return String(dateStr).slice(0, 10);
}

export async function createPaseQR(pase) {
    const tipo = pase.tipoPase === 'Propietario' ? 'Propietario' : 'Visita';
    const fIni = formatearFecha(pase.fechaInicioPase);
    let fFin = formatearFecha(pase.duracionPase);

    // Oracle constraint: CHK_DURACION_PASE_VALIDA (PAQ_fecha_fin > PAQ_fecha_inicio)
    if (!fFin || fFin <= fIni) {
        const d = new Date(fIni + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        fFin = fechaLocalISO(d);
    }

    const payload = {
        idPaseAcceso: pase.idPaseAcceso || pase.id || null,
        tipoPase: tipo,
        fechaInicioPase: fIni,
        duracionPase: fFin,
        paseActivo: (pase.paseActivo || 's').toLowerCase().slice(0, 1),
        fkPersonas: tipo === 'Propietario' ? (pase.fkPersonas || pase.fkPersona || null) : null,
        fkVisitas: tipo === 'Visita' ? Number(pase.fkVisitas || pase.fkVisita) : null
    };

    return await apiFetch('/paseAccesoQR', {
        method: "POST",
        body: payload
    });
}

export async function actualizarPaseQR(id, pase) {
    const tipo = pase.tipoPase === 'Propietario' ? 'Propietario' : 'Visita';
    const fIni = formatearFecha(pase.fechaInicioPase);
    let fFin = formatearFecha(pase.duracionPase);

    // Oracle constraint: CHK_DURACION_PASE_VALIDA (PAQ_fecha_fin > PAQ_fecha_inicio)
    if (!fFin || fFin <= fIni) {
        const d = new Date(fIni + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        fFin = fechaLocalISO(d);
    }

    const payload = {
        idPaseAcceso: id,
        tipoPase: tipo,
        fechaInicioPase: fIni,
        duracionPase: fFin,
        paseActivo: (pase.paseActivo || 's').toLowerCase().slice(0, 1),
        fkPersonas: tipo === 'Propietario' ? (pase.fkPersonas || pase.fkPersona || null) : null,
        fkVisitas: tipo === 'Visita' ? Number(pase.fkVisitas || pase.fkVisita) : null
    };

    return await apiFetch(`/paseAccesoQR/${id}`, {
        method: "PUT",
        body: payload
    });
}

export async function validarPaseQR(id) {
    // validar pase
    const res = await apiFetch(`/paseAccesoQR/${id}`);
    const pase = res?.data || res;
    if (!pase || Array.isArray(pase)) {
        throw new Error('El pase no existe');
    }
    const activo = String(pase.paseActivo || '').toLowerCase() === 's';
    if (!activo) {
        throw new Error('El pase está inactivo');
    }
    if (pase.duracionPase) {
        const hoy = fechaLocalISO();
        const fin = formatearFecha(pase.duracionPase);
        if (fin < hoy) {
            throw new Error('El pase ha expirado');
        }
    }
    return pase;
}

export async function desactivarPaseQR(pase) {
    return await actualizarPaseQR(pase.idPaseAcceso || pase.id, {
        ...pase,
        paseActivo: 'n'
    });
}

export async function deletePaseQR(id) {
    await apiFetch(`/paseAccesoQR/${id}`, { method: "DELETE" });
    return true;
}

export async function registrarAcceso(acceso) {
    const ahora = new Date();
    const fechaHoraActual = fechaHoraLocal(ahora);

    const payload = {
        fkDetalleTurno: acceso.fkDetalleTurno ? Number(acceso.fkDetalleTurno) : null,
        metodoAcceso: acceso.metodoAcceso || 'QR',
        horaEntrada: acceso.horaEntrada || fechaHoraActual,
        detalleQr: acceso.metodoAcceso === 'Manual' ? null : {
            fkPasesAcceso: acceso.fkPasesAcceso || acceso.fkPaseQR
        },
        detalleManual: acceso.metodoAcceso === 'Manual' ? {
            fkVisitas: Number(acceso.fkVisitas || acceso.fkVisita)
        } : null
    };

    if (!payload.fkDetalleTurno || (!payload.detalleQr?.fkPasesAcceso && !payload.detalleManual?.fkVisitas)) {
        throw new Error('No hay datos suficientes para registrar el acceso');
    }

    return await apiFetch('/accesos', {
        method: "POST",
        body: payload
    });
}
