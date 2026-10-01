

(function () {
    'use strict';

    
    function addRipple(event) {
        const button = event.currentTarget;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);

        ripple.className = 'onda';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';

        button.style.overflow = 'hidden';
        if (window.getComputedStyle(button).position === 'static') {
            button.style.position = 'relative';
        }

        button.appendChild(ripple);

        const remover = function () {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        };
        ripple.addEventListener('animationend', remover);
        setTimeout(remover, 450);
    }

    function attachRipples() {
        const selector = '.btn-agregar, .btn-guardar, .inicio, .boton-enviar, .boton-pestana, .btn-editar, .btn-eliminar, ' +
            '.btn-cancelar, .boton-cancelar, .boton-aceptar, .btn-guardar, .btn-renovar, .btn-mini, .btn-volver, ' +
            '.boton-guardar-registro-Infracción, .boton-cancelar-registro-Infracción, .ovl-btn-apply, .ovl-btn-cancelar, ' +
            '.qr-btn-scan, .boton-permitir-qr, .boton-denegar-qr, .boton-infracciones-qr, .boton-volver-qr, ' +
            '.qr-motivo-btn-cancelar, .qr-motivo-btn-confirmar';
        document.querySelectorAll(selector).forEach(function (btn) {
            if (btn.dataset.kpRipple) return; 
            btn.dataset.kpRipple = '1';
            btn.addEventListener('click', addRipple);
        });
    }

    
    function staggerChildren(container) {
        if (!container) return;
        Array.from(container.children).forEach(function (child, i) {
            child.style.setProperty('--i', i);
        });
    }

    function staggerAllKnownContainers() {
        document.querySelectorAll('.datos-tabla tbody, .tabla-visitas tbody, .empleado-cuadricula, .filas-en-cascada')
            .forEach(staggerChildren);
    }

    
    function watchForRerenders() {
        const targets = document.querySelectorAll('#tabla-cuerpo, #empleado-cuadricula, #cuerpo-tabla-no-programadas, #cuerpo-tabla-rechazados');
        if (!targets.length) return;

        const observer = new MutationObserver(function () {
            staggerAllKnownContainers();
            attachRipples();
        });

        targets.forEach(function (el) {
            observer.observe(el, { childList: true });
        });
    }

    
    function animateClose(capa) {
        capa.classList.add('cerrando');
        window.setTimeout(function () {
            capa.classList.remove('activo');
            capa.classList.remove('cerrando');
        }, 220);
    }

    
    const OVERLAY_SELECTOR = '.panel-capa, .capa-modal, .qr-panel-capa, .infp-capa, .capa-bg';

    function isOverlayLockable(el) {
        return el && el.classList && el.matches && el.matches(OVERLAY_SELECTOR);
    }

    function syncOverlayScrollLock() {
        if (!window.bloqueoDesplazamiento) return;
        const anyActive = !!document.querySelector(
            '.panel-capa.activo, .capa-modal.activo, .qr-panel-capa.activo, .infp-capa.activo, .capa-bg.activo'
        );
        if (anyActive) {
            if (!document.body.dataset.kpOverlayLocked) {
                document.body.dataset.kpOverlayLocked = '1';
                window.bloqueoDesplazamiento.lock();
            }
        } else if (document.body.dataset.kpOverlayLocked) {
            delete document.body.dataset.kpOverlayLocked;
            window.bloqueoDesplazamiento.unlock();
        }
    }

    
    function watchOverlays() {
        
        const classObserver = new MutationObserver(function (mutations) {
            const touched = mutations.some(function (m) { return isOverlayLockable(m.target); });
            if (touched) syncOverlayScrollLock();
        });

        document.querySelectorAll(OVERLAY_SELECTOR).forEach(function (capa) {
            classObserver.observe(capa, { attributes: true, attributeFilter: ['class'] });
        });

        
        const bodyObserver = new MutationObserver(function (mutations) {
            let relevant = false;
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1 && isOverlayLockable(node)) {
                        relevant = true;
                        classObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
                    }
                });
                m.removedNodes.forEach(function (node) {
                    if (node.nodeType === 1 && isOverlayLockable(node)) relevant = true;
                });
            });
            if (relevant) syncOverlayScrollLock();
        });
        bodyObserver.observe(document.body, { childList: true });

        syncOverlayScrollLock();
    }

    
    window.kpCloseOverlay = animateClose;

    
    let toastTimer = null;
    const TOAST_ICONS = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'i'
    };

    window.mostrarAviso = function (message, type) {
        const tipo = TOAST_ICONS[type] ? type : (type === 'error' ? 'error' : 'success');

        let toast = document.querySelector('.aviso');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'aviso';
            toast.innerHTML = '<span class="aviso-icono"></span><span class="aviso-mensaje"></span>';
            document.body.appendChild(toast);
        }

        toast.querySelector('.aviso-mensaje').textContent = message;
        toast.querySelector('.aviso-icono').textContent = TOAST_ICONS[tipo];
        toast.classList.remove('error', 'exito', 'advertencia', 'info');
        toast.classList.add(tipo === 'error' ? 'error' : tipo === 'warning' ? 'advertencia' : tipo === 'info' ? 'info' : 'exito');

        
        toast.classList.remove('visible');
        void toast.offsetWidth;
        toast.classList.add('visible');

        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toast.classList.remove('visible');
        }, 2600);
    };

    
    window.alertaNativa = window.alert ? window.alert.bind(window) : null;
    window.alert = function (message) {
        if (typeof mostrarAlertaNotificacion === 'function') {
            mostrarAlertaNotificacion(message, 'warning');
        } else if (typeof window.mostrarAviso === 'function') {
            window.mostrarAviso(message, 'warning');
        }
    };

    
    window.confirmarAccion = function (mensaje, opciones) {
        opciones = opciones || {};
        return new Promise(function (resolve) {
            const capa = document.createElement('div');
            capa.className = 'capa-modal confirmar-capa';

            capa.innerHTML = `
                <div class="tarjeta-modal confirmar-tarjeta">
                    <div class="icono-modal confirmar-icono">
                        <span>${opciones.icono || '⚠'}</span>
                    </div>
                    <p class="texto-modal">${mensaje}</p>
                    <div class="acciones-modal">
                        <button type="button" class="boton-cancelar confirmar-cancelar">
                            ${opciones.textoCancelar || 'Cancelar'}
                             <span class="modal-btn-icono modal-btn-icono-cancelar">
                                 <img src="../img/logo-Global.png" alt="Icono cancelar" class="modal-btn-icono-img" style="display:none;">
                             </span>
                         </button>
                         <button type="button" class="boton-aceptar confirmar-aceptar${opciones.peligroso ? ' confirmar-peligro' : ''}">
                             ${opciones.textoAceptar || 'Aceptar'}
                             <span class="modal-btn-icono modal-btn-icono-accept">
                                 <img src="../img/logo-Global.png" alt="Icono aceptar" class="modal-btn-icono-img" style="display:none;">
                            </span>
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(capa);
            
            
            void capa.offsetWidth;
            capa.classList.add('activo');

            function cerrar(resultado) {
                capa.classList.add('cerrando');
                capa.classList.remove('activo');
                window.setTimeout(function () { capa.remove(); }, 220);
                resolve(resultado);
            }

            capa.querySelector('.confirmar-cancelar').addEventListener('click', function () { cerrar(false); });
            capa.querySelector('.confirmar-aceptar').addEventListener('click', function () { cerrar(true); });
            capa.addEventListener('click', function (e) { if (e.target === capa) cerrar(false); });

            function onKey(e) {
                if (e.key === 'Escape') { cerrar(false); document.removeEventListener('keydown', onKey); }
                if (e.key === 'Enter') { cerrar(true); document.removeEventListener('keydown', onKey); }
            }
            document.addEventListener('keydown', onKey);
        });
    };

    
    function mensajeValidacion(campo) {
        if (campo.validity.customError) return campo.validationMessage;
        if (campo.validity.valueMissing) {
            const etiqueta = document.querySelector(`label[for="${campo.id}"]`);
            const nombre = (etiqueta && etiqueta.textContent.trim()) || campo.placeholder || 'este campo';
            return `Completa "${nombre}" antes de continuar.`;
        }
        if (campo.validity.typeMismatch || campo.validity.patternMismatch) {
            return campo.title || 'El formato de este campo no es válido.';
        }
        if (campo.validity.tooShort) return `Escribe al menos ${campo.getAttribute('minlength')} caracteres.`;
        if (campo.validity.rangeUnderflow || campo.validity.rangeOverflow) {
            return campo.type === 'date' ? 'Revisa la fecha.' : `El valor debe estar entre ${campo.min || 0} y ${campo.max || '...'}.`;
        }
        return campo.validationMessage || 'Revisa este campo antes de continuar.';
    }

    document.addEventListener('invalid', function (e) {
        const campo = e.target;
        if (!('validity' in campo)) return;
        e.preventDefault();

        campo.classList.add('invalido');
        campo.addEventListener('input', function quitarInvalido() {
            campo.classList.remove('invalido');
            campo.removeEventListener('input', quitarInvalido);
        });
        campo.addEventListener('animationend', function () {
            campo.classList.remove('invalido-vibracion');
        }, { once: true });
        campo.classList.add('invalido-vibracion');
        campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        campo.focus({ preventScroll: true });

        if (window.mostrarAviso) window.mostrarAviso(mensajeValidacion(campo), 'warning');
    }, true);

    
    document.addEventListener('DOMContentLoaded', function () {
        attachRipples();
        staggerAllKnownContainers();
        watchForRerenders();
        watchOverlays();
    });
})();

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.tarjeta-estadistica, .panel-card, .tarjeta-formulario, .envoltura-tabla')
        .forEach(function (elemento, indice) {
            elemento.style.setProperty('--indice-animacion', indice);
            elemento.classList.add('animar-entrada');
        });
});
