/**
 * auth.js
 * Módulo de autenticación para padres/tutores.
 * Maneja login por matrícula, persistencia de sesión en localStorage y logout.
 *
 * Requirements: 1.1–1.7, 2.1–2.5, 13.1–13.5
 */

import { supabase } from '../supabaseClient.js'

// ── Constantes ──────────────────────────────────────────────────────────────
const CLAVE_SESION_PADRE = 'sesion_padre'
const TTL_SESION_MS = 24 * 60 * 60 * 1000  // 24 horas en milisegundos

// ── Validación de matrícula ──────────────────────────────────────────────────

/**
 * Valida el formato de una matrícula.
 * Criterios: al menos 1 carácter alfanumérico, máximo 20 caracteres.
 *
 * @param {string} valor
 * @returns {{ valid: boolean, error?: string }}
 *
 * Requirements: 1.1, 1.6
 */
export function validarMatricula(valor) {
  // Rechazar vacío o solo espacios en blanco
  if (!valor || !valor.trim()) {
    return { valid: false, error: 'Formato de matrícula inválido' }
  }

  // Rechazar longitud superior a 20 caracteres
  if (valor.length > 20) {
    return { valid: false, error: 'Formato de matrícula inválido' }
  }

  // Debe contener al menos un carácter alfanumérico (letra o dígito)
  if (!/[a-zA-Z0-9]/.test(valor)) {
    return { valid: false, error: 'Formato de matrícula inválido' }
  }

  return { valid: true }
}

// ── Sesión de padre ──────────────────────────────────────────────────────────

/**
 * Lee y valida la sesión del padre desde localStorage.
 * Si la sesión está expirada la elimina y retorna null.
 *
 * @returns {{ matricula: string, nombre: string, grupo: string, expiresAt: number } | null}
 *
 * Requirements: 1.5, 1.7, 13.1, 13.3, 13.4
 */
export function getSesionPadre() {
  try {
    const raw = localStorage.getItem(CLAVE_SESION_PADRE)
    if (!raw) return null

    const sesion = JSON.parse(raw)

    // Verificar expiración (Req 1.7, 13.3)
    if (!sesion.expiresAt || sesion.expiresAt < Date.now()) {
      localStorage.removeItem(CLAVE_SESION_PADRE)
      return null
    }

    return sesion
  } catch (err) {
    // localStorage podría no estar disponible o el JSON estar corrupto
    console.error('[Auth] Error al leer sesión de padre:', err)
    localStorage.removeItem(CLAVE_SESION_PADRE)
    return null
  }
}

/**
 * Guarda la sesión del padre en localStorage con TTL de 24 horas.
 *
 * @param {{ matricula: string, nombre: string, grupo: string }} alumno
 *
 * Requirements: 1.5, 13.1
 */
function guardarSesionPadre(alumno) {
  const sesion = {
    matricula:       alumno.matricula,
    nombre: alumno.nombre,
    grupo:           alumno.grupo,
    expiresAt:       Date.now() + TTL_SESION_MS,
  }
  localStorage.setItem(CLAVE_SESION_PADRE, JSON.stringify(sesion))
}

// ── Login de padre ───────────────────────────────────────────────────────────

/**
 * Autentica un padre consultando la tabla `alumnos` por matrícula.
 *
 * @param {string} matricula
 * @returns {Promise<
 *   { ok: true,  alumno: { matricula: string, nombre: string, grupo: string } } |
 *   { ok: false, error: 'formato' | 'no_encontrada' | 'red', mensajeUsuario: string }
 * >}
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 13.1, 13.2
 */
export async function loginPadre(matricula) {
  // 1. Validar formato antes de tocar la BD (Req 1.1, 1.6)
  const validacion = validarMatricula(matricula)
  if (!validacion.valid) {
    return {
      ok: false,
      error: 'formato',
      mensajeUsuario: validacion.error,
    }
  }

  // 2. Consultar tabla alumnos (Req 1.2, 1.3)
  try {
    const { data, error } = await supabase
      .from('alumnos')
      .select('matricula, nombre, grupo')
      .eq('matricula', matricula.trim())
      .maybeSingle()

    if (error) {
      // Error de base de datos / red (Req 15.1, 15.3)
      console.error('[Supabase Error]', {
        timestamp:  new Date().toISOString(),
        tabla:      'alumnos',
        operacion:  'SELECT',
        error,
      })
      return {
        ok: false,
        error: 'red',
        mensajeUsuario: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet',
      }
    }

    // Matrícula no encontrada (Req 1.3)
    if (!data) {
      return {
        ok: false,
        error: 'no_encontrada',
        mensajeUsuario: 'Matrícula no encontrada. Verifica el número e intenta de nuevo',
      }
    }

    // 3. Login exitoso — guardar sesión (Req 1.5, 13.1)
    guardarSesionPadre(data)

    return { ok: true, alumno: data }

  } catch (err) {
    // Error de red inesperado (Req 15.1)
    console.error('[Red Error]', {
      timestamp:  new Date().toISOString(),
      tabla:      'alumnos',
      operacion:  'SELECT',
      err,
    })
    return {
      ok: false,
      error: 'red',
      mensajeUsuario: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet',
    }
  }
}

// ── Guardia de ruta ──────────────────────────────────────────────────────────

/**
 * Guarda de ruta para páginas protegidas de padres.
 * Si no hay sesión válida redirige a index.html.
 *
 * Requirements: 2.5, 13.4
 */
export function requireSesionPadre() {
  const sesion = getSesionPadre()
  if (!sesion) {
    window.location.href = '/index.html'
  }
}

// ── Logout de padre ──────────────────────────────────────────────────────────

/**
 * Cierra la sesión del padre: elimina localStorage y redirige al login.
 * Si ocurre algún error durante el cierre, la sesión se elimina igualmente
 * y se muestra un mensaje informativo.
 *
 * @param {(mensaje: string, tipo: string) => void} [mostrarToastFn]
 *   Función opcional de toast para mostrar mensajes al usuario.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function logoutPadre(mostrarToastFn) {
  try {
    // Eliminar sesión del almacenamiento local (Req 2.2)
    localStorage.removeItem(CLAVE_SESION_PADRE)

    // Limpiar cualquier borrador temporal en sessionStorage (Req 2.2)
    sessionStorage.removeItem('borrador_respuesta')

  } catch (err) {
    // Si falla por cualquier razón, igual eliminamos localmente y notificamos (Req 2.4)
    console.error('[Auth] Error al cerrar sesión:', err)
    try { localStorage.removeItem(CLAVE_SESION_PADRE) } catch (_) { /* noop */ }

    if (typeof mostrarToastFn === 'function') {
      mostrarToastFn('La sesión se cerró localmente', 'advertencia')
    }
  }

  // Redirigir a login dentro de 2 segundos (Req 2.3)
  setTimeout(() => {
    window.location.href = 'index.html'
  }, 2000)
}
