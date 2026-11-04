# Requirements Document

## Introduction

El Sistema de Autenticación por Roles, Formularios de Autorización y Panel de Control Docente es una plataforma web responsiva (Mobile-First) diseñada para gestionar autorizaciones escolares en una escuela primaria de 300 alumnos. El sistema permite a los padres responder formularios de autorización desde sus dispositivos móviles sin necesidad de instalar aplicaciones, mientras las maestras y dirección acceden a un panel administrativo para crear eventos, modificar formularios y visualizar métricas de respuesta en tiempo real.

La plataforma está construida con HTML5, Tailwind CSS, JavaScript Vanilla y Supabase, proporcionando una experiencia sin fricciones para familias que prefieren no instalar nuevas aplicaciones.

## Glossary

- **Sistema**: La plataforma web completa de autenticación y formularios de autorización escolar
- **Usuario_Padre**: Padre, madre o tutor que accede al sistema mediante la matrícula de un alumno
- **Usuario_Maestro**: Docente o personal de dirección con credenciales de correo y contraseña
- **Matrícula**: Identificador único del alumno utilizado para autenticación de padres
- **Evento**: Actividad escolar que requiere autorización (vacunas, salidas, eventos especiales)
- **Formulario_Autorización**: Formulario digital vinculado a un evento específico
- **Respuesta_Autorización**: Registro de respuesta de un tutor a un formulario específico
- **Panel_Administrativo**: Interfaz de gestión para usuarios maestros
- **Sesión**: Estado de autenticación activo de un usuario
- **Tabla_Alumnos**: Tabla de base de datos que contiene los registros de estudiantes con sus matrículas
- **Tabla_Eventos_Autorizaciones**: Tabla de base de datos que almacena los eventos y formularios activos
- **Tabla_Respuestas_Autorizaciones**: Tabla de base de datos que almacena las respuestas de los tutores
- **Tabla_Usuarios_Maestros**: Tabla de base de datos que almacena las credenciales de docentes
- **Grupo**: Clase o sección escolar (ejemplo: 3°A, 4°B)
- **Métrica_Faltante**: Reporte que identifica alumnos sin respuesta registrada para un evento específico

## Requirements

### Requirement 1: Autenticación de Padres por Matrícula

**User Story:** Como padre o tutor, quiero acceder al sistema usando la matrícula de mi hijo, para poder responder formularios de autorización sin tener que recordar contraseñas complejas.

#### Acceptance Criteria

1. WHEN un usuario envía credenciales para iniciar sesión como Usuario_Padre, THE Sistema SHALL validar que la matrícula contiene al menos un carácter alfanumérico y no excede 20 caracteres
2. WHEN un usuario ingresa una matrícula con formato válido que existe en Tabla_Alumnos, THE Sistema SHALL iniciar una sesión de Usuario_Padre vinculada a ese alumno con duración de 24 horas desde el último acceso
3. IF un usuario ingresa una matrícula inexistente en Tabla_Alumnos, THEN THE Sistema SHALL mostrar el mensaje de error "Matrícula no encontrada. Verifica el número e intenta de nuevo" sin revelar si el problema es formato o existencia
4. WHILE una sesión de Usuario_Padre está activa, THE Sistema SHALL mostrar el nombre completo del alumno asociado en la parte superior de la interfaz
5. WHEN un Usuario_Padre inicia sesión exitosamente, THE Sistema SHALL almacenar el identificador de sesión en el almacenamiento local del navegador con persistencia entre cierres de pestaña
6. IF la validación del formato de matrícula falla, THEN THE Sistema SHALL mostrar el mensaje de error "Formato de matrícula inválido" antes de consultar Tabla_Alumnos
7. WHEN una sesión de Usuario_Padre alcanza 24 horas de inactividad, THE Sistema SHALL eliminar el identificador de sesión y requerir nueva autenticación en el próximo acceso

### Requirement 2: Cierre de Sesión de Padres

**User Story:** Como padre, quiero poder cerrar mi sesión cuando termine, para proteger la información de mi hijo si comparto el dispositivo.

#### Acceptance Criteria

1. WHILE un Usuario_Padre tiene una sesión activa, THE Sistema SHALL mostrar un botón de cierre de sesión en la parte superior derecha de la interfaz con etiqueta visible "Cerrar Sesión"
2. WHEN un Usuario_Padre hace clic en el botón de cierre de sesión, THE Sistema SHALL eliminar el identificador de sesión del almacenamiento local del navegador y eliminar los datos temporales de perfil de usuario almacenados en memoria
3. WHEN el cierre de sesión de un Usuario_Padre se completa exitosamente, THE Sistema SHALL redirigir al usuario a la pantalla de inicio de sesión dentro de 2 segundos
4. IF la solicitud de cierre de sesión falla por error de red, THEN THE Sistema SHALL eliminar el identificador de sesión y los datos temporales del navegador localmente, mostrar un mensaje indicando que la sesión se cerró localmente, y redirigir a la pantalla de inicio de sesión
5. WHEN un usuario intenta acceder a una página protegida después del cierre de sesión, THE Sistema SHALL verificar la ausencia del identificador de sesión y redirigir inmediatamente a la pantalla de inicio de sesión sin cargar contenido protegido

### Requirement 3: Envío de Respuestas de Autorización

**User Story:** Como padre, quiero llenar y enviar formularios de autorización desde mi celular, para que la escuela tenga mi respuesta sin depender de papeles que se pierden.

#### Acceptance Criteria

1. WHEN un Usuario_Padre envía un Formulario_Autorización, THE Sistema SHALL validar que nombre_tutor no exceda 100 caracteres, parentesco_tutor no exceda 50 caracteres, alergias no exceda 500 caracteres, y nota_adicional no exceda 500 caracteres
2. WHEN un Usuario_Padre envía un Formulario_Autorización y todas las validaciones son exitosas, THE Sistema SHALL insertar un registro en Tabla_Respuestas_Autorizaciones con los campos evento_id, matricula_alumno, nombre_tutor, parentesco_tutor, autoriza, alergias y nota_adicional
3. WHEN un Usuario_Padre intenta enviar un Formulario_Autorización, THE Sistema SHALL validar que todos los campos obligatorios (evento_id, matricula_alumno, nombre_tutor, parentesco_tutor, autoriza) contengan al menos un carácter no vacío excluyendo espacios en blanco
4. IF un Usuario_Padre intenta enviar una respuesta duplicada para el mismo evento_id y matricula_alumno, THEN THE Sistema SHALL rechazar el envío y mostrar el mensaje "Ya existe una respuesta registrada para este evento. Puedes verla en tu lista de formularios enviados"
5. WHEN el envío de una Respuesta_Autorización es exitoso, THE Sistema SHALL mostrar un mensaje de confirmación indicando "Tu respuesta fue registrada exitosamente" con un icono de éxito visible
6. WHEN un Usuario_Padre está llenando un Formulario_Autorización, THE Sistema SHALL marcar visualmente los campos obligatorios con un asterisco rojo (*) junto a la etiqueta del campo
7. IF el envío de un Formulario_Autorización falla por problemas de conexión a la base de datos, THEN THE Sistema SHALL preservar los datos ingresados en el formulario y mostrar el mensaje "No se pudo enviar tu respuesta. Verifica tu conexión e intenta de nuevo"
8. IF un campo obligatorio excede la longitud máxima permitida o un campo opcional excede la longitud máxima permitida, THEN THE Sistema SHALL prevenir el envío y mostrar un mensaje de error indicando el campo problemático y la longitud máxima permitida

### Requirement 4: Visualización de Formularios Disponibles para Padres

**User Story:** Como padre, quiero ver qué formularios de autorización están pendientes de respuesta, para saber qué necesito completar.

#### Acceptance Criteria

1. WHEN un Usuario_Padre inicia sesión exitosamente, THE Sistema SHALL consultar Tabla_Eventos_Autorizaciones para obtener eventos donde el campo estado tenga valor "activo"
2. WHEN un Usuario_Padre visualiza la lista de eventos activos, THE Sistema SHALL mostrar para cada evento el título (máximo 200 caracteres), descripción completa y fecha límite en formato "DD/MM/YYYY"
3. WHEN un Usuario_Padre ya registró una respuesta en Tabla_Respuestas_Autorizaciones para un evento específico, THE Sistema SHALL mostrar un badge verde con el texto "Enviado" junto al título del evento
4. WHEN un Usuario_Padre visualiza la lista de eventos activos, THE Sistema SHALL ordenarlos por fecha límite en orden ascendente mostrando primero los eventos cuya fecha límite está más próxima a la fecha actual
5. IF no existen eventos con estado "activo" en Tabla_Eventos_Autorizaciones, THEN THE Sistema SHALL mostrar el mensaje "No hay formularios pendientes en este momento" en el centro de la pantalla
6. WHEN un Usuario_Padre visualiza un evento cuya fecha límite es anterior a la fecha actual, THE Sistema SHALL mostrar un indicador visual de "Vencido" con color ámbar y mantenerlo visible pero marcar el botón de respuesta como deshabilitado

### Requirement 5: Autenticación de Maestros por Credenciales

**User Story:** Como maestra o personal de dirección, quiero acceder al panel administrativo con mi correo y contraseña, para gestionar eventos y ver métricas de autorización de forma segura.

#### Acceptance Criteria

1. WHEN un usuario envía credenciales de inicio de sesión, THE Sistema SHALL validar que el correo y la contraseña contienen al menos un carácter no vacío excluyendo espacios en blanco
2. WHEN un usuario ingresa correo y contraseña que coinciden con un registro en Tabla_Usuarios_Maestros comparando el correo sin distinción entre mayúsculas y minúsculas, THE Sistema SHALL iniciar una sesión de Usuario_Maestro
3. WHEN un Usuario_Maestro inicia sesión, THE Sistema SHALL crear una sesión con duración máxima de 8 horas desde el último acceso
4. WHEN un Usuario_Maestro inicia sesión, THE Sistema SHALL almacenar el identificador de sesión en el navegador del dispositivo que persiste durante cierres de pestaña pero no cierres completos del navegador
5. WHILE una sesión de Usuario_Maestro está activa y no ha expirado, THE Sistema SHALL mostrar el Panel_Administrativo
6. IF un usuario ingresa credenciales incorrectas, THEN THE Sistema SHALL mostrar un mensaje de error indicando credenciales inválidas sin revelar si el correo o la contraseña son incorrectos
7. IF un usuario ingresa credenciales incorrectas 5 veces en un período de 15 minutos desde la misma dirección IP, THEN THE Sistema SHALL bloquear intentos de inicio de sesión desde esa dirección IP durante 30 minutos
8. WHEN una sesión de Usuario_Maestro alcanza 8 horas desde el último acceso, THE Sistema SHALL cerrar la sesión y redirigir al formulario de inicio de sesión

### Requirement 6: Cierre de Sesión de Maestros

**User Story:** Como maestra, quiero poder cerrar mi sesión cuando termine de trabajar, para proteger la información escolar si dejo el dispositivo desatendido.

#### Acceptance Criteria

1. WHILE un Usuario_Maestro tiene una sesión autenticada activa, THE Sistema SHALL mostrar un botón de cierre de sesión visible en la barra de navegación del Panel_Administrativo etiquetado como "Cerrar Sesión"
2. WHEN un Usuario_Maestro hace clic en el botón de cierre de sesión, THE Sistema SHALL eliminar el identificador de sesión del almacenamiento local del navegador
3. WHEN el cierre de sesión de un Usuario_Maestro se completa exitosamente, THE Sistema SHALL redirigir al usuario a la pantalla de inicio de sesión del panel administrativo
4. WHEN una sesión de Usuario_Maestro se cierra, THE Sistema SHALL limpiar de la memoria del navegador los datos temporales incluyendo perfiles de usuario, listas de eventos cargadas y métricas en caché
5. IF la solicitud de cierre de sesión al servidor falla por error de red, THEN THE Sistema SHALL eliminar el identificador de sesión localmente y redirigir al inicio de sesión sin bloquear al usuario
6. WHEN un Usuario_Maestro intenta acceder a una ruta protegida del Panel_Administrativo después del cierre de sesión, THE Sistema SHALL verificar la ausencia del identificador de sesión válido y redirigir a la pantalla de inicio de sesión sin mostrar contenido administrativo
7. WHEN un Usuario_Maestro con sesión expirada intenta acceder al Panel_Administrativo, THE Sistema SHALL detectar la expiración, eliminar el identificador de sesión, y redirigir a la pantalla de inicio de sesión mostrando el mensaje "Tu sesión ha expirado. Por favor inicia sesión nuevamente"

### Requirement 7: Creación de Eventos y Formularios

**User Story:** Como personal de dirección, quiero crear nuevos eventos y formularios de autorización desde el panel administrativo, para que los padres reciban notificaciones de nuevas autorizaciones necesarias.

#### Acceptance Criteria

1. WHEN un Usuario_Maestro envía un formulario de creación de evento desde el Panel_Administrativo, THE Sistema SHALL validar que título no exceda 200 caracteres, descripción no exceda 1000 caracteres, y fecha_limite sea una fecha válida en formato YYYY-MM-DD no anterior a la fecha actual
2. WHEN un Usuario_Maestro envía un formulario de creación de evento y todas las validaciones son exitosas, THE Sistema SHALL insertar un registro en Tabla_Eventos_Autorizaciones con los campos título, descripción, fecha_limite y estado con valor "activo"
3. WHEN un Usuario_Maestro envía un formulario de creación de evento, THE Sistema SHALL validar que los campos título, descripción y fecha_limite contienen al menos un carácter no vacío excluyendo espacios en blanco
4. WHEN un evento es insertado exitosamente en Tabla_Eventos_Autorizaciones, THE Sistema SHALL mostrar al Usuario_Maestro un mensaje de confirmación indicando "Evento creado exitosamente" con un icono de éxito visible
5. WHEN un evento es insertado exitosamente en Tabla_Eventos_Autorizaciones, THE Sistema SHALL actualizar inmediatamente la lista de eventos en el Panel_Administrativo para incluir el nuevo evento sin requerir recarga manual de la página
6. IF la inserción de un evento en Tabla_Eventos_Autorizaciones falla por error de base de datos, THEN THE Sistema SHALL preservar los datos ingresados en el formulario de creación y mostrar el mensaje "No se pudo crear el evento. Verifica tu conexión e intenta de nuevo"
7. IF un campo del formulario de creación de evento excede la longitud máxima permitida o tiene formato inválido, THEN THE Sistema SHALL prevenir el envío y mostrar un mensaje de error identificando el campo problemático y el requisito específico no cumplido
8. WHEN el Sistema crea un nuevo evento, THE Sistema SHALL notificar a los padres con formularios pendientes mediante un indicador visible en su próximo inicio de sesión

### Requirement 8: Modificación de Eventos Existentes

**User Story:** Como personal de dirección, quiero modificar eventos existentes, para corregir información incorrecta o actualizar fechas límite.

#### Acceptance Criteria

1. WHEN un Usuario_Maestro selecciona un evento existente para editar, THE Sistema SHALL cargar en un formulario de edición los valores actuales de título, descripción, fecha_limite y estado del evento
2. WHEN un Usuario_Maestro actualiza los campos de un evento, THE Sistema SHALL validar que título no exceda 200 caracteres, descripción no exceda 1000 caracteres, y fecha_limite sea una fecha válida en formato YYYY-MM-DD no anterior a la fecha actual
3. WHEN un Usuario_Maestro actualiza los campos de un evento, THE Sistema SHALL validar que título, descripción y fecha_limite no estén vacíos
4. WHEN un Usuario_Maestro guarda cambios en un evento y la validación es exitosa, THE Sistema SHALL actualizar el registro correspondiente en Tabla_Eventos_Autorizaciones
5. IF la actualización del evento falla por error de base de datos, THEN THE Sistema SHALL mostrar un mensaje de error al Usuario_Maestro y preservar los datos ingresados en el formulario
6. WHEN la actualización del evento es exitosa, THE Sistema SHALL mostrar un mensaje de confirmación al Usuario_Maestro indicando que los cambios fueron guardados
7. WHEN un Usuario_Maestro modifica el campo estado de un evento, THE Sistema SHALL permitir seleccionar entre los valores activo e inactivo

### Requirement 9: Métricas de Respuestas por Grupo

**User Story:** Como maestra, quiero ver un reporte de qué alumnos de mi grupo ya respondieron y quiénes faltan, para hacer seguimiento efectivo de autorizaciones pendientes.

#### Acceptance Criteria

1. WHEN un Usuario_Maestro accede a la sección de métricas en el Panel_Administrativo, THE Sistema SHALL mostrar una lista de eventos con estado "pendiente" o "en curso", limitada a los últimos 50 eventos ordenados por fecha de inicio descendente
2. WHEN un Usuario_Maestro selecciona un evento específico, THE Sistema SHALL calcular y mostrar las métricas de respuesta para los grupos asignados a ese Usuario_Maestro dentro de 3 segundos
3. WHEN las métricas se calculan exitosamente para un evento seleccionado, THE Sistema SHALL mostrar para cada grupo asignado al Usuario_Maestro el número total de alumnos, el número de respuestas recibidas y el número de respuestas faltantes
4. WHEN las métricas se calculan exitosamente para un evento seleccionado, THE Sistema SHALL mostrar una lista de hasta 200 alumnos que no han registrado respuesta, incluyendo nombre completo y matrícula, organizados por grupo
5. WHEN el Usuario_Maestro visualiza las métricas, THE Sistema SHALL organizar los grupos en orden alfanumérico ascendente basado en el identificador del grupo
6. WHEN se registra una nueva respuesta de autorización para un evento cuyas métricas están siendo visualizadas, THE Sistema SHALL actualizar las métricas mostradas dentro de 5 segundos
7. IF la sección de métricas no contiene eventos con estado "pendiente" o "en curso", THEN THE Sistema SHALL mostrar un mensaje indicando que no hay eventos disponibles para visualizar
8. IF el cálculo de métricas falla o excede el tiempo de 3 segundos, THEN THE Sistema SHALL mostrar un mensaje de error indicando que las métricas no están disponibles temporalmente
9. WHERE un Usuario_Maestro tiene grupos asignados, THE Sistema SHALL mostrar únicamente las métricas de respuesta correspondientes a los alumnos pertenecientes a dichos grupos asignados

### Requirement 10: Diseño Responsivo Mobile-First

**User Story:** Como padre que usa principalmente mi celular, quiero que todos los formularios y botones sean fáciles de usar en una pantalla pequeña, para poder responder sin frustración.

#### Acceptance Criteria

1. WHERE el Sistema se visualiza en un dispositivo con ancho de ventana menor o igual a 768 píxeles, THE Sistema SHALL diseñar todos los campos de entrada de formularios con dimensiones mínimas de 44 píxeles de altura por 44 píxeles de ancho para áreas táctiles
2. THE Sistema SHALL diseñar todos los botones con dimensiones mínimas de 44 píxeles de altura y separación mínima de 16 píxeles entre elementos interactivos adyacentes
3. THE Sistema SHALL aplicar la paleta de colores institucional definida utilizando azul primario (#2563EB), verde éxito (#059669), y ámbar de acento (#F59E0B) para elementos de interfaz correspondientes
4. THE Sistema SHALL utilizar tipografía con jerarquía visual definida aplicando tamaño 24 píxeles y peso negrita para títulos principales, tamaño 18 píxeles y peso seminegrita para subtítulos, y tamaño 16 píxeles para texto base
5. THE Sistema SHALL diseñar tarjetas de contenido con bordes redondeados de radio mínimo 16 píxeles y padding interno mínimo de 24 píxeles para separación visual clara
6. WHERE el Sistema se visualiza en un dispositivo con ancho de ventana menor o igual a 768 píxeles, THE Sistema SHALL adaptar el diseño para que el contenido ocupe el ancho completo sin requerir desplazamiento horizontal ni zoom manual
7. THE Sistema SHALL utilizar fondos con contraste suficiente aplicando gris claro (#F8FAFC) para fondos generales y blanco (#FFFFFF) para tarjetas de contenido con sombras suaves para profundidad visual
8. THE Sistema SHALL cumplir con el estándar WCAG 2.1 nivel AA para contraste de color entre texto y fondo alcanzando una relación mínima de 4.5:1 para texto normal y 3:1 para texto grande
9. IF el Sistema se visualiza en un dispositivo con ancho de ventana mayor a 1920 píxeles o menor a 320 píxeles, THEN THE Sistema SHALL mostrar un mensaje indicando que el tamaño de pantalla no está optimizado y sugerir ajustar el tamaño de la ventana

### Requirement 11: Validación de Restricción de Unicidad en Respuestas

**User Story:** Como administrador del sistema, quiero garantizar que cada padre solo pueda enviar una respuesta por evento y alumno, para mantener la integridad de los datos de autorización.

#### Acceptance Criteria

1. WHEN el Sistema inserta una nueva Respuesta_Autorización, THE Sistema SHALL consultar Tabla_Respuestas_Autorizaciones para verificar que no existe un registro previo con la misma combinación de evento_id y matricula_alumno
2. IF la verificación de unicidad detecta un registro duplicado para la combinación evento_id y matricula_alumno, THEN THE Sistema SHALL rechazar la inserción antes de intentar escribir en la base de datos
3. IF la verificación de unicidad detecta un registro duplicado, THEN THE Sistema SHALL retornar al Usuario_Padre un mensaje de error indicando "Ya existe una respuesta registrada para este formulario y alumno. No se permiten respuestas duplicadas"
4. WHEN un Usuario_Padre selecciona un evento para el cual ya existe una respuesta en Tabla_Respuestas_Autorizaciones con su matricula_alumno, THE Sistema SHALL mostrar la respuesta existente en formato de solo lectura con los campos nombre_tutor, parentesco_tutor, autoriza, alergias y nota_adicional visibles pero no editables
5. WHERE un Usuario_Maestro tiene el rol administrativo definido en Tabla_Usuarios_Maestros, THE Sistema SHALL mostrar una opción de eliminar respuestas duplicadas en el Panel_Administrativo al visualizar detalles de un evento
6. WHEN un Usuario_Maestro con rol administrativo solicita eliminar una respuesta duplicada, THE Sistema SHALL mostrar una confirmación solicitando verificación antes de proceder con la eliminación

### Requirement 12: Gestión de Estado de Eventos (Activo/Inactivo)

**User Story:** Como personal de dirección, quiero poder activar o desactivar eventos, para controlar qué formularios están disponibles para los padres en cada momento.

#### Acceptance Criteria

1. WHEN un Usuario_Maestro marca un evento como inactivo en el Panel_Administrativo, THE Sistema SHALL actualizar el campo estado del registro correspondiente en Tabla_Eventos_Autorizaciones al valor "inactivo"
2. WHERE un evento tiene el campo estado con valor "inactivo" en Tabla_Eventos_Autorizaciones, THE Sistema SHALL excluirlo de la consulta de eventos disponibles mostrados a Usuario_Padre
3. WHERE un evento tiene el campo estado con valor "inactivo" en Tabla_Eventos_Autorizaciones, THE Sistema SHALL mantener sin modificación todos los registros asociados en Tabla_Respuestas_Autorizaciones
4. WHEN un Usuario_Maestro marca un evento previamente inactivo como activo en el Panel_Administrativo, THE Sistema SHALL actualizar el campo estado en Tabla_Eventos_Autorizaciones al valor "activo" y el evento aparecerá en la lista de formularios disponibles para Usuario_Padre en su próximo acceso o actualización de la página
5. WHILE un Usuario_Maestro visualiza la lista de eventos en el Panel_Administrativo, THE Sistema SHALL indicar visualmente el estado de cada evento mediante un badge verde con texto "Activo" para eventos con estado "activo" y un badge gris con texto "Inactivo" para eventos con estado "inactivo"
6. IF la actualización del campo estado falla por error de base de datos, THEN THE Sistema SHALL mostrar un mensaje de error al Usuario_Maestro indicando "No se pudo actualizar el estado del evento. Intenta de nuevo" sin cambiar el estado visual del evento en la interfaz

### Requirement 13: Persistencia de Sesiones en el Navegador

**User Story:** Como usuario del sistema, quiero que mi sesión se mantenga activa mientras no cierre sesión explícitamente, para no tener que autenticarme constantemente.

#### Acceptance Criteria

1. WHEN un usuario inicia sesión exitosamente como Usuario_Padre o Usuario_Maestro, THE Sistema SHALL almacenar un identificador de sesión único en el almacenamiento local del navegador con duración de 30 días
2. WHEN un usuario cierra y vuelve a abrir el navegador sin haber cerrado sesión explícitamente, THE Sistema SHALL intentar restaurar la sesión consultando el identificador almacenado localmente y validándolo contra el servidor
3. IF el identificador de sesión almacenado no es válido según la validación del servidor o la sesión ha expirado por tiempo, THEN THE Sistema SHALL eliminar el identificador del almacenamiento local y redirigir al usuario a la pantalla de inicio de sesión mostrando el mensaje "Tu sesión ha expirado. Por favor inicia sesión nuevamente"
4. WHEN el Sistema carga cualquier página protegida (Panel_Administrativo o vistas de Usuario_Padre), THE Sistema SHALL verificar la existencia y validez del identificador de sesión antes de renderizar contenido protegido
5. WHEN un usuario cierra sesión explícitamente haciendo clic en el botón de cierre de sesión, THE Sistema SHALL eliminar el identificador de sesión del almacenamiento local del navegador inmediatamente
6. IF el almacenamiento local del navegador no está disponible por restricciones de privacidad o configuración, THEN THE Sistema SHALL mostrar un mensaje al usuario indicando "El almacenamiento local no está disponible. Por favor habilita las cookies y el almacenamiento local en tu navegador para usar esta aplicación"
7. IF la consulta de validación de sesión al servidor falla por problemas de red, THEN THE Sistema SHALL mantener la sesión local activa temporalmente y mostrar un indicador de "Modo sin conexión" hasta que la conectividad se restaure

### Requirement 14: Visualización de Detalles de Respuestas para Maestros

**User Story:** Como maestra, quiero ver los detalles completos de las respuestas de autorización (nombre del tutor, parentesco, alergias, notas), para tener toda la información necesaria al organizar un evento.

#### Acceptance Criteria

1. WHEN un Usuario_Maestro selecciona un evento en la sección de métricas del Panel_Administrativo, THE Sistema SHALL consultar Tabla_Respuestas_Autorizaciones y mostrar la lista completa de respuestas registradas para ese evento dentro de 3 segundos
2. WHEN el Sistema muestra respuestas registradas para un evento, THE Sistema SHALL mostrar para cada respuesta los campos: nombre del alumno, matrícula del alumno, nombre_tutor, parentesco_tutor, autoriza (Sí/No), alergias (texto o "Ninguna") y nota_adicional (texto o "Ninguna")
3. WHEN un Usuario_Maestro visualiza las respuestas de un evento, THE Sistema SHALL organizar la información agrupada por el campo grado_grupo de Tabla_Alumnos y luego alfabéticamente por apellido y nombre del alumno dentro de cada grupo
4. WHERE una respuesta tiene el campo autoriza con valor false o "No", THE Sistema SHALL resaltar visualmente esa respuesta aplicando un borde rojo de 2 píxeles y un icono de advertencia visible junto al nombre del alumno
5. WHEN un Usuario_Maestro visualiza los campos alergias o nota_adicional, THE Sistema SHALL mostrar el texto completo sin truncamiento respetando el límite máximo de 1000 caracteres por campo definido en validación de entrada
6. WHEN un Usuario_Maestro hace clic en el botón "Exportar a PDF" en la vista de respuestas, THE Sistema SHALL generar un archivo PDF descargable conteniendo la lista completa de respuestas con todos los campos visibles organizados por grupo
7. IF la consulta de respuestas a Tabla_Respuestas_Autorizaciones no retorna ningún registro para el evento seleccionado, THEN THE Sistema SHALL mostrar el mensaje "No hay respuestas registradas para este evento aún" en el centro de la vista
8. WHEN el Sistema muestra una lista de respuestas que excede 50 registros, THE Sistema SHALL implementar paginación mostrando 50 respuestas por página con controles de navegación visibles

### Requirement 15: Manejo de Errores de Conexión a Base de Datos

**User Story:** Como usuario del sistema, quiero recibir mensajes claros cuando hay problemas de conexión, para entender si debo reintentar o contactar soporte técnico.

#### Acceptance Criteria

1. IF una operación de lectura a Supabase falla retornando un código de error de red (timeout, DNS, conexión rechazada), THEN THE Sistema SHALL mostrar al usuario el mensaje "No se pudo conectar a la base de datos. Verifica tu conexión a internet" sin exponer detalles técnicos del error
2. IF una operación de escritura a Supabase falla retornando un código de error de red, THEN THE Sistema SHALL mostrar al usuario el mensaje "No se pudo guardar la información. Verifica tu conexión a internet e intenta nuevamente" y preservar los datos ingresados en el formulario
3. WHEN el Sistema detecta un error de conexión a Supabase, THE Sistema SHALL registrar en la consola del navegador la información técnica del error incluyendo timestamp, tipo de operación, tabla afectada y código de error HTTP para facilitar diagnóstico técnico
4. WHERE una operación de base de datos falla, THE Sistema SHALL mostrar mensajes de error en lenguaje no técnico evitando términos como "query failed", "network timeout" o "HTTP 500" visibles para usuarios finales
5. IF una operación crítica (inserción de respuesta de autorización o creación de evento) falla 3 veces consecutivas en un período de 2 minutos, THEN THE Sistema SHALL mostrar el mensaje "Hemos detectado problemas de conexión. Verifica tu internet o intenta más tarde. Si el problema persiste, contacta soporte técnico"

