import { barras, linea } from '../Recursos/graficas.js';

/** estadisticas */

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
const lista = (r) => (Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []));
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;

// colores
const COLOR = {
    serie: '#2473F5',          // --accent
    serieSuave: '#1a3a75',     // tono sólido para barras que no son pico
    bueno: '#10b981',          // --success
    aviso: '#f59e0b',          // --warning
    critico: '#ef4444',        // --danger
    neutro: '#505870',         // --text-muted
    ordinal: ['#10b981', '#f59e0b', '#ef4444'] // colores por gravedad
};
const COLOR_ESTADO = {
    Aprobada: COLOR.bueno, Desaprobada: COLOR.critico, Expirada: COLOR.neutro,
    Pendiente: COLOR.aviso, Pagada: COLOR.bueno, Impugnada: COLOR.serie, Anulada: COLOR.neutro
};

let datos = null;
let dias = 30;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.CredentialsStore) await window.CredentialsStore.protegerVista();
    document.querySelectorAll('.est-rango button').forEach(b => b.addEventListener('click', () => {
        dias = Number(b.dataset.dias);
        document.querySelectorAll('.est-rango button').forEach(x => {
            x.classList.toggle('activo', x === b);
            x.setAttribute('aria-pressed', String(x === b));
        });
        pintar();
    }));
    await cargar();
});

async function cargar() {
    const pedir = (e) => apiFetch(e, { silencioso: true }).then(lista).catch(() => []);
    const [accesos, visitas, infracciones, gravedades, propiedades] = await Promise.all([
        pedir('/accesos'), pedir('/visitas'), pedir('/infracciones'), pedir('/gravedadInfracciones'), pedir('/propiedades')
    ]);
    datos = { accesos, visitas, infracciones, gravedades, propiedades };
    document.getElementById('est-actualizado').textContent =
        `Datos de la API al ${new Date().toLocaleString('es-SV', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`;
    pintar();
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function inicioPeriodo() {
    const d = new Date();
    d.setDate(d.getDate() - (dias - 1));
    return fechaLocalISO(d);
}
const enPeriodo = (fechaISO) => fechaISO && String(fechaISO).slice(0, 10) >= inicioPeriodo();
const contar = (arr, clave) => arr.reduce((m, x) => { const k = clave(x); m.set(k, (m.get(k) || 0) + 1); return m; }, new Map());

function tabla(idContenedor, cabeceras, filas) {
    document.getElementById(idContenedor).innerHTML = filas.length
        ? `<table><thead><tr>${cabeceras.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
           <tbody>${filas.map(f => `<tr>${f.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : '<p>Sin datos en el periodo.</p>';
}

function dibujar(id, tipo, opciones) {
    const cont = document.getElementById(id);
    if (tipo === 'linea') linea(cont, opciones); else barras(cont, opciones);
}

// ── Pintado ───────────────────────────────────────────────────────────────────
function pintar() {
    if (!datos) return;
    const hoy = fechaLocalISO();
    const accesos = datos.accesos.filter(a => enPeriodo(a.horaEntrada));
    const visitas = datos.visitas.filter(v => enPeriodo(v.fechaVisita));

    // KPIs
    document.getElementById('kpi-entradas').textContent = accesos.length;
    document.getElementById('kpi-entradas-hoy').textContent =
        `${datos.accesos.filter(a => String(a.horaEntrada || '').startsWith(hoy)).length} hoy`;
    document.getElementById('kpi-visitas').textContent = visitas.length;
    const aprobadas = visitas.filter(v => v.estado === 'Aprobada').length;
    document.getElementById('kpi-visitas-aprob').textContent = visitas.length
        ? `${Math.round(aprobadas * 100 / visitas.length)} % aprobadas` : 'Sin visitas';
    const pendientes = datos.infracciones.filter(i => (i.estado || 'Pendiente') === 'Pendiente');
    document.getElementById('kpi-infr').textContent = pendientes.length;
    document.getElementById('kpi-infr-monto').textContent = `${dinero(pendientes.reduce((t, i) => t + Number(i.monto || 0), 0))} por cobrar`;
    const habitadas = datos.propiedades.filter(p => String(p.estado || '').toLowerCase() === 'habitada').length;
    const totalProp = datos.propiedades.length;
    document.getElementById('kpi-ocupacion').textContent = totalProp ? `${Math.round(habitadas * 100 / totalProp)} %` : '—';
    document.getElementById('kpi-ocupacion-det').textContent = `${habitadas} de ${totalProp} propiedades`;

    // Entradas por hora
    const porHora = Array(24).fill(0);
    accesos.forEach(a => {
        const h = Number(String(a.horaEntrada || '').slice(11, 13));
        if (Number.isInteger(h) && h >= 0 && h < 24) porHora[h]++;
    });
    const etiquetasHora = porHora.map((_, h) => `${String(h).padStart(2, '0')}:00`);
    const maximo = Math.max(...porHora);
    const picos = etiquetasHora.filter((_, h) => porHora[h] === maximo);
    document.getElementById('sub-horas').textContent = maximo
        ? `${picos.length > 1 ? 'Horas pico' : 'Hora pico'}: ${picos.join(' y ')} (${maximo} entradas) · últimos ${dias} días`
        : `Sin entradas en los últimos ${dias} días`;
    dibujar('graf-horas', 'barras', {
        etiquetas: etiquetasHora.map(h => h.slice(0, 2) + 'h'),
        valores: porHora,
        colores: porHora.map(v => (v === maximo && v > 0 ? COLOR.serie : COLOR.serieSuave)),
        detalle: (i) => `${porHora[i]} entradas entre ${etiquetasHora[i]} y ${String(i + 1).padStart(2, '0')}:00`
    });
    tabla('tabla-horas', ['Hora', 'Entradas'], porHora.map((v, h) => [etiquetasHora[h], v]).filter(f => f[1] > 0));

    // Visitas por día (serie continua, días sin visitas = 0)
    const etiquetasDias = [];
    const conteoDias = contar(visitas, v => String(v.fechaVisita).slice(0, 10));
    for (let i = dias - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        etiquetasDias.push(fechaLocalISO(d));
    }
    const valoresDias = etiquetasDias.map(f => conteoDias.get(f) || 0);
    const promedio = valoresDias.reduce((a, b) => a + b, 0) / (valoresDias.length || 1);
    document.getElementById('sub-dias').textContent = `Promedio: ${promedio.toFixed(1)} visitas por día · últimos ${dias} días`;
    const corta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
    dibujar('graf-dias', 'linea', {
        etiquetas: etiquetasDias.map(corta),
        valores: valoresDias,
        color: COLOR.serie,
        relleno: false,
        formato: (v) => `${v} visita${v === 1 ? '' : 's'}`
    });
    tabla('tabla-dias', ['Fecha', 'Visitas'], etiquetasDias.map((f, i) => [corta(f), valoresDias[i]]).filter(f => f[1] > 0));

    // Visitas por estado
    const estadosVisita = ['Aprobada', 'Desaprobada', 'Expirada'];
    const cv = contar(visitas, v => v.estado);
    const valoresEstado = estadosVisita.map(e => cv.get(e) || 0);
    dibujar('graf-visitas-estado', 'barras', {
        etiquetas: estadosVisita, valores: valoresEstado, horizontal: true,
        colores: estadosVisita.map(e => COLOR_ESTADO[e])
    });
    tabla('tabla-visitas-estado', ['Estado', 'Visitas'], estadosVisita.map((e, i) => [e, valoresEstado[i]]));

    // entradas por metodo
    const cm = contar(accesos, a => a.metodoAcceso === 'QR' ? 'Código QR' : 'Manual');
    const metodos = ['Código QR', 'Manual'];
    dibujar('graf-metodo', 'barras', {
        etiquetas: metodos, valores: metodos.map(m => cm.get(m) || 0), horizontal: true,
        colores: [COLOR.serie, COLOR.aviso]
    });
    tabla('tabla-metodo', ['Método', 'Entradas'], metodos.map(m => [m, cm.get(m) || 0]));

    // Infracciones por estado (cantidad y monto en el tooltip)
    const estadosInf = ['Pendiente', 'Pagada', 'Impugnada', 'Anulada'];
    const ci = contar(datos.infracciones, i => i.estado || 'Pendiente');
    const montoPor = (e) => datos.infracciones.filter(i => (i.estado || 'Pendiente') === e).reduce((t, i) => t + Number(i.monto || 0), 0);
    dibujar('graf-infr-estado', 'barras', {
        etiquetas: estadosInf, valores: estadosInf.map(e => ci.get(e) || 0), horizontal: true,
        colores: estadosInf.map(e => COLOR_ESTADO[e]),
        detalle: (i) => `${ci.get(estadosInf[i]) || 0} infracciones · ${dinero(montoPor(estadosInf[i]))}`
    });
    tabla('tabla-infr-estado', ['Estado', 'Cantidad', 'Monto'], estadosInf.map(e => [e, ci.get(e) || 0, dinero(montoPor(e))]));

    // infracciones por gravedad
    const orden = ['leve', 'moderada', 'grave'];
    const nombreGravedad = new Map(datos.gravedades.map(g => [String(g.idGravedadInfraccion), String(g.nombreGravedadInfraccion || '').toLowerCase()]));
    const cg = contar(datos.infracciones, i => nombreGravedad.get(String(i.fkTipoInfraccion)) || 'sin dato');
    const etiquetasGrav = orden.map(g => g.charAt(0).toUpperCase() + g.slice(1));
    dibujar('graf-infr-gravedad', 'barras', {
        etiquetas: etiquetasGrav, valores: orden.map(g => cg.get(g) || 0), colores: COLOR.ordinal
    });
    tabla('tabla-infr-gravedad', ['Gravedad', 'Cantidad'], orden.map((g, i) => [etiquetasGrav[i], cg.get(g) || 0]));
}
