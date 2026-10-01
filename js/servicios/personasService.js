/** servicio de personas */

function normalizarPersona(item) {
    if (!item) return null;
    return {
        idPersona: item.idPersona || item.idPropietario || item.id,
        idPropietario: item.idPropietario || item.idPersona || item.id,
        idPersonaResponsable: item.idPersonaResponsable || item.personaResponsable?.idPersona || null,
        nombrePersona: item.nombrePersona || item.nombrePropietario || item.nombre || '',
        nombrePropietario: item.nombrePropietario || item.nombrePersona || item.nombre || '',
        apellidoPersona: item.apellidoPersona || item.apellidoPropietario || item.apellido || '',
        apellidoPropietario: item.apellidoPropietario || item.apellidoPersona || item.apellido || '',
        tipoPersona: item.tipoPersona || 'Propietario',
        emailPersona: item.emailPersona || item.emailPropietario || item.email || item.correo || '',
        emailPropietario: item.emailPropietario || item.emailPersona || item.email || item.correo || '',
        duiPersona: item.duiPersona || item.duiPropietario || item.dui || '',
        duiPropietario: item.duiPropietario || item.duiPersona || item.dui || '',
        telefonoPersona: item.telefonoPersona || item.telefonoPropietario || item.Teléfono || '',
        telefonoPropietario: item.telefonoPropietario || item.telefonoPersona || item.Teléfono || '',
        fotoUrlPersona: item.fotoUrlPersona || item.fotoPersona || item.fotoPropietario || item.foto || '',
        fechaNacimientoPersona: item.fechaNacimientoPersona || item.fechaNacimientoPropietario || null,
        fechaEntradaColonia: item.fechaEntradaColonia || item.entradaColoniaPersona || item.entradaColoniaPropietario || item.fechaEntrada || null,
        fechaSalidaColonia: item.fechaSalidaColonia || item.salidaColoniaPersona || item.salidaColoniaPropietario || item.fechaSalida || null
    };
}

function prepararPayload(p) {
    const nombre = (p.nombrePersona || p.nombrePropietario || p.nombre || '').trim();
    const apellido = (p.apellidoPersona || p.apellidoPropietario || p.apellido || '').trim();
    let rawDui = (p.duiPersona || p.duiPropietario || p.dui || '').trim();
    const dui = rawDui ? rawDui.slice(0, 10) : null;
    const tel = (p.telefonoPersona || p.telefonoPropietario || p.Teléfono || '').trim();
    const email = (p.emailPersona || p.correoPersona || p.emailPropietario || p.email || p.correo || '').trim();
    const pass = p.passwordHashPersona || p.passwordPropietario || p.passwordPersona || p.password || null;
    let tipo = (p.tipoPersona || p.rolPersona || 'Propietario').trim();
    if (tipo) {
        tipo = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
    }
    const foto = p.fotoUrlPersona || p.fotoPropietario || p.fotoPersona || p.foto || null;

    const payload = {
        nombrePersona: nombre,
        apellidoPersona: apellido,
        tipoPersona: tipo,
        emailPersona: email,
        duiPersona: dui,
        telefonoPersona: tel,
        fotoUrlPersona: foto,
        fechaNacimientoPersona: p.fechaNacimientoPersona || p.fechaNacimiento || null,
        fechaEntradaColonia: p.fechaEntradaColonia || p.entradaColoniaPersona || p.fechaEntrada || fechaLocalISO(),
        fechaSalidaColonia: p.fechaSalidaColonia || p.salidaColoniaPersona || p.fechaSalida || null,
        idPersonaResponsable: p.idPersonaResponsable || null
    };

    if (p.idPersona || p.idPropietario || p.id) {
        payload.idPersona = p.idPersona || p.idPropietario || p.id;
    }

    if (pass) {
        payload.passwordHashPersona = pass;
    }

    return payload;
}

/** personas por pagina */
export async function getPersonasPaginado(pagina = 1, tamano = 10) {
    const res = await apiFetch(`/personas/paginado?page=${Math.max(0, pagina - 1)}&size=${tamano}`);
    // datos de la pagina
    const meta = (res && typeof res.page === 'object') ? res.page : (res || {});
    const contenido = Array.isArray(res?.content) ? res.content : [];
    return {
        contenido: await Promise.all(contenido.map(item => normalizarPersona(item))),
        totalPaginas: Number(meta.totalPages ?? 0),
        totalElementos: Number(meta.totalElements ?? contenido.length)
    };
}

export async function getPersonas() {
    try {
        const res = await apiFetch('/personas');
        const lista = Array.isArray(res) ? res : (res?.data || []);
        return lista.map(normalizarPersona);
    } catch (error) {
        console.warn("Aviso en getPersonas:", error.message);
        return [];
    }
}

export async function getPersona(id) {
    try {
        const res = await apiFetch(`/personas/${id}`);
        return normalizarPersona(res);
    } catch (error) {
        console.warn(`Error al obtener persona ${id}:`, error.message);
        return null;
    }
}

export async function createPersona(persona) {
    const body = prepararPayload(persona);
    if (!body.idPersona) {
        delete body.idPersona;
    }
    return await apiFetch('/personas', { method: "POST", body: body });
}

export async function actualizarPersona(id, persona) {
    const body = prepararPayload(persona);
    delete body.idPersona;
    // sin contraseña se usa patch
    if (!body.passwordHashPersona) {
        delete body.passwordHashPersona;
        return await apiFetch(`/personas/${id}`, { method: "PATCH", body: body });
    }
    return await apiFetch(`/personas/${id}`, { method: "PUT", body: body });
}

export async function deletePersona(id) {
    await apiFetch(`/personas/${id}`, { method: "DELETE" });
    return true;
}
