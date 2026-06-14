# Doma Visual

Aplicación web progresiva para preparar, visualizar y aprender ejercicios ecuestres de forma local, sencilla y respetuosa con el bienestar animal.

**Autor:** Mario Granderrota  
**Licencia:** MIT  
**Estado funcional:** versión 0, base estable y mantenible  
**Esquema de proyecto:** 7  
**Versión de recursos PWA:** 0-icono-app

> La versión 0 fija la base funcional y arquitectónica. Esta entrega conserva las protecciones predictivas anteriores y adopta una identidad visual pública específica para la aplicación. El nuevo caballo se usa en instalación, accesos directos y redes sociales; el marcador técnico SVG de la pista permanece intacto porque representa orientación y movimiento. Siguen siendo necesarias pruebas táctiles, de audio y PWA prolongadas en dispositivos reales.

## Para quien recibe el enlace

1. Abra `index.php` o el enlace público de la aplicación.
2. Pruebe el ejemplo incluido. Use **Editar** para los movimientos y **Proyecto** para abrir directamente la configuración, los archivos y la impresión.
3. Los cambios se guardan únicamente en ese navegador y dispositivo; no hace falta crear una cuenta.
4. Use **Descargar copia** para conservar un proyecto o trasladarlo a otro dispositivo. **Compartir el enlace** envía solo la dirección pública de Doma Visual, nunca el proyecto ni sus consejos.
5. El archivo musical es local y debe seleccionarse de nuevo al cerrar completamente la aplicación.

La aplicación está pensada para que cualquier persona pueda probarla sin instalar herramientas de desarrollo. `comprobar.php` pertenece al mantenimiento del alojamiento y permanece desactivado hasta crear una configuración privada local.

## Uso previsto y límites

Doma Visual es una herramienta personal, educativa y de uso aficionado. Ayuda a representar y memorizar ejercicios, pero no verifica que una secuencia sea técnicamente correcta, oficial o adecuada para un caballo y una persona concretos.

No sustituye la supervisión de un instructor o entrenador cualificado ni el asesoramiento veterinario. Los ejemplos incluidos son demostrativos y no deben presentarse como reprises oficiales. Cada usuario debe adaptar el trabajo al estado, nivel y seguridad del caballo y de la persona, respetando siempre el bienestar animal.

Los datos permanecen en el navegador. Antes de borrar datos, reinstalar, cambiar de dispositivo o modificar el programa, debe descargarse una copia de los proyectos importantes.

## Inicio correcto

La aplicación se abre e instala desde:

```text
index.php
```

`comprobar.php` es únicamente una página de diagnóstico protegida por clave. Puede solicitar la actualización del service worker, pero no es la pantalla de trabajo ni el `start_url` del manifiesto. Su respuesta lleva cabeceras `no-store` y el service worker nunca la guarda ni la sirve offline.

## Capacidades actuales

- Pistas 20 × 60, 20 × 40 y dimensiones personalizadas.
- Plantillas de letras largas, cortas o A–X–C.
- Reproducción visual de movimientos con caballo y jinete cenitales.
- Pestaña Aprende para guardar consejos de la profesora asociados a cada movimiento.
- Señales de color, emojis y efectos temporales.
- Elementos fijos: jurado, sol, macetas, palos, obstáculos, banderines, conos y elementos personalizados. El Sol y el jurado pueden colocarse también en el margen exterior.
- Audio exclusivamente local, opcionalmente sincronizado.
- Guardado local protegido, recuperación temporal, dos respaldos rotativos y Deshacer/Rehacer.
- Importación y exportación JSON.
- Resumen imprimible —o guardable como PDF— en formato A4 vertical estable, con dibujo completo, pasos y consejos Aprende. La composición usa medidas físicas para reducir diferencias entre ordenador y teléfono.
- Instalación PWA y funcionamiento offline del programa y de los proyectos guardados.
- Presentación pública amable: iconos de aplicación propios, metadatos Open Graph para Telegram y botón de compartir con copia segura del enlace como alternativa. Estos iconos no sustituyen al marcador técnico SVG de la pista.
- HUD de ejecución separado del SVG: «AHORA», «RECUERDA» y la leyenda no cubren letras ni trayectorias.
- En móvil vertical el HUD forma una columna lateral y la pista se desplaza a la derecha; en móvil horizontal se utiliza una composición panorámica con lista lateral.
- Vista apaisada automática en móvil horizontal, tableta o escritorio cuando mejora la legibilidad.
- Vista limpia reversible: cambia a «Mostrar paneles», elimina la reserva lateral y la barra secundaria para ampliar realmente la pista sin ocultar «AHORA», «RECUERDA» ni los mandos.
- Interfaz ampliada en escritorio, con botones, listas, editor, tarjetas y mandos legibles.
- Márgenes SVG calculados según el tamaño de los elementos exteriores; el jurado reserva además espacio interior superior para que sus emojis no queden pegados al recuadro.
- Protecciones contra pulsaciones accidentales masivas: altas limitadas a 120 movimientos, 40 efectos por movimiento, 40 señales por paleta y 48 elementos fijos. Los proyectos importados no se recortan por estos límites. Al añadir varios elementos iguales reciben nombres consecutivos —por ejemplo, «Cono 2»— para que no se confundan con duplicados corruptos.
- Los atajos globales quedan suspendidos mientras hay un diálogo o panel de error abierto, evitando cambios ocultos detrás de una confirmación.
- Efectos, señales y movimientos dinámicos se modifican y eliminan mediante identificadores estables: un repintado o cambio de selección no desplaza la acción al elemento siguiente.
- El borrado de una señal pide confirmación e informa de cuántas referencias serán reasignadas. Los efectos protegen frente al doble toque destructivo sin añadir confirmaciones repetitivas.
- Las posiciones rápidas respetan las mismas reglas que la colocación táctil: solo Sol y jurado pueden usar márgenes exteriores, y un elemento bloqueado no puede recolocarse.
- Los emojis recientes dañados o con entradas extrañas se filtran sin impedir el uso de secuencias Unicode completas.
- Los proyectos importados y las copias locales se someten a un presupuesto estructural antes de normalizarse: profundidad, nodos, texto y colecciones reconocidas tienen límites amplios que evitan bloquear un teléfono con un JSON pequeño pero patológico.
- El historial conserva hasta 40 operaciones, pero también respeta un presupuesto aproximado de 8 MB para evitar que proyectos grandes multipliquen el consumo de memoria.
- Si otra pestaña guarda un proyecto diferente, la ventana actual no lo sobrescribe silenciosamente: conserva su edición como copia alternativa recuperable y muestra un aviso.
- Las navegaciones con tiempo agotado se abortan mediante `AbortController`, evitando que una petición antigua continúe consumiendo red después de activar el respaldo offline.

## Estructura

- `index.php`: estructura HTML y punto de entrada.
- `assets/modelo.js`: esquema, geometría, migraciones y validación.
- `assets/estado.js`: transacciones, historial y persistencia.
- `assets/pista.js`: renderizado SVG, incluido el marcador técnico de orientación y movimiento, independiente de los iconos públicos de la aplicación.
- `assets/editor.js`: formularios y elementos fijos.
- `assets/aplicacion.js`: reproducción, audio local y PWA.
- `assets/layout.js`: composición responsive estable.
- `assets/emojis.js`: entrada Unicode libre y recientes.
- `assets/errores.js`: protección, confirmaciones y diagnóstico.
- `assets/estilos.css`: presentación.
- `service-worker.js`: caché offline y actualización; excluye el diagnóstico protegido.
- `manifest.webmanifest`: metadatos de instalación.
- `.htaccess`: endurecimiento Apache, bloqueo de archivos internos y cabeceras defensivas.
- `.doma-acceso.example.php`: plantilla pública y deliberadamente inactiva para configurar el diagnóstico.
- `.gitignore`: evita publicar la configuración privada, secretos y archivos temporales.
- `tests/comprobar_proyecto.js`: pruebas sintácticas, estáticas y unitarias sin dependencias externas.

## Botón Proyecto e impresión

El botón **Proyecto** de la cabecera no despliega un menú flotante: abre directamente la pestaña Proyecto del editor. Allí se concentran guardado, descarga, impresión, importación, pantalla completa, autoría y restauración del ejemplo. Esta disposición evita menús recortados por la cabecera y mantiene una única fuente de verdad para las acciones del proyecto.

La impresión utiliza una composición canónica **A4 vertical** de 186 mm útiles. La primera hoja contiene identificación y dibujo completo; las siguientes muestran los pasos en una sola columna legible. El navegador puede añadir sus propios márgenes, encabezados o pies si el usuario los activa, pero la aplicación ya no depende del tamaño de la pantalla desde la que se inicia la impresión.

## Letras, orientación y Sol

Las letras pertenecen a la geometría de la pista: A, C y las restantes referencias no cambian al indicar el norte. El campo de orientación solo registra hacia qué punto cardinal mira el lado C de la pista real. El Sol es una referencia manual, no un cálculo astronómico, y puede colocarse dentro o fuera del rectángulo útil desde la pestaña `Fijos 🚧`.

## Persistencia y recuperación

Los proyectos se guardan en `localStorage` del navegador y del dominio actual. No se sincronizan entre teléfono y ordenador.

El checksum es una comprobación interna y automática. El usuario no necesita calcularlo ni revisarlo: sirve para detectar si una copia local quedó incompleta o alterada accidentalmente. No es una firma criptográfica.

El guardado escribe primero una copia temporal verificable y después la principal. Si el navegador se cierra durante la operación, el arranque puede recuperar esa copia temporal. Se conservan además dos respaldos válidos. Guardar varias veces el mismo contenido no consume innecesariamente esos respaldos.

El historial de Deshacer/Rehacer está limitado tanto por número de operaciones como por memoria aproximada. En proyectos pequeños conserva hasta 40 pasos; en proyectos grandes puede conservar menos para proteger el navegador. Las instantáneas son referencias inmutables entre transacciones, no copias profundas acumuladas sin control.

Si dos pestañas del mismo navegador editan el proyecto a la vez, la segunda no pisa automáticamente lo guardado por la primera. Su contenido se conserva como una copia de conflicto recuperable y la interfaz solicita resolver la situación. No es sincronización multiusuario: es una defensa contra pérdidas accidentales.

Al cargar, la aplicación prefiere siempre una copia íntegra. Solo cuando no queda ninguna copia íntegra intenta reparar una estructura reconocible con checksum incorrecto, conservando los datos válidos y normalizando los campos dañados. Un JSON sintácticamente roto no se inventa ni se reconstruye a ciegas.

El audio local no puede reabrirse automáticamente después de cerrar la aplicación; solo se conserva el nombre del archivo.

## Seguridad de datos importados

- Los proyectos importados se validan estructuralmente y después se normalizan.
- El tamaño máximo de importación es 2 MB, pero además se rechazan estructuras patológicas —demasiada profundidad, nodos, texto o colecciones reconocidas— aunque ocupen menos.
- Los textos editables se insertan con `textContent`, no como HTML.
- Las trayectorias incompatibles se advierten sin borrar silenciosamente los datos.


## Diagnóstico protegido y configuración privada

El repositorio público **no contiene** `.doma-acceso.php`. Incluye únicamente `.doma-acceso.example.php`, una plantilla con un marcador inválido que mantiene `comprobar.php` desactivado hasta que cada instalación configure su propia clave.

Para activar el diagnóstico en un alojamiento con PHP:

1. Copia `.doma-acceso.example.php` como `.doma-acceso.php`.
2. Genera un hash con una clave propia, por ejemplo:

```bash
php -r "echo password_hash('CAMBIA_ESTA_CLAVE', PASSWORD_DEFAULT), PHP_EOL;"
```

3. Sustituye el marcador `SUSTITUIR_POR_UN_HASH_GENERADO_CON_PASSWORD_HASH` por el resultado.
4. Conserva la clave en un gestor de contraseñas y no la escribas en el repositorio, incidencias ni capturas.

`.gitignore` excluye `.doma-acceso.php`. `.htaccess` bloquea su acceso HTTP y `comprobar.php` usa sesión estricta, token CSRF, limitación de intentos y `password_verify()`.

## PWA y actualizaciones

La versión de recursos aparece repetida de forma deliberada en el código y en la documentación de entrega. La prueba `node tests/comprobar_proyecto.js` falla cuando detecta valores distintos.

Al publicar cambios en CSS, JavaScript, HTML o manifiesto, debe actualizarse la versión coordinada antes de regenerar la previsualización. El esquema JSON (`VERSION_PROYECTO`) solo cambia cuando cambia la forma de los datos persistidos.

## Criterio de mantenimiento de la versión 0

- Mantener una arquitectura compacta; añadir archivos solo cuando separen una responsabilidad real.
- No ampliar las APIs globales: cada módulo exporta únicamente operaciones usadas por otros módulos.
- Conservar comentarios que expliquen invariantes, límites del navegador o decisiones de seguridad; retirar comentarios históricos y líneas obvias.
- No cambiar la funcionalidad durante una limpieza estructural sin añadir una prueba específica.
- La prueba humana automatizada debe conservarse como referencia; la siguiente validación útil es una sesión prolongada en dispositivos reales, especialmente con audio, tacto y actualización PWA.

## Compartir y colaborar

- Para usuarios finales, comparte el enlace de `index.php`; nunca la clave de `comprobar.php`.
- Para colaborar en GitHub, crea una rama o bifurcación, conserva `LICENSE` y `AUTORIA_Y_USO.txt`, y ejecuta `node tests/comprobar_proyecto.js` antes de proponer cambios.
- No confirmes en Git `.doma-acceso.php`, contraseñas, tokens, copias privadas de proyectos ni archivos musicales.
- Las propuestas deben preservar el bienestar animal, la privacidad local, la compatibilidad con proyectos anteriores y la sencillez del sistema.
- Un informe de error útil debe indicar navegador, dispositivo, orientación, pasos realizados y resultado observado, sin adjuntar datos personales de menores ni información privada.

## Instalación en un alojamiento PHP

1. Clona o descarga el repositorio y ejecuta `node tests/comprobar_proyecto.js`.
2. Copia `.doma-acceso.example.php` como `.doma-acceso.php` y configura un hash propio siguiendo la sección anterior.
3. Sube el contenido completo, incluidos `.htaccess` y `.doma-acceso.php`, sin mezclar JavaScript o CSS de entregas distintas.
4. Ajusta las URL canónicas de `index.php` si la instalación no utiliza `granderrota.com`.
5. Abre `comprobar.php`, introduce la clave privada y revisa el diagnóstico.
6. Entra en `index.php`, acepta la actualización y cierra completamente la PWA antes de abrirla de nuevo.

GitHub Pages no ejecuta PHP. El repositorio puede alojar el código, pero la aplicación completa necesita un servidor con PHP y HTTPS para el diagnóstico y la instalación PWA en condiciones normales.

## Autoría y bienestar

Consulte `LICENSE` y `AUTORIA_Y_USO.txt`.

Copyright © Mario Granderrota.
