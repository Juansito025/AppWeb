/** servicio de empleados */

let _rolesCache = null;
async function obtenerRolesCache() {
    if (_rolesCache) return _rolesCache;
    try {
        const res = await apiFetch('/roles');
        _rolesCache = Array.isArray(res) ? res : (res?.data || []);
    } catch (error) {
        _rolesCache = [];
    }
    return _rolesCache;
}

function idRolDe(fkRol) {
    if (fkRol && typeof fkRol === 'object') {
        return Number(fkRol.idRol ?? fkRol.id ?? 2);
    }
    return Number(fkRol ?? 2);
}

async function enriquecerEmpleado(emp) {
    if (!emp) return null;
    const roles = await obtenerRolesCache();
    const idRol = idRolDe(emp.fkRol);
    const rol = roles.find(r => Number(r.id ?? r.idRol) === idRol);
    return {
        ...emp,
        fkRol: { idRol: idRol, nombreRol: rol?.nombreRol || (idRol === 1 ? 'Administrador' : 'Vigilante') },
        idRol: idRol
    };
}

/** empleados por pagina */
export async function getEmpleadosPaginado(pagina = 1, tamano = 10) {
    const res = await apiFetch(`/empleados/paginado?page=${Math.max(0, pagina - 1)}&size=${tamano}`);
    // datos de la pagina
    const meta = (res && typeof res.page === 'object') ? res.page : (res || {});
    const contenido = Array.isArray(res?.content) ? res.content : [];
    return {
        contenido: await Promise.all(contenido.map(item => enriquecerEmpleado(item))),
        totalPaginas: Number(meta.totalPages ?? 0),
        totalElementos: Number(meta.totalElements ?? contenido.length)
    };
}

export async function getEmpleados() {
    try {
        const res = await apiFetch('/empleados');
        const lista = Array.isArray(res) ? res : (res?.data || []);
        return await Promise.all(lista.map(enriquecerEmpleado));
    } catch (error) {
        console.warn("Aviso en getEmpleados:", error.message);
        return [];
    }
}

export async function getEmpleado(id) {
    const data = await apiFetch(`/empleados/${id}`);
    return await enriquecerEmpleado(data?.data || data);
}

function prepararPayloadEmpleado(emp) {
    const idRolNum = idRolDe(emp.fkRol ?? emp.idRol);

    return {
        idEmpleado: emp.idEmpleado || emp.id,
        nombreEmpleado: emp.nombreEmpleado || emp.nombre || '',
        apellidoEmpleado: emp.apellidoEmpleado || emp.apellido || '',
        correoEmpleado: emp.correoEmpleado || emp.correo || emp.email || '',
        passwordEmpleado: emp.passwordEmpleado || emp.password || null,
        duiEmpleado: emp.duiEmpleado || emp.dui || '',
        telefonoEmpleado: emp.telefonoEmpleado || emp.Teléfono || '',
        fechaInicioContrato: emp.fechaInicioContrato || fechaLocalISO(),
        fechaNacimientoEmpleado: emp.fechaNacimientoEmpleado || emp.fechaNacimiento || null,
        fechaSalida: emp.fechaSalida || null,
        fotoUrlEmpleado: emp.fotoUrlEmpleado || emp.fotoEmpleado || null,
        // El backend espera fkRol como Long plano, no como objeto.
        fkRol: idRolNum
    };
}

export async function createEmpleado(empleado) {
    const body = prepararPayloadEmpleado(empleado);
    return await apiFetch('/empleados', {
        method: "POST",
        body: body
    });
}

export async function actualizarEmpleado(id, empleado) {
    const body = prepararPayloadEmpleado(empleado);
    // Si no se proporcionó contraseña, usamos PATCH para no fallar validación NotBlank
    if (!body.passwordEmpleado) {
        delete body.passwordEmpleado;
        return await apiFetch(`/empleados/${id}`, {
            method: "PATCH",
            body: body
        });
    }
    return await apiFetch(`/empleados/${id}`, {
        method: "PUT",
        body: body
    });
}

export async function deleteEmpleado(id) {
    await apiFetch(`/empleados/${id}`, { method: "DELETE" });
    return true;
}
