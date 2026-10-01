/** servicio de propiedades */

function normalizarPropiedad(p) {
    if (!p) return null;
    const Código = p.codigo || p.Código || p.codigoPropiedad || '';
    const calle  = p.calle || p.direccionPropiedad || p.nombrePropiedad || '';
    const desc   = (Código && calle) ? `${Código} (${calle})` : (Código || calle || `Propiedad #${p.idPropiedad || p.id || ''}`);
    return {
        ...p,
        idPropiedad: p.idPropiedad || p.id,
        id: p.idPropiedad || p.id,
        codigo: Código,
        Código: Código,
        codigoPropiedad: Código,
        calle: calle,
        direccionPropiedad: calle,
        nombrePropiedad: desc,
        nombre: desc,
        niveles: p.niveles ?? 1,
        estado: p.estado || 'Habitada',
        fkSeccion: p.fkSeccion,
        fkTipoPropiedad: p.fkTipoPropiedad,
        fkPropietario: p.fkPropietario
    };
}

/** propiedades por pagina */
export async function getPropiedadesPaginado(pagina = 1, tamano = 10) {
    const res = await apiFetch(`/propiedades/paginado?page=${Math.max(0, pagina - 1)}&size=${tamano}`);
    // datos de la pagina
    const meta = (res && typeof res.page === 'object') ? res.page : (res || {});
    const contenido = Array.isArray(res?.content) ? res.content : [];
    return {
        contenido: await Promise.all(contenido.map(item => normalizarPropiedad(item))),
        totalPaginas: Number(meta.totalPages ?? 0),
        totalElementos: Number(meta.totalElements ?? contenido.length)
    };
}

export async function getPropiedades() {
    try {
        const res = await apiFetch('/propiedades');
        const lista = Array.isArray(res) ? res : (res?.data || []);
        return lista.map(normalizarPropiedad);
    } catch (error) {
        console.warn("Aviso en getPropiedades (tabla vacía o sin datos):", error.message);
        return [];
    }
}

export async function getPropiedad(id) {
    const data = await apiFetch(`/propiedades/${id}`);
    return normalizarPropiedad(data?.data || data);
}

function normalizarEstadoPropiedad(estado) {
    if (!estado) return 'Habitada';
    const s = String(estado).trim();
    // La base de datos solo acepta "Desocupada" con mayúscula
    if (s.toLowerCase() === 'desocupada') return 'Desocupada';
    return s;
}

export async function createPropiedad(propiedad) {
    const ownerId = propiedad.fkPropietario || propiedad.fkPersona || null;
    const cod = String(propiedad.codigo || propiedad.Código || propiedad.codigoPropiedad || '').trim().slice(0, 10);
    const payload = {
        codigo: cod,
        calle: String(propiedad.calle || propiedad.direccionPropiedad || '').trim(),
        niveles: propiedad.niveles ? Number(propiedad.niveles) : null,
        estado: normalizarEstadoPropiedad(propiedad.estado),
        fkSeccion: propiedad.fkSeccion ? Number(propiedad.fkSeccion) : null,
        fkTipoPropiedad: propiedad.fkTipoPropiedad ? Number(propiedad.fkTipoPropiedad) : null,
        fkPropietario: ownerId
    };

    return await apiFetch('/propiedades', {
        method: "POST",
        body: payload
    });
}

export async function actualizarPropiedad(id, propiedad) {
    const ownerId = propiedad.fkPropietario || propiedad.fkPersona || null;
    const cod = String(propiedad.codigo || propiedad.Código || propiedad.codigoPropiedad || '').trim().slice(0, 10);
    const payload = {
        idPropiedad: Number(id),
        codigo: cod,
        calle: String(propiedad.calle || propiedad.direccionPropiedad || '').trim(),
        niveles: propiedad.niveles ? Number(propiedad.niveles) : null,
        estado: normalizarEstadoPropiedad(propiedad.estado),
        fkSeccion: propiedad.fkSeccion ? Number(propiedad.fkSeccion) : null,
        fkTipoPropiedad: propiedad.fkTipoPropiedad ? Number(propiedad.fkTipoPropiedad) : null,
        fkPropietario: ownerId
    };

    return await apiFetch(`/propiedades/${id}`, {
        method: "PUT",
        body: payload
    });
}

export async function deletePropiedad(id) {
    await apiFetch(`/propiedades/${id}`, { method: "DELETE" });
    return true;
}
