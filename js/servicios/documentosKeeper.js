/** documentos */

const LOGO_COLOR = '../img/logo-keeper.png';
const LOGO_BLANCO = '../img/logo-blanco.png';
// foto por defecto
const avatarDefecto = () => window.AVATAR_DEFECTO;
const AZUL = [36, 115, 245];
const AZUL_OSCURO = [21, 93, 233];
const NOCHE = [10, 15, 28];
const GRIS = [100, 116, 139];

function jsPDFClase() {
    const clase = window.jspdf?.jsPDF;
    if (!clase) throw new Error('No se pudo cargar el generador de PDF. Revisa tu conexión a internet.');
    return clase;
}

function cargarImagen(src) {
    return new Promise((resolver, rechazar) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';           // necesario para usar fotos de Cloudinary en el PDF
        img.onload = () => resolver(img);
        img.onerror = () => rechazar(new Error('No se pudo cargar la imagen: ' + src));
        img.src = src;
    });
}

/** imagen a png */
async function imagenADataURL(src, { lado = 300, circular = false, fondo = null } = {}) {
    const img = await cargarImagen(src);
    const canvas = document.createElement('canvas');
    const ancho = circular ? lado : Math.round(lado * (img.width / img.height));
    canvas.width = ancho;
    canvas.height = lado;
    const ctx = canvas.getContext('2d');
    if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(0, 0, ancho, lado); }
    if (circular) {
        ctx.beginPath();
        ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
        ctx.clip();
        // recorte tipo "cover"
        const escala = Math.max(lado / img.width, lado / img.height);
        const w = img.width * escala, h = img.height * escala;
        ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
    } else {
        ctx.drawImage(img, 0, 0, ancho, lado);
    }
    return { dataURL: canvas.toDataURL('image/png'), proporcion: ancho / lado };
}

async function fotoPersona(persona) {
    const url = persona?.fotoUrlPersona;
    if (url) {
        try { return await imagenADataURL(url, { circular: true }); } catch (_) { /* se usa la de defecto */ }
    }
    try { return await imagenADataURL(avatarDefecto(), { circular: true }); } catch (_) { return null; }
}

// ── QR con logo al centro ────────────────────────────────────────────────────

/** contenido del qr */
export function contenidoQrPase(idPaseAcceso) {
    return JSON.stringify({ keeper: 'pase-acceso-qr', paseId: idPaseAcceso });
}

/** qr con logo */
export async function generarQrConLogo(texto, { lado = 600, color = '#0f172a', logo = LOGO_COLOR } = {}) {
    if (typeof window.QRCode !== 'function') throw new Error('No se pudo cargar el generador de códigos QR.');
    const temporal = document.createElement('div');
    new window.QRCode(temporal, {
        text: String(texto),
        width: lado,
        height: lado,
        colorDark: color,
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H
    });
    const qr = temporal.querySelector('canvas');
    if (!qr) throw new Error('El navegador no pudo dibujar el código QR.');

    const borde = Math.round(lado * 0.08);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = lado + borde * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qr, borde, borde);

    if (logo) {
        try {
            const img = await cargarImagen(logo);
            const caja = Math.round(lado * 0.22);
            const x = borde + (lado - caja) / 2;
            const r = caja * 0.18;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x + r, x);
            ctx.arcTo(x + caja, x, x + caja, x + caja, r);
            ctx.arcTo(x + caja, x + caja, x, x + caja, r);
            ctx.arcTo(x, x + caja, x, x, r);
            ctx.arcTo(x, x, x + caja, x, r);
            ctx.closePath();
            ctx.fill();
            const margen = caja * 0.12;
            const escala = Math.min((caja - margen * 2) / img.width, (caja - margen * 2) / img.height);
            const w = img.width * escala, h = img.height * escala;
            ctx.drawImage(img, x + (caja - w) / 2, x + (caja - h) / 2, w, h);
        } catch (_) {
            // Sin logo el QR sigue funcionando
        }
    }
    return canvas.toDataURL('image/png');
}

// ── Utilidades de formato ────────────────────────────────────────────────────

const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;

function fechaCorta(valor) {
    if (!valor) return '—';
    const texto = String(valor);
    const d = new Date(texto.length <= 10 ? `${texto}T12:00:00` : texto);
    if (Number.isNaN(d.getTime())) return texto;
    return d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fechaHoraLarga(d = new Date()) {
    return d.toLocaleString('es-SV', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function numeroDocumento(prefijo, id) {
    const hoy = fechaLocalISO().replace(/-/g, '');
    const corto = String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
    const hora = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    return `KPR-${prefijo}-${hoy}-${corto}-${hora}`;
}

function nombreArchivo(texto) {
    return String(texto || 'residente')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

// ── Reporte PDF de infracciones ──────────────────────────────────────────────

/** ficha en pdf */
export async function generarReporteInfracciones(ficha, emisor = 'Administración') {
    const jsPDF = jsPDFClase();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') throw new Error('No se pudo cargar el complemento de tablas del PDF.');

    const ancho = doc.internal.pageSize.getWidth();
    const M = 16;
    const numero = numeroDocumento('INF', ficha.persona.idPersona);
    const [logoBlanco, foto] = await Promise.all([
        imagenADataURL(LOGO_BLANCO, { lado: 200 }).catch(() => null),
        fotoPersona(ficha.persona)
    ]);

    // Encabezado
    doc.setFillColor(...NOCHE);
    doc.rect(0, 0, ancho, 34, 'F');
    doc.setFillColor(...AZUL);
    doc.rect(0, 34, ancho, 1.4, 'F');
    if (logoBlanco) doc.addImage(logoBlanco.dataURL, 'PNG', M, 8, 18 * logoBlanco.proporcion, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('KEEPER', M + 22, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Reporte de infracciones del residente', M + 22, 24);
    doc.setFontSize(8);
    doc.text(`Documento: ${numero}`, ancho - M, 15, { align: 'right' });
    doc.text(`Emitido: ${fechaHoraLarga()}`, ancho - M, 20, { align: 'right' });
    doc.text(`Emitido por: ${emisor}`, ancho - M, 25, { align: 'right' });

    // Datos del residente
    let y = 46;
    const p = ficha.persona;
    if (foto) doc.addImage(foto.dataURL, 'PNG', M, y, 30, 30);
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.8);
    doc.circle(M + 15, y + 15, 15.2, 'S');

    const x = M + 38;
    doc.setTextColor(...NOCHE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(ficha.nombre, x, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS);
    doc.text(`${p.tipoPersona || 'Residente'}${p.fechaEntradaColonia ? ` · Residente desde ${fechaCorta(p.fechaEntradaColonia)}` : ''}`, x, y + 12);

    const datos = [
        ['DUI', p.duiPersona || '—'],
        ['Teléfono', p.telefonoPersona || '—'],
        ['Correo', p.emailPersona || '—'],
        ['Propiedad', ficha.propiedades.map(pr => pr.descripcion).join(', ') || 'Sin propiedad asignada']
    ];
    let yd = y + 19;
    datos.forEach(([etiqueta, valor], i) => {
        const col = i % 2 === 0 ? x : x + 68;
        if (i % 2 === 0 && i > 0) yd += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRIS);
        doc.text(etiqueta.toUpperCase(), col, yd);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...NOCHE);
        const texto = doc.splitTextToSize(String(valor), i === 3 ? ancho - M - col : 64)[0];
        doc.text(texto, col, yd + 4);
    });

    // Resumen
    y = 86;
    const r = ficha.resumen;
    const cajas = [
        ['Infracciones', String(r.cantidad), NOCHE],
        ['Pendiente de pago', dinero(r.totalPendiente), [220, 38, 38]],
        ['Pagado', dinero(r.totalPagado), [22, 163, 74]],
        ['Total histórico', dinero(r.totalGeneral), AZUL_OSCURO]
    ];
    const anchoCaja = (ancho - M * 2 - 9) / 4;
    cajas.forEach(([etiqueta, valor, color], i) => {
        const cx = M + i * (anchoCaja + 3);
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, anchoCaja, 20, 2.5, 2.5, 'FD');
        doc.setFillColor(...color);
        doc.rect(cx, y + 3, 1.2, 14, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRIS);
        doc.text(etiqueta.toUpperCase(), cx + 5, y + 7.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...color);
        doc.text(valor, cx + 5, y + 15.5);
    });

    // Detalle
    y = 116;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NOCHE);
    doc.text('Detalle de infracciones', M, y);

    if (!ficha.infracciones.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...GRIS);
        doc.text('El residente no registra infracciones.', M, y + 9);
    } else {
        const coloresEstado = { Pendiente: [220, 38, 38], Pagada: [22, 163, 74], Impugnada: [217, 119, 6], Anulada: GRIS };
        doc.autoTable({
            startY: y + 4,
            margin: { left: M, right: M, top: 20, bottom: 20 },
            head: [['#', 'Fecha', 'Motivo', 'Lugar', 'Gravedad', 'Monto', 'Estado']],
            body: ficha.infracciones.map(i => [
                i.idInfraccion,
                fechaCorta(i.fecha),
                i.motivo,
                i.lugar || '—',
                i.gravedad ? i.gravedad.charAt(0).toUpperCase() + i.gravedad.slice(1) : '—',
                dinero(i.monto),
                i.estado
            ]),
            foot: [['', '', '', '', 'Total', dinero(r.totalGeneral), '']],
            styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.4, textColor: NOCHE, lineColor: [226, 232, 240], lineWidth: 0.2, valign: 'middle' },
            headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [241, 245, 249], textColor: NOCHE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 11, halign: 'center' },
                1: { cellWidth: 22 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 30 },
                4: { cellWidth: 20 },
                5: { cellWidth: 20, halign: 'right' },
                6: { cellWidth: 22, fontStyle: 'bold' }
            },
            didParseCell: (d) => {
                if (d.section === 'body' && d.column.index === 6) d.cell.styles.textColor = coloresEstado[d.cell.raw] || NOCHE;
            }
        });
    }

    // Pie en todas las páginas
    const paginas = doc.getNumberOfPages();
    const alto = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= paginas; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(M, alto - 14, ancho - M, alto - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRIS);
        doc.text(`Generado por Keeper con los datos registrados a la fecha de emisión · ${numero}`, M, alto - 9);
        doc.text(`Página ${i} de ${paginas}`, ancho - M, alto - 9, { align: 'right' });
    }

    doc.save(`reporte-infracciones-${nombreArchivo(ficha.nombre)}.pdf`);
    return numero;
}

// ── Tarjeta de acceso imprimible ─────────────────────────────────────────────

/** tarjeta para imprimir */
export async function generarTarjetaAcceso(ficha, pase) {
    if (!pase?.idPaseAcceso) throw new Error('El residente no tiene un pase de acceso vigente.');
    const jsPDF = jsPDFClase();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const anchoPagina = doc.internal.pageSize.getWidth();
    const W = 85.6, H = 54;
    const x0 = (anchoPagina - W) / 2;

    const [logoColor, logoBlanco, foto, qr] = await Promise.all([
        imagenADataURL(LOGO_COLOR, { lado: 200 }).catch(() => null),
        imagenADataURL(LOGO_BLANCO, { lado: 200 }).catch(() => null),
        fotoPersona(ficha.persona),
        generarQrConLogo(contenidoQrPase(pase.idPaseAcceso), { lado: 600 })
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NOCHE);
    doc.text('Tarjeta de acceso Keeper', anchoPagina / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text('Imprime al 100 % (tamaño real), en papel mate. Recorta por la línea punteada.', anchoPagina / 2, 24, { align: 'center' });

    const guia = (y) => {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([1.2, 1.2], 0);
        doc.rect(x0 - 1.5, y - 1.5, W + 3, H + 3, 'S');
        doc.setLineDashPattern([], 0);
    };

    // FRENTE
    let y = 36;
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text('FRENTE', x0, y - 4);
    guia(y);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x0, y, W, H, 3, 3, 'FD');
    // franja superior
    doc.setFillColor(...NOCHE);
    doc.roundedRect(x0, y, W, 11, 3, 3, 'F');
    doc.rect(x0, y + 6, W, 5, 'F');
    if (logoBlanco) doc.addImage(logoBlanco.dataURL, 'PNG', x0 + 4, y + 2, 7 * logoBlanco.proporcion, 7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('KEEPER', x0 + 12, y + 7.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('TARJETA DE ACCESO', x0 + W - 4, y + 7, { align: 'right' });
    doc.setFillColor(...AZUL);
    doc.rect(x0, y + 11, W, 0.8, 'F');

    // foto y datos
    if (foto) doc.addImage(foto.dataURL, 'PNG', x0 + 4, y + 15, 16, 16);
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.5);
    doc.circle(x0 + 12, y + 23, 8.1, 'S');
    const tx = x0 + 4;
    doc.setTextColor(...NOCHE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lineasNombre = doc.splitTextToSize(ficha.nombre, 44).slice(0, 2);
    doc.text(lineasNombre, tx, y + 36);
    let ty = y + 36 + lineasNombre.length * 3.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(String(ficha.persona.tipoPersona || 'Residente').toUpperCase(), tx, ty);
    ty += 3.4;
    const pr = ficha.propiedades[0];
    const propiedad = pr ? ([pr.codigo, pr.calle].filter(Boolean).join(' · ') || pr.descripcion) : 'Sin propiedad asignada';
    doc.setTextColor(...NOCHE);
    doc.text(doc.splitTextToSize(propiedad, 44)[0], tx, ty);
    ty += 3.4;
    doc.setTextColor(...AZUL_OSCURO);
    doc.setFont('helvetica', 'bold');
    doc.text(`Válida hasta ${fechaCorta(pase.duracionPase)}`, tx, Math.min(ty, y + H - 3));

    // QR
    const lqr = 33;
    doc.addImage(qr, 'PNG', x0 + W - lqr - 3, y + 14, lqr, lqr);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...GRIS);
    doc.text('Presenta este código en la caseta', x0 + W - 3 - lqr / 2, y + H - 3.5, { align: 'center' });

    // REVERSO
    y = 36 + H + 20;
    doc.setFontSize(8);
    doc.text('REVERSO', x0, y - 4);
    guia(y);
    doc.setFillColor(...NOCHE);
    doc.roundedRect(x0, y, W, H, 3, 3, 'F');
    if (logoColor) doc.addImage(logoColor.dataURL, 'PNG', x0 + W / 2 - 7 * logoColor.proporcion, y + 6, 14 * logoColor.proporcion, 14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Tarjeta personal e intransferible', x0 + W / 2, y + 27, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(203, 213, 225);
    const reglas = [
        'Si la pierdes, avisa a la administración para desactivarla',
        'y emitir una nueva. La tarjeta anterior dejará de funcionar.',
        'Si encuentras esta tarjeta, entrégala en la caseta de vigilancia.'
    ];
    reglas.forEach((linea, i) => doc.text(linea, x0 + W / 2, y + 34 + i * 4, { align: 'center' }));
    doc.setFillColor(...AZUL);
    doc.rect(x0, y + H - 6, W, 0.8, 'F');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emitida el ${fechaCorta(fechaLocalISO())}`, x0 + W / 2, y + H - 2.3, { align: 'center' });

    doc.save(`tarjeta-acceso-${nombreArchivo(ficha.nombre)}.pdf`);
}

export const DocumentosKeeper = { generarReporteInfracciones, generarTarjetaAcceso, generarQrConLogo, contenidoQrPase };
window.DocumentosKeeper = DocumentosKeeper;
export default DocumentosKeeper;
