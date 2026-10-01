/** tema de sweetalert */
(function temaSweetAlert() {
    function luminancia(color) {
        const hex = String(color || '').trim().replace('#', '');
        if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
        const h = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const esClaro = () => document.body && document.body.getAttribute('data-theme') === 'light';

    function ajustar(opciones) {
        if (!opciones || typeof opciones !== 'object') return opciones;
        const p = { ...opciones };
        const claro = esClaro();
        const lumFondo = luminancia(p.background);
        const lumTexto = luminancia(p.color);
        if (claro) {
            if (!p.background || (lumFondo !== null && lumFondo < 0.5)) p.background = '#ffffff';
            if (!p.color || (lumTexto !== null && lumTexto > 0.6)) p.color = '#0f172a';
        } else {
            if (!p.background || (lumFondo !== null && lumFondo > 0.5)) p.background = '#0a0f1c';
            if (!p.color || (lumTexto !== null && lumTexto < 0.4)) p.color = '#ffffff';
        }
        const clases = { ...(p.customClass || {}) };
        clases.popup = `${clases.popup || ''} keeper-swal ${claro ? 'keeper-swal-claro' : 'keeper-swal-oscuro'}`.trim();
        p.customClass = clases;
        return p;
    }

    function instalar() {
        const S = window.Swal;
        if (!S || S.__keeperTema) return;
        const fireOriginal = S.fire.bind(S);
        S.fire = function (...args) {
            if (typeof args[0] === 'string') {
                return fireOriginal(ajustar({ title: args[0], html: args[1], icon: args[2] }));
            }
            return fireOriginal(ajustar(args[0]), ...args.slice(1));
        };
        if (typeof S.mixin === 'function') {
            const mixinOriginal = S.mixin.bind(S);
            S.mixin = function (base = {}) {
                const M = mixinOriginal(base);
                const fireMixin = M.fire.bind(M);
                M.fire = (extra = {}) => fireMixin(ajustar({ ...base, ...(typeof extra === 'object' ? extra : { title: extra }) }));
                return M;
            };
        }
        S.__keeperTema = true;
    }

    instalar();
    document.addEventListener('DOMContentLoaded', instalar);
    window.__keeperAjustarSwal = ajustar;
})();

/** foto por defecto */
window.AVATAR_DEFECTO = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
    '<rect width="40" height="40" rx="20" fill="#1a2238"/>' +
    '<g transform="translate(8 8)" fill="none" stroke="#2473F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g></svg>'
);


function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
(function () {
    let lockCount = 0;
    let savedScrollY = 0;

    window.bloqueoDesplazamiento = {
        lock: function () {
            if (lockCount === 0) {
                savedScrollY = window.scrollY || window.pageYOffset || 0;
                document.body.style.top = `-${savedScrollY}px`;
                document.body.classList.add('bloqueo-desplazamiento');
            }
            lockCount++;
        },
        unlock: function () {
            lockCount = Math.max(0, lockCount - 1);
            if (lockCount === 0) {
                document.body.classList.remove('bloqueo-desplazamiento');
                document.body.style.top = '';
                window.scrollTo(0, savedScrollY);
            }
        }
    };
})();

function setMode(mode, animate = true) {
    const btnDark  = document.getElementById('btn-oscuro');
    const btnLight = document.getElementById('btn-claro');
    
    if (btnDark && btnLight) {
        btnDark.classList.toggle('activo', mode === 'dark');
        btnLight.classList.toggle('activo', mode === 'light');
    }
    
    const currentMode = document.body.getAttribute('data-theme') || 'dark';
    
    if (animate && currentMode !== mode) {
        playThemeTransition(mode);
    }
    
    document.body.setAttribute('data-theme', mode);
    sessionStorage.setItem('theme', mode);
    
    
    const logos = document.querySelectorAll('.caja-icono-logotipo img.logo, .caja-icono-logo img.logo, .superior-logo img.logo, .superior-logo img, .envoltura-logotipo img, .logotipo-registro, .logotipo-completo, .logotipo-pie-pagina');
    logos.forEach(logo => {
        if (mode === 'light') {
            logo.src = logo.src.replace('logo-blanco.png', 'logo-keeper.png');
        } else {
            logo.src = logo.src.replace('logo-keeper.png', 'logo-blanco.png');
        }
    });
}

function playThemeTransition(mode) {
    const isLight = (mode === 'light');
    const pathLower = window.location.pathname.toLowerCase();
    const isInRoot = pathLower.endsWith('index.html') || pathLower === '/' || !pathLower.includes('/html/');
    const pathPrefix = isInRoot ? './img/' : '../img/';
    
    const logoImg = isLight ? 'logo-keeper.png' : 'logo-blanco.png';
    const iconImg = isLight ? 'sol.png' : 'luna.png';
    const bgColor = isLight 
        ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%)' 
        : '#0a0f1c';
    const textColor = '#ffffff';
    const glowColor = isLight ? '#ffffffd9' : '#2473f5b3';
    
    const capa = document.createElement('div');
    capa.style.position = 'fixed';
    capa.style.top = '0'; capa.style.left = '0';
    capa.style.width = '100vw'; capa.style.height = '100vh';
    capa.style.background = bgColor;
    capa.style.zIndex = '999999';
    capa.style.display = 'flex';
    capa.style.flexDirection = 'column';
    capa.style.alignItems = 'center';
    capa.style.justifyContent = 'center';
    capa.style.opacity = '0';
    capa.style.transition = 'opacity 0.4s ease-in-out';
    capa.style.overflow = 'hidden';
    
    
    capa.innerHTML = `
        <div class="tema-transicion-contenedor" style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
            
            <!-- Expanding glow ring -->
            <div id="tema-ring" style="position: absolute; width: 10px; height: 10px; border-radius: 50%; background: ${escapeHtml(glowColor)}; opacity: 0; filter: blur(30px);"></div>
            
            <!-- Main icon (Sun or Moon) -->
            <img id="tema-icono" src="${escapeHtml(pathPrefix)}${escapeHtml(iconImg)}" alt="Mode" style="width: 140px; height: 140px; object-fit: contain; z-index: 2; opacity: 0; transform: translateY(-50px) scale(0.5); filter: drop-shadow(0 0 25px ${escapeHtml(glowColor)});">
            
            <!-- Logo appearing below -->
            <div id="tema-logo-envoltura" style="margin-top: 30px; opacity: 0; transform: translateY(30px); display: flex; align-items: center; gap: 15px;">
                <img src="${escapeHtml(pathPrefix)}${escapeHtml(logoImg)}" alt="Keeper" style="width: 60px; height: 60px; object-fit: contain;">
                <span style="font-family: 'Figtree', sans-serif; font-size: 32px; font-weight: 700; color: ${escapeHtml(textColor)}; letter-spacing: 2px;">KEEPER</span>
            </div>
            
        </div>
    `;
    
    document.body.appendChild(capa);
    
    
    requestAnimationFrame(() => {
        
        capa.style.opacity = '1';
        
        const ring = capa.querySelector('#tema-ring');
        const icon = capa.querySelector('#tema-icono');
        const logo = capa.querySelector('#tema-logo-envoltura');
        
        
        ring.animate([
            { transform: 'scale(1)', opacity: 0.8 },
            { transform: 'scale(150)', opacity: 0 }
        ], { duration: 1000, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
        
        
        icon.animate([
            { transform: 'translateY(-150px) scale(0.5) rotate(-45deg)', opacity: 0 },
            { transform: 'translateY(20px) scale(1.1) rotate(10deg)', opacity: 1, offset: 0.6 },
            { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 }
        ], { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards', delay: 100 });
        
        
        logo.animate([
            { transform: 'translateY(40px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
        ], { duration: 600, easing: 'ease-out', fill: 'forwards', delay: 400 });
        
        
        setTimeout(() => {
            capa.style.opacity = '0';
            setTimeout(() => capa.remove(), 400);
        }, 1600);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = sessionStorage.getItem('theme') || 'dark';
    setMode(savedTheme, false);

    const btnDark = document.getElementById('btn-oscuro');
    const btnLight = document.getElementById('btn-claro');
    if (btnDark) btnDark.addEventListener('click', () => setMode('dark'));
    if (btnLight) btnLight.addEventListener('click', () => setMode('light'));

    // ==================== SEGURIDAD Y CONTROL DE ROLES ====================
    const pathLower = window.location.pathname.toLowerCase();
    const pageName = pathLower.split('/').pop() || 'index.html';
    
    // cargar sesion
    let activeUser = null;
    try {
        let rawSession = sessionStorage.getItem('keeper_sesion') || sessionStorage.getItem('KEEPER_CURRENT_USER');
        const esPublica = ['index.html', 'recuperar-contrasena.html', 'registrarse.html'].some(p => pageName.endsWith(p));
        // recuperar la sesion
        if (!rawSession && !esPublica && window.CredentialsStore && typeof window.CredentialsStore.verificarSesion === 'function') {
            try {
                const me = await window.CredentialsStore.verificarSesion();
                if (me) {
                    const partes = String(me.nombreCompleto || '').trim().split(/\s+/);
                    rawSession = JSON.stringify({
                        id: me.id || me.idUsuario, email: me.username || me.correo,
                        firstName: partes[0] || 'Usuario', lastName: partes.slice(1).join(' '),
                        role: me.rol, rol: me.rol, type: me.tipoUsuario
                    });
                    sessionStorage.setItem('keeper_sesion', rawSession);
                }
            } catch (_) { /* sin respuesta */ }
        }

        // sin sesion ir al login
        if (!rawSession && !['index.html', 'recuperar-contrasena.html', 'registrarse.html'].some(p => pageName.endsWith(p))) {
            const destinoLogin = pathLower.includes('/html/') ? '../Index.html' : './Index.html';
            window.location.href = destinoLogin;
            return;
        }

        if (rawSession) {
            try {
                const parsed = typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;
                if (parsed && typeof parsed === 'object') {
                    activeUser = {
                        id: parsed.id || parsed.idEmpleado || '',
                        email: parsed.email || parsed.correoEmpleado || '',
                        firstName: parsed.firstName || parsed.nombreEmpleado || '',
                        lastName: parsed.lastName || parsed.apellidoEmpleado || '',
                        role: (parsed.role || parsed.rol || '').toLowerCase(),
                        type: 'EMPLEADO',
                        foto: parsed.foto || parsed.fotoUrlEmpleado || parsed.fotoEmpleado || ''
                    };
                    // actualizar datos
                    sessionStorage.setItem('keeper_sesion', JSON.stringify(activeUser));
                }
            } catch {
                activeUser = null;
            }
        }
    } catch (e) {
        console.error("Error cargando sesión:", e);
    }

    // validar sesion
    const esPaginaPublica = ['index.html', 'recuperar-contrasena.html', 'registrarse.html', 'pantalla-carga.html'].some(p => pageName.endsWith(p));
    // paginas de administrador
    const PAGINAS_SOLO_ADMIN = ['estadisticas.html', 'ficha-residente.html', 'propiedades.html', 'casetas.html', 'empleados.html', 'residentes.html', 'turnos.html'];
    const irAlLoginComun = (mensaje) => {
        if (window.limpiarSesionLocal) window.limpiarSesionLocal();
        if (mensaje) { try { sessionStorage.setItem('keeper_aviso_login', mensaje); } catch (_) {} }
        window.location.href = pathLower.includes('/html/') ? '../Index.html' : './Index.html';
    };
    const revisarSesion = (inicial) => window.CredentialsStore.verificarSesion().then(me => {
        if (!me) {
            irAlLoginComun(inicial ? '' : 'Tu sesión expiró. Vuelve a iniciar sesión.');
            return;
        }
        const rol = String(me.rol || '').toUpperCase().replace(/^ROLE_/, '');
        if (rol !== 'ADMINISTRADOR' && PAGINAS_SOLO_ADMIN.some(p => pageName.endsWith(p))) {
            window.location.href = './dashboard.html';
        }
    }).catch((err) => {
        if (err && (err.status === 401 || err.status === 403)) {
            irAlLoginComun('Tu sesión expiró. Vuelve a iniciar sesión.');
        }
    });

    if (!esPaginaPublica && window.CredentialsStore && typeof window.CredentialsStore.verificarSesion === 'function') {
        revisarSesion(true);
        // revisar la sesion periodicamente y al volver a la pestaña
        setInterval(() => { if (document.visibilityState === 'visible') revisarSesion(false); }, 30000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisarSesion(false); });
        window.addEventListener('focus', () => { if (document.visibilityState === 'visible') revisarSesion(false); });
    }

    async function cargarFotoUsuarioSesion(user) {
        const avatarEl = document.querySelector('.cabecera-usuario .avatar');
        if (!avatarEl) return;

        const userId = user?.id;
        const userEmail = (user?.email || '').toLowerCase().trim();
        let userPhoto = '';

        if (userId) {
            userPhoto = sessionStorage.getItem('empleado_foto_' + userId) || '';
        }
        if (!userPhoto && userEmail) {
            userPhoto = sessionStorage.getItem('empleado_foto_' + userEmail) || '';
        }
        if (!userPhoto) {
            userPhoto = user?.foto || user?.fotoUrlEmpleado || user?.fotoEmpleado || '';
        }

        if (!userPhoto && (userId || userEmail) && typeof apiFetch === 'function') {
            try {
                const emps = await apiFetch('/empleados', { silencioso: true }).catch(() => []);
                if (Array.isArray(emps)) {
                    const emp = emps.find(e => 
                        (userId && String(e.idEmpleado || e.id) === String(userId)) ||
                        (userEmail && (e.correoEmpleado || '').toLowerCase().trim() === userEmail)
                    );
                    if (emp && (emp.fotoUrlEmpleado || emp.fotoEmpleado)) {
                        userPhoto = emp.fotoUrlEmpleado || emp.fotoEmpleado;
                        if (userId) sessionStorage.setItem('empleado_foto_' + userId, userPhoto);
                        if (userEmail) sessionStorage.setItem('empleado_foto_' + userEmail, userPhoto);
                    }
                }
            } catch (e) {
                // ignorar
            }
        }

        if (userPhoto) {
            if (avatarEl.tagName && avatarEl.tagName.toLowerCase() === 'svg') {
                const img = document.createElement('img');
                img.className = 'avatar';
                img.src = userPhoto;
                img.alt = 'Foto de perfil';
                img.style.cssText = 'width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid #2473f599;';
                avatarEl.parentNode.replaceChild(img, avatarEl);
            } else {
                avatarEl.src = userPhoto;
                avatarEl.style.cssText = 'width:40px; height:40px; border-radius:50%; object-fit:cover; border: 2px solid #2473f599;';
            }
        } else {
            // avatar por defecto
            if (avatarEl.tagName && avatarEl.tagName.toLowerCase() === 'img') {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('class', 'avatar');
                svg.setAttribute('width', '40');
                svg.setAttribute('height', '40');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '1.5');
                svg.setAttribute('stroke-linecap', 'round');
                svg.setAttribute('stroke-linejoin', 'round');
                svg.style.cssText = 'color:#2473F5;background:#1c1f2e;border-radius:50%;padding:6px;';
                svg.innerHTML = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
                avatarEl.parentNode.replaceChild(svg, avatarEl);
            }
        }

        // cambio de foto
    }

    const publicPages = ['index.html', 'recuperar-contrasena.html', 'registrarse.html', 'pantalla-carga.html'];
    const isPublic = publicPages.some(p => pageName.endsWith(p)) || pageName === '';
    
    // sin sesion ir al login
    if (!isPublic && !activeUser) {
        const destinoLogin2 = pathLower.includes('/html/') ? '../Index.html' : './Index.html';
        window.location.href = destinoLogin2;
        return;
    }

    if (activeUser) {
        const role = String(activeUser.role || activeUser.rol || 'Administrador').toLowerCase().trim();
        const isGuard = role.includes('guard') || role.includes('vigilant') || role === 'empleado';
        
        // Actualizar nombres del usuario en la barra lateral
        const usernameEl = document.querySelector('.nombre-usuario');
        if (usernameEl) {
            usernameEl.textContent = (activeUser.firstName + ' ' + activeUser.lastName).trim() || 'Usuario';
        }
        const welcomeEl = document.querySelector('.bienvenido');
        if (welcomeEl) {
            welcomeEl.innerHTML = `Bienvenido de vuelta,<br>${escapeHtml((activeUser.firstName + ' ' + activeUser.lastName).trim() || 'Usuario')}`;
        }
        
        // foto de perfil
        cargarFotoUsuarioSesion(activeUser);

        window.addEventListener('fotoPerfilActualizada', function () {
            const rawSes = sessionStorage.getItem('keeper_sesion');
            if (rawSes) {
                try {
                    const u = JSON.parse(rawSes);
                    cargarFotoUsuarioSesion(u);
                } catch (e) {}
            }
        });
        
        // secciones del menu
        agregarOpcionesMenu(pageName);

        // Si el usuario es Guardia / Vigilante, ocultar módulos de administración
        if (isGuard) {
            const menuItems = document.querySelectorAll('.menu-seleccion ul li');
            menuItems.forEach(li => {
                const text = li.textContent.trim().toLowerCase();
                const allowed = ['panel principal', 'escanear entrada qr', 'escanear qr', 'notificaciones', 'registrar visita', 'reportar incidente', 'reportar infracción', 'infracciones'];
                const isAllowed = allowed.some(a => text.includes(a));
                if (!isAllowed) {
                    li.style.display = 'none';
                }
            });
            
            // Redirigir si intenta acceder a páginas administrativas protegidas
            const restrictedPages = [
                'estadisticas.html',
                'ficha-residente.html',
                'propiedades.html',
                'casetas.html',
                'empleados.html',
                'residentes.html',
                'turnos.html'
            ];
            const isRestricted = restrictedPages.some(p => pageName.endsWith(p));
            if (isRestricted) {
                window.location.href = './dashboard.html';
            }
        }
    }
});

/** menu de estadisticas */
function agregarOpcionesMenu(pageName) {
    const lista = document.querySelector('.menu-seleccion ul');
    if (!lista || lista.dataset.opcionesExtra) return;
    lista.dataset.opcionesExtra = '1';
    const opciones = [
        {
            despuesDe: 'dashboard.html',
            href: './estadisticas.html',
            texto: 'Estadísticas',
            icono: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
        }
    ];
    opciones.forEach(op => {
        const archivo = op.href.replace('./', '');
        if (lista.querySelector(`a[href$="${archivo}"]`)) return;
        const li = document.createElement('li');
        if (pageName.endsWith(archivo)) {
            lista.querySelectorAll('li.estado-a').forEach(x => x.classList.remove('estado-a'));
            li.className = 'estado-a';
        }
        li.innerHTML = `<a href="${op.href}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icono-menu">${op.icono}</svg>${op.texto}</a>`;
        const ancla = lista.querySelector(`a[href$="${op.despuesDe}"]`)?.closest('li');
        if (ancla) ancla.after(li); else lista.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const barraLateral = document.querySelector('.barra-lateral');
    const menuBtn = document.getElementById('movil-menu-btn');
    const capa = document.getElementById('movil-capa');
    
    if (!barraLateral || !menuBtn || !capa) return;

    function openMenu() {
        barraLateral.classList.add('abrir');
        capa.classList.add('activo');
        menuBtn.setAttribute('aria-expanded', 'true');
        window.bloqueoDesplazamiento.lock();
    }

    function closeMenu() {
        barraLateral.classList.remove('abrir');
        capa.classList.remove('activo');
        menuBtn.setAttribute('aria-expanded', 'false');
        window.bloqueoDesplazamiento.unlock();
    }

    function toggleMenu() {
        if (barraLateral.classList.contains('abrir')) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    menuBtn.addEventListener('click', toggleMenu);
    capa.addEventListener('click', closeMenu);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && barraLateral.classList.contains('abrir')) {
            closeMenu();
        }
    });

    
    window.addEventListener('resize', function () {
        if (window.innerWidth > 1100 && barraLateral.classList.contains('abrir')) {
            closeMenu();
        }
    });
    
    
    function actualizarColorCampana() {
        if (typeof NotificacionesStore === 'undefined') return;
        
        const unread = NotificacionesStore.getAll().filter(n => !n.leida);
        if (unread.length === 0) return; 
        
        
        const notifMenu = Array.from(document.querySelectorAll('.barra-lateral li')).find(li => 
            li.textContent.includes('Notificaciones') || 
            (li.getAttribute('onclick') && li.getAttribute('onclick').includes('notificaciones.html'))
        );
        
        if (!notifMenu) return;
        const svg = notifMenu.querySelector('svg');
        if (!svg) return;
        
        
        const hasUrgente = unread.some(n => n.tipo === 'urgente');
        const hasAlerta = unread.some(n => n.tipo === 'alerta');
        
        
        svg.style.color = '';
        svg.style.filter = '';
        
        if (hasUrgente) {
            svg.style.color = '#ef4444'; 
            svg.style.filter = 'drop-shadow(0 0 8px #ef444499)';
        } else if (hasAlerta) {
            svg.style.color = '#f59e0b'; 
            svg.style.filter = 'drop-shadow(0 0 8px #f59e0b99)';
        } else {
            svg.style.color = '#2473F5'; 
            svg.style.filter = 'drop-shadow(0 0 8px #2473f599)';
        }
    }
    
    window.actualizarColorCampana = actualizarColorCampana;
    
    
    if (typeof NotificacionesStore !== 'undefined') {
        actualizarColorCampana();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const modal           = document.getElementById('modal-cerrar-sesion') || document.getElementById('modal-cerrar-Sesión');
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion') || document.getElementById('btn-cerrar-Sesión');
    const btnCancelar     = document.getElementById('boton-cancelar');
    const btnAceptar      = document.getElementById('boton-aceptar');

    
    if (!modal || !btnCerrarSesion) return;

    btnCerrarSesion.addEventListener('click', () => {
        modal.classList.add('activo');
    });

    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            modal.classList.remove('activo');
        });
    }

    if (btnAceptar) {
        btnAceptar.addEventListener('click', async () => {
            btnAceptar.disabled = true;
            // cerrar sesion
            if (window.CredentialsStore && typeof window.CredentialsStore.cerrarSesion === 'function') {
                await window.CredentialsStore.cerrarSesion();
            } else {
                sessionStorage.clear();
                window.location.href = '../Index.html';
            }
        });
    }

    
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.remove('activo');
        }
    });
});

document.addEventListener('input', function (e) {
    const input = e.target;
    if (!input || input.tagName !== 'INPUT') return;

    const id = (input.id || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const type = (input.type || '').toLowerCase();

    const esNombrePropiedadOCodigo = id.includes('propiedad') || id.includes('property') || id.includes('turno') || id.includes('caseta') || id.includes('Código') || id.includes('Dirección') || id.includes('calle') || id.includes('agregar-nombre') || id.includes('detalle-nombre');
    if (!esNombrePropiedadOCodigo && (id.includes('name') || id.includes('nombre') || id.includes('apellido') || name.includes('nombre') || name.includes('apellido'))) {
        const cursor = input.selectionStart;
        const valPrev = input.value;
        const valClean = valPrev.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        if (valPrev !== valClean) {
            input.value = valClean;
            input.setSelectionRange(cursor - 1, cursor - 1);
        }
    }

    if (type === 'tel' || id.includes('phone') || id.includes('Teléfono') || id.includes('tel')) {
        let val = input.value.replace(/\D/g, '').slice(0, 8);
        if (val.length > 4) {
            val = val.slice(0, 4) + '-' + val.slice(4);
        }
        input.value = val;
    }

    const esCampoDuiEstricto = (id.includes('dui') || name.includes('dui') || placeholder.includes('00000000-0')) 
        && !id.includes('correo') && !id.includes('email') && !placeholder.includes('correo') && !placeholder.includes('email') && !name.includes('correo');

    if (esCampoDuiEstricto) {
        let val = input.value.replace(/\D/g, '').slice(0, 9);
        if (val.length > 8) {
            val = val.slice(0, 8) + '-' + val.slice(8);
        }
        input.value = val;
    }

    if (id.includes('Matrícula') || id.includes('placa') || name.includes('Matrícula') || name.includes('placa') || placeholder.includes('matrícula') || placeholder.includes('Matrícula') || placeholder.includes('placa')) {
        let val = input.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 10);
        input.value = val;
    }

    if (id.includes('costo') || id.includes('precio') || id.includes('price')) {
        let val = input.value.replace(/[^0-9.]/g, '');
        const parts = val.split('.');
        if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
        if (parts[0] && parts[0].length > 6) {
            parts[0] = parts[0].slice(0, 6);
            val = parts.join('.');
        }
        input.value = val;
    }
});

document.addEventListener('click', function (e) {
    const btn = e.target.closest('.icono-boton, .panel-entrada-icono-btn, .alternar-Contraseña-btn, [data-target]');
    if (!btn) return;

    const targetId = btn.dataset.target || (btn.previousElementSibling && btn.previousElementSibling.id);
    const targetInput = targetId ? document.getElementById(targetId) : null;

    if (targetInput && (targetInput.type === 'password' || targetInput.type === 'text')) {
        e.preventDefault();
        const willBeVisible = targetInput.type === 'password';
        targetInput.type = willBeVisible ? 'text' : 'password';

        btn.innerHTML = willBeVisible
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2473F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ojo-cerrado"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8892a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ojo-abierto"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
});

/** notificacion */
function mostrarAlertaNotificacion(mensaje, tipo = 'warning', Título = '') {
    const titulosDefault = {
        error: 'Atención / Error',
        success: '¡Operación exitosa!',
        warning: 'Verifique los datos',
        info: 'Información'
    };

    const tituloFinal = Título || titulosDefault[tipo] || 'Notificación';
    const isLight = document.body.getAttribute('data-theme') === 'light';

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: tituloFinal,
            text: mensaje,
            icon: tipo, // 'error', 'success', 'warning', 'info'
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            background: isLight ? '#ffffff' : '#0e1424',
            color: isLight ? '#1c2438' : '#ffffff',
            customClass: {
                popup: 'keeper-swal-popup',
                title: 'keeper-swal-title',
                htmlContainer: 'keeper-swal-content',
                confirmButton: 'keeper-swal-button'
            }
        });
    } else {
        // Fallback en caso de sin conexión a SweetAlert CDN
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            background-color: ${tipo === 'error' ? '#ef4444' : tipo === 'success' ? '#10b981' : '#f59e0b'};
            color: #ffffff; padding: 14px 20px; border-radius: 8px; font-weight: 500;
            box-shadow: 0 10px 25px #0000004d; font-family: sans-serif;
            max-width: 380px; transition: all 0.3s ease;
        `;
        toast.innerHTML = `<strong>${escapeHtml(tituloFinal)}:</strong> ${escapeHtml(mensaje)}`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
    }
}

/* ==================== COMPONENTE DE CALENDARIO CUSTOM KEEPER ==================== */
document.addEventListener('DOMContentLoaded', function () {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    let popup = document.querySelector('.calendario-flotante');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'calendario-flotante';
        popup.style.display = 'none';
        popup.innerHTML = `
            <div class="calendario-cabecera">
                <button type="button" class="calendario-nav btn-prev">&larr;</button>
                <div class="calendario-titulo">
                    <select class="calendario-selector-mes"></select>
                    <select class="calendario-selector-anio"></select>
                </div>
                <button type="button" class="calendario-nav btn-next">&rarr;</button>
            </div>
            <div class="calendario-dias-semana">
                <span class="calendario-dia-semana">DO</span>
                <span class="calendario-dia-semana">LU</span>
                <span class="calendario-dia-semana">MA</span>
                <span class="calendario-dia-semana">MI</span>
                <span class="calendario-dia-semana">JU</span>
                <span class="calendario-dia-semana">VI</span>
                <span class="calendario-dia-semana">SA</span>
            </div>
            <div class="calendario-dias"></div>
            <div class="calendario-pie">
                <button type="button" class="calendario-boton calendario-boton-limpiar">Borrar</button>
                <button type="button" class="calendario-boton calendario-boton-hoy">Hoy</button>
            </div>
        `;
        document.body.appendChild(popup);
    } else {
        popup.style.display = 'none';
    }

    const selMes = popup.querySelector('.calendario-selector-mes');
    const selAnio = popup.querySelector('.calendario-selector-anio');
    const btnPrev = popup.querySelector('.btn-prev');
    const btnNext = popup.querySelector('.btn-next');
    const contDias = popup.querySelector('.calendario-dias');
    const btnLimpiar = popup.querySelector('.calendario-boton-limpiar');
    const btnHoy = popup.querySelector('.calendario-boton-hoy');

    meses.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = m;
        selMes.appendChild(opt);
    });

    const anioActual = new Date().getFullYear();
    for (let a = anioActual - 100; a <= anioActual + 20; a++) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        selAnio.appendChild(opt);
    }

    let inputActivo = null;
    let fechaVista = new Date();

    function renderCal() {
        const y = fechaVista.getFullYear();
        const m = fechaVista.getMonth();

        selMes.value = m;
        selAnio.value = y;

        contDias.innerHTML = '';

        const primerDia = new Date(y, m, 1).getDay();
        const diasEnMes = new Date(y, m + 1, 0).getDate();
        const hoy = new Date();

        for (let i = 0; i < primerDia; i++) {
            const span = document.createElement('span');
            span.className = 'calendario-dia dia-vacio';
            contDias.appendChild(span);
        }

        let valAct = inputActivo ? inputActivo.value : '';

        for (let d = 1; d <= diasEnMes; d++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'calendario-dia';
            btn.textContent = d;

            const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            if (y === hoy.getFullYear() && m === hoy.getMonth() && d === hoy.getDate()) {
                btn.classList.add('dia-hoy');
            }

            if (valAct === iso) {
                btn.classList.add('dia-seleccionado');
            }

            // Respeta min/max del input (p. ej. nacimiento no puede ser futuro)
            if ((inputActivo?.min && iso < inputActivo.min) || (inputActivo?.max && iso > inputActivo.max)) {
                btn.disabled = true;
                btn.classList.add('dia-fuera-rango');
            }

            btn.addEventListener('click', () => {
                if (inputActivo) {
                    inputActivo.value = iso;
                    inputActivo.dispatchEvent(new Event('change', { bubbles: true }));
                    inputActivo.dispatchEvent(new Event('input', { bubbles: true }));
                }
                cerrarCal();
            });

            contDias.appendChild(btn);
        }
    }

    function abrirCal(input) {
        // Los campos data-fecha son readonly a propósito (solo se llenan con el calendario)
        if ((input.readOnly && !input.hasAttribute('data-fecha')) || input.disabled) return;
        inputActivo = input;
        const rect = input.getBoundingClientRect();
        
        let fecha = new Date();
        if (input.value) {
            const parts = input.value.split('-');
            if (parts.length === 3) {
                fecha = new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }
        fechaVista = fecha;
        renderCal();

        popup.style.display = 'block';
        popup.style.zIndex = '999999';
        popup.style.position = 'absolute';

        const popupHeight = popup.offsetHeight || 330;
        const topArriba = window.scrollY + rect.top - popupHeight - 8;

        if (rect.top > popupHeight + 10) {
            popup.style.top = `${topArriba}px`;
        } else {
            popup.style.top = `${window.scrollY + rect.bottom + 6}px`;
        }

        let left = window.scrollX + rect.left;
        if (left + 310 > window.innerWidth) {
            left = Math.max(10, window.scrollX + window.innerWidth - 325);
        }
        popup.style.left = `${left}px`;
        popup.classList.add('abierto');
    }

    function cerrarCal() {
        popup.style.display = 'none';
        popup.classList.remove('abierto');
        inputActivo = null;
    }

    selMes.addEventListener('change', () => {
        fechaVista.setMonth(parseInt(selMes.value));
        renderCal();
    });

    selAnio.addEventListener('change', () => {
        fechaVista.setFullYear(parseInt(selAnio.value));
        renderCal();
    });

    btnPrev.addEventListener('click', () => {
        fechaVista.setMonth(fechaVista.getMonth() - 1);
        renderCal();
    });

    btnNext.addEventListener('click', () => {
        fechaVista.setMonth(fechaVista.getMonth() + 1);
        renderCal();
    });

    btnLimpiar.addEventListener('click', () => {
        if (inputActivo) {
            inputActivo.value = '';
            inputActivo.dispatchEvent(new Event('change', { bubbles: true }));
        }
        cerrarCal();
    });

    btnHoy.addEventListener('click', () => {
        const hoy = new Date();
        const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        if (inputActivo && ((inputActivo.min && iso < inputActivo.min) || (inputActivo.max && iso > inputActivo.max))) {
            cerrarCal();
            return;
        }
        if (inputActivo) {
            inputActivo.value = iso;
            inputActivo.dispatchEvent(new Event('change', { bubbles: true }));
        }
        cerrarCal();
    });

    document.addEventListener('click', (e) => {
        const btnPass = e.target.closest('.btn-toggle-pass, .panel-entrada-icono-btn');
        if (btnPass) {
            e.preventDefault();
            e.stopPropagation();
            const targetId = btnPass.getAttribute('data-target') || btnPass.dataset.target;
            const inputEl = targetId ? document.getElementById(targetId) : btnPass.parentElement.querySelector('input');
            if (inputEl) {
                if (inputEl.type === 'password') {
                    inputEl.type = 'text';
                    btnPass.innerHTML = `<svg class="icono-ojo-cerrado" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
                } else {
                    inputEl.type = 'password';
                    btnPass.innerHTML = `<svg class="icono-ojo-abierto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
                }
            }
            return;
        }

        const targetInput = e.target.closest('input[type="date"], [data-fecha]');
        if (targetInput) {
            e.preventDefault();
            abrirCal(targetInput);
        } else if (!e.target.closest('.calendario-flotante')) {
            cerrarCal();
        }
    });

    // validar fecha
    document.addEventListener('change', (e) => {
        const input = e.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'date' || !input.value) return;
        const valor = input.value;
        const fueraDeRango = (input.min && valor < input.min) || (input.max && valor > input.max);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || fueraDeRango) {
            input.value = '';
            if (typeof mostrarAlertaNotificacion === 'function') {
                mostrarAlertaNotificacion('La fecha ingresada no es válida para este campo.', 'warning');
            }
        }
    }, true);

    // ── Auto-convertidor Universal de Desplegables de Filtro ──────
    inicializarFiltrosDesplegables();
});

/** desplegables */
function sincronizarSelectCustom(select) {
    if (!select) return;
    select.style.setProperty('display', 'none', 'important');
    const wrapper = select._customDesplegableWrapper;
    if (!wrapper) {
        convertirSelectEnDesplegableCustom(select);
        return;
    }

    const activador = wrapper.querySelector('.selector-activador');
    const textoActivador = wrapper.querySelector('.campo-activador-texto');
    const listaOpciones = wrapper.querySelector('.selector-opciones-lista');
    const busquedaContenedor = wrapper.querySelector('.selector-busqueda-contenedor');
    const inputBusqueda = wrapper.querySelector('.selector-busqueda-campo');
    const sinResultados = wrapper.querySelector('.selector-sin-resultados');

    if (activador) {
        if (select.disabled) {
            activador.classList.add('deshabilitado');
            activador.disabled = true;
        } else {
            activador.classList.remove('deshabilitado');
            activador.disabled = false;
        }
    }

    const options = Array.from(select.options || []);
    const selectedOpt = select.options[select.selectedIndex] || options[0];
    if (textoActivador) {
        textoActivador.textContent = selectedOpt ? selectedOpt.textContent.trim() : 'Seleccionar...';
    }

    // buscador del desplegable
    if (busquedaContenedor) {
        busquedaContenedor.style.display = options.length > 3 ? 'block' : 'none';
        if (inputBusqueda) inputBusqueda.value = '';
    }

    if (listaOpciones) {
        listaOpciones.innerHTML = options.map((opt, i) => {
            const isSelected = opt.value === select.value || (!select.value && i === select.selectedIndex);
            return `
                <div class="selector-opcion ${isSelected ? 'seleccionado' : ''} ${opt.disabled ? 'deshabilitado' : ''}" 
                     data-value="${escapeHtml(opt.value)}" 
                     data-label="${escapeHtml(opt.textContent.trim())}"
                     title="${escapeHtml(opt.textContent.trim())}">
                    ${escapeHtml(opt.textContent.trim())}
                </div>
            `;
        }).join('');
    }
    if (sinResultados) sinResultados.style.display = 'none';
}
window.sincronizarSelectCustom = sincronizarSelectCustom;

function convertirSelectEnDesplegableCustom(select) {
    if (!select || select.dataset.noCustom === 'true') return;
    select.style.setProperty('display', 'none', 'important');

    if (select._customDesplegableWrapper) {
        sincronizarSelectCustom(select);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'campo-desplegable selector-desplegable desplegable-formulario';
    if (select.id) wrapper.dataset.selectId = select.id;

    const options = Array.from(select.options || []);
    const selectedOpt = select.options[select.selectedIndex] || options[0];
    const initialText = selectedOpt ? selectedOpt.textContent.trim() : 'Seleccionar...';

    wrapper.innerHTML = `
        <button type="button" class="campo-activador selector-activador ${select.disabled ? 'deshabilitado' : ''}" ${select.disabled ? 'disabled' : ''}>
            <span class="campo-activador-texto">${escapeHtml(initialText)}</span>
            <svg class="campo-flecha" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="campo-panel selector-panel">
            <div class="selector-busqueda-contenedor" style="${options.length > 3 ? '' : 'display:none;'}">
                <svg class="selector-busqueda-icono" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" class="selector-busqueda-campo" placeholder="Buscar..." autocomplete="off">
            </div>
            <div class="selector-opciones-lista">
                ${options.map((opt, i) => `
                    <div class="selector-opcion ${opt.value === select.value || (!select.value && i === select.selectedIndex) ? 'seleccionado' : ''} ${opt.disabled ? 'deshabilitado' : ''}" 
                         data-value="${escapeHtml(opt.value)}" 
                         data-label="${escapeHtml(opt.textContent.trim())}"
                         title="${escapeHtml(opt.textContent.trim())}">
                        ${escapeHtml(opt.textContent.trim())}
                    </div>
                `).join('')}
            </div>
            <div class="selector-sin-resultados" style="display: none;">No se encontraron opciones</div>
        </div>
    `;

    select.parentNode.insertBefore(wrapper, select);
    select._customDesplegableWrapper = wrapper;

    // Buscador interno
    const inputBusqueda = wrapper.querySelector('.selector-busqueda-campo');
    const sinResultados = wrapper.querySelector('.selector-sin-resultados');
    const listaOpciones = wrapper.querySelector('.selector-opciones-lista');

    if (inputBusqueda) {
        inputBusqueda.addEventListener('click', (e) => e.stopPropagation());
        inputBusqueda.addEventListener('input', function (e) {
            e.stopPropagation();
            const query = this.value.toLowerCase().trim();
            const opciones = listaOpciones.querySelectorAll('.selector-opcion');
            let coincidencias = 0;

            opciones.forEach(op => {
                const label = (op.dataset.label || op.textContent).toLowerCase();
                if (!query || label.includes(query)) {
                    op.style.display = '';
                    coincidencias++;
                } else {
                    op.style.display = 'none';
                }
            });

            if (sinResultados) {
                sinResultados.style.display = coincidencias === 0 ? 'block' : 'none';
            }
        });
    }

    // Observer para detectar cambios en las opciones del <select>
    const observer = new MutationObserver(() => {
        sincronizarSelectCustom(select);
    });
    observer.observe(select, { childList: true, attributes: true, subtree: true, attributeFilter: ['disabled', 'value'] });

    // Escuchar evento 'change' del select nativo
    select.addEventListener('change', () => {
        sincronizarSelectCustom(select);
    });
}
window.convertirSelectEnDesplegableCustom = convertirSelectEnDesplegableCustom;

function inicializarFiltrosDesplegables() {
    // 1 convertir selects
    document.querySelectorAll('select.seleccion-formulario, select.filtro-seleccionar, select.desplegable-custom, select.form-select, .panel-cuerpo select').forEach(select => {
        convertirSelectEnDesplegableCustom(select);
    });

    // 2. Observer global para detectar selects creados o mostrados dinámicamente
    // agrupado por cuadro: antes recorria todo el documento en cada cambio del DOM
    let revisionPendiente = false;
    const bodyObserver = new MutationObserver((cambios) => {
        if (revisionPendiente) return;
        const agregoNodos = cambios.some(c => Array.prototype.some.call(c.addedNodes, n => n.nodeType === 1));
        if (!agregoNodos) return;
        revisionPendiente = true;
        requestAnimationFrame(() => {
            revisionPendiente = false;
            document.querySelectorAll('select.seleccion-formulario, select.filtro-seleccionar, select.desplegable-custom, .panel-cuerpo select').forEach(select => {
                if (!select._customDesplegableWrapper && select.dataset.noCustom !== 'true') {
                    convertirSelectEnDesplegableCustom(select);
                }
            });
        });
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    // 3 clics en desplegables
    document.addEventListener('click', function (e) {
        const activador = e.target.closest('.campo-activador, .selector-activador');
        const opcion = e.target.closest('.selector-opcion');

        if (activador) {
            e.preventDefault();
            e.stopPropagation();
            if (activador.disabled || activador.classList.contains('deshabilitado')) return;

            const desplegable = activador.closest('.campo-desplegable, .selector-desplegable');
            const panel = desplegable ? desplegable.querySelector('.campo-panel, .selector-panel') : null;
            if (!desplegable || !panel) return;

            const estaAbierto = desplegable.classList.contains('abierto') || panel.classList.contains('abierto');

            // cerrar los demas
            document.querySelectorAll('.campo-desplegable, .selector-desplegable').forEach(d => {
                if (d !== desplegable) {
                    d.classList.remove('abierto');
                    const p = d.querySelector('.campo-panel, .selector-panel');
                    if (p) p.classList.remove('abierto');
                    const a = d.querySelector('.campo-activador, .selector-activador');
                    if (a) a.classList.remove('abierto');
                }
            });

            // Alternar estado del actual
            desplegable.classList.toggle('abierto', !estaAbierto);
            panel.classList.toggle('abierto', !estaAbierto);
            activador.classList.toggle('abierto', !estaAbierto);

            // Si se abre, enfocar el buscador si existe
            if (!estaAbierto) {
                const busqueda = panel.querySelector('.selector-busqueda-campo');
                if (busqueda) {
                    busqueda.value = '';
                    panel.querySelectorAll('.selector-opcion').forEach(o => o.style.display = '');
                    const sinRes = panel.querySelector('.selector-sin-resultados');
                    if (sinRes) sinRes.style.display = 'none';
                    setTimeout(() => busqueda.focus(), 50);
                }
            }
            return;
        }

        if (opcion) {
            e.stopPropagation();
            if (opcion.classList.contains('deshabilitado')) return;

            const desplegable = opcion.closest('.campo-desplegable, .selector-desplegable');
            const panel = opcion.closest('.campo-panel, .selector-panel');
            if (panel) {
                panel.querySelectorAll('.selector-opcion').forEach(o => o.classList.remove('seleccionado'));
                opcion.classList.add('seleccionado');
                panel.classList.remove('abierto');
            }
            if (desplegable) {
                desplegable.classList.remove('abierto');
                const activador = desplegable.querySelector('.campo-activador, .selector-activador');
                if (activador) activador.classList.remove('abierto');
                const texto = desplegable.querySelector('.campo-activador-texto');
                if (texto) texto.textContent = opcion.dataset.label || opcion.textContent.trim();

                // Si hay un select nativo asociado
                const selectId = desplegable.dataset.selectId;
                const select = selectId ? document.getElementById(selectId) : desplegable.parentNode.querySelector('select');
                if (select) {
                    select.value = opcion.dataset.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            return;
        }

        // clic afuera
        document.querySelectorAll('.campo-desplegable, .selector-desplegable, .campo-panel, .selector-panel, .campo-activador, .selector-activador').forEach(el => {
            el.classList.remove('abierto');
        });
    });
}

/** paginacion */
function renderizarPaginacion(contenedorOrId, totalItems, itemsPorPagina = 10, paginaActual = 1, onCambioPagina) {
    let contenedor = typeof contenedorOrId === 'string' ? document.getElementById(contenedorOrId) : contenedorOrId;
    if (!contenedor) return;

    if (totalItems <= 0) {
        contenedor.innerHTML = '';
        contenedor.style.display = 'none';
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(totalItems / itemsPorPagina));

    // Si solo hay 1 página, ocultar la paginación para mantener la vista limpia
    if (totalPaginas <= 1) {
        contenedor.innerHTML = '';
        contenedor.style.display = 'none';
        return;
    }

    contenedor.style.display = 'flex';
    const pag = Math.min(Math.max(1, paginaActual), totalPaginas);

    let botonesHtml = '';

    // Botón Anterior
    botonesHtml += `
        <button type="button" class="paginacion-btn paginacion-nav btn-prev" ${pag === 1 ? 'disabled' : ''} aria-label="Página anterior" title="Página anterior">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Anterior</span>
        </button>
    `;

    // Máximo 5 botones numéricos visibles
    const maxVisible = 5;
    let startPage = 1;
    let endPage = totalPaginas;

    if (totalPaginas > maxVisible) {
        const half = Math.floor(maxVisible / 2);
        if (pag <= half + 1) {
            startPage = 1;
            endPage = maxVisible;
        } else if (pag >= totalPaginas - half) {
            startPage = totalPaginas - maxVisible + 1;
            endPage = totalPaginas;
        } else {
            startPage = pag - half;
            endPage = pag + half;
        }
    }

    if (startPage > 1) {
        botonesHtml += `<button type="button" class="paginacion-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            botonesHtml += `<span class="paginacion-puntos">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        botonesHtml += `
            <button type="button" class="paginacion-btn ${i === pag ? 'activo' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPaginas) {
        if (endPage < totalPaginas - 1) {
            botonesHtml += `<span class="paginacion-puntos">...</span>`;
        }
        botonesHtml += `<button type="button" class="paginacion-btn" data-page="${totalPaginas}">${totalPaginas}</button>`;
    }

    // Botón Siguiente
    botonesHtml += `
        <button type="button" class="paginacion-btn paginacion-nav btn-next" ${pag === totalPaginas ? 'disabled' : ''} aria-label="Página siguiente" title="Página siguiente">
            <span>Siguiente</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
    `;

    contenedor.innerHTML = `
        <div class="paginacion-botones">
            ${botonesHtml}
        </div>
    `;

    const btnPrev = contenedor.querySelector('.btn-prev');
    if (btnPrev && pag > 1) {
        btnPrev.addEventListener('click', () => onCambioPagina(pag - 1));
    }

    const btnNext = contenedor.querySelector('.btn-next');
    if (btnNext && pag < totalPaginas) {
        btnNext.addEventListener('click', () => onCambioPagina(pag + 1));
    }

    contenedor.querySelectorAll('.paginacion-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', function () {
            const p = Number(this.dataset.page);
            if (p && p !== pag) onCambioPagina(p);
        });
    });
}
window.renderizarPaginacion = renderizarPaginacion;

// sweetalert

/** alerta */
window.swalKeeper = function (opciones = {}) {
    if (typeof Swal === 'undefined') {
        const msg = opciones.text || opciones.title || 'Mensaje';
        console.error(msg);
        return Promise.resolve({ isConfirmed: false });
    }
    return Swal.fire({
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
        ...opciones,
        customClass: {
            ...(opciones.customClass || {}),
            popup:          'swal-keeper',
            confirmButton:  'swal2-confirm',
            cancelButton:   'swal2-cancel',
        },
        buttonsStyling: false,
    });
};

/** confirmacion */
window.swalConfirmar = async function (Título, texto, textoBotonConfirmar = 'Sí, confirmar') {
    const result = await window.swalKeeper({
        icon: 'question',
        title: Título,
        text: texto,
        showCancelButton: true,
        confirmButtonText: textoBotonConfirmar,
        cancelButtonText: 'Cancelar',
    });
    return result.isConfirmed;
};

/** confirmar eliminacion */
window.swalEliminar = async function (Título = '¿Eliminar registro?', texto = 'Esta acción no se puede deshacer.') {
    const result = await Swal.fire({
        icon: 'warning',
        title: Título,
        text: texto,
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'swal-keeper',
            confirmButton: 'swal-keeper-btn-danger',
            cancelButton: 'swal2-cancel',
        },
        buttonsStyling: false,
    });
    return result.isConfirmed;
};

/** contador de notificaciones */
window.actualizarBadgeNotificaciones = function (conteoManual = null) {
    try {
        const badges = document.querySelectorAll('.insignia-notificaciones-menu, #insignia-notificaciones-menu');
        if (!badges.length) return;

        let count = 0;
        if (typeof conteoManual === 'number') {
            count = Math.max(0, conteoManual);
            sessionStorage.setItem('keeper_notificaciones_unread_count', count);
        } else {
            const stored = sessionStorage.getItem('keeper_notificaciones_unread_count');
            count = (stored !== null) ? (parseInt(stored, 10) || 0) : 0;
        }

        badges.forEach(b => {
            if (count > 0) {
                b.textContent = count > 9 ? '9+' : String(count);
                b.classList.remove('oculto');
                b.style.display = 'inline-flex';
            } else {
                b.textContent = '0';
                b.classList.add('oculto');
                b.style.display = 'none';
            }
        });
    } catch (e) {
        console.warn('Error al actualizar insignia de notificaciones:', e);
    }
};

document.addEventListener('DOMContentLoaded', function () {
    if (window.actualizarBadgeNotificaciones) {
        window.actualizarBadgeNotificaciones();
    }
});

/** validar campos obligatorios */
document.addEventListener('invalid', function (e) {
    const campo = e.target;
    if (!campo || !(campo instanceof HTMLElement)) return;
    const oculto = campo.offsetParent === null || getComputedStyle(campo).display === 'none' || campo.readOnly;
    if (!oculto) return;

    const form = campo.form;
    if (form && form.__avisoInvalidoMostrado) return; // un solo aviso por intento de envío
    if (form) {
        form.__avisoInvalidoMostrado = true;
        setTimeout(() => { form.__avisoInvalidoMostrado = false; }, 300);
    }

    let etiqueta = '';
    if (campo.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(campo.id)}"]`);
        if (lbl) etiqueta = lbl.textContent.replace('*', '').trim();
    }
    if (!etiqueta) etiqueta = campo.getAttribute('placeholder') || campo.getAttribute('aria-label') || campo.name || 'un campo obligatorio';

    if (typeof window.mostrarAlertaNotificacion === 'function') {
        window.mostrarAlertaNotificacion(`Completa el campo: ${etiqueta}`, 'warning');
    }

    const visible = campo._customDesplegableWrapper?.querySelector('.selector-activador') || campo._customDesplegableWrapper || campo;
    visible.classList.add('campo-invalido');
    visible.style.outline = '2px solid #ef4444';
    visible.style.outlineOffset = '2px';
    const limpiar = () => {
        visible.classList.remove('campo-invalido');
        visible.style.outline = '';
        visible.style.outlineOffset = '';
    };
    campo.addEventListener('change', limpiar, { once: true });
    campo.addEventListener('input', limpiar, { once: true });
}, true);

/* ==========================================================================
   Texto largo: se recorta en tablas y tarjetas y se ve completo en un modal
   ========================================================================== */
(function textoLargo() {
    const LIMITE_CELDA = 40;      // caracteres visibles en una celda de tabla
    const LIMITE_TARJETA = 120;   // caracteres visibles en descripciones de tarjetas
    // descripciones dentro de tarjetas: [selector del texto, selector del titulo dentro de la tarjeta]
    const TARJETAS = [
        ['.desc-tarea-guardia', '.item-tarea-guardia', '.titulo-tarea-guardia'],
        ['.infp-item-desc', '.infp-item', '.infp-item-titulo']
    ];

    /** recorta los nodos de texto largos de un elemento; devuelve true si recorto algo */
    function recortar(raiz, limite) {
        let recorto = false;
        const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        const nodos = [];
        while (recorrido.nextNode()) nodos.push(recorrido.currentNode);
        nodos.forEach(n => {
            const t = n.nodeValue.replace(/\s+/g, ' ');
            if (t.trim().length > limite) {
                n.nodeValue = t.trim().slice(0, limite - 1).trimEnd() + '…';
                recorto = true;
            }
        });
        return recorto;
    }

    function textoVisible(el) {
        return (el.innerText || el.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    }

    function procesarCelda(td) {
        td.dataset.kpRevisado = '1';
        if (td.colSpan > 1 || td.classList.contains('tabla-vacia')) return;
        if (td.querySelector('button, a, input, select, textarea, table')) return;
        const completo = textoVisible(td);
        const desborda = td.scrollWidth > td.clientWidth + 1; // recortado por css (una sola linea)
        const recorto = completo.length > LIMITE_CELDA && recortar(td, LIMITE_CELDA);
        if (!recorto && !desborda) return;
        td.dataset.textoCompleto = completo;
        td.classList.add('celda-texto-largo');
        td.title = 'Ver información completa';
        const marca = document.createElement('span');
        marca.className = 'kp-ver-mas';
        marca.textContent = 'ver más';
        marca.setAttribute('aria-hidden', 'true');
        (td.lastElementChild && td.lastElementChild.tagName !== 'IMG' ? td.lastElementChild : td).appendChild(marca);
    }

    function procesarTarjeta(el, limite) {
        el.dataset.kpRevisado = '1';
        const completo = textoVisible(el);
        if (completo.length <= limite) return;
        if (!recortar(el, limite)) return;
        el.dataset.textoCompleto = completo;
        el.classList.add('texto-largo-tarjeta');
        el.style.cursor = 'pointer';
        el.title = 'Ver información completa';
        const marca = document.createElement('span');
        marca.className = 'kp-ver-mas';
        marca.textContent = 'ver más';
        marca.style.cssText = 'margin-left:6px; padding:1px 7px; border-radius:6px; font-size:11px; font-weight:700; color:#fff; background:#2473f5;';
        el.appendChild(marca);
    }

    function revisar() {
        document.querySelectorAll('table tbody td:not([data-kp-revisado])').forEach(procesarCelda);
        TARJETAS.forEach(([sel]) => document.querySelectorAll(`${sel}:not([data-kp-revisado])`).forEach(el => procesarTarjeta(el, LIMITE_TARJETA)));
    }

    // ── modal ─────────────────────────────────────────────────────
    let modal = null;
    function crearModal() {
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'kp-modal-texto-completo';
        modal.className = 'panel-capa';
        modal.innerHTML = `
            <div class="panel-card" role="dialog" aria-modal="true" aria-labelledby="kp-modal-texto-titulo" style="max-width:520px;">
                <div class="panel-encabezado">
                    <div class="panel-encabezado-icono"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
                    <div class="panel-encabezado-texto">
                        <h3 id="kp-modal-texto-titulo">Información completa</h3>
                        <p>Detalle del registro seleccionado</p>
                    </div>
                    <button class="panel-cerrar" type="button" data-kp-cerrar aria-label="Cerrar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                <dl class="kp-detalle-lista"></dl>
                <div class="panel-actions" style="justify-content:flex-end;">
                    <button type="button" class="btn-guardar" data-kp-cerrar>Cerrar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-kp-cerrar]')) cerrar(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('activo')) cerrar(); });
        return modal;
    }
    function cerrar() { if (modal) modal.classList.remove('activo'); }

    function abrir(filas) {
        const m = crearModal();
        m.querySelector('.kp-detalle-lista').innerHTML = filas.map(([etiqueta, valor]) => `
            <div class="kp-detalle-fila"><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(valor)}</dd></div>`).join('');
        m.classList.add('activo');
        m.querySelector('.btn-guardar')?.focus();
    }

    function datosDeFila(tr) {
        const tabla = tr.closest('table');
        const encabezados = tabla ? Array.from(tabla.querySelectorAll('thead th')).map(th => th.textContent.trim()) : [];
        const filas = [];
        Array.from(tr.children).forEach((td, i) => {
            if (td.tagName !== 'TD' || td.classList.contains('col-acciones')) return;
            if (td.querySelector('button, a, input, select') && !td.dataset.textoCompleto) return;
            let valor = td.dataset.textoCompleto || textoVisible(td);
            valor = valor.replace(/\s*ver más$/, '').trim();
            if (!valor) return;
            filas.push([encabezados[i] || `Dato ${i + 1}`, valor]);
        });
        return filas;
    }

    document.addEventListener('click', e => {
        const td = e.target.closest('td.celda-texto-largo');
        if (td && !e.target.closest('button, a, input, select')) {
            abrir(datosDeFila(td.parentElement));
            return;
        }
        const tarjeta = e.target.closest('.texto-largo-tarjeta');
        if (tarjeta) {
            e.stopPropagation();
            const conf = TARJETAS.find(([sel]) => tarjeta.matches(sel));
            const contenedor = conf ? tarjeta.closest(conf[1]) : null;
            const titulo = contenedor?.querySelector(conf[2]);
            const filas = [];
            if (titulo) filas.push(['Título', textoVisible(titulo)]);
            filas.push(['Descripción', tarjeta.dataset.textoCompleto]);
            abrir(filas);
        }
    }, true);

    let pendiente = false;
    function programar() {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => { pendiente = false; revisar(); });
    }
    document.addEventListener('DOMContentLoaded', () => {
        revisar();
        new MutationObserver(cambios => {
            if (cambios.some(c => c.addedNodes.length)) programar();
        }).observe(document.body, { childList: true, subtree: true });
    });
    window.kpMostrarInformacionCompleta = abrir;
})();

/* ==========================================================================
   Contador de caracteres: aparece al escribir, sin mover el formulario
   ========================================================================== */
(function contadorCaracteres() {
    let caja = null;
    let campoActual = null;

    function aplica(el) {
        if (!el || !el.matches || !el.matches('input, textarea')) return false;
        if (el.readOnly || el.disabled) return false;
        const tipo = (el.getAttribute('type') || 'text').toLowerCase();
        if (!['text', 'email', 'search', 'tel', 'url', 'password'].includes(tipo) && el.tagName !== 'TEXTAREA') return false;
        if (/busc|busqueda|filtro/i.test(el.id || '') || el.classList.contains('selector-busqueda-campo')) return false;
        const max = Number(el.getAttribute('maxlength')) || 0;
        return max >= 20;
    }

    function actualizar() {
        if (!campoActual || !caja) return;
        const max = Number(campoActual.getAttribute('maxlength')) || 0;
        const largo = campoActual.value.length;
        caja.textContent = `${largo}/${max}`;
        caja.classList.toggle('lleno', largo >= max);
        caja.classList.toggle('cerca', largo < max && largo >= max * 0.9);
        const r = campoActual.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) { caja.classList.remove('visible'); return; }
        caja.classList.add('visible');
        const anchoCaja = caja.offsetWidth;
        caja.style.left = `${Math.max(4, r.right - anchoCaja - 6)}px`;
        caja.style.top = `${Math.min(innerHeight - 24, r.bottom + 4)}px`;
    }

    document.addEventListener('focusin', e => {
        if (!aplica(e.target)) return;
        if (!caja) {
            caja = document.createElement('div');
            caja.className = 'kp-contador';
            caja.setAttribute('aria-hidden', 'true');
            document.body.appendChild(caja);
        }
        campoActual = e.target;
        actualizar();
    });
    document.addEventListener('focusout', e => {
        if (e.target === campoActual) { campoActual = null; caja?.classList.remove('visible'); }
    });
    document.addEventListener('input', e => { if (e.target === campoActual) actualizar(); });
    window.addEventListener('scroll', () => { if (campoActual) actualizar(); }, true);
    window.addEventListener('resize', () => { if (campoActual) actualizar(); });
})();
