/** graficas */

const NS = 'http://www.w3.org/2000/svg';
const COLOR_SERIE = '#2473F5';

function el(nombre, attrs = {}, padre) {
    const n = document.createElementNS(NS, nombre);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (padre) padre.appendChild(n);
    return n;
}

/** Máximo "redondo" para el eje (1, 2, 5 × 10^n) y sus marcas. */
function escala(max, marcas = 4) {
    if (max <= 0) return { tope: marcas, paso: 1 };
    const bruto = max / marcas;
    const pot = 10 ** Math.floor(Math.log10(bruto));
    const bonito = [1, 2, 5, 10].map(m => m * pot).find(p => p >= bruto) || 10 * pot;
    const paso = Math.max(1, Math.ceil(bonito));      // conteos: marcas enteras
    return { tope: Math.ceil(max / paso) * paso, paso };
}

/** Rectángulo con esquinas redondeadas solo en el extremo de datos (4 px). */
function barraRedondeada(x, y, w, h, horizontal) {
    const r = Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h);
    if (w <= 0 || h <= 0) return '';
    if (horizontal) {
        return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
    }
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function preparar(contenedor) {
    contenedor.classList.add('grafica');
    contenedor.innerHTML = '';
    const tip = document.createElement('div');
    tip.className = 'grafica-tip';
    tip.hidden = true;
    contenedor.appendChild(tip);
    const ancho = Math.max(contenedor.clientWidth, 200);
    const alto = Math.max(contenedor.clientHeight, 140);
    const svg = el('svg', { width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`, role: 'presentation' });
    contenedor.insertBefore(svg, tip);
    return { svg, tip, ancho, alto };
}

function mostrarTip(contenedor, tip, x, y, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const maxX = contenedor.clientWidth - w - 4;
    tip.style.left = `${Math.max(4, Math.min(x - w / 2, maxX))}px`;
    tip.style.top = `${Math.max(0, y - h - 10)}px`;
}

function observar(contenedor, dibujar) {
    dibujar();
    if (contenedor._observador) contenedor._observador.disconnect();
    let ultimo = contenedor.clientWidth;
    contenedor._observador = new ResizeObserver(() => {
        if (Math.abs(contenedor.clientWidth - ultimo) < 2) return;
        ultimo = contenedor.clientWidth;
        dibujar();
    });
    contenedor._observador.observe(contenedor);
}

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function barras(contenedor, { etiquetas, valores, colores = COLOR_SERIE, horizontal = false, formato = (v) => String(v), detalle = null }) {
    const color = (i) => (Array.isArray(colores) ? colores[i] : colores);
    observar(contenedor, () => {
        const { svg, tip, ancho, alto } = preparar(contenedor);
        const n = valores.length;
        const { tope, paso } = escala(Math.max(...valores, 0));
        const textoTip = (i) => `<strong>${esc(etiquetas[i])}</strong><span>${esc(detalle ? detalle(i) : formato(valores[i]))}</span>`;

        if (horizontal) {
            const izq = Math.min(130, Math.max(...etiquetas.map(e => String(e).length)) * 7.5 + 12);
            const der = 56, arriba = 4, abajo = 4;
            const banda = (alto - arriba - abajo) / n;
            const grosor = Math.min(26, banda * 0.62);
            const anchoUtil = ancho - izq - der;
            valores.forEach((v, i) => {
                const y = arriba + i * banda + (banda - grosor) / 2;
                const w = tope ? (v / tope) * anchoUtil : 0;
                el('text', { x: izq - 10, y: y + grosor / 2, class: 'grafica-etiqueta', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = etiquetas[i];
                el('rect', { x: izq, y: y, width: anchoUtil, height: grosor, rx: 4, class: 'grafica-fondo' }, svg);
                if (w > 0) el('path', { d: barraRedondeada(izq, y, Math.max(w, 2), grosor, true), fill: color(i) }, svg);
                el('text', { x: izq + Math.max(w, 0) + 8, y: y + grosor / 2, class: 'grafica-valor', 'dominant-baseline': 'middle' }, svg).textContent = formato(v);
                const zona = el('rect', { x: 0, y: arriba + i * banda, width: ancho, height: banda, fill: 'transparent' }, svg);
                const ver = () => mostrarTip(contenedor, tip, izq + w / 2, y, textoTip(i));
                zona.addEventListener('mousemove', ver);
                zona.addEventListener('touchstart', ver, { passive: true });
                zona.addEventListener('mouseleave', () => { tip.hidden = true; });
            });
            return;
        }

        const izq = 34, der = 8, arriba = 10, abajo = 24;
        const altoUtil = alto - arriba - abajo;
        const banda = (ancho - izq - der) / n;
        const grosor = Math.min(34, banda * 0.66);
        const y0 = arriba + altoUtil;
        for (let t = 0; t <= tope; t += paso) {
            const y = y0 - (t / tope) * altoUtil;
            el('line', { x1: izq, x2: ancho - der, y1: y, y2: y, class: t === 0 ? 'grafica-base' : 'grafica-rejilla' }, svg);
            el('text', { x: izq - 8, y, class: 'grafica-eje', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = t;
        }
        const cadaCuanto = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((ancho - izq) / 46))));
        const guia = el('rect', { class: 'grafica-guia', width: banda, height: altoUtil, y: arriba, x: 0, visibility: 'hidden' }, svg);
        valores.forEach((v, i) => {
            const x = izq + i * banda + (banda - grosor) / 2;
            const h = tope ? (v / tope) * altoUtil : 0;
            if (h > 0) el('path', { d: barraRedondeada(x, y0 - h, grosor, Math.max(h, 2), false), fill: color(i) }, svg);
            if (i % cadaCuanto === 0) {
                el('text', { x: izq + i * banda + banda / 2, y: alto - 6, class: 'grafica-eje', 'text-anchor': 'middle' }, svg).textContent = etiquetas[i];
            }
            const zona = el('rect', { x: izq + i * banda, y: arriba, width: banda, height: altoUtil, fill: 'transparent' }, svg);
            const ver = () => {
                guia.setAttribute('x', izq + i * banda);
                guia.setAttribute('visibility', 'visible');
                mostrarTip(contenedor, tip, izq + i * banda + banda / 2, y0 - h, textoTip(i));
            };
            zona.addEventListener('mousemove', ver);
            zona.addEventListener('touchstart', ver, { passive: true });
            zona.addEventListener('mouseleave', () => { tip.hidden = true; guia.setAttribute('visibility', 'hidden'); });
        });
    });
}

export function linea(contenedor, { etiquetas, valores, formato = (v) => String(v), color = COLOR_SERIE, relleno = true }) {
    observar(contenedor, () => {
        const { svg, tip, ancho, alto } = preparar(contenedor);
        const n = valores.length;
        const izq = 34, der = 12, arriba = 10, abajo = 24;
        const altoUtil = alto - arriba - abajo;
        const anchoUtil = ancho - izq - der;
        const { tope, paso } = escala(Math.max(...valores, 0));
        const y0 = arriba + altoUtil;
        const px = (i) => izq + (n <= 1 ? anchoUtil / 2 : (i / (n - 1)) * anchoUtil);
        const py = (v) => y0 - (tope ? (v / tope) * altoUtil : 0);

        for (let t = 0; t <= tope; t += paso) {
            el('line', { x1: izq, x2: ancho - der, y1: py(t), y2: py(t), class: t === 0 ? 'grafica-base' : 'grafica-rejilla' }, svg);
            el('text', { x: izq - 8, y: py(t), class: 'grafica-eje', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = t;
        }
        const cadaCuanto = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(anchoUtil / 60))));
        etiquetas.forEach((e, i) => {
            const ultimo = i === n - 1;
            if ((i % cadaCuanto === 0 && (ultimo || n - 1 - i >= cadaCuanto)) || ultimo) {
                el('text', { x: px(i), y: alto - 6, class: 'grafica-eje', 'text-anchor': i === n - 1 ? 'end' : 'middle' }, svg).textContent = e;
            }
        });

        const puntos = valores.map((v, i) => `${px(i)},${py(v)}`);
        if (relleno) el('path', { d: `M${px(0)},${y0} L${puntos.join(' L')} L${px(n - 1)},${y0} Z`, fill: color, 'fill-opacity': 0.14 }, svg);
        el('path', { d: `M${puntos.join(' L')}`, fill: 'none', stroke: color, 'stroke-width': relleno ? 2 : 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        if (n <= 31) {
            valores.forEach((v, i) => el('circle', { cx: px(i), cy: py(v), r: 3, fill: color, class: 'grafica-punto' }, svg));
        }

        const cruz = el('line', { y1: arriba, y2: y0, class: 'grafica-cruz', visibility: 'hidden' }, svg);
        const marca = el('circle', { r: 5, fill: color, class: 'grafica-marca', visibility: 'hidden' }, svg);
        const zona = el('rect', { x: izq, y: arriba, width: anchoUtil, height: altoUtil, fill: 'transparent' }, svg);
        const ver = (clienteX) => {
            const caja = svg.getBoundingClientRect();
            const rel = clienteX - caja.left - izq;
            const i = Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (rel / anchoUtil) * (n - 1))));
            cruz.setAttribute('x1', px(i)); cruz.setAttribute('x2', px(i)); cruz.setAttribute('visibility', 'visible');
            marca.setAttribute('cx', px(i)); marca.setAttribute('cy', py(valores[i])); marca.setAttribute('visibility', 'visible');
            mostrarTip(contenedor, tip, px(i), py(valores[i]), `<strong>${esc(etiquetas[i])}</strong><span>${esc(formato(valores[i]))}</span>`);
        };
        zona.addEventListener('mousemove', (e) => ver(e.clientX));
        zona.addEventListener('touchmove', (e) => ver(e.touches[0].clientX), { passive: true });
        zona.addEventListener('touchstart', (e) => ver(e.touches[0].clientX), { passive: true });
        zona.addEventListener('mouseleave', () => {
            tip.hidden = true;
            cruz.setAttribute('visibility', 'hidden');
            marca.setAttribute('visibility', 'hidden');
        });
    });
}

export const Graficas = { barras, linea };
window.Graficas = Graficas;
