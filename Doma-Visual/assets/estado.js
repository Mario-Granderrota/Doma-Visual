/*
Doma Visual · Versión 0
Módulo: estado central, historial y persistencia local protegida.
Dependencias: modelo, errores, editor y aplicación.

Invariantes:
- Toda mutación persistente pasa por transaccion() o sustituirProyecto().
- actualizarInterfaz() solo acepta claves efímeras conocidas.
- El tiempo de animación usa establecerTiempoReproduccion() para evitar emisiones por cuadro.
- El checksum FNV detecta corrupción accidental; no aporta autenticidad criptográfica.
- Una copia dañada solo se repara si no existe ninguna copia íntegra recuperable.
- El historial está limitado a 40 entradas y dura una sesión.
*/

(() => {
"use strict";

const CLAVE_PRINCIPAL = "doma_visual_proyecto_seguro_v1";
const CLAVE_RESPALDO_1 = "doma_visual_respaldo_1_v1";
const CLAVE_RESPALDO_2 = "doma_visual_respaldo_2_v1";
const CLAVE_TEMPORAL = "doma_visual_temporal_v1";
const CLAVE_CONFLICTO = "doma_visual_conflicto_otra_ventana_v1";
const MAX_HISTORIAL = 40;
const MAX_BYTES_HISTORIAL = 8 * 1024 * 1024;
const CLAVES_INTERFAZ = new Set([
    "indiceReproduccion", "indiceEdicion", "tiempo", "modoAprender",
    "repetir", "velocidad"
]);
const COPIAS = [
    { clave:CLAVE_PRINCIPAL, origen:"principal", prioridad:4 },
    { clave:CLAVE_TEMPORAL, origen:"guardado temporal", prioridad:3 },
    { clave:CLAVE_RESPALDO_1, origen:"respaldo 1", prioridad:2 },
    { clave:CLAVE_RESPALDO_2, origen:"respaldo 2", prioridad:1 }
];
const COPIAS_RECUPERABLES = [
    ...COPIAS.filter(copia => copia.clave !== CLAVE_PRINCIPAL),
    { clave:CLAVE_CONFLICTO, origen:"copia de otra ventana", prioridad:4 }
];

const suscriptores = new Set();
const historialAtras = [];
const historialAdelante = [];
let temporizadorGuardado = null;
let almacenamientoDisponible = true;
let checksumPrincipalObservado = "";
let avisoConflictoMostrado = false;

const estado = {
    proyecto: null,
    indiceReproduccion: 0,
    indiceEdicion: 0,
    tiempo: 0,
    modoAprender: false,
    repetir: false,
    velocidad: 1,
    guardadoPendiente: false,
    origenCarga: "ejemplo",
    conflictoExterno: false,
    copiaConflictoDisponible: false
};

function esObjeto(valor) {
    return Boolean(valor && typeof valor === "object" && !Array.isArray(valor));
}

function hash(texto) {
    let valor = 2166136261;
    for (let i = 0; i < texto.length; i++) {
        valor ^= texto.charCodeAt(i);
        valor = Math.imul(valor, 16777619);
    }
    return (valor >>> 0).toString(16).padStart(8, "0");
}

function sobre(proyecto) {
    const texto = JSON.stringify(proyecto);
    return {
        formato: 1,
        guardadoEn: new Date().toISOString(),
        checksum: hash(texto),
        proyecto
    };
}

function fechaGuardado(valor) {
    const fecha = Date.parse(String(valor || ""));
    return Number.isFinite(fecha) ? fecha : 0;
}

/*
Modo estricto: exige el sobre y un checksum correcto.
Modo tolerante: admite un sobre incompleto o un proyecto antiguo guardado directamente,
pero solo si el objeto contiene campos reconocibles de Doma Visual. La normalización
repara tipos, ids y campos parciales sin intentar adivinar un JSON sintácticamente roto.
*/
function analizarContenido(contenido, permitirReparacion = false) {
    const objeto = typeof contenido === "string" ? JSON.parse(contenido) : contenido;
    if (!esObjeto(objeto)) throw new Error("La copia guardada no contiene un objeto válido.");

    const esSobre = esObjeto(objeto.proyecto);
    const entrada = esSobre ? objeto.proyecto : objeto;
    if (!DOMA.esEntradaProyectoReconocible(entrada)) {
        throw new Error("La copia no contiene una estructura reconocible de Doma Visual.");
    }
    DOMA.comprobarPresupuestoProyecto(entrada);

    const checksumCalculado = hash(JSON.stringify(entrada));
    const checksumCorrecto = esSobre
        && typeof objeto.checksum === "string"
        && checksumCalculado === objeto.checksum;
    if (!permitirReparacion && !checksumCorrecto) {
        throw new Error("La copia no supera la comprobación de integridad.");
    }

    return {
        proyecto: DOMA.normalizarProyecto(entrada),
        guardadoEn: fechaGuardado(objeto.guardadoEn),
        checksum: checksumCalculado,
        reparado: !checksumCorrecto
    };
}

function contenidoIntegro(contenido) {
    if (!contenido) return false;
    try {
        analizarContenido(contenido, false);
        return true;
    } catch (_) {
        return false;
    }
}

function checksumContenidoIntegro(contenido) {
    if (!contenido) return "";
    try {
        return analizarContenido(contenido, false).checksum;
    } catch (_) {
        return "";
    }
}

function tamanoAproximadoProyecto(proyecto) {
    try {
        // JavaScript almacena cadenas en UTF-16; dos bytes por unidad es una cota util.
        return JSON.stringify(proyecto).length * 2;
    } catch (_) {
        return MAX_BYTES_HISTORIAL;
    }
}

function bytesHistorial() {
    return [...historialAtras, ...historialAdelante]
        .reduce((total, entrada) => total + Number(entrada.bytes || 0), 0);
}

/*
El limite por numero de pasos no evita que cuarenta proyectos grandes agoten la memoria de
un telefono. Se conserva siempre la instantanea mas reciente y se retiran primero las mas
antiguas, con independencia de que pertenezcan a Deshacer o Rehacer.
*/
function ajustarPresupuestoHistorial() {
    while (historialAtras.length > MAX_HISTORIAL) historialAtras.shift();
    while (historialAdelante.length > MAX_HISTORIAL) historialAdelante.shift();
    while (bytesHistorial() > MAX_BYTES_HISTORIAL
        && historialAtras.length + historialAdelante.length > 1) {
        const atras = historialAtras[0];
        const adelante = historialAdelante[0];
        if (!adelante || (atras && atras.fecha <= adelante.fecha)) historialAtras.shift();
        else historialAdelante.shift();
    }
}

function apilarHistorial(pila, entrada) {
    pila.push(entrada);
    ajustarPresupuestoHistorial();
}

function leerCandidatos(permitirReparacion, descriptores = COPIAS) {
    const candidatos = [];
    for (const descriptor of descriptores) {
        const contenido = localStorage.getItem(descriptor.clave);
        if (!contenido) continue;
        try {
            candidatos.push({
                ...descriptor,
                ...analizarContenido(contenido, permitirReparacion)
            });
        } catch (error) {
            if (!permitirReparacion) {
                DOMA_ERRORES.registrar(error, `lectura de ${descriptor.origen}`, "aviso");
            }
        }
    }
    return candidatos;
}

function elegirMasReciente(candidatos) {
    return candidatos.slice().sort((a, b) =>
        b.guardadoEn - a.guardadoEn || b.prioridad - a.prioridad
    )[0] || null;
}

function comprobarAlmacenamiento() {
    try {
        const prueba = "__doma_prueba__";
        localStorage.setItem(prueba, "1");
        localStorage.removeItem(prueba);
        almacenamientoDisponible = true;
    } catch (error) {
        almacenamientoDisponible = false;
        DOMA_ERRORES.registrar(error, "comprobación de localStorage", "aviso");
    }
}

/*
Promueve una copia recuperada al espacio principal sin rotar respaldos. Así una entrada
principal dañada no desplaza ni sobrescribe una copia buena durante la reparación.
*/
function repararPrincipalSinRotar(proyecto) {
    if (!almacenamientoDisponible) return false;
    return DOMA_ERRORES.intentar("reparación de copia principal", () => {
        const contenido = JSON.stringify(sobre(DOMA.normalizarProyecto(proyecto)));
        localStorage.setItem(CLAVE_TEMPORAL, contenido);
        analizarContenido(localStorage.getItem(CLAVE_TEMPORAL), false);
        localStorage.setItem(CLAVE_PRINCIPAL, contenido);
        analizarContenido(localStorage.getItem(CLAVE_PRINCIPAL), false);
        localStorage.removeItem(CLAVE_TEMPORAL);
        checksumPrincipalObservado = hash(JSON.stringify(proyecto));
        estado.conflictoExterno = false;
        return true;
    }, false, { mostrar:false, gravedad:"aviso" });
}

function cargar() {
    comprobarAlmacenamiento();
    if (almacenamientoDisponible) {
        let elegido = elegirMasReciente(leerCandidatos(false));
        if (!elegido) elegido = elegirMasReciente(leerCandidatos(true));

        if (elegido) {
            estado.proyecto = elegido.proyecto;
            estado.origenCarga = elegido.reparado
                ? `${elegido.origen} reparado`
                : elegido.origen;
            checksumPrincipalObservado = checksumContenidoIntegro(localStorage.getItem(CLAVE_PRINCIPAL));
            if (elegido.clave !== CLAVE_PRINCIPAL || elegido.reparado) {
                repararPrincipalSinRotar(elegido.proyecto);
            } else {
                checksumPrincipalObservado = elegido.checksum;
            }
            estado.copiaConflictoDisponible = Boolean(localStorage.getItem(CLAVE_CONFLICTO));
            emitir("carga");
            return elegido.proyecto;
        }
    }

    estado.proyecto = DOMA.ejemplo();
    estado.origenCarga = "ejemplo";
    guardarAhora(false);
    emitir("carga");
    return estado.proyecto;
}

function conservarConflicto(nuevoContenido) {
    try {
        localStorage.setItem(CLAVE_CONFLICTO, nuevoContenido);
        analizarContenido(localStorage.getItem(CLAVE_CONFLICTO), false);
    } catch (error) {
        DOMA_ERRORES.registrar(error, "copia por conflicto entre ventanas", "aviso");
    }
    estado.conflictoExterno = true;
    estado.copiaConflictoDisponible = true;
    estado.guardadoPendiente = true;
    emitir("conflicto");
    if (!avisoConflictoMostrado) {
        avisoConflictoMostrado = true;
        const error = new Error(
            "Otra ventana o pestaña ha guardado un proyecto diferente. " +
            "Esta edición se conserva como copia recuperable y no sobrescribirá la otra."
        );
        const registro = DOMA_ERRORES.registrar(error, "conflicto entre ventanas", "aviso");
        DOMA_ERRORES.mostrarProteccion(registro);
    }
    return false;
}

function guardarAhora(notificar = true) {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = null;
    if (!estado.proyecto) return false;

    const normalizado = DOMA_ERRORES.intentar("normalizacion previa al guardado", () => {
        DOMA.comprobarPresupuestoProyecto(estado.proyecto);
        return DOMA.normalizarProyecto(estado.proyecto);
    }, null);
    if (!normalizado) {
        estado.guardadoPendiente = true;
        emitir("error-guardado");
        return false;
    }
    estado.proyecto = normalizado;

    if (!almacenamientoDisponible) {
        estado.guardadoPendiente = false;
        if (notificar) DOMA_ERRORES.registrar("El navegador no permite guardar localmente.", "guardado", "aviso");
        emitir("guardado");
        return false;
    }

    return DOMA_ERRORES.intentar("guardado atómico", () => {
        const nuevoSobre = sobre(estado.proyecto);
        const nuevoContenido = JSON.stringify(nuevoSobre);
        const principalAnterior = localStorage.getItem(CLAVE_PRINCIPAL);
        const checksumPrincipalActual = checksumContenidoIntegro(principalAnterior);

        if (checksumPrincipalObservado && checksumPrincipalActual
            && checksumPrincipalActual !== checksumPrincipalObservado
            && checksumPrincipalActual !== nuevoSobre.checksum) {
            return conservarConflicto(nuevoContenido);
        }
        if (checksumPrincipalActual === nuevoSobre.checksum) {
            checksumPrincipalObservado = checksumPrincipalActual;
            estado.conflictoExterno = false;
        }

        // Guardar varias veces el mismo contenido no debe consumir los dos respaldos.
        if (principalAnterior) {
            try {
                const principalVerificado = JSON.parse(principalAnterior);
                if (principalVerificado?.checksum === nuevoSobre.checksum
                    && JSON.stringify(principalVerificado.proyecto) === JSON.stringify(estado.proyecto)
                    && contenidoIntegro(principalAnterior)) {
                    localStorage.removeItem(CLAVE_TEMPORAL);
                    estado.guardadoPendiente = false;
                    checksumPrincipalObservado = nuevoSobre.checksum;
                    estado.conflictoExterno = false;
                    if (notificar) window.DOMA?.avisar?.("Proyecto guardado");
                    emitir("guardado");
                    return true;
                }
            } catch (_) {
                // La copia dañada se sustituirá sin incorporarla a los respaldos.
            }
        }

        localStorage.setItem(CLAVE_TEMPORAL, nuevoContenido);
        analizarContenido(localStorage.getItem(CLAVE_TEMPORAL), false);

        const respaldoAnterior = localStorage.getItem(CLAVE_RESPALDO_1);
        if (contenidoIntegro(respaldoAnterior)) {
            localStorage.setItem(CLAVE_RESPALDO_2, respaldoAnterior);
        }
        if (contenidoIntegro(principalAnterior)) {
            localStorage.setItem(CLAVE_RESPALDO_1, principalAnterior);
        }

        localStorage.setItem(CLAVE_PRINCIPAL, nuevoContenido);
        analizarContenido(localStorage.getItem(CLAVE_PRINCIPAL), false);
        localStorage.removeItem(CLAVE_TEMPORAL);

        checksumPrincipalObservado = nuevoSobre.checksum;
        estado.conflictoExterno = false;
        estado.guardadoPendiente = false;
        if (notificar) window.DOMA?.avisar?.("Proyecto guardado con copia de seguridad");
        emitir("guardado");
        return true;
    }, false);
}

function programarGuardado() {
    estado.guardadoPendiente = true;
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = setTimeout(() => guardarAhora(false), 450);
    emitir("pendiente");
}

function instantanea(descripcion) {
    return {
        descripcion,
        fecha: Date.now(),
        // Los proyectos vigentes no se mutan: cada transaccion crea y sustituye una copia.
        // Guardar la referencia anterior evita duplicar temporalmente proyectos grandes.
        proyecto: estado.proyecto,
        bytes: tamanoAproximadoProyecto(estado.proyecto),
        indiceEdicion: estado.indiceEdicion,
        indiceReproduccion: estado.indiceReproduccion,
        tiempo: estado.tiempo
    };
}

function ajustarIndicesYTiempo() {
    const ultimo = Math.max(0, (estado.proyecto?.definiciones?.length || 1) - 1);
    estado.indiceEdicion = DOMA.limitar(Number(estado.indiceEdicion) || 0, 0, ultimo);
    estado.indiceReproduccion = DOMA.limitar(Number(estado.indiceReproduccion) || 0, 0, ultimo);
    estado.tiempo = DOMA.limitar(Number(estado.tiempo) || 0, 0, DOMA.total(estado.proyecto));
}

function restaurarInstantanea(entrada, motivo) {
    estado.proyecto = DOMA.normalizarProyecto(entrada.proyecto);
    estado.indiceEdicion = entrada.indiceEdicion;
    estado.indiceReproduccion = entrada.indiceReproduccion;
    estado.tiempo = entrada.tiempo;
    ajustarIndicesYTiempo();
    programarGuardado();
    emitir(motivo);
}

function transaccion(descripcion, mutador, opciones = {}) {
    return DOMA_ERRORES.intentar(`transacción: ${descripcion}`, () => {
        if (typeof mutador !== "function") throw new TypeError("La transacción no tiene una operación válida.");
        const anterior = instantanea(descripcion);
        const candidato = DOMA.copiar(estado.proyecto);
        mutador(candidato);
        const normalizado = DOMA.normalizarProyecto(candidato);
        const sinCambios = JSON.stringify(normalizado) === JSON.stringify(estado.proyecto);
        if (sinCambios) return estado.proyecto;

        if (!opciones.sinHistorial) {
            historialAdelante.length = 0;
            apilarHistorial(historialAtras, anterior);
        }

        estado.proyecto = normalizado;
        ajustarIndicesYTiempo();
        programarGuardado();
        emitir("proyecto");
        return normalizado;
    }, null);
}

function deshacer() {
    const entrada = historialAtras.pop();
    if (!entrada) return false;
    apilarHistorial(historialAdelante, instantanea("rehacer"));
    restaurarInstantanea(entrada, "deshacer");
    return true;
}

function rehacer() {
    const entrada = historialAdelante.pop();
    if (!entrada) return false;
    apilarHistorial(historialAtras, instantanea("deshacer"));
    restaurarInstantanea(entrada, "rehacer");
    return true;
}

function recuperarCopiaSegura() {
    if (!almacenamientoDisponible) return false;
    let elegido = elegirMasReciente(leerCandidatos(false, COPIAS_RECUPERABLES));
    if (!elegido) elegido = elegirMasReciente(leerCandidatos(true, COPIAS_RECUPERABLES));
    if (!elegido) return false;

    apilarHistorial(historialAtras, instantanea("antes de recuperar"));
    historialAdelante.length = 0;
    estado.proyecto = elegido.proyecto;
    estado.origenCarga = elegido.reparado
        ? `${elegido.origen} reparado`
        : elegido.origen;
    estado.indiceEdicion = 0;
    estado.indiceReproduccion = 0;
    estado.tiempo = 0;
    checksumPrincipalObservado = checksumContenidoIntegro(localStorage.getItem(CLAVE_PRINCIPAL));
    estado.conflictoExterno = false;
    avisoConflictoMostrado = false;
    const guardado = guardarAhora(false);
    if (guardado && elegido.clave === CLAVE_CONFLICTO) {
        localStorage.removeItem(CLAVE_CONFLICTO);
        estado.copiaConflictoDisponible = false;
    }
    emitir("recuperacion");
    return true;
}

function sustituirProyecto(proyecto, descripcion = "importar proyecto") {
    DOMA.comprobarPresupuestoProyecto(proyecto);
    const normalizado = DOMA.normalizarProyecto(proyecto);
    const anterior = instantanea(descripcion);
    historialAdelante.length = 0;
    apilarHistorial(historialAtras, anterior);
    estado.proyecto = normalizado;
    estado.indiceEdicion = 0;
    estado.indiceReproduccion = 0;
    estado.tiempo = 0;
    estado.origenCarga = descripcion;
    programarGuardado();
    emitir("proyecto");
    return normalizado;
}

function actualizarInterfaz(cambios, motivo = "interfaz") {
    for (const [clave, valor] of Object.entries(esObjeto(cambios) ? cambios : {})) {
        if (CLAVES_INTERFAZ.has(clave)) estado[clave] = valor;
    }
    ajustarIndicesYTiempo();
    emitir(motivo);
}

/*
El tiempo cambia en cada cuadro de animación. Emitir a todos los suscriptores unas sesenta
veces por segundo añadiría trabajo sin aportar información útil, pero permitir que otros
módulos muten libremente el objeto estado rompería la frontera arquitectónica.
Esta operación es, por ello, deliberadamente específica y silenciosa.
*/
function establecerTiempoReproduccion(tiempo) {
    const total = estado.proyecto ? DOMA.total(estado.proyecto) : 0;
    const valor = Number(tiempo);
    estado.tiempo = DOMA.limitar(Number.isFinite(valor) ? valor : 0, 0, total);
    return estado.tiempo;
}

function suscribir(funcion) {
    if (typeof funcion !== "function") return () => {};
    suscriptores.add(funcion);
    return () => suscriptores.delete(funcion);
}

function emitir(motivo) {
    const detalle = {
        motivo,
        estado,
        puedeDeshacer: historialAtras.length > 0,
        puedeRehacer: historialAdelante.length > 0
    };
    for (const suscriptor of suscriptores) {
        try {
            suscriptor(detalle);
        } catch (error) {
            DOMA_ERRORES.registrar(error, `suscriptor de estado: ${motivo}`);
        }
    }
    window.dispatchEvent(new CustomEvent("doma:estado", { detail: detalle }));
}

function resumenDiagnostico() {
    return {
        origenCarga: estado.origenCarga,
        almacenamientoDisponible,
        guardadoPendiente: estado.guardadoPendiente,
        conflictoExterno: estado.conflictoExterno,
        copiaConflictoDisponible: estado.copiaConflictoDisponible,
        bytesHistorial: bytesHistorial(),
        movimientos: estado.proyecto?.definiciones?.length || 0,
        pista: estado.proyecto?.pista || null,
        puedeDeshacer: historialAtras.length > 0,
        puedeRehacer: historialAdelante.length > 0,
        problemas: estado.proyecto ? DOMA.validarProyecto(estado.proyecto) : []
    };
}

window.addEventListener("storage", evento => {
    if (evento.key !== CLAVE_PRINCIPAL || evento.storageArea !== localStorage || !evento.newValue) return;
    const checksumNuevo = checksumContenidoIntegro(evento.newValue);
    if (!checksumNuevo) return;
    let checksumActual = "";
    try {
        checksumActual = estado.proyecto ? hash(JSON.stringify(estado.proyecto)) : "";
    } catch (error) {
        DOMA_ERRORES.registrar(error, "comparacion de cambios entre ventanas", "aviso");
    }
    if (checksumNuevo === checksumActual) {
        checksumPrincipalObservado = checksumNuevo;
        estado.conflictoExterno = false;
        return;
    }
    estado.conflictoExterno = true;
    estado.guardadoPendiente = true;
    emitir("conflicto");
    window.DOMA?.avisar?.("Otra ventana ha guardado cambios; esta ventana no los sobrescribira");
});

window.addEventListener("doma:solicitar-recuperacion", () => {
    if (recuperarCopiaSegura()) {
        DOMA.avisar("Copia de seguridad recuperada");
    } else {
        DOMA_ERRORES.registrar("No existe una copia de seguridad recuperable.", "recuperación", "aviso");
        DOMA.avisar("No existe una copia de seguridad recuperable");
    }
});

window.DOMA_ESTADO = {
    estado,
    cargar,
    guardarAhora,
    transaccion,
    deshacer,
    rehacer,
    sustituirProyecto,
    actualizarInterfaz,
    establecerTiempoReproduccion,
    suscribir,
    resumenDiagnostico
};
})();
