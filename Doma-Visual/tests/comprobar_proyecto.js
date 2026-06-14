/*
Doma Visual · Versión 0
Módulo: pruebas estáticas y unitarias de mantenimiento.
Cobertura: sintaxis, versión, contrato DOM, API pública, CSS, normalización, persistencia,
recuperación, proyección visual y estructura exacta del paquete.

Ejecución desde la raíz:
    node tests/comprobar_proyecto.js

No forma parte de la interfaz y .htaccess bloquea el directorio tests.
*/
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { webcrypto } = require("node:crypto");

const raiz = path.resolve(__dirname, "..");
const leer = ruta => fs.readFileSync(path.join(raiz, ruta), "utf8");
const existe = ruta => fs.existsSync(path.join(raiz, ruta));
let pruebas = 0;

async function probar(nombre, funcion) {
    try {
        await funcion();
        pruebas++;
        console.log(`✓ ${nombre}`);
    } catch (error) {
        console.error(`✗ ${nombre}`);
        throw error;
    }
}

function ejecutar(comando, argumentos) {
    const resultado = spawnSync(comando, argumentos, { cwd:raiz, encoding:"utf8" });
    if (resultado.status !== 0) {
        throw new Error(`${comando} ${argumentos.join(" ")}\n${resultado.stdout}\n${resultado.stderr}`);
    }
}

function contextoModelo() {
    const contexto = {
        console,
        crypto:webcrypto,
        setTimeout,
        clearTimeout,
        Blob:global.Blob,
        URL:global.URL,
        document:{
            body:{ append(){} },
            getElementById:() => null,
            createElement:() => ({ click(){}, remove(){}, set hidden(_){} }),
            createElementNS:() => ({})
        }
    };
    contexto.window = contexto;
    contexto.globalThis = contexto;
    vm.createContext(contexto);
    vm.runInContext(leer("assets/modelo.js"), contexto, { filename:"modelo.js" });
    return contexto;
}

function contextoEmojis(contenidoGuardado = "[]") {
    const contexto = {
        console,
        Intl,
        setTimeout,
        clearTimeout,
        localStorage:{
            getItem:() => contenidoGuardado,
            setItem(){},
            removeItem(){}
        },
        document:{
            body:{ append(){} },
            getElementById:() => null,
            createElement:() => ({
                dataset:{},
                addEventListener(){},
                insertAdjacentElement(){},
                removeAttribute(){},
                setAttribute(){},
                append(){},
                querySelector(){ return null; },
                querySelectorAll(){ return []; }
            }),
            querySelectorAll:() => []
        },
        Event:class Event {}
    };
    contexto.window = contexto;
    contexto.globalThis = contexto;
    vm.createContext(contexto);
    vm.runInContext(leer("assets/emojis.js"), contexto, { filename:"emojis.js" });
    return contexto;
}

class AlmacenamientoPrueba {
    constructor(inicial = {}) {
        this.datos = new Map(Object.entries(inicial));
    }
    getItem(clave) { return this.datos.has(clave) ? this.datos.get(clave) : null; }
    setItem(clave, valor) { this.datos.set(clave, String(valor)); }
    removeItem(clave) { this.datos.delete(clave); }
}

function fnv(texto) {
    let valor = 2166136261;
    for (let i = 0; i < texto.length; i++) {
        valor ^= texto.charCodeAt(i);
        valor = Math.imul(valor, 16777619);
    }
    return (valor >>> 0).toString(16).padStart(8, "0");
}

function crearSobre(proyecto, guardadoEn, checksumCorrecto = true) {
    const texto = JSON.stringify(proyecto);
    return JSON.stringify({
        formato:1,
        guardadoEn,
        checksum:checksumCorrecto ? fnv(texto) : "00000000",
        proyecto
    });
}

function contextoLayoutPrueba(ancho, alto, anchoMarco, altoMarco) {
    const clases = new Set();
    const cuerpo = {
        dataset:{},
        classList:{
            toggle(nombre, activo) {
                if (activo) clases.add(nombre);
                else clases.delete(nombre);
            },
            contains:nombre => clases.has(nombre),
            add:nombre => clases.add(nombre),
            remove:nombre => clases.delete(nombre)
        }
    };
    const contexto = {
        console,
        innerWidth:ancho,
        innerHeight:alto,
        visualViewport:null,
        document:{
            body:cuerpo,
            activeElement:null,
            documentElement:{ clientWidth:ancho, clientHeight:alto },
            getElementById:id => id === "marcoPista"
                ? { getBoundingClientRect:() => ({ width:anchoMarco, height:altoMarco }) }
                : null,
            addEventListener(){}
        },
        matchMedia:() => ({ matches:false }),
        setTimeout:() => 1,
        clearTimeout(){},
        addEventListener(){},
        dispatchEvent(){ return true; },
        CustomEvent:class CustomEvent {
            constructor(type, opciones = {}) { this.type = type; this.detail = opciones.detail; }
        },
        DOMA_ERRORES:{
            intentar(_contexto, funcion, alternativa = null) {
                try { return funcion(); }
                catch (_) { return alternativa; }
            }
        }
    };
    contexto.window = contexto;
    contexto.globalThis = contexto;
    vm.createContext(contexto);
    vm.runInContext(leer("assets/layout.js"), contexto, { filename:"layout.js" });
    contexto.DOMA_LAYOUT.inicializar();
    return { contexto, cuerpo, clases };
}

function contextoEstado(inicial = {}) {
    const contexto = contextoModelo();
    const almacenamiento = new AlmacenamientoPrueba(inicial);
    const escuchas = new Map();
    let siguienteTemporizador = 1;
    const temporizadores = new Map();
    const registros = [];

    contexto.localStorage = almacenamiento;
    contexto.setTimeout = funcion => {
        const id = siguienteTemporizador++;
        temporizadores.set(id, funcion);
        return id;
    };
    contexto.clearTimeout = id => temporizadores.delete(id);
    contexto.CustomEvent = class CustomEvent {
        constructor(type, opciones = {}) { this.type = type; this.detail = opciones.detail; }
    };
    contexto.addEventListener = (tipo, funcion) => {
        if (!escuchas.has(tipo)) escuchas.set(tipo, []);
        escuchas.get(tipo).push(funcion);
    };
    contexto.dispatchEvent = evento => {
        for (const funcion of escuchas.get(evento.type) || []) funcion(evento);
        return true;
    };
    contexto.DOMA_ERRORES = {
        registrar(error, contextoError, gravedad = "error") {
            registros.push({ error, contexto:contextoError, gravedad });
            return { error, contexto:contextoError, gravedad };
        },
        intentar(_contexto, funcion, alternativa = null) {
            try { return funcion(); }
            catch (error) {
                registros.push({ error });
                return typeof alternativa === "function" ? alternativa(error) : alternativa;
            }
        },
        mostrarProteccion(registro) { registros.push({ proteccion:registro }); }
    };
    vm.runInContext(leer("assets/estado.js"), contexto, { filename:"estado.js" });
    return { contexto, almacenamiento, registros, temporizadores, escuchas };
}

async function principal() {
    await probar("los PHP superan el análisis sintáctico", () => {
        ejecutar("php", ["-l", "index.php"]);
        ejecutar("php", ["-l", "comprobar.php"]);
        ejecutar("php", ["-l", ".doma-acceso.example.php"]);
        const diagnostico = leer("comprobar.php");
        assert.match(diagnostico, /header_remove\(["']X-Powered-By["']\)/);
        assert.match(diagnostico, /getimagesize/);
        assert.match(diagnostico, /Vista previa social/);
    });

    const javascript = [
        "assets/errores.js", "assets/modelo.js", "assets/estado.js", "assets/layout.js",
        "assets/emojis.js", "assets/pista.js", "assets/editor.js", "assets/aplicacion.js",
        "service-worker.js"
    ];
    await probar("todos los JavaScript superan node --check", () => {
        javascript.forEach(ruta => ejecutar(process.execPath, ["--check", ruta]));
    });

    await probar("el manifiesto es JSON válido", () => {
        const manifiesto = JSON.parse(leer("manifest.webmanifest"));
        assert.equal(manifiesto.start_url, "./index.php");
        assert.equal(manifiesto.scope, "./");
        assert.match(manifiesto.description, /sin registro/i);
        assert.equal(manifiesto.shortcuts.some(atajo => atajo.short_name === "Aprende"), true);
    });

    await probar("la publicación ofrece una vista previa amable y canónica", () => {
        const html = leer("index.php");
        assert.match(html, /<link rel="canonical" href="https:\/\/www\.granderrota\.com\/Herramientas\/Doma\/index\.php">/);
        assert.match(html, /property="og:title" content="Doma Visual 🐎 · Recorridos y consejos de clase"/);
        assert.match(html, /property="og:image" content="https:\/\/www\.granderrota\.com\/Herramientas\/Doma\/icons\/icono-app-512\.png\?v=0-icono-app"/);
        assert.match(html, /name="twitter:card" content="summary"/);
        assert.match(html, /rel="icon" type="image\/png" sizes="192x192"/);
        assert.match(html, /<title>Doma Visual · Recorridos y recordatorios ecuestres<\/title>/);
        assert.equal(html.includes("Room de entrenamiento"), false);
    });

    await probar("los iconos públicos son PNG reales y el marcador técnico permanece independiente", () => {
        for (const [ruta, esperado] of [["icons/icono-app-192.png", 192], ["icons/icono-app-512.png", 512]]) {
            const datos = fs.readFileSync(path.join(raiz, ruta));
            assert.equal(datos.subarray(1, 4).toString("ascii"), "PNG");
            assert.equal(datos.readUInt32BE(16), esperado);
            assert.equal(datos.readUInt32BE(20), esperado);
            assert.ok(datos.length > 5000, `${ruta} parece un marcador demasiado simple`);
        }
        const pista = leer("assets/pista.js");
        assert.equal(pista.includes("icono-app-192.png"), false);
        assert.equal(pista.includes("icono-app-512.png"), false);
        assert.match(pista, /caballo|orientacion|orientación/i);
        const css = leer("assets/estilos.css");
        assert.match(css, /body\[data-layout="compacto"\] \.marca-icono\{width:36px;height:36px/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.marca-icono\{width:32px;height:32px/);
    });

    await probar("la versión PWA es coherente en código y documentación", () => {
        const fuentes = ["index.php", "comprobar.php", "service-worker.js", "README.md", "LEEME_PRIMERO.txt"];
        const versiones = new Set();
        for (const fuente of fuentes) {
            const coincidencias = [...leer(fuente).matchAll(/(?:doma-visual-pwa-)?(\d+-[a-z0-9-]+)/gi)];
            coincidencias.forEach(coincidencia => versiones.add(coincidencia[1]));
        }
        assert.deepEqual([...versiones], ["0-icono-app"]);
    });

    await probar("los ids declarados en index.php no se duplican", () => {
        const ids = [...leer("index.php").matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]);
        assert.equal(new Set(ids).size, ids.length);
    });

    await probar("las referencias DOM estáticas existen o son nodos dinámicos conocidos", () => {
        const html = leer("index.php");
        const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]));
        const dinamicos = new Set([
            "selectorEmojiLibre", "emojiLibreEntrada", "emojiRecientes", "insertarEmojiLibre",
            "panelErrorGlobal", "mensajeErrorGlobal", "detalleErrorGlobal", "continuarError",
            "recuperarError", "descargarError", "dialogoConfirmacionDoma", "tituloConfirmacionDoma",
            "mensajeConfirmacionDoma", "cancelarConfirmacionDoma", "aceptarConfirmacionDoma"
        ]);
        const referencias = new Set();
        for (const ruta of javascript.filter(ruta => ruta.startsWith("assets/"))) {
            const codigo = leer(ruta);
            [...codigo.matchAll(/\$\(["']([^"']+)["']\)/g)].forEach(m => referencias.add(m[1]));
            [...codigo.matchAll(/getElementById\(["']([^"']+)["']\)/g)].forEach(m => referencias.add(m[1]));
        }
        const faltantes = [...referencias].filter(id => !ids.has(id) && !dinamicos.has(id));
        assert.deepEqual(faltantes, []);
    });

    await probar("los módulos exponen solo su contrato público de versión 0", () => {
        function clavesExportadas(ruta, espacio) {
            const codigo = leer(ruta);
            const coincidencia = codigo.match(new RegExp(`window\\.${espacio}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
            assert.ok(coincidencia, `No se encontró la exportación ${espacio}`);
            return coincidencia[1]
                .split("\n")
                .map(linea => linea.trim().replace(/,$/, ""))
                .filter(Boolean)
                .map(linea => linea.split(":", 1)[0].trim())
                .sort();
        }

        assert.deepEqual(clavesExportadas("assets/modelo.js", "DOMA"), [
            "TIPOS", "TIPOS_ELEMENTOS_FIJOS", "avisar", "compilarSecuencia", "comprobarPresupuestoProyecto", "copiar",
            "crearElementoFijo", "crearId", "descargar", "ejemplo", "esEntradaProyectoReconocible",
            "estado", "estadoVisual", "formato", "importar", "intervalo", "limitar", "localizar",
            "nombrePunto", "normalizarPista", "normalizarProyecto", "nuevaDefinicion",
            "obtenerReferencias", "posicionRapidaElemento", "referenciasDisponibles", "total",
            "validarProyecto"
        ].sort());
        assert.deepEqual(clavesExportadas("assets/estado.js", "DOMA_ESTADO"), [
            "actualizarInterfaz", "cargar", "deshacer", "establecerTiempoReproduccion", "estado",
            "guardarAhora", "rehacer", "resumenDiagnostico", "sustituirProyecto", "suscribir",
            "transaccion"
        ].sort());
        assert.deepEqual(clavesExportadas("assets/layout.js", "DOMA_LAYOUT"), [
            "abrirEdicion", "alternarVistaLimpia", "cerrarEdicion", "inicializar",
            "obtenerOrientacionPista"
        ].sort());
        assert.deepEqual(clavesExportadas("assets/emojis.js", "DOMA_EMOJIS"), [
            "grafemas", "registrarCampo", "registrarCamposDentro"
        ].sort());
        assert.deepEqual(clavesExportadas("assets/editor.js", "DOMA_EDITOR"), [
            "establecerPestana", "estadoElementosFijos", "inicializar", "vaciarAutoedicion"
        ].sort());
        assert.deepEqual(clavesExportadas("assets/errores.js", "DOMA_ERRORES"), [
            "confirmar", "intentar", "mostrarProteccion", "proteger", "registrar", "requerirElemento"
        ].sort());
    });

    await probar("la base no conserva marcadores ni versiones históricas", () => {
        const fuentes = [
            ...javascript, "index.php", "README.md", "LEEME_PRIMERO.txt",
            "assets/estilos.css"
        ];
        const unido = fuentes.map(leer).join("\n");
        assert.equal(/\b(?:TODO|FIXME|HACK)\b/.test(unido), false);
        assert.equal(unido.includes("13-hud-adaptativo"), false);
        assert.match(leer("README.md"), /\*\*Estado funcional:\*\* versión 0/);
    });

    await probar("la normalización tolera campos parciales y conserva datos válidos", () => {
        const { DOMA } = contextoModelo();
        const proyecto = DOMA.normalizarProyecto({
            nombre:"Recuperado",
            campoFuturo:{ conservar:true },
            definiciones:[null, { id:"m1", tipo:"linea", titulo:"Válido", destino:"X", duracion:"12" }],
            elementosFijos:[null, { id:"f1", tipo:"cono", nombre:"Cono", xNorm:"0.4", yNorm:"0.6" }],
            senales:{ caballo:[null], jinete:[null] }
        });
        assert.equal(proyecto.nombre, "Recuperado");
        assert.equal(proyecto.definiciones.length, 1);
        assert.equal(proyecto.definiciones[0].titulo, "Válido");
        assert.equal(proyecto.elementosFijos.length, 1);
        assert.equal(proyecto.campoFuturo.conservar, true);
        assert.doesNotThrow(() => DOMA.normalizarProyecto(null));
        assert.equal(DOMA.esEntradaProyectoReconocible({ foo:1 }), false);
    });

    await probar("la normalización resiste una batería determinista de entradas deformadas", () => {
        const { DOMA } = contextoModelo();
        let semilla = 0x6d2b79f5;
        const azar = () => {
            semilla = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
            semilla ^= semilla + Math.imul(semilla ^ (semilla >>> 7), 61 | semilla);
            return ((semilla ^ (semilla >>> 14)) >>> 0) / 4294967296;
        };
        const raros = [null, "", "  ", "NaN", NaN, Infinity, -Infinity, -999999, 999999, {}, [], true, false];
        const elegir = () => raros[Math.floor(azar() * raros.length)];

        for (let caso = 0; caso < 300; caso++) {
            const cantidad = Math.floor(azar() * 8);
            const entrada = {
                nombre:elegir(),
                pista:{ ancho:elegir(), largo:elegir(), preset:elegir(), plantilla:elegir() },
                ambiente:{ orientacion:elegir() },
                senales:{
                    caballo:Array.from({ length:cantidad }, (_, i) => i % 3 ? { id:i % 2 ? "dup" : "", color:elegir(), significado:elegir(), emoji:elegir() } : elegir()),
                    jinete:Array.from({ length:cantidad }, (_, i) => i % 2 ? { id:"j", significado:elegir() } : elegir())
                },
                definiciones:Array.from({ length:cantidad }, (_, i) => i % 3 ? {
                    id:i % 2 ? "mov" : "",
                    tipo:elegir(),
                    titulo:elegir(),
                    destino:elegir(),
                    duracion:elegir(),
                    radio:elegir(),
                    efectos:Array.from({ length:3 }, (_, j) => j ? { id:"ef", momento:elegir(), duracion:elegir(), emoji:elegir() } : elegir())
                } : elegir()),
                elementosFijos:Array.from({ length:cantidad }, (_, i) => i % 2 ? { id:"f", tipo:elegir(), xNorm:elegir(), yNorm:elegir() } : elegir())
            };
            const normalizado = DOMA.normalizarProyecto(entrada);
            assert.equal(normalizado.version, 7);
            assert.ok(normalizado.definiciones.length >= 1);
            assert.ok(normalizado.senales.caballo.length >= 1);
            assert.ok(normalizado.senales.jinete.length >= 1);
            assert.equal(new Set(Array.from(normalizado.definiciones, x => x.id)).size, normalizado.definiciones.length);
            assert.equal(new Set(Array.from(normalizado.senales.caballo, x => x.id)).size, normalizado.senales.caballo.length);
            assert.equal(new Set(Array.from(normalizado.senales.jinete, x => x.id)).size, normalizado.senales.jinete.length);
            assert.ok(Number.isFinite(DOMA.total(normalizado)));
            normalizado.definiciones.forEach(definicion => {
                assert.ok(Number.isFinite(definicion.duracion));
                assert.ok(Number.isFinite(definicion.radio));
                assert.equal(new Set(Array.from(definicion.efectos, x => x.id)).size, definicion.efectos.length);
            });
        }
    });

    await probar("las secuencias Unicode complejas y recientes dañados no rompen emojis.js", () => {
        const guardado = JSON.stringify([1, null, "", {}, "👩🏽‍🏫", "🇪🇸", "1️⃣", "e\u0301"]);
        const contexto = contextoEmojis(guardado);
        const secuencia = "👩🏽‍🏫🇪🇸1️⃣e\u0301";
        const partes = contexto.DOMA_EMOJIS.grafemas(secuencia);
        assert.equal(partes.join(""), secuencia);
        assert.equal(partes.length, 4);
        assert.doesNotThrow(() => contexto.DOMA_EMOJIS.grafemas("\ud800"));
        assert.doesNotThrow(() => contextoEmojis("{json roto"));
    });

    await probar("el presupuesto estructural rechaza proyectos capaces de bloquear el navegador", () => {
        const { DOMA } = contextoModelo();
        const valido = DOMA.ejemplo();
        valido.definiciones = Array.from({ length:125 }, (_, i) => ({
            id:`m_${i}`, tipo:"linea", titulo:`Paso ${i}`, destino:"X", duracion:10,
            efectos:Array.from({ length:42 }, (_, j) => ({ id:`e_${i}_${j}`, momento:1, duracion:.5 }))
        }));
        assert.equal(DOMA.comprobarPresupuestoProyecto(valido), true);

        const demasiados = DOMA.ejemplo();
        demasiados.definiciones = Array.from({ length:301 }, () => ({}));
        assert.throws(() => DOMA.comprobarPresupuestoProyecto(demasiados), /demasiado complejo/);

        const profundo = DOMA.ejemplo();
        let cursor = profundo;
        for (let i = 0; i < 55; i++) cursor = cursor.nivel = {};
        assert.throws(() => DOMA.comprobarPresupuestoProyecto(profundo), /profundidad/);
    });

    await probar("los textos reconocidos se limitan sin romper Unicode", () => {
        const { DOMA } = contextoModelo();
        const largo = "🐴".repeat(5000);
        const proyecto = DOMA.normalizarProyecto({
            nombre:"N".repeat(1000),
            elementosFijos:[{ tipo:"sol", nombre:"S".repeat(1000), emoji:largo }],
            senales:{ caballo:[{ significado:"C".repeat(1000), emoji:largo }], jinete:[] },
            definiciones:[{ titulo:"T".repeat(1000), comentario:"P".repeat(5000), ayuda:"A".repeat(5000), efectos:[{ emoji:largo }] }]
        });
        assert.ok(proyecto.nombre.length <= 200);
        assert.ok(proyecto.definiciones[0].titulo.length <= 300);
        assert.ok(proyecto.definiciones[0].comentario.length <= 2000);
        assert.ok(Array.from(proyecto.elementosFijos[0].emoji).length <= 128);
        assert.equal(proyecto.elementosFijos[0].emoji.includes("�"), false);
    });

    await probar("normalizar un proyecto no muta el objeto de entrada", () => {
        const { DOMA } = contextoModelo();
        const entrada = {
            nombre:"Original",
            pista:{ preset:"personalizada", ancho:"20", largo:"60" },
            definiciones:[{ id:"m", tipo:"linea", titulo:"Uno", destino:"X", duracion:"8", efectos:[] }]
        };
        const antes = JSON.stringify(entrada);
        const salida = DOMA.normalizarProyecto(entrada);
        salida.nombre = "Cambiado";
        salida.definiciones[0].titulo = "Otro";
        assert.equal(JSON.stringify(entrada), antes);
    });

    await probar("los límites de alta no recortan proyectos importados ya complejos", () => {
        const { DOMA } = contextoModelo();
        const base = DOMA.ejemplo();
        const movimiento = base.definiciones[0];
        const proyecto = DOMA.normalizarProyecto({
            nombre:"Grande pero válido",
            definiciones:Array.from({ length:125 }, (_, i) => ({
                ...movimiento,
                id:`m_${i}`,
                titulo:`Movimiento ${i}`,
                efectos:Array.from({ length:42 }, (_, j) => ({ id:`e_${i}_${j}`, momento:0, duracion:.5, emoji:"✨" }))
            })),
            elementosFijos:Array.from({ length:50 }, (_, i) => ({ id:`f_${i}`, tipo:"cono", nombre:`Cono ${i}`, xNorm:.5, yNorm:.5 })),
            senales:{
                caballo:Array.from({ length:41 }, (_, i) => ({ id:`c_${i}`, color:"#112233", significado:`C ${i}`, emoji:"●" })),
                jinete:Array.from({ length:41 }, (_, i) => ({ id:`j_${i}`, color:"#445566", significado:`J ${i}`, emoji:"🧍" }))
            }
        });
        assert.equal(proyecto.definiciones.length, 125);
        assert.equal(proyecto.definiciones[0].efectos.length, 42);
        assert.equal(proyecto.elementosFijos.length, 50);
        assert.equal(proyecto.senales.caballo.length, 41);
        assert.equal(proyecto.senales.jinete.length, 41);
    });

    await probar("modelo.js conserva colisiones de id entre elementos distintos", () => {
        const { DOMA } = contextoModelo();
        const primero = DOMA.crearElementoFijo("cono", {
            id:"id_repetido", nombre:"Cono A", xNorm:.2, yNorm:.3
        });
        const distinto = DOMA.crearElementoFijo("cono", {
            id:"id_repetido", nombre:"Cono B", xNorm:.8, yNorm:.7
        });
        const exacto = { ...primero, id:"otra_copia" };
        const proyecto = DOMA.normalizarProyecto({
            nombre:"Colisiones",
            elementosFijos:[primero, distinto, exacto],
            definiciones:[]
        });
        const resultado = proyecto.elementosFijos;

        assert.equal(resultado.length, 2);
        assert.equal(new Set(resultado.map(entrada => entrada.id)).size, 2);
        assert.equal(JSON.stringify(Array.from(resultado, entrada => entrada.nombre).sort()), JSON.stringify(["Cono A", "Cono B"]));
    });

    await probar("la proyección horizontal sitúa A a la izquierda y C a la derecha", () => {
        const contexto = contextoModelo();
        vm.runInContext(leer("assets/pista.js"), contexto, { filename:"pista.js" });
        const pista = { preset:"oficial_60" };
        const a = contexto.PISTA.proyectarPunto(pista, { x:10, y:0 }, "horizontal");
        const c = contexto.PISTA.proyectarPunto(pista, { x:10, y:60 }, "horizontal");
        assert.deepEqual(JSON.parse(JSON.stringify(a)), { x:0, y:10 });
        assert.deepEqual(JSON.parse(JSON.stringify(c)), { x:60, y:10 });
        const original = { x:3.25, y:47.5 };
        const visual = contexto.PISTA.proyectarPunto(pista, original, "horizontal");
        const regreso = contexto.PISTA.desproyectarPunto(pista, visual, "horizontal");
        assert.deepEqual(JSON.parse(JSON.stringify(regreso)), original);
    });

    await probar("los márgenes SVG equilibran pista, elementos exteriores y borde", () => {
        class NodoSvg {
            constructor(nombre) {
                this.nombre = nombre;
                this.atributos = {};
                this.hijos = [];
                this.style = { setProperty(){} };
                this.classList = { add(){}, remove(){} };
            }
            setAttribute(clave, valor) { this.atributos[clave] = String(valor); }
            append(...nodos) { this.hijos.push(...nodos); }
            replaceChildren(...nodos) { this.hijos = [...nodos]; }
            addEventListener() {}
            closest() { return null; }
        }

        const contexto = contextoModelo();
        contexto.document.createElementNS = (_ns, nombre) => new NodoSvg(nombre);
        vm.runInContext(leer("assets/pista.js"), contexto, { filename:"pista.js" });
        const contenedor = new NodoSvg("div");
        contexto.PISTA.render(contenedor, contexto.DOMA.ejemplo(), {
            orientacionVisual:"horizontal",
            movimientos:[],
            indiceActual:0
        });

        const [x, y, ancho, alto] = contenedor.hijos[0].atributos.viewBox.split(/\s+/).map(Number);
        const margenC = x + ancho - 60;
        const margenDerecho = y + alto - 20;
        assert.ok(Math.abs(margenC - 9.6) < 1e-9, `Margen C inesperado: ${margenC}`);
        assert.ok(Math.abs(margenDerecho - 7.2) < 1e-9, `Margen lateral inesperado: ${margenDerecho}`);

        function buscar(nodo, predicado) {
            if (predicado(nodo)) return nodo;
            for (const hijo of nodo.hijos || []) {
                const encontrado = buscar(hijo, predicado);
                if (encontrado) return encontrado;
            }
            return null;
        }
        const jurado = buscar(contenedor, nodo => nodo.atributos?.["data-elemento-id"] === "fijo_jurado_principal");
        assert.ok(jurado, "No se ha renderizado el jurado principal");
        const fondo = jurado.hijos.find(nodo => nodo.nombre === "rect");
        const emoji = jurado.hijos.find(nodo => nodo.nombre === "text" && nodo.atributos.class === "emoji-elemento-fijo");
        assert.equal(Number(fondo.atributos.height), 3.55);
        assert.equal(Number(emoji.atributos.y), -.12);
    });

    await probar("una copia íntegra prevalece sobre una principal con checksum incorrecto", () => {
        const modelo = contextoModelo().DOMA;
        const corrupto = modelo.ejemplo();
        corrupto.nombre = "Principal alterado";
        const respaldo = modelo.ejemplo();
        respaldo.nombre = "Respaldo íntegro";
        const { contexto, almacenamiento } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(corrupto, "2026-06-14T10:00:00.000Z", false),
            doma_visual_respaldo_1_v1:crearSobre(respaldo, "2026-06-13T10:00:00.000Z", true)
        });
        contexto.DOMA_ESTADO.cargar();
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto.nombre, "Respaldo íntegro");
        assert.equal(contexto.DOMA_ESTADO.estado.origenCarga, "respaldo 1");
        const principalReparado = JSON.parse(almacenamiento.getItem("doma_visual_proyecto_seguro_v1"));
        assert.equal(principalReparado.proyecto.nombre, "Respaldo íntegro");
    });

    await probar("una copia reconocible se repara si no existe ninguna copia íntegra", () => {
        const modelo = contextoModelo().DOMA;
        const proyecto = modelo.ejemplo();
        proyecto.nombre = "Proyecto salvado";
        proyecto.definiciones.push(null);
        const { contexto } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(proyecto, "2026-06-14T10:00:00.000Z", false)
        });
        contexto.DOMA_ESTADO.cargar();
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto.nombre, "Proyecto salvado");
        assert.match(contexto.DOMA_ESTADO.estado.origenCarga, /reparado/);
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto.definiciones.some(Boolean), true);
    });

    await probar("un guardado temporal íntegro y más reciente se recupera automáticamente", () => {
        const modelo = contextoModelo().DOMA;
        const principal = modelo.ejemplo();
        principal.nombre = "Principal anterior";
        const temporal = modelo.ejemplo();
        temporal.nombre = "Temporal reciente";
        const { contexto } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(principal, "2026-06-14T09:00:00.000Z", true),
            doma_visual_temporal_v1:crearSobre(temporal, "2026-06-14T10:00:00.000Z", true)
        });
        contexto.DOMA_ESTADO.cargar();
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto.nombre, "Temporal reciente");
        assert.equal(contexto.DOMA_ESTADO.estado.origenCarga, "guardado temporal");
    });

    await probar("un fallo al sustituir la principal conserva la copia temporal recuperable", () => {
        const modelo = contextoModelo().DOMA;
        const anterior = modelo.ejemplo();
        anterior.nombre = "Antes del fallo";
        const { contexto, almacenamiento } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(anterior, "2025-01-01T10:00:00.000Z", true)
        });
        contexto.DOMA_ESTADO.cargar();
        contexto.DOMA_ESTADO.transaccion("cambio pendiente", candidato => {
            candidato.nombre = "Recuperable tras fallo";
        });

        const setItemOriginal = almacenamiento.setItem.bind(almacenamiento);
        almacenamiento.setItem = (clave, valor) => {
            if (clave === "doma_visual_proyecto_seguro_v1") {
                throw new Error("Fallo simulado al escribir la copia principal");
            }
            setItemOriginal(clave, valor);
        };
        assert.equal(contexto.DOMA_ESTADO.guardarAhora(false), false);

        const temporal = almacenamiento.getItem("doma_visual_temporal_v1");
        assert.ok(temporal, "Debe quedar una copia temporal tras fallar la principal");
        assert.equal(JSON.parse(temporal).proyecto.nombre, "Recuperable tras fallo");

        const datosReinicio = Object.fromEntries(almacenamiento.datos);
        const reinicio = contextoEstado(datosReinicio);
        reinicio.contexto.DOMA_ESTADO.cargar();
        assert.equal(reinicio.contexto.DOMA_ESTADO.estado.proyecto.nombre, "Recuperable tras fallo");
        assert.equal(reinicio.contexto.DOMA_ESTADO.estado.origenCarga, "guardado temporal");
    });

    await probar("guardar dos veces el mismo proyecto no consume los respaldos", () => {
        const modelo = contextoModelo().DOMA;
        const principal = modelo.ejemplo();
        principal.nombre = "A";
        const respaldo = modelo.ejemplo();
        respaldo.nombre = "B";
        const { contexto, almacenamiento } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(principal, "2026-06-14T10:00:00.000Z", true),
            doma_visual_respaldo_1_v1:crearSobre(respaldo, "2026-06-13T10:00:00.000Z", true)
        });
        contexto.DOMA_ESTADO.cargar();
        contexto.DOMA_ESTADO.transaccion("renombrar", candidato => { candidato.nombre = "C"; });
        assert.equal(contexto.DOMA_ESTADO.guardarAhora(false), true);
        const respaldo1 = almacenamiento.getItem("doma_visual_respaldo_1_v1");
        const respaldo2 = almacenamiento.getItem("doma_visual_respaldo_2_v1");
        assert.equal(contexto.DOMA_ESTADO.guardarAhora(false), true);
        assert.equal(almacenamiento.getItem("doma_visual_respaldo_1_v1"), respaldo1);
        assert.equal(almacenamiento.getItem("doma_visual_respaldo_2_v1"), respaldo2);
    });

    await probar("el guardado temporal se escribe una sola vez antes de verificarlo", () => {
        const codigo = leer("assets/estado.js");
        const escrituras = codigo.match(/localStorage\.setItem\(CLAVE_TEMPORAL, nuevoContenido\)/g) || [];
        assert.equal(escrituras.length, 1);
    });

    await probar("el estado ignora claves ajenas y limita tiempo e índices", () => {
        const { contexto } = contextoEstado();
        contexto.DOMA_ESTADO.cargar();
        const proyectoOriginal = contexto.DOMA_ESTADO.estado.proyecto;
        contexto.DOMA_ESTADO.actualizarInterfaz({
            proyecto:{ nombre:"No debe entrar" },
            claveInventada:123,
            indiceEdicion:9999,
            indiceReproduccion:-9999,
            tiempo:1e12
        });
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto, proyectoOriginal);
        assert.equal("claveInventada" in contexto.DOMA_ESTADO.estado, false);
        assert.equal(contexto.DOMA_ESTADO.estado.indiceEdicion, proyectoOriginal.definiciones.length - 1);
        assert.equal(contexto.DOMA_ESTADO.estado.indiceReproduccion, 0);
        assert.equal(contexto.DOMA_ESTADO.estado.tiempo, contexto.DOMA.total(proyectoOriginal));
    });

    await probar("las transacciones nulas no consumen historial y el historial se limita a 40", () => {
        const { contexto } = contextoEstado();
        contexto.DOMA_ESTADO.cargar();
        contexto.DOMA_ESTADO.transaccion("sin cambios", () => {});
        assert.equal(contexto.DOMA_ESTADO.resumenDiagnostico().puedeDeshacer, false);
        for (let i = 0; i < 55; i++) {
            contexto.DOMA_ESTADO.transaccion(`cambio ${i}`, candidato => { candidato.nombre = `Proyecto ${i}`; });
        }
        let deshechos = 0;
        while (contexto.DOMA_ESTADO.deshacer()) deshechos++;
        assert.equal(deshechos, 40);
        let rehechos = 0;
        while (contexto.DOMA_ESTADO.rehacer()) rehechos++;
        assert.equal(rehechos, 40);
    });

    await probar("el historial limita también su consumo aproximado de memoria", () => {
        const { contexto } = contextoEstado();
        contexto.DOMA_ESTADO.cargar();
        for (let i = 0; i < 24; i++) {
            contexto.DOMA_ESTADO.transaccion(`proyecto grande ${i}`, candidato => {
                candidato.nombre = `Grande ${i}`;
                candidato.rellenoPrueba = `${i}:` + "x".repeat(420000);
            });
        }
        const diagnostico = contexto.DOMA_ESTADO.resumenDiagnostico();
        assert.ok(diagnostico.bytesHistorial <= 8 * 1024 * 1024);
        let deshechos = 0;
        while (contexto.DOMA_ESTADO.deshacer()) deshechos++;
        assert.ok(deshechos >= 1 && deshechos < 24);
    });

    await probar("dos ventanas no se sobrescriben silenciosamente", () => {
        const base = contextoModelo().DOMA.ejemplo();
        base.nombre = "Base compartida";
        const { contexto, almacenamiento, escuchas } = contextoEstado({
            doma_visual_proyecto_seguro_v1:crearSobre(base, "2026-06-14T10:00:00.000Z", true)
        });
        contexto.DOMA_ESTADO.cargar();
        contexto.DOMA_ESTADO.transaccion("edicion local", candidato => { candidato.nombre = "Edición local"; });

        const externo = contexto.DOMA.normalizarProyecto(base);
        externo.nombre = "Edición de otra ventana";
        const contenidoExterno = crearSobre(externo, "2026-06-14T10:05:00.000Z", true);
        almacenamiento.setItem("doma_visual_proyecto_seguro_v1", contenidoExterno);
        for (const escuchar of escuchas.get("storage") || []) {
            escuchar({
                key:"doma_visual_proyecto_seguro_v1",
                newValue:contenidoExterno,
                storageArea:almacenamiento
            });
        }

        assert.equal(contexto.DOMA_ESTADO.guardarAhora(false), false);
        assert.equal(JSON.parse(almacenamiento.getItem("doma_visual_proyecto_seguro_v1")).proyecto.nombre, "Edición de otra ventana");
        assert.equal(JSON.parse(almacenamiento.getItem("doma_visual_conflicto_otra_ventana_v1")).proyecto.nombre, "Edición local");
        assert.equal(contexto.DOMA_ESTADO.resumenDiagnostico().conflictoExterno, true);
    });

    await probar("un suscriptor defectuoso no impide actualizar a los demás", () => {
        const { contexto, registros } = contextoEstado();
        contexto.DOMA_ESTADO.cargar();
        let recibido = 0;
        contexto.DOMA_ESTADO.suscribir(() => { throw new Error("suscriptor roto"); });
        contexto.DOMA_ESTADO.suscribir(() => { recibido++; });
        contexto.DOMA_ESTADO.transaccion("cambio visible", candidato => { candidato.nombre = "Sigue funcionando"; });
        assert.ok(recibido >= 1);
        assert.ok(registros.some(registro => String(registro.contexto || "").includes("suscriptor de estado")));
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto.nombre, "Sigue funcionando");
    });

    await probar("aplicacion.js confirma cambios pendientes antes de guardar o cerrar", () => {
        const codigo = leer("assets/aplicacion.js");
        assert.match(codigo, /function sincronizarCambiosPendientes/);
        assert.match(codigo, /DOMA_EDITOR\.vaciarAutoedicion/);
        assert.match(codigo, /pagehide/);
        assert.equal(/estado\(\)\.tiempo\s*=/.test(codigo), false);
    });

    await probar("errores.js representa errores circulares y revoca cada descarga una vez", () => {
        const codigo = leer("assets/errores.js");
        assert.match(codigo, /function textoErrorSeguro/);
        assert.match(codigo, /function datosDiagnosticoSeguros/);
        assert.equal((codigo.match(/URL\.revokeObjectURL\(url\)/g) || []).length, 1);
        assert.match(codigo, /1500/);
        assert.equal(/ResizeObserver/.test(codigo), false);
    });

    await probar("la protección Apache cubre configuración, documentación y pruebas", () => {
        const reglas = leer(".htaccess");
        assert.match(reglas, /Options -Indexes/);
        assert.match(reglas, /\.doma-acceso\(\?:\\\.example\)\?\\\.php/);
        assert.match(reglas, /RewriteRule "\^tests/);
        assert.match(reglas, /application\/manifest\+json/);
        assert.equal(existe(".doma-acceso.php"), false);
        assert.equal(existe(".doma-acceso.example.php"), true);
        const plantilla = leer(".doma-acceso.example.php");
        assert.match(plantilla, /SUSTITUIR_POR_UN_HASH_GENERADO_CON_PASSWORD_HASH/);
        assert.equal(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/.test(plantilla), false);
        const ignorados = leer(".gitignore");
        assert.match(ignorados, /^\.doma-acceso\.php$/m);
        assert.match(leer("comprobar.php"), /session\.use_strict_mode/);
    });

    await probar("el service worker no confunde un fallo de caché con un fallo de red", () => {
        const codigo = leer("service-worker.js");
        assert.match(codigo, /No se pudo actualizar la caché de navegación/);
        assert.match(codigo, /No se pudo actualizar la caché de recurso/);
        assert.match(codigo, /diagnosticoSoloRed/);
        assert.match(codigo, /AbortController/);
        assert.match(codigo, /controlador\.abort\(\)/);
        const bloqueBase = codigo.match(/const ARCHIVOS_BASE = \[([\s\S]*?)\];/)?.[1] || "";
        assert.equal(/comprobar\.php/.test(bloqueBase), false);
    });

    await probar("el CSS no fragmenta selectores base entre reglas duplicadas", () => {
        const css = leer("assets/estilos.css");
        const selectoresBase = [
            ".aplicacion", ".acciones-cabecera", ".lienzo-pista", ".svg-pista", ".trayectoria",
            ".mandos", ".mando", ".fila-paleta", ".campo-emoji-contenedor"
        ];
        for (const selector of selectoresBase) {
            const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const coincidencias = css.match(new RegExp(`(?:^|\n)${escapado}\{`, "g")) || [];
            assert.equal(coincidencias.length, 1, `${selector} aparece ${coincidencias.length} veces`);
        }
    });

    await probar("la hoja de estilos mantiene una sola arquitectura y no colapsa la pista móvil", () => {
        const css = leer("assets/estilos.css");
        assert.equal(css.includes("/* Arquitectura adaptable controlada por layout.js. */"), false);
        assert.equal(css.includes("@media(max-width:820px){\n    :root{--cabecera"), false);
        assert.match(css, /body\[data-layout="compacto"\]\{[\s\S]*?--cabecera:54px;[\s\S]*?--mandos:calc\(134px/);
        const cajonCompacto = css.match(/body\[data-layout="compacto"\] \.cajon-edicion\{([\s\S]*?)\n\}/)?.[1] || "";
        assert.match(cajonCompacto, /position:fixed/);
        assert.match(cajonCompacto, /left:0/);
        assert.match(cajonCompacto, /right:0/);
        assert.match(cajonCompacto, /pointer-events:none/);
        assert.match(css, /body\[data-layout="compacto"\] \.rail-cabecera\{display:none\}/);
        assert.match(css, /body\[data-layout="compacto"\] \.rail-movimientos\{[\s\S]*?border-bottom:1px solid var\(--borde\)/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.room\{[\s\S]*?grid-template-columns:148px minmax\(0,1fr\)/);
    });

    await probar("el móvil horizontal puede apaisar la pista sin alterar el móvil vertical", () => {
        const horizontal = contextoLayoutPrueba(844, 390, 830, 128);
        assert.equal(horizontal.cuerpo.dataset.layout, "compacto");
        assert.equal(horizontal.clases.has("layout-bajo"), true);
        assert.equal(horizontal.cuerpo.dataset.pistaVisual, "horizontal");

        const vertical = contextoLayoutPrueba(390, 844, 378, 610);
        assert.equal(vertical.cuerpo.dataset.layout, "compacto");
        assert.equal(vertical.clases.has("layout-bajo"), false);
        assert.equal(vertical.cuerpo.dataset.pistaVisual, "vertical");

        const codigo = leer("assets/layout.js");
        assert.match(codigo, /if \(compactoPanoramico\) return "horizontal"/);
        assert.match(codigo, /if \(modo === "compacto"\) return "vertical"/);
    });

    await probar("el número de AHORA conserva su centrado y no es anulado por el bloque textual", () => {
        const css = leer("assets/estilos.css");
        assert.match(css, /\.numero-actual\{[\s\S]*?display:grid;[\s\S]*?place-items:center/);
        assert.equal(/\.tarjeta-actual span\{display:block\}/.test(css), false);
        assert.match(css, /\.tarjeta-actual > div span\{display:block\}/);
    });

    await probar("AHORA y la leyenda quedan fuera del lienzo y se adaptan a cada orientación", () => {
        const html = leer("index.php");
        const css = leer("assets/estilos.css");
        assert.match(html, /<div class="zona-pista">[\s\S]*?<div class="hud-pista"[\s\S]*?<div id="marcoPista" class="marco-pista">/);
        assert.match(css, /\.zona-pista\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\)/);
        assert.match(css, /body\[data-pista-visual="horizontal"\] \.hud-pista\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto/);
        assert.match(css, /body\[data-layout="compacto"\]:not\(\.layout-bajo\) \.zona-pista\{[\s\S]*?grid-template-columns:92px minmax\(0,1fr\)/);
        assert.match(css, /body\[data-layout="compacto"\]:not\(\.layout-bajo\) \.leyenda-room\{[\s\S]*?flex-direction:column/);
        assert.equal(/\.tarjeta-actual\{[\s\S]{0,120}?position:absolute/.test(css), false);
        assert.equal(/\.leyenda-room\{[\s\S]{0,120}?position:absolute/.test(css), false);
    });

    await probar("el paisaje compacto usa una composición lateral similar al escritorio", () => {
        const css = leer("assets/estilos.css");
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.rail-movimientos\{[\s\S]*?display:block;[\s\S]*?border-right:1px solid var\(--borde\)/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.lista-movimientos\{[\s\S]*?display:grid;[\s\S]*?overflow-y:auto/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo\{[\s\S]*?--mandos:calc\(72px/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.mandos\{[\s\S]*?grid-template-rows:22px 40px/);
    });

    await probar("el selector de velocidad móvil conserva anchura y separación del borde", () => {
        const html = leer("index.php");
        const css = leer("assets/estilos.css");
        assert.match(html, /id="velocidad"[^>]*aria-label="Velocidad de reproducción"/);
        assert.match(css, /body\[data-layout="compacto"\] \.mandos\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 76px/);
        assert.match(css, /body\[data-layout="compacto"\] \.velocidad>span\{display:none\}/);
        assert.match(css, /body\[data-layout="compacto"\] \.velocidad select\{[\s\S]*?width:100%;[\s\S]*?max-width:100%/);
        assert.match(css, /body\[data-layout="compacto"\]\.layout-bajo \.mandos\{[\s\S]*?70px/);
        assert.match(css, /safe-area-inset-right\) \+ 8px/);
    });

    await probar("la disposición amplia aumenta legibilidad sin afectar la densidad compacta", () => {
        const css = leer("assets/estilos.css");
        assert.match(css, /--cabecera:64px/);
        assert.match(css, /body\[data-layout="amplio"\] \.room\{[\s\S]*?grid-template-columns:260px minmax\(0,1fr\) 0/);
        assert.match(css, /body\[data-layout="amplio"\]\.edicion-abierta \.room\{[\s\S]*?400px/);
        assert.match(css, /body\[data-layout="amplio"\] \.boton-cabecera\{font-size:15px\}/);
        assert.match(css, /body\[data-layout="amplio"\] \.mando\{font-size:13px;min-height:46px\}/);
        assert.match(css, /body\[data-layout="amplio"\] \.panel-pestana input,/);
        assert.match(css, /body\[data-layout="compacto"\] \.movimiento strong\{font-size:11px\}/);
    });

    await probar("compartir usa solo el enlace público y dispone de alternativa segura", () => {
        const html = leer("index.php");
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(html, /id="compartirDesdePanel"/);
        assert.match(html, /Compartir el enlace no envía el proyecto ni los consejos guardados/);
        assert.match(aplicacion, /function urlPublicaAplicacion\(\)/);
        assert.match(aplicacion, /link\[rel="canonical"\]/);
        assert.match(aplicacion, /typeof navigator\.share === "function"/);
        assert.match(aplicacion, /navigator\.clipboard\?\.writeText/);
        assert.match(aplicacion, /Enlace copiado\. Ya puedes pegarlo en Telegram/);
        const bloque = aplicacion.match(/async function compartirAplicacion\(\) \{[\s\S]*?\n\}/)?.[0] || "";
        assert.equal(/JSON\.stringify\(proyecto\(\)\)/.test(bloque), false);
        assert.equal(/DOMA\.descargar/.test(bloque), false);
    });

    await probar("los textos pedagógicos son claros e inclusivos sin cambiar las claves internas", () => {
        const html = leer("index.php");
        const aplicacion = leer("assets/aplicacion.js");
        const editor = leer("assets/editor.js");
        const modelo = leer("assets/modelo.js");
        assert.match(html, /Señal base de quien monta/);
        assert.match(html, /Paleta de quien monta/);
        assert.match(aplicacion, /Tú: \$\{visual\.jineteSignificado\}/);
        assert.match(editor, /Señales del caballo y de quien monta/);
        assert.match(modelo, /Recordatorio de manos/);
        assert.match(modelo, /Recordatorio de piernas/);
        assert.equal(modelo.includes('significado:"Pierna activa"'), false);
        assert.equal(modelo.includes('significado:"Manos suaves"'), false);
    });

    await probar("compartir funciona con Web Share y con copia al portapapeles", async () => {
        const aplicacion = leer("assets/aplicacion.js");
        const inicioFunciones = aplicacion.indexOf("function urlPublicaAplicacion()");
        const finFunciones = aplicacion.indexOf("\nfunction crearTextoRuta", inicioFunciones);
        const funciones = aplicacion.slice(inicioFunciones, finFunciones);
        assert.ok(funciones.includes("async function compartirAplicacion"));
        const canonical = "https://www.granderrota.com/Herramientas/Doma/index.php";

        let compartido = null;
        let aviso = "";
        const contextoCompartir = {
            URL,
            location:{ href:"https://otro.example/previsualizacion.html?x=1#p" },
            document:{ querySelector:() => ({ href:canonical }) },
            navigator:{ share:async datos => { compartido = datos; } },
            DOMA:{ avisar:texto => { aviso = texto; } },
            DOMA_ERRORES:{ registrar(){ throw new Error("No debía registrar un error"); } },
            isSecureContext:true
        };
        contextoCompartir.window = contextoCompartir;
        vm.createContext(contextoCompartir);
        vm.runInContext(funciones, contextoCompartir);
        await contextoCompartir.compartirAplicacion();
        assert.equal(compartido.url, canonical);
        assert.match(compartido.text, /consejos de clase/);
        assert.equal(aviso, "Enlace compartido");

        let copiado = "";
        aviso = "";
        const contextoCopiar = {
            URL,
            location:{ href:"https://otro.example/index.php?x=1#p" },
            document:{ querySelector:() => ({ href:canonical }) },
            navigator:{ clipboard:{ writeText:async texto => { copiado = texto; } } },
            DOMA:{ avisar:texto => { aviso = texto; } },
            DOMA_ERRORES:{ registrar(){ throw new Error("No debía registrar un error"); } },
            isSecureContext:true
        };
        contextoCopiar.window = contextoCopiar;
        vm.createContext(contextoCopiar);
        vm.runInContext(funciones, contextoCopiar);
        await contextoCopiar.compartirAplicacion();
        assert.equal(copiado, canonical);
        assert.match(aviso, /Telegram/);
    });

    await probar("la presentación pública declara uso aficionado y límites razonables", () => {
        const manifiesto = JSON.parse(leer("manifest.webmanifest"));
        assert.match(manifiesto.description, /uso aficionado/i);
        assert.match(manifiesto.description, /instructor/i);
        assert.match(leer("AUTORIA_Y_USO.txt"), /ÁMBITO PREVISTO Y LÍMITES DE USO/);
        assert.match(leer("README.md"), /## Para quien recibe el enlace/);
        assert.match(leer("README.md"), /## Compartir y colaborar/);
        assert.match(leer("index.php"), /No sustituye la supervisión de un instructor/);
    });

    await probar("los controles estáticos y conmutadores exponen semántica accesible", () => {
        const html = leer("index.php");
        const botones = [...html.matchAll(/<button\b([^>]*)>/g)].map(entrada => entrada[1]);
        assert.equal(botones.every(atributos => /\btype="button"/.test(atributos)), true);
        for (const id of ["vistaLimpia", "modoVer", "modoAprender", "toggleLetras", "toggleCuadricula", "toggleRecorrido", "reproducir", "repetir"]) {
            assert.match(html, new RegExp(`<button[^>]*id="${id}"[^>]*aria-pressed="(?:true|false)"`));
        }
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(aplicacion, /function reflejarConmutador/);
        assert.match(aplicacion, /aria-current", "step"/);
        assert.match(aplicacion, /aria-pressed/);
        assert.match(aplicacion, /function reflejarVistaLimpia/);
        assert.match(html, /id="cursorTiempo"[^>]*aria-label=/);
        assert.match(html, /id="barraColocacionFijo"[^>]*aria-live="polite"/);
        assert.match(leer("assets/estilos.css"), /:focus-visible/);
    });

    await probar("el Sol nace recolocable y conserva coordenadas exteriores válidas", () => {
        const modelo = contextoModelo().DOMA;
        const sol = modelo.crearElementoFijo("sol");
        assert.equal(sol.bloqueado, false);
        assert.ok(sol.xNorm > 1 || sol.yNorm > 1);
        const proyecto = modelo.normalizarProyecto({
            nombre:"Sol exterior",
            elementosFijos:[{ tipo:"sol", xNorm:-.25, yNorm:1.10, bloqueado:false }]
        });
        assert.equal(proyecto.elementosFijos[0].xNorm, -.25);
        assert.equal(proyecto.elementosFijos[0].yNorm, 1.10);
    });

    await probar("la colocación por toque distingue elementos interiores y exteriores", () => {
        const pista = leer("assets/pista.js");
        const editor = leer("assets/editor.js");
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(pista, /function normalizarPuntoColocacion\(pista, punto, admiteExterior\)/);
        assert.match(pista, /xMin:-\.30 \* pista\.ancho/);
        assert.match(pista, /yMax:1\.12 \* pista\.largo/);
        assert.match(pista, /\["sol", "jurado"\]\.includes\(opciones\.tipoElementoColocando\)/);
        assert.match(editor, /tipoElementoColocando:colocandoElementoFijo/);
        assert.match(editor, /Tocar pista o margen para colocar/);
        assert.match(aplicacion, /tipoElementoColocando:fijos\.tipoElementoColocando/);
    });


    await probar("Aprende reutiliza ayuda sin cambiar el esquema de proyecto", () => {
        const html = leer("index.php");
        const modelo = contextoModelo().DOMA;
        assert.match(html, /data-pestana="aprende"/);
        assert.match(html, /id="panelAprende"/);
        assert.match(html, /id="editAyuda"/);
        assert.match(leer("assets/modelo.js"), /const VERSION_PROYECTO = 7;/);
        const nuevo = modelo.nuevaDefinicion("linea", { x:10, y:0 }, { preset:"oficial_60" });
        assert.equal(nuevo.ayuda, "");
    });

    await probar("Proyecto superior abre el panel real y no conserva el menú desplegable roto", () => {
        const html = leer("index.php");
        const app = leer("assets/aplicacion.js");
        assert.match(html, /id="abrirProyectoSuperior"/);
        assert.equal(html.includes('class="menu-proyecto"'), false);
        assert.equal(html.includes('class="menu-flotante"'), false);
        assert.match(app, /\$\("abrirProyectoSuperior"\)\.addEventListener\("click"/);
        assert.match(app, /activarPestana\("proyecto"\)/);
        assert.match(html, /id="importarProyecto"/);
        assert.match(html, /id="restaurarProyecto"/);
        assert.match(html, /id="pantallaCompleta"/);
    });

    await probar("el resumen imprimible es A4 estable y no envía datos", () => {
        const html = leer("index.php");
        const app = leer("assets/aplicacion.js");
        const css = leer("assets/estilos.css");
        assert.match(html, /id="imprimirDesdePanel"/);
        assert.match(html, /id="resumenImpresion"/);
        assert.match(html, /class="impresion-hoja impresion-portada"/);
        assert.match(html, /id="impresionPista"/);
        assert.match(html, /id="impresionMovimientos"/);
        assert.match(app, /PISTA\.render\(\$\("impresionPista"\)/);
        assert.match(app, /mostrarCaballo:false/);
        assert.match(app, /window\.print\(\)/);
        const bloqueImpresion = app.match(/function prepararResumenImpresion\(\) \{[\s\S]*?\n\}/)?.[0] || "";
        assert.equal(bloqueImpresion.includes("fetch("), false);
        const cssImpresion = css.slice(css.indexOf("@media print"));
        assert.match(cssImpresion, /@page\{size:A4 portrait;margin:12mm\}/);
        assert.match(cssImpresion, /width:186mm/);
        assert.match(cssImpresion, /\.impresion-movimientos\{[\s\S]*?display:block/);
        assert.equal(/\b(?:vw|vh|svh|dvh)\b/.test(cssImpresion), false);
    });

    await probar("la pista puede omitir el caballo animado y evita ids SVG duplicados", () => {
        const pista = leer("assets/pista.js");
        assert.match(pista, /opciones\.mostrarCaballo !== false/);
        assert.match(pista, /if \(mostrarCaballo\) svg\.append\(grupo\)/);
        assert.match(pista, /recortePista-\$\{idBase\}/);
        assert.match(pista, /fa-\$\{idBase\}/);
        assert.match(pista, /fc-\$\{idBase\}/);
    });

    await probar("la reproducción mantiene una sola cadena requestAnimationFrame", () => {
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(aplicacion, /let fotogramaReproduccion = 0/);
        assert.match(aplicacion, /function cancelarFotogramaReproduccion\(\)/);
        assert.match(aplicacion, /cancelAnimationFrame\(fotogramaReproduccion\)/);
        assert.match(aplicacion, /function solicitarFotogramaReproduccion\(\)/);
        assert.match(aplicacion, /if \(!reproduciendo \|\| fotogramaReproduccion\) return/);
        assert.equal((aplicacion.match(/requestAnimationFrame\(ciclo\)/g) || []).length, 1);
    });

    await probar("la orientación cardinal no altera la plantilla de letras", () => {
        const modelo = contextoModelo().DOMA;
        const norte = modelo.normalizarProyecto({ pista:{ preset:"oficial_60" }, ambiente:{ orientacion:"N" } });
        const sur = modelo.normalizarProyecto({ pista:{ preset:"oficial_60" }, ambiente:{ orientacion:"S" } });
        assert.deepEqual(
            JSON.parse(JSON.stringify(modelo.obtenerReferencias(norte.pista))),
            JSON.parse(JSON.stringify(modelo.obtenerReferencias(sur.pista)))
        );
        assert.match(leer("index.php"), /Las letras conservan siempre su posición reglada respecto de A y C/);
    });

    await probar("Vista limpia cambia su acción y entrega todo el espacio a la pista", () => {
        const html = leer("index.php");
        const aplicacion = leer("assets/aplicacion.js");
        const css = leer("assets/estilos.css");
        assert.match(html, /id="vistaLimpia"[^>]*aria-label="Activar vista limpia"/);
        assert.match(aplicacion, /boton\.textContent = activa \? "Mostrar paneles" : "Vista limpia"/);
        assert.match(aplicacion, /boton\.setAttribute\("aria-label", activa \? "Mostrar paneles" : "Activar vista limpia"\)/);
        assert.match(css, /body\[data-layout="amplio"\]\.vista-limpia \.room,[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
        assert.match(css, /body\[data-layout="medio"\]\.vista-limpia \.barra-room\{[\s\S]*?display:none/);
        assert.match(css, /body\[data-layout="amplio"\]\.vista-limpia \.escenario,[\s\S]*?grid-template-rows:minmax\(0,1fr\)/);
        assert.match(css, /body\[data-layout="medio"\]\.vista-limpia \.rail-movimientos,[\s\S]*?display:none/);

        const funcion = aplicacion.match(/function reflejarVistaLimpia\(\) \{[\s\S]*?\n\}/)?.[0];
        assert.ok(funcion, "No se encontró reflejarVistaLimpia");
        const boton = {
            atributos:{},
            textContent:"",
            title:"",
            setAttribute(nombre, valor) { this.atributos[nombre] = valor; }
        };
        const clases = new Set();
        const contexto = {
            document:{ body:{ classList:{ contains:nombre => clases.has(nombre) } } },
            $:() => boton
        };
        vm.createContext(contexto);
        vm.runInContext(`${funcion}; reflejarVistaLimpia();`, contexto);
        assert.equal(boton.textContent, "Vista limpia");
        assert.equal(boton.atributos["aria-pressed"], "false");
        clases.add("vista-limpia");
        vm.runInContext("reflejarVistaLimpia();", contexto);
        assert.equal(boton.textContent, "Mostrar paneles");
        assert.equal(boton.atributos["aria-pressed"], "true");
    });

    await probar("la última señal de cada paleta no puede eliminarse", () => {
        const editor = leer("assets/editor.js");
        assert.match(editor, /borrar\.disabled = proyecto\(\)\.senales\[tipo\]\.length <= 1/);
        assert.match(editor, /if \(!senal \|\| lista\.length <= 1\) return/);
        assert.match(editor, /listaCandidata\.length <= 1/);
        const { DOMA } = contextoModelo();
        const proyecto = DOMA.normalizarProyecto({ senales:{ caballo:[], jinete:[] }, definiciones:[] });
        assert.ok(proyecto.senales.caballo.length >= 1);
        assert.ok(proyecto.senales.jinete.length >= 1);
    });

    await probar("las listas dinámicas se editan y eliminan mediante ids estables", () => {
        const editor = leer("assets/editor.js");
        assert.match(editor, /const idMovimiento = movimiento\.id/);
        assert.match(editor, /const idEfecto = efecto\.id/);
        assert.match(editor, /\.find\(entrada => entrada\.id === idEfecto\)/);
        assert.match(editor, /\.filter\(entrada => entrada\.id !== idEfecto\)/);
        assert.match(editor, /const idSenal = senal\.id/);
        assert.match(editor, /eliminarSenal\(tipo, idSenal\)/);
        assert.match(editor, /const idMovimiento = movimiento\.id/);
        assert.match(editor, /candidato\.definiciones = candidato\.definiciones\.filter\(entrada => entrada\.id !== idMovimiento\)/);
        assert.equal(editor.includes("efectos[posicion]"), false);
        assert.equal(editor.includes("senales[tipo][posicion]"), false);
    });

    await probar("los borrados y recolocaciones destructivos tienen protecciones coherentes", () => {
        const editor = leer("assets/editor.js");
        assert.match(editor, /function permitirAccionBreve\(/);
        assert.match(editor, /permitirAccionBreve\("eliminar-efecto"\)/);
        assert.match(editor, /async function eliminarSenal/);
        assert.match(editor, /titulo:"Eliminar señal"/);
        assert.match(editor, /contarReferenciasSenal/);
        assert.match(editor, /POSICIONES_EXTERIORES/);
        assert.match(editor, /Este tipo de elemento debe permanecer dentro de la pista/);
        assert.match(editor, /selectorPosicion\.disabled = seleccionado\.bloqueado/);
        assert.equal((editor.match(/nodo\.replaceChildren\(\);/g) || []).length, 1);
        assert.equal((editor.match(/\$\{seleccionado\.nombre\} colocado/g) || []).length, 1);
    });

    await probar("la interfaz contiene limites operativos contra pulsaciones accidentales", () => {
        const editor = leer("assets/editor.js");
        assert.match(editor, /const LIMITES_EDICION = Object\.freeze\(\{/);
        assert.match(editor, /movimientos:\s*120/);
        assert.match(editor, /efectosPorMovimiento:\s*40/);
        assert.match(editor, /senalesPorPaleta:\s*40/);
        assert.match(editor, /elementosFijos:\s*48/);
        assert.match(editor, /function comprobarLimite\(/);
        assert.match(editor, /function normalizarControlNumerico\(/);
        assert.match(editor, /function nombreDisponibleElementoFijo\(/);
        assert.match(editor, /nombre:nombreDisponibleElementoFijo\(tipo\.nombre\)/);
        assert.match(editor, /programarFormulario\(evento\)/);
        assert.match(editor, /normalizarControlNumerico\(evento\?\.currentTarget\)/);
        assert.match(leer("README.md"), /Los proyectos importados no se recortan por estos límites/);
    });

    await probar("los atajos globales no actuan detrás de dialogos o errores", () => {
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(aplicacion, /document\.querySelector\("dialog\[open\], #panelErrorGlobal:not\(\.oculto\)"\)/);
        assert.match(aplicacion, /if \(interfazBloqueada \|\| escribiendo\) return/);
        assert.match(aplicacion, /Los demas dialogos gestionan Escape/);
    });

    await probar("las protecciones predictivas no alteran el esquema ni silencian fallos", () => {
        const modelo = leer("assets/modelo.js");
        const estado = leer("assets/estado.js");
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(modelo, /const PRESUPUESTO_PROYECTO = Object\.freeze/);
        assert.match(modelo, /caracteresTexto:\s*1500000/);
        assert.match(estado, /MAX_BYTES_HISTORIAL = 8 \* 1024 \* 1024/);
        assert.match(estado, /CLAVE_CONFLICTO/);
        assert.match(estado, /window\.addEventListener\("storage"/);
        assert.match(aplicacion, /El resumen supera 180 movimientos/);
        assert.match(aplicacion, /La actualización se ha pospuesto/);
        assert.equal(/catch\s*\(.*\)\s*\{\s*\}/.test(estado), false);
    });

    await probar("las fronteras de estado rechazan corrupcion sin escapar del sistema de errores", () => {
        const { contexto, registros } = contextoEstado();
        contexto.DOMA_ESTADO.cargar();
        const anterior = contexto.DOMA_ESTADO.estado.proyecto;
        const circular = {};
        circular.autorreferencia = circular;
        contexto.DOMA_ESTADO.estado.proyecto = circular;
        assert.equal(contexto.DOMA_ESTADO.guardarAhora(false), false);
        assert.ok(registros.some(registro => /circular/i.test(String(registro.error?.message || registro.error || ""))));
        contexto.DOMA_ESTADO.estado.proyecto = anterior;

        const profundo = {};
        let cursor = profundo;
        for (let i = 0; i < 60; i++) cursor = cursor.siguiente = {};
        assert.throws(() => contexto.DOMA_ESTADO.sustituirProyecto(profundo, "entrada patologica"), /profundidad/i);
        assert.equal(contexto.DOMA_ESTADO.estado.proyecto, anterior);
    });

    await probar("audio y actualizacion PWA registran fallos sin capturas vacias", () => {
        const aplicacion = leer("assets/aplicacion.js");
        assert.match(aplicacion, /function registrarAvisoEspaciado/);
        assert.match(aplicacion, /sincronizacion del audio local/);
        assert.match(aplicacion, /actualizacion periodica de la PWA/);
        assert.equal(/catch\s*\([^)]*\)\s*\{\s*\}/.test(aplicacion), false);
        assert.equal(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/.test(aplicacion), false);
    });

    await probar("la entrega sigue siendo version funcional 0 y esquema 7", () => {
        assert.match(leer("README.md"), /\*\*Estado funcional:\*\* versión 0/);
        assert.match(leer("assets/modelo.js"), /const VERSION_PROYECTO = 7;/);
        assert.equal(leer("manifest.webmanifest").includes('"name": "Doma Visual"'), true);
        assert.equal(leer("README.md").includes("versión 1"), false);
    });

    await probar("previsualizacion.html reproduce exactamente CSS y módulos JavaScript", () => {
        const previo = leer("previsualizacion.html");
        assert.equal(previo.includes(`<style>\n${leer("assets/estilos.css")}\n</style>`), true);
        for (const ruta of javascript.filter(ruta => ruta.startsWith("assets/"))) {
            assert.equal(previo.includes(`<script>\n${leer(ruta)}\n</script>`), true, `No coincide ${ruta}`);
        }
    });

    await probar("los 26 archivos públicos canónicos están presentes sin secretos", () => {
        const archivos = [
            ".doma-acceso.example.php", ".gitignore", ".htaccess", "AUTORIA_Y_USO.txt",
            "LEEME_PRIMERO.txt", "LICENSE", "LISTA_ARCHIVOS.txt", "README.md",
            "assets/aplicacion.js", "assets/editor.js", "assets/emojis.js", "assets/errores.js",
            "assets/estado.js", "assets/estilos.css", "assets/layout.js", "assets/modelo.js",
            "assets/pista.js", "comprobar.php", "icons/icono-app-192.png", "icons/icono-app-512.png",
            "index.php", "manifest.webmanifest", "offline.html", "previsualizacion.html",
            "service-worker.js", "tests/comprobar_proyecto.js"
        ];
        archivos.forEach(ruta => assert.equal(existe(ruta), true, `Falta ${ruta}`));
        const reales = [];
        function recorrer(directorio, prefijo = "") {
            for (const entrada of fs.readdirSync(directorio, { withFileTypes:true })) {
                if (entrada.name === ".git") continue;
                const relativo = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
                if (entrada.isDirectory()) recorrer(path.join(directorio, entrada.name), relativo);
                else reales.push(relativo);
            }
        }
        recorrer(raiz);
        assert.deepEqual(reales.sort(), archivos.sort());
    });

    console.log(`\n${pruebas} pruebas superadas.`);
}

principal().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
