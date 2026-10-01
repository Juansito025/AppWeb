document.addEventListener('DOMContentLoaded', function () {
    // Aviso cuando otra página cerró la sesión (token vencido)
    try {
        const aviso = sessionStorage.getItem('keeper_aviso_login');
        if (aviso) {
            sessionStorage.removeItem('keeper_aviso_login');
            setTimeout(() => window.mostrarAlertaNotificacion && mostrarAlertaNotificacion(aviso, 'warning'), 300);
        }
    } catch (_) {}

    // mostrar registro si no hay administrador
    const bloquePrimerUsuario = document.getElementById('bloque-primer-usuario');
    if (bloquePrimerUsuario && window.CredentialsStore) {
        CredentialsStore.estadoRegistro().then(estado => {
            bloquePrimerUsuario.hidden = !(estado && estado.registroAbierto);
        });
    }

    const loginForm = document.getElementById('formulario-acceso');
    const submitBtn = document.getElementById('inicio-sesion-enviar-btn') || document.getElementById('inicio-Sesión-enviar-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const emailInput = document.getElementById('entrada-correo');
            const passwordInput = document.getElementById('entrada-contrasena') || document.getElementById('entrada-Contraseña');

            let email = (emailInput ? emailInput.value : '').trim();
            let password = (passwordInput ? passwordInput.value : '').trim();

            if (!email && !password) {
                mostrarAlertaNotificacion('Ingresa credenciales', 'warning');
                return;
            } else if (!email) {
                mostrarAlertaNotificacion('Por favor, ingresa tu correo electrónico o DUI.', 'warning');
                if (emailInput) emailInput.focus();
                return;
            } else if (!password) {
                mostrarAlertaNotificacion('Por favor, ingresa tu contraseña.', 'warning');
                if (passwordInput) passwordInput.focus();
                return;
            }

            // Estado de carga en el botón
            const textoOriginal = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="texto-boton-enviar">Iniciando sesión...</span>';
            }

            try {
                const resultado = await CredentialsStore.validateLogin(email, password);

                if (!resultado.ok) {
                    mostrarAlertaNotificacion(resultado.error || 'Credenciales inválidas', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginal;
                    }
                    return;
                }

                // redirigir
                const destino = './html/pantalla-carga.html';
                window.location.href = destino;
            } catch (err) {
                mostrarAlertaNotificacion(err.message || 'Error al conectar con el servidor de autenticación', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginal;
                }
            }
        });
    }
});
