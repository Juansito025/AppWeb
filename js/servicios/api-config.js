
// url de la api en produccion
const KEEPER_API_PRODUCCION = 'https://keeperapi-19b860af3759.herokuapp.com/api';

// entorno local
function esEntornoLocal() {
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
    return host === '' || host === 'localhost' || host === '127.0.0.1'
        || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
/** configuracion de la api */

const API_CONFIG = {
    // local o produccion
    get BASE_URL() {
        const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
        return esEntornoLocal() ? `http://${host}:8080/api` : KEEPER_API_PRODUCCION;
    },
    // misma api
    get AUTH_URL() {
        return this.BASE_URL;
    },
    KEY_SESSION: 'keeper_sesion',
    KEY_TOKEN: 'keeper_token',
    KEY_USER: 'KEEPER_CURRENT_USER'
};

/** fecha local */
function fechaHoraLocalISO(fecha = new Date()) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss (LocalDateTime)
}
function fechaLocalISO(fecha = new Date()) {
    return fechaHoraLocalISO(fecha).slice(0, 10); // yyyy-MM-dd (LocalDate)
}

function esTokenJwt(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.replace(/^Bearer\s+/i, '').trim();
    return s.split('.').length === 3;
}

/** sesion */
function getAuthHeader() {
    return {};
}

/** limpiar sesion */
function limpiarSesionLocal() {
    try {
        sessionStorage.removeItem(API_CONFIG.KEY_SESSION);
        sessionStorage.removeItem(API_CONFIG.KEY_USER);
        // limpiar datos viejos
        localStorage.removeItem(API_CONFIG.KEY_SESSION);
        localStorage.removeItem(API_CONFIG.KEY_USER);
        localStorage.removeItem(API_CONFIG.KEY_TOKEN);
        sessionStorage.clear();
    } catch (_) {}
}

function irAlLogin() {
    const path = window.location.pathname.toLowerCase();
    window.location.href = path.includes('/html/') ? '../Index.html' : './Index.html';
}

function esEmpleadoWeb(usuario) {
    const tipo = String(usuario?.tipoUsuario || usuario?.type || '').trim().toUpperCase();
    const rol = String(usuario?.rol || usuario?.role || '')
        .trim()
        .toUpperCase()
        .replace(/^ROLE_/, '');
    return tipo === 'EMPLEADO' && ['ADMINISTRADOR', 'VIGILANTE'].includes(rol);
}

/** aviso de error */
let __keeperUltimoAvisoApi = { msg: '', t: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { window.__keeperSaliendo = true; });
}
function avisarErrorApi(mensaje) {
    const ahora = Date.now();
    if (__keeperUltimoAvisoApi.msg === mensaje && ahora - __keeperUltimoAvisoApi.t < 5000) return;
    __keeperUltimoAvisoApi = { msg: mensaje, t: ahora };
    if (typeof window !== 'undefined' && typeof window.mostrarAlertaNotificacion === 'function') {
        window.mostrarAlertaNotificacion(mensaje, 'error');
    }
}

/** es listado */
function esListado(endpoint) {
    const ruta = endpoint.split('?')[0].replace(/\/+$/, '');
    const ultimo = ruta.split('/').pop() || '';
    return !/^[0-9]+$/.test(ultimo) && !/^[0-9a-f-]{32,36}$/i.test(ultimo);
}

/** peticion a la api */
async function apiFetch(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const isAuth = cleanEndpoint.startsWith('/auth');
    const baseUrl = isAuth ? API_CONFIG.AUTH_URL : API_CONFIG.BASE_URL;
    const metodo = (options.method || 'GET').toUpperCase();
    const esArchivo = (typeof FormData !== 'undefined') && options.body instanceof FormData;
    const { silencioso, ...opcionesFetch } = options;

    const config = {
        ...opcionesFetch,
        method: metodo,
        headers: {
            // Con FormData el navegador pone el Content-Type multipart con su boundary
            ...(esArchivo ? {} : { 'Content-Type': 'application/json' }),
            ...getAuthHeader(),
            ...(options.headers || {})
        },
        credentials: 'include' // enviar cookie
    };

    if (config.body && typeof config.body === 'object' && !esArchivo) {
        config.body = JSON.stringify(config.body);
    }

    const url = `${baseUrl}${cleanEndpoint}`;
    let response;
    try {
        response = await fetch(url, config);
    } catch (redErr) {
        const servicio = 'Spring Boot (puerto 8080)';
        const err = new Error(`No se pudo conectar con la API ${servicio}. Verifica que esté encendida y que CORS permita este origen (${window.location.origin}).`);
        err.status = 0;
        // aviso en consultas
        if (!silencioso && metodo === 'GET' && !window.__keeperSaliendo) avisarErrorApi(err.message);
        console.error(`[API] ${metodo} ${url}:`, redErr.message);
        throw err;
    }

    const text = await response.text();
    let resData = null;
    if (text && text.trim()) {
        try { resData = JSON.parse(text); } catch (e) { resData = text; }
    }

    // respuesta de la api
    const exito = resData && typeof resData === 'object'
        ? (resData.succes ?? resData.success ?? null)
        : null;

    if (!response.ok) {
        // listado vacio
        if (response.status === 404 && metodo === 'GET' && esListado(cleanEndpoint)) {
            return [];
        }
        let mensaje = (resData && typeof resData === 'object' && (resData.message || resData.error))
            || `Error HTTP ${response.status}`;
        if (response.status === 401) {
            mensaje = 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.';
            const pathActual = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
            const esPaginaAuth = pathActual.endsWith('index.html') || pathActual.endsWith('registrarse.html') || pathActual.endsWith('recuperar-contrasena.html') || pathActual === '/' || pathActual === '';
            const esLoginEndpoint = cleanEndpoint === '/auth/login' || cleanEndpoint === '/auth/primer-administrador';

            if (!esLoginEndpoint && !esPaginaAuth && !window.__keeperRedirigiendoLogin) {
                window.__keeperRedirigiendoLogin = true;
                limpiarSesionLocal();
                try {
                    sessionStorage.setItem('keeper_aviso_login', mensaje);
                } catch (_) {}
                irAlLogin();
            }
        }
        if (response.status === 403) mensaje = resData?.message || 'No tienes permisos para realizar esta acción.';
        // errores de validacion
        if (response.status === 400 && resData?.data && typeof resData.data === 'object' && !Array.isArray(resData.data)) {
            const detalles = Object.values(resData.data).filter(v => typeof v === 'string');
            if (detalles.length) mensaje = `${mensaje}: ${detalles.join(' · ')}`;
        }
        const err = new Error(mensaje);
        err.status = response.status;
        err.data = resData;
        console.error(`[API] ${metodo} ${url} -> ${response.status}:`, mensaje);
        // aviso en consultas
        if (!silencioso && metodo === 'GET') avisarErrorApi(mensaje);
        throw err;
    }

    if (response.status === 204 || resData === null) {
        return { ok: true };
    }

    if (exito === false) {
        const err = new Error(resData.message || 'La API rechazó la petición');
        err.status = response.status;
        throw err;
    }

    return (resData && typeof resData === 'object' && 'data' in resData) ? resData.data : resData;
}

/** todas las visitas (lista completa o pagina por pagina, sin pedir paginas grandes) */
async function obtenerTodasLasVisitas() {
    const ordenar = (lista) => lista.slice().sort((a, b) => Number(b.idVisitas ?? b.idVisita ?? 0) - Number(a.idVisitas ?? a.idVisita ?? 0));
    try {
        const r = await apiFetch('/visitas', { silencioso: true });
        const lista = Array.isArray(r) ? r : (Array.isArray(r?.content) ? r.content : null);
        if (lista && lista.length) return ordenar(lista);
    } catch (_) { /* se intenta con el paginado */ }

    const TAM = 10; // tamano que la api acepta
    const todas = [];
    for (let pagina = 0; pagina < 500; pagina++) {
        const r = await apiFetch(`/visitas/paginado?page=${pagina}&size=${TAM}`, { silencioso: true });
        const contenido = Array.isArray(r) ? r : (Array.isArray(r?.content) ? r.content : []);
        todas.push(...contenido);
        const meta = (r && typeof r.page === 'object') ? r.page : (r || {});
        const totalPaginas = Number(meta.totalPages ?? 0);
        if (!contenido.length || contenido.length < TAM || (totalPaginas && pagina + 1 >= totalPaginas)) break;
    }
    return ordenar(todas);
}

/** gravedades de infraccion: id y nombre sin importar como los nombre la api */
function idGravedad(g) {
    if (!g) return null;
    return g.idGravedadInfraccion ?? g.idGravedad ?? g.idTipoInfraccion ?? g.idGravedadInfracciones ?? g.id ?? null;
}
function nombreGravedad(g) {
    if (!g) return '';
    return String(g.nombreGravedadInfraccion ?? g.nombreGravedad ?? g.nombreTipoInfraccion ?? g.nombre ?? '').trim();
}
/** id de la gravedad guardada en una infraccion (acepta id plano u objeto) */
function fkGravedadDe(inf) {
    if (!inf) return null;
    const v = inf.fkTipoInfraccion ?? inf.fkGravedadInfraccion ?? inf.fkGravedad ?? inf.gravedadInfraccion ?? inf.tipoInfraccion ?? null;
    return (v && typeof v === 'object') ? idGravedad(v) : v;
}
/** nombre de la gravedad de una infraccion buscando en el catalogo */
function gravedadDeInfraccion(inf, gravedades = []) {
    const v = inf?.fkTipoInfraccion ?? inf?.fkGravedadInfraccion ?? inf?.gravedadInfraccion ?? null;
    if (v && typeof v === 'object' && nombreGravedad(v)) return nombreGravedad(v);
    const id = fkGravedadDe(inf);
    const g = (gravedades || []).find(x => id != null && String(idGravedad(x)).toLowerCase() === String(id).toLowerCase());
    return nombreGravedad(g);
}
/** clave normalizada: leve | moderada | grave */
function claveGravedad(nombre) {
    const n = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (/^(lev|baj|men)/.test(n)) return 'leve';
    if (/^(mod|med)/.test(n)) return 'moderada';
    if (/^(grav|alt|may|sev)/.test(n)) return 'grave';
    return n;
}

/** sesion */
const CredentialsStore = {
    async validateLogin(email, password) {
        const iden = String(email || '').trim();
        const pass = String(password || '').trim();

        if (!iden || !pass) {
            return { ok: false, error: 'Ingresa tu usuario/correo y contraseña.' };
        }

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: {
                    identificador: iden,
                    password: pass
                }
            });

            if (res) {
                // datos de sesion
                const rolFinal = res.rol || res.role || '';
                const usuario = {
                    id: res.id || res.idEmpleado || null,
                    idEmpleado: res.idEmpleado || res.id || null,
                    email: res.correo || res.correoEmpleado || iden,
                    nombre: res.nombre || res.nombreEmpleado || 'Usuario',
                    apellido: res.apellido || res.apellidoEmpleado || '',
                    firstName: res.nombre || res.nombreEmpleado || 'Usuario',
                    lastName: res.apellido || res.apellidoEmpleado || '',
                    role: rolFinal,
                    rol: rolFinal,
                    type: res.tipoUsuario || ''
                };

                if (!esEmpleadoWeb(usuario)) {
                    // Los residentes usan la app móvil, no el panel web.
                    await apiFetch('/auth/logout', { method: 'POST', silencioso: true }).catch(() => null);
                    return { ok: false, error: 'Esta aplicación es solo para administradores y vigilantes. Los residentes usan la app móvil.' };
                }

                limpiarSesionLocal();
                sessionStorage.setItem(API_CONFIG.KEY_SESSION, JSON.stringify(usuario));
                sessionStorage.setItem(API_CONFIG.KEY_USER, JSON.stringify(usuario));

                return { ok: true, user: usuario };
            }
            return { ok: false, error: 'Credenciales inválidas.' };
        } catch (err) {
            console.warn('[CredentialsStore] Error en validateLogin:', err.message);
            return { ok: false, error: err.message || 'Error al conectar con el servidor de autenticación.' };
        }
    },

    /** estado del registro */
    async estadoRegistro() {
        try {
            return await apiFetch('/auth/estado-registro', { silencioso: true });
        } catch (e) {
            console.warn('[CredentialsStore] No se pudo consultar el estado del registro:', e.message);
            return null;
        }
    },

    /** primer administrador */
    async registrarPrimerAdministrador(datos) {
        const payload = {
            nombreEmpleado: String(datos.firstName || '').trim(),
            apellidoEmpleado: String(datos.lastName || '').trim(),
            correoEmpleado: String(datos.email || '').trim(),
            passwordEmpleado: String(datos.password || ''),
            duiEmpleado: String(datos.dui || '').trim(),
            telefonoEmpleado: String(datos.phone || '').trim(),
            fechaNacimientoEmpleado: datos.birthdate || null
        };
        try {
            const res = await apiFetch('/auth/primer-administrador', { method: 'POST', body: payload });
            const usuario = {
                id: res.id || null,
                idEmpleado: res.id || null,
                email: res.correo || payload.correoEmpleado,
                nombre: res.nombre || payload.nombreEmpleado,
                apellido: res.apellido || payload.apellidoEmpleado,
                firstName: res.nombre || payload.nombreEmpleado,
                lastName: res.apellido || payload.apellidoEmpleado,
                role: res.rol || 'Administrador',
                rol: res.rol || 'Administrador',
                type: res.tipoUsuario || 'EMPLEADO'
            };
            limpiarSesionLocal();
            sessionStorage.setItem(API_CONFIG.KEY_SESSION, JSON.stringify(usuario));
            sessionStorage.setItem(API_CONFIG.KEY_USER, JSON.stringify(usuario));
            return { ok: true, user: usuario };
        } catch (err) {
            if (err.status === 409) {
                return { ok: false, cerrado: true, error: err.message || 'El sistema ya tiene un administrador. Inicia sesión.' };
            }
            return { ok: false, error: err.message || 'No se pudo crear el administrador.' };
        }
    },

    async register(datos) {
        const email = String(datos.email || datos.correoEmpleado || '').trim();
        const pass = String(datos.password || datos.passwordEmpleado || '').trim();

        if (!email || !pass) {
            return { ok: false, error: 'Correo y contraseña son obligatorios.' };
        }

        try {
            const payload = {
                nombreEmpleado: datos.firstName || datos.nombreEmpleado || 'Usuario',
                apellidoEmpleado: datos.lastName || datos.apellidoEmpleado || 'Registrado',
                correoEmpleado: email,
                passwordEmpleado: pass,
                duiEmpleado: datos.dui || datos.duiEmpleado || null,
                telefonoEmpleado: datos.phone || datos.telefonoEmpleado || null,
                fechaNacimientoEmpleado: datos.birthdate || null,
                fechaInicioContrato: fechaLocalISO(),
                fkRol: datos.fkRol || 1
            };

            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: payload
            });

            if (res) {
                // registrar usuario
                return {
                    ok: true,
                    user: {
                        id: res.id || res.idEmpleado || null,
                        idEmpleado: res.idEmpleado || res.id || null,
                        email: res.correo || res.correoEmpleado || email,
                        firstName: res.nombre || res.nombreEmpleado || datos.firstName,
                        lastName: res.apellido || res.apellidoEmpleado || datos.lastName,
                        rol: res.rol || res.role || ''
                    }
                };
            }
            return { ok: false, error: 'Respuesta inválida del servidor.' };
        } catch (err) {
            console.warn('[CredentialsStore] Error en registro:', err.message);
            if (err.status === 401 || err.status === 403) {
                return { ok: false, error: 'Solo un administrador con la sesión iniciada puede registrar cuentas nuevas.' };
            }
            return { ok: false, error: err.message || 'Error al conectar con el servicio de autenticación.' };
        }
    },

    async requestRecoveryCode(email) {
        try {
            await apiFetch('/auth/solicitar-codigo', {
                method: 'POST',
                body: { correo: email }
            });
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    async verifyRecoveryCode(email, code) {
        try {
            const res = await apiFetch('/auth/verificar-codigo', {
                method: 'POST',
                body: { correo: email, codigo: code }
            });
            return { ok: true, valido: res === true || res?.data === true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    async updatePassword(email, newPassword, code) {
        try {
            await apiFetch('/auth/reset-password', {
                method: 'POST',
                body: {
                    correo: email,
                    codigo: String(code || '').trim(),
                    nuevaPassword: newPassword
                }
            });
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    getSession() {
        try {
            const raw = sessionStorage.getItem(API_CONFIG.KEY_SESSION) || sessionStorage.getItem(API_CONFIG.KEY_USER);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },

    clearSession() {
        limpiarSesionLocal();
    },

    /** cerrar sesion */
    async cerrarSesion() {
        try {
            await apiFetch('/auth/logout', { method: 'POST', silencioso: true });
        } catch (e) {
            console.warn('[CredentialsStore] No se pudo avisar el cierre de sesión a la API:', e.message);
        }
        limpiarSesionLocal();
        irAlLogin();
    },

    /** usuario actual */
    async verificarSesion() {
        try {
            const me = await apiFetch('/auth/me', { silencioso: true });
            if (!me || !(me.id || me.username) || !esEmpleadoWeb(me)) {
                await apiFetch('/auth/logout', { method: 'POST', silencioso: true }).catch(() => null);
                limpiarSesionLocal();
                return null;
            }
            return me;
        } catch (e) {
            if (e.status === 401) return null;
            throw e; // error de conexion
        }
    },

    async protegerVista(rolRequerido = null) {
        const path = window.location.pathname.toLowerCase();
        const esAuthPage = path.endsWith('index.html') || path.endsWith('registrarse.html') || path.endsWith('recuperar-contrasena.html');
        if (esAuthPage) return true;
        try {
            const me = await this.verificarSesion();
            if (!me) {
                limpiarSesionLocal();
                irAlLogin();
                return false;
            }
        } catch (_) {
            // sin respuesta
        }
        return true;
    }
};

/** authservice */
const AuthService = {
    login: (u, p) => CredentialsStore.validateLogin(u, p),
    registrar: (d) => CredentialsStore.register(d),
    obtenerUsuarioActual: () => CredentialsStore.getSession(),
    logout: () => CredentialsStore.cerrarSesion(),
    protegerVista: (r) => CredentialsStore.protegerVista(r)
};

// Exposición en el ámbito global del navegador
if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
    window.apiFetch = apiFetch;
    window.fechaHoraLocalISO = fechaHoraLocalISO;
    window.fechaLocalISO = fechaLocalISO;
    window.CredentialsStore = CredentialsStore;
    window.limpiarSesionLocal = limpiarSesionLocal;
    window.AuthService = AuthService;
    window.obtenerTodasLasVisitas = obtenerTodasLasVisitas;
    window.idGravedad = idGravedad;
    window.nombreGravedad = nombreGravedad;
    window.claveGravedad = claveGravedad;
    window.fkGravedadDe = fkGravedadDe;
    window.gravedadDeInfraccion = gravedadDeInfraccion;

    // Accesos directos convenientes para componentes reactivos
    window.getVisitas = obtenerTodasLasVisitas;
    window.getPersonas = async () => await apiFetch('/personas');
    window.getPropiedades = async () => await apiFetch('/propiedades');
    window.getPasesQR = async () => await apiFetch('/paseAccesoQR');
    window.getTareas = async () => await apiFetch('/tareas');
    window.actualizarEstadoTarea = async (id, estado) => await apiFetch(`/tareas/${id}/estado`, { method: 'PATCH', body: { estado } });
}
