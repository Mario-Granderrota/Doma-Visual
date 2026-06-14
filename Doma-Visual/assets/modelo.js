/*
Doma Visual · Versión 0
Módulo: esquema, geometría, normalización, migraciones y validación.
Dependencias: estado, pista, editor y aplicación.

Convenciones:
- VERSION_PROYECTO versiona el JSON persistido, no los recursos PWA.
- x crece de izquierda a derecha; y=0 está en A y y=largo en C.
- xNorm e yNorm normalizan la posición de elementos fijos y admiten márgenes limitados.
- Toda entrada externa se normaliza antes de guardarse o dibujarse.
- Los números no finitos se sustituyen y los identificadores se hacen únicos.
- La validación informa de incompatibilidades sin borrar datos silenciosamente.
*/

(() => {
"use strict";

const VERSION_PROYECTO = 7;
const MAX_BYTES_IMPORTACION = 2 * 1024 * 1024;

/*
El limite de 2 MB evita archivos enormes, pero no basta por si solo: un JSON pequeno puede
contener decenas de miles de entradas vacias o una profundidad capaz de bloquear un movil.
Este presupuesto no recorta proyectos; rechaza antes de normalizar estructuras claramente
fuera del uso personal previsto. Los limites de la interfaz siguen siendo mas conservadores.
*/
const PRESUPUESTO_PROYECTO = Object.freeze({
    profundidad: 48,
    nodos: 50000,
    caracteresTexto: 1500000,
    movimientos: 300,
    efectosTotales: 6000,
    efectosPorMovimiento: 200,
    senalesPorPaleta: 200,
    elementosFijos: 300
});
const LIMITES_TEXTO = Object.freeze({
    id: 200,
    nombreProyecto: 200,
    tituloMovimiento: 300,
    comentario: 2000,
    ayuda: 2000,
    significado: 300,
    nombreElemento: 200,
    emoji: 128,
    musica: 300,
    destino: 50
});

const TIPOS = [
    { id: "linea", nombre: "Línea o diagonal", icono: "➤", destino: true },
    { id: "lateral", nombre: "Desplazamiento lateral", icono: "↗", destino: true },
    { id: "circulo", nombre: "Círculo", icono: "⭕", destino: false },
    { id: "parada", nombre: "Parada", icono: "⏸", destino: false },
    { id: "saludo", nombre: "Saludo", icono: "👋", destino: false },
    { id: "retroceso", nombre: "Paso atrás", icono: "↩", destino: true }
];

const ORIENTACIONES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };
const TIPOS_ELEMENTOS_FIJOS = [
    { id:"jurado", nombre:"Jurado", emoji:"👩‍⚖️🤠👨‍⚖️", xNorm:.5, yNorm:1.08, tamano:1, rotacion:0, bloqueado:true },
    { id:"sol", nombre:"Sol", emoji:"☀️", xNorm:1.18, yNorm:1.06, tamano:1.15, rotacion:0, bloqueado:false },
    { id:"maceta", nombre:"Maceta", emoji:"🪴", xNorm:.12, yNorm:.5, tamano:1, rotacion:0, bloqueado:false },
    { id:"palo", nombre:"Palo", emoji:"➖", xNorm:.5, yNorm:.5, tamano:1.15, rotacion:0, bloqueado:false },
    { id:"obstaculo", nombre:"Obstáculo", emoji:"🚧", xNorm:.5, yNorm:.5, tamano:1, rotacion:0, bloqueado:false },
    { id:"banderin", nombre:"Banderín", emoji:"🎏", xNorm:.88, yNorm:.5, tamano:1, rotacion:0, bloqueado:false },
    { id:"cono", nombre:"Cono", emoji:"🔺", xNorm:.5, yNorm:.5, tamano:.85, rotacion:0, bloqueado:false },
    { id:"personalizado", nombre:"Elemento personalizado", emoji:"📍", xNorm:.5, yNorm:.5, tamano:1, rotacion:0, bloqueado:false }
];

const POSICIONES_RAPIDAS_ELEMENTOS = {
    centro:{xNorm:.5,yNorm:.5},
    c_exterior:{xNorm:.5,yNorm:1.08},
    a_exterior:{xNorm:.5,yNorm:-.08},
    izquierda_alta:{xNorm:.08,yNorm:.75},
    izquierda_baja:{xNorm:.08,yNorm:.25},
    derecha_alta:{xNorm:.92,yNorm:.75},
    derecha_baja:{xNorm:.92,yNorm:.25},
    c_izquierda:{xNorm:-.18,yNorm:1.05},
    c_derecha:{xNorm:1.18,yNorm:1.05},
    a_izquierda:{xNorm:-.18,yNorm:-.05},
    a_derecha:{xNorm:1.18,yNorm:-.05}
};

const PLANTILLAS = {
    larga: {
        nombre: "larga",
        anchoBase: 20,
        largoBase: 60,
        referencias: {
            A:{x:10,y:0,tipo:"exterior",lado:"extremo"},
            K:{x:0,y:6,tipo:"exterior",lado:"izquierda"},
            V:{x:0,y:18,tipo:"exterior",lado:"izquierda"},
            E:{x:0,y:30,tipo:"exterior",lado:"izquierda"},
            S:{x:0,y:42,tipo:"exterior",lado:"izquierda"},
            H:{x:0,y:54,tipo:"exterior",lado:"izquierda"},
            C:{x:10,y:60,tipo:"exterior",lado:"extremo"},
            M:{x:20,y:54,tipo:"exterior",lado:"derecha"},
            R:{x:20,y:42,tipo:"exterior",lado:"derecha"},
            B:{x:20,y:30,tipo:"exterior",lado:"derecha"},
            P:{x:20,y:18,tipo:"exterior",lado:"derecha"},
            F:{x:20,y:6,tipo:"exterior",lado:"derecha"},
            D:{x:10,y:6,tipo:"interior",lado:"centro"},
            L:{x:10,y:18,tipo:"interior",lado:"centro"},
            X:{x:10,y:30,tipo:"interior",lado:"centro"},
            I:{x:10,y:42,tipo:"interior",lado:"centro"},
            G:{x:10,y:54,tipo:"interior",lado:"centro"}
        }
    },
    corta: {
        nombre: "corta",
        anchoBase: 20,
        largoBase: 40,
        referencias: {
            A:{x:10,y:0,tipo:"exterior",lado:"extremo"},
            K:{x:0,y:6,tipo:"exterior",lado:"izquierda"},
            E:{x:0,y:20,tipo:"exterior",lado:"izquierda"},
            H:{x:0,y:34,tipo:"exterior",lado:"izquierda"},
            C:{x:10,y:40,tipo:"exterior",lado:"extremo"},
            M:{x:20,y:34,tipo:"exterior",lado:"derecha"},
            B:{x:20,y:20,tipo:"exterior",lado:"derecha"},
            F:{x:20,y:6,tipo:"exterior",lado:"derecha"},
            D:{x:10,y:6,tipo:"interior",lado:"centro"},
            X:{x:10,y:20,tipo:"interior",lado:"centro"},
            G:{x:10,y:34,tipo:"interior",lado:"centro"}
        }
    },
    centro: {
        nombre: "centro",
        anchoBase: 20,
        largoBase: 60,
        referencias: {
            A:{x:10,y:0,tipo:"exterior",lado:"extremo"},
            X:{x:10,y:30,tipo:"interior",lado:"centro"},
            C:{x:10,y:60,tipo:"exterior",lado:"extremo"}
        }
    }
};

const esObjetoDatos = valor => Boolean(valor && typeof valor === "object" && !Array.isArray(valor));
const objetoDatos = valor => esObjetoDatos(valor) ? valor : {};
const copiar = valor => JSON.parse(JSON.stringify(valor));
const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));
const numeroFinito = (valor, defecto = 0) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : defecto;
};
const numeroLimitado = (valor, minimo, maximo, defecto) =>
    limitar(numeroFinito(valor, defecto), minimo, maximo);
const textoSeguro = (valor, defecto = "") =>
    ["string", "number", "boolean"].includes(typeof valor) ? String(valor) : defecto;
const textoLimitado = (valor, defecto = "", maximo = 1000) => {
    const texto = textoSeguro(valor, defecto);
    if (texto.length <= maximo) return texto;
    // Array.from evita cortar una pareja sustituta UTF-16. Para textos patologicamente
    // largos prima conservar una cadena valida sobre mantener una secuencia decorativa.
    return Array.from(texto).slice(0, maximo).join("");
};
const colorSeguro = (valor, defecto = "#888888") =>
    /^#[0-9a-f]{6}$/i.test(textoSeguro(valor)) ? String(valor) : defecto;
const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const interpolar = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const crearId = () => globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

function esEntradaProyectoReconocible(valor) {
    if (!esObjetoDatos(valor)) return false;
    return ["version", "nombre", "pista", "ambiente", "elementosFijos", "musica", "senales", "definiciones"]
        .some(clave => Object.prototype.hasOwnProperty.call(valor, clave));
}

function errorPresupuesto(detalle) {
    return new Error(`El proyecto es demasiado complejo para abrirse con seguridad (${detalle}).`);
}

/*
Recorre de forma iterativa tanto los campos conocidos como los desconocidos conservados por
compatibilidad. El WeakSet evita ciclos si una integracion externa entrega un objeto que no
procede de JSON. Esta comprobacion se ejecuta antes de copiar, normalizar o compilar.
*/
function comprobarPresupuestoProyecto(entradaOriginal) {
    if (!esObjetoDatos(entradaOriginal)) throw new Error("El proyecto no contiene un objeto valido.");

    const definiciones = Array.isArray(entradaOriginal.definiciones) ? entradaOriginal.definiciones : [];
    if (definiciones.length > PRESUPUESTO_PROYECTO.movimientos) {
        throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.movimientos} movimientos`);
    }
    let efectosTotales = 0;
    for (const definicion of definiciones) {
        const efectos = Array.isArray(definicion?.efectos) ? definicion.efectos : [];
        if (efectos.length > PRESUPUESTO_PROYECTO.efectosPorMovimiento) {
            throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.efectosPorMovimiento} efectos en un movimiento`);
        }
        efectosTotales += efectos.length;
        if (efectosTotales > PRESUPUESTO_PROYECTO.efectosTotales) {
            throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.efectosTotales} efectos en total`);
        }
    }
    const senales = objetoDatos(entradaOriginal.senales);
    for (const tipo of ["caballo", "jinete"]) {
        const lista = Array.isArray(senales[tipo]) ? senales[tipo] : [];
        if (lista.length > PRESUPUESTO_PROYECTO.senalesPorPaleta) {
            throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.senalesPorPaleta} senales de ${tipo}`);
        }
    }
    const elementos = Array.isArray(entradaOriginal.elementosFijos) ? entradaOriginal.elementosFijos : [];
    if (elementos.length > PRESUPUESTO_PROYECTO.elementosFijos) {
        throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.elementosFijos} elementos fijos`);
    }

    const pila = [{ valor:entradaOriginal, profundidad:0 }];
    const visitados = new WeakSet();
    let nodos = 0;
    let caracteresTexto = 0;
    while (pila.length) {
        const { valor, profundidad } = pila.pop();
        if (profundidad > PRESUPUESTO_PROYECTO.profundidad) {
            throw errorPresupuesto(`profundidad superior a ${PRESUPUESTO_PROYECTO.profundidad}`);
        }
        nodos++;
        if (nodos > PRESUPUESTO_PROYECTO.nodos) {
            throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.nodos} valores estructurales`);
        }
        if (typeof valor === "string") {
            caracteresTexto += valor.length;
            if (caracteresTexto > PRESUPUESTO_PROYECTO.caracteresTexto) {
                throw errorPresupuesto(`mas de ${PRESUPUESTO_PROYECTO.caracteresTexto} caracteres de texto`);
            }
            continue;
        }
        if (!valor || typeof valor !== "object") continue;
        if (visitados.has(valor)) throw new Error("El proyecto contiene una referencia circular no valida.");
        visitados.add(valor);
        const hijos = Array.isArray(valor) ? valor : Object.values(valor);
        for (const hijo of hijos) pila.push({ valor:hijo, profundidad:profundidad + 1 });
    }
    return true;
}

function asegurarIdsUnicos(lista, prefijo) {
    const usados = new Set();
    return (Array.isArray(lista) ? lista : []).map(entradaOriginal => {
        const entrada = objetoDatos(entradaOriginal);
        let id = textoLimitado(entrada.id, "", LIMITES_TEXTO.id);
        if (!id || usados.has(id)) id = `${prefijo}_${crearId()}`;
        usados.add(id);
        return { ...entrada, id };
    });
}

function paletasBase() {
    return {
        caballo: [
            { id:"caballo_normal", color:"#8c5b37", significado:"Normal / sin indicación", emoji:"🐎" },
            { id:"caballo_ritmo1", color:"#2f9b67", significado:"Ritmo de patas 1", emoji:"🟢" },
            { id:"caballo_ritmo2", color:"#3478d4", significado:"Ritmo de patas 2", emoji:"🔵" },
            { id:"caballo_cambio", color:"#f29b2f", significado:"Cambio de ritmo", emoji:"⚡" },
            { id:"caballo_cruce", color:"#8b5bc0", significado:"Cruce de patas", emoji:"✖️" }
        ],
        jinete: [
            { id:"jinete_neutro", color:"#f2c6a0", significado:"Posición neutra", emoji:"🧍" },
            { id:"jinete_manos", color:"#3b82d0", significado:"Recordatorio de manos", emoji:"🙌" },
            { id:"jinete_pierna", color:"#31a86b", significado:"Recordatorio de piernas", emoji:"🦵" },
            { id:"jinete_tronco", color:"#dd5b9a", significado:"Postura", emoji:"↪️" },
            { id:"jinete_mirada", color:"#f0a72f", significado:"Mirada al destino", emoji:"👀" }
        ]
    };
}



function tipoElementoFijo(tipo) {
    return TIPOS_ELEMENTOS_FIJOS.find(entrada => entrada.id === tipo)
        || TIPOS_ELEMENTOS_FIJOS.find(entrada => entrada.id === "personalizado");
}

function crearElementoFijo(tipo, extra = {}) {
    const base = tipoElementoFijo(tipo);
    return normalizarElementoFijo({
        id: crearId(),
        tipo: base.id,
        nombre: base.nombre,
        emoji: base.emoji,
        xNorm: base.xNorm,
        yNorm: base.yNorm,
        tamano: base.tamano,
        rotacion: base.rotacion,
        visible: true,
        bloqueado: base.bloqueado,
        ...objetoDatos(extra)
    });
}

function normalizarElementoFijo(entradaOriginal = {}) {
    const entrada = objetoDatos(entradaOriginal);
    const base = tipoElementoFijo(entrada.tipo);
    return {
        ...entrada,
        id: textoLimitado(entrada.id, "", LIMITES_TEXTO.id) || crearId(),
        tipo: base.id,
        nombre: textoLimitado(entrada.nombre, base.nombre, LIMITES_TEXTO.nombreElemento) || base.nombre,
        emoji: textoLimitado(entrada.emoji, base.emoji, LIMITES_TEXTO.emoji),
        xNorm: numeroLimitado(entrada.xNorm, -.30, 1.30, base.xNorm),
        yNorm: numeroLimitado(entrada.yNorm, -.12, 1.12, base.yNorm),
        tamano: numeroLimitado(entrada.tamano, .5, 2.5, base.tamano),
        rotacion: numeroLimitado(entrada.rotacion, -180, 180, base.rotacion),
        visible: entrada.visible !== false,
        bloqueado: entrada.bloqueado === true
    };
}



/*
Elimina únicamente duplicados funcionalmente exactos. Dos obstáculos del mismo tipo son
legítimos si difieren en posición, tamaño, giro o texto. Si dos elementos distintos llegan
con el mismo id, ambos se conservan y el segundo recibe un identificador nuevo.

La huella excluye deliberadamente el id: una copia exacta con otro identificador sigue
siendo un duplicado redundante, mientras que una colisión de id entre datos diferentes no
debe provocar pérdida silenciosa de información.
*/
function deduplicarElementosFijos(listaEntrada = []) {
    const ids = new Set();
    const huellas = new Set();
    const resultado = [];

    for (const entradaNormalizada of (Array.isArray(listaEntrada) ? listaEntrada : [])
        .filter(esObjetoDatos)
        .map(normalizarElementoFijo)) {
        const huella = JSON.stringify([
            entradaNormalizada.tipo, entradaNormalizada.nombre, entradaNormalizada.emoji,
            Number(entradaNormalizada.xNorm).toFixed(5), Number(entradaNormalizada.yNorm).toFixed(5),
            Number(entradaNormalizada.tamano).toFixed(4), Number(entradaNormalizada.rotacion).toFixed(2),
            entradaNormalizada.visible, entradaNormalizada.bloqueado
        ]);
        if (huellas.has(huella)) continue;

        const entrada = { ...entradaNormalizada };
        while (!entrada.id || ids.has(entrada.id)) {
            entrada.id = `fijo_${crearId()}`;
        }

        ids.add(entrada.id);
        huellas.add(huella);
        resultado.push(entrada);
    }
    return resultado;
}

function posicionLegadaSol(posicion) {
    const mapa = {
        c_izquierda:{xNorm:-.18,yNorm:1.05},
        c_derecha:{xNorm:1.18,yNorm:1.05},
        lateral_izquierda_alta:{xNorm:-.18,yNorm:.76},
        lateral_derecha_alta:{xNorm:1.18,yNorm:.76},
        lateral_izquierda_baja:{xNorm:-.18,yNorm:.24},
        lateral_derecha_baja:{xNorm:1.18,yNorm:.24},
        a_izquierda:{xNorm:-.18,yNorm:-.05},
        a_derecha:{xNorm:1.18,yNorm:-.05}
    };
    return mapa[posicion] || mapa.c_derecha;
}

function migrarElementosFijos(entradaOriginal = {}) {
    const entrada = objetoDatos(entradaOriginal);
    if (Array.isArray(entrada.elementosFijos)) {
        return deduplicarElementosFijos(entrada.elementosFijos);
    }
    const elementos = [];
    if (objetoDatos(entrada.pista).jurado !== false) {
        elementos.push(crearElementoFijo("jurado", { id:"fijo_jurado_principal" }));
    }
    if (objetoDatos(entrada.ambiente).solPosicion !== "oculto") {
        elementos.push(crearElementoFijo("sol", {
            id:"fijo_sol_principal",
            ...posicionLegadaSol(objetoDatos(entrada.ambiente).solPosicion),
            bloqueado:true
        }));
    }
    return deduplicarElementosFijos(elementos);
}

function posicionRapidaElemento(clave) {
    return copiar(POSICIONES_RAPIDAS_ELEMENTOS[clave] || POSICIONES_RAPIDAS_ELEMENTOS.centro);
}

function normalizarPista(pistaOriginal = {}) {
    const pista = objetoDatos(pistaOriginal);
    // `pista.jurado` se conserva temporalmente dentro de la normalización para importar
    // proyectos antiguos. El render vigente obtiene jurado y sol de elementosFijos.
    const preset = ["oficial_60", "oficial_40", "personalizada"].includes(pista.preset)
        ? pista.preset
        : (Number(pista.largo) === 40 ? "oficial_40" : Number(pista.largo) === 60 && Number(pista.ancho) === 20 ? "oficial_60" : "personalizada");

    if (preset === "oficial_60") {
        return {
            ...pista,
            preset,
            ancho: 20,
            largo: 60,
            plantilla: "larga",
            oficial: true,
            letras: pista.letras !== false,
            interiores: pista.interiores !== false,
            cuadricula: pista.cuadricula !== false,
            jurado: pista.jurado !== false,
            recorrido: pista.recorrido !== false
        };
    }
    if (preset === "oficial_40") {
        return {
            ...pista,
            preset,
            ancho: 20,
            largo: 40,
            plantilla: "corta",
            oficial: true,
            letras: pista.letras !== false,
            interiores: pista.interiores !== false,
            cuadricula: pista.cuadricula !== false,
            jurado: pista.jurado !== false,
            recorrido: pista.recorrido !== false
        };
    }

    return {
        ...pista,
        preset: "personalizada",
        ancho: numeroLimitado(pista.ancho, 8, 60, 20),
        largo: numeroLimitado(pista.largo, 15, 120, 60),
        plantilla: ["larga", "corta", "centro"].includes(pista.plantilla) ? pista.plantilla : "larga",
        oficial: false,
        letras: pista.letras !== false,
        interiores: pista.interiores !== false,
        cuadricula: pista.cuadricula !== false,
        jurado: pista.jurado !== false,
        recorrido: pista.recorrido !== false
    };
}

function obtenerReferencias(pistaEntrada) {
    const pista = normalizarPista(pistaEntrada);
    const plantilla = PLANTILLAS[pista.plantilla] || PLANTILLAS.larga;
    const escalaX = pista.ancho / plantilla.anchoBase;
    const escalaY = pista.largo / plantilla.largoBase;
    const referencias = {};
    for (const [letra, referencia] of Object.entries(plantilla.referencias)) {
        referencias[letra] = {
            ...referencia,
            x: referencia.x * escalaX,
            y: referencia.y * escalaY
        };
    }
    return referencias;
}

function referenciasDisponibles(pista) {
    return Object.keys(obtenerReferencias(pista));
}

function puntosLinea(inicio, fin, pasos = 64) {
    return Array.from({ length: pasos + 1 }, (_, i) => interpolar(inicio, fin, i / pasos));
}

function direccionFinal(puntos, anterior = { x: 0, y: 1 }) {
    for (let i = puntos.length - 1; i > 0; i--) {
        const dx = puntos[i].x - puntos[i - 1].x;
        const dy = puntos[i].y - puntos[i - 1].y;
        const norma = Math.hypot(dx, dy);
        if (norma > 0.0001) return { x: dx / norma, y: dy / norma };
    }
    return copiar(anterior);
}

function puntosCirculo(inicio, direccion, radio = 10, mano = "derecha") {
    const normal = mano === "derecha"
        ? { x: direccion.y, y: -direccion.x }
        : { x: -direccion.y, y: direccion.x };
    const centro = { x: inicio.x + normal.x * radio, y: inicio.y + normal.y * radio };
    const anguloInicial = Math.atan2(inicio.y - centro.y, inicio.x - centro.x);
    const signo = mano === "derecha" ? -1 : 1;
    return Array.from({ length: 145 }, (_, i) => {
        const angulo = anguloInicial + signo * Math.PI * 2 * i / 144;
        return { x: centro.x + Math.cos(angulo) * radio, y: centro.y + Math.sin(angulo) * radio };
    });
}

function compilarMovimiento(definicion, inicio, direccion, pista) {
    const referencias = obtenerReferencias(pista);
    const destinoValido = definicion.destino && referencias[definicion.destino];
    const destino = destinoValido ? copiar(referencias[definicion.destino]) : copiar(inicio);
    let puntos;

    if (["linea", "lateral", "retroceso"].includes(definicion.tipo)) {
        puntos = puntosLinea(inicio, destino);
    } else if (definicion.tipo === "circulo") {
        puntos = puntosCirculo(inicio, direccion, Number(definicion.radio || 10), definicion.mano || "derecha");
    } else {
        puntos = [copiar(inicio), copiar(inicio)];
    }

    return {
        ...copiar(definicion),
        puntos,
        inicio: copiar(puntos[0]),
        fin: copiar(puntos[puntos.length - 1]),
        direccionFinal: direccionFinal(puntos, direccion),
        orientacionRelativa: definicion.tipo === "retroceso" ? 180 : Number(definicion.orientacionRelativa || 0),
        advertenciaDestino: definicion.destino && !destinoValido
            ? `La referencia ${definicion.destino} no existe en esta pista.`
            : ""
    };
}

function compilarSecuencia(definiciones, pista = { preset: "oficial_60" }) {
    const lista = Array.isArray(definiciones) ? definiciones : [];
    const referencias = obtenerReferencias(pista);
    let inicio = copiar(referencias.A || { x: normalizarPista(pista).ancho / 2, y: 0 });
    let direccion = { x: 0, y: 1 };
    const movimientos = [];

    for (const definicion of lista) {
        const movimiento = compilarMovimiento(definicion, inicio, direccion, pista);
        movimientos.push(movimiento);
        inicio = copiar(movimiento.fin);
        direccion = copiar(movimiento.direccionFinal);
    }
    return movimientos;
}

function definicion(tipo, titulo, destino, duracion, extra = {}) {
    return {
        id: crearId(),
        tipo,
        titulo,
        destino,
        duracion,
        orientacionRelativa: 0,
        comentario: "",
        ayuda: "",
        radio: 10,
        mano: "derecha",
        senalCaballoId: "caballo_normal",
        senalJineteId: "jinete_neutro",
        efectos: [],
        ...extra
    };
}

function ejemplo() {
    return normalizarProyecto({
        version: VERSION_PROYECTO,
        nombre: "Entrenamiento divertido",
        pista: { preset:"oficial_60", ancho:20, largo:60, plantilla:"larga" },
        ambiente: { orientacion:"N" },
        elementosFijos: [
            crearElementoFijo("jurado", { id:"fijo_jurado_principal" }),
            crearElementoFijo("sol", { id:"fijo_sol_principal" })
        ],
        musica: { titulo:"", inicio:0, sincronizar:true, nombreArchivo:"" },
        senales: paletasBase(),
        definiciones: [
            definicion("linea","Entra por A hasta X","X",12,{comentario:"Mira al frente y conserva una línea recta.",ayuda:"A, X y C: una sola línea.",senalJineteId:"jinete_mirada"}),
            definicion("parada","Para en X","",4,{comentario:"Haz una parada tranquila y clara.",ayuda:"Detente en X y busca una parada clara."}),
            definicion("saludo","Saluda","",3,{comentario:"Mantén el caballo quieto durante el saludo.",ayuda:"Primero quietud; después, saludo.",senalJineteId:"jinete_manos"}),
            definicion("linea","Sigue recta hasta C","C",11,{comentario:"Sal con suavidad y conserva la línea central.",ayuda:"Sigue por la línea central hasta C.",senalCaballoId:"caballo_ritmo1"}),
            definicion("linea","Gira hacia M","M",6,{comentario:"Prepara el giro antes de llegar a C.",ayuda:"Prepara el giro antes de C y hazlo suave."}),
            definicion("linea","Diagonal de M a K","K",17,{comentario:"Mira K desde el comienzo.",ayuda:"Destino K; la diagonal pasa por X.",senalCaballoId:"caballo_ritmo2",senalJineteId:"jinete_mirada"}),
            definicion("linea","Sube hasta E","E",8,{comentario:"Mantén el ritmo al llegar al lado largo.",ayuda:"Busca E a mitad del lado largo."}),
            definicion("circulo","Círculo de 20 m en E","",18,{radio:10,mano:"derecha",comentario:"Haz un círculo redondo y vuelve a E.",ayuda:"Cuatro cuartos iguales forman el círculo.",senalCaballoId:"caballo_ritmo1",senalJineteId:"jinete_tronco"}),
            definicion("lateral","Desplázate de E a X","X",10,{orientacionRelativa:-22,comentario:"Avanza hacia X sin mirar exactamente al destino.",ayuda:"Azul: avance. Morado: orientación del cuerpo.",senalCaballoId:"caballo_cruce",senalJineteId:"jinete_pierna"})
        ]
    });
}

function normalizarEntrada(entradaOriginal, defectoOriginal) {
    const entrada = objetoDatos(entradaOriginal);
    const defecto = objetoDatos(defectoOriginal);
    return {
        ...entrada,
        id: textoSeguro(entrada.id) || textoSeguro(defecto.id) || crearId(),
        color: colorSeguro(entrada.color, defecto.color || "#888888"),
        significado: textoSeguro(entrada.significado, defecto.significado || "Sin significado") || "Sin significado",
        emoji: textoLimitado(entrada.emoji, defecto.emoji || "", LIMITES_TEXTO.emoji)
    };
}

function normalizarDefinicion(definicionOriginal = {}) {
    const definicionEntrada = objetoDatos(definicionOriginal);
    const d = {
        ...definicionEntrada,
        id: textoLimitado(definicionEntrada.id, "", LIMITES_TEXTO.id) || crearId(),
        tipo: TIPOS.some(t => t.id === definicionEntrada.tipo) ? definicionEntrada.tipo : "linea",
        titulo: textoLimitado(definicionEntrada.titulo, "Movimiento", LIMITES_TEXTO.tituloMovimiento) || "Movimiento",
        destino: textoLimitado(definicionEntrada.destino, "", LIMITES_TEXTO.destino),
        duracion: numeroLimitado(definicionEntrada.duracion, 0.1, 3600, 10),
        orientacionRelativa: numeroLimitado(definicionEntrada.orientacionRelativa, -360, 360, 0),
        radio: numeroLimitado(definicionEntrada.radio, 0.5, 100, 10),
        mano: definicionEntrada.mano === "izquierda" ? "izquierda" : "derecha",
        comentario: textoLimitado(definicionEntrada.comentario, "", LIMITES_TEXTO.comentario),
        ayuda: textoLimitado(definicionEntrada.ayuda, "", LIMITES_TEXTO.ayuda),
        senalCaballoId: textoLimitado(definicionEntrada.senalCaballoId, "caballo_normal", LIMITES_TEXTO.id) || "caballo_normal",
        senalJineteId: textoLimitado(definicionEntrada.senalJineteId, "jinete_neutro", LIMITES_TEXTO.id) || "jinete_neutro"
    };
    d.efectos = Array.isArray(definicionEntrada.efectos)
        ? asegurarIdsUnicos(definicionEntrada.efectos.filter(esObjetoDatos).map(efecto => ({
            ...efecto,
            id: textoLimitado(efecto.id, "", LIMITES_TEXTO.id) || crearId(),
            momento: numeroLimitado(efecto.momento, 0, d.duracion, 0),
            duracion: numeroLimitado(efecto.duracion, 0.1, 10, 0.8),
            emoji: textoLimitado(efecto.emoji, "✨", LIMITES_TEXTO.emoji) || "✨",
            caballoId: textoLimitado(efecto.caballoId, d.senalCaballoId, LIMITES_TEXTO.id) || d.senalCaballoId,
            jineteId: textoLimitado(efecto.jineteId, d.senalJineteId, LIMITES_TEXTO.id) || d.senalJineteId
        })), "efecto")
        : [];
    return d;
}

function normalizarProyecto(entradaOriginal = {}) {
    const entrada = objetoDatos(entradaOriginal);
    const basePaletas = paletasBase();
    const senalesEntrada = objetoDatos(entrada.senales);
    const caballoEntrada = Array.isArray(senalesEntrada.caballo)
        ? senalesEntrada.caballo.filter(esObjetoDatos)
        : [];
    const jineteEntrada = Array.isArray(senalesEntrada.jinete)
        ? senalesEntrada.jinete.filter(esObjetoDatos)
        : [];
    const definicionesEntrada = Array.isArray(entrada.definiciones)
        ? entrada.definiciones.filter(esObjetoDatos)
        : [];

    const caballo = asegurarIdsUnicos(
        caballoEntrada.length
            ? caballoEntrada.map((e, i) => normalizarEntrada(e, basePaletas.caballo[i] || basePaletas.caballo[0]))
            : basePaletas.caballo,
        "senal_caballo"
    );
    const jinete = asegurarIdsUnicos(
        jineteEntrada.length
            ? jineteEntrada.map((e, i) => normalizarEntrada(e, basePaletas.jinete[i] || basePaletas.jinete[0]))
            : basePaletas.jinete,
        "senal_jinete"
    );
    const definiciones = asegurarIdsUnicos(
        definicionesEntrada.length
            ? definicionesEntrada.map(normalizarDefinicion)
            : [definicion("linea", "Entrada de A a X", "X", 10)],
        "movimiento"
    );

    const idsCaballo = new Set(caballo.map(senal => senal.id));
    const idsJinete = new Set(jinete.map(senal => senal.id));
    const caballoDefecto = caballo[0].id;
    const jineteDefecto = jinete[0].id;
    definiciones.forEach(d => {
        if (!idsCaballo.has(d.senalCaballoId)) d.senalCaballoId = caballoDefecto;
        if (!idsJinete.has(d.senalJineteId)) d.senalJineteId = jineteDefecto;
        d.efectos.forEach(efecto => {
            if (!idsCaballo.has(efecto.caballoId)) efecto.caballoId = d.senalCaballoId;
            if (!idsJinete.has(efecto.jineteId)) efecto.jineteId = d.senalJineteId;
        });
    });

    const ambienteEntrada = objetoDatos(entrada.ambiente);
    const musicaEntrada = objetoDatos(entrada.musica);
    return {
        ...entrada,
        version: VERSION_PROYECTO,
        nombre: textoLimitado(entrada.nombre, "Proyecto sin nombre", LIMITES_TEXTO.nombreProyecto) || "Proyecto sin nombre",
        pista: normalizarPista(entrada.pista),
        ambiente: {
            ...ambienteEntrada,
            orientacion: ORIENTACIONES[ambienteEntrada.orientacion] !== undefined
                ? ambienteEntrada.orientacion
                : "N"
        },
        elementosFijos: migrarElementosFijos(entrada),
        musica: {
            ...musicaEntrada,
            titulo: textoLimitado(musicaEntrada.titulo, "", LIMITES_TEXTO.musica),
            inicio: numeroLimitado(musicaEntrada.inicio, 0, 86400, 0),
            sincronizar: musicaEntrada.sincronizar !== false,
            nombreArchivo: textoLimitado(musicaEntrada.nombreArchivo, "", LIMITES_TEXTO.musica)
        },
        senales: { ...senalesEntrada, caballo, jinete },
        definiciones
    };
}

function validarProyecto(proyectoEntrada) {
    const proyecto = normalizarProyecto(proyectoEntrada);
    const problemas = [];
    const referencias = obtenerReferencias(proyecto.pista);
    const movimientos = compilarSecuencia(proyecto.definiciones, proyecto.pista);

    if (proyecto.pista.preset === "personalizada") {
        problemas.push({
            nivel: "aviso",
            codigo: "pista_personalizada",
            mensaje: "La pista personalizada usa referencias proporcionales de entrenamiento, no una disposición oficial."
        });
    }
    if (proyecto.pista.ancho >= proyecto.pista.largo) {
        problemas.push({
            nivel: "aviso",
            codigo: "proporcion_inusual",
            mensaje: "La pista es igual de ancha o más ancha que larga; comprueba las dimensiones."
        });
    }

    proyecto.definiciones.forEach((definicion, indice) => {
        const tipo = TIPOS.find(t => t.id === definicion.tipo);
        if (tipo?.destino && !referencias[definicion.destino]) {
            problemas.push({
                nivel: "error",
                codigo: "destino_inexistente",
                indice,
                mensaje: `El movimiento ${indice + 1} apunta a ${definicion.destino}, que no existe en esta plantilla.`
            });
        }
        if (definicion.tipo === "circulo" && definicion.radio * 2 > Math.min(proyecto.pista.ancho, proyecto.pista.largo)) {
            problemas.push({
                nivel: "aviso",
                codigo: "circulo_grande",
                indice,
                mensaje: `El círculo del movimiento ${indice + 1} puede no caber en la pista.`
            });
        }
        for (const efecto of definicion.efectos || []) {
            if (efecto.momento > definicion.duracion) {
                problemas.push({
                    nivel: "aviso",
                    codigo: "efecto_fuera",
                    indice,
                    mensaje: `Un efecto del movimiento ${indice + 1} comienza después de terminar el movimiento.`
                });
            }
        }
    });

    movimientos.forEach((movimiento, indice) => {
        const fuera = movimiento.puntos.some(p =>
            p.x < -0.001 || p.x > proyecto.pista.ancho + 0.001 ||
            p.y < -0.001 || p.y > proyecto.pista.largo + 0.001
        );
        if (fuera) {
            problemas.push({
                nivel: "aviso",
                codigo: "trayectoria_fuera",
                indice,
                mensaje: `Parte de la trayectoria del movimiento ${indice + 1} sale de la pista.`
            });
        }
    });


    const idsElementos = new Set();
    proyecto.elementosFijos.forEach((elemento, indice) => {
        if (idsElementos.has(elemento.id)) {
            problemas.push({
                nivel:"error",
                codigo:"elemento_fijo_duplicado",
                indiceElemento:indice,
                mensaje:`El elemento fijo ${indice + 1} tiene un identificador duplicado.`
            });
        }
        idsElementos.add(elemento.id);

        const fuera = elemento.xNorm < 0 || elemento.xNorm > 1 || elemento.yNorm < 0 || elemento.yNorm > 1;
        if (fuera && !["sol", "jurado"].includes(elemento.tipo)) {
            problemas.push({
                nivel:"aviso",
                codigo:"elemento_fijo_fuera",
                indiceElemento:indice,
                mensaje:`${elemento.nombre} está fuera del rectángulo útil de la pista.`
            });
        }
    });
    if (proyecto.elementosFijos.filter(elemento => elemento.visible).length > 24) {
        problemas.push({
            nivel:"aviso",
            codigo:"demasiados_elementos_fijos",
            mensaje:"Hay más de 24 elementos fijos visibles; la pista puede resultar difícil de leer."
        });
    }

    return problemas;
}

function total(proyecto) {
    const definiciones = Array.isArray(proyecto?.definiciones) ? proyecto.definiciones : [];
    return definiciones.reduce((suma, definicion) => suma + numeroFinito(definicion?.duracion, 0), 0);
}

function intervalo(proyecto, indice) {
    const definiciones = Array.isArray(proyecto?.definiciones) ? proyecto.definiciones : [];
    const posicion = limitar(Math.trunc(numeroFinito(indice, 0)), 0, Math.max(0, definiciones.length - 1));
    let inicio = 0;
    for (let i = 0; i < posicion; i++) inicio += numeroFinito(definiciones[i]?.duracion, 0);
    return { inicio, fin: inicio + numeroFinito(definiciones[posicion]?.duracion, 0) };
}

function localizar(proyecto, tiempo) {
    const definiciones = Array.isArray(proyecto?.definiciones) ? proyecto.definiciones : [];
    if (!definiciones.length) return { indice:0, progreso:0, segundoLocal:0 };
    const instante = Math.max(0, numeroFinito(tiempo, 0));
    let acumulado = 0;
    for (let i = 0; i < definiciones.length; i++) {
        const duracion = Math.max(0, numeroFinito(definiciones[i]?.duracion, 0));
        // En una frontera exacta, el tiempo pertenece al movimiento siguiente.
        // Esto evita que al seleccionar el movimiento 6 se muestre todavía el 5.
        if (instante < acumulado + duracion || i === definiciones.length - 1) {
            return {
                indice: i,
                progreso: duracion ? limitar((instante - acumulado) / duracion, 0, 1) : 0,
                segundoLocal: Math.max(0, instante - acumulado)
            };
        }
        acumulado += duracion;
    }
    return { indice: 0, progreso: 0, segundoLocal: 0 };
}

function estado(movimiento, progreso) {
    const puntos = movimiento.puntos;
    let longitud = 0;
    const acumulada = [0];
    for (let i = 1; i < puntos.length; i++) {
        longitud += distancia(puntos[i - 1], puntos[i]);
        acumulada.push(longitud);
    }
    if (longitud < 0.0001) {
        const angulo = Math.atan2(movimiento.direccionFinal.y, movimiento.direccionFinal.x) * 180 / Math.PI;
        return {
            punto: copiar(puntos[0]),
            anguloAvance: angulo,
            anguloCuerpo: angulo + Number(movimiento.orientacionRelativa || 0)
        };
    }
    const objetivo = limitar(progreso, 0, 1) * longitud;
    let indice = 1;
    while (indice < acumulada.length && acumulada[indice] < objetivo) indice++;
    indice = Math.min(indice, acumulada.length - 1);
    const a = puntos[indice - 1];
    const b = puntos[indice];
    const tramo = acumulada[indice] - acumulada[indice - 1] || 1;
    const t = (objetivo - acumulada[indice - 1]) / tramo;
    const angulo = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    return {
        punto: interpolar(a, b, t),
        anguloAvance: angulo,
        anguloCuerpo: angulo + Number(movimiento.orientacionRelativa || 0)
    };
}

function senalPorId(proyecto, tipo, id) {
    const lista = proyecto.senales?.[tipo] || [];
    return lista.find(s => s.id === id) || lista[0] || {
        id: "", color: "#888888", significado: "Sin señal", emoji: ""
    };
}

function estadoVisual(proyecto, movimiento, progreso) {
    const segundo = limitar(progreso, 0, 1) * Number(movimiento.duracion || 0);
    let caballoId = movimiento.senalCaballoId || "caballo_normal";
    let jineteId = movimiento.senalJineteId || "jinete_neutro";
    let destelloEmoji = "";
    let destelloNivel = 0;

    const activos = (movimiento.efectos || [])
        .filter(e => segundo >= Number(e.momento || 0) && segundo <= Number(e.momento || 0) + Number(e.duracion || 0))
        .sort((a, b) => Number(a.momento) - Number(b.momento));
    const efecto = activos[activos.length - 1];

    if (efecto) {
        caballoId = efecto.caballoId || caballoId;
        jineteId = efecto.jineteId || jineteId;
        destelloEmoji = efecto.emoji || "✨";
        const duracion = Math.max(0.1, Number(efecto.duracion || 0.8));
        const fase = (segundo - Number(efecto.momento || 0)) / duracion;
        destelloNivel = Math.sin(limitar(fase, 0, 1) * Math.PI);
    }

    const caballo = senalPorId(proyecto, "caballo", caballoId);
    const jinete = senalPorId(proyecto, "jinete", jineteId);
    return {
        caballoColor: caballo.color,
        caballoSignificado: caballo.significado,
        caballoEmoji: caballo.emoji,
        jineteColor: jinete.color,
        jineteSignificado: jinete.significado,
        jineteEmoji: jinete.emoji || "🧍",
        destelloEmoji,
        destelloNivel
    };
}

function nombrePunto(punto, pista = { preset: "oficial_60" }) {
    let nombre = "";
    let mejor = Infinity;
    for (const [letra, referencia] of Object.entries(obtenerReferencias(pista))) {
        const d = distancia(punto, referencia);
        if (d < mejor) {
            mejor = d;
            nombre = letra;
        }
    }
    return mejor < Math.max(0.3, normalizarPista(pista).ancho * 0.015)
        ? nombre
        : `${punto.x.toFixed(1)}, ${punto.y.toFixed(1)}`;
}

function formato(segundos) {
    const s = Math.max(0, Math.round(segundos));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function siguienteDestino(inicio, pista) {
    const disponibles = referenciasDisponibles(pista);
    const actual = nombrePunto(inicio, pista);
    const preferidos = ["X", "C", "M", "K", "E", "B", "H", "A"];
    return preferidos.find(letra => letra !== actual && disponibles.includes(letra))
        || disponibles.find(letra => letra !== actual)
        || actual;
}

function nuevaDefinicion(tipo, inicio, pista) {
    const tipoDef = TIPOS.find(t => t.id === tipo) || TIPOS[0];
    return definicion(
        tipo,
        tipoDef.nombre,
        tipoDef.destino ? siguienteDestino(inicio, pista) : "",
        ["parada", "saludo"].includes(tipo) ? 4 : tipo === "circulo" ? 18 : 10,
        { orientacionRelativa: tipo === "lateral" ? -22 : tipo === "retroceso" ? 180 : 0 }
    );
}

function avisar(texto) {
    const nodo = document.getElementById("avisoGlobal");
    if (!nodo) return;
    nodo.textContent = String(texto || "");
    nodo.classList.add("visible");
    clearTimeout(avisar.temporizador);
    avisar.temporizador = setTimeout(() => nodo.classList.remove("visible"), 1900);
}

function descargar(proyectoEntrada) {
    const proyecto = normalizarProyecto(proyectoEntrada);
    const blob = new Blob([JSON.stringify(proyecto, null, 2)], { type: "application/json" });
    const enlace = document.createElement("a");
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = (proyecto.nombre || "doma_visual").toLowerCase().replace(/[^a-z0-9]+/gi, "_") + ".doma.json";
    enlace.hidden = true;
    document.body?.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function extraerProyectoImportado(entradaOriginal) {
    const entrada = objetoDatos(entradaOriginal);
    const candidato = esEntradaProyectoReconocible(entrada.proyecto)
        ? entrada.proyecto
        : entrada;
    if (!esEntradaProyectoReconocible(candidato)) {
        throw new Error("La estructura principal no corresponde a un proyecto de Doma Visual.");
    }
    return candidato;
}

function importar(archivo) {
    return new Promise((resolver, rechazar) => {
        if (!archivo || typeof archivo.size !== "number") {
            rechazar(new Error("No se ha recibido un archivo de proyecto válido."));
            return;
        }
        // El límite protege el navegador frente a JSON accidentales o maliciosamente
        // enormes. No limita el catálogo Unicode: cualquier emoji sigue siendo admisible.
        if (archivo.size > MAX_BYTES_IMPORTACION) {
            rechazar(new Error("El proyecto supera el límite de 2 MB."));
            return;
        }
        const lector = new FileReader();
        lector.onload = () => {
            let entrada;
            try {
                entrada = JSON.parse(String(lector.result || "").replace(/^\uFEFF/, ""));
            } catch (_) {
                rechazar(new Error("El archivo JSON está incompleto o no se puede interpretar."));
                return;
            }
            try {
                const candidato = extraerProyectoImportado(entrada);
                comprobarPresupuestoProyecto(candidato);
                const proyecto = normalizarProyecto(candidato);
                resolver({
                    proyecto,
                    reparado: JSON.stringify(candidato) !== JSON.stringify(proyecto)
                });
            } catch (error) {
                rechazar(error instanceof Error ? error : new Error("El archivo no contiene un proyecto válido."));
            }
        };
        lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));
        lector.onabort = () => rechazar(new Error("La lectura del archivo fue cancelada."));
        lector.readAsText(archivo, "utf-8");
    });
}

window.DOMA = {
    TIPOS,
    TIPOS_ELEMENTOS_FIJOS,
    copiar,
    limitar,
    crearId,
    esEntradaProyectoReconocible,
    comprobarPresupuestoProyecto,
    crearElementoFijo,
    posicionRapidaElemento,
    normalizarPista,
    normalizarProyecto,
    obtenerReferencias,
    referenciasDisponibles,
    compilarSecuencia,
    validarProyecto,
    ejemplo,
    total,
    intervalo,
    localizar,
    estado,
    estadoVisual,
    nombrePunto,
    formato,
    nuevaDefinicion,
    avisar,
    descargar,
    importar
};
})();
