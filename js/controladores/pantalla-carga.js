document.addEventListener('DOMContentLoaded', async () => {
    const mainContainer = document.querySelector('.contenedor-principal');
    const loadingApp = document.getElementById('aplicacion-carga');
    const loadingText = document.querySelector('.texto-carga');
    const subText = document.querySelector('.subtexto');

    function actualizarMensaje(Título, detalle) {
        if (loadingText) loadingText.textContent = Título;
        if (subText && detalle) subText.textContent = detalle;
    }

    // 1 validar sesion
    let Sesión = null;
    let errorApi = false;
    try {
        const me = await CredentialsStore.verificarSesion();
        if (me) {
            const local = CredentialsStore.getSession() || {};
            Sesión = { ...local, id: local.id || me.id, email: local.email || me.username, rol: me.rol || local.rol, role: me.rol || local.role };
        }
    } catch (e) {
        console.warn('Error al verificar sesión:', e);
        errorApi = true;
        mostrarAlertaNotificacion(e.message || 'No se pudo conectar con la API de autenticación.', 'error');
    }

    if (!Sesión) {
        CredentialsStore.clearSession();
        setTimeout(() => { window.location.href = '../Index.html'; }, errorApi ? 2500 : 0);
        return;
    }

    if (loadingApp) loadingApp.classList.add('es-cargando');

    // 2. Paso 1: Verificación de credenciales
    actualizarMensaje('Verificando sesión...', `Usuario: ${Sesión.email || Sesión.firstName || 'Conectado'}`);
    await new Promise(r => setTimeout(r, 600));

    // 3 paso 2 revisar conexion
    actualizarMensaje('Sincronizando servicios...', 'Conectando con el servidor Backend...');
    try {
        if (typeof apiFetch === 'function') {
            await Promise.race([
                apiFetch('/auth/health').catch(() => null),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
        }
    } catch (e) {
        // Continuar en caso de timeout
    }

    // 4. Paso 3: Configurar entorno según el rol del usuario
    const rol = (Sesión.role || Sesión.rol || '');
    const nombre = (Sesión.firstName ? `${Sesión.firstName}` : 'Usuario');
    actualizarMensaje(`¡Bienvenido, ${nombre}!`, `Rol asignado: ${rol}`);

    await new Promise(r => setTimeout(r, 700));

    // 5. Finalizar animación de carga y redirigir
    actualizarMensaje('¡Todo listo!', 'Cargando tablero...');
    if (loadingApp) {
        loadingApp.classList.remove('es-cargando');
        loadingApp.classList.add('es-finalizado');
    }

    setTimeout(() => {
        if (mainContainer) mainContainer.classList.add('es-salida');
    }, 400);

    setTimeout(() => {
        window.location.href = './dashboard.html';
    }, 700);
});
