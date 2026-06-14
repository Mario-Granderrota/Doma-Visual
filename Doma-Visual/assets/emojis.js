/*
Doma Visual · Versión 0
Módulo: entrada Unicode libre y secuencias recientes.
Dependencias: editor y campos dinámicos de señales, efectos y elementos fijos.

Decisiones:
- No existe un catálogo cerrado de emojis.
- Intl.Segmenter separa grafemas cuando está disponible; Array.from es la alternativa.
- Cada campo recibe un único botón auxiliar mediante data-emoji-preparado.
*/

(() => {
"use strict";

const CLAVE_RECIENTES = "doma_visual_emojis_recientes_v1";
const MAX_RECIENTES = 30;
let objetivo = null;
let recientes = [];

function normalizarSecuencia(valor) {
    const texto = typeof valor === "string" ? valor.trim() : "";
    if (!texto) return "";
    return grafemas(texto).slice(0, 16).join("").slice(0, 256);
}

function cargarRecientes() {
    try {
        const entrada = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || "[]");
        recientes = Array.isArray(entrada)
            ? entrada
                .map(normalizarSecuencia)
                .filter(Boolean)
                .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
                .slice(0, MAX_RECIENTES)
            : [];
    } catch (_) {
        recientes = [];
    }
}

function guardarRecientes() {
    try {
        localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(recientes.slice(0, MAX_RECIENTES)));
    } catch (_) {
        // El selector sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
}

function grafemas(texto) {
    const valor = String(texto || "");
    if (globalThis.Intl?.Segmenter) {
        const segmentador = new Intl.Segmenter("es", { granularity: "grapheme" });
        return [...segmentador.segment(valor)].map(segmento => segmento.segment);
    }
    return Array.from(valor);
}

function registrarReciente(valor) {
    const texto = normalizarSecuencia(valor);
    if (!texto) return;
    recientes = [texto, ...recientes.filter(item => item !== texto)].slice(0, MAX_RECIENTES);
    guardarRecientes();
    pintarRecientes();
}

function crearSelector() {
    if (document.getElementById("selectorEmojiLibre")) return;

    const dialogo = document.createElement("dialog");
    dialogo.id = "selectorEmojiLibre";
    dialogo.className = "selector-emoji-libre";
    dialogo.innerHTML = `
        <form method="dialog">
            <header>
                <div>
                    <h2>Emoji o secuencia libre</h2>
                    <p>No existe una lista cerrada: puedes pegar cualquier emoji Unicode.</p>
                </div>
                <button value="cancel" aria-label="Cerrar">×</button>
            </header>
            <label>Escribe o pega emojis
                <input id="emojiLibreEntrada" type="text" autocomplete="off">
            </label>
            <p class="ayuda-emoji">
                Usa el selector del sistema: Windows + punto, Control + Comando + espacio en macOS,
                o el teclado emoji del móvil. También puedes pegar combinaciones completas.
            </p>
            <div>
                <strong>Recientes</strong>
                <div id="emojiRecientes" class="emoji-recientes"></div>
            </div>
            <footer>
                <button value="cancel">Cancelar</button>
                <button id="insertarEmojiLibre" value="default" class="principal">Insertar</button>
            </footer>
        </form>`;
    document.body.append(dialogo);

    dialogo.querySelector("#insertarEmojiLibre").addEventListener("click", evento => {
        evento.preventDefault();
        const entrada = dialogo.querySelector("#emojiLibreEntrada");
        const valor = entrada.value;
        dialogo.close();
        insertar(valor);
    });
    pintarRecientes();
}

function pintarRecientes() {
    const contenedor = document.getElementById("emojiRecientes");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    if (!recientes.length) {
        contenedor.innerHTML = "<span class='sin-emojis'>Todavía no hay recientes.</span>";
        return;
    }
    for (const valor of recientes) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = valor;
        boton.title = `${grafemas(valor).length} símbolo(s) visible(s)`;
        boton.addEventListener("click", () => {
            const dialogo = document.getElementById("selectorEmojiLibre");
            if (dialogo?.open) dialogo.close();
            insertar(valor);
        });
        contenedor.append(boton);
    }
}

function insertar(valor) {
    if (!objetivo || !objetivo.isConnected) {
        objetivo = null;
        window.DOMA?.avisar?.("El campo de destino ya no está disponible");
        return;
    }
    const texto = normalizarSecuencia(valor);
    if (!texto) return;
    const inicio = objetivo.selectionStart ?? objetivo.value.length;
    const fin = objetivo.selectionEnd ?? objetivo.value.length;
    objetivo.value = objetivo.value.slice(0, inicio) + texto + objetivo.value.slice(fin);
    objetivo.dispatchEvent(new Event("input", { bubbles: true }));
    objetivo.dispatchEvent(new Event("change", { bubbles: true }));
    registrarReciente(texto);
    objetivo.focus();
    const posicion = inicio + texto.length;
    objetivo.setSelectionRange?.(posicion, posicion);
    objetivo = null;
}

function abrir(campo) {
    objetivo = campo;
    crearSelector();
    const dialogo = document.getElementById("selectorEmojiLibre");
    dialogo.querySelector("#emojiLibreEntrada").value = "";
    pintarRecientes();
    dialogo.showModal();
    setTimeout(() => dialogo.querySelector("#emojiLibreEntrada").focus(), 0);
}

function registrarCampo(campo) {
    if (!campo || campo.dataset.emojiPreparado === "1") return;
    campo.dataset.emojiPreparado = "1";
    campo.removeAttribute("maxlength");
    campo.setAttribute("autocomplete", "off");
    campo.title = "Acepta cualquier emoji o secuencia Unicode. Doble clic para abrir recientes.";
    campo.addEventListener("change", () => registrarReciente(campo.value));
    campo.addEventListener("dblclick", () => abrir(campo));

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "abrir-selector-emoji";
    boton.textContent = "☺";
    boton.title = "Abrir entrada libre de emojis";
    boton.addEventListener("click", () => abrir(campo));
    campo.insertAdjacentElement("afterend", boton);
}

function registrarCamposDentro(contenedor = document) {
    contenedor.querySelectorAll("[data-emoji-input]").forEach(registrarCampo);
}

cargarRecientes();
window.DOMA_EMOJIS = {
    grafemas,
    registrarCampo,
    registrarCamposDentro
};
})();
