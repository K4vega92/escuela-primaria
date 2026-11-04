/**
 * rate-limiter.js
 * Módulo de control de intentos de login fallidos.
 * Persiste en localStorage para sobrevivir recargas de página.
 *
 * Lógica:
 *  - Hasta 4 intentos fallidos: solo se registran.
 *  - Al 5.º intento fallido en una ventana de 15 min: bloqueo de 30 min
 *    contado desde ese 5.º intento.
 *
 * Requirements: 5.7
 */

// ── Constantes ────────────────────────────────────────────────────────────────
const VENTANA_MS      = 15 * 60 * 1000  // 15 minutos
const BLOQUEO_MS      = 30 * 60 * 1000  // 30 minutos
const MAX_INTENTOS    = 5               // intentos antes del bloqueo

/**
 * Genera la clave de localStorage para un identificador dado.
 * @param {string} identificador — correo en minúsculas
 * @returns {string}
 */
function claveLS(identificador) {
  return `rate_limit_${identificador.toLowerCase().trim()}`
}

/**
 * Lee el estado de rate-limit almacenado en localStorage.
 * Retorna un objeto limpio si no existe o está corrupto.
 *
 * @param {string} identificador
 * @returns {{ intentos: number, primeraFallaEpoch: number, bloqueadoHasta?: number }}
 */
function leerEstado(identificador) {
  try {
    const raw = localStorage.getItem(claveLS(identificador))
    if (!raw) return { intentos: 0, primeraFallaEpoch: 0 }
    const estado = JSON.parse(raw)
    if (typeof estado.intentos !== 'number') return { intentos: 0, primeraFallaEpoch: 0 }
    return estado
  } catch {
    return { intentos: 0, primeraFallaEpoch: 0 }
  }
}

/**
 * Persiste el estado en localStorage.
 *
 * @param {string} identificador
 * @param {{ intentos: number, primeraFallaEpoch: number, bloqueadoHasta?: number }} estado
 */
function guardarEstado(identificador, estado) {
  try {
    localStorage.setItem(claveLS(identificador), JSON.stringify(estado))
  } catch {
    // Si localStorage no está disponible, degradamos silenciosamente
  }
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Registra un intento fallido de login para el identificador dado.
 * Si se alcanza MAX_INTENTOS dentro de VENTANA_MS, establece bloqueo de BLOQUEO_MS.
 *
 * Requirements: 5.7
 *
 * @param {string} identificador — correo del maestro
 */
export function registrarIntentoFallido(identificador) {
  const ahora  = Date.now()
  const estado = leerEstado(identificador)

  // Si ya está bloqueado, no modificar el estado (el bloqueo ya está activo)
  if (estado.bloqueadoHasta && estado.bloqueadoHasta > ahora) {
    return
  }

  // Si la ventana de 15 min ya expiró, reiniciar contador
  const ventanaExpirada =
    !estado.primeraFallaEpoch ||
    ahora - estado.primeraFallaEpoch > VENTANA_MS

  if (ventanaExpirada) {
    guardarEstado(identificador, {
      intentos:         1,
      primeraFallaEpoch: ahora,
    })
    return
  }

  // Incrementar intentos dentro de la ventana activa
  const nuevosIntentos = estado.intentos + 1

  if (nuevosIntentos >= MAX_INTENTOS) {
    // Activar bloqueo desde este momento
    guardarEstado(identificador, {
      intentos:          nuevosIntentos,
      primeraFallaEpoch: estado.primeraFallaEpoch,
      bloqueadoHasta:    ahora + BLOQUEO_MS,
    })
  } else {
    guardarEstado(identificador, {
      intentos:          nuevosIntentos,
      primeraFallaEpoch: estado.primeraFallaEpoch,
    })
  }
}

/**
 * Verifica si un identificador está bloqueado.
 * Si el bloqueo ya expiró lo limpia automáticamente.
 *
 * Requirements: 5.7
 *
 * @param {string} identificador
 * @returns {{ bloqueado: boolean, tiempoRestante?: number }}
 *   tiempoRestante en milisegundos (solo cuando bloqueado: true)
 */
export function estaBloqueado(identificador) {
  const ahora  = Date.now()
  const estado = leerEstado(identificador)

  if (!estado.bloqueadoHasta) {
    return { bloqueado: false }
  }

  const tiempoRestante = estado.bloqueadoHasta - ahora

  if (tiempoRestante <= 0) {
    // Bloqueo expirado — limpiar
    resetearIntentos(identificador)
    return { bloqueado: false }
  }

  return { bloqueado: true, tiempoRestante }
}

/**
 * Resetea el contador de intentos fallidos tras un login exitoso.
 *
 * @param {string} identificador
 */
export function resetearIntentos(identificador) {
  try {
    localStorage.removeItem(claveLS(identificador))
  } catch {
    // degradar silenciosamente
  }
}
