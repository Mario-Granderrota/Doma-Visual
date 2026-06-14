/*
Doma Visual · Versión 0
Módulo: captura de errores, confirmaciones internas y diagnóstico local.
Dependencias: todos los módulos; estado aporta la recuperación de copias.

Invariantes:
- Los errores globales reales no se ocultan mediante filtros genéricos.
- Los textos variables se asignan con textContent.
- El diagnóstico se descarga localmente y no se envía a ningún servidor.
- Un fallo del propio diagnóstico no debe provocar una segunda excepción.
*/

(() => {
"use strict";

const CLAVE_LOG = "doma_visual_log_errores_v1";
const MAX_REGISTROS = 60;
let registros = [];
let panelCreado = false;

function ahora() {
    return new Date().toISOString();
}

function cargarLog() {
    try {
        const texto = sessionStorage.getItem(CLAVE_LOG);
        registros = texto ? JSON.parse(texto) : [];
        if (!Array.isArray(registros)) registros = [];
    } catch (_) {
        registros = [];
    }
}

function guardarLog() {
    try {
        sessionStorage.setItem(CLAVE_LOG, JSON.stringify(registros.slice(-MAX_REGISTROS)));
    } catch (_) {
        // El diagnóstico nunca debe provocar un segundo error.
    }
}

function textoErrorSeguro(valor) {
    if (typeof valor === "string") return valor;
    try {
        const texto = JSON.stringify(valor);
        return texto === undefined ? String(valor) : texto;
    } catch (_) {
        try { return String(valor); } catch (_) { return "Error sin representación legible"; }
    }
}

function datosDiagnosticoSeguros(datos) {
    if (datos === null || datos === undefined) return null;
    const texto = textoErrorSeguro(datos);
    // Un objeto de contexto gigantesco no debe impedir guardar ni descargar el propio log.
    return texto.length > 12000 ? `${texto.slice(0, 12000)}… [recortado]` : texto;
}

function normalizarError(error) {
    if (error instanceof Error) {
        return {
            nombre: error.name || "Error",
            mensaje: error.message || "Error sin mensaje",
            pila: error.stack || ""
        };
    }
    return {
        nombre: "Error",
        mensaje: textoErrorSeguro(error),
        pila: ""
    };
}

function registrar(error, contexto = "sin contexto", gravedad = "error", datos = null) {
    const normalizado = normalizarError(error);
    const registro = {
        fecha: ahora(),
        gravedad,
        contexto,
        ...normalizado,
        datos: datosDiagnosticoSeguros(datos)
    };
    registros.push(registro);
    registros = registros.slice(-MAX_REGISTROS);
    guardarLog();
    console[gravedad === "aviso" ? "warn" : "error"](`[Doma Visual · ${contexto}]`, error);
    return registro;
}

function crearPanel() {
    if (panelCreado) return;
    panelCreado = true;

    const panel = document.createElement("section");
    panel.id = "panelErrorGlobal";
    panel.className = "panel-error-global oculto";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = `
        <div class="panel-error-contenido">
            <span class="panel-error-icono">🛟</span>
            <div>
                <h2>Doma Visual ha protegido el proyecto</h2>
                <p id="mensajeErrorGlobal">Se ha producido un error inesperado.</p>
                <details>
                    <summary>Información técnica</summary>
                    <pre id="detalleErrorGlobal"></pre>
                </details>
                <div class="panel-error-acciones">
                    <button type="button" id="continuarError">Continuar</button>
                    <button type="button" id="recuperarError">Recuperar copia segura</button>
                    <button type="button" id="descargarError">Descargar diagnóstico</button>
                </div>
            </div>
        </div>`;
    document.body.append(panel);

    panel.querySelector("#continuarError").addEventListener("click", () => {
        panel.classList.add("oculto");
    });
    panel.querySelector("#recuperarError").addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("doma:solicitar-recuperacion"));
        panel.classList.add("oculto");
    });
    panel.querySelector("#descargarError").addEventListener("click", descargarDiagnostico);
}

function mostrarProteccion(registro) {
    if (!document.body) return;
    crearPanel();
    const panel = document.getElementById("panelErrorGlobal");
    document.getElementById("mensajeErrorGlobal").textContent =
        "La operación no se ha completado. El último estado válido se conserva.";
    document.getElementById("detalleErrorGlobal").textContent =
        `${registro.contexto}\n${registro.nombre}: ${registro.mensaje}\n${registro.pila || ""}`;
    panel.classList.remove("oculto");
}

function intentar(contexto, funcion, alternativa = null, opciones = {}) {
    try {
        return funcion();
    } catch (error) {
        const registro = registrar(error, contexto, opciones.gravedad || "error", opciones.datos || null);
        if (opciones.mostrar !== false) mostrarProteccion(registro);
        if (typeof alternativa === "function") return alternativa(error);
        return alternativa;
    }
}

function proteger(contexto, funcion, opciones = {}) {
    return function funcionProtegida(...argumentos) {
        return intentar(contexto, () => funcion.apply(this, argumentos), opciones.alternativa, opciones);
    };
}

function requerirElemento(id, opcional = false) {
    const elemento = document.getElementById(id);
    if (!elemento && !opcional) {
        throw new Error(`Falta el elemento obligatorio #${id}. La instalación puede estar incompleta.`);
    }
    return elemento;
}



/*
La confirmación interna sustituye a window.confirm(). En PWA móviles, el diálogo nativo
puede quedar oculto, ser bloqueado por el sistema o mostrarse fuera de contexto.
La aplicación controla aquí el foco, el texto y el resultado de la operación destructiva.
*/
let dialogoConfirmacion = null;
let resolverConfirmacion = null;

function crearDialogoConfirmacion() {
    if (dialogoConfirmacion) return dialogoConfirmacion;
    const dialogo = document.createElement("dialog");
    dialogo.id = "dialogoConfirmacionDoma";
    dialogo.className = "dialogo-confirmacion-doma";
    dialogo.innerHTML = `
        <form method="dialog" class="dialogo-confirmacion-contenido">
            <span class="dialogo-confirmacion-icono" aria-hidden="true">⚠️</span>
            <div>
                <h2 id="tituloConfirmacionDoma">Confirmar acción</h2>
                <p id="mensajeConfirmacionDoma"></p>
                <div class="dialogo-confirmacion-acciones">
                    <button type="button" id="cancelarConfirmacionDoma" value="cancel">Cancelar</button>
                    <button type="button" id="aceptarConfirmacionDoma" value="default" class="peligro-confirmado">Confirmar</button>
                </div>
            </div>
        </form>`;
    document.body.append(dialogo);

    const cerrar = resultado => {
        if (dialogo.open) dialogo.close();
        const resolver = resolverConfirmacion;
        resolverConfirmacion = null;
        if (resolver) resolver(resultado);
    };

    dialogo.querySelector("#cancelarConfirmacionDoma").addEventListener("click", evento => {
        evento.preventDefault();
        cerrar(false);
    });
    dialogo.querySelector("#aceptarConfirmacionDoma").addEventListener("click", evento => {
        evento.preventDefault();
        cerrar(true);
    });
    dialogo.addEventListener("cancel", evento => {
        evento.preventDefault();
        cerrar(false);
    });
    dialogoConfirmacion = dialogo;
    return dialogo;
}

function confirmar({ titulo = "Confirmar acción", mensaje = "", confirmarTexto = "Confirmar" } = {}) {
    return new Promise(resolver => {
        if (resolverConfirmacion) resolverConfirmacion(false);
        resolverConfirmacion = resolver;
        const dialogo = crearDialogoConfirmacion();
        if (dialogo.open) dialogo.close();
        dialogo.querySelector("#tituloConfirmacionDoma").textContent = titulo;
        dialogo.querySelector("#mensajeConfirmacionDoma").textContent = mensaje;
        dialogo.querySelector("#aceptarConfirmacionDoma").textContent = confirmarTexto;
        dialogo.showModal();
        setTimeout(() => dialogo.querySelector("#cancelarConfirmacionDoma").focus(), 0);
    });
}

function descargarDiagnostico() {
    const estado = window.DOMA_ESTADO?.resumenDiagnostico?.() || null;
    const diagnostico = {
        generado: ahora(),
        navegador: navigator.userAgent,
        direccion: location.href,
        viewport: {
            ancho: window.innerWidth,
            alto: window.innerHeight,
            visual: window.visualViewport
                ? { ancho: visualViewport.width, alto: visualViewport.height, escala: visualViewport.scale }
                : null
        },
        estado,
        errores: registros
    };
    const blob = new Blob([JSON.stringify(diagnostico, null, 2)], { type: "application/json" });
    const enlace = document.createElement("a");
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = "doma_visual_diagnostico.json";
    enlace.hidden = true;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

cargarLog();

window.addEventListener("error", evento => {
    const registro = registrar(evento.error || evento.message, "error global de JavaScript");
    mostrarProteccion(registro);
});

window.addEventListener("unhandledrejection", evento => {
    evento.preventDefault();
    const registro = registrar(evento.reason, "promesa rechazada sin gestionar");
    mostrarProteccion(registro);
});

window.DOMA_ERRORES = {
    registrar,
    intentar,
    proteger,
    requerirElemento,
    mostrarProteccion,
    confirmar
};
})();
