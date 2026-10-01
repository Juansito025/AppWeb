// validaciones y mascaras de formularios
(function () {
    var movil = false;
    var pagina = (location.pathname.split('/').pop() || '').toLowerCase();
    var paginasLugar = ['casetas.html', 'propiedades.html', 'turnos.html'];

    var LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;
    var CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

    function hoyISO(restarAnios) {
        var d = new Date();
        if (restarAnios) d.setFullYear(d.getFullYear() - restarAnios);
        var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    // mascaras
    function soloDigitos(v, max) { return String(v || '').replace(/\D/g, '').slice(0, max); }
    var MASCARAS = {
        dui: function (v) {
            var n = soloDigitos(v, 9);
            return n.length > 8 ? n.slice(0, 8) + '-' + n.slice(8) : n;
        },
        telefono: function (v) {
            var n = soloDigitos(v, 8);
            return n.length > 4 ? n.slice(0, 4) + '-' + n.slice(4) : n;
        },
        placa: function (v) {
            var t = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            var m = t.match(/^([A-Z]{0,2})(.*)$/);
            var pre = m[1], cuerpo = m[2].replace(/[^0-9A-F]/g, '').slice(0, 6);
            return cuerpo.length > 3 ? pre + cuerpo.slice(0, 3) + '-' + cuerpo.slice(3) : pre + cuerpo;
        },
        codigo: function (v) { return soloDigitos(v, 6); },
        usuario: function (v) { return /^[\d-]+$/.test(v) ? MASCARAS.dui(v) : v; },
        persona: function (v) { return String(v || '').replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' '); }
    };

    // reglas por campo
    function tipoCampo(el) {
        var id = (el.id || '').toLowerCase();
        var tipo = (el.getAttribute('type') || 'text').toLowerCase();
        if (/busc|busqueda|filtro/.test(id) || tipo === 'search' || tipo === 'hidden') return null;
        if (id === 'entrada-correo' && tipo === 'text') return 'usuario';
        if (/dui/.test(id) && tipo !== 'email') return 'dui';
        if (/telefono|teléfono/.test(id)) return 'telefono';
        if (/placa|matricula|matrícula/.test(id)) return 'placa';
        if (id === 'recuperar-codigo') return 'codigo';
        if (tipo === 'email') return 'correo';
        if (tipo === 'password') {
            if (/confirmar/.test(id)) return 'confirmar';
            if (pagina === 'index.html' || pagina === '') return null;
            return 'clave';
        }
        if (tipo === 'date') {
            if (/nacimiento/.test(id)) return /agregar|detalle|cred/.test(id) ? 'nacimiento-adulto' : 'nacimiento';
            if (/limite/.test(id)) return 'fecha-futura';
            return null;
        }
        if (/(^|-)(nombre|apellido)(-|$)/.test(id) && tipo === 'text' || /^(visita|vsc|input-edit|residente|er|entrada)-(nombre|apellido)$|^(nombre|apellido)-entrada$/.test(id)) {
            if (/turno/.test(id) || paginasLugar.indexOf(pagina) >= 0) return null;
            return 'persona';
        }
        if (/marca|modelo/.test(id)) return 'vehiculo';
        if (/costo|monto/.test(id)) return 'monto';
        return null;
    }

    var CONFIRMA = {
        'cred-contrasena-confirmar': 'cred-contrasena',
        'confirmar-nuevo-contrasena': 'nuevo-contrasena',
        'confirmar-contrasena-entrada': 'entrada-contrasena',
        'pass-confirmar': 'pass-nueva'
    };

    // limite de caracteres para todo campo que no tenga uno propio
    var LIMITE_TEXTO = 100, LIMITE_AREA = 500;
    function limiteBase(el) {
        if (el._kvLimite) return;
        el._kvLimite = true;
        if (el.hasAttribute('maxlength')) return;
        var tipo = (el.getAttribute('type') || 'text').toLowerCase();
        if (el.tagName === 'TEXTAREA') el.setAttribute('maxlength', String(LIMITE_AREA));
        else if (['text', 'email', 'search', 'tel', 'url', 'password'].indexOf(tipo) >= 0) el.setAttribute('maxlength', String(LIMITE_TEXTO));
    }

    function preparar(el) {
        limiteBase(el);
        if (el._kv) return;
        var t = tipoCampo(el);
        if (!t) return;
        el._kv = t;
        var poner = function (a, v) { if (!el.hasAttribute(a)) el.setAttribute(a, v); };
        if (t === 'dui') { el.setAttribute('maxlength', '10'); el.setAttribute('inputmode', 'numeric'); poner('placeholder', '00000000-0'); el.removeAttribute('pattern'); }
        if (t === 'telefono') { el.setAttribute('maxlength', '9'); el.setAttribute('inputmode', 'numeric'); poner('placeholder', '0000-0000'); el.removeAttribute('pattern'); }
        if (t === 'placa') { el.setAttribute('maxlength', '9'); el.setAttribute('autocapitalize', 'characters'); poner('placeholder', 'P123-456'); el.removeAttribute('pattern'); }
        if (t === 'codigo') { el.setAttribute('maxlength', '6'); el.setAttribute('inputmode', 'numeric'); }
        if (t === 'correo') poner('maxlength', '100');
        if (t === 'clave' || t === 'confirmar') { poner('maxlength', '100'); el.setAttribute('minlength', '8'); }
        if (t === 'persona') { var max = Number(el.getAttribute('maxlength')) || 0; if (!max || max > 80) el.setAttribute('maxlength', /input-edit/.test(el.id) ? '101' : '50'); }
        if (t === 'vehiculo') poner('maxlength', '20');
        if (t === 'nacimiento') { el.setAttribute('max', hoyISO(0)); poner('min', '1900-01-01'); }
        if (t === 'nacimiento-adulto') { el.setAttribute('max', hoyISO(18)); poner('min', '1900-01-01'); }
        if (t === 'fecha-futura') el.setAttribute('min', hoyISO(0));
        if (t === 'monto') { poner('min', '0.01'); poner('max', '10000'); poner('step', '0.01'); }
    }

    function mensaje(el) {
        var t = el._kv, v = (el.value || '').trim();
        if (!v) return '';
        switch (t) {
            case 'dui':
                if (!/^\d{8}-\d$/.test(v)) return 'El DUI debe tener 9 números: 00000000-0';
                if (/^0{8}/.test(v)) return 'El DUI no es válido';
                return '';
            case 'telefono':
                if (!/^\d{4}-\d{4}$/.test(v)) return 'El teléfono debe tener 8 números: 0000-0000';
                if (!/^[267]/.test(v)) return 'El teléfono debe empezar con 2, 6 o 7';
                return '';
            case 'placa':
                return /^[A-Z]{1,2}[0-9A-F]{3}-[0-9A-F]{3}$/.test(v) ? '' : 'La placa debe tener el formato P123-456';
            case 'codigo':
                return /^\d{6}$/.test(v) ? '' : 'El código tiene 6 números';
            case 'correo':
                return CORREO.test(v) ? '' : 'Escribe un correo válido, por ejemplo nombre@correo.com';
            case 'clave':
                return errorContrasena(v);
            case 'confirmar':
                var otra = document.getElementById(CONFIRMA[el.id] || '');
                return otra && otra.value !== el.value ? 'Las contraseñas no coinciden' : '';
            case 'persona':
                if (!LETRAS.test(v)) return 'Solo se permiten letras y espacios';
                if (v.replace(/\s/g, '').length < 2) return 'Escribe al menos 2 letras';
                return '';
            case 'vehiculo':
                return /^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ .\-]+$/.test(v) ? '' : 'Solo letras, números, espacios o guion';
            case 'nacimiento':
                if (v > hoyISO(0)) return 'La fecha de nacimiento no puede ser futura';
                if (v < '1900-01-01') return 'Revisa el año de nacimiento';
                return '';
            case 'nacimiento-adulto':
                if (v > hoyISO(18)) return 'El empleado debe ser mayor de edad';
                if (v < '1900-01-01') return 'Revisa el año de nacimiento';
                return '';
            case 'fecha-futura':
                return v < hoyISO(0) ? 'La fecha no puede ser anterior a hoy' : '';
            case 'monto':
                var n = Number(v);
                if (!(n > 0)) return 'El monto debe ser mayor a 0';
                if (n > 10000) return 'El monto es demasiado alto';
                return /^\d+(\.\d{1,2})?$/.test(v) ? '' : 'Usa máximo 2 decimales';
        }
        return '';
    }

    function revisarCampo(el) {
        preparar(el);
        if (!el._kv) return true;
        if (MASCARAS[el._kv] && el.value) {
            var f = MASCARAS[el._kv](el.value);
            if (f !== el.value) el.value = f;
        }
        if (el._kv === 'persona' && el.value) el.value = el.value.replace(/\s{2,}/g, ' ');
        var m = el.disabled ? '' : mensaje(el);
        el.setCustomValidity(m);
        if (!m) quitarError(el);
        return !m;
    }

    // mensaje debajo del campo (app movil) o aviso (web)
    function mostrarError(el, texto) {
        el.classList.add('invalido');
        if (!movil) return;
        var s = el._kvMsg;
        if (!s) {
            s = document.createElement('small');
            s.className = 'error-campo';
            el.insertAdjacentElement('afterend', s);
            el._kvMsg = s;
        }
        s.textContent = texto;
    }
    function quitarError(el) {
        el.classList.remove('invalido');
        if (el._kvMsg) { el._kvMsg.remove(); el._kvMsg = null; }
    }

    function textoValidez(el) {
        var v = el.validity;
        if (v.customError) return el.validationMessage;
        if (v.valueMissing) return 'Este campo es obligatorio';
        if (v.tooShort) return 'Escribe al menos ' + el.getAttribute('minlength') + ' caracteres';
        if (v.rangeUnderflow) return el.type === 'date' ? 'La fecha es muy antigua o anterior a hoy' : 'El valor mínimo es ' + el.min;
        if (v.rangeOverflow) return el.type === 'date' ? 'La fecha no es válida' : 'El valor máximo es ' + el.max;
        if (v.typeMismatch || v.patternMismatch) return el.title || 'El formato no es válido';
        return el.validationMessage || 'Revisa este campo';
    }

    function revisarFormulario(form) {
        var campos = form.querySelectorAll('input, textarea, select');
        Array.prototype.forEach.call(campos, revisarCampo);
        return form.checkValidity();
    }

    // bloquear lo que no va en el campo antes de que se escriba
    var PERMITIDOS = {
        persona: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]*$/,
        dui: /^[\d-]*$/,
        telefono: /^[\d-]*$/,
        codigo: /^\d*$/
    };
    document.addEventListener('beforeinput', function (e) {
        var el = e.target;
        if (!el.matches || !el.matches('input') || e.data == null) return;
        if (!/^insert/.test(e.inputType || '')) return;
        preparar(el);
        var regla = PERMITIDOS[el._kv];
        if (!regla && el.type === 'number') regla = /^[\d.]*$/;
        if (!regla || regla.test(e.data)) return;
        // al escribir se bloquea la tecla; al pegar se limpia con la mascara
        if (e.data.length === 1 || !MASCARAS[el._kv]) e.preventDefault();
    }, true);

    // eventos
    document.addEventListener('input', function (e) {
        var el = e.target;
        if (!el.matches || !el.matches('input, textarea')) return;
        preparar(el);
        if (!el._kv) return;
        var mascara = MASCARAS[el._kv];
        if (mascara) {
            var pos = el.selectionStart, antes = el.value;
            var valido = el._kv === 'persona' ? /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/ : /[A-Za-z0-9]/;
            var utiles = antes.slice(0, pos).split('').filter(function (c) { return valido.test(c); }).length;
            var nuevo = mascara(antes);
            if (nuevo !== antes) {
                el.value = nuevo;
                var i = 0, cuenta = 0;
                while (i < nuevo.length && cuenta < utiles) { if (valido.test(nuevo[i])) cuenta++; i++; }
                if (nuevo[i] === '-' && i === nuevo.length - 1) i++;
                try { el.setSelectionRange(i, i); } catch (_) { }
            }
        }
        if (el._kvMsg || el.classList.contains('invalido')) {
            var m = mensaje(el);
            el.setCustomValidity(m);
            if (m) mostrarError(el, m); else quitarError(el);
        } else {
            el.setCustomValidity(mensaje(el));
        }
        if (el._kv === 'clave') {
            Object.keys(CONFIRMA).forEach(function (c) {
                if (CONFIRMA[c] === el.id) { var x = document.getElementById(c); if (x && x.value) revisarCampo(x); }
            });
        }
    }, true);

    document.addEventListener('focusout', function (e) {
        var el = e.target;
        if (!el.matches || !el.matches('input, textarea')) return;
        if (el._kv === 'persona' || el._kv === 'vehiculo' || el._kv === 'correo') el.value = el.value.trim();
        if (el._kv && el.value) {
            revisarCampo(el);
            var m = el.validationMessage;
            if (m && el.validity.customError) mostrarError(el, m);
        }
    }, true);

    // antes de que el navegador valide: aplicar mascaras y reglas
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button, input[type="submit"]');
        if (!b || !b.form || (b.type && b.type !== 'submit')) return;
        revisarFormulario(b.form);
    }, true);

    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!revisarFormulario(form)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (form.noValidate) {
                var primero = form.querySelector(':invalid:not(fieldset):not(form)');
                if (primero) primero.dispatchEvent(new Event('invalid', { cancelable: true }));
            }
        }
    }, true);

    document.addEventListener('invalid', function (e) {
        var el = e.target;
        if (!el.validity) return;
        mostrarError(el, textoValidez(el));
        if (movil) {
            e.preventDefault();
            var form = el.form;
            var primero = form ? form.querySelector(':invalid:not(fieldset)') : el;
            if (primero === el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus({ preventScroll: true });
            }
        }
    }, true);

    // al limpiar el formulario se quitan los errores
    document.addEventListener('reset', function (e) {
        Array.prototype.forEach.call(e.target.querySelectorAll('input, textarea, select'), function (el) {
            el.setCustomValidity('');
            quitarError(el);
        });
    }, true);

    function prepararTodo(raiz) {
        Array.prototype.forEach.call((raiz || document).querySelectorAll('input, textarea'), preparar);
    }
    document.addEventListener('focusin', function (e) {
        if (e.target.matches && e.target.matches('input, textarea')) preparar(e.target);
    }, true);
    document.addEventListener('DOMContentLoaded', function () {
        prepararTodo(document);
        new MutationObserver(function (cambios) {
            cambios.forEach(function (c) {
                c.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches('input, textarea')) preparar(n); else prepararTodo(n); } });
            });
        }).observe(document.body, { childList: true, subtree: true });
    });

    // para formularios que guardan sin <form>
    /** regla unica de contrasena: minimo 8 caracteres, con letras y numeros ('' si es valida) */
    function errorContrasena(v) {
        v = String(v || '');
        if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'La contraseña debe tener letras y números';
        return '';
    }
    window.errorContrasena = errorContrasena;

    window.KeeperValida = {
        campo: revisarCampo,
        mensaje: function (el) { preparar(el); return mensaje(el); },
        formatear: function (tipo, v) { return MASCARAS[tipo] ? MASCARAS[tipo](v) : v; },
        revisar: function (ids) {
            var primero = null;
            ids.forEach(function (id) {
                var el = typeof id === 'string' ? document.getElementById(id) : id;
                if (!el || el.disabled || el.offsetParent === null && el.type !== 'hidden' && !el.closest('[open]')) return;
                if (!revisarCampo(el) || !el.checkValidity()) {
                    if (!primero) primero = el;
                }
            });
            if (primero) {
                primero.dispatchEvent(new Event('invalid', { cancelable: true }));
                if (!movil) {
                    primero.classList.add('invalido');
                    primero.focus();
                }
                return false;
            }
            return true;
        }
    };
})();
