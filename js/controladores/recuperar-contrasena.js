document.addEventListener('DOMContentLoaded', function () {
    const step1 = document.getElementById('paso-1');
    const step2 = document.getElementById('paso-2');
    const step3 = document.getElementById('paso-3');
    const subtitle = document.getElementById('subtitulo-paso');

    const btnNext1 = document.getElementById('btn-siguiente-1');
    const btnNext2 = document.getElementById('btn-siguiente-2');
    const form = document.getElementById('recuperar-form');
    const submitBtn = document.getElementById('btn-finalizar');

    const emailInput = document.getElementById('recuperar-correo');
    const codeInput = document.getElementById('recuperar-Codigo') || document.getElementById('recuperar-codigo') || document.getElementById('recuperar-Código');
    const newPassword = document.getElementById('nuevo-contrasena') || document.getElementById('nuevo-Contraseña');
    const confirmPassword = document.getElementById('confirmar-nuevo-contrasena') || document.getElementById('confirmar-nuevo-Contraseña');

    if (codeInput) {
        codeInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
        });
    }

    // Paso 1 -> Paso 2 (Solicitar código real al correo)
    if (btnNext1) {
        btnNext1.addEventListener('click', async function () {
            const email = (emailInput ? emailInput.value : '').trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email || !emailRegex.test(email)) {
                mostrarAlertaNotificacion('Por favor, ingresa un correo electrónico válido.', 'warning');
                if (emailInput) emailInput.focus();
                return;
            }

            const textoOriginal = btnNext1.innerHTML;
            btnNext1.disabled = true;
            btnNext1.innerHTML = '<span class="texto-boton-enviar">Enviando correo...</span>';

            try {
                const res = await CredentialsStore.requestRecoveryCode(email);
                if (!res.ok) {
                    mostrarAlertaNotificacion(res.error || 'No se pudo enviar el correo de recuperación', 'error');
                    btnNext1.disabled = false;
                    btnNext1.innerHTML = textoOriginal;
                    return;
                }

                mostrarAlertaNotificacion('¡Código enviado! Revisa tu bandeja de entrada en Gmail.', 'success');
                step1.style.display = 'none';
                step2.style.display = 'block';
                if (subtitle) subtitle.textContent = 'Ingresa el código numérico de 6 dígitos que te enviamos';
                step2.style.animation = 'field-up 0.5s ease both';
                if (codeInput) codeInput.focus();
            } catch (err) {
                mostrarAlertaNotificacion(err.message || 'Error al conectar con el servidor', 'error');
            } finally {
                btnNext1.disabled = false;
                btnNext1.innerHTML = textoOriginal;
            }
        });
    }

    // paso 2 verificar codigo
    if (btnNext2) {
        btnNext2.addEventListener('click', async function () {
            const code = (codeInput ? codeInput.value : '').trim();
            const email = (emailInput ? emailInput.value : '').trim();

            if (code.length !== 6) {
                mostrarAlertaNotificacion('Por favor, ingresa un código válido de 6 dígitos numéricos.', 'warning');
                if (codeInput) codeInput.focus();
                return;
            }

            const textoOriginal = btnNext2.innerHTML;
            btnNext2.disabled = true;
            btnNext2.innerHTML = '<span class="texto-boton-enviar">Verificando...</span>';

            try {
                const res = await CredentialsStore.verifyRecoveryCode(email, code);
                if (!res.ok) {
                    mostrarAlertaNotificacion(res.error || 'Código incorrecto o expirado', 'error');
                    btnNext2.disabled = false;
                    btnNext2.innerHTML = textoOriginal;
                    return;
                }

                step2.style.display = 'none';
                step3.style.display = 'block';
                if (subtitle) subtitle.textContent = 'Crea una nueva contraseña segura';
                step3.style.animation = 'field-up 0.5s ease both';
                if (newPassword) newPassword.focus();
            } catch (err) {
                mostrarAlertaNotificacion(err.message || 'Error al verificar el código', 'error');
            } finally {
                btnNext2.disabled = false;
                btnNext2.innerHTML = textoOriginal;
            }
        });
    }

    // Botón Reenviar Código en Paso 2
    const btnResend = document.getElementById('btn-reenviar-Codigo') || document.getElementById('btn-reenviar-codigo') || document.getElementById('btn-reenviar-Código');
    if (btnResend) {
        let resendTimer = null;
        let cooldownSeconds = 0;

        btnResend.addEventListener('click', async function () {
            if (cooldownSeconds > 0) return;

            const email = (emailInput ? emailInput.value : '').trim();
            if (!email) {
                mostrarAlertaNotificacion('Ingresa tu correo para reenviar el código.', 'warning');
                return;
            }

            btnResend.disabled = true;
            btnResend.innerHTML = 'Reenviando nuevo código...';

            try {
                const res = await CredentialsStore.requestRecoveryCode(email);
                if (!res.ok) {
                    mostrarAlertaNotificacion(res.error || 'No se pudo reenviar el código', 'error');
                    btnResend.disabled = false;
                    btnResend.innerHTML = '¿No te llegó el código? <span style="text-decoration: underline;">Reenviar código</span>';
                    return;
                }

                mostrarAlertaNotificacion('¡Nuevo código enviado! Revisa tu bandeja de entrada en Gmail.', 'success');
                if (codeInput) {
                    codeInput.value = '';
                    codeInput.focus();
                }

                cooldownSeconds = 60;
                btnResend.disabled = true;
                btnResend.innerHTML = `Reenviar en <span style="font-weight:700; color:#fff;">${cooldownSeconds}s</span>`;

                resendTimer = setInterval(() => {
                    cooldownSeconds--;
                    if (cooldownSeconds <= 0) {
                        clearInterval(resendTimer);
                        btnResend.disabled = false;
                        btnResend.innerHTML = '¿No te llegó el código? <span style="text-decoration: underline;">Reenviar código</span>';
                    } else {
                        btnResend.innerHTML = `Reenviar en <span style="font-weight:700; color:#fff;">${cooldownSeconds}s</span>`;
                    }
                }, 1000);

            } catch (err) {
                mostrarAlertaNotificacion(err.message || 'Error al conectar con el servidor', 'error');
                btnResend.disabled = false;
                btnResend.innerHTML = '¿No te llegó el código? <span style="text-decoration: underline;">Reenviar código</span>';
            }
        });
    }

    // paso 3 guardar contraseña
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const pass = (newPassword ? newPassword.value : '').trim();
            const confirmPass = (confirmPassword ? confirmPassword.value : '').trim();
            const email = (emailInput ? emailInput.value : '').trim();
            const code = (codeInput ? codeInput.value : '').trim();

            if (!pass || !confirmPass) {
                mostrarAlertaNotificacion('Por favor, completa ambos campos de contraseña.', 'warning');
                return;
            }

            if (pass.length < 8) {
                mostrarAlertaNotificacion('La nueva contraseña debe tener al menos 8 caracteres.', 'warning');
                return;
            }

            if (pass !== confirmPass) {
                mostrarAlertaNotificacion('Las contraseñas no coinciden.', 'warning');
                return;
            }

            const textoOriginal = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="texto-boton-enviar">Actualizando en base de datos...</span>';
            }

            try {
                const resultado = await CredentialsStore.updatePassword(email, pass, code);
                if (!resultado.ok) {
                    mostrarAlertaNotificacion(resultado.error || 'Error al restablecer la contraseña', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = textoOriginal;
                    }
                    return;
                }

                mostrarAlertaNotificacion('¡Contraseña actualizada con éxito en la base de datos!', 'success');
                setTimeout(() => {
                    window.location.href = '../Index.html';
                }, 1500);
            } catch (err) {
                mostrarAlertaNotificacion(err.message || 'Error al conectar con el servidor', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginal;
                }
            }
        });
    }
});
