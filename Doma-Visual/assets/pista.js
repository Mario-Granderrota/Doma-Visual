/*
Doma Visual · Versión 0
Módulo: renderizado SVG de pista, trayectorias, caballo, jinete y elementos fijos.
Dependencias: modelo, emojis, editor, layout y aplicación.

Invariantes:
- La vista vertical y la apaisada son proyecciones de las mismas coordenadas persistentes.
- El rectángulo útil conserva la proporción física; letras y decoración usan márgenes aparte.
- Las trayectorias se recortan visualmente, pero el modelo conserva los puntos originales.
- Los elementos fijos solo reciben eventos cuando el editor declara modo editable.
- Textos y emojis se recolocan sin girar todo el SVG mediante CSS.
*/

(() => {
"use strict";

const NS = "http://www.w3.org/2000/svg";
const crear = (nombre, atributos = {}, texto = "") => {
    const nodo = document.createElementNS(NS, nombre);
    for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, String(valor));
    if (texto) nodo.textContent = texto;
    return nodo;
};

function crearProyeccion(pistaEntrada, orientacionVisual = "vertical") {
    const pista = DOMA.normalizarPista(pistaEntrada);
    const horizontal = orientacionVisual === "horizontal";
    const ancho = pista.ancho;
    const largo = pista.largo;

    return {
        pista,
        horizontal,
        anchoVisual: horizontal ? largo : ancho,
        altoVisual: horizontal ? ancho : largo,
        proyectar(punto) {
            return horizontal
                ? { x:punto.y, y:punto.x }
                : { x:punto.x, y:largo - punto.y };
        },
        desproyectar(punto) {
            return horizontal
                ? { x:punto.y, y:punto.x }
                : { x:punto.x, y:largo - punto.y };
        },
        anguloVisual(anguloModelo) {
            return horizontal ? 90 - anguloModelo : -anguloModelo;
        }
    };
}

/*
La colocación libre usa coordenadas del modelo. Los objetos ordinarios quedan dentro del
rectángulo útil; Sol y Jurado admiten el margen exterior limitado que ya acepta el esquema.
Así la interacción y la normalización comparten exactamente las mismas fronteras.
*/
function normalizarPuntoColocacion(pista, punto, admiteExterior) {
    const limites = admiteExterior
        ? {
            xMin:-.30 * pista.ancho,
            xMax:1.30 * pista.ancho,
            yMin:-.12 * pista.largo,
            yMax:1.12 * pista.largo
        }
        : { xMin:0, xMax:pista.ancho, yMin:0, yMax:pista.largo };
    const valido = punto.x >= limites.xMin && punto.x <= limites.xMax
        && punto.y >= limites.yMin && punto.y <= limites.yMax;
    if (!valido) return null;
    return {
        xNorm:DOMA.limitar(punto.x / pista.ancho, admiteExterior ? -.30 : 0, admiteExterior ? 1.30 : 1),
        yNorm:DOMA.limitar(punto.y / pista.largo, admiteExterior ? -.12 : 0, admiteExterior ? 1.12 : 1)
    };
}

function ruta(proyeccion, puntos) {
    return puntos.map((punto, indice) => {
        const q = proyeccion.proyectar(punto);
        return `${indice ? "L" : "M"} ${q.x.toFixed(3)} ${q.y.toFixed(3)}`;
    }).join(" ");
}

function marcador(defs, id, color) {
    const m = crear("marker", { id, viewBox:"0 0 10 10", refX:8, refY:5, markerWidth:5, markerHeight:5, orient:"auto" });
    m.append(crear("path", { d:"M0 0 L10 5 L0 10 z", fill:color }));
    defs.append(m);
}

function caballo() {
    const grupo = crear("g");
    const coloreables = [];
    const elementos = [
        crear("ellipse",{cx:0,cy:.05,rx:.72,ry:1.16,class:"cuerpo-caballo"}),
        crear("rect",{x:-.23,y:-1.34,width:.46,height:.54,rx:.18,class:"cuello-caballo"}),
        crear("circle",{cx:0,cy:-1.68,r:.4,class:"cabeza-caballo"}),
        crear("circle",{cx:-.28,cy:-1.94,r:.1,class:"oreja-caballo"}),
        crear("circle",{cx:.28,cy:-1.94,r:.1,class:"oreja-caballo"})
    ];
    coloreables.push(...elementos);
    grupo.append(...elementos, crear("path",{d:"M0 1.05 Q .38 1.52 0 1.9 Q -.35 1.52 0 1.05",class:"cola-caballo"}));
    [[-.61,-.58],[.61,-.58],[-.61,.62],[.61,.62]].forEach(([x,y]) => {
        grupo.append(crear("circle",{cx:x,cy:y,r:.12,class:"pata-caballo"}));
    });
    return { grupo, coloreables };
}

function posicionLetra(proyeccion, referencia) {
    const { pista, horizontal } = proyeccion;
    const ancho = pista.ancho;
    const largo = pista.largo;
    const margenLateral = Math.max(3.6, ancho * .18);
    const margenExtremo = Math.max(1.8, largo * .035);
    const q = proyeccion.proyectar(referencia);

    if (referencia.tipo === "interior") {
        return horizontal
            ? { x:q.x + .2, y:q.y + Math.max(.7, ancho * .035) }
            : { x:q.x + Math.max(.7, ancho * .035), y:q.y + .2 };
    }
    if (referencia.lado === "izquierda") {
        return horizontal ? { x:q.x, y:-margenLateral } : { x:-margenLateral, y:q.y };
    }
    if (referencia.lado === "derecha") {
        return horizontal ? { x:q.x, y:ancho + margenLateral } : { x:ancho + margenLateral, y:q.y };
    }
    if (referencia.y <= .001) {
        return horizontal ? { x:-margenExtremo, y:q.y } : { x:q.x, y:largo + margenExtremo };
    }
    return horizontal ? { x:largo + margenExtremo, y:q.y } : { x:q.x, y:-margenExtremo };
}

function emojiVisual(texto, maximo) {
    const original = String(texto || "");
    const partes = window.DOMA_EMOJIS?.grafemas
        ? DOMA_EMOJIS.grafemas(original)
        : Array.from(original);
    return {
        original,
        visible: partes.slice(0, maximo).join(""),
        cantidad: partes.length
    };
}

function grafemasVisibles(texto, maximo = 4) {
    const partes = window.DOMA_EMOJIS?.grafemas
        ? DOMA_EMOJIS.grafemas(String(texto || ""))
        : Array.from(String(texto || ""));
    return partes.filter(parte => parte.trim()).slice(0, maximo);
}

/*
Los márgenes del viewBox deben considerar el tamaño real de los elementos exteriores.
No basta con reservar espacio para su centro: un jurado con varios emojis es más ancho
que un sol y puede quedar visualmente pegado al borde. Para cada lado se conserva, como
mínimo, una separación exterior equivalente a la que existe entre la pista y el objeto.
*/
function geometriaElemento(elemento, iconos = grafemasVisibles(elemento.emoji, 3)) {
    const escala = Math.max(.5, Math.min(2.5, Number(elemento.tamano || 1)));
    const esJurado = elemento.tipo === "jurado";
    const separacion = (esJurado ? 1.75 : 1.55) * escala;
    return {
        escala,
        esJurado,
        separacion,
        ancho:Math.max(2.4 * escala, iconos.length * separacion + .8 * escala),
        // El jurado necesita aire superior: los glifos emoji suelen ocupar más caja visual
        // por encima de su línea media que los demás elementos.
        alto:(esJurado ? 3.55 : 2.35) * escala,
        emojiY:(esJurado ? -.12 : .12) * escala,
        emojiTamano:(esJurado ? 2.15 : 1.55) * escala,
        etiquetaY:1.30 * escala
    };
}

function extensionElemento(elemento) {
    const geometria = geometriaElemento(elemento);
    const angulo = Number(elemento.rotacion || 0) * Math.PI / 180;
    const coseno = Math.abs(Math.cos(angulo));
    const seno = Math.abs(Math.sin(angulo));
    return {
        x: coseno * geometria.ancho / 2 + seno * geometria.alto / 2,
        y: seno * geometria.ancho / 2 + coseno * geometria.alto / 2
    };
}

function ampliarMargen(margenActual, distancia, extension) {
    if (!(distancia > 0)) return margenActual;
    // 2 * distancia produce dos huecos iguales cuando el objeto no invade la pista.
    // La segunda cota evita recortes en elementos grandes o girados.
    return Math.max(margenActual, 2 * distancia, distancia + extension + .6);
}

function calcularMargenesVista(proyecto, proyeccion) {
    const ancho = proyeccion.pista.ancho;
    const largo = proyeccion.pista.largo;
    const margenes = {
        izquierda:Math.max(6, ancho * .35),
        derecha:Math.max(6, ancho * .35),
        c:Math.max(7, largo * .12),
        a:Math.max(8, largo * .14)
    };

    for (const elemento of proyecto.elementosFijos || []) {
        if (!elemento?.visible) continue;
        const extension = extensionElemento(elemento);
        const extensionTransversal = proyeccion.horizontal ? extension.y : extension.x;
        const extensionLongitudinal = proyeccion.horizontal ? extension.x : extension.y;
        margenes.izquierda = ampliarMargen(
            margenes.izquierda,
            Math.max(0, -Number(elemento.xNorm || 0) * ancho),
            extensionTransversal
        );
        margenes.derecha = ampliarMargen(
            margenes.derecha,
            Math.max(0, (Number(elemento.xNorm || 0) - 1) * ancho),
            extensionTransversal
        );
        margenes.a = ampliarMargen(
            margenes.a,
            Math.max(0, -Number(elemento.yNorm || 0) * largo),
            extensionLongitudinal
        );
        margenes.c = ampliarMargen(
            margenes.c,
            Math.max(0, (Number(elemento.yNorm || 0) - 1) * largo),
            extensionLongitudinal
        );
    }
    return margenes;
}

function renderizarElementoFijo(svg, proyecto, elemento, opciones, proyeccion) {
    if (!elemento.visible) return;
    const puntoModelo = {
        x: elemento.xNorm * proyecto.pista.ancho,
        y: elemento.yNorm * proyecto.pista.largo
    };
    const posicion = proyeccion.proyectar(puntoModelo);
    const iconos = grafemasVisibles(elemento.emoji, 3);
    const geometria = geometriaElemento(elemento, iconos);
    const { escala } = geometria;
    const seleccionado = opciones.elementosEditables === true && opciones.elementoSeleccionadoId === elemento.id;
    const editable = opciones.elementosEditables === true;

    const grupo = crear("g", {
        class:["elemento-fijo", seleccionado ? "seleccionado" : "", elemento.bloqueado ? "bloqueado" : ""].filter(Boolean).join(" "),
        transform:`translate(${posicion.x} ${posicion.y}) rotate(${Number(elemento.rotacion || 0)})`,
        "data-elemento-id":elemento.id,
        role:editable ? "button" : "img",
        tabindex:editable ? "0" : "-1",
        "aria-label":`${elemento.nombre}${elemento.bloqueado ? ", posición bloqueada" : ""}`
    });
    grupo.append(crear("title", {}, `${elemento.nombre}${elemento.bloqueado ? " · bloqueado" : ""}`));

    const anchoFondo = geometria.ancho;
    const altoFondo = geometria.alto;
    grupo.append(crear("rect", {
        x:-anchoFondo/2,
        y:-altoFondo/2,
        width:anchoFondo,
        height:altoFondo,
        rx:.58 * escala,
        class:"fondo-elemento-fijo"
    }));

    iconos.forEach((icono, indice) => {
        const offset = (indice - (iconos.length - 1) / 2) * geometria.separacion;
        grupo.append(crear("text", {
            x:offset,
            y:geometria.emojiY,
            class:"emoji-elemento-fijo",
            "font-size":`${geometria.emojiTamano}px`,
            "text-anchor":"middle",
            "dominant-baseline":"middle"
        }, icono));
    });

    if (elemento.tipo === "jurado") {
        grupo.append(crear("text", {
            x:0,
            y:geometria.etiquetaY,
            class:"etiqueta-elemento-fijo",
            "font-size":`${.58 * escala}px`,
            "text-anchor":"middle"
        }, "JURADO"));
    }
    if (seleccionado) {
        grupo.append(crear("rect", {
            x:-anchoFondo/2-.22,
            y:-altoFondo/2-.22,
            width:anchoFondo+.44,
            height:altoFondo+.44,
            rx:.7 * escala,
            class:"marco-elemento-seleccionado"
        }));
    }

    if (editable) {
        const seleccionar = evento => {
            evento.preventDefault();
            evento.stopPropagation();
            window.dispatchEvent(new CustomEvent("doma:seleccionar-elemento-fijo", { detail:{ id:elemento.id } }));
        };
        grupo.addEventListener("click", seleccionar);
        grupo.addEventListener("keydown", evento => {
            if (["Enter", " "].includes(evento.key)) seleccionar(evento);
        });
    }
    svg.append(grupo);
}

function anadirLineaModelo(svg, proyeccion, inicio, fin, clase) {
    const a = proyeccion.proyectar(inicio);
    const b = proyeccion.proyectar(fin);
    svg.append(crear("line", { x1:a.x, y1:a.y, x2:b.x, y2:b.y, class:clase }));
}

function render(contenedor, proyectoEntrada, opciones = {}) {
    contenedor.replaceChildren();
    const proyecto = DOMA.normalizarProyecto(proyectoEntrada);
    const orientacionVisual = opciones.orientacionVisual === "horizontal" ? "horizontal" : "vertical";
    const proyeccion = crearProyeccion(proyecto.pista, orientacionVisual);
    const pista = proyeccion.pista;
    const ancho = pista.ancho;
    const largo = pista.largo;
    const margenes = calcularMargenesVista(proyecto, proyeccion);
    const viewBox = proyeccion.horizontal
        ? `${-margenes.a} ${-margenes.izquierda} ${largo + margenes.a + margenes.c} ${ancho + margenes.izquierda + margenes.derecha}`
        : `${-margenes.izquierda} ${-margenes.c} ${ancho + margenes.izquierda + margenes.derecha} ${largo + margenes.c + margenes.a}`;

    const idBase = String(contenedor.id || "pista").replace(/[^a-z0-9_-]/gi, "_");
    const idFlechaAvance = `fa-${idBase}`;
    const idFlechaCuerpo = `fc-${idBase}`;
    const idRecorte = `recortePista-${idBase}`;
    const svg = crear("svg", {
        viewBox,
        class:"svg-pista",
        preserveAspectRatio:"xMidYMid meet",
        "data-orientacion-visual":orientacionVisual,
        "aria-label":proyeccion.horizontal ? "Pista apaisada, A a la izquierda y C a la derecha" : "Pista vertical, A abajo y C arriba"
    });
    const defs = crear("defs");
    marcador(defs, idFlechaAvance, "#2376c8");
    marcador(defs, idFlechaCuerpo, "#7a58a6");
    const recortePista = crear("clipPath", { id:idRecorte });
    recortePista.append(crear("rect", {
        x:-.35,
        y:-.35,
        width:proyeccion.anchoVisual+.7,
        height:proyeccion.altoVisual+.7,
        rx:.65
    }));
    defs.append(recortePista);
    svg.append(defs);

    svg.append(crear("rect",{x:0,y:0,width:proyeccion.anchoVisual,height:proyeccion.altoVisual,rx:.65,class:"suelo-pista"}));
    if (pista.cuadricula) {
        const paso = largo <= 40 ? 5 : 10;
        for (let x = 5; x < ancho; x += 5) {
            anadirLineaModelo(svg, proyeccion, {x,y:0}, {x,y:largo}, "cuadricula");
        }
        for (let y = paso; y < largo; y += paso) {
            anadirLineaModelo(svg, proyeccion, {x:0,y}, {x:ancho,y}, "cuadricula");
        }
    }
    svg.append(crear("rect",{x:0,y:0,width:proyeccion.anchoVisual,height:proyeccion.altoVisual,rx:.65,class:"borde-pista"}));
    anadirLineaModelo(svg, proyeccion, {x:ancho/2,y:0}, {x:ancho/2,y:largo}, "linea-central");

    const letras = {};
    const referencias = DOMA.obtenerReferencias(pista);
    for (const [letra, referencia] of Object.entries(referencias)) {
        if (referencia.tipo === "interior" && !pista.interiores) continue;
        if (referencia.tipo === "exterior" && !pista.letras) continue;

        const q = proyeccion.proyectar(referencia);
        if (referencia.tipo === "interior") {
            svg.append(crear("circle",{cx:q.x,cy:q.y,r:Math.max(.22,ancho*.011),class:"punto-interior"}));
        }
        const pos = posicionLetra(proyeccion, referencia);
        letras[letra] = crear("text",{
            x:pos.x,y:pos.y,
            class:referencia.tipo === "interior" ? "letra-interior" : "letra-exterior",
            "text-anchor":"middle",
            "dominant-baseline":"middle"
        }, letra);
        svg.append(letras[letra]);
    }

    const movimientos = opciones.movimientos || DOMA.compilarSecuencia(proyecto.definiciones, pista);
    const grupoTrayectorias = crear("g", { "clip-path":`url(#${idRecorte})` });
    movimientos.forEach((movimiento, indice) => {
        let clase = "trayectoria";
        if (indice === opciones.indiceActual) clase += " actual";
        if (opciones.aprender && indice !== opciones.indiceActual) clase += " oculta";
        if (!pista.recorrido) clase += " sin-recorrido";
        const path = crear("path",{d:ruta(proyeccion,movimiento.puntos),class:clase,"data-indice":indice});
        path.addEventListener("click", evento => {
            if (opciones.colocandoElemento || opciones.elementosEditables) return;
            evento.stopPropagation();
            window.dispatchEvent(new CustomEvent("doma:seleccionar-trayectoria", { detail:{ indice } }));
        });
        grupoTrayectorias.append(path);
    });
    svg.append(grupoTrayectorias);

    (proyecto.elementosFijos || []).forEach(elemento => {
        renderizarElementoFijo(svg, proyecto, elemento, opciones, proyeccion);
    });

    if (opciones.colocandoElemento) {
        svg.classList.add("modo-colocacion-fijo");
        svg.addEventListener("click", evento => {
            if (evento.target.closest?.(".elemento-fijo")) return;
            const punto = svg.createSVGPoint();
            punto.x = evento.clientX;
            punto.y = evento.clientY;
            const matriz = svg.getScreenCTM();
            if (!matriz) return;
            const local = punto.matrixTransform(matriz.inverse());
            const modelo = proyeccion.desproyectar(local);
            const admiteExterior = ["sol", "jurado"].includes(opciones.tipoElementoColocando);
            const posicion = normalizarPuntoColocacion(pista, modelo, admiteExterior);
            if (!posicion) {
                window.dispatchEvent(new CustomEvent("doma:colocacion-fuera-pista", {
                    detail:{ admiteExterior }
                }));
                return;
            }
            window.dispatchEvent(new CustomEvent("doma:colocar-elemento-fijo", {
                detail:posicion
            }));
        });
    }

    const mostrarCaballo = opciones.mostrarCaballo !== false;
    const grupo = crear("g", { class:"grupo-caballo" });
    const forma = caballo();
    const haloJinete = crear("circle",{cx:0,cy:0,r:.48,class:"halo-jinete"});
    const emojiJinete = crear("text",{x:0,y:.22,class:"emoji-jinete","text-anchor":"middle"},"🧍");
    const avance = crear("line",{x1:0,y1:0,x2:3.15,y2:0,class:"flecha-avance","marker-end":`url(#${idFlechaAvance})`});
    const cuerpo = crear("line",{x1:0,y1:0,x2:2.55,y2:0,class:"flecha-cuerpo","marker-end":`url(#${idFlechaCuerpo})`});
    const destello = crear("g",{class:"grupo-destello"});
    const haloDestello = crear("circle",{cx:1.25,cy:-1.35,r:.85,class:"halo-destello"});
    const emojiDestello = crear("text",{x:1.25,y:-1.1,class:"emoji-destello","text-anchor":"middle"},"✨");
    destello.append(haloDestello, emojiDestello);
    grupo.append(forma.grupo, haloJinete, emojiJinete, avance, cuerpo, destello);
    if (mostrarCaballo) svg.append(grupo);
    contenedor.append(svg);

    return {
        mostrar(estado, visual) {
            if (!mostrarCaballo) return;
            const q = proyeccion.proyectar(estado.punto);
            const anguloAvance = proyeccion.anguloVisual(estado.anguloAvance);
            const anguloCuerpo = proyeccion.anguloVisual(estado.anguloCuerpo);
            grupo.setAttribute("transform",`translate(${q.x} ${q.y})`);
            forma.grupo.setAttribute("transform",`rotate(${anguloCuerpo + 90})`);
            avance.setAttribute("transform",`rotate(${anguloAvance})`);
            cuerpo.setAttribute("transform",`rotate(${anguloCuerpo})`);
            forma.coloreables.forEach(n => n.setAttribute("fill", visual?.caballoColor || "#8c5b37"));
            haloJinete.setAttribute("fill", visual?.jineteColor || "#f2c6a0");
            const jineteVisual = emojiVisual(visual?.jineteEmoji || "🧍", 2);
            emojiJinete.textContent = jineteVisual.visible || "🧍";
            emojiJinete.setAttribute("font-size", jineteVisual.cantidad > 1 ? ".48px" : ".7px");
            emojiJinete.setAttribute("aria-label", jineteVisual.original);
            const nivel = Number(visual?.destelloNivel || 0);
            destello.style.opacity = String(nivel);
            destello.setAttribute("transform",`scale(${.65 + nivel * .7})`);
            const destelloVisual = emojiVisual(visual?.destelloEmoji || "✨", 3);
            emojiDestello.textContent = destelloVisual.visible || "✨";
            emojiDestello.setAttribute("font-size", destelloVisual.cantidad > 1 ? ".72px" : "1.05px");
            emojiDestello.setAttribute("aria-label", destelloVisual.original);
        },
        destacar(inicio, fin) {
            Object.values(letras).forEach(n => n.classList.remove("letra-resaltada"));
            if (letras[inicio]) letras[inicio].classList.add("letra-resaltada");
            if (letras[fin]) letras[fin].classList.add("letra-resaltada");
        }
    };
}

window.PISTA = {
    render,
    proyectarPunto:(pista, punto, orientacion) => crearProyeccion(pista, orientacion).proyectar(punto),
    desproyectarPunto:(pista, punto, orientacion) => crearProyeccion(pista, orientacion).desproyectar(punto)
};
})();
