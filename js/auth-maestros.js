/**
 * auth-maestros.js
 * Módulo de autenticación para maestros/administrativos.
 * Maneja login por correo + contraseña contra `usuarios_maestros`,
 * persistencia de sesión en sessionStorage (TTL 8h) y logout.
 *
 * Dependencia externa: bcryptjs cargado como script global antes de este módulo
 * (window.dcodeIO.bcrypt o window.bcrypt según versión CDN).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { supabase } from '../supabaseClient.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const CLAVE_SESION_MAESTRO = 'sesion_maestro'
export const TTL_SESION_MS = 8 * 60 * 60 * 1000  // 8 horas en milisegundos

// Caché en memoria para evitar re-parseos innecesarios (se limpia con logoutMaestro)
let _cacheSesion = null

// ── Utilidades internas ───────────────────────────────────────────────────────

/**
 * Resuelve la referencia a bcrypt del CDN.
 * El CDN de bcryptjs 2.4.3 expone dcodeIO.bcrypt globalmente.
 *
 * @returns {object} bcrypt instance
 * @throws {Error} si bcrypt no está cargado
 */
function getBcrypt() {
  /* eslint-disable no-undef */
  if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) return dcodeIO.bcrypt
  if (typeof bcrypt  !== 'undefined') return bcrypt
  /* eslint-enable no-undef */
  throw new Error('[AuthMaestros] bcryptjs no está cargado. Verifica el script CDN en el HTML.')
}

// ── Sesión ────────────────────────────────────────────────────────────────────

/**
 * Lee y valida la sesión del maestro desde sessionStorage.
 * Si está expirada la elimina y retorna null.
 *
 * Requirements: 5.8, 6.7
 *
 * @returns {{ id, nombre, correo, rol, grupos, expiresAt } | null}
 */
export function getSesionMaestro() {
  // Devolver caché en memoria si sigue vigente
  if (_cacheSesion) {
    if (_cacheSesion.expiresAt > Date.now()) return _cacheSesion
    // Caché expirada — limpiar
    _cacheSesion = null
  }

  try {
    const raw = sessionStorage.getItem(CLAVE_SESION_MAESTRO)
    if (!raw) return null

    const sesion = JSON.parse(raw)

    if (!sesion.expiresAt || sesion.expiresAt < Date.now()) {
      // Sesión expirada — eliminar (Req 6.7)
      sessionStorage.removeItem(CLAVE_SESION_MAESTRO)
      return null
    }

    _cacheSesion = sesion
    return sesion
  } catch (err) {
    console.error('[AuthMaestros] Error al leer sesión:', err)
    sessionStorage.removeItem(CLAVE_SESION_MAESTRO)
    return null
  }
}

/**
 * Persiste la sesión del maestro en sessionStorage con TTL 8h.
 * (sessionStorage persiste entre pestañas del mismo origen pero NO entre cierres — Req 5.4)
 *
 * @param {{ id, nombre, correo, rol, grupos }} maestro
 */
function guardarSesionMaestro(maestro) {
  const sesion = {
    id:        maestro.id,
    nombre:    maestro.nombre,
    correo:    maestro.correo,
    rol:       maestro.rol,
    grupos:    Array.isArray(maestro.grupos) ? maestro.grupos : [],
    expiresAt: Date.now() + TTL_SESION_MS,
  }
  try {
    sessionStorage.setItem(CLAVE_SESION_MAESTRO, JSON.stringify(sesion))
    _cacheSesion = sesion
  } catch (err) {
    console.error('[AuthMaestros] Error al guardar sesión:', err)
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Autentica un maestro consultando `usuarios_maestros` y comparando bcrypt.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6
 *
 * @param {string} correo
 * @param {string} password
 * @returns {Promise<
 *   { ok: true,  maestro: object } |
 *   { ok: false, error: 'credenciales'|'bloqueado'|'validacion'|'red', mensajeUsuario: string }
 * >}
 */
export async function loginMaestro(correo, password) {
  // 1. Validación básica de formato (Req 5.1)
  const correoTrim = correo.trim()
  const passValido = password && password.trim().length > 0

  if (!correoTrim || !passValido) {
    return {
      ok: false,
      error: 'validacion',
      mensajeUsuario: 'Completa todos los campos antes de continuar.',
    }
  }

  // 2. Consultar usuarios_maestros (case-insensitive) — Req 5.2
  let data, queryError
  try {
    const resultado = await supabase
      .from('usuarios_maestros')
      .select('id, correo, password_hash, nombre, rol, grupos')
      .ilike('correo', correoTrim)
      .maybeSingle()

    data       = resultado.data
    queryError = resultado.error
  } catch (err) {
    // Error de red inesperado (Req 15.1)
    console.error('[Supabase Error]', {
      timestamp:  new Date().toISOString(),
      tabla:      'usuarios_maestros',
      operacion:  'SELECT',
      err,
    })
    return {
      ok: false,
      error: 'red',
      mensajeUsuario: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet.',
    }
  }

  if (queryError) {
    console.error('[Supabase Error]', {
      timestamp:  new Date().toISOString(),
      tabla:      'usuarios_maestros',
      operacion:  'SELECT',
      error:      queryError,
    })
    return {
      ok: false,
      error: 'red',
      mensajeUsuario: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet.',
    }
  }

  // 3. Correo no encontrado → credenciales inválidas (no revelar cuál campo falló — Req 5.3)
  if (!data) {
    return {
      ok: false,
      error: 'credenciales',
      mensajeUsuario: 'Correo o contraseña incorrectos. Verifica e intenta de nuevo.',
    }
  }

  // 4. Verificar contraseña con bcrypt — Req 5.6
  let passwordValida = false
  try {
    const bc = getBcrypt()
    passwordValida = await bc.compare(password, data.password_hash)
  } catch (err) {
    console.error('[AuthMaestros] Error al comparar contraseña:', err)
    return {
      ok: false,
      error: 'red',
      mensajeUsuario: 'Error interno al verificar credenciales. Intenta más tarde.',
    }
  }

  if (!passwordValida) {
    return {
      ok: false,
      error: 'credenciales',
      mensajeUsuario: 'Correo o contraseña incorrectos. Verifica e intenta de nuevo.',
    }
  }

  // 5. Login exitoso — guardar sesión (Req 5.4)
  guardarSesionMaestro(data)

  return { ok: true, maestro: data }
}

// ── Guardia de ruta ───────────────────────────────────────────────────────────

/**
 * Redirige a panel-maestros.html si no hay sesión válida.
 * Usar en páginas del panel que requieren autenticación de maestro.
 *
 * Requirements: 6.6
 */
export function requireSesionMaestro() {
  const sesion = getSesionMaestro()
  if (!sesion) {
    window.location.href = '/panel-maestros.html'
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Cierra la sesión del maestro:
 *  1. Limpia sessionStorage
 *  2. Limpia caché en memoria
 *  3. Redirige al login (panel-maestros.html)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * @param {(mensaje: string, tipo: string) => void} [mostrarToastFn]
 */
export function logoutMaestro(mostrarToastFn) {
  try {
    // Eliminar sesión de sessionStorage (Req 6.2)
    sessionStorage.removeItem(CLAVE_SESION_MAESTRO)

    // Limpiar caché en memoria (Req 6.3)
    _cacheSesion = null

  } catch (err) {
    console.error('[AuthMaestros] Error al cerrar sesión:', err)
    try {
      sessionStorage.removeItem(CLAVE_SESION_MAESTRO)
      _cacheSesion = null
    } catch (_) { /* noop */ }

    if (typeof mostrarToastFn === 'function') {
      mostrarToastFn('La sesión se cerró localmente.', 'advertencia')
    }
  }

  // Redirigir al login (Req 6.5)
  // Pequeño delay para que el toast sea visible si se usó (Req 6.4)
  setTimeout(() => {
    window.location.href = 'panel-maestros.html'
  }, 1500)
}
