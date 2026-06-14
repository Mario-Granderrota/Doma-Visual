/*
Doma Visual · Versión 0
Módulo: coordinación de interfaz, reproducción, audio local y ciclo de vida PWA.
Dependencias: errores, modelo, estado, layout, editor y pista.

Invariantes:
- El índice reproducido y el índice editado son estados distintos.
- El audio local solo existe durante la sesión; el proyecto conserva únicamente su nombre.
- Los textos del proyecto se escriben mediante propiedades DOM, nunca como HTML importado.
- Guardar, exportar, ocultar o cerrar confirma antes cualquier autoedición pendiente.
- La versión de recursos debe permanecer coordinada con HTML, diagnóstico y service worker.
*/

(() => {
"use strict";

let movimientos = [];
let vista = null;
let reproduciendo = false;
let instanteAnterior = 0;
let velocidad = 1;
let audioLocalUrl = "";
let audioDisponible = false;
let eventoInstalacionPwa = null;
let registroPwa = null;
let recargaPorActualizacion = false;
let fotogramaReproduccion = 0;
let ultimoAvisoAudio = 0;
let ultimoAvisoActualizacionPwa = 0;

const $ = id => DOMA_ERRORES.requerirElemento(id);
const estado = () => DOMA_ESTADO.estado;
const proyecto = () => estado().proyecto;

function registrarAvisoEspaciado(error, contexto, intervalo = 10000) {
    const ahora = Date.now();
    const esPwa = contexto === "actualizacion periodica de la PWA";
    const ultimo = esPwa ? ultimoAvisoActualizacionPwa : ultimoAvisoAudio;
    if (ahora - ultimo < intervalo) return;
    if (esPwa) ultimoAvisoActualizacionPwa = ahora;
    else ultimoAvisoAudio = ahora;
    DOMA_ERRORES.registrar(error, contexto, "aviso");
}

function compilar() {
    movimientos = DOMA.compilarSecuencia(proyecto().definiciones, proyecto().pista);
}

function reflejarConmutador(id, activo) {
    const boton = $(id);
    const valor = Boolean(activo);
    boton.classList.toggle("activo", valor);
    boton.setAttribute("aria-pressed", String(valor));
}

function renderModoAprendizaje() {
    const aprender = Boolean(estado().modoAprender);
    document.body.classList.toggle("modo-aprender", aprender);
    reflejarConmutador("modoVer", !aprender);
    reflejarConmutador("modoAprender", aprender);
}

function reflejarVistaLimpia() {
    const boton = $("vistaLimpia");
    const activa = document.body.classList.contains("vista-limpia");
    boton.setAttribute("aria-pressed", String(activa));
    boton.setAttribute("aria-label", activa ? "Mostrar paneles" : "Activar vista limpia");
    boton.title = activa
        ? "Recuperar movimientos y controles de pista"
        : "Ocultar paneles y ampliar realmente la pista";
    boton.textContent = activa ? "Mostrar paneles" : "Vista limpia";
}

function renderLista() {
    const lista = $("listaMovimientos");
    lista.innerHTML = "";
    movimientos.forEach((movimiento, indice) => {
        const visual = DOMA.estadoVisual(proyecto(), movimiento, 0);
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = [
            "movimiento",
            indice === estado().indiceReproduccion ? "activo" : "",
            indice === estado().indiceEdicion ? "editando" : ""
        ].filter(Boolean).join(" ");
        if (indice === estado().indiceReproduccion) boton.setAttribute("aria-current", "step");
        // El título puede proceder de un archivo importado. Se construye el contenido con
        // nodos y textContent para impedir que texto de proyecto se interprete como HTML.
        const numero = document.createElement("span");
        numero.className = "numero";
        numero.textContent = String(indice + 1);

        const contenido = document.createElement("span");
        const titulo = document.createElement("strong");
        titulo.textContent = `${visual.caballoEmoji || "🐎"} ${movimiento.titulo}`;
        const detalle = document.createElement("small");
        detalle.textContent = `${DOMA.nombrePunto(movimiento.inicio, proyecto().pista)} → ${DOMA.nombrePunto(movimiento.fin, proyecto().pista)} · ${movimiento.duracion}s`;
        contenido.append(titulo, detalle);
        boton.append(numero, contenido);
        boton.addEventListener("click", () => {
            // Con el editor abierto, un clic expresa intención de editar ese movimiento.
            // Durante la reproducción automática, indiceEdicion permanece fijado.
            if (document.body.classList.contains("edicion-abierta")) {
                DOMA_ESTADO.actualizarInterfaz({ indiceEdicion:indice }, "seleccion-edicion");
            }
            irMovimiento(indice);
        });
        lista.append(boton);
    });
    $("resumenPrueba").textContent = `${movimientos.length} movimientos · ${DOMA.formato(DOMA.total(proyecto()))}`;
}

function renderPista() {
    const fijos = DOMA_EDITOR.estadoElementosFijos?.() || {};
    vista = PISTA.render($("lienzoPista"), proyecto(), {
        movimientos,
        indiceActual:estado().indiceReproduccion,
        aprender:estado().modoAprender,
        elementosEditables:Boolean(fijos.elementosEditables),
        elementoSeleccionadoId:fijos.elementoSeleccionadoId || null,
        colocandoElemento:Boolean(fijos.colocandoElemento),
        tipoElementoColocando:fijos.tipoElementoColocando || "",
        orientacionVisual:DOMA_LAYOUT.obtenerOrientacionPista?.() || "vertical"
    });
    actualizarCaballo();
}

function renderEstadoPista() {
    const ancho = Number(proyecto().pista.ancho || 20);
    const largo = Number(proyecto().pista.largo || 60);
    const proporcion = ancho > 0 ? largo / ancho : 0;
    const proporcionTexto = Number.isInteger(proporcion)
        ? `1:${proporcion}`
        : `1:${proporcion.toFixed(2).replace(".", ",")}`;
    const vista = DOMA_LAYOUT.obtenerOrientacionPista?.() === "horizontal"
        ? "Vista apaisada"
        : "Vista vertical";
    $("medidasPista").textContent = `${ancho} × ${largo} m · proporción ${proporcionTexto}`;
    $("orientacionPista").textContent = `${vista} · C hacia ${proyecto().ambiente.orientacion || "N"}`;
}

function actualizarChips(visual) {
    const caballo = $("senalCaballoActual");
    const jinete = $("senalJineteActual");
    caballo.textContent = `${visual.caballoEmoji || "●"} Caballo: ${visual.caballoSignificado}`;
    caballo.style.setProperty("--senal-color", visual.caballoColor);
    jinete.textContent = `${visual.jineteEmoji || "●"} Tú: ${visual.jineteSignificado}`;
    jinete.style.setProperty("--senal-color", visual.jineteColor);
}

function renderActual() {
    const movimiento = movimientos[estado().indiceReproduccion];
    if (!movimiento) return;
    $("numeroActual").textContent = String(estado().indiceReproduccion + 1);
    $("tituloActual").textContent = movimiento.titulo;
    $("rutaActual").textContent =
        `${DOMA.nombrePunto(movimiento.inicio, proyecto().pista)} → ${DOMA.nombrePunto(movimiento.fin, proyecto().pista)}`;
    $("ayudaActual").textContent = movimiento.ayuda || "Sin consejo. Añádelo en Editar → Aprende.";
    $("nombreProyecto").value = proyecto().nombre;
}

function renderProyectoBasico() {
    reflejarConmutador("toggleLetras", proyecto().pista.letras);
    reflejarConmutador("toggleCuadricula", proyecto().pista.cuadricula);
    reflejarConmutador("toggleRecorrido", proyecto().pista.recorrido);
    renderModoAprendizaje();
    const diagnostico = DOMA_ESTADO.resumenDiagnostico();
    $("estadoProyecto").textContent = !diagnostico.almacenamientoDisponible
        ? "Sesión sin almacenamiento local"
        : diagnostico.conflictoExterno
            ? "Otra ventana ha guardado cambios"
            : estado().guardadoPendiente
                ? "Cambios sin guardar"
                : diagnostico.copiaConflictoDisponible
                    ? `Guardado aquí · ${estado().origenCarga} · copia alternativa disponible`
                    : `Guardado aquí · ${estado().origenCarga}`;
    $("deshacer").disabled = !diagnostico.puedeDeshacer;
    $("rehacer").disabled = !diagnostico.puedeRehacer;
    renderEstadoPista();
}

function renderMusica() {
    $("musicaTitulo").value = proyecto().musica.titulo || "";
    $("musicaInicio").value = Number(proyecto().musica.inicio || 0);
    $("musicaSincronizar").checked = Boolean(proyecto().musica.sincronizar);

    const titulo = proyecto().musica.titulo
        || proyecto().musica.nombreArchivo
        || "Sin música configurada";
    $("tituloMusicaDialogo").textContent = titulo;
    $("estadoArchivoMusica").textContent = audioDisponible
        ? `Archivo activo: ${proyecto().musica.nombreArchivo || titulo}`
        : proyecto().musica.nombreArchivo
            ? `Archivo recordado: ${proyecto().musica.nombreArchivo}. Selecciónalo de nuevo para reproducirlo.`
            : "Sin audio seleccionado en esta sesión.";
    $("notaMusicaDialogo").textContent = audioDisponible
        ? "Puedes cerrar este diálogo: el audio seguirá disponible y podrá sincronizarse con la pista."
        : "Selecciona un archivo en Editar → Música.";
    prepararAudioGuardado();
}

function abrirDialogoMusica() {
    renderMusica();
    const dialogo = $("dialogoMusica");
    if (!dialogo.open) dialogo.showModal();
}

function cerrarDialogoMusica() {
    const dialogo = $("dialogoMusica");
    if (dialogo.open) dialogo.close();
}

function actualizarBotonReproduccion() {
    const boton = $("reproducir");
    const icono = boton.querySelector(".mando-icono");
    const texto = boton.querySelector(".mando-texto");
    if (icono) icono.textContent = reproduciendo ? "⏸" : "▶";
    if (texto) texto.textContent = reproduciendo ? "Pausar" : "Reproducir";
    boton.setAttribute("aria-label", reproduciendo ? "Pausar" : "Reproducir");
    boton.setAttribute("aria-pressed", String(reproduciendo));
}

function actualizarBotonRepetir() {
    const boton = $("repetir");
    const texto = boton.querySelector(".mando-texto");
    if (texto) texto.textContent = estado().repetir ? "Repitiendo" : "Repetir";
    reflejarConmutador("repetir", estado().repetir);
}

function prepararAudioGuardado() {
    const audio = $("audioRoom");
    if (audioLocalUrl) {
        audioDisponible = true;
        return;
    }
    audioDisponible = false;
    audio.removeAttribute("src");
    audio.load();
}

function renderTodo() {
    compilar();
    renderLista();
    renderPista();
    renderActual();
    renderProyectoBasico();
    renderMusica();
    reflejarVistaLimpia();
    actualizarTiempo();
}

function actualizarCaballo() {
    if (!vista || !movimientos.length) return;
    const loc = DOMA.localizar(proyecto(), estado().tiempo);
    const movimiento = movimientos[loc.indice];
    const visual = DOMA.estadoVisual(proyecto(), movimiento, loc.progreso);
    vista.mostrar(DOMA.estado(movimiento, loc.progreso), visual);
    vista.destacar(
        DOMA.nombrePunto(movimiento.inicio, proyecto().pista),
        DOMA.nombrePunto(movimiento.fin, proyecto().pista)
    );
    actualizarChips(visual);
}

function actualizarTiempo() {
    const total = DOMA.total(proyecto());
    const tiempo = DOMA.limitar(estado().tiempo, 0, total);
    const loc = DOMA.localizar(proyecto(), tiempo);

    if (loc.indice !== estado().indiceReproduccion) {
        DOMA_ESTADO.actualizarInterfaz({ indiceReproduccion:loc.indice, tiempo }, "reproduccion");
        renderLista();
        renderPista();
        renderActual();
    } else {
        DOMA_ESTADO.establecerTiempoReproduccion(tiempo);
        actualizarCaballo();
    }

    $("tiempoActual").textContent = DOMA.formato(tiempo);
    $("tiempoTotal").textContent = DOMA.formato(total);
    $("cursorTiempo").value = total ? tiempo / total * 1000 : 0;
}

function sincronizarAudio(forzar = false) {
    const audio = $("audioRoom");
    if (!audioDisponible || !proyecto().musica.sincronizar) return;
    const objetivo = Number(proyecto().musica.inicio || 0) + estado().tiempo;
    if (forzar || Math.abs((audio.currentTime || 0) - objetivo) > .45) {
        try {
            audio.currentTime = Math.max(0, objetivo);
        } catch (error) {
            registrarAvisoEspaciado(error, "sincronizacion del audio local");
        }
    }
    audio.playbackRate = velocidad;
}

function pausarAudio() {
    const audio = $("audioRoom");
    if (!audio.paused) audio.pause();
}

/*
Mantiene una única cadena requestAnimationFrame. Una sucesión rápida de pulsaciones
reproducir-pausar-reproducir no debe acumular ciclos invisibles ni elevar el uso de CPU.
*/
function cancelarFotogramaReproduccion() {
    if (!fotogramaReproduccion) return;
    cancelAnimationFrame(fotogramaReproduccion);
    fotogramaReproduccion = 0;
}

function solicitarFotogramaReproduccion() {
    if (!reproduciendo || fotogramaReproduccion) return;
    fotogramaReproduccion = requestAnimationFrame(ciclo);
}

function detener(reset = false) {
    reproduciendo = false;
    instanteAnterior = 0;
    cancelarFotogramaReproduccion();
    actualizarBotonReproduccion();
    pausarAudio();
    if (reset) {
        DOMA_ESTADO.actualizarInterfaz({ tiempo:0, indiceReproduccion:0 }, "reproduccion");
        actualizarTiempo();
        sincronizarAudio(true);
    }
}

function ciclo(instante) {
    fotogramaReproduccion = 0;
    if (!reproduciendo) return;
    if (!instanteAnterior) instanteAnterior = instante;
    let tiempo = estado().tiempo + (instante - instanteAnterior) / 1000 * velocidad;
    instanteAnterior = instante;

    const intervalo = DOMA.intervalo(proyecto(), estado().indiceReproduccion);
    if (estado().repetir && tiempo >= intervalo.fin) {
        tiempo = intervalo.inicio;
        sincronizarAudio(true);
    } else if (tiempo >= DOMA.total(proyecto())) {
        tiempo = DOMA.total(proyecto());
        detener(false);
    }
    DOMA_ESTADO.establecerTiempoReproduccion(tiempo);
    actualizarTiempo();
    solicitarFotogramaReproduccion();
}

function irMovimiento(indice) {
    const i = DOMA.limitar(indice, 0, movimientos.length - 1);
    DOMA_ESTADO.actualizarInterfaz({
        indiceReproduccion:i,
        tiempo:DOMA.intervalo(proyecto(), i).inicio
    }, "reproduccion");
    renderLista();
    renderPista();
    renderActual();
    actualizarTiempo();
    sincronizarAudio(true);
}

function editarMovimiento(indice) {
    DOMA_ESTADO.actualizarInterfaz({ indiceEdicion:indice }, "seleccion-edicion");
    DOMA_LAYOUT.abrirEdicion();
    reflejarVistaLimpia();
    activarPestana("movimiento");
}

function activarPestana(nombre) {
    DOMA_EDITOR.vaciarAutoedicion?.();
    document.querySelectorAll(".pestana").forEach(b => b.classList.toggle("activa", b.dataset.pestana === nombre));
    for (const [id, pestaña] of [
        ["panelMovimiento","movimiento"],["panelAprende","aprende"],["panelSenales","senales"],["panelFijos","fijos"],["panelMusica","musica"],["panelProyecto","proyecto"]
    ]) {
        $(id).classList.toggle("activo", nombre === pestaña);
    }
    DOMA_EDITOR.establecerPestana?.(nombre);
    const scroll = document.querySelector(".cajon-scroll");
    if (scroll) scroll.scrollTop = 0;
    renderPista();
}

function guardarMusica() {
    DOMA_ESTADO.transaccion("configurar música", candidato => {
        candidato.musica.titulo = $("musicaTitulo").value.trim();
        candidato.musica.inicio = Math.max(0, Number($("musicaInicio").value || 0));
        candidato.musica.sincronizar = $("musicaSincronizar").checked;
    });
}

function sincronizarNombreProyecto() {
    const nombre = $("nombreProyecto").value.trim() || "Proyecto sin nombre";
    if (nombre === proyecto().nombre) return;
    DOMA_ESTADO.transaccion("renombrar proyecto", candidato => {
        candidato.nombre = nombre;
    });
}

/*
Antes de guardar, exportar o cerrar, confirma el control que todavía conserva el foco y
vacía el debounce del movimiento. Esto evita perder la última escritura si la aplicación
se cierra antes de que transcurran los 260 ms de autoedición.
*/
function sincronizarCambiosPendientes() {
    const activo = document.activeElement;
    if (activo?.matches?.("input:not([type='file']), textarea, select")) {
        activo.dispatchEvent(new Event("change", { bubbles:true }));
    }
    DOMA_EDITOR.vaciarAutoedicion?.();
    sincronizarNombreProyecto();
}

function guardarProyectoSeguro(notificar = true) {
    sincronizarCambiosPendientes();
    return DOMA_ESTADO.guardarAhora(notificar);
}

function descargarProyectoSeguro() {
    sincronizarCambiosPendientes();
    DOMA_ESTADO.guardarAhora(false);
    DOMA.descargar(proyecto());
}

function urlPublicaAplicacion() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    if (canonical) return canonical;
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    return url.href;
}

async function copiarTextoSeguro(texto) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
    }
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.append(campo);
    campo.select();
    const copiado = document.execCommand?.("copy") === true;
    campo.remove();
    return copiado;
}

async function compartirAplicacion() {
    const url = urlPublicaAplicacion();
    const datos = {
        title:"Doma Visual",
        text:"Doma Visual 🐎: dibuja recorridos, guarda consejos de clase y repasa el entrenamiento.",
        url
    };
    try {
        if (typeof navigator.share === "function") {
            await navigator.share(datos);
            DOMA.avisar?.("Enlace compartido");
            return;
        }
        if (await copiarTextoSeguro(url)) {
            DOMA.avisar?.("Enlace copiado. Ya puedes pegarlo en Telegram");
            return;
        }
        throw new Error("El navegador no permite compartir ni copiar el enlace.");
    } catch (error) {
        if (error?.name === "AbortError") return;
        DOMA_ERRORES.registrar(error, "compartir el enlace", "aviso");
        DOMA.avisar?.("No se pudo compartir. Copia la dirección desde el navegador");
    }
}

function crearTextoRuta(movimiento) {
    return `${DOMA.nombrePunto(movimiento.inicio, proyecto().pista)} → ${DOMA.nombrePunto(movimiento.fin, proyecto().pista)}`;
}

function prepararResumenImpresion() {
    sincronizarCambiosPendientes();
    DOMA_ESTADO.guardarAhora(false);
    compilar();
    if (movimientos.length > 180) {
        throw new Error("El resumen supera 180 movimientos. Divide el proyecto antes de imprimir para evitar bloquear el navegador.");
    }

    $("impresionTitulo").textContent = proyecto().nombre || "Resumen del entrenamiento";
    const dimensiones = `${proyecto().pista.ancho} × ${proyecto().pista.largo} m`;
    const orientacion = `C hacia ${proyecto().ambiente.orientacion || "N"}`;
    let generado;
    try {
        generado = new Intl.DateTimeFormat("es-ES", { dateStyle:"long", timeStyle:"short" }).format(new Date());
    } catch (_) {
        generado = new Date().toLocaleString("es-ES");
    }
    $("impresionDatos").textContent = `${movimientos.length} movimientos · ${DOMA.formato(DOMA.total(proyecto()))} · ${dimensiones} · ${orientacion} · Resumen generado el ${generado}`;

    PISTA.render($("impresionPista"), proyecto(), {
        movimientos,
        indiceActual:-1,
        aprender:false,
        elementosEditables:false,
        colocandoElemento:false,
        mostrarCaballo:false,
        orientacionVisual:"horizontal"
    });

    const lista = $("impresionMovimientos");
    lista.replaceChildren();
    movimientos.forEach((movimiento, indiceMovimiento) => {
        const definicion = proyecto().definiciones[indiceMovimiento];
        const item = document.createElement("li");
        item.className = "impresion-movimiento";

        const cabecera = document.createElement("div");
        cabecera.className = "impresion-movimiento-cabecera";
        const numero = document.createElement("span");
        numero.className = "impresion-numero";
        numero.textContent = String(indiceMovimiento + 1);
        const titulo = document.createElement("strong");
        titulo.textContent = movimiento.titulo;
        const detalle = document.createElement("span");
        detalle.textContent = `${crearTextoRuta(movimiento)} · ${movimiento.duracion}s`;
        cabecera.append(numero, titulo, detalle);
        item.append(cabecera);

        if (definicion?.comentario) {
            const paso = document.createElement("p");
            const etiqueta = document.createElement("b");
            etiqueta.textContent = "Paso: ";
            paso.append(etiqueta, document.createTextNode(definicion.comentario));
            item.append(paso);
        }
        if (definicion?.ayuda) {
            const aprende = document.createElement("p");
            aprende.className = "impresion-aprende";
            const etiqueta = document.createElement("b");
            etiqueta.textContent = "Aprende: ";
            aprende.append(etiqueta, document.createTextNode(definicion.ayuda));
            item.append(aprende);
        }
        lista.append(item);
    });
}

function imprimirResumenProyecto() {
    DOMA_ERRORES.intentar("preparación del resumen impreso", () => {
        prepararResumenImpresion();
        const tituloAnterior = document.title;
        let restaurado = false;
        const restaurarTitulo = () => {
            if (restaurado) return;
            restaurado = true;
            document.title = tituloAnterior;
        };
        document.title = `${proyecto().nombre || "Entrenamiento"} · Doma Visual`;
        if (typeof window.print !== "function") throw new Error("Este navegador no ofrece impresión desde la aplicación.");
        window.addEventListener("afterprint", restaurarTitulo, { once:true });
        window.print();
        setTimeout(restaurarTitulo, 30000);
    });
}

function deshacerSeguro() {
    sincronizarCambiosPendientes();
    return DOMA_ESTADO.deshacer();
}

function rehacerSeguro() {
    sincronizarCambiosPendientes();
    return DOMA_ESTADO.rehacer();
}

function cargarArchivoAudio(archivo) {
    const tipo = String(archivo?.type || "").toLowerCase();
    const nombre = String(archivo?.name || "");
    const extensionAudio = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(nombre);
    if (!archivo || (tipo && !tipo.startsWith("audio/") && !extensionAudio)) {
        DOMA.avisar?.("Selecciona un archivo de audio compatible");
        return false;
    }
    if (audioLocalUrl) URL.revokeObjectURL(audioLocalUrl);
    audioLocalUrl = URL.createObjectURL(archivo);
    $("audioRoom").src = audioLocalUrl;
    audioDisponible = true;
    DOMA_ESTADO.transaccion("seleccionar audio local", candidato => {
        candidato.musica.nombreArchivo = archivo.name;
        if (!candidato.musica.titulo) candidato.musica.titulo = archivo.name.replace(/\.[^.]+$/, "");
    });
    return true;
}


function esModoInstalado() {
    return window.matchMedia?.("(display-mode: standalone)").matches
        || window.navigator.standalone === true;
}

function actualizarEstadoConexion() {
    const conectado = navigator.onLine;
    const nodo = $("estadoConexion");
    nodo.classList.toggle("oculto", conectado);
    nodo.textContent = conectado ? "Con conexión" : "Sin conexión";
    document.body.classList.toggle("sin-conexion", !conectado);
    if (!conectado) DOMA.avisar?.("Modo sin conexión: el proyecto local sigue disponible");
}

function mostrarInstalacionDisponible() {
    const boton = $("instalarPwa");
    if (esModoInstalado()) {
        boton.classList.add("oculto");
        document.body.classList.add("pwa-instalada");
        return;
    }
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    boton.classList.toggle("oculto", !eventoInstalacionPwa && !esIos);
}

async function solicitarInstalacion() {
    try {
        if (esModoInstalado()) return;
        if (eventoInstalacionPwa) {
            const evento = eventoInstalacionPwa;
            eventoInstalacionPwa = null;
            await evento.prompt();
            const resultado = await evento.userChoice;
            if (resultado.outcome === "accepted") DOMA.avisar?.("Doma Visual se está instalando");
            mostrarInstalacionDisponible();
            return;
        }
        if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
            DOMA.avisar?.("En Safari usa Compartir y después Añadir a pantalla de inicio");
        }
    } catch (error) {
        DOMA_ERRORES.registrar(error, "solicitud de instalación PWA", "aviso");
        DOMA.avisar?.("No se pudo iniciar la instalación en este navegador");
        mostrarInstalacionDisponible();
    }
}

function mostrarActualizacion(registro) {
    registroPwa = registro;
    $("avisoActualizacion").classList.remove("oculto");
}

async function inicializarPwa() {
    actualizarEstadoConexion();
    window.addEventListener("online", actualizarEstadoConexion);
    window.addEventListener("offline", actualizarEstadoConexion);

    window.addEventListener("beforeinstallprompt", evento => {
        evento.preventDefault();
        eventoInstalacionPwa = evento;
        mostrarInstalacionDisponible();
    });
    window.addEventListener("appinstalled", () => {
        eventoInstalacionPwa = null;
        mostrarInstalacionDisponible();
        DOMA.avisar?.("Doma Visual instalada correctamente");
    });
    mostrarInstalacionDisponible();

    if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(location.protocol)) return;
    try {
        const registro = await navigator.serviceWorker.register("./service-worker.js", { scope:"./", updateViaCache:"none" });
        registroPwa = registro;

        if (registro.waiting && navigator.serviceWorker.controller) mostrarActualizacion(registro);
        registro.addEventListener("updatefound", () => {
            const trabajador = registro.installing;
            if (!trabajador) return;
            trabajador.addEventListener("statechange", () => {
                if (trabajador.state === "installed" && navigator.serviceWorker.controller) {
                    mostrarActualizacion(registro);
                }
            });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (recargaPorActualizacion) return;
            recargaPorActualizacion = true;
            location.reload();
        });
        setTimeout(() => {
            registro.update().catch(error => {
                if (navigator.onLine) registrarAvisoEspaciado(error, "actualizacion periodica de la PWA", 30000);
            });
        }, 3500);
    } catch (error) {
        DOMA_ERRORES.registrar(error, "registro de la PWA", "aviso");
    }
}

function aplicarAtajoDeInicio() {
    const parametros = new URLSearchParams(location.search);
    if (parametros.get("mode") === "aprender") {
        DOMA_ESTADO.actualizarInterfaz({ modoAprender:true }, "modo");
        renderModoAprendizaje();
    }
    if (parametros.get("action") === "edit") {
        setTimeout(() => editarMovimiento(estado().indiceReproduccion), 0);
    }
    if (parametros.get("action") === "fijos") {
        setTimeout(() => {
            editarMovimiento(estado().indiceReproduccion);
            activarPestana("fijos");
        }, 0);
    }
}


function manejarAtajoTeclado(evento) {
    const objetivo = evento.target;
    const interfazBloqueada = document.querySelector("dialog[open], #panelErrorGlobal:not(.oculto)");
    const escribiendo = objetivo instanceof HTMLInputElement
        || objetivo instanceof HTMLTextAreaElement
        || objetivo instanceof HTMLSelectElement
        || objetivo?.isContentEditable;

    if (evento.key === "Escape") {
        if ($("dialogoAcercaDe").open) {
            evento.preventDefault();
            $("dialogoAcercaDe").close();
            return;
        }
        if ($("dialogoMusica").open) {
            evento.preventDefault();
            cerrarDialogoMusica();
            return;
        }
        // Los demas dialogos gestionan Escape mediante su propio evento cancel. No se
        // debe cerrar ni mover nada de la interfaz que permanece debajo del modal.
        if (interfazBloqueada) return;
        if (document.body.classList.contains("edicion-abierta")) {
            evento.preventDefault();
            DOMA_LAYOUT.cerrarEdicion();
            DOMA_EDITOR.establecerPestana?.("movimiento");
            renderPista();
        }
        return;
    }

    if (interfazBloqueada || escribiendo) return;

    const control = evento.ctrlKey || evento.metaKey;
    if (control && evento.key.toLowerCase() === "z") {
        evento.preventDefault();
        if (evento.shiftKey) rehacerSeguro();
        else deshacerSeguro();
        return;
    }
    if (control && evento.key.toLowerCase() === "y") {
        evento.preventDefault();
        rehacerSeguro();
        return;
    }

    if (evento.code === "Space") {
        evento.preventDefault();
        $("reproducir").click();
    } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        $("anterior").click();
    } else if (evento.key === "ArrowRight") {
        evento.preventDefault();
        $("siguiente").click();
    } else if (evento.key.toLowerCase() === "e") {
        evento.preventDefault();
        editarMovimiento(estado().indiceReproduccion);
    }
}

function prepararEventos() {
    document.addEventListener("keydown", manejarAtajoTeclado);
    document.addEventListener("visibilitychange", () => {
        // requestAnimationFrame se detiene en segundo plano. Al volver, su marca temporal
        // incluiría toda la ausencia y podría saltar al final de la prueba. Se pausa de
        // forma explícita y se reinicia la referencia temporal.
        instanteAnterior = 0;
        if (document.hidden && reproduciendo) {
            reproduciendo = false;
            cancelarFotogramaReproduccion();
            actualizarBotonReproduccion();
            pausarAudio();
            DOMA.avisar?.("Reproducción pausada al salir de la aplicación");
        }
        if (document.hidden) guardarProyectoSeguro(false);
    });
    $("instalarPwa").addEventListener("click", () => DOMA_ERRORES.intentar("instalación PWA", solicitarInstalacion));
    $("actualizarPwa").addEventListener("click", () => {
        if (!guardarProyectoSeguro(false)) {
            DOMA.avisar?.("La actualización se ha pospuesto porque el proyecto no pudo guardarse");
            return;
        }
        const trabajador = registroPwa?.waiting;
        if (trabajador) trabajador.postMessage({ tipo:"ACTIVAR_ACTUALIZACION" });
        else location.reload();
    });
    $("posponerActualizacion").addEventListener("click", () => $("avisoActualizacion").classList.add("oculto"));
    $("abrirEdicion").addEventListener("click", () => editarMovimiento(estado().indiceReproduccion));
    $("abrirProyectoSuperior").addEventListener("click", () => {
        DOMA_LAYOUT.abrirEdicion();
        reflejarVistaLimpia();
        activarPestana("proyecto");
    });
    $("cerrarEdicion").addEventListener("click", () => {
        DOMA_EDITOR.vaciarAutoedicion?.();
        DOMA_LAYOUT.cerrarEdicion();
        DOMA_EDITOR.establecerPestana?.("movimiento");
        renderPista();
    });
    $("anadirRapido").addEventListener("click", () => editarMovimiento(estado().indiceReproduccion));
    $("vistaLimpia").addEventListener("click", () => {
        DOMA_LAYOUT.alternarVistaLimpia();
        reflejarVistaLimpia();
    });

    const abrirAcercaDe = () => $("dialogoAcercaDe").showModal();
    $("abrirAcercaDePanel").addEventListener("click", abrirAcercaDe);
    $("cerrarAcercaDe").addEventListener("click", () => $("dialogoAcercaDe").close());
    $("dialogoAcercaDe").addEventListener("click", evento => {
        if (evento.target === $("dialogoAcercaDe")) $("dialogoAcercaDe").close();
    });

    $("pantallaCompleta").addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            else await document.exitFullscreen();
        } catch (_) {
            DOMA.avisar?.("El navegador no permite pantalla completa");
        }
    });

    document.querySelectorAll(".pestana").forEach(b => b.addEventListener("click", () => activarPestana(b.dataset.pestana)));
    $("modoVer").addEventListener("click", () => {
        DOMA_ESTADO.actualizarInterfaz({ modoAprender:false }, "modo");
        renderModoAprendizaje();
        renderPista();
    });
    $("modoAprender").addEventListener("click", () => {
        DOMA_ESTADO.actualizarInterfaz({ modoAprender:true }, "modo");
        renderModoAprendizaje();
        renderPista();
    });

    $("toggleLetras").addEventListener("click", () => {
        DOMA_ESTADO.transaccion("alternar letras", candidato => candidato.pista.letras = !candidato.pista.letras);
    });
    $("toggleCuadricula").addEventListener("click", () => {
        DOMA_ESTADO.transaccion("alternar cuadrícula", candidato => candidato.pista.cuadricula = !candidato.pista.cuadricula);
    });
    $("toggleRecorrido").addEventListener("click", () => {
        DOMA_ESTADO.transaccion("alternar recorrido", candidato => candidato.pista.recorrido = !candidato.pista.recorrido);
    });

    $("inicio").addEventListener("click", () => irMovimiento(0));
    $("anterior").addEventListener("click", () => irMovimiento(estado().indiceReproduccion - 1));
    $("siguiente").addEventListener("click", () => irMovimiento(estado().indiceReproduccion + 1));
    $("stop").addEventListener("click", () => detener(true));
    $("reproducir").addEventListener("click", () => {
        reproduciendo = !reproduciendo;
        actualizarBotonReproduccion();
        instanteAnterior = 0;
        if (reproduciendo) {
            sincronizarAudio(true);
            if (audioDisponible && proyecto().musica.sincronizar) {
                $("audioRoom").play().catch(error => {
                    registrarAvisoEspaciado(error, "inicio del audio local");
                });
            }
            solicitarFotogramaReproduccion();
        } else {
            cancelarFotogramaReproduccion();
            pausarAudio();
        }
    });
    $("repetir").addEventListener("click", () => {
        DOMA_ESTADO.actualizarInterfaz({ repetir:!estado().repetir }, "repetir");
        actualizarBotonRepetir();
    });
    $("velocidad").addEventListener("change", evento => {
        const solicitada = Number(evento.target.value);
        velocidad = DOMA.limitar(Number.isFinite(solicitada) ? solicitada : 1, .25, 2);
        evento.target.value = String(velocidad);
        DOMA_ESTADO.actualizarInterfaz({ velocidad }, "velocidad");
        $("audioRoom").playbackRate = velocidad;
    });
    $("cursorTiempo").addEventListener("input", evento => {
        DOMA_ESTADO.establecerTiempoReproduccion(
            Number(evento.target.value) / 1000 * DOMA.total(proyecto())
        );
        actualizarTiempo();
        sincronizarAudio(true);
    });

    $("deshacer").addEventListener("click", deshacerSeguro);
    $("rehacer").addEventListener("click", rehacerSeguro);
    $("guardarDesdePanel").addEventListener("click", () => guardarProyectoSeguro());
    $("descargarDesdePanel").addEventListener("click", descargarProyectoSeguro);
    $("imprimirDesdePanel").addEventListener("click", imprimirResumenProyecto);
    $("compartirDesdePanel").addEventListener("click", () => DOMA_ERRORES.intentar("compartir el enlace", compartirAplicacion));

    $("importarProyecto").addEventListener("change", async evento => {
        const archivo = evento.target.files?.[0];
        if (!archivo) return;
        try {
            sincronizarCambiosPendientes();
            const resultado = await DOMA.importar(archivo);
            DOMA_ESTADO.sustituirProyecto(resultado.proyecto);
            DOMA.avisar?.(resultado.reparado ? "Proyecto importado y reparado" : "Proyecto importado");
        } catch (error) {
            DOMA_ERRORES.mostrarProteccion(DOMA_ERRORES.registrar(error, "importación del proyecto"));
        }
        evento.target.value = "";
    });
    $("restaurarProyecto").addEventListener("click", async () => {
        const aceptado = await DOMA_ERRORES.confirmar({
            titulo:"Restaurar el proyecto de ejemplo",
            mensaje:"Se sustituirá el proyecto actual. La operación podrá deshacerse mientras la aplicación permanezca abierta.",
            confirmarTexto:"Restaurar ejemplo"
        });
        if (!aceptado) return;
        sincronizarCambiosPendientes();
        DOMA_ESTADO.sustituirProyecto(DOMA.ejemplo(), "restaurar ejemplo");
        DOMA.avisar?.("Proyecto de ejemplo restaurado");
    });

    $("musicaArchivo").addEventListener("change", evento => {
        const archivo = evento.target.files?.[0];
        if (archivo) cargarArchivoAudio(archivo);
        evento.target.value = "";
    });
    $("audioRoom").addEventListener("error", () => {
        if (!audioLocalUrl) return;
        audioDisponible = false;
        DOMA.avisar?.("El navegador no pudo reproducir ese archivo de audio");
        renderMusica();
    });
    $("abrirMusica").addEventListener("click", abrirDialogoMusica);
    $("cerrarDialogoMusica").addEventListener("click", cerrarDialogoMusica);
    $("dialogoMusica").addEventListener("click", evento => {
        if (evento.target === $("dialogoMusica")) cerrarDialogoMusica();
    });
    ["musicaTitulo","musicaInicio","musicaSincronizar"].forEach(id => $(id).addEventListener("change", guardarMusica));

    $("nombreProyecto").addEventListener("change", sincronizarNombreProyecto);

    window.addEventListener("doma:seleccionar-trayectoria", evento => {
        const indice = evento.detail.indice;
        if (document.body.classList.contains("edicion-abierta")) {
            DOMA_ESTADO.actualizarInterfaz({ indiceEdicion:indice }, "seleccion-edicion");
        }
        irMovimiento(indice);
    });
    window.addEventListener("doma:refrescar-pista", renderPista);
    window.addEventListener("doma:orientacion-pista", () => {
        renderPista();
        renderEstadoPista();
    });
    window.addEventListener("pagehide", evento => {
        cancelarFotogramaReproduccion();
        guardarProyectoSeguro(false);
        if (!evento.persisted && audioLocalUrl) {
            URL.revokeObjectURL(audioLocalUrl);
            audioLocalUrl = "";
            audioDisponible = false;
        }
    });
    window.addEventListener("beforeunload", () => guardarProyectoSeguro(false));
}

function inicializar() {
    DOMA_ESTADO.cargar();
    velocidad = estado().velocidad;
    DOMA_LAYOUT.inicializar();
    DOMA_EDITOR.inicializar();
    prepararEventos();

    DOMA_ESTADO.suscribir(({ motivo, puedeDeshacer, puedeRehacer }) => {
        $("deshacer").disabled = !puedeDeshacer;
        $("rehacer").disabled = !puedeRehacer;
        if (["proyecto","deshacer","rehacer","recuperacion","carga"].includes(motivo)) {
            DOMA_ERRORES.intentar("renderizado general", renderTodo);
        } else if (motivo === "seleccion-edicion") {
            renderLista();
        } else if (["pendiente", "guardado", "conflicto"].includes(motivo)) {
            renderProyectoBasico();
        }
    });

    renderTodo();
    actualizarBotonReproduccion();
    actualizarBotonRepetir();
    aplicarAtajoDeInicio();
    inicializarPwa();
}

document.addEventListener("DOMContentLoaded", DOMA_ERRORES.proteger("inicio de Doma Visual", inicializar));
})();
