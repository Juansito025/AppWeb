/** documentos */

const LOGO_COLOR = '../img/logo-keeper.png';
const LOGO_BLANCO = '../img/logo-blanco.png';
// foto por defecto
const avatarDefecto = () => window.AVATAR_DEFECTO;
const AZUL = [36, 115, 245];
const AZUL_OSCURO = [21, 93, 233];
const NOCHE = [10, 15, 28];
const GRIS = [82, 82, 91];

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
    doc.setFillColor(23, 76, 155);
    doc.rect(0, 0, ancho, 34, 'F');
    doc.setFillColor(36, 115, 245);
    doc.triangle(0, 0, 118, 0, 0, 34, 'F');
    doc.setFillColor(14, 165, 233);
    doc.triangle(ancho, 0, ancho - 34, 0, ancho, 22, 'F');
    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(.35);
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

    // Datos del residente
    let y = 46;
    const p = ficha.persona;
    if (foto) doc.addImage(foto.dataURL, 'PNG', M, y, 30, 30);
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...NOCHE); doc.text((ficha.nombre || 'R').trim().charAt(0).toUpperCase(), M + 15, y + 18, { align: 'center' }); }
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
        if (i % 2 === 0 && i > 0) yd += 14;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GRIS);
        doc.text(etiqueta.toUpperCase(), col, yd);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...NOCHE);
        const texto = doc.splitTextToSize(String(valor), i === 3 ? ancho - M - col : 64).slice(0, 3);
        doc.text(texto, col, yd + 4);
    });

    // Resumen
    y = Math.max(94, yd + 18);
    const r = ficha.resumen;
    const cajas = [
        ['Infracciones', String(r.cantidad), NOCHE],
        ['Pendiente de pago', dinero(r.totalPendiente), AZUL],
        ['Pagado', dinero(r.totalPagado), AZUL],
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
        doc.setTextColor(...NOCHE);
        doc.text(valor, cx + 5, y + 15.5);
    });

    // Detalle
    y += 30;
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
            showFoot: 'lastPage',
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
                if (d.section === 'body' && d.column.index === 6) d.cell.styles.textColor = NOCHE;
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
        doc.text(`Página ${i} de ${paginas}`, ancho - M, alto - 9, { align: 'right' });
    }

    doc.save(`reporte-infracciones-${nombreArchivo(ficha.nombre)}.pdf`);
    return numero;
}

// ── Tarjeta de acceso imprimible ─────────────────────────────────────────────

/** tarjeta para imprimir */
export async function generarTarjetaAcceso(ficha, pase) {
    if (!pase?.idPaseAcceso) throw new Error('El residente no tiene un pase de acceso vigente.');
    const Doc = jsPDFClase();
    const doc = new Doc({ unit: 'mm', format: 'a4' });
    const W = 54, H = 85.6, y = 42, frente = 42, reverso = 114;
    const [logo, foto, qr] = await Promise.all([
        imagenADataURL('../img/llave-keeper-blanca.png', { lado: 200 }).catch(() => null),
        fotoPersona(ficha.persona),
        generarQrConLogo(contenidoQrPase(pase.idPaseAcceso), { lado: 600, color: '#0f172a', logo: null })
    ]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...NOCHE);
    doc.text('Credencial personal del residente', 105, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text('Imprimir al 100 %. Recortar y montar ambas caras. No ajustar a la página.', 105, 28, { align: 'center' });
    const cara = (x, etiqueta) => {
        doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(etiqueta, x, y - 4);
        doc.setDrawColor(148, 163, 184); doc.setLineWidth(.2); doc.setLineDashPattern([1, 1], 0);
        doc.rect(x - 1.5, y - 1.5, W + 3, H + 3, 'S'); doc.setLineDashPattern([], 0);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(203, 213, 225); doc.roundedRect(x, y, W, H, 2, 2, 'FD');
        doc.setFillColor(...AZUL); doc.rect(x, y, W, 22, 'F');
        doc.setFillColor(186, 230, 253); doc.triangle(x, y + 22, x + 20, y + 22, x, y + 37, 'F');
        doc.setFillColor(14, 165, 233); doc.triangle(x + W, y + 7, x + W - 14, y + 22, x + W, y + 22, 'F');
    };
    cara(frente, 'FRENTE');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text('KEEPER', frente + W / 2, y + 8, { align: 'center' });
    doc.setFillColor(255, 255, 255); doc.circle(frente + W / 2, y + 25, 11.5, 'F');
    if (foto) doc.addImage(foto.dataURL, 'PNG', frente + W / 2 - 10, y + 15, 20, 20);
    else { doc.setTextColor(...NOCHE); doc.setFontSize(16); doc.text((ficha.nombre || 'R').trim().charAt(0).toUpperCase(), frente + W / 2, y + 27, { align: 'center' }); }
    doc.setDrawColor(186, 230, 253); doc.setLineWidth(.6); doc.circle(frente + W / 2, y + 25, 10.8, 'S');
    doc.setTextColor(...NOCHE); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(ficha.nombre, W - 8).slice(0, 2), frente + W / 2, y + 41, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
    doc.text(String(ficha.persona.tipoPersona || 'Residente').toUpperCase(), frente + W / 2, y + 49, { align: 'center' });
    const campo = (etiqueta, valor, top, lineas = 1) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...GRIS); doc.text(etiqueta, frente + 5, y + top);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NOCHE);
        doc.text(doc.splitTextToSize(String(valor || 'No registrado'), W - 10).slice(0, lineas), frente + 5, y + top + 3.5);
    };
    const direccion = ficha.propiedades.map(pr => [pr.codigo, pr.calle].filter(Boolean).join(' · ') || pr.descripcion).filter(Boolean).join('; ');
    campo('TELÉFONO', ficha.persona.telefonoPersona, 55);
    campo('DIRECCIÓN', direccion || 'Sin propiedad asignada', 64, 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.7); doc.setTextColor(...GRIS);
    doc.text('INGRESO', frente + 5, y + 77); doc.text('VENCIMIENTO', frente + 31, y + 77);
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(.25);
    doc.line(frente + 27, y + 74.5, frente + 27, y + 82);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...NOCHE);
    doc.text(fechaCorta(ficha.persona.fechaEntradaColonia), frente + 5, y + 81);
    doc.text(fechaCorta(pase.duracionPase), frente + 31, y + 81);
    cara(reverso, 'REVERSO');
    if (logo) doc.addImage(logo.dataURL, 'PNG', reverso + W / 2 - 5 * logo.proporcion, y + 3, 10 * logo.proporcion, 10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text('KEEPER', reverso + W / 2, y + 18, { align: 'center' });
    doc.addImage(qr, 'PNG', reverso + 7, y + 26, 40, 40);
    doc.setTextColor(...NOCHE); doc.setFontSize(6.8); doc.text('PERSONAL E INTRANSFERIBLE', reverso + W / 2, y + 71, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3);
    doc.text(doc.splitTextToSize('Uso exclusivo del titular. No compartas esta credencial ni su QR. En caso de pérdida, avisa a la administración.', W - 10), reverso + W / 2, y + 76, { align: 'center' });
    doc.setTextColor(...GRIS); doc.setFontSize(8);
    doc.text('El QR es una credencial de acceso. Conserva este documento de forma privada.', 105, y + H + 13, { align: 'center' });
    doc.save(`tarjeta-acceso-${nombreArchivo(ficha.nombre)}.pdf`);
}

export const DocumentosKeeper = { generarReporteInfracciones, generarTarjetaAcceso, generarQrConLogo, contenidoQrPase };
window.DocumentosKeeper = DocumentosKeeper;
export default DocumentosKeeper;
