<!--
Doma Visual · Versión 0
Parte: estructura HTML y puntos de anclaje accesibles.
La lógica reside en los módulos cargados al final, en este orden obligatorio:
errores → modelo → estado → layout → emojis → pista → editor → aplicación.

Cambiar un id exige actualizar sus consumidores y las pruebas del contrato DOM.
-->

<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#35634c">
<meta name="author" content="Mario Granderrota">
<meta name="description" content="Doma Visual permite dibujar recorridos de doma, guardar consejos de clase y repasar el entrenamiento. Gratuita, sin registro y con guardado en este dispositivo.">
<meta name="copyright" content="Copyright © Mario Granderrota">
<link rel="canonical" href="https://www.granderrota.com/Herramientas/Doma/index.php">
<link rel="license" href="LICENSE">
<meta property="og:locale" content="es_ES">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Doma Visual">
<meta property="og:title" content="Doma Visual 🐎 · Recorridos y consejos de clase">
<meta property="og:description" content="Dibuja recorridos de doma, guarda consejos de clase y repasa el entrenamiento. Sin registro y con guardado en tu dispositivo.">
<meta property="og:url" content="https://www.granderrota.com/Herramientas/Doma/index.php">
<meta property="og:image" content="https://www.granderrota.com/Herramientas/Doma/icons/icono-app-512.png?v=0-icono-app">
<meta property="og:image:secure_url" content="https://www.granderrota.com/Herramientas/Doma/icons/icono-app-512.png?v=0-icono-app">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="Icono verde de Doma Visual con la cabeza estilizada de un caballo">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Doma Visual 🐎 · Recorridos y consejos de clase">
<meta name="twitter:description" content="Dibuja recorridos de doma, guarda consejos de clase y repasa el entrenamiento.">
<meta name="twitter:image" content="https://www.granderrota.com/Herramientas/Doma/icons/icono-app-512.png?v=0-icono-app">
<meta name="color-scheme" content="light">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Doma Visual">
<link rel="manifest" href="manifest.webmanifest?v=0-icono-app">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icono-app-192.png?v=0-icono-app">
<link rel="apple-touch-icon" href="icons/icono-app-192.png?v=0-icono-app">
<title>Doma Visual · Recorridos y recordatorios ecuestres</title>
<link rel="stylesheet" href="assets/estilos.css?v=0-icono-app">
</head>
<body>
<div id="aplicacion" class="aplicacion">
    <header class="cabecera">
        <a class="marca" href="index.php" aria-label="Doma Visual">
            <img class="marca-icono" src="icons/icono-app-192.png?v=0-icono-app" alt="" width="40" height="40">
            <span class="marca-texto">
                <strong>Doma Visual</strong>
                <small>Recorridos y recordatorios</small>
            </span>
        </a>

        <div class="proyecto-cabecera">
            <label class="edicion-nombre-proyecto" title="El nombre se puede editar">
                <span>Proyecto:</span>
                <input id="nombreProyecto" class="nombre-proyecto" value="Entrenamiento divertido" maxlength="70" aria-label="Nombre del proyecto">
            </label>
            <span id="estadoProyecto" class="estado-proyecto" role="status" aria-live="polite" aria-atomic="true">Guardado aquí</span>
            <span id="estadoConexion" class="estado-conexion oculto" role="status" aria-live="polite" aria-atomic="true">Sin conexión</span>
        </div>

        <div class="acciones-cabecera">
            <button type="button" id="instalarPwa" class="boton-cabecera instalar-pwa oculto" title="Instalar Doma Visual en este dispositivo">Instalar</button>
            <button type="button" id="vistaLimpia" class="boton-cabecera" aria-pressed="false" aria-label="Activar vista limpia" title="Ocultar paneles y ampliar realmente la pista">Vista limpia</button>
            <button type="button" id="abrirEdicion" class="boton-cabecera principal" aria-keyshortcuts="E">Editar</button>
            <button type="button" id="abrirProyectoSuperior" class="boton-cabecera proyecto-superior" title="Abrir la configuración y los archivos del proyecto">Proyecto</button>
        </div>
    </header>

    <main class="room">
        <aside id="railMovimientos" class="rail-movimientos" aria-label="Movimientos de la prueba">
            <div class="rail-cabecera">
                <div>
                    <strong>Prueba</strong>
                    <small id="resumenPrueba">0 movimientos</small>
                </div>
                <button type="button" id="anadirRapido" class="boton-redondo" title="Añadir un movimiento">＋</button>
            </div>
            <div id="listaMovimientos" class="lista-movimientos"></div>
        </aside>

        <section class="escenario">
            <div class="barra-room">
                <div class="modo-room">
                    <button type="button" id="modoVer" class="chip activo" aria-pressed="true">Ver</button>
                    <button type="button" id="modoAprender" class="chip" aria-pressed="false">Aprende</button>
                </div>
                <div id="estadoPista" class="estado-pista">
                    <span id="medidasPista" class="medidas-pista">20 × 60 m · proporción 1:3</span>
                    <span id="orientacionPista" class="orientacion-pista">C hacia N</span>
                </div>
                <div class="opciones-room">
                    <button type="button" id="toggleLetras" class="chip activo" aria-pressed="true" title="Mostrar u ocultar letras">Letras</button>
                    <button type="button" id="toggleCuadricula" class="chip activo" aria-pressed="true" title="Mostrar u ocultar cuadrícula">Cuadrícula</button>
                    <button type="button" id="toggleRecorrido" class="chip activo" aria-pressed="true" title="Mostrar u ocultar recorridos">Recorrido</button>
                </div>
            </div>

            <div id="barraColocacionFijo" class="barra-colocacion-fijo oculto" role="status" aria-live="polite" aria-atomic="true">
                <span>📍 Toca un punto dentro de la pista para colocar el elemento.</span>
                <button id="cancelarColocacionFijo" type="button">Cancelar</button>
            </div>

            <div class="zona-pista">
                <!--
                La información de ejecución vive fuera del lienzo SVG para no tapar letras,
                trayectorias ni elementos fijos. CSS coloca este HUD encima de la pista en
                vistas apaisadas y a su izquierda en el teléfono sostenido en vertical.
                -->
                <div class="hud-pista" aria-label="Información del movimiento actual">
                    <article class="tarjeta-actual">
                        <span id="numeroActual" class="numero-actual">1</span>
                        <div>
                            <small>AHORA</small>
                            <strong id="tituloActual">—</strong>
                            <span id="rutaActual">—</span>
                            <div id="senalesActuales" class="senales-actuales">
                                <span id="senalCaballoActual" class="senal-chip">Caballo: normal</span>
                                <span id="senalJineteActual" class="senal-chip">Tú: posición neutra</span>
                            </div>
                        </div>
                    </article>

                    <article id="tarjetaAprender" class="tarjeta-aprender">
                        <small>RECUERDA</small>
                        <strong id="ayudaActual">—</strong>
                    </article>

                    <div class="leyenda-room" aria-label="Leyenda de las líneas de la pista">
                        <span><i class="muestra avance"></i>Avance</span>
                        <span><i class="muestra cuerpo"></i>Orientación</span>
                    </div>
                </div>

                <div id="marcoPista" class="marco-pista">
                    <div id="lienzoPista" class="lienzo-pista"></div>
                </div>
            </div>
        </section>

        <aside id="cajonEdicion" class="cajon-edicion" aria-label="Edición de la prueba">
            <header class="cajon-cabecera">
                <div>
                    <strong id="tituloEdicion">Editar movimiento</strong>
                    <small id="subtituloEdicion">Los cambios se guardan automáticamente</small>
                </div>
                <div class="acciones-cajon">
                    <button type="button" id="deshacer" aria-keyshortcuts="Control+Z Meta+Z" class="boton-redondo" title="Deshacer último cambio" aria-label="Deshacer" disabled>↶</button>
                    <button type="button" id="rehacer" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" class="boton-redondo" title="Rehacer cambio" aria-label="Rehacer" disabled>↷</button>
                    <button type="button" id="cerrarEdicion" class="boton-redondo" title="Cerrar edición" aria-label="Cerrar edición">×</button>
                </div>
            </header>

            <nav class="pestanas-edicion">
                <button type="button" class="pestana activa" data-pestana="movimiento">Movimiento</button>
                <button type="button" class="pestana" data-pestana="aprende">Aprende</button>
                <button type="button" class="pestana" data-pestana="senales">Señales</button>
                <button type="button" class="pestana" data-pestana="fijos">Fijos 🚧</button>
                <button type="button" class="pestana" data-pestana="musica">Música</button>
                <button type="button" class="pestana" data-pestana="proyecto">Proyecto</button>
            </nav>

            <div class="cajon-scroll">
                <section id="panelMovimiento" class="panel-pestana activo">
                    <div class="acciones-movimiento">
                        <button type="button" id="moverAnterior" title="Mover antes">↑ Antes</button>
                        <button type="button" id="moverSiguiente" title="Mover después">↓ Después</button>
                        <button type="button" id="duplicarMovimiento">Duplicar</button>
                        <button type="button" id="eliminarMovimiento" class="peligro">Eliminar</button>
                    </div>

                    <div class="dato-bloqueado">
                        <span>Comienza en</span>
                        <strong id="inicioMovimiento">—</strong>
                    </div>

                    <label>Título
                        <input id="editTitulo" type="text" maxlength="80">
                    </label>

                    <div class="dos-columnas">
                        <label>Figura
                            <select id="editTipo"></select>
                        </label>
                        <label>Termina en
                            <select id="editDestino"></select>
                        </label>
                    </div>

                    <div id="opcionesCirculo" class="dos-columnas oculto">
                        <label>Radio
                            <input id="editRadio" type="number" min="4" max="12" step="1">
                        </label>
                        <label>Mano
                            <select id="editMano">
                                <option value="derecha">Derecha</option>
                                <option value="izquierda">Izquierda</option>
                            </select>
                        </label>
                    </div>

                    <div class="dos-columnas">
                        <label>Duración
                            <input id="editDuracion" type="number" min="1" max="180" step=".5">
                        </label>
                        <label>Orientación
                            <select id="editOrientacion">
                                <option value="0">Sigue la trayectoria</option>
                                <option value="-22">22° a la izquierda</option>
                                <option value="22">22° a la derecha</option>
                                <option value="180">Contraria al avance</option>
                            </select>
                        </label>
                    </div>

                    <div class="dos-columnas">
                        <label>Señal base del caballo
                            <select id="editSenalCaballo"></select>
                        </label>
                        <label>Señal base de quien monta
                            <select id="editSenalJinete"></select>
                        </label>
                    </div>

                    <div class="bloque-edicion bloque-efectos">
                        <div class="cabecera-bloque">
                            <div>
                                <h3>Puntos de efecto</h3>
                                <p>Cambios breves dentro de este movimiento.</p>
                            </div>
                            <button id="anadirEfecto" type="button" class="boton-redondo pequeno">＋</button>
                        </div>
                        <div id="listaEfectos" class="lista-efectos"></div>
                    </div>

                    <label>Indicación breve
                        <textarea id="editComentario" rows="3" maxlength="220"></textarea>
                    </label>


                    <div id="estadoAutoedicion" class="estado-autoedicion correcto">
                        Guardado automático activo
                    </div>

                    <div class="separador"><span>Añadir después</span></div>
                    <div id="paletaRapida" class="paleta-rapida"></div>
                </section>

                <section id="panelAprende" class="panel-pestana">
                    <div class="bloque-edicion bloque-aprende">
                        <h3>💡 Consejo de la profesora</h3>
                        <p>Este recordatorio pertenece al movimiento seleccionado. Aparece al repasar y también en el resumen impreso.</p>
                        <label>Recordatorio breve
                            <textarea id="editAyuda" rows="5" maxlength="220" placeholder="Ejemplo: A, X y C: una sola línea."></textarea>
                        </label>
                        <p class="nota-corta">Escribe una frase breve recibida en clase. Doma Visual la conserva como memoria del entrenamiento, pero no comprueba su corrección técnica.</p>
                    </div>

                    <div class="bloque-edicion">
                        <h3>Cómo se relaciona</h3>
                        <p>El consejo se asocia al movimiento completo. Los colores, emojis y destellos siguen gestionándose en Señales y Puntos de efecto para no mezclar el contenido pedagógico con su representación visual.</p>
                    </div>
                </section>

                <section id="panelSenales" class="panel-pestana">
                    <div class="bloque-edicion">
                        <h3>🐎 Paleta del caballo</h3>
                        <p>El color puede representar ritmo, cruce de patas, transición u otra clave familiar.</p>
                        <div id="paletaCaballo" class="editor-paleta"></div>
                        <button id="anadirColorCaballo" type="button" class="boton-secundario ancho">Añadir color del caballo</button>
                    </div>

                    <div class="bloque-edicion">
                        <h3>🧍 Paleta de quien monta</h3>
                        <p>El color y el emoji pueden recordar manos, piernas, tronco, mirada u otra acción.</p>
                        <div id="paletaJinete" class="editor-paleta"></div>
                        <button id="anadirColorJinete" type="button" class="boton-secundario ancho">Añadir color de quien monta</button>
                    </div>

                    <div class="nota-senales">
                        Los colores son ayudas propias del entrenamiento. No representan una valoración oficial.
                    </div>
                </section>


                <section id="panelFijos" class="panel-pestana">
                    <div class="bloque-edicion">
                        <h3>📍 Elementos fijos de la pista</h3>
                        <p>Añade referencias permanentes para este entrenamiento. En el modo normal no funcionan como botones y no interfieren con la reproducción.</p>
                        <div id="paletaElementosFijos" class="paleta-elementos-fijos"></div>
                    </div>

                    <div class="bloque-edicion">
                        <div class="cabecera-bloque">
                            <div>
                                <h3>Elementos colocados</h3>
                                <p>Selecciona uno para editarlo o recolocarlo.</p>
                            </div>
                            <span id="contadorElementosFijos" class="contador">0</span>
                        </div>
                        <div id="listaElementosFijos" class="lista-elementos-fijos"></div>
                    </div>

                    <div id="sinElementoFijo" class="nota-senales">
                        Añade o selecciona un elemento fijo para editarlo.
                    </div>

                    <div id="editorElementoFijo" class="bloque-edicion oculto">
                        <h3 id="tituloElementoFijo">Editar elemento</h3>

                        <label>Nombre
                            <input id="elementoFijoNombre" type="text" maxlength="80">
                        </label>

                        <label>Emoji o secuencia visual
                            <input id="elementoFijoEmoji" data-emoji-input type="text" autocomplete="off">
                        </label>

                        <div class="dos-columnas">
                            <label class="opcion-check">
                                <input id="elementoFijoVisible" type="checkbox">
                                Visible
                            </label>
                            <label class="opcion-check">
                                <input id="elementoFijoBloqueado" type="checkbox">
                                Bloquear posición
                            </label>
                        </div>

                        <label>Tamaño: <strong id="valorTamanoElemento">1,00×</strong>
                            <input id="elementoFijoTamano" type="range" min="0.5" max="2.5" step="0.05">
                        </label>

                        <label>Giro, grados
                            <input id="elementoFijoRotacion" type="number" min="-180" max="180" step="5">
                        </label>

                        <label>Posición rápida
                            <select id="elementoFijoPosicionRapida">
                                <option value="centro">Centro de la pista</option>
                                <option value="c_exterior">Exterior de C</option>
                                <option value="a_exterior">Exterior de A</option>
                                <option value="izquierda_alta">Lado izquierdo, zona de C</option>
                                <option value="izquierda_baja">Lado izquierdo, zona de A</option>
                                <option value="derecha_alta">Lado derecho, zona de C</option>
                                <option value="derecha_baja">Lado derecho, zona de A</option>
                                <option value="c_izquierda">Fuera de C, izquierda</option>
                                <option value="c_derecha">Fuera de C, derecha</option>
                                <option value="a_izquierda">Fuera de A, izquierda</option>
                                <option value="a_derecha">Fuera de A, derecha</option>
                            </select>
                        </label>

                        <div class="acciones-elemento-fijo">
                            <button id="aplicarPosicionRapida" type="button" class="boton-secundario">Aplicar posición</button>
                            <button id="colocarElementoPista" type="button" class="boton-principal">Tocar pista para colocar</button>
                        </div>

                        <div id="estadoColocacionFijo" class="estado-colocacion-fijo">
                            Selecciona «Tocar pista para colocar» y después toca el punto deseado.
                        </div>

                        <button id="eliminarElementoFijo" type="button" class="boton-secundario peligro ancho">Eliminar elemento</button>
                    </div>
                </section>

                <section id="panelMusica" class="panel-pestana">
                    <div class="bloque-edicion">
                        <h3>🎵 Audio local sincronizado</h3>
                        <p>Selecciona un archivo de este teléfono u ordenador. La aplicación admite únicamente audio local para que la música pueda sonar mientras se observa la pista.</p>

                        <label>Título de la música
                            <input id="musicaTitulo" type="text" maxlength="80" placeholder="Nombre de la canción">
                        </label>

                        <label>Archivo de audio de este dispositivo
                            <input id="musicaArchivo" type="file" accept="audio/*">
                        </label>

                        <div id="estadoArchivoMusica" class="estado-archivo-musica">Sin audio seleccionado en esta sesión.</div>

                        <div class="dos-columnas">
                            <label>Comienza en el segundo
                                <input id="musicaInicio" type="number" min="0" step=".1" value="0">
                            </label>
                            <label class="opcion-check">
                                <input id="musicaSincronizar" type="checkbox" checked>
                                Sincronizar con la prueba
                            </label>
                        </div>

                        <p class="nota-corta">Por seguridad, el navegador no puede reabrir automáticamente un archivo local después de cerrar la aplicación. El proyecto conserva su nombre, pero habrá que seleccionarlo de nuevo.</p>
                    </div>
                </section>

                <section id="panelProyecto" class="panel-pestana">
                    <label>Nombre del proyecto
                        <input id="proyectoNombre" type="text" maxlength="70">
                    </label>

                    <div class="bloque-edicion">
                        <h3>Orientación de la pista</h3>
                        <label>Punto cardinal hacia el que mira C
                            <select id="proyectoOrientacion">
                                <option value="N">Norte</option>
                                <option value="NE">Nordeste</option>
                                <option value="E">Este</option>
                                <option value="SE">Sudeste</option>
                                <option value="S">Sur</option>
                                <option value="SO">Sudoeste</option>
                                <option value="O">Oeste</option>
                                <option value="NO">Noroeste</option>
                            </select>
                        </label>
                        <p class="nota-corta">Las letras conservan siempre su posición reglada respecto de A y C. Este dato solo indica hacia qué punto cardinal mira el lado C; no gira las letras ni mueve automáticamente el Sol.</p>
                        <p class="nota-corta">El Sol se coloca manualmente desde <strong>Fijos 🚧</strong> y puede situarse dentro de la pista o en su margen exterior.</p>
                    </div>

                    <div class="bloque-edicion">
                        <h3>Pista</h3>
                        <label>Formato
                            <select id="pistaPreset">
                                <option value="oficial_60">Oficial 20 × 60 m</option>
                                <option value="oficial_40">Oficial 20 × 40 m</option>
                                <option value="personalizada">Entrenamiento personalizado</option>
                            </select>
                        </label>

                        <div id="pistaDimensiones" class="dos-columnas">
                            <label>Ancho, metros
                                <input id="pistaAncho" type="number" min="8" max="60" step=".5">
                            </label>
                            <label>Largo, metros
                                <input id="pistaLargo" type="number" min="15" max="120" step=".5">
                            </label>
                        </div>

                        <label>Referencias
                            <select id="pistaPlantilla">
                                <option value="larga">Plantilla larga (20 × 60)</option>
                                <option value="corta">Plantilla corta (20 × 40)</option>
                                <option value="centro">Solo A, X y C</option>
                            </select>
                        </label>

                        <p id="pistaAviso" class="nota-corta"></p>
                    </div>

                    <div class="bloque-edicion">
                        <h3>Estado del proyecto</h3>
                        <div id="estadoValidacion" class="estado-validacion correcto">
                            Todo en orden
                        </div>
                    </div>

                    <div class="bloque-edicion">
                        <h3>Vista</h3>
                        <label class="opcion-check"><input id="proyectoLetras" type="checkbox"> Mostrar letras</label>
                        <label class="opcion-check"><input id="proyectoInteriores" type="checkbox"> Mostrar D, L, X, I y G</label>
                        <label class="opcion-check"><input id="proyectoCuadricula" type="checkbox"> Mostrar cuadrícula</label>
                    </div>

                    <div class="bloque-edicion bloque-archivo-proyecto">
                        <h3>📁 Archivo y aplicación</h3>
                        <p>Guarda tu trabajo, crea una copia o comparte el enlace de Doma Visual. Compartir el enlace no envía el proyecto ni los consejos guardados.</p>
                        <button type="button" id="guardarDesdePanel" class="boton-principal ancho">💾 Guardar en este dispositivo</button>
                        <button type="button" id="descargarDesdePanel" class="boton-secundario ancho">⬇️ Descargar copia</button>
                        <button type="button" id="imprimirDesdePanel" class="boton-secundario ancho">🖨️ Imprimir resumen</button>
                        <button type="button" id="compartirDesdePanel" class="boton-secundario ancho">📤 Compartir el enlace</button>
                        <label class="boton-secundario ancho boton-importar-proyecto">📥 Importar copia
                            <input id="importarProyecto" type="file" accept=".json,.doma.json,application/json">
                        </label>
                        <button type="button" id="pantallaCompleta" class="boton-secundario ancho">⛶ Usar pantalla completa</button>
                        <button type="button" id="abrirAcercaDePanel" class="boton-secundario ancho">ℹ️ Acerca de y autoría</button>
                        <button type="button" id="restaurarProyecto" class="boton-secundario ancho peligro">↺ Restaurar ejemplo</button>
                    </div>
                </section>
            </div>
        </aside>
    </main>

    <footer class="mandos">
        <div class="mandos-principales" aria-label="Reproducción principal">
            <button type="button" id="anterior" class="mando" aria-keyshortcuts="ArrowLeft" aria-label="Movimiento anterior"><span class="mando-icono">◀</span><span class="mando-texto">Anterior</span></button>
            <button type="button" id="reproducir" class="mando reproducir" aria-pressed="false" aria-keyshortcuts="Space" aria-label="Reproducir o pausar"><span class="mando-icono">▶</span><span class="mando-texto">Reproducir</span></button>
            <button type="button" id="siguiente" class="mando" aria-keyshortcuts="ArrowRight" aria-label="Movimiento siguiente"><span class="mando-icono">▶</span><span class="mando-texto">Siguiente</span></button>
        </div>

        <div class="mandos-secundarios" aria-label="Controles secundarios">
            <button type="button" id="inicio" class="mando" aria-label="Volver al inicio"><span class="mando-icono">⏮</span><span class="mando-texto">Inicio</span></button>
            <button type="button" id="stop" class="mando" aria-label="Parar"><span class="mando-icono">■</span><span class="mando-texto">Parar</span></button>
            <button type="button" id="repetir" class="mando" aria-pressed="false" aria-label="Repetir movimiento"><span class="mando-icono">↻</span><span class="mando-texto">Repetir</span></button>
            <button type="button" id="abrirMusica" class="mando" aria-label="Abrir música"><span class="mando-icono">🎵</span><span class="mando-texto">Música</span></button>
        </div>

        <div class="linea-reproduccion">
            <span id="tiempoActual">00:00</span>
            <input id="cursorTiempo" type="range" min="0" max="1000" value="0" aria-label="Posición temporal en el entrenamiento">
            <span id="tiempoTotal">00:00</span>
        </div>

        <label class="velocidad">
            <span>Velocidad</span>
            <select id="velocidad" aria-label="Velocidad de reproducción">
                <option value=".5">0,5×</option>
                <option value=".75">0,75×</option>
                <option value="1" selected>1×</option>
                <option value="1.25">1,25×</option>
            </select>
        </label>
    </footer>
</div>

<section id="resumenImpresion" class="resumen-impresion" aria-hidden="true">
    <article class="impresion-hoja impresion-portada">
        <header class="impresion-cabecera">
            <p class="impresion-marca">Doma Visual · Uso aficionado</p>
            <h1 id="impresionTitulo">Resumen del entrenamiento</h1>
            <p id="impresionDatos" class="impresion-datos"></p>
            <p class="impresion-aviso">Memoria personal de lo trabajado. No sustituye las indicaciones de la profesora ni acredita una reprise oficial.</p>
        </header>
        <section class="impresion-dibujo">
            <h2>Dibujo completo</h2>
            <div id="impresionPista" class="impresion-pista" aria-label="Dibujo completo de la pista"></div>
        </section>
    </article>

    <section class="impresion-hoja impresion-pasos">
        <header>
            <p class="impresion-marca">Doma Visual · Resumen del proyecto</p>
            <h2>Pasos y recordatorios</h2>
            <p>Los apartados «Aprende» reproducen los consejos guardados en cada movimiento.</p>
        </header>
        <ol id="impresionMovimientos" class="impresion-movimientos"></ol>
    </section>
</section>

<dialog id="dialogoMusica" class="dialogo-musica">
    <div class="dialogo-musica-contenido">
        <header>
            <div>
                <strong>🎵 Música del proyecto</strong>
                <small id="tituloMusicaDialogo">Sin música configurada</small>
            </div>
            <button type="button" id="cerrarDialogoMusica" class="boton-redondo" aria-label="Cerrar música">×</button>
        </header>

        <section class="reproductor-audio-dialogo">
            <h3>Audio local sincronizado</h3>
            <audio id="audioRoom" controls preload="metadata"></audio>
            <p id="notaMusicaDialogo">Selecciona un archivo en Editar → Música. Después puedes cerrar este diálogo: el audio seguirá sonando junto con la pista.</p>
        </section>
    </div>
</dialog>

<dialog id="dialogoAcercaDe" class="dialogo-acerca-de">
    <article>
        <header>
            <div>
                <strong>Doma Visual</strong>
                <small>Autoría, libertad de uso y compromiso ecuestre</small>
            </div>
            <button type="button" id="cerrarAcercaDe" class="boton-redondo" aria-label="Cerrar información">×</button>
        </header>
        <div class="acerca-contenido">
            <h3>Uso previsto y límites</h3>
            <p><strong>Doma Visual es una herramienta personal, educativa y de uso aficionado.</strong> Ayuda a preparar, representar y memorizar ejercicios, pero no certifica su corrección técnica, su carácter oficial ni su adecuación para un caballo o una persona concretos.</p>
            <p>No sustituye la supervisión de un instructor o entrenador cualificado ni el asesoramiento veterinario. Los ejemplos incluidos son demostrativos y no deben considerarse reprises oficiales.</p>
            <p>Los proyectos se guardan en este navegador y dispositivo. Para conservarlos o trasladarlos, utiliza <strong>Descargar copia</strong>.</p>

            <h3>Licencia, autoría y código abierto</h3>
            <p><strong>Doma Visual es gratuita y se distribuye como software de código abierto bajo licencia MIT.</strong></p>
            <p><strong>Estado del sistema:</strong> versión 0 funcional y en pruebas reales. No es una versión final y puede recibir correcciones.</p>
            <p>Copyright © Mario Granderrota. Las copias y versiones modificadas deben conservar el aviso de autoría y la referencia a la licencia original.</p>
            <p>Las modificaciones realizadas por terceros no implican respaldo, supervisión ni responsabilidad del autor original.</p>

            <h3>Principios de respeto y bienestar</h3>
            <p>El bienestar del caballo debe prevalecer sobre cualquier objetivo deportivo, competitivo, económico o personal. El entrenamiento debe realizarse con respeto, paciencia y sensibilidad, evitando dolor, miedo, agotamiento, estrés innecesario o sufrimiento.</p>
            <p>La aplicación promueve la integridad y los límites de cada caballo, la observación de su estado físico y emocional, métodos progresivos, descanso adecuado, rechazo del maltrato y una relación basada en la confianza.</p>
            <p>Estos principios se extienden a jinetes, amazonas, entrenadores, personal técnico, jueces, colaboradores, voluntariado y demás personas vinculadas a la actividad ecuestre.</p>
            <p>La verdadera calidad de la equitación no se mide únicamente por los resultados, sino también por la manera en que se alcanzan.</p>
            <p>Textos completos: <a href="LICENSE" target="_blank" rel="noopener">licencia MIT</a> y <a href="AUTORIA_Y_USO.txt" target="_blank" rel="noopener">autoría, límites de uso y bienestar</a>.</p>
        </div>
    </article>
</dialog>

<section id="avisoActualizacion" class="aviso-actualizacion oculto" role="status" aria-live="polite">
    <div>
        <strong>Actualización preparada</strong>
        <span>Tu proyecto está guardado. Puedes actualizar ahora o dejarlo para después.</span>
    </div>
    <button type="button" id="actualizarPwa" class="boton-principal">Actualizar</button>
    <button type="button" id="posponerActualizacion" class="boton-secundario">Más tarde</button>
</section>
<div id="avisoGlobal" class="aviso-global" role="status" aria-live="polite"></div>
<script src="assets/errores.js?v=0-icono-app"></script>
<script src="assets/modelo.js?v=0-icono-app"></script>
<script src="assets/estado.js?v=0-icono-app"></script>
<script src="assets/layout.js?v=0-icono-app"></script>
<script src="assets/emojis.js?v=0-icono-app"></script>
<script src="assets/pista.js?v=0-icono-app"></script>
<script src="assets/editor.js?v=0-icono-app"></script>
<script src="assets/aplicacion.js?v=0-icono-app"></script>
</body>
</html>
