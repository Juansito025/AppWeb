/** servicio de roles */

export async function getRoles() {
    return await apiFetch('/roles');
}

export async function getRol(id) {
    return await apiFetch(`/roles/${id}`);
}

export async function createRol(data) {
    return await apiFetch('/roles', {
        method: 'POST',
        body: data
    });
}

export async function actualizarRol(id, data) {
    return await apiFetch(`/roles/${id}`, {
        method: 'PUT',
        body: data
    });
}

export async function deleteRol(id) {
    return await apiFetch(`/roles/${id}`, {
        method: 'DELETE'
    });
}
