/**
 * panel-maestros.js
 * Script principal del panel administrativo de maestros.
 *
 * Responsabilidades:
 *  - Verificar sesión al cargar y mostrar la sección correcta
 *  - Manejar envío del formulario de login
 *  - Gestión de pestañas del panel
 *  - Logout
 *
 * Requirements: 5.1, 5.7, 6.1, 6.7
 */

import { getSesionMaestro, loginMaestro, logoutMaestro } from './auth-maestros.js'
import { registrarIntentoFallido, estaBloqueado, resetearIntentos } from './rate-limiter.js'

// ── Referencias DOM ───────────────────────────────────────────────────────────
const seccionLogin = document.getElementById('seccion-login')
const seccionPanel = document.getElementById('seccion-panel')

// Login
const formLogin       = document.getElementById('form-login-maestro')
const inputCorreo     = document.getElementById('correo')
const inputPassword   = document.getElementById('contrasena')
const errorCorreo     = document.getElementById('correo-error')
const errorPassword   = document.getElementById('contrasena-error')
const errorGeneral    = document.getElementById('login-error-general')
const btnSubmitLogin  = document.getElementById('btn-login-submit')
const textoBtn        = document.getElementById('btn-login-texto')
const spinnerBtn      = document.getElementById('btn-login-spinner')

// Panel
const nombreMaestroEl = document.getElementById('nombre-maestro')
const btnLogout       = document.getElementById('btn-logout-maestro')

// Pestañas
const tabBtns    = document.querySelectorAll('[data-tab]')
const tabPanels  = document.querySelectorAll('[data-tab-panel]')

// Toast
const toastContainer = document.getElementById('toast-container')

// ── Toast helper ──────────────────────────────────────────────────────────────

/**
 * Muestra un toast no bloqueante.
 *
 * @param {string} mensaje
 * @param {'exito'|'error'|'advertencia'} tipo
 * @param {number} [duracionMs=4000]
 */
function mostrarToast(mensaje, tipo = 'exito', duracionMs = 4000) {
  if (!toastContainer) return

  const iconos = { exito: '✅', error: '❌', advertencia: '⚠️' }
  const toast  = document.createElement('div')
  toast.className = `toast toast-${tipo}`
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.textContent = `${iconos[tipo] ?? ''} ${mensaje}`

  toastContainer.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 300ms ease'
    setTimeout(() => toast.remove(), 300)
  }, duracionMs)
}

// ── Gestión de sesión al cargar ───────────────────────────────────────────────

/**
 * Verifica la sesión y muestra la sección apropiada.
 * Si la sesión expiró muestra mensaje y redirige.
 *
 * Requirements: 6.7
 */
function inicializarVista() {
  // Detectar parámetro ?expirado en la URL (para redireccionamiento por TTL)
  const params = new URLSearchParams(window.location.search)
  if (params.has('expirado')) {
    mostrarErrorGeneral('Tu sesión ha expirado. Por favor inicia sesión nuevamente.')
    // Limpiar parámetro de URL sin recargar
    history.replaceState(null, '', window.location.pathname)
    mostrarLoginUI()
    return
  }

  const sesion = getSesionMaestro()

  if (sesion) {
    mostrarPanelUI(sesion)
  } else {
    mostrarLoginUI()
  }
}

function mostrarLoginUI() {
  seccionLogin.classList.remove('hidden')
  seccionPanel.classList.add('hidden')
}

function mostrarPanelUI(sesion) {
  seccionLogin.classList.add('hidden')
  seccionPanel.classList.remove('hidden')

  // Rellenar nombre del maestro en la barra nav
  if (nombreMaestroEl) {
    nombreMaestroEl.textContent = sesion.nombre ?? sesion.correo
  }

  // Activar primera pestaña por defecto
  activarTab('eventos')
}

// ── Formulario de login ───────────────────────────────────────────────────────

function limpiarErrores() {
  errorCorreo.textContent   = ''
  errorPassword.textContent = ''
  errorGeneral.textContent  = ''
  errorGeneral.classList.add('hidden')
  inputCorreo.classList.remove('is-error')
  inputPassword.classList.remove('is-error')
}

function mostrarErrorGeneral(mensaje) {
  errorGeneral.textContent = mensaje
  errorGeneral.classList.remove('hidden')
}

function setLoadingLogin(loading) {
  btnSubmitLogin.disabled = loading
  if (textoBtn)   textoBtn.textContent = loading ? 'Verificando…' : 'Iniciar sesión'
  if (spinnerBtn) spinnerBtn.classList.toggle('hidden', !loading)
}

formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault()
  limpiarErrores()

  const correo   = inputCorreo.value
  const password = inputPassword.value

  // 1. Validación de campos no vacíos (sin solo-whitespace) — Req 5.1
  let hayError = false

  if (!correo || !correo.trim()) {
    errorCorreo.textContent = 'El correo es obligatorio.'
    inputCorreo.classList.add('is-error')
    hayError = true
  }

  if (!password || !password.trim()) {
    errorPassword.textContent = 'La contraseña es obligatoria.'
    inputPassword.classList.add('is-error')
    hayError = true
  }

  if (hayError) return

  // 2. Verificar rate limiter — Req 5.7
  const correoNorm = correo.trim().toLowerCase()
  const bloqueado  = estaBloqueado(correoNorm)

  if (bloqueado.bloqueado) {
    const minutos = Math.ceil(bloqueado.tiempoRestante / 60000)
    mostrarErrorGeneral(
      `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos !== 1 ? 's' : ''}.`
    )
    return
  }

  // 3. Llamar loginMaestro
  setLoadingLogin(true)

  const resultado = await loginMaestro(correo, password)

  setLoadingLogin(false)

  if (resultado.ok) {
    // 4. Éxito — resetear intentos y mostrar panel
    resetearIntentos(correoNorm)
    mostrarToast(`Bienvenido, ${resultado.maestro.nombre}`, 'exito', 2000)

    setTimeout(() => {
      mostrarPanelUI(resultado.maestro)
    }, 500)

  } else {
    // 5. Fallo — registrar intento (solo para errores de credenciales, no de red)
    if (resultado.error === 'credenciales' || resultado.error === 'bloqueado') {
      registrarIntentoFallido(correoNorm)

      // Verificar si ahora quedó bloqueado tras este intento
      const ahora = estaBloqueado(correoNorm)
      if (ahora.bloqueado) {
        const minutos = Math.ceil(ahora.tiempoRestante / 60000)
        mostrarErrorGeneral(
          `Demasiados intentos fallidos. Tu cuenta está bloqueada temporalmente por ${minutos} minuto${minutos !== 1 ? 's' : ''}.`
        )
      } else {
        mostrarErrorGeneral(resultado.mensajeUsuario)
      }
    } else {
      // Error de red o validación — no penalizar
      mostrarErrorGeneral(resultado.mensajeUsuario)
    }

    // Solo limpiar la contraseña (nunca mostrarla)
    inputPassword.value = ''
    // El correo se preserva para comodidad del usuario
  }
})

// ── Botón Cerrar Sesión ───────────────────────────────────────────────────────
btnLogout?.addEventListener('click', () => {
  mostrarToast('Sesión cerrada correctamente.', 'exito', 2000)
  logoutMaestro(mostrarToast)
})

// ── Gestión de pestañas ───────────────────────────────────────────────────────

/**
 * Activa la pestaña indicada y muestra su contenido.
 *
 * @param {string} tabId — valor del atributo data-tab
 */
function activarTab(tabId) {
  // Actualizar botones de pestaña
  tabBtns.forEach((btn) => {
    const esActivo = btn.dataset.tab === tabId
    btn.setAttribute('aria-selected', esActivo ? 'true' : 'false')
    btn.classList.toggle('tab-activo', esActivo)
    btn.classList.toggle('tab-inactivo', !esActivo)
  })

  // Mostrar/ocultar paneles de contenido
  tabPanels.forEach((panel) => {
    const esActivo = panel.dataset.tabPanel === tabId
    panel.classList.toggle('hidden', !esActivo)
  })
}

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    activarTab(btn.dataset.tab)
  })
})

// ── Inicialización ────────────────────────────────────────────────────────────
inicializarVista()
