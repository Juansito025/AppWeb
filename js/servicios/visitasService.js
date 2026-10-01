/** servicio de visitas */

import { createVisitante, getVisitantes } from './visitantesService.js';
import { buscarVehiculoPorMatricula, createVehiculo } from './vehiculosService.js';

function normalizarVisita(v, visitantesMap = {}, personasMap = {}) {
    if (!v) return null;

    const rawFkVis = v.fkVisitante?.idVisitante || v.fkVisitante?.id || v.fkVisitante;
    const keyVis = rawFkVis ? String(rawFkVis).toLowerCase().trim() : '';
    const visitante = visitantesMap[keyVis] || visitantesMap[rawFkVis] || {};

    const rawFkPer = v.fkPersona?.idPersona || v.fkPersona?.id || v.fkPersona;
    const keyPer = rawFkPer ? String(rawFkPer).toLowerCase().trim() : '';
    const persona = personasMap[keyPer] || personasMap[rawFkPer] || {};

    const nombreVis = (visitante.nombreVisitante ? `${visitante.nombreVisitante} ${visitante.apellidoVisitante || ''}`.trim() : null)
                   || v.nombreVisitante
                   || v.nombre
                   || 'Visitante';

    const nombreRes = (persona.nombrePersona ? `${persona.nombrePersona} ${persona.apellidoPersona || ''}`.trim() : null)
                   || (persona.nombrePropietario ? `${persona.nombrePropietario} ${persona.apellidoPropietario || ''}`.trim() : null)
                   || v.nombreAnfitrion
                   || v.residenteDestino
                   || v.destino
                   || 'Residente';

    const estadoNorm = (v.estado === 'Aprobada' || v.estado === 'activo' || v.estadoVisita === 'activo') ? 'activo' : 'inactivo';

    return {
        idVisita: v.idVisitas || v.idVisita || v.id,
        id: v.idVisitas || v.idVisita || v.id,
        fkPersona: rawFkPer,
        fkVisitante: rawFkVis,
        fechaVisita: v.fechaVisita,
        horaEntrada: v.horaEntrada || v.fechaVisita || fechaHoraLocalISO(),
        estado: v.estado || 'Aprobada',
        estadoVisita: estadoNorm,
        nombreVisitante: nombreVis,
        duiVisitante: visitante.duiVisitante || v.duiVisitante || '—',
        telefonoVisitante: visitante.telefonoVisitante || v.telefonoVisitante || '—',
        // tipo de transporte
        tipoTransporte: v.fkVehiculos ? 'Vehicular' : (v.tipoTransporte || 'Peatonal'),
        tipoVisitante: visitante.tipoVisitante || v.tipoVisitante || '',
        nombreAnfitrion: nombreRes,
        residenteDestino: nombreRes,
        destino: nombreRes,
        codigoQr: v.codigoQr || v.Código || `KP-VIS-${v.idVisitas || v.idVisita || v.id || '0'}`
    };
}

export async function getVisitas() {
    try {
        const [visitasRes, visitantesRes, personasRes] = await Promise.all([
           apiFetch('/visitas/paginado?page=0&size=100').catch(() => []),
            apiFetch('/visitantes').catch(() => []),
            apiFetch('/personas').catch(() => [])
        ]);

        const rawVisitas = Array.isArray(visitasRes)? visitasRes: (visitasRes?.data?.content || visitasRes?.content || visitasRes?.data || []);
        const rawVisitantes = Array.isArray(visitantesRes) ? visitantesRes : (visitantesRes?.data || []);
        const rawPersonas = Array.isArray(personasRes) ? personasRes : (personasRes?.data || []);

        const visMap = {};
        rawVisitantes.forEach(v => {
            const id = v.idVisitante || v.id;
            if (id) {
                visMap[String(id).toLowerCase().trim()] = v;
                visMap[String(id)] = v;
            }
        });

        const perMap = {};
        rawPersonas.forEach(p => {
            const id = p.idPersona || p.idPropietario || p.id;
            if (id) {
                perMap[String(id).toLowerCase().trim()] = p;
                perMap[String(id)] = p;
            }
        });

        return rawVisitas.map(v => normalizarVisita(v, visMap, perMap));
    } catch (error) {
        console.warn("Aviso en getVisitas:", error.message);
        return [];
    }
}

export async function getVisita(id) {
    const data = await apiFetch(`/visitas/${id}`);
    return normalizarVisita(data?.data || data);
}

export async function createVisita(datos) {
    let idVisitante = datos.fkVisitante;

    // crear visitante
    if (!idVisitante) {
        const partesNombre = (datos.nombreVisitante || 'Visitante').trim().split(' ');
        const nom = partesNombre[0] || 'Visitante';
        const ape = partesNombre.slice(1).join(' ') || '-';

        const nuevoVisitante = await createVisitante({
            nombreVisitante: nom,
            apellidoVisitante: ape,
            tipoVisitante: datos.tipoVisitante || 'Otro',
            fotoVisitante: datos.fotoVisitante || null,
            duiVisitante: datos.duiVisitante || '00000000-0',
            telefonoVisitante: datos.telefonoVisitante || '0000-0000'
        });

        idVisitante = nuevoVisitante?.data?.idVisitante || nuevoVisitante?.idVisitante || nuevoVisitante?.id;
    }

    let idVehiculo = datos.fkVehiculos || datos.idVehiculo || null;
    const Matrícula = datos.matriculaVehiculo || datos.Matrícula;
    if (!idVehiculo && Matrícula) {
        try {
            const encontrado = await buscarVehiculoPorMatricula(Matrícula);
            if (encontrado && (encontrado.idVehiculo || encontrado.id)) {
                idVehiculo = encontrado.idVehiculo || encontrado.id;
            } else {
                const nuevoVeh = await createVehiculo({
                    matriculaVehiculo: Matrícula,
                    tipoVehiculo: datos.tipoVehiculo || 'Automóvil',
                    marcaVehiculo: datos.marcaVehiculo || 'Genérico',
                    modeloVehiculo: datos.modeloVehiculo || 'Estándar'
                });
                idVehiculo = nuevoVeh?.data?.idVehiculo || nuevoVeh?.idVehiculo || nuevoVeh?.id;
            }
        } catch (e) {
            console.warn("Aviso al vincular vehículo:", e.message);
        }
    }

    const estadoNorm = (datos.estado === 'Aprobada' || datos.estado === 'Desaprobada' || datos.estado === 'Expirada')
        ? datos.estado
        : (datos.estadoVisita === 'inactivo' || datos.estado === 'Inactiva' ? 'Desaprobada' : 'Aprobada');

    const payload = {
        fkPersona: datos.fkPersona?.idPersona || datos.fkPersona || datos.residenteId,
        fkVisitante: idVisitante,
        fechaVisita: datos.fechaVisita ? String(datos.fechaVisita).slice(0, 10) : fechaLocalISO(),
        estado: estadoNorm
    };

    if (idVehiculo) {
        payload.fkVehiculos = idVehiculo;
    }

    return await apiFetch('/visitas', {
        method: "POST",
        body: payload
    });
}

export async function actualizarVisita(id, visita) {
    const estadoRaw = visita.estado || (visita.estadoVisita ? (visita.estadoVisita === 'inactivo' ? 'Desaprobada' : 'Aprobada') : null);
    const estadoNorm = (estadoRaw === 'Aprobada' || estadoRaw === 'Desaprobada' || estadoRaw === 'Expirada')
        ? estadoRaw
        : (estadoRaw ? (estadoRaw === 'inactivo' || estadoRaw === 'Inactiva' ? 'Desaprobada' : 'Aprobada') : undefined);

    const payload = {};
    if (visita.fkPersona?.idPersona || visita.fkPersona) payload.fkPersona = visita.fkPersona?.idPersona || visita.fkPersona;
    if (visita.fkVisitante) payload.fkVisitante = visita.fkVisitante;
    if (visita.fechaVisita) payload.fechaVisita = String(visita.fechaVisita).slice(0, 10);
    if (estadoNorm) payload.estado = estadoNorm;
    if (visita.fkVehiculos || visita.idVehiculo) payload.fkVehiculos = visita.fkVehiculos || visita.idVehiculo;

    // put o patch
    const esCompleto = payload.fkPersona && payload.fkVisitante && payload.fechaVisita && payload.estado;
    if (esCompleto) {
        payload.idVisitas = Number(id);
        return await apiFetch(`/visitas/${id}`, {
            method: "PUT",
            body: payload
        });
    }

    return await apiFetch(`/visitas/${id}`, {
        method: "PATCH",
        body: payload
    });
}

export async function deleteVisita(id) {
    await apiFetch(`/visitas/${id}`, { method: "DELETE" });
    return true;
}

// exportacion
export const VisitasService = {
    obtenerHistorialVisitas: getVisitas,
    registrarVisita: createVisita,
    actualizarVisita,
    deleteVisita
};
export default VisitasService;
