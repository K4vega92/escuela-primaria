/**
 * index.js
 * Controlador de la página principal (index.html).
 *
 * Responsabilidades:
 *  - Verificar sesión de padre al cargar y mostrar la vista correcta
 *  - Conectar el formulario de login con la lógica de autenticación
 *  - Conectar el botón de logout
 *  - Cargar y renderizar la lista de eventos activos con indicadores visuales
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4,
 *               4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.2, 13.4
 */

import { validarMatricula, loginPadre, getSesionPadre, logoutPadre } from './auth.js'
import { obtenerEventosActivos, formatearFecha, esVencido } from './eventos.js'

// ── Utilidades de UI ────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de error inline bajo un campo de formulario.
 * @param {string} elementId  id del <span> de error
 * @param {string} mensaje
 */
function mostrarErrorCampo(elementId, mensaje) {
  const el = document.getElementById(elementId)
  if (el) {
    el.textContent = mensaje
    el.classList.remove('hidden')
  }
}

/**
 * Limpia un mensaje de error inline.
 * @param {string} elementId
 */
function limpiarErrorCampo(elementId) {
  const el = document.getElementById(elementId)
  if (el) {
    el.textContent = ''
    el.classList.add('hidden')
  }
}

/**
 * Muestra una notificación tipo toast no bloqueante.
 *
 * @param {string} mensaje
 * @param {'exito' | 'error' | 'advertencia'} tipo
 * @param {number} [duracionMs=4000]
 */
function mostrarToast(mensaje, tipo = 'exito', duracionMs = 4000) {
  const contenedor = document.getElementById('toast-container')
  if (!contenedor) return

  const iconos = {
    exito:       '✓',
    error:       '✕',
    advertencia: '⚠',
  }

  const toast = document.createElement('div')
  toast.className = `toast toast-${tipo}`
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.innerHTML = `<span aria-hidden="true">${iconos[tipo] ?? '•'}</span> ${mensaje}`

  contenedor.appendChild(toast)

  setTimeout(() => {
    toast.style.transition = 'opacity 200ms ease'
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 200)
  }, duracionMs)
}

// ── Renderizado de la lista de eventos ──────────────────────────────────────

/**
 * Crea el HTML de un elemento de lista para un evento.
 *
 * @param {object} evento — Evento con flag respondido
 * @returns {HTMLLIElement}
 *
 * Requirements: 4.2, 4.3, 4.4, 4.6
 */
function crearItemEvento(evento) {
  const vencido    = esVencido(evento.fecha_evento)
  const respondido = evento.respondido === true

  const li = document.createElement('li')
  li.className = 'card mb-4'

  // Construir badges
  let badges = ''
  if (respondido) {
    badges += `<span class="badge badge-enviado" aria-label="Formulario enviado">✓ Enviado</span>`
  }
  if (vencido) {
    badges += `<span class="badge badge-vencido" aria-label="Formulario vencido">⚠ Vencido</span>`
  }

  // Botón de respuesta
  let botonRespuesta = ''
  if (respondido) {
    // Ya respondido: mostrar botón deshabilitado de "Ver respuesta" para UX
    botonRespuesta = `
      <a
        href="formularios/eventos.html?evento_id=${encodeURIComponent(evento.id)}"
        class="btn btn-secondary"
        aria-label="Ver respuesta enviada para ${evento.titulo}"
      >
        Ver respuesta
      </a>`
  } else if (vencido) {
    // Vencido y sin respuesta: botón deshabilitado (Req 4.6)
    botonRespuesta = `
      <button
        type="button"
        class="btn btn-primary opacity-50 cursor-not-allowed"
        disabled
        aria-disabled="true"
        aria-label="Formulario vencido — no se puede responder"
      >
        Responder
      </button>`
  } else {
    // Activo y sin respuesta: botón habilitado
    botonRespuesta = `
      <a
        href="formularios/eventos.html?evento_id=${encodeURIComponent(evento.id)}"
        class="btn btn-primary"
        aria-label="Responder formulario ${evento.titulo}"
      >
        Responder
      </a>`
  }

  li.innerHTML = `
    <div class="actions-row justify-between mb-2">
      <h3 class="subtitulo" style="flex: 1; margin-right: 0.5rem;">${evento.titulo}</h3>
      <div class="actions-row" style="gap: 0.5rem; margin-bottom: 0;">
        ${badges}
      </div>
    </div>
    <p class="texto-base mb-2">${evento.descripcion}</p>
    <p class="texto-base" style="font-size: 0.875rem; color: var(--color-texto-muted);">
      📅 Fecha del evento: <strong>${formatearFecha(evento.fecha_evento)}</strong>
    </p>
    <div class="actions-row mt-4" style="justify-content: flex-end; margin-bottom: 0;">
      ${botonRespuesta}
    </div>
  `

  return li
}

/**
 * Carga los eventos activos y actualiza la vista de formularios.
 *
 * @param {string} matricula — Matrícula del alumno autenticado
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.2
 */
async function cargarEventos(matricula) {
  const elCargando  = document.getElementById('lista-cargando')
  const elVacia     = document.getElementById('lista-vacia')
  const elLista     = document.getElementById('lista-eventos')

  // Mostrar indicador de carga
  if (elCargando) elCargando.classList.remove('hidden')
  if (elVacia)    elVacia.classList.add('hidden')
  if (elLista)    elLista.classList.add('hidden')

  const { data: eventos, error } = await obtenerEventosActivos(matricula)

  // Ocultar indicador de carga
  if (elCargando) elCargando.classList.add('hidden')

  if (error) {
    // Error de conexión — mostrar toast y dejar lista vacía visible (Req 15.1)
    mostrarToast(error, 'error')
    if (elVacia) elVacia.classList.remove('hidden')
    return
  }

  // Sin eventos activos (Req 4.5)
  if (!eventos || eventos.length === 0) {
    if (elVacia) elVacia.classList.remove('hidden')
    return
  }

  // Rellenar la lista de eventos
  if (elLista) {
    elLista.innerHTML = '' // limpiar elementos anteriores
    eventos.forEach((evento) => {
      elLista.appendChild(crearItemEvento(evento))
    })
    elLista.classList.remove('hidden')
  }
}

// ── Lógica de vistas ────────────────────────────────────────────────────────

/**
 * Muestra la vista de formularios para un padre autenticado y carga eventos.
 *
 * @param {{ nombre: string, matricula: string }} alumno
 *
 * Requirements: 1.4, 4.1
 */
function mostrarVistaFormularios(alumno) {
  const vistaLogin       = document.getElementById('vista-login')
  const vistaFormularios = document.getElementById('vista-formularios')
  const nombreAlumnoEl   = document.getElementById('nombre-alumno')

  if (vistaLogin)       vistaLogin.classList.add('hidden')
  if (vistaFormularios) vistaFormularios.classList.remove('hidden')

  // Mostrar nombre completo del alumno en la barra (Req 1.4)
  if (nombreAlumnoEl && alumno?.nombre) {
    nombreAlumnoEl.textContent = alumno.nombre
  }

  // Cargar la lista de eventos activos (Req 4.1)
  cargarEventos(alumno.matricula)
}

/**
 * Muestra la vista de login.
 */
function mostrarVistaLogin() {
  const vistaLogin       = document.getElementById('vista-login')
  const vistaFormularios = document.getElementById('vista-formularios')

  if (vistaLogin)       vistaLogin.classList.remove('hidden')
  if (vistaFormularios) vistaFormularios.classList.add('hidden')
}

// ── Inicialización ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Verificar sesión al cargar (Req 13.4) ──────────────────────────────
  const sesionExistente = getSesionPadre()

  if (sesionExistente) {
    // Sesión válida → mostrar vista de formularios y cargar eventos (Req 1.5, 4.1)
    mostrarVistaFormularios(sesionExistente)
  } else {
    mostrarVistaLogin()
  }

  // ── 2. Formulario de login (Req 1.1, 1.2, 1.3, 1.6) ──────────────────────
  const formLogin = document.getElementById('form-login-padre')
  const btnSubmit = formLogin?.querySelector('button[type="submit"]')
  const inputMat  = document.getElementById('matricula')

  if (formLogin) {
    formLogin.addEventListener('submit', async (evento) => {
      evento.preventDefault()

      limpiarErrorCampo('matricula-error')
      if (inputMat) inputMat.classList.remove('is-error')

      const valorMatricula = inputMat?.value?.trim() ?? ''

      // Validación de formato en cliente (Req 1.1, 1.6)
      const validacion = validarMatricula(valorMatricula)
      if (!validacion.valid) {
        mostrarErrorCampo('matricula-error', validacion.error)
        if (inputMat) inputMat.classList.add('is-error')
        inputMat?.focus()
        return
      }

      // Deshabilitar botón durante la consulta para evitar doble envío
      if (btnSubmit) {
        btnSubmit.disabled = true
        btnSubmit.textContent = 'Verificando…'
      }

      // Consultar Supabase (Req 1.2, 1.3)
      const resultado = await loginPadre(valorMatricula)

      if (!resultado.ok) {
        mostrarErrorCampo('matricula-error', resultado.mensajeUsuario)
        if (inputMat) inputMat.classList.add('is-error')
        inputMat?.focus()

        if (btnSubmit) {
          btnSubmit.disabled = false
          btnSubmit.textContent = 'Ingresar'
        }
        return
      }

      // Login exitoso → mostrar vista de formularios con lista de eventos (Req 1.4, 4.1)
      mostrarVistaFormularios(resultado.alumno)

      if (btnSubmit) {
        btnSubmit.disabled = false
        btnSubmit.textContent = 'Ingresar'
      }
    })
  }

  // ── 3. Botón de cierre de sesión (Req 2.1, 2.2, 2.3, 2.4) ─────────────────
  const btnLogout = document.getElementById('btn-logout')

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      logoutPadre((mensaje, tipo) => mostrarToast(mensaje, tipo))
    })
  }

})
