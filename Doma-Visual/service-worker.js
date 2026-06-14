/*
Doma Visual · Versión 0
Módulo: caché offline y activación controlada de actualizaciones.
Dependencias: index, diagnóstico, manifiesto, página offline y recursos estáticos.

Estrategia:
- El shell versionado se precarga durante install.
- Las navegaciones usan red primero y respaldo específico por solicitud.
- comprobar.php se consulta solo por red y nunca se almacena.
- Los recursos estáticos usan caché primero con actualización en segundo plano.
- VERSION y las consultas ?v= deben cambiar de forma coordinada.
*/
"use strict";

const VERSION = "doma-visual-pwa-0-icono-app";
const CACHE_APP = `${VERSION}-app`;
const CACHE_RUNTIME = `${VERSION}-runtime`;
const ARCHIVOS_BASE = [
    "./",
    "./index.php",
    "./offline.html",
    "./manifest.webmanifest?v=0-icono-app",
    "./LICENSE",
    "./AUTORIA_Y_USO.txt",
    "./assets/estilos.css?v=0-icono-app",
    "./assets/errores.js?v=0-icono-app",
    "./assets/modelo.js?v=0-icono-app",
    "./assets/estado.js?v=0-icono-app",
    "./assets/layout.js?v=0-icono-app",
    "./assets/emojis.js?v=0-icono-app",
    "./assets/pista.js?v=0-icono-app",
    "./assets/editor.js?v=0-icono-app",
    "./assets/aplicacion.js?v=0-icono-app",
    "./icons/icono-app-192.png?v=0-icono-app",
    "./icons/icono-app-512.png?v=0-icono-app"
];

function urlAbsoluta(ruta) {
    return new URL(ruta, self.registration.scope).href;
}

async function precargar() {
    const cache = await caches.open(CACHE_APP);
    await cache.addAll(ARCHIVOS_BASE.map(urlAbsoluta));
}

self.addEventListener("install", evento => {
    evento.waitUntil(precargar());
});

self.addEventListener("activate", evento => {
    evento.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(
            nombres
                .filter(nombre => nombre.startsWith("doma-visual-") && ![CACHE_APP, CACHE_RUNTIME].includes(nombre))
                .map(nombre => caches.delete(nombre))
        );
        await self.clients.claim();
    })());
});

async function fetchConLimite(solicitud, opciones = {}, milisegundos = 4500) {
    if (!("AbortController" in self)) return fetch(solicitud, opciones);
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), milisegundos);
    try {
        return await fetch(solicitud, { ...opciones, signal:controlador.signal });
    } catch (error) {
        if (controlador.signal.aborted) throw new Error("Tiempo de red agotado");
        throw error;
    } finally {
        clearTimeout(temporizador);
    }
}

async function diagnosticoSoloRed(solicitud) {
    try {
        return await fetchConLimite(solicitud, { cache:"no-store" }, 4500);
    } catch (_) {
        return new Response("El diagnóstico protegido requiere conexión.", {
            status:503,
            headers:{ "Content-Type":"text/plain; charset=UTF-8", "Cache-Control":"no-store" }
        });
    }
}

async function navegacionConRespaldo(solicitud) {
    const url = new URL(solicitud.url);
    const esEntradaAplicacion = /\/(?:index\.php)?$/.test(url.pathname);
    try {
        const respuesta = await fetchConLimite(solicitud, {}, 4500);
        if (!respuesta || !respuesta.ok) {
            throw new Error(`Respuesta de navegación no válida: ${respuesta?.status || "sin estado"}`);
        }
        const cache = await caches.open(CACHE_RUNTIME);
        // Un fallo de cuota de caché no debe convertir una respuesta de red válida en un
        // falso estado offline. La navegación se devuelve aunque no pueda almacenarse.
        try {
            await cache.put(solicitud, respuesta.clone());
        } catch (error) {
            console.warn("No se pudo actualizar la caché de navegación", error);
        }
        return respuesta;
    } catch (_) {
        const runtime = await caches.open(CACHE_RUNTIME);
        const especifica = await runtime.match(solicitud, { ignoreSearch:true })
            || await caches.match(solicitud, { ignoreSearch:true });
        if (especifica) return especifica;
        if (esEntradaAplicacion) {
            return await caches.match(urlAbsoluta("./index.php"))
                || await caches.match(urlAbsoluta("./offline.html"));
        }
        return await caches.match(urlAbsoluta("./offline.html"));
    }
}

async function recursoConActualizacion(solicitud) {
    const cache = await caches.open(CACHE_RUNTIME);
    const almacenada = await caches.match(solicitud);
    const red = fetch(solicitud).then(async respuesta => {
        if (respuesta && respuesta.ok && respuesta.type === "basic") {
            try {
                await cache.put(solicitud, respuesta.clone());
            } catch (error) {
                console.warn("No se pudo actualizar la caché de recurso", error);
            }
        }
        return respuesta;
    }).catch(() => null);
    return almacenada || await red || new Response("Recurso no disponible", { status: 503 });
}

self.addEventListener("fetch", evento => {
    const solicitud = evento.request;
    if (solicitud.method !== "GET") return;

    const url = new URL(solicitud.url);
    if (url.origin !== self.location.origin) return;

    if (solicitud.mode === "navigate") {
        if (/\/comprobar\.php$/.test(url.pathname)) {
            evento.respondWith(diagnosticoSoloRed(solicitud));
            return;
        }
        evento.respondWith(navegacionConRespaldo(solicitud));
        return;
    }

    evento.respondWith(recursoConActualizacion(solicitud));
});

self.addEventListener("message", evento => {
    if (evento.data?.tipo === "ACTIVAR_ACTUALIZACION") {
        self.skipWaiting();
    }
});
