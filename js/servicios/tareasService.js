/** servicio de tareas */

const getApiFetch = () => {
    if (typeof window !== 'undefined' && typeof window.apiFetch === 'function') {
        return window.apiFetch;
    }
    if (typeof apiFetch === 'function') {
        return apiFetch;
    }
    return async () => [];
};

/** nombres de campos */
function normalizarTarea(t) {
    if (!t || typeof t !== 'object') return t;
    const titulo = t.titulo ?? t.tituloTarea ?? t.Título ?? '';
    const descripcion = t.descripcion ?? t.descripcionTarea ?? t.Descripción ?? '';
    return { ...t, titulo, descripcion, tituloTarea: titulo, Título: titulo, descripcionTarea: descripcion, Descripción: descripcion };
}
const normalizarLista = (res) => (Array.isArray(res) ? res.map(normalizarTarea) : res);

export async function getTareas() {
    try {
        const fetchFn = getApiFetch();
        return normalizarLista(await fetchFn('/tareas'));
    } catch (e) {
        console.warn('[TareasService] Error al obtener tareas:', e.message);
        return [];
    }
}

export async function getTareasPorEmpleado(idEmpleado) {
    try {
        const fetchFn = getApiFetch();
        return normalizarLista(await fetchFn(`/tareas/empleado/${idEmpleado}`));
    } catch (e) {
        console.warn(`[TareasService] Error al obtener tareas del empleado ${idEmpleado}:`, e.message);
        return [];
    }
}

export async function getTareasPorEstado(estado) {
    try {
        const fetchFn = getApiFetch();
        return normalizarLista(await fetchFn(`/tareas/estado/${encodeURIComponent(estado)}`));
    } catch (e) {
        console.warn(`[TareasService] Error al obtener tareas por estado ${estado}:`, e.message);
        return [];
    }
}

function prepararPayloadTarea(t) {
    return {
        fkEmpleado: t.fkEmpleado,
        titulo: String(t.titulo || t.Título || t.tituloTarea || t.nombreTarea || t.nombre || '').trim().slice(0, 100),
        descripcion: String(t.descripcion || t.Descripción || t.descripcionTarea || '').trim().slice(0, 500),
        estado: t.estado || t.estadoTarea || 'Pendiente',
        fechaAsignacion: t.fechaAsignacion || window.fechaLocalISO(),
        fechaLimite: t.fechaLimite || null,
        fkAsignadoPor: t.fkAsignadoPor || null
    };
}

export async function createTarea(tarea) {
    try {
        const fetchFn = getApiFetch();
        return await fetchFn('/tareas', {
            method: 'POST',
            body: prepararPayloadTarea(tarea)
        });
    } catch (e) {
        console.error('[TareasService] Error al crear tarea:', e.message);
        throw e;
    }
}

export async function actualizarEstadoTarea(id, nuevoEstado) {
    try {
        const fetchFn = getApiFetch();
        return await fetchFn(`/tareas/${id}/estado`, {
            method: 'PATCH',
            body: { estado: nuevoEstado }
        });
    } catch (e) {
        console.error(`[TareasService] Error al actualizar estado de tarea ${id}:`, e.message);
        throw e;
    }
}

export async function deleteTarea(id) {
    try {
        const fetchFn = getApiFetch();
        return await fetchFn(`/tareas/${id}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.error(`[TareasService] Error al eliminar tarea ${id}:`, e.message);
        throw e;
    }
}

export { deleteTarea as eliminarTarea };

if (typeof window !== 'undefined') {
    window.getTareas = getTareas;
    window.getTareasPorEmpleado = getTareasPorEmpleado;
    window.getTareasPorEstado = getTareasPorEstado;
    window.createTarea = createTarea;
    window.actualizarEstadoTarea = actualizarEstadoTarea;
    window.deleteTarea = deleteTarea;
    window.eliminarTarea = deleteTarea;
}
