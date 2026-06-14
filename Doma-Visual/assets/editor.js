/*
Doma Visual · Versión 0
Módulo: edición de movimientos, señales, elementos fijos y configuración de pista.
Dependencias: estado, modelo, emojis, layout y aplicación.

Invariantes:
- La autoedición captura el id estable y una copia del formulario antes del retardo.
- Las operaciones retardadas y las listas dinámicas se identifican por id, no por posición.
- Todo cambio persistente se realiza mediante transacciones del estado.
- Los borrados globales se confirman y los dobles toques destructivos no encadenan bajas.
- Los textos importados se asignan con textContent o value.
- En compacto, colocar un elemento fijo repliega temporalmente el editor.
*/

(() => {
"use strict";

let temporizadorFormulario = null;
let autoedicionPendiente = null;
let preparado = false;
let pestanaActiva = "movimiento";
let elementoFijoSeleccionadoId = null;
let colocandoElementoFijo = false;
const ultimasAccionesBreves = new Map();

/*
Limites operativos de la interfaz. No recortan proyectos importados: solo impiden que una
sucesion accidental de pulsaciones cree cientos de nodos y degrade el telefono. Los
valores son deliberadamente holgados para un proyecto personal complejo.
*/
const LIMITES_EDICION = Object.freeze({
    movimientos: 120,
    efectosPorMovimiento: 40,
    senalesPorPaleta: 40,
    elementosFijos: 48
});
const POSICIONES_EXTERIORES = new Set([
    "c_exterior", "a_exterior", "c_izquierda", "c_derecha", "a_izquierda", "a_derecha"
]);
const $ = id => DOMA_ERRORES.requerirElemento(id);

function proyecto() {
    return DOMA_ESTADO.estado.proyecto;
}

function indice() {
    return DOMA_ESTADO.estado.indiceEdicion;
}

function movimientoCompilado() {
    return DOMA.compilarSecuencia(proyecto().definiciones, proyecto().pista)[indice()];
}

function llenarTipos(select) {
    select.innerHTML = "";
    DOMA.TIPOS.forEach(tipo => select.add(new Option(`${tipo.icono} ${tipo.nombre}`, tipo.id)));
}

function llenarDestinos(select, valor = "") {
    const disponibles = DOMA.referenciasDisponibles(proyecto().pista);
    select.innerHTML = "";
    select.classList.remove("valor-invalido");
    disponibles.forEach(letra => select.add(new Option(letra, letra)));
    if (valor && disponibles.includes(valor)) {
        select.value = valor;
    } else if (valor) {
        const opcion = new Option(`${valor} — no disponible en esta pista`, valor);
        opcion.dataset.invalida = "1";
        select.add(opcion);
        select.value = valor;
        select.classList.add("valor-invalido");
    }
}

function llenarSenales(select, tipo, valor) {
    select.innerHTML = "";
    (proyecto().senales[tipo] || []).forEach(senal => {
        select.add(new Option(`${senal.emoji || "●"} ${senal.significado}`, senal.id));
    });
    if (valor && [...select.options].some(o => o.value === valor)) select.value = valor;
}

function actualizarOpcionesTipo() {
    const tipo = $("editTipo").value;
    $("editDestino").disabled = !DOMA.TIPOS.find(t => t.id === tipo)?.destino;
    $("opcionesCirculo").classList.toggle("oculto", tipo !== "circulo");
}

function renderFormulario() {
    const p = proyecto();
    const i = indice();
    const d = p.definiciones[i];
    const m = movimientoCompilado();
    if (!d || !m) return;

    if (pestanaActiva === "movimiento") {
        $("tituloEdicion").textContent = `Editar ${i + 1}. ${d.titulo}`;
        $("subtituloEdicion").textContent = "Selección fijada mientras continúa la reproducción";
    }
    $("inicioMovimiento").textContent = DOMA.nombrePunto(m.inicio, p.pista);
    $("editTitulo").value = d.titulo;
    $("editTipo").value = d.tipo;
    llenarDestinos($("editDestino"), d.destino);
    $("editDuracion").value = d.duracion;
    $("editOrientacion").value = String(d.orientacionRelativa || 0);
    $("editComentario").value = d.comentario || "";
    $("editAyuda").value = d.ayuda || "";
    $("editRadio").value = d.radio || 10;
    $("editMano").value = d.mano || "derecha";
    llenarSenales($("editSenalCaballo"), "caballo", d.senalCaballoId);
    llenarSenales($("editSenalJinete"), "jinete", d.senalJineteId);
    actualizarOpcionesTipo();
    renderEfectos();
}

function normalizarControlNumerico(control) {
    if (!(control instanceof HTMLInputElement) || control.type !== "number") return;
    const numero = Number(control.value);
    if (!Number.isFinite(numero)) return;
    const minimo = control.min === "" ? -Infinity : Number(control.min);
    const maximo = control.max === "" ? Infinity : Number(control.max);
    const limitado = DOMA.limitar(
        numero,
        Number.isFinite(minimo) ? minimo : -Infinity,
        Number.isFinite(maximo) ? maximo : Infinity
    );
    if (limitado !== numero) {
        control.value = String(limitado);
        DOMA.avisar?.(`Valor ajustado al intervalo ${control.min || "sin minimo"}–${control.max || "sin maximo"}`);
    }
}

function comprobarLimite(cantidad, limite, mensaje) {
    if (cantidad < limite) return true;
    DOMA.avisar?.(mensaje);
    return false;
}

/*
Evita que un doble toque sobre un botón destructivo cuyo listado se repinta elimine también
el elemento que ocupa inmediatamente su lugar. No bloquea acciones diferentes ni sustituye
la confirmación de borrados con alcance global.
*/
function permitirAccionBreve(clave, intervalo = 500) {
    const ahora = Date.now();
    const anterior = ultimasAccionesBreves.get(clave) || 0;
    if (ahora - anterior < intervalo) return false;
    ultimasAccionesBreves.set(clave, ahora);
    return true;
}

function leerFormularioMovimiento() {
    return {
        titulo:$("editTitulo").value.trim() || "Movimiento",
        tipo:$("editTipo").value,
        destino:$("editDestino").value,
        duracion:Math.max(.1, Number($("editDuracion").value || 1)),
        orientacionRelativa:Number($("editOrientacion").value || 0),
        comentario:$("editComentario").value,
        ayuda:$("editAyuda").value,
        radio:Math.max(.5, Number($("editRadio").value || 10)),
        mano:$("editMano").value,
        senalCaballoId:$("editSenalCaballo").value,
        senalJineteId:$("editSenalJinete").value
    };
}

function aplicarFormulario(idMovimiento, datos) {
    if (!idMovimiento || !datos) return false;
    const resultado = DOMA_ESTADO.transaccion("editar movimiento", candidato => {
        // El id, no el índice visual, identifica el movimiento capturado al escribir.
        // Así un cambio rápido de selección no aplica datos al movimiento siguiente.
        const d = candidato.definiciones.find(entrada => entrada.id === idMovimiento);
        if (!d) return;
        Object.assign(d, datos);
    });
    if (autoedicionPendiente?.idMovimiento === idMovimiento) autoedicionPendiente = null;
    if (proyecto().definiciones[indice()]?.id === idMovimiento) {
        $("estadoAutoedicion").textContent = "Cambios guardados automáticamente";
        $("estadoAutoedicion").className = "estado-autoedicion correcto";
    }
    return Boolean(resultado);
}

function vaciarAutoedicion() {
    clearTimeout(temporizadorFormulario);
    temporizadorFormulario = null;
    const pendiente = autoedicionPendiente;
    autoedicionPendiente = null;
    if (!pendiente) return false;
    return Boolean(DOMA_ERRORES.intentar(
        "confirmación de autoedición pendiente",
        () => aplicarFormulario(pendiente.idMovimiento, pendiente.datos),
        false,
        { mostrar:false }
    ));
}

function descartarAutoedicion() {
    clearTimeout(temporizadorFormulario);
    temporizadorFormulario = null;
    autoedicionPendiente = null;
}

function programarFormulario(evento) {
    normalizarControlNumerico(evento?.currentTarget);
    const idMovimiento = proyecto().definiciones[indice()]?.id;
    const datos = leerFormularioMovimiento();
    autoedicionPendiente = { idMovimiento, datos };
    $("estadoAutoedicion").textContent = "Actualizando…";
    $("estadoAutoedicion").className = "estado-autoedicion aviso";
    clearTimeout(temporizadorFormulario);
    temporizadorFormulario = setTimeout(() => {
        temporizadorFormulario = null;
        const pendiente = autoedicionPendiente;
        if (!pendiente) return;
        DOMA_ERRORES.intentar(
            "autoedición del movimiento",
            () => aplicarFormulario(pendiente.idMovimiento, pendiente.datos)
        );
    }, 260);
}

function renderEfectos() {
    const movimiento = proyecto().definiciones[indice()];
    const contenedor = $("listaEfectos");
    contenedor.innerHTML = "";

    if (!movimiento?.efectos?.length) {
        contenedor.innerHTML = '<p class="sin-elementos">Sin puntos de efecto. Usa ＋ para añadir uno.</p>';
        return;
    }

    const idMovimiento = movimiento.id;
    movimiento.efectos.forEach(efecto => {
        const idEfecto = efecto.id;
        const fila = document.createElement("article");
        fila.className = "fila-efecto";
        fila.innerHTML = `
            <div class="efecto-superior">
                <label>Emoji<input data-campo="emoji" data-emoji-input type="text"></label>
                <label>Segundo<input data-campo="momento" type="number" min="0" max="${movimiento.duracion}" step=".1"></label>
                <label>Dura<input data-campo="duracion" type="number" min=".1" max="10" step=".1"></label>
                <button type="button" class="borrar-efecto" title="Eliminar">×</button>
            </div>
            <div class="dos-columnas">
                <label>Caballo<select data-campo="caballoId"></select></label>
                <label>Quien monta<select data-campo="jineteId"></select></label>
            </div>`;

        const emoji = fila.querySelector('[data-campo="emoji"]');
        emoji.value = efecto.emoji || "✨";
        fila.querySelector('[data-campo="momento"]').value = efecto.momento;
        fila.querySelector('[data-campo="duracion"]').value = efecto.duracion;
        llenarSenales(fila.querySelector('[data-campo="caballoId"]'), "caballo", efecto.caballoId);
        llenarSenales(fila.querySelector('[data-campo="jineteId"]'), "jinete", efecto.jineteId);

        fila.querySelectorAll("input,select").forEach(control => {
            control.addEventListener("change", () => {
                normalizarControlNumerico(control);
                const campo = control.dataset.campo;
                DOMA_ESTADO.transaccion("editar punto de efecto", candidato => {
                    const definicion = candidato.definiciones.find(entrada => entrada.id === idMovimiento);
                    const actual = definicion?.efectos?.find(entrada => entrada.id === idEfecto);
                    if (!actual) return;
                    actual[campo] = ["momento", "duracion"].includes(campo)
                        ? Number(control.value)
                        : control.value;
                });
            });
        });
        fila.querySelector(".borrar-efecto").addEventListener("click", () => {
            if (!permitirAccionBreve("eliminar-efecto")) return;
            DOMA_ESTADO.transaccion("eliminar punto de efecto", candidato => {
                const definicion = candidato.definiciones.find(entrada => entrada.id === idMovimiento);
                if (!definicion?.efectos) return;
                definicion.efectos = definicion.efectos.filter(entrada => entrada.id !== idEfecto);
            });
        });

        contenedor.append(fila);
        DOMA_EMOJIS.registrarCamposDentro(fila);
    });
}

function renderPaleta(tipo, contenedor) {
    contenedor.innerHTML = "";
    proyecto().senales[tipo].forEach(senal => {
        const idSenal = senal.id;
        const fila = document.createElement("article");
        fila.className = "fila-paleta";
        fila.innerHTML = `
            <input data-campo="color" class="selector-color" type="color">
            <span class="campo-emoji-contenedor"><input data-campo="emoji" data-emoji-input class="campo-emoji" type="text"></span>
            <input data-campo="significado" type="text">
            <button type="button" class="borrar-paleta" title="Eliminar color">×</button>`;
        fila.querySelector('[data-campo="color"]').value = senal.color;
        fila.querySelector('[data-campo="emoji"]').value = senal.emoji || "";
        fila.querySelector('[data-campo="significado"]').value = senal.significado;

        fila.querySelectorAll("input").forEach(control => {
            control.addEventListener("change", () => {
                DOMA_ESTADO.transaccion(`editar paleta ${tipo}`, candidato => {
                    const actual = candidato.senales[tipo].find(entrada => entrada.id === idSenal);
                    if (actual) actual[control.dataset.campo] = control.value;
                });
            });
        });
        const borrar = fila.querySelector(".borrar-paleta");
        borrar.disabled = proyecto().senales[tipo].length <= 1;
        borrar.addEventListener("click", () => eliminarSenal(tipo, idSenal));
        contenedor.append(fila);
        DOMA_EMOJIS.registrarCamposDentro(fila);
    });
}

function contarReferenciasSenal(tipo, idSenal) {
    let referencias = 0;
    proyecto().definiciones.forEach(definicion => {
        if (tipo === "caballo" && definicion.senalCaballoId === idSenal) referencias++;
        if (tipo === "jinete" && definicion.senalJineteId === idSenal) referencias++;
        definicion.efectos.forEach(efecto => {
            if (tipo === "caballo" && efecto.caballoId === idSenal) referencias++;
            if (tipo === "jinete" && efecto.jineteId === idSenal) referencias++;
        });
    });
    return referencias;
}

async function eliminarSenal(tipo, idSenal) {
    vaciarAutoedicion();
    const lista = proyecto().senales[tipo] || [];
    const senal = lista.find(entrada => entrada.id === idSenal);
    if (!senal || lista.length <= 1) return;
    const referencias = contarReferenciasSenal(tipo, idSenal);
    const aceptado = await DOMA_ERRORES.confirmar({
        titulo:"Eliminar señal",
        mensaje:referencias
            ? `Se eliminará «${senal.significado}» y ${referencias} referencia(s) pasarán a otra señal. Puedes deshacer la operación.`
            : `Se eliminará «${senal.significado}». Puedes deshacer la operación.`,
        confirmarTexto:"Eliminar señal"
    });
    if (!aceptado) return;

    DOMA_ESTADO.transaccion(`eliminar señal ${tipo}`, candidato => {
        const listaCandidata = candidato.senales[tipo];
        if (!Array.isArray(listaCandidata) || listaCandidata.length <= 1) return;
        const eliminada = listaCandidata.find(entrada => entrada.id === idSenal);
        const reemplazo = listaCandidata.find(entrada => entrada.id !== idSenal)?.id;
        if (!eliminada || !reemplazo) return;
        candidato.senales[tipo] = listaCandidata.filter(entrada => entrada.id !== idSenal);

        candidato.definiciones.forEach(definicion => {
            if (tipo === "caballo" && definicion.senalCaballoId === idSenal) definicion.senalCaballoId = reemplazo;
            if (tipo === "jinete" && definicion.senalJineteId === idSenal) definicion.senalJineteId = reemplazo;
            definicion.efectos.forEach(efecto => {
                if (tipo === "caballo" && efecto.caballoId === idSenal) efecto.caballoId = reemplazo;
                if (tipo === "jinete" && efecto.jineteId === idSenal) efecto.jineteId = reemplazo;
            });
        });
    });
    DOMA.avisar?.("Señal eliminada · puedes usar Deshacer");
}

function anadirSenal(tipo) {
    if (!comprobarLimite(
        proyecto().senales[tipo]?.length || 0,
        LIMITES_EDICION.senalesPorPaleta,
        "La paleta ya contiene 40 señales; elimina alguna antes de añadir otra"
    )) return;
    DOMA_ESTADO.transaccion(`añadir señal ${tipo}`, candidato => {
        candidato.senales[tipo].push({
            id: `${tipo}_${DOMA.crearId()}`,
            color: tipo === "caballo" ? "#5b8def" : "#e26d9f",
            significado: tipo === "caballo" ? "Nueva señal del caballo" : "Nueva señal para quien monta",
            emoji: tipo === "caballo" ? "●" : "🧍"
        });
    });
}

function renderPistaProyecto() {
    const p = proyecto();
    $("proyectoNombre").value = p.nombre;
    $("proyectoOrientacion").value = p.ambiente.orientacion;
    $("proyectoLetras").checked = p.pista.letras;
    $("proyectoInteriores").checked = p.pista.interiores;
    $("proyectoCuadricula").checked = p.pista.cuadricula;
    $("pistaPreset").value = p.pista.preset;
    $("pistaAncho").value = p.pista.ancho;
    $("pistaLargo").value = p.pista.largo;
    $("pistaPlantilla").value = p.pista.plantilla;
    $("pistaDimensiones").classList.toggle("oculto", p.pista.preset !== "personalizada");
    $("pistaPlantilla").disabled = p.pista.preset !== "personalizada";

    $("pistaAviso").textContent = p.pista.oficial
        ? `Configuración oficial ${p.pista.ancho} × ${p.pista.largo} m.`
        : `Pista de entrenamiento ${p.pista.ancho} × ${p.pista.largo} m. Las letras se escalan de forma proporcional.`;
}

function aplicarPistaProyecto() {
    normalizarControlNumerico($("pistaAncho"));
    normalizarControlNumerico($("pistaLargo"));
    DOMA_ESTADO.transaccion("configurar pista", candidato => {
        candidato.nombre = $("proyectoNombre").value.trim() || "Proyecto sin nombre";
        candidato.ambiente.orientacion = $("proyectoOrientacion").value || "N";
        candidato.pista.preset = $("pistaPreset").value;
        candidato.pista.ancho = Number($("pistaAncho").value || 20);
        candidato.pista.largo = Number($("pistaLargo").value || 60);
        candidato.pista.plantilla = $("pistaPlantilla").value;
        candidato.pista.letras = $("proyectoLetras").checked;
        candidato.pista.interiores = $("proyectoInteriores").checked;
        candidato.pista.cuadricula = $("proyectoCuadricula").checked;
    });
}


function elementoFijoSeleccionado() {
    const lista = proyecto().elementosFijos || [];
    let elemento = lista.find(entrada => entrada.id === elementoFijoSeleccionadoId);
    if (!elemento && lista.length) {
        elemento = lista[0];
        elementoFijoSeleccionadoId = elemento.id;
    }
    return elemento || null;
}

function resumenEmoji(texto) {
    const partes = DOMA_EMOJIS.grafemas(String(texto || "")).filter(parte => parte.trim());
    return partes.slice(0, 4).join("") || "📍";
}

function renderElementosFijos() {
    const lista = proyecto().elementosFijos || [];
    const contenedor = $("listaElementosFijos");
    contenedor.innerHTML = "";
    $("contadorElementosFijos").textContent = String(lista.length);

    lista.forEach(elemento => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = `item-elemento-fijo ${elemento.id === elementoFijoSeleccionadoId ? "activo" : ""}`;
        // nombre y emoji son datos editables/importables: no se interpolan como HTML.
        const vista = document.createElement("span");
        vista.className = "vista-emoji-fijo";
        vista.textContent = resumenEmoji(elemento.emoji);
        const contenido = document.createElement("span");
        const nombre = document.createElement("strong");
        nombre.textContent = elemento.nombre;
        const estado = document.createElement("small");
        estado.textContent = `${elemento.visible ? "Visible" : "Oculto"}${elemento.bloqueado ? " · bloqueado" : ""}`;
        contenido.append(nombre, estado);
        boton.append(vista, contenido);
        boton.addEventListener("click", () => {
            elementoFijoSeleccionadoId = elemento.id;
            colocandoElementoFijo = false;
            renderElementosFijos();
            window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
        });
        contenedor.append(boton);
    });

    const seleccionado = elementoFijoSeleccionado();
    $("sinElementoFijo").classList.toggle("oculto", Boolean(seleccionado));
    $("editorElementoFijo").classList.toggle("oculto", !seleccionado);
    if (!seleccionado) return;

    $("tituloElementoFijo").textContent = `Editar: ${seleccionado.nombre}`;
    $("elementoFijoNombre").value = seleccionado.nombre;
    $("elementoFijoEmoji").value = seleccionado.emoji;
    $("elementoFijoVisible").checked = seleccionado.visible;
    $("elementoFijoBloqueado").checked = seleccionado.bloqueado;
    $("elementoFijoTamano").value = seleccionado.tamano;
    $("valorTamanoElemento").textContent = `${Number(seleccionado.tamano).toFixed(2).replace(".", ",")}×`;
    $("elementoFijoRotacion").value = seleccionado.rotacion;
    const admiteExterior = ["sol", "jurado"].includes(seleccionado.tipo);
    const selectorPosicion = $("elementoFijoPosicionRapida");
    for (const opcion of selectorPosicion.options) {
        opcion.disabled = !admiteExterior && POSICIONES_EXTERIORES.has(opcion.value);
    }
    if (!admiteExterior && POSICIONES_EXTERIORES.has(selectorPosicion.value)) {
        selectorPosicion.value = "centro";
    }
    selectorPosicion.disabled = seleccionado.bloqueado;
    $("aplicarPosicionRapida").disabled = seleccionado.bloqueado;
    const botonColocar = $("colocarElementoPista");
    botonColocar.disabled = seleccionado.bloqueado;
    botonColocar.textContent = admiteExterior
        ? "Tocar pista o margen para colocar"
        : "Tocar pista para colocar";
    $("estadoColocacionFijo").textContent = seleccionado.bloqueado
        ? "La posición está bloqueada. Desmarca «Bloquear posición» para recolocarlo."
        : colocandoElementoFijo
            ? admiteExterior
                ? "Modo de colocación activo: toca dentro de la pista o en su margen exterior."
                : "Modo de colocación activo: toca un punto dentro de la pista."
            : admiteExterior
                ? "Pulsa «Tocar pista o margen para colocar» y después toca el lugar deseado."
                : "Pulsa «Tocar pista para colocar» y después toca el punto deseado.";
    $("estadoColocacionFijo").classList.toggle("activo", colocandoElementoFijo);
    DOMA_EMOJIS.registrarCampo($("elementoFijoEmoji"));
}

function nombreDisponibleElementoFijo(nombreBase) {
    const usados = new Set((proyecto().elementosFijos || []).map(elemento => elemento.nombre));
    if (!usados.has(nombreBase)) return nombreBase;
    let numero = 2;
    while (usados.has(`${nombreBase} ${numero}`)) numero++;
    return `${nombreBase} ${numero}`;
}

function renderPaletaElementosFijos() {
    const contenedor = $("paletaElementosFijos");
    if (contenedor.childElementCount) return;
    DOMA.TIPOS_ELEMENTOS_FIJOS
        .filter(tipo => tipo.id !== "personalizado")
        .forEach(tipo => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.innerHTML = `<span>${resumenEmoji(tipo.emoji)}</span><strong>${tipo.nombre}</strong>`;
            boton.addEventListener("click", () => {
                if (!comprobarLimite(
                    proyecto().elementosFijos?.length || 0,
                    LIMITES_EDICION.elementosFijos,
                    "El proyecto ya contiene 48 elementos fijos; elimina alguno antes de añadir otro"
                )) return;
                const elemento = DOMA.crearElementoFijo(tipo.id, {
                    nombre:nombreDisponibleElementoFijo(tipo.nombre)
                });
                DOMA_ESTADO.transaccion(`añadir elemento fijo: ${tipo.nombre}`, candidato => {
                    candidato.elementosFijos.push(elemento);
                });
                elementoFijoSeleccionadoId = elemento.id;
                // Añadir y colocar son acciones separadas. Esto evita que en móvil se active
                // un modo de colocación sin que la persona haya decidido cerrar el cajón.
                colocandoElementoFijo = false;
                renderElementosFijos();
                window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
            });
            contenedor.append(boton);
        });
}

function aplicarElementoFijo() {
    const seleccionado = elementoFijoSeleccionado();
    if (!seleccionado) return;
    normalizarControlNumerico($("elementoFijoRotacion"));
    const id = seleccionado.id;
    DOMA_ESTADO.transaccion("editar elemento fijo", candidato => {
        const elemento = candidato.elementosFijos.find(entrada => entrada.id === id);
        if (!elemento) return;
        elemento.nombre = $("elementoFijoNombre").value.trim() || "Elemento fijo";
        elemento.emoji = $("elementoFijoEmoji").value;
        elemento.visible = $("elementoFijoVisible").checked;
        elemento.bloqueado = $("elementoFijoBloqueado").checked;
        elemento.tamano = Number($("elementoFijoTamano").value || 1);
        elemento.rotacion = Number($("elementoFijoRotacion").value || 0);
    });
    if ($("elementoFijoBloqueado").checked || !$("elementoFijoVisible").checked) {
        colocandoElementoFijo = false;
        document.body.classList.remove("colocando-elemento-fijo");
        actualizarBarraColocacion();
    }
}

function aplicarPosicionRapida() {
    const seleccionado = elementoFijoSeleccionado();
    if (!seleccionado) return;
    if (seleccionado.bloqueado) {
        DOMA.avisar?.("Desbloquea la posición del elemento antes de moverlo");
        return;
    }
    const clave = $("elementoFijoPosicionRapida").value;
    const admiteExterior = ["sol", "jurado"].includes(seleccionado.tipo);
    if (!admiteExterior && POSICIONES_EXTERIORES.has(clave)) {
        DOMA.avisar?.("Este tipo de elemento debe permanecer dentro de la pista");
        return;
    }
    const id = seleccionado.id;
    const posicion = DOMA.posicionRapidaElemento(clave);
    colocandoElementoFijo = false;
    document.body.classList.remove("colocando-elemento-fijo");
    DOMA_ESTADO.transaccion("recolocar elemento fijo", candidato => {
        const elemento = candidato.elementosFijos.find(entrada => entrada.id === id);
        if (elemento) Object.assign(elemento, posicion);
    });
}

async function eliminarElementoFijo() {
    const seleccionado = elementoFijoSeleccionado();
    if (!seleccionado) return;
    const aceptado = await DOMA_ERRORES.confirmar({
        titulo:"Eliminar elemento fijo",
        mensaje:`Se eliminará «${seleccionado.nombre}». Puedes recuperarlo inmediatamente con Deshacer.`,
        confirmarTexto:"Eliminar elemento"
    });
    if (!aceptado) return;
    const id = seleccionado.id;
    const indiceAnterior = (proyecto().elementosFijos || []).findIndex(elemento => elemento.id === id);
    DOMA_ESTADO.transaccion("eliminar elemento fijo", candidato => {
        candidato.elementosFijos = candidato.elementosFijos.filter(elemento => elemento.id !== id);
    });
    const listaActual = proyecto().elementosFijos || [];
    elementoFijoSeleccionadoId = listaActual[Math.min(indiceAnterior, listaActual.length - 1)]?.id || null;
    colocandoElementoFijo = false;
    renderElementosFijos();
    window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
    DOMA.avisar?.("Elemento eliminado · puedes usar Deshacer");
}

function establecerPestana(nombre) {
    pestanaActiva = nombre;
    if (nombre !== "fijos") {
        colocandoElementoFijo = false;
        document.body.classList.remove("colocando-elemento-fijo");
    }
    const titulos = {
        movimiento:["Editar movimiento", "La selección permanece fijada mientras continúa la reproducción"],
        aprende:["Aprende", "Consejo de la profesora asociado al movimiento seleccionado"],
        senales:["Señales del caballo y de quien monta", "Colores, significados y emojis pedagógicos"],
        fijos:["Elementos fijos 🚧🎏", "Sol, jurado, macetas, palos y obstáculos"],
        musica:["Música local", "Audio del dispositivo sincronizado con la prueba"],
        proyecto:["Proyecto y pista", "Nombre, dimensiones, referencias y orientación"]
    };
    const titulo = titulos[nombre] || titulos.movimiento;
    $("tituloEdicion").textContent = titulo[0];
    $("subtituloEdicion").textContent = titulo[1];
    const scroll = document.querySelector(".cajon-scroll");
    if (scroll) scroll.scrollTop = 0;
    if (nombre === "fijos") renderElementosFijos();
    actualizarBarraColocacion();
}

function actualizarBarraColocacion() {
    const barra = $("barraColocacionFijo");
    const seleccionado = elementoFijoSeleccionado();
    const admiteExterior = ["sol", "jurado"].includes(seleccionado?.tipo);
    barra.querySelector("span").textContent = admiteExterior
        ? "📍 Toca dentro de la pista o en el margen exterior para colocar el elemento."
        : "📍 Toca un punto dentro de la pista para colocar el elemento.";
    barra.classList.toggle("oculto", !colocandoElementoFijo);
}

function cancelarColocacionFija(reabrir = true) {
    colocandoElementoFijo = false;
    document.body.classList.remove("colocando-elemento-fijo");
    actualizarBarraColocacion();
    if (reabrir && document.body.dataset.layout === "compacto") {
        DOMA_LAYOUT.abrirEdicion();
        establecerPestana("fijos");
    }
    renderElementosFijos();
    window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
}

function estadoElementosFijos() {
    const seleccionado = elementoFijoSeleccionado();
    return {
        pestanaActiva,
        elementosEditables:pestanaActiva === "fijos" && (document.body.classList.contains("edicion-abierta") || colocandoElementoFijo),
        elementoSeleccionadoId:elementoFijoSeleccionadoId,
        colocandoElemento:colocandoElementoFijo,
        tipoElementoColocando:colocandoElementoFijo ? seleccionado?.tipo || "" : ""
    };
}

function renderValidacion() {
    const problemas = DOMA.validarProyecto(proyecto());
    const nodo = $("estadoValidacion");
    if (!problemas.length) {
        nodo.className = "estado-validacion correcto";
        nodo.textContent = "Todo en orden: no se detectan problemas en el proyecto.";
        return;
    }
    const errores = problemas.filter(p => p.nivel === "error");
    nodo.className = `estado-validacion ${errores.length ? "error" : "aviso"}`;
    nodo.replaceChildren();
    problemas.slice(0, 5).forEach(problema => {
        const linea = document.createElement("div");
        linea.textContent = `${problema.nivel === "error" ? "⛔" : "⚠️"} ${problema.mensaje}`;
        nodo.append(linea);
    });
}

function mover(delta) {
    vaciarAutoedicion();
    const i = indice();
    const destino = i + delta;
    if (destino < 0 || destino >= proyecto().definiciones.length) return;
    DOMA_ESTADO.transaccion("reordenar movimiento", candidato => {
        [candidato.definiciones[i], candidato.definiciones[destino]] =
            [candidato.definiciones[destino], candidato.definiciones[i]];
    });
    DOMA_ESTADO.actualizarInterfaz({ indiceEdicion: destino }, "seleccion-edicion");
}

function insertar(tipo) {
    if (!comprobarLimite(
        proyecto().definiciones.length,
        LIMITES_EDICION.movimientos,
        "El proyecto ya contiene 120 movimientos; elimina alguno antes de añadir otro"
    )) return;
    vaciarAutoedicion();
    const i = indice();
    const compilados = DOMA.compilarSecuencia(proyecto().definiciones, proyecto().pista);
    const nuevo = DOMA.nuevaDefinicion(tipo, compilados[i]?.fin || { x:proyecto().pista.ancho/2, y:0 }, proyecto().pista);
    DOMA_ESTADO.transaccion("insertar movimiento", candidato => {
        candidato.definiciones.splice(i + 1, 0, nuevo);
    });
    DOMA_ESTADO.actualizarInterfaz({ indiceEdicion: i + 1 }, "seleccion-edicion");
}

function prepararEventos() {
    const controlesFormulario = [
        "editTitulo","editTipo","editDestino","editDuracion","editOrientacion",
        "editComentario","editAyuda","editRadio","editMano","editSenalCaballo","editSenalJinete"
    ];
    controlesFormulario.forEach(id => {
        $(id).addEventListener(id === "editTitulo" || id === "editComentario" || id === "editAyuda" ? "input" : "change", programarFormulario);
    });
    $("editTipo").addEventListener("change", actualizarOpcionesTipo);

    $("moverAnterior").addEventListener("click", () => mover(-1));
    $("moverSiguiente").addEventListener("click", () => mover(1));
    $("duplicarMovimiento").addEventListener("click", () => {
        if (!comprobarLimite(
            proyecto().definiciones.length,
            LIMITES_EDICION.movimientos,
            "El proyecto ya contiene 120 movimientos; elimina alguno antes de duplicar"
        )) return;
        vaciarAutoedicion();
        const i = indice();
        DOMA_ESTADO.transaccion("duplicar movimiento", candidato => {
            const copia = DOMA.copiar(candidato.definiciones[i]);
            copia.id = DOMA.crearId();
            copia.titulo += " (copia)";
            copia.efectos = copia.efectos.map(e => ({ ...e, id:DOMA.crearId() }));
            candidato.definiciones.splice(i + 1, 0, copia);
        });
        DOMA_ESTADO.actualizarInterfaz({ indiceEdicion:i + 1 }, "seleccion-edicion");
    });
    $("eliminarMovimiento").addEventListener("click", async () => {
        vaciarAutoedicion();
        if (proyecto().definiciones.length <= 1) return DOMA.avisar?.("Debe quedar al menos un movimiento");
        const i = indice();
        const movimiento = proyecto().definiciones[i];
        const idMovimiento = movimiento.id;
        const aceptado = await DOMA_ERRORES.confirmar({
            titulo:"Eliminar movimiento",
            mensaje:`Se eliminará «${movimiento.titulo}». Puedes recuperarlo inmediatamente con Deshacer.`,
            confirmarTexto:"Eliminar movimiento"
        });
        if (!aceptado) return;
        const indiceActual = proyecto().definiciones.findIndex(entrada => entrada.id === idMovimiento);
        if (indiceActual < 0 || proyecto().definiciones.length <= 1) return;
        DOMA_ESTADO.transaccion("eliminar movimiento", candidato => {
            candidato.definiciones = candidato.definiciones.filter(entrada => entrada.id !== idMovimiento);
        });
        DOMA_ESTADO.actualizarInterfaz({ indiceEdicion:Math.max(0, indiceActual - 1) }, "seleccion-edicion");
        DOMA.avisar?.("Movimiento eliminado · puedes usar Deshacer");
    });

    $("anadirEfecto").addEventListener("click", () => {
        const i = indice();
        if (!comprobarLimite(
            proyecto().definiciones[i]?.efectos?.length || 0,
            LIMITES_EDICION.efectosPorMovimiento,
            "Este movimiento ya contiene 40 puntos de efecto; elimina alguno antes de añadir otro"
        )) return;
        vaciarAutoedicion();
        DOMA_ESTADO.transaccion("añadir punto de efecto", candidato => {
            const d = candidato.definiciones[i];
            d.efectos.push({
                id:DOMA.crearId(),
                momento:Math.min(d.duracion / 2, d.duracion),
                duracion:.8,
                emoji:"✨",
                caballoId:d.senalCaballoId,
                jineteId:d.senalJineteId
            });
        });
    });

    $("anadirColorCaballo").addEventListener("click", () => anadirSenal("caballo"));
    $("anadirColorJinete").addEventListener("click", () => anadirSenal("jinete"));


    ["elementoFijoNombre","elementoFijoEmoji","elementoFijoVisible","elementoFijoBloqueado","elementoFijoRotacion"]
        .forEach(id => $(id).addEventListener("change", aplicarElementoFijo));
    $("elementoFijoTamano").addEventListener("input", () => {
        $("valorTamanoElemento").textContent = `${Number($("elementoFijoTamano").value).toFixed(2).replace(".", ",")}×`;
    });
    $("elementoFijoTamano").addEventListener("change", aplicarElementoFijo);
    $("aplicarPosicionRapida").addEventListener("click", aplicarPosicionRapida);
    $("colocarElementoPista").addEventListener("click", () => {
        const seleccionado = elementoFijoSeleccionado();
        if (!seleccionado) return;
        if (seleccionado.bloqueado) {
            DOMA.avisar?.("Desbloquea la posición del elemento antes de moverlo");
            return;
        }
        colocandoElementoFijo = true;
        document.body.classList.add("colocando-elemento-fijo");
        if (document.body.dataset.layout === "compacto") DOMA_LAYOUT.cerrarEdicion();
        actualizarBarraColocacion();
        renderElementosFijos();
        window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
    });
    $("eliminarElementoFijo").addEventListener("click", eliminarElementoFijo);

    window.addEventListener("doma:seleccionar-elemento-fijo", evento => {
        elementoFijoSeleccionadoId = evento.detail.id;
        colocandoElementoFijo = false;
        renderElementosFijos();
        window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
    });
    window.addEventListener("doma:colocar-elemento-fijo", evento => {
        const seleccionado = elementoFijoSeleccionado();
        if (!seleccionado || seleccionado.bloqueado || !colocandoElementoFijo) return;
        const id = seleccionado.id;
        const reabrirCompacto = document.body.dataset.layout === "compacto";
        colocandoElementoFijo = false;
        document.body.classList.remove("colocando-elemento-fijo");
        actualizarBarraColocacion();
        DOMA_ESTADO.transaccion("colocar elemento fijo en la pista", candidato => {
            const elemento = candidato.elementosFijos.find(entrada => entrada.id === id);
            if (elemento) {
                elemento.xNorm = evento.detail.xNorm;
                elemento.yNorm = evento.detail.yNorm;
            }
        });
        DOMA.avisar?.(`${seleccionado.nombre} colocado`);
        if (reabrirCompacto) {
            setTimeout(() => {
                DOMA_LAYOUT.abrirEdicion();
                establecerPestana("fijos");
                window.dispatchEvent(new CustomEvent("doma:refrescar-pista"));
            }, 650);
        }
    });
    $("cancelarColocacionFijo").addEventListener("click", () => cancelarColocacionFija(true));
    window.addEventListener("doma:colocacion-fuera-pista", evento => {
        DOMA.avisar?.(evento.detail?.admiteExterior
            ? "Toca dentro de la pista o en el margen exterior próximo"
            : "Toca dentro del rectángulo de la pista");
    });

    ["proyectoNombre","proyectoOrientacion","pistaAncho","pistaLargo",
     "pistaPlantilla","proyectoLetras","proyectoInteriores","proyectoCuadricula"]
        .forEach(id => $(id).addEventListener("change", aplicarPistaProyecto));

    $("pistaPreset").addEventListener("change", () => {
        const preset = $("pistaPreset").value;
        if (preset === "oficial_60") {
            $("pistaAncho").value = 20; $("pistaLargo").value = 60; $("pistaPlantilla").value = "larga";
        } else if (preset === "oficial_40") {
            $("pistaAncho").value = 20; $("pistaLargo").value = 40; $("pistaPlantilla").value = "corta";
        }
        aplicarPistaProyecto();
    });

    const paleta = $("paletaRapida");
    paleta.innerHTML = "";
    DOMA.TIPOS.forEach(tipo => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = `${tipo.icono} ${tipo.nombre}`;
        boton.addEventListener("click", () => insertar(tipo.id));
        paleta.append(boton);
    });
}

function render() {
    renderFormulario();
    renderPaleta("caballo", $("paletaCaballo"));
    renderPaleta("jinete", $("paletaJinete"));
    renderPaletaElementosFijos();
    renderElementosFijos();
    actualizarBarraColocacion();
    renderPistaProyecto();
    renderValidacion();
}

function inicializar() {
    if (preparado) return;
    preparado = true;
    llenarTipos($("editTipo"));
    llenarDestinos($("editDestino"));
    elementoFijoSeleccionadoId = proyecto().elementosFijos?.[0]?.id || null;
    prepararEventos();
    DOMA_EMOJIS.registrarCamposDentro(document);
    DOMA_ESTADO.suscribir(({ motivo }) => {
        if (["recuperacion", "carga"].includes(motivo)) descartarAutoedicion();
        if (["proyecto","deshacer","rehacer","recuperacion","seleccion-edicion","carga"].includes(motivo)) {
            DOMA_ERRORES.intentar("renderizado del editor", render);
        }
    });
    render();
}

window.DOMA_EDITOR = {
    inicializar,
    establecerPestana,
    estadoElementosFijos,
    vaciarAutoedicion
};
})();
