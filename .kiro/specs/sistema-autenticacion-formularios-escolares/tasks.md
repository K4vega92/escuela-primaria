# Implementation Plan: Sistema de Autenticación por Roles, Formularios de Autorización y Panel de Control Docente

## Overview

Plan de implementación MVP directo, sin capas de testing ni arquitectura compleja. El objetivo es construir el sistema funcional lo más rápido posible siguiendo el orden natural de dependencias: infraestructura → autenticación de padres → formularios → autenticación de maestros → panel administrativo.

## Tasks

- [x] 1. Infraestructura y Supabase
  - [x] 1.1 Crear el archivo `supabaseClient.js` inicializando el cliente de Supabase con `SUPABASE_URL` y la `Publishable key` (via CDN ES modules)
    - Importar el cliente de Supabase desde CDN usando ES modules
    - Inicializar con SUPABASE_URL y anon/publishable key como constantes
    - Exportar la instancia `supabase` para uso en todos los módulos
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 1.2 Crear la estructura de estilos y clases base con Tailwind CSS (CDN) aplicando la paleta institucional y diseño Mobile-First
    - Definir paleta institucional: azul primario `#2563EB`, verde éxito `#059669`, ámbar acento `#F59E0B`, fondo `#F8FAFC`, blanco `#FFFFFF` para tarjetas
    - Asegurar áreas táctiles mínimas de 44×44px en todos los campos de entrada y botones
    - Aplicar tipografía con jerarquía: 24px negrita títulos, 18px seminegrita subtítulos, 16px texto base
    - Tarjetas con bordes redondeados mínimo 16px y padding interno mínimo 24px
    - Separación mínima de 16px entre elementos interactivos adyacentes
    - Contenido ocupa ancho completo en pantallas ≤768px sin desplazamiento horizontal
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 2. Módulo de Autenticación de Padres
  - [x] 2.1 Desarrollar en `index.html` la vista de login para padres con campo de Matrícula
    - Crear el formulario de login con campo de matrícula, etiqueta en español y asterisco rojo (*) para campo obligatorio
    - Área táctil del campo mínimo 44×44px
    - Botón de envío con estilos de paleta institucional (azul `#2563EB`)
    - Mostrar/ocultar entre vista de login (`#vista-login`) y vista de formularios (`#vista-formularios`) según estado de sesión
    - Verificar `localStorage` al cargar: si hay sesión válida de padre, mostrar directamente `#vista-formularios`
    - _Requirements: 1.1, 1.6, 13.4_

  - [x] 2.2 Implementar la lógica para consultar la tabla `alumnos`, validar la matrícula, guardar la sesión en `localStorage` (duración 24h) y mostrar el nombre completo del alumno
    - Validar que la matrícula contiene al menos un carácter alfanumérico y no excede 20 caracteres; mostrar "Formato de matrícula inválido" si falla
    - Consultar `alumnos` WHERE `matricula = valor`; si no existe mostrar "Matrícula no encontrada. Verifica el número e intenta de nuevo"
    - En éxito: guardar en `localStorage` clave `sesion_padre` con `{ matricula, nombre_completo, grupo, expiresAt: Date.now() + 24*60*60*1000 }`
    - Mostrar nombre completo del alumno en la parte superior de la interfaz tras login exitoso
    - Al cargar cualquier vista protegida de padre: leer `sesion_padre`, si `expiresAt < Date.now()` eliminar y redirigir al login
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 13.1, 13.2, 13.3, 13.5_

  - [x] 2.3 Implementar el botón y la función de cierre de sesión `logoutPadre` para limpiar el almacenamiento local y regresar al login
    - Mostrar botón "Cerrar Sesión" en esquina superior derecha mientras hay sesión activa
    - Al hacer clic: eliminar clave `sesion_padre` de `localStorage`, limpiar datos temporales de memoria, redirigir a la vista de login en `index.html` dentro de 2 segundos
    - Si falla por error de red: eliminar sesión localmente de todas formas, mostrar "La sesión se cerró localmente" y redirigir
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Módulo de Formularios de Autorización (Padres)
  - [x] 3.1 Crear la vista en `index.html` que consulta `eventos_autorizaciones` y lista eventos activos con indicadores visuales
    - Consultar `eventos_autorizaciones` WHERE `estado = 'activo'` al mostrar la vista de formularios
    - Para cada evento consultar `respuestas_autorizaciones` con la matrícula del alumno y marcar flag `respondido`
    - Ordenar eventos por `fecha_limite` ASC (más próximos primero)
    - Mostrar para cada evento: título, descripción, fecha límite en formato DD/MM/YYYY
    - Badge verde "Enviado" si el evento ya tiene respuesta del alumno
    - Badge ámbar "Vencido" si `fecha_limite < fecha actual`; deshabilitar botón de respuesta para eventos vencidos
    - Mensaje "No hay formularios pendientes en este momento" centrado si no hay eventos activos
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.2_

  - [x] 3.2 Crear el formulario de respuesta de autorización (vista dinámica o archivo separado) con validación de campos
    - Al hacer clic en un evento: navegar a `formularios/eventos.html?evento_id={id}` o mostrar vista dinámica con los datos del evento
    - Verificar si ya existe respuesta: si existe mostrar en modo solo lectura (campos no editables)
    - Si no existe respuesta: mostrar formulario con campos `nombre_tutor` (obligatorio, ≤100 chars), `parentesco_tutor` (obligatorio, ≤50 chars), `autoriza` radio Sí/No (obligatorio), `alergias` (opcional, ≤500 chars), `nota_adicional` (opcional, ≤500 chars)
    - Marcar campos obligatorios con asterisco rojo (*)
    - Validar campos obligatorios no vacíos (sin solo-whitespace) y longitudes máximas antes de enviar; mostrar errores inline por campo
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.8, 11.4_

  - [x] 3.3 Conectar el envío del formulario con la tabla `respuestas_autorizaciones` aplicando validación de unicidad
    - Antes de insertar: verificar en `respuestas_autorizaciones` que no existe registro con misma combinación `evento_id` + `matricula_alumno`
    - Si existe duplicado: rechazar envío y mostrar "Ya existe una respuesta registrada para este evento. Puedes verla en tu lista de formularios enviados"
    - Si es único: insertar en `respuestas_autorizaciones` los campos `evento_id`, `matricula_alumno`, `nombre_tutor`, `parentesco_tutor`, `autoriza`, `alergias` (vacío si no se proporcionó), `nota_adicional` (vacío si no se proporcionó)
    - En éxito: mostrar "Tu respuesta fue registrada exitosamente" con icono de éxito visible
    - En error de red: preservar datos del formulario y mostrar "No se pudo enviar tu respuesta. Verifica tu conexión e intenta de nuevo"
    - _Requirements: 3.2, 3.4, 3.5, 3.7, 11.1, 11.2, 11.3, 15.2_

- [ ] 4. Módulo de Autenticación y Panel de Maestros
  - [x] 4.1 Crear `panel-maestros.html` con vista de inicio de sesión por correo y contraseña validando contra `usuarios_maestros`
    - Formulario con campos `correo` y `contraseña`; validar que no estén vacíos antes de consultar
    - Consultar `usuarios_maestros` WHERE `LOWER(correo) = LOWER(valor)`, comparar contraseña (hash bcrypt con bcrypt.js CDN)
    - Si credenciales inválidas: mostrar "Credenciales inválidas. Verifica tu correo y contraseña" sin revelar cuál campo es incorrecto
    - Rate limiting: bloquear login tras 5 intentos fallidos en 15 minutos durante 30 minutos (estado en `localStorage`)
    - En éxito: guardar sesión en `sessionStorage` clave `sesion_maestro` con `{ id, nombre, correo, rol, grupos, expiresAt: Date.now() + 8*60*60*1000 }`
    - Sesión expira a las 8 horas; al acceder con sesión expirada redirigir mostrando "Tu sesión ha expirado. Por favor inicia sesión nuevamente"
    - Botón "Cerrar Sesión" en barra de navegación del panel; al cerrar: limpiar `sessionStorage`, limpiar caché en memoria, redirigir al login
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 4.2 Desarrollar el panel administrativo con pestañas para Crear y Modificar Eventos escribiendo en `eventos_autorizaciones`
    - Mostrar lista de todos los eventos (activos e inactivos) con badge verde "Activo" o gris "Inactivo" por cada evento
    - Formulario de creación de evento: campos `titulo` (obligatorio, ≤200 chars), `descripcion` (obligatorio, ≤1000 chars), `fecha_limite` (obligatorio, formato YYYY-MM-DD, no anterior a hoy); insertar en `eventos_autorizaciones` con `estado = 'activo'` en éxito; mostrar toast "Evento creado exitosamente"; actualizar lista sin recargar página
    - Al hacer clic en "Editar": cargar valores actuales del evento en formulario de edición (título, descripción, fecha_limite, estado); al guardar actualizar registro en `eventos_autorizaciones`; mostrar confirmación en éxito
    - Permitir cambiar `estado` entre `activo` e `inactivo`; al desactivar: el evento deja de aparecer para padres pero conserva todas sus respuestas
    - Mostrar errores por campo con mensajes específicos; preservar datos del formulario ante errores de red
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 12.1, 12.3, 12.4, 12.5, 12.6_

  - [ ] 4.3 Implementar la sección de Métricas por Grupo en el panel de maestros
    - Selector de evento mostrando eventos activos (últimos 50 ordenados por fecha DESC)
    - Al seleccionar evento: calcular métricas para los grupos asignados al maestro autenticado; mostrar dentro de 3 segundos
    - Por grupo: mostrar número total de alumnos, número de respuestas recibidas, número de respuestas faltantes
    - Lista de hasta 200 alumnos sin respuesta con nombre completo y matrícula, organizados por grupo en orden alfanumérico
    - Suscribirse a Supabase Realtime para actualizar métricas automáticamente cuando se registre una nueva respuesta (dentro de 5 segundos)
    - Mostrar solo grupos asignados al maestro autenticado (`sesion_maestro.grupos`)
    - Si no hay eventos disponibles: mostrar "No hay eventos disponibles para visualizar"
    - Si el cálculo falla o supera 3 segundos: mostrar "Las métricas no están disponibles temporalmente"
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

## Notes

- Stack: HTML5, Tailwind CSS CDN, JavaScript Vanilla, Supabase JS CDN — sin build tools, sin frameworks, sin bundler
- Todos los módulos JS se cargan como `<script type="module">` en cada HTML
- La sesión de padres usa `localStorage` (24h TTL); la sesión de maestros usa `sessionStorage` (8h TTL)
- La restricción UNIQUE `(evento_id, matricula_alumno)` en la BD es la garantía definitiva contra duplicados; la validación en cliente es primera línea de defensa
- bcrypt.js via CDN para comparación de contraseñas en cliente (aceptable para este scope de escuela primaria ~300 alumnos)
- Supabase Realtime para métricas en vivo en el panel de maestros

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2", "4.3"] }
  ]
}
```
