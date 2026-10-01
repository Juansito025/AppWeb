/** subida de fotos */

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_MB = 5;

export function validarImagen(file) {
    if (!file) throw new Error('No se seleccionó ninguna imagen.');
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
        throw new Error('Formato no permitido. Usa JPG, PNG o WEBP.');
    }
    if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
        throw new Error(`La imagen no debe superar los ${TAMANO_MAXIMO_MB} MB.`);
    }
    return true;
}

async function subirFoto(recurso, id, file) {
    if (!id) throw new Error('Primero hay que guardar el registro para poder subir su foto.');
    validarImagen(file);
    const form = new FormData();
    form.append('file', file);
    return await window.apiFetch(`/${recurso}/${id}/foto`, { method: 'POST', body: form });
}

export const subirFotoEmpleado = (id, file) => subirFoto('empleados', id, file);
export const subirFotoPersona = (id, file) => subirFoto('personas', id, file);
export const subirFotoVisitante = (id, file) => subirFoto('visitantes', id, file);
export const subirEvidenciaIncidente = (id, file) => subirFoto('incidentes', id, file);

/** vista previa */
export function leerVistaPrevia(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });
}

if (typeof window !== 'undefined') {
    window.FotosService = {
        validarImagen,
        subirFotoEmpleado,
        subirFotoPersona,
        subirFotoVisitante,
        subirEvidenciaIncidente,
        leerVistaPrevia
    };
}
