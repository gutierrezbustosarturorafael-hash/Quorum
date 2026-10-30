# Operacion y validacion

## Estado del cambio

Se corrigieron las llamadas con tokens JS, el logout por rol, la reclamacion atomica inicial, sus limites independientes, el filtrado de perfiles por empresa, los documentos de seguimientos y los estados de reuniones. La proteccion CSRF y la creacion explicita del indice TTL ya existian; se conservaron y se incorporaron pruebas de regresion.

No se accedio a MongoDB, Atlas, Railway, archivos de produccion ni credenciales reales. No se ejecutaron migraciones. Docker esta instalado pero su motor no responde en este entorno; las pruebas y el build siguen pendientes. La validacion de sintaxis es distinta de compilar y probar la aplicacion.

## Railway y Atlas: requisitos externos

- Backend: NODE_ENV=production, MONGODB_URI, JWT_SECRET (32 caracteres minimo), FRONTEND_URL (origen exacto), EMAIL_CREDENTIALS_ENCRYPTION_KEY (64 caracteres hex), TRUST_PROXY_HOPS=1, FORCE_HTTPS=true, HTTPS_PUBLIC_ORIGIN (origen HTTPS de API).
- Crear y adjuntar un volumen persistente en /app/uploads. UPLOADS_DIR=/app/uploads es opcional porque es el valor por defecto con Root Directory=backend. Si se usa otra ruta, UPLOADS_DIR y RAILWAY_VOLUME_MOUNT_PATH deben coincidir. No configurar manualmente RAILWAY_VOLUME_MOUNT_PATH para simular un volumen: Railway la inyecta al adjuntarlo. El arranque comprueba coincidencia y permisos, pero no demuestra la durabilidad del proveedor.
- El archivo backend/railway.json configura inicio y healthcheck; adjuntar y verificar el recurso de volumen en Railway. No basta con un directorio del contenedor.
- Antes de cambiar el montaje, copiar los archivos existentes al volumen. Un volumen vacio oculta los documentos anteriores hasta restaurarlos.
- Frontend: VITE_API_URL=https://API/api; reconstruir al cambiarla. No publicar frontend/build previo sin reconstruir.
- Atlas: verificar URI y nombre de base, usuario restringido a la base de la aplicacion, reglas de red para Railway y permisos de creacion de los indices controlados. El arranque espera initializeAuthSecurity/createIndexes; si falla, no inicia el servidor. No usar syncIndexes ni borrar indices de produccion automaticamente.
- ADMIN_BOOTSTRAP_KEY solo durante configuracion inicial. Despues del primer acceso administrativo correcto, retirarla de Railway y redesplegar. La cuenta administradora persiste en MongoDB. La reclamacion usa un unico upsert sobre _id=principal; una carrera no puede elegir dos cuentas.
- Verificar desde dos clientes controlados que req.ip difiera y que cambiar un X-Forwarded-For suministrado por el cliente no cambie su identidad efectiva. No crear un endpoint publico que revele IPs o cabeceras. El valor de un salto presupone que todo acceso pasa por ese proxy; revisar si cambia la topologia.

Fuentes oficiales: [volumenes de Railway](https://docs.railway.com/volumes), [backup de Atlas](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

## Pruebas sin datos reales

Usar Node 24.x y dependencias ya instaladas, en un entorno aislado sin secretos, con limites de CPU/memoria/tiempo, red externa bloqueada, fuente y toolchain de solo lectura y una copia desechable escribible bajo scratch. Para integracion, permitir solo MongoDB local dentro del mismo aislamiento; nunca pasar MONGODB_URI de produccion. No cargar archivos .env reales. El build de Vite carga .env automaticamente: la copia de pruebas debe excluirlos y recibir VITE_API_URL ficticia de forma explicita.

Desde backend:

~~~sh
npm test
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
~~~

La segunda sintaxis es POSIX; en PowerShell definir $env:TEST_MONGODB_URI antes de ejecutar npm run test:integration. La suite exige host local, crea una base quorum_test_<aleatorio>, nunca usa la base incluida en la URI y elimina solo su base propia. Si falta TEST_MONGODB_URI, la prueba integrada aparece como omitida, no como flujo validado. Probar con dos empresas incluye invitaciones y destinatarios mediante correo simulado, agenda, acuerdos, responsable, fecha, minuta, seguimiento, documentos, recursos personales, TTL, limites y reclamacion concurrente. No envia correos.

Desde frontend:

~~~sh
npm test
npm run build
~~~

Revisar los resultados antes de desplegar. Probar manualmente empresa, colaborador y administrador en un mismo navegador: iniciar los tres, cerrar cada uno y confirmar que los otros dos siguen funcionando. Verificar errores de validacion, permisos, carga/preview y cierre con y sin cabecera CSRF.

## Migracion de estados sin borrado

Hacer respaldo primero. Desde backend, npm run meetings:normalize muestra contadores sin escribir; npm run meetings:normalize -- --apply aplica solo status/estado de reuniones y seguimientos, conservando los otros campos. Cada update compara los valores originales para no pisar ediciones concurrentes. Repetir la vista previa; unknown requiere revision manual y las actualizaciones omitidas por concurrencia se pueden reintentar. No se ejecuta automaticamente al arrancar. Mientras tanto, las lecturas y escrituras del modelo normalizan alias antiguos. Estados canonicos: pendiente, en_curso, finalizada; las tareas e indicadores conservan su propia lista.

## Archivos y recuperacion

La referencia MongoDB se guarda antes de retirar el archivo anterior. removeStoredFile comprueba referencias de planes, documentos y seguimientos; si MongoDB no responde, conserva el archivo y registra el error. Los archivos retirados se mueven dentro del volumen a .trash/<identificador>/<ruta original>; no se destruyen. No servir .trash ni .staging publicamente (Express ignora dotfiles).

npm run files:reconcile lista archivos sin referencia con mas de siete dias. npm run files:reconcile -- --apply vuelve a comprobar referencias y los mueve a .trash. Programar esta tarea en un proceso de mantenimiento con el mismo volumen, fuera del proceso de peticiones; el modo por defecto no modifica nada. Cubre caidas entre rename y guardado, staging abandonado y errores de limpieza. No hay purga automatica de cuarentena: revisar consumo y aplicar retencion tras respaldar. Para restaurar un archivo, mover su ruta relativa desde .trash al lugar original sin sobrescribir otro archivo y restaurar la referencia correcta desde el respaldo si procede. No usar enlaces de archivo ajenos ni editar URLs manualmente desde el cliente.

## Respaldo y restauracion

Politica propuesta: copia diaria con retencion de 30 dias, copia semanal 12 semanas y simulacro de restauracion mensual. Elegir un responsable, alertas por fallo y objetivos RPO/RTO antes de habilitarla. En Atlas activar backups programados y recuperacion a punto en el tiempo si el nivel contratado lo permite; comprobar ejecuciones y retencion en el panel. Un volumen persistente no sustituye un respaldo.

Para una copia adicional con Database Tools y tar instalados, usar backend/scripts/backup.ps1 con -MongoConfig apuntando a un YAML externo de acceso restringido, -Database explicita, -UploadsDirectory del volumen y -BackupDirectory fuera de uploads (preferiblemente destino cifrado independiente). Programarlo diariamente en el programador del entorno que tenga acceso autorizado a ambos origenes; configurar fallo/alerta segun codigo de salida. El script no borra backups ni reinicia MongoDB y escribe un manifiesto SHA256 solo tras completar las dos copias. No guardar YAML, URI ni respaldos en Git. Replicar el resultado a almacenamiento independiente del volumen.

Para consistencia entre MongoDB y archivos, hacer las dos copias durante una ventana sin mutaciones ni tareas de recurrencia; no detener ni reiniciar MongoDB. Sin esa ventana no se garantiza un punto comun entre ambos respaldos. Usar snapshots del proveedor cuando corresponda.

Restaurar siempre primero en una base nueva y un directorio nuevo: verificar hashes, restaurar el archivo con mongorestore --archive=RUTA --gzip --nsFrom=BASE_ORIGEN.* --nsTo=BASE_PRUEBA.*, sin --drop; extraer uploads en un directorio vacio. Revisar conteos, accesos por rol, documentos/planes, preview y reuniones. Registrar fecha, duracion y resultado del simulacro. Conservar JWT_SECRET y EMAIL_CREDENTIALS_ENCRYPTION_KEY en un gestor de secretos con su politica de respaldo, sin incluirlos en el repositorio. No sustituir la produccion hasta haber validado la copia restaurada.

## Comprobaciones realizadas el 28 de octubre de 2026

- node --check: 33 archivos JavaScript backend/scripts/pruebas sin errores de sintaxis.
- Parser local de Rolldown: 23 archivos JS/JSX frontend sin errores de sintaxis.
- AST: 68 llamadas ApiService revisadas contra 57 firmas; sin discrepancias de argumentos ni importaciones relativas ausentes.
- Contratos de estados frontend/backend identicos.
- Parser PowerShell: script backup.ps1 sin errores de sintaxis.
- git diff --check solo senala dos lineas con espacios que ya existian en los cambios del usuario en backend/src/index.js; se conservaron. Sin esos avisos de espacios previos, no hay errores del diff.
- Pruebas unitarias/integradas y build: NO ejecutados. Docker no tiene motor activo; la guia security-audit exige aislamiento antes de ejecutar codigo de la aplicacion. No se actualizo frontend/build ni se certifica una compilacion nueva.
- Pendiente operativo: adjuntar/comprobar volumen y variables en Railway, validar red/permisos/backups de Atlas, programar y comprobar respaldos, retirar ADMIN_BOOTSTRAP_KEY tras la configuracion y ejecutar migracion solo tras respaldo y revision de su vista previa.

## Controles incorporados el 30 de octubre de 2026

Las sesiones ahora requieren un registro AuthSession en MongoDB, con indice TTL creado explicitamente durante el arranque. Los JWT anteriores a este cambio quedan rechazados: todos los roles deben iniciar sesion otra vez tras desplegar. Logout revoca solo la sesion y rol seleccionados. Cambiar una contrasena invalida sus sesiones existentes; eliminar una cuenta tambien impide reutilizarlas. El backend consulta la existencia y estado actual en cada acceso, sin depender del retraso del TTL. Una caida de MongoDB impide verificar sesiones y produce un error temporal, sin conceder acceso.

Las empresas suspendidas y sus colaboradores no pueden iniciar sesion ni usar sesiones anteriores. El administrador conserva el panel para revisar o levantar una suspension. Una suspension impide operar mientras siga vigente; al levantarla pueden volver a funcionar sesiones no vencidas que no hayan sido revocadas.

Los enlaces de documento vencen en quince minutos y requieren la cookie de la sesion que los genero. Se vuelve a comprobar la cuenta, suspension, pertenencia del archivo a la empresa y, para colaboradores, el permiso actual sobre la reunion/documento. Las respuestas de documentos y API usan Cache-Control private, no-store. Los enlaces antiguos dejan de funcionar; volver a abrir el documento desde la aplicacion.

La consulta publica por codigo devuelve solo estructura para registro, sin organigrama de personas. El portal entrega organigrama e indicadores de area/equipo una vez completada la aprobacion del perfil. Produccion permite solo FRONTEND_URL en CORS, sin localhost adicional. El servidor de frontend envia frame-ancestors none y X-Frame-Options DENY; los PDF embebidos siguen permitidos porque esas cabeceras corresponden al frontend, no al endpoint de documentos.

Cuotas: UPLOAD_COMPANY_QUOTA_BYTES por defecto 1073741824 (1 GiB); UPLOAD_VOLUME_QUOTA_BYTES por defecto 5368709120 (5 GiB). Ajustarlas a la capacidad real del volumen. La cuota de empresa cuenta archivos en las carpetas de sus reuniones actuales y plan, incluidos huerfanos de esas carpetas; la cuota global incluye staging, cuarentena y carpetas de reuniones eliminadas. Antes de recibir archivos se comprueba tambien espacio libre con margen de 64 MiB. La reserva se calcula con Content-Length, o conservadoramente con el maximo de la solicitud cuando falta esa cabecera.

Una lease compartida en MongoDB serializa las cargas de archivos durante la solicitud (las demas reciben 429 con Retry-After). No afecta lecturas ni ediciones de texto. La lease vence tras diez minutos si cae un proceso; la carga tiene un plazo de dos minutos. Multipart admite hasta 20 archivos de 15 MiB, diez campos de 64 KiB y 30 partes. Los uploads y previews admiten 20 solicitudes por empresa por minuto y 40 por IP por minuto, con contadores compartidos MongoDB. La cuarentena no se purga automaticamente: revisar consumo y respaldar antes de aplicar retencion.

Excel se procesa fuera del hilo principal, con dos workers simultaneos por proceso, plazo de diez segundos y heap de 128 MiB por worker (no equivale a un limite de memoria total del sistema). Se limita a 30 hojas, 1000 filas leidas por hoja, 64 MiB de expansion ZIP declarada, 4 MiB de resultados y vista previa de hasta 1000 filas totales con 50 columnas. Los libros mayores pueden requerir dividirse; los indicadores extraidos representan las filas procesadas. Estos limites necesitan comprobarse con libros representativos antes de desplegar.

Se agregaron pruebas de sesiones, revocacion, suspension, documentos, privacidad y cuotas. Docker sigue sin motor activo; no se ejecutaron las pruebas ni el build. No se accedio a datos reales ni se modificaron variables de Railway/Atlas.

La comprobacion de cuota limita tambien el recorrido a 10000 entradas de archivos/carpetas por empresa y 50000 por volumen, para evitar recorridos sin limite. El alta publica de colaboradores rechaza empresas suspendidas antes de guardar la cuenta.

Validacion estatica de este cambio: 44 archivos JS y sus importaciones relativas revisados sin errores; git diff --check sin errores en los cambios nuevos. Las pruebas agregadas y la compilacion de produccion siguen pendientes del entorno aislado.
