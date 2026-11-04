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

import { getSesionMaestro, logoutMaestro } from './auth-maestros.js'
import { cargarEventosPanel, inicializarModal, abrirModalNuevoEvento } from './eventos-panel.js'
import { inicializarMetricas, inicializarRespuestas, cancelarRealtime } from './metricas-panel.js'

// ── Referencias DOM ───────────────────────────────────────────────────────────

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

// ── Inicialización del panel ──────────────────────────────────────────────────
// El guard inline en el HTML ya redirigió si no hay sesión,
// así que aquí llegamos solo con sesión válida.

const sesion = getSesionMaestro()

// Rellenar nombre del maestro en la barra nav
if (nombreMaestroEl && sesion) {
  nombreMaestroEl.textContent = sesion.nombre ?? sesion.correo
}

// Inicializar modal de eventos
inicializarModal()

// Conectar botón "Nuevo evento"
document.getElementById('btn-nuevo-evento')?.addEventListener('click', () => {
  abrirModalNuevoEvento()
})

// ── Botón Cerrar Sesión ───────────────────────────────────────────────────────
btnLogout?.addEventListener('click', () => {
  cancelarRealtime()
  mostrarToast('Sesión cerrada correctamente.', 'exito', 2000)
  logoutMaestro(mostrarToast)
})

// ── Gestión de pestañas ───────────────────────────────────────────────────────

/**
 * Activa la pestaña indicada y muestra su contenido.
 * Carga los datos de cada sección la primera vez que se activa.
 */
function activarTab(tabId) {
  tabBtns.forEach((btn) => {
    const esActivo = btn.dataset.tab === tabId
    btn.setAttribute('aria-selected', esActivo ? 'true' : 'false')
    btn.classList.toggle('tab-activo', esActivo)
    btn.classList.toggle('tab-inactivo', !esActivo)
  })

  tabPanels.forEach((panel) => {
    const esActivo = panel.dataset.tabPanel === tabId
    panel.classList.toggle('hidden', !esActivo)
  })

  if (!sesion) return

  if (tabId === 'eventos') {
    cargarEventosPanel()
  } else if (tabId === 'metricas') {
    inicializarMetricas(sesion)
  } else if (tabId === 'respuestas') {
    inicializarRespuestas(sesion)
  }
}

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => activarTab(btn.dataset.tab))
})

// Activar primera pestaña al cargar
activarTab('eventos')
