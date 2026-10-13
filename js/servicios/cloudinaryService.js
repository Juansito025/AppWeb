/** subida de fotos */

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_MB = 15;

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

export async function comprimirImagen(file, ladoMaximo = 1280, calidad = 0.85) {
    if (!file || file.size <= 700 * 1024) return file;
    try {
        const url = URL.createObjectURL(file);
        const img = await new Promise((resolver, rechazar) => {
            const i = new Image();
            i.onload = () => resolver(i);
            i.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
            i.src = url;
        });
        const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const blob = await new Promise(resolver => canvas.toBlob(resolver, 'image/jpeg', calidad));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (_) {
        return file;
    }
}

async function subirFoto(recurso, id, file) {
    if (!id) throw new Error('Primero hay que guardar el registro para poder subir su foto.');
    validarImagen(file);
    const form = new FormData();
    form.append('file', await comprimirImagen(file));
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
