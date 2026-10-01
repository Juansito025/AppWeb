/** servicio de incidentes e infracciones */

export const InfraccionesService = {
    /**
     * Obtiene los residentes activos para seleccionar al infractor
     */
    async obtenerResidentes() {
        try {
            const data = await apiFetch('/personas');
            return Array.isArray(data) ? data : (data?.data || []);
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando residentes:', error.message);
            return [];
        }
    },

    /**
     * Obtiene las visitas registradas para seleccionar visitante infractor
     */
    async obtenerVisitas() {
        try {
            return await obtenerTodasLasVisitas();
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando visitas:', error.message);
            return [];
        }
    },

    /** niveles de gravedad */
    async obtenerGravedades() {
        try {
            const data = await apiFetch('/gravedadInfracciones');
            return Array.isArray(data) ? data : (data?.data || []);
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando gravedades:', error.message);
            return [];
        }
    },

    /**
     * Obtiene los vehículos registrados
     */
    async obtenerVehiculos() {
        try {
            const data = await apiFetch('/vehiculos');
            return Array.isArray(data) ? data : (data?.data || []);
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando vehiculos:', error.message);
            return [];
        }
    },

    /**
     * Obtiene los empleados registrados
     */
    async obtenerEmpleados() {
        try {
            const data = await apiFetch('/empleados');
            return Array.isArray(data) ? data : (data?.data || []);
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando empleados:', error.message);
            return [];
        }
    },

    /**
     * Registra un nuevo incidente en el sistema
     */
    async registrarIncidente(datosIncidente) {
        return await apiFetch('/incidentes', {
            method: 'POST',
            body: {
                fkEmpleado: datosIncidente.fkEmpleado,
                tipoActor: datosIncidente.tipoActor,
                tipoIncidente: datosIncidente.tipoIncidente,
                fechaHoraIncidente: datosIncidente.fechaHoraIncidente,
                lugarIncidente: datosIncidente.lugarIncidente,
                descripcionIncidente: datosIncidente.descripcionIncidente,
                evidenciaUrl: datosIncidente.evidenciaUrl || null,
                fkPersonas: datosIncidente.fkPersonas || null,
                fkVisita: datosIncidente.fkVisita || null,
                fkVehiculos: datosIncidente.fkVehiculos || null
            }
        });
    },

    /** aplicar infraccion */
    async registrarInfraccion(datosInfraccion) {
        // sin gravedad valida no se guarda (antes caia siempre en 1 = leve)
        const crudo = datosInfraccion.fkTipoInfraccion;
        const fkGravedad = /^\d+$/.test(String(crudo ?? '')) ? Number(crudo) : crudo;
        if (fkGravedad == null || fkGravedad === '') throw new Error('No se pudo identificar la gravedad seleccionada.');
        return await apiFetch('/infracciones', {
            method: 'POST',
            body: {
                fkTipoInfraccion: fkGravedad,
                fkIncidente: datosInfraccion.fkIncidente,
                monto: parseFloat(datosInfraccion.monto || 10.00),
                estado: datosInfraccion.estado || 'Pendiente'
            }
        });
    },

    /**
     * Obtiene el listado de todas las infracciones reportadas
     */
    async obtenerInfracciones() {
        try {
            const data = await apiFetch('/infracciones');
            return Array.isArray(data) ? data : (data?.data || []);
        } catch (error) {
            console.warn('[InfraccionesService] Error cargando infracciones:', error.message);
            return [];
        }
    }
};

// exportaciones
export const getInfracciones = () => InfraccionesService.obtenerInfracciones();
export const getInfraccionesDetalladas = () => InfraccionesService.obtenerInfracciones();
export const getGravedades = () => InfraccionesService.obtenerGravedades();
export const createInfraccion = (data) => InfraccionesService.registrarInfraccion(data);
export const actualizarInfraccion = (id, data) => apiFetch(`/infracciones/${id}`, { method: 'PUT', body: data });
export const deleteInfraccion = (id) => apiFetch(`/infracciones/${id}`, { method: 'DELETE' });
export default InfraccionesService;
