/*
Doma Visual · Versión 0
Módulo: composición adaptable y orientación visual de la pista.
Dependencias: estilos, aplicación, editor y pista.

Invariantes:
- CSS resuelve la altura principal mediante 100svh.
- visualViewport solo se consulta para detectar el teclado virtual.
- No se usa ResizeObserver sobre la room.
- La orientación visual nunca modifica las coordenadas ni el proyecto guardado.
- El móvil horizontal usa pista apaisada; medio y amplio emplean histéresis 1,15/1,05.
*/

(() => {
"use strict";

let temporizador = 0;
let temporizadorTransicion = 0;
let preparado = false;
let modoAnterior = "";
let orientacionPista = "vertical";
let bajoAnterior = null;
let tactilAnterior = null;
let hoverAnterior = null;
let tecladoAnterior = null;
let alturaSinTeclado = 0;

function esCampoEditable(elemento) {
    return Boolean(elemento && elemento.matches?.("input, textarea, select, [contenteditable='true']"));
}

function dimensionesEstables() {
    const ancho = Math.max(320, document.documentElement.clientWidth || window.innerWidth || 320);
    const alto = Math.max(320, document.documentElement.clientHeight || window.innerHeight || 320);
    return { ancho, alto };
}

function calcularModo(ancho, alto) {
    if (ancho >= 1180 && alto >= 580) return "amplio";
    if (ancho >= 760 && alto >= 480) return "medio";
    return "compacto";
}

function aplicarClase(nombre, valor, anterior) {
    if (anterior === valor) return anterior;
    document.body.classList.toggle(nombre, valor);
    return valor;
}

function calcularOrientacionPista(modo, anchoViewport, altoViewport) {
    /*
    El móvil vertical conserva la pista vertical. En móvil horizontal de poca altura, la
    misma decisión desperdiciaba casi toda la anchura y hacía la pista inapreciable; por
    eso el compacto solo puede apaisarse cuando el viewport es realmente panorámico.
    */
    const compactoPanoramico = modo === "compacto"
        && document.body.classList.contains("layout-bajo")
        && anchoViewport > altoViewport;
    if (compactoPanoramico) return "horizontal";
    if (modo === "compacto") return "vertical";

    const marco = document.getElementById("marcoPista");
    if (!marco) return orientacionPista;
    const rectangulo = marco.getBoundingClientRect();
    if (rectangulo.width < 1 || rectangulo.height < 1) return orientacionPista;

    const proporcionDisponible = rectangulo.width / rectangulo.height;
    const umbralActivacion = 1.15;
    const umbralRetorno = 1.05;
    const umbral = orientacionPista === "horizontal" ? umbralRetorno : umbralActivacion;
    return proporcionDisponible >= umbral ? "horizontal" : "vertical";
}

function aplicarOrientacionPista(nuevaOrientacion) {
    if (nuevaOrientacion === orientacionPista) return;
    orientacionPista = nuevaOrientacion;
    document.body.dataset.pistaVisual = nuevaOrientacion;
    window.dispatchEvent(new CustomEvent("doma:orientacion-pista", {
        detail:{ orientacion:nuevaOrientacion }
    }));
}

function medirAhora() {
    if (!document.body) return;
    const { ancho, alto } = dimensionesEstables();
    const modo = calcularModo(ancho, alto);
    const bajo = alto < 560;
    const tactil = matchMedia("(pointer: coarse)").matches;
    const sinHover = !matchMedia("(hover: hover)").matches;

    if (modoAnterior !== modo) {
        modoAnterior = modo;
        document.body.dataset.layout = modo;
    }
    bajoAnterior = aplicarClase("layout-bajo", bajo, bajoAnterior);
    tactilAnterior = aplicarClase("puntero-tactil", tactil, tactilAnterior);
    hoverAnterior = aplicarClase("sin-hover", sinHover, hoverAnterior);

    // getBoundingClientRect fuerza el cálculo después de aplicar data-layout.
    aplicarOrientacionPista(calcularOrientacionPista(modo, ancho, alto));
}

function medirTecladoAhora() {
    if (!document.body) return;
    const visual = window.visualViewport;
    const editable = esCampoEditable(document.activeElement);
    const altoVisual = visual?.height || window.innerHeight || 0;

    if (!editable) {
        alturaSinTeclado = Math.max(alturaSinTeclado, altoVisual);
        tecladoAnterior = aplicarClase("teclado-abierto", false, tecladoAnterior);
        return;
    }

    if (!alturaSinTeclado) alturaSinTeclado = Math.max(window.innerHeight || 0, altoVisual);
    const abierto = alturaSinTeclado - altoVisual > 120;
    tecladoAnterior = aplicarClase("teclado-abierto", abierto, tecladoAnterior);
}

function solicitarMedicion(retardo = 90) {
    clearTimeout(temporizador);
    temporizador = window.setTimeout(() => {
        temporizador = 0;
        DOMA_ERRORES.intentar("medición responsive estable", medirAhora, null, { mostrar:false });
        DOMA_ERRORES.intentar("detección estable del teclado", medirTecladoAhora, null, { mostrar:false });
    }, retardo);
}

function medirTrasTransicion() {
    clearTimeout(temporizadorTransicion);
    temporizadorTransicion = window.setTimeout(() => solicitarMedicion(0), 260);
}

function abrirEdicion() {
    document.body.classList.add("edicion-abierta");
    document.body.classList.remove("vista-limpia");
    solicitarMedicion(0);
    medirTrasTransicion();
}

function cerrarEdicion() {
    document.body.classList.remove("edicion-abierta");
    solicitarMedicion(0);
    medirTrasTransicion();
}

function alternarVistaLimpia() {
    document.body.classList.toggle("vista-limpia");
    document.body.classList.remove("edicion-abierta");
    solicitarMedicion(0);
    medirTrasTransicion();
}

function obtenerOrientacionPista() {
    return orientacionPista;
}

function inicializar() {
    if (preparado) {
        solicitarMedicion(0);
        return;
    }
    preparado = true;
    document.body.dataset.pistaVisual = orientacionPista;
    alturaSinTeclado = window.visualViewport?.height || window.innerHeight || 0;
    medirAhora();

    window.addEventListener("resize", () => solicitarMedicion(140), { passive:true });
    window.addEventListener("orientationchange", () => solicitarMedicion(260), { passive:true });
    window.addEventListener("fullscreenchange", () => solicitarMedicion(120), { passive:true });
    window.visualViewport?.addEventListener("resize", () => {
        if (esCampoEditable(document.activeElement)) solicitarMedicion(120);
    }, { passive:true });
    document.addEventListener("focusin", () => solicitarMedicion(120), { passive:true });
    document.addEventListener("focusout", () => solicitarMedicion(180), { passive:true });
}

window.DOMA_LAYOUT = {
    inicializar,
    abrirEdicion,
    cerrarEdicion,
    alternarVistaLimpia,
    obtenerOrientacionPista
};
})();
