document.addEventListener('DOMContentLoaded', function () {
    // El calendario no deja elegir fechas de nacimiento futuras
    const campoNacimiento = document.getElementById('fecha-nacimiento-entrada');
    if (campoNacimiento && typeof fechaLocalISO === 'function') {
        campoNacimiento.max = fechaLocalISO();
        campoNacimiento.min = '1900-01-01';
    }
    const photoInput = document.getElementById('foto-entrada');
    const photoPreview = document.getElementById('foto-vista-previa');
    const photoPreviewImg = document.getElementById('foto-vista-previa-img');

    if (photoInput && photoPreview && photoPreviewImg) {
        photoInput.addEventListener('change', function () {
            const file = photoInput.files && photoInput.files[0];
            if (!file) return;

            if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
                mostrarAlertaNotificacion('Formato no permitido. Usa JPG, PNG o WEBP.', 'warning');
                photoInput.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                mostrarAlertaNotificacion('La imagen no debe superar los 5 MB.', 'warning');
                photoInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (event) {
                photoPreviewImg.src = event.target.result;
                photoPreview.classList.add('con-imagen');
            };
            reader.readAsDataURL(file);
        });
    }

    const form = document.getElementById('formulario-registro');
    const submitBtn = document.getElementById('registrar-enviar-btn');
    if (!form) return;

    // registro del primer administrador
    const irAlLoginConAviso = (mensaje) => {
        mostrarAlertaNotificacion(mensaje, 'info');
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => { window.location.href = '../Index.html'; }, 2200);
    };
    CredentialsStore.estadoRegistro().then(estado => {
        if (estado && estado.existeAdministrador) {
            irAlLoginConAviso('El sistema ya tiene un administrador. Inicia sesión con tu cuenta.');
        } else if (!estado) {
            mostrarAlertaNotificacion('No se pudo conectar con la API. Verifica que esté encendida.', 'error');
        }
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const nombre = (document.getElementById('nombre-entrada')?.value || '').trim();
        const apellido = (document.getElementById('apellido-entrada')?.value || '').trim();
        const email = (document.getElementById('entrada-correo')?.value || '').trim();
        const passEl = document.getElementById('entrada-contrasena') || document.getElementById('entrada-Contraseña');
        const password = (passEl?.value || '').trim();
        const confPassEl = document.getElementById('confirmar-contrasena-entrada') || document.getElementById('confirmar-Contraseña-entrada');
        const confirmPassword = (confPassEl?.value || '').trim();
        const dui = (document.getElementById('dui-entrada')?.value || '').trim();
        const phoneEl = document.getElementById('telefono-entrada') || document.getElementById('Teléfono-entrada');
        const phone = (phoneEl?.value || '').trim();
        const birthdate = (document.getElementById('fecha-nacimiento-entrada')?.value || '').trim();

        // validaciones
        const faltantes = [];
        if (!email) faltantes.push('correo');
        if (!password) faltantes.push('contraseña');
        if (!confirmPassword) faltantes.push('confirmar contraseña');
        if (!nombre) faltantes.push('nombre');
        if (!apellido) faltantes.push('apellido');
        if (!dui) faltantes.push('DUI');
        if (!phone) faltantes.push('teléfono');
        if (!birthdate) faltantes.push('fecha de nacimiento');
        if (faltantes.length) {
            mostrarAlertaNotificacion('Falta completar: ' + faltantes.join(', ') + '.', 'warning');
            return;
        }

        if (!/^[0-9]{8}-[0-9]$/.test(dui)) {
            mostrarAlertaNotificacion('El DUI debe tener el formato 00000000-0.', 'warning');
            return;
        }

        if (!/^[0-9]{4}-[0-9]{4}$/.test(phone)) {
            mostrarAlertaNotificacion('El teléfono debe tener el formato 0000-0000.', 'warning');
            return;
        }

        const fechaNac = new Date(birthdate + 'T00:00:00');
        if (isNaN(fechaNac.getTime()) || fechaNac > new Date()) {
            mostrarAlertaNotificacion('La fecha de nacimiento no es válida.', 'warning');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            mostrarAlertaNotificacion('Por favor, ingresa un correo electrónico con formato válido.', 'warning');
            return;
        }

        if (password.length < 8) {
            mostrarAlertaNotificacion('La contraseña debe tener al menos 8 caracteres.', 'warning');
            return;
        }

        if (password !== confirmPassword) {
            mostrarAlertaNotificacion('Las contraseñas ingresadas no coinciden.', 'warning');
            return;
        }

        if (nombre.length > 50 || apellido.length > 50) {
            mostrarAlertaNotificacion('El nombre y apellido no pueden exceder 50 caracteres.', 'warning');
            return;
        }

        const textoOriginal = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="texto-boton-enviar">Creando cuenta...</span>';
        }

        try {
            const resultado = await CredentialsStore.registrarPrimerAdministrador({
                firstName: nombre,
                lastName: apellido,
                email: email,
                password: password,
                dui: dui,
                phone: phone,
                birthdate: birthdate
            });

            if (!resultado.ok) {
                if (resultado.cerrado) {
                    irAlLoginConAviso(resultado.error);
                    return;
                }
                mostrarAlertaNotificacion(resultado.error || 'Error al crear la cuenta', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = textoOriginal;
                }
                return;
            }

            // subir foto
            const file = photoInput?.files && photoInput.files[0];
            const idNuevo = resultado.user?.idEmpleado || resultado.user?.id;
            if (file && idNuevo) {
                if (submitBtn) submitBtn.innerHTML = '<span class="texto-boton-enviar">Subiendo foto...</span>';
                try {
                    const form = new FormData();
                    form.append('file', file);
                    await apiFetch(`/empleados/${idNuevo}/foto`, { method: 'POST', body: form });
                } catch (fotoErr) {
                    mostrarAlertaNotificacion('La cuenta se creó, pero la foto no se pudo subir: ' + fotoErr.message, 'warning');
                }
            }

            // sesion iniciada
            mostrarAlertaNotificacion('¡Cuenta de administrador creada!', 'success');
            setTimeout(() => {
                window.location.href = './pantalla-carga.html';
            }, 1200);
        } catch (err) {
            mostrarAlertaNotificacion(err.message || 'Error al conectar con el servidor', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = textoOriginal;
            }
        }
    });
});
