/** ficha del residente */

const lista = (res) => (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []));
const mismoId = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();

async function obtener(endpoint) {
    try {
        return lista(await apiFetch(endpoint, { silencioso: true }));
    } catch (e) {
        console.warn(`[ResidenteDatos] ${endpoint}:`, e.message);
        return [];
    }
}

export function nombreCompleto(p) {
    return `${p?.nombrePersona || ''} ${p?.apellidoPersona || ''}`.trim() || 'Residente';
}

/** cargar datos */
export async function cargarDatosBase() {
    const [personas, propiedades, secciones, tipos, infracciones, incidentes, gravedades, visitas, visitantes, pases, accesos] =
        await Promise.all([
            obtener('/personas'),
            obtener('/propiedades'),
            obtener('/secciones'),
            obtener('/tiposPropiedades'),
            obtener('/infracciones'),
            obtener('/incidentes'),
            obtener('/gravedadInfracciones'),
            obtener('/visitas'),
            obtener('/visitantes'),
            obtener('/paseAccesoQR'),
            obtener('/accesos')
        ]);
    return { personas, propiedades, secciones, tipos, infracciones, incidentes, gravedades, visitas, visitantes, pases, accesos };
}

function propiedadesDe(persona, base) {
    const propias = base.propiedades.filter(pr => mismoId(pr.fkPropietario || pr.fkPersona, persona.idPersona));
    // Familiares e inquilinos viven en la propiedad de su responsable
    const lista = propias.length || !persona.idPersonaResponsable
        ? propias
        : base.propiedades.filter(pr => mismoId(pr.fkPropietario || pr.fkPersona, persona.idPersonaResponsable));
    return lista.map(pr => {
        const seccion = base.secciones.find(s => mismoId(s.idSecciones, pr.fkSeccion));
        const tipo = base.tipos.find(t => mismoId(t.idTipoPropiedad, pr.fkTipoPropiedad));
        return {
            ...pr,
            nombreSeccion: seccion?.nombreSeccion || '',
            nombreTipo: tipo?.nombreTipoPropiedad || '',
            descripcion: [pr.codigo, pr.calle, seccion?.nombreSeccion].filter(Boolean).join(' · ') || `Propiedad #${pr.idPropiedad}`
        };
    });
}

/** infracciones */
export function infraccionesDe(idPersona, base) {
    const incidentesPersona = new Map(
        base.incidentes
            .filter(i => mismoId(i.fkPersonas || i.fkPersona, idPersona))
            .map(i => [String(i.idIncidente), i])
    );
    return base.infracciones
        .filter(inf => incidentesPersona.has(String(inf.fkIncidente)))
        .map(inf => {
            const inc = incidentesPersona.get(String(inf.fkIncidente));
            return {
                ...inf,
                fecha: inc.fechaHoraIncidente || null,
                motivo: inc.descripcionIncidente || 'Sin descripción',
                lugar: inc.lugarIncidente || '',
                tipoIncidente: inc.tipoIncidente || '',
                gravedad: window.gravedadDeInfraccion(inf, base.gravedades),
                evidenciaUrl: inc.evidenciaUrl || '',
                monto: Number(inf.monto || 0),
                estado: inf.estado || 'Pendiente'
            };
        })
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
}

export function resumenInfracciones(infracciones) {
    const suma = (fn) => infracciones.filter(fn).reduce((t, i) => t + i.monto, 0);
    return {
        cantidad: infracciones.length,
        pendientes: infracciones.filter(i => i.estado === 'Pendiente').length,
        totalPendiente: suma(i => i.estado === 'Pendiente'),
        totalPagado: suma(i => i.estado === 'Pagada'),
        totalGeneral: suma(() => true)
    };
}

/** Pase personal vigente más reciente (activo y sin vencer). */
export function pasePersonalVigente(idPersona, base) {
    const hoy = fechaLocalISO();
    return base.pases
        .filter(p => p.tipoPase === 'Propietario' && mismoId(p.fkPersonas, idPersona))
        .filter(p => String(p.paseActivo).toLowerCase() === 's' && (!p.duracionPase || String(p.duracionPase) >= hoy))
        .sort((a, b) => String(b.fechaInicioPase || '').localeCompare(String(a.fechaInicioPase || '')))[0] || null;
}

export function fichaResidente(idPersona, base) {
    const persona = base.personas.find(p => mismoId(p.idPersona, idPersona));
    if (!persona) return null;

    const visitasPersona = base.visitas
        .filter(v => mismoId(v.fkPersona, idPersona))
        .map(v => {
            const vis = base.visitantes.find(x => mismoId(x.idVisitante, v.fkVisitante)) || {};
            return {
                ...v,
                nombreVisitante: `${vis.nombreVisitante || ''} ${vis.apellidoVisitante || ''}`.trim() || 'Visitante',
                duiVisitante: vis.duiVisitante || ''
            };
        })
        .sort((a, b) => String(b.fechaVisita || '').localeCompare(String(a.fechaVisita || '')));

    // accesos
    const idsVisitas = new Set(visitasPersona.map(v => String(v.idVisitas)));
    const pasesPersona = base.pases.filter(p =>
        mismoId(p.fkPersonas, idPersona) || (p.fkVisitas != null && idsVisitas.has(String(p.fkVisitas))));
    const idsPases = new Set(pasesPersona.map(p => String(p.idPaseAcceso).toLowerCase()));
    const accesos = base.accesos
        .map(a => {
            const idPase = a.detalleQr?.fkPasesAcceso ? String(a.detalleQr.fkPasesAcceso).toLowerCase() : null;
            const idVisita = a.detalleManual?.fkVisitas != null ? String(a.detalleManual.fkVisitas) : null;
            let quien = null;
            if (idPase && idsPases.has(idPase)) {
                const pase = pasesPersona.find(p => String(p.idPaseAcceso).toLowerCase() === idPase);
                if (pase?.tipoPase === 'Propietario') quien = 'Residente';
                else quien = visitasPersona.find(v => mismoId(v.idVisitas, pase?.fkVisitas))?.nombreVisitante || 'Visita';
            } else if (idVisita && idsVisitas.has(idVisita)) {
                quien = visitasPersona.find(v => mismoId(v.idVisitas, idVisita))?.nombreVisitante || 'Visita';
            }
            return quien ? { ...a, quien } : null;
        })
        .filter(Boolean)
        .sort((a, b) => String(b.horaEntrada || '').localeCompare(String(a.horaEntrada || '')));

    const infracciones = infraccionesDe(idPersona, base);
    return {
        persona,
        nombre: nombreCompleto(persona),
        propiedades: propiedadesDe(persona, base),
        infracciones,
        resumen: resumenInfracciones(infracciones),
        visitas: visitasPersona,
        accesos,
        pase: pasePersonalVigente(idPersona, base)
    };
}

export const ResidenteDatos = { cargarDatosBase, fichaResidente, infraccionesDe, resumenInfracciones, pasePersonalVigente, nombreCompleto };
window.ResidenteDatos = ResidenteDatos;
export default ResidenteDatos;
