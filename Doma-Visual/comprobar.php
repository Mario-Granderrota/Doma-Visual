<?php
/*
Doma Visual · Versión 0
Parte: diagnóstico protegido de despliegue y actualización PWA.
Dependencias: .doma-acceso.php, .htaccess, service-worker.js y manifest.webmanifest.

Invariantes:
- index.php es el único punto de entrada funcional.
- El diagnóstico exige sesión autorizada mediante password_verify().
- La respuesta no se almacena en caché ni queda disponible offline.
- No se muestran rutas, versiones internas ni otros datos sensibles.
- Los datos variables del navegador se insertan mediante textContent.
*/
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

$conexionSegura = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$rutaScript = str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/')));
$rutaCookie = rtrim($rutaScript, '/');
$rutaCookie = ($rutaCookie === '' || $rutaCookie === '.') ? '/' : $rutaCookie . '/';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('DOMA_DIAGNOSTICO');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => $rutaCookie,
    'secure' => $conexionSegura,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header_remove('X-Powered-By');
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), geolocation=(), microphone=()');

try {
    $nonce = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
} catch (Throwable $error) {
    $nonce = hash('sha256', uniqid('', true));
}
header("Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self'; manifest-src 'self'; connect-src 'self'; worker-src 'self'; style-src 'self' 'nonce-{$nonce}'; script-src 'self' 'nonce-{$nonce}'");

function escapar(string $texto): string
{
    return htmlspecialchars($texto, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function destruirSesionDiagnostico(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $parametros = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $parametros['path'],
            'domain' => $parametros['domain'],
            'secure' => $parametros['secure'],
            'httponly' => $parametros['httponly'],
            'samesite' => $parametros['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
}

$rutaConfiguracion = __DIR__ . DIRECTORY_SEPARATOR . '.doma-acceso.php';
$configuracion = is_file($rutaConfiguracion) ? require $rutaConfiguracion : null;
$configuracionValida = is_array($configuracion)
    && is_string($configuracion['hash_clave'] ?? null)
    && password_get_info($configuracion['hash_clave'])['algo'] !== null;

if (!$configuracionValida) {
    http_response_code(503);
    $mensajeConfiguracion = 'El diagnóstico está desactivado hasta configurar su clave privada.';
} else {
    $mensajeConfiguracion = '';
}

$duracionSesion = max(300, (int)($configuracion['duracion_sesion_segundos'] ?? 1800));
$maxIntentos = max(3, (int)($configuracion['max_intentos_por_sesion'] ?? 5));
$bloqueoSegundos = max(60, (int)($configuracion['bloqueo_segundos'] ?? 900));
$ahora = time();

if (!isset($_SESSION['csrf_diagnostico'])) {
    try {
        $_SESSION['csrf_diagnostico'] = bin2hex(random_bytes(24));
    } catch (Throwable $error) {
        $_SESSION['csrf_diagnostico'] = hash('sha256', uniqid('', true));
    }
}

if (isset($_SESSION['autorizado_en']) && $ahora - (int)$_SESSION['autorizado_en'] > $duracionSesion) {
    unset($_SESSION['autorizado'], $_SESSION['autorizado_en']);
}

$csrfRecibido = (string)($_POST['csrf'] ?? '');
$csrfValido = $csrfRecibido !== '' && hash_equals((string)$_SESSION['csrf_diagnostico'], $csrfRecibido);
$errorAcceso = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['accion'] ?? '') === 'salir') {
    if ($csrfValido) {
        destruirSesionDiagnostico();
        header('Location: comprobar.php');
        exit;
    }
    $errorAcceso = 'La solicitud de cierre no es válida.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['accion'] ?? '') === 'entrar' && $configuracionValida) {
    $bloqueadoHasta = (int)($_SESSION['bloqueado_hasta'] ?? 0);
    if (!$csrfValido) {
        $errorAcceso = 'La sesión ha cambiado. Recarga la página e inténtalo de nuevo.';
    } elseif ($bloqueadoHasta > $ahora) {
        $minutos = max(1, (int)ceil(($bloqueadoHasta - $ahora) / 60));
        $errorAcceso = "Acceso temporalmente bloqueado. Vuelve a intentarlo dentro de {$minutos} minuto(s).";
    } else {
        $clave = substr((string)($_POST['clave'] ?? ''), 0, 500);
        if (password_verify($clave, $configuracion['hash_clave'])) {
            session_regenerate_id(true);
            $_SESSION['autorizado'] = true;
            $_SESSION['autorizado_en'] = $ahora;
            $_SESSION['intentos_fallidos'] = 0;
            unset($_SESSION['bloqueado_hasta']);
            header('Location: comprobar.php');
            exit;
        }

        usleep(450000);
        $intentos = (int)($_SESSION['intentos_fallidos'] ?? 0) + 1;
        $_SESSION['intentos_fallidos'] = $intentos;
        if ($intentos >= $maxIntentos) {
            $_SESSION['bloqueado_hasta'] = $ahora + $bloqueoSegundos;
            $_SESSION['intentos_fallidos'] = 0;
            $errorAcceso = 'Se ha alcanzado el límite de intentos. El acceso queda bloqueado temporalmente.';
        } else {
            $errorAcceso = 'Clave no válida.';
        }
    }
}

$autorizado = $configuracionValida && !empty($_SESSION['autorizado']);
if ($autorizado) {
    $_SESSION['autorizado_en'] = $ahora;
}

$archivos = [
    '.htaccess', '.doma-acceso.php', 'comprobar.php', 'index.php',
    'assets/estilos.css', 'assets/errores.js', 'assets/modelo.js', 'assets/estado.js',
    'assets/layout.js', 'assets/emojis.js', 'assets/pista.js', 'assets/editor.js',
    'assets/aplicacion.js', 'previsualizacion.html', 'manifest.webmanifest',
    'service-worker.js', 'offline.html', 'icons/icono-app-192.png', 'icons/icono-app-512.png',
    'LICENSE', 'AUTORIA_Y_USO.txt', 'README.md',
    'LEEME_PRIMERO.txt', 'LISTA_ARCHIVOS.txt', 'tests/comprobar_proyecto.js',
];

$contenidoIndice = @file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'index.php');
$presentacionPublicaCorrecta = is_string($contenidoIndice)
    && strpos($contenidoIndice, 'property="og:title"') !== false
    && strpos($contenidoIndice, 'property="og:image"') !== false
    && strpos($contenidoIndice, 'rel="canonical"') !== false;
$icono192 = @getimagesize(__DIR__ . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . 'icono-app-192.png');
$icono512 = @getimagesize(__DIR__ . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . 'icono-app-512.png');
$iconosCorrectos = is_array($icono192) && is_array($icono512)
    && (int)$icono192[0] === 192 && (int)$icono192[1] === 192
    && (int)$icono512[0] === 512 && (int)$icono512[1] === 512;
?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#35634c">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Diagnóstico protegido · Doma Visual</title>
<style nonce="<?php echo escapar($nonce); ?>">
:root{color-scheme:light;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100svh;padding:24px;background:#f5f6f2;color:#18231d}
main{width:min(980px,100%);margin:0 auto}.panel{padding:22px;border:1px solid #d7dfda;border-radius:16px;background:#fff;box-shadow:0 18px 55px rgba(37,53,44,.10)}
h1{margin:0 0 8px;font-size:clamp(22px,4vw,32px)}p{line-height:1.55}.suave{color:#65736b}.error{color:#9c2f29;font-weight:750}.ok{color:#157044;font-weight:750}
form{display:grid;gap:12px}.acceso{width:min(460px,100%);margin:8vh auto 0}label{display:grid;gap:6px;font-weight:750}input{width:100%;min-height:44px;padding:10px 12px;border:1px solid #cbd5cf;border-radius:9px;font:inherit}
button,a.boton{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 14px;border:1px solid #35634c;border-radius:9px;background:#35634c;color:#fff;text-decoration:none;font:inherit;font-weight:800;cursor:pointer}.secundario{border-color:#cbd5cf!important;background:#fff!important;color:#18231d!important}
.cabecera{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.acciones{display:flex;gap:8px;flex-wrap:wrap}.acciones form{display:block}
.tabla{overflow:auto;margin-top:18px;border:1px solid #e0e6e2;border-radius:11px}table{width:100%;border-collapse:collapse;min-width:620px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5eae7}tr:last-child td{border-bottom:0}th{background:#f7f9f7}
.resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin:16px 0}.dato{padding:11px;border:1px solid #e0e6e2;border-radius:10px;background:#fafbfa}.dato strong,.dato span{display:block}.dato span{margin-top:4px;color:#65736b;font-size:13px}
@media(max-width:620px){body{padding:10px}.panel{padding:16px}.cabecera{display:grid}.acciones{width:100%}.acciones>*{flex:1}}
</style>
</head>
<body>
<main>
<?php if (!$autorizado): ?>
<section class="panel acceso">
    <h1>Diagnóstico protegido</h1>
    <p class="suave">Introduce la clave privada para comprobar el despliegue de Doma Visual.</p>
    <?php if ($mensajeConfiguracion !== ''): ?><p class="error"><?php echo escapar($mensajeConfiguracion); ?></p><?php endif; ?>
    <?php if ($errorAcceso !== ''): ?><p class="error" role="alert"><?php echo escapar($errorAcceso); ?></p><?php endif; ?>
    <?php if ($configuracionValida): ?>
    <form method="post" action="comprobar.php" autocomplete="off">
        <input type="hidden" name="accion" value="entrar">
        <input type="hidden" name="csrf" value="<?php echo escapar((string)$_SESSION['csrf_diagnostico']); ?>">
        <label>Clave de diagnóstico
            <input name="clave" type="password" required autofocus autocomplete="current-password" maxlength="200">
        </label>
        <button type="submit">Abrir diagnóstico</button>
    </form>
    <?php endif; ?>
    <p><a href="index.php">Volver a la aplicación</a></p>
</section>
<?php else: ?>
<section class="panel">
    <div class="cabecera">
        <div>
            <h1>Doma Visual: comprobación</h1>
            <p class="suave">Esta página diagnostica la instalación; la aplicación se abre siempre desde <strong>index.php</strong>.</p>
        </div>
        <div class="acciones">
            <a class="boton" href="index.php">Abrir aplicación</a>
            <form method="post" action="comprobar.php">
                <input type="hidden" name="accion" value="salir">
                <input type="hidden" name="csrf" value="<?php echo escapar((string)$_SESSION['csrf_diagnostico']); ?>">
                <button class="secundario" type="submit">Cerrar sesión</button>
            </form>
    </div>

    <div class="resumen">
        <div class="dato"><strong>Entorno PHP</strong><span class="ok">Disponible</span></div>
        <div class="dato"><strong>Conexión</strong><span class="<?php echo $conexionSegura ? 'ok' : 'error'; ?>"><?php echo $conexionSegura ? 'HTTPS detectado' : 'HTTPS no detectado'; ?></span></div>
        <div class="dato"><strong>Configuración privada</strong><span class="ok">Cargada</span></div>
        <div class="dato"><strong>Resultado de archivos</strong><span id="resumenArchivos">Calculando…</span></div>
        <div class="dato"><strong>Vista previa social</strong><span class="<?php echo $presentacionPublicaCorrecta ? 'ok' : 'error'; ?>"><?php echo $presentacionPublicaCorrecta ? 'Configurada' : 'Incompleta'; ?></span></div>
        <div class="dato"><strong>Iconos PWA</strong><span class="<?php echo $iconosCorrectos ? 'ok' : 'error'; ?>"><?php echo $iconosCorrectos ? '192 y 512 px correctos' : 'Dimensiones incorrectas'; ?></span></div>
    </div>

    <p id="estadoPwa"><strong>PWA:</strong> comprobando compatibilidad…</p>
    <div class="tabla">
        <table>
            <thead><tr><th>Archivo</th><th>Resultado</th><th>Tamaño</th></tr></thead>
            <tbody>
            <?php $correctos = 0; foreach ($archivos as $archivo):
                $ruta = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $archivo);
                $correcto = is_file($ruta) && (filesize($ruta) ?: 0) > 0;
                if ($correcto) { $correctos++; }
            ?>
                <tr>
                    <td><?php echo escapar($archivo); ?></td>
                    <td class="<?php echo $correcto ? 'ok' : 'error'; ?>"><?php echo $correcto ? 'Correcto' : 'FALTA O VACÍO'; ?></td>
                    <td><?php echo $correcto ? number_format((int)filesize($ruta), 0, ',', '.') . ' bytes' : '—'; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<script nonce="<?php echo escapar($nonce); ?>">
(() => {
    "use strict";
    const total = <?php echo count($archivos); ?>;
    const correctos = <?php echo $correctos; ?>;
    const resumen = document.getElementById("resumenArchivos");
    resumen.textContent = `${correctos} de ${total} correctos`;
    resumen.className = correctos === total ? "ok" : "error";

    const estado = document.getElementById("estadoPwa");
    const seguro = location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname);
    const admiteSw = "serviceWorker" in navigator;

    function anadirEstado(texto, clase = "") {
        const separador = document.createTextNode(estado.childNodes.length ? " · " : "");
        const fragmento = document.createElement("span");
        fragmento.textContent = texto;
        if (clase) fragmento.className = clase;
        estado.append(separador, fragmento);
    }

    estado.textContent = "PWA: ";
    anadirEstado(seguro && admiteSw ? "navegador compatible" : "requiere HTTPS y soporte de Service Worker", seguro && admiteSw ? "ok" : "error");

    fetch("manifest.webmanifest?v=0-icono-app", { cache:"no-store", credentials:"same-origin" })
        .then(respuesta => {
            const tipo = respuesta.headers.get("content-type") || "tipo no informado";
            const correcto = respuesta.ok && /json/i.test(tipo);
            anadirEstado(`manifiesto ${correcto ? "correcto" : "incorrecto"}: ${tipo}`, correcto ? "ok" : "error");
        })
        .catch(() => anadirEstado("no se pudo leer el manifiesto", "error"));

    if (seguro && admiteSw) {
        navigator.serviceWorker.register("./service-worker.js", { scope:"./", updateViaCache:"none" })
            .then(registro => registro.update().catch(() => null))
            .then(() => anadirEstado("actualización solicitada", "ok"))
            .catch(error => {
                anadirEstado("service worker no registrado", "error");
                console.warn(error);
            });
    }
})();
</script>
<?php endif; ?>
</main>
</body>
</html>
