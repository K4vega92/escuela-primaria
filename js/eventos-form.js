/**
 * eventos-form.js
 * Controlador de la página formularios/eventos.html.
 *
 * Responsabilidades:
 *  - Verificar sesión de padre (requiere sesión válida).
 *  - Leer ?evento_id= de la URL y cargar los datos del evento.
 *  - Si ya existe respuesta: mostrar en modo solo lectura (Req 11.4).
 *  - Si no existe: mostrar formulario editable.
 *  - Al enviar: validar, llamar enviarRespuesta(), manejar todos los resultados.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 11.1, 11.2, 11.3, 11.4, 15.2
 */

import { getSesionPadre, logoutPadre } from './auth.js'
import { supabase }                    from '../supabaseClient.js'
import { formatearFecha, esVencido }   from './eventos.js'
import { obtenerRespuestaExistente, enviarRespuesta } from './respuestas.js'

// ── Validación de campos del formulario ─────────────────────────────────────

const LIMITES = {
  nombre_tutor:     100,
  parentesco_tutor: 50,
  alergias:         500,
  nota_adicional:   500,
}

/**
 * Valida los campos del formulario de respuesta.
 * @param {{ nombre_tutor, parentesco_tutor, autoriza, alergias, nota_adicional }} campos
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validarCampos(campos) {
  const errors = {}

  // Campos obligatorios — no vacíos (sin solo-whitespace) — Req 3.3
  if (!campos.nombre_tutor?.trim()) {
    errors['nombre_tutor'] = 'El campo Nombre del tutor es obligatorio'
  } else if (campos.nombre_tutor.length > LIMITES.nombre_tutor) {
    // Req 3.8
    errors['nombre_tutor'] = `El campo Nombre del tutor no puede exceder ${LIMITES.nombre_tutor} caracteres`
  }

  if (!campos.parentesco_tutor?.trim()) {
    errors['parentesco_tutor'] = 'El campo Parentesco es obligatorio'
  } else if (campos.parentesco_tutor.length > LIMITES.parentesco_tutor) {
    errors['parentesco_tutor'] = `El campo Parentesco no puede exceder ${LIMITES.parentesco_tutor} caracteres`
  }

  if (!campos.autoriza) {
    errors['autoriza'] = 'Debes seleccionar si autorizas o no'
  }

  // Campos opcionales — solo longitud máxima — Req 3.1, 3.8
  if (campos.alergias && campos.alergias.length > LIMITES.alergias) {
    errors['alergias'] = `El campo Alergias no puede exceder ${LIMITES.alergias} caracteres`
  }

  if (campos.nota_adicional && campos.nota_adicional.length > LIMITES.nota_adicional) {
    errors['nota_adicional'] = `El campo Nota adicional no puede exceder ${LIMITES.nota_adicional} caracteres`
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// ── Utilidades de UI ─────────────────────────────────────────────────────────

function mostrarErrorCampo(id, mensaje) {
  const el = document.getElementById(id)
  if (el) { el.textContent = mensaje }
  const input = document.querySelector(`[name="${id.replace(/-error$/, '').replace(/-/g, '_')}"]`)
  if (input) input.classList.add('is-error')
}

function limpiarTodosLosErrores() {
  document.querySelectorAll('.error-message').forEach((el) => { el.textContent = '' })
  document.querySelectorAll('.is-error').forEach((el) => el.classList.remove('is-error'))
  const errorEnvio = document.getElementById('error-envio')
  if (errorEnvio) {
    errorEnvio.textContent = ''
    errorEnvio.classList.add('hidden')
  }
}

function mostrarErrorEnvio(mensaje) {
  const el = document.getElementById('error-envio')
  if (el) {
    el.textContent = mensaje
    el.classList.remove('hidden')
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

function mostrarToast(mensaje, tipo = 'exito', duracionMs = 4000) {
  const contenedor = document.getElementById('toast-container')
  if (!contenedor) return
  const iconos = { exito: '✓', error: '✕', advertencia: '⚠' }
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

// ── Vistas ───────────────────────────────────────────────────────────────────

/** Muestra el estado de carga y oculta el resto. */
function mostrarCargando() {
  document.getElementById('estado-cargando')?.classList.remove('hidden')
  document.getElementById('estado-error')?.classList.add('hidden')
  document.getElementById('contenido-principal')?.classList.add('hidden')
}

/** Muestra el panel de error genérico con un mensaje personalizado. */
function mostrarError(mensaje) {
  document.getElementById('estado-cargando')?.classList.add('hidden')
  const errorEl = document.getElementById('estado-error')
  const mensajeEl = document.getElementById('estado-error-mensaje')
  if (mensajeEl) mensajeEl.textContent = mensaje
  errorEl?.classList.remove('hidden')
}

/** Rellena el encabezado del evento con los datos de la BD. */
function rellenarEncabezadoEvento(evento) {
  document.getElementById('titulo-evento').textContent        = evento.titulo
  document.getElementById('descripcion-evento').textContent   = evento.descripcion
  document.getElementById('fecha-limite-evento').textContent  = formatearFecha(evento.fecha_evento)
}

/**
 * Muestra la vista de solo lectura con los datos de la respuesta.
 * Se usa tanto para respuestas pre-existentes como para las recién enviadas.
 *
 * @param {{ nombre_tutor, parentesco_tutor, autoriza, alergias, nota_adicional }} datos
 * @param {boolean} [mostrarBannerExito=false]
 *
 * Requirements: 11.4, 3.5
 */
function mostrarSoloLectura(datos, mostrarBannerExito = false) {
  // Ocultar formulario, mostrar solo lectura
  document.getElementById('vista-formulario')?.classList.add('hidden')
  const seccionSL = document.getElementById('vista-solo-lectura')
  seccionSL?.classList.remove('hidden')

  // Banner de éxito tras envío (Req 3.5)
  const bannerExito = document.getElementById('banner-exito')
  if (bannerExito) {
    if (mostrarBannerExito) {
      bannerExito.classList.remove('hidden')
    } else {
      bannerExito.classList.add('hidden')
    }
  }

  // Campos — boolean autoriza puede venir de la BD o de campos del form
  const autorizaTexto =
    datos.autoriza === true || datos.autoriza === 'si' ? 'Sí, autoriza' : 'No autoriza'

  document.getElementById('sl-nombre-tutor').textContent      = datos.nombre_tutor
  document.getElementById('sl-parentesco-tutor').textContent  = datos.parentesco_tutor
  document.getElementById('sl-autoriza').textContent          = autorizaTexto
  document.getElementById('sl-alergias').textContent          = datos.alergias?.trim()      || 'Ninguna'
  document.getElementById('sl-nota-adicional').textContent    = datos.nota_adicional?.trim() || 'Ninguna'
}

/** Muestra el formulario editable y oculta la vista de solo lectura. */
function mostrarFormulario(eventoVencido) {
  document.getElementById('vista-solo-lectura')?.classList.add('hidden')
  const seccionForm = document.getElementById('vista-formulario')
  seccionForm?.classList.remove('hidden')

  // Si el evento está vencido, deshabilitar todos los campos (Req 4.6)
  if (eventoVencido) {
    seccionForm?.querySelectorAll('input, textarea, button[type="submit"]').forEach((el) => {
      el.disabled = true
    })
    mostrarErrorEnvio('Este formulario ya venció. No es posible enviar una respuesta.')
  }
}

// ── Envío del formulario ──────────────────────────────────────────────────────

/**
 * Manejador del evento submit del formulario de respuesta.
 * Orquesta: validación → envío → manejo de resultado.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 11.1, 11.2, 11.3, 15.2
 */
async function manejarEnvio(event, sesion, eventoId) {
  event.preventDefault()
  limpiarTodosLosErrores()

  const form   = event.target
  const btnEnv = document.getElementById('btn-enviar')

  // ── Leer valores del formulario ────────────────────────────────────────────
  const campos = {
    evento_id:        eventoId,
    matricula_alumno: sesion.matricula,
    nombre_tutor:     form.elements['nombre_tutor'].value,
    parentesco_tutor: form.elements['parentesco_tutor'].value,
    autoriza:         form.querySelector('input[name="autoriza"]:checked')?.value ?? '',
    alergias:         form.elements['alergias'].value,
    nota_adicional:   form.elements['nota_adicional'].value,
  }

  // ── Validación en cliente — Req 3.1, 3.3, 3.8 ─────────────────────────────
  const { valid, errors } = validarCampos(campos)

  if (!valid) {
    // Campo a id de error: nombre_tutor → nombre-tutor-error
    const mapaIds = {
      nombre_tutor:     'nombre-tutor-error',
      parentesco_tutor: 'parentesco-tutor-error',
      autoriza:         'autoriza-error',
      alergias:         'alergias-error',
      nota_adicional:   'nota-adicional-error',
    }
    Object.entries(errors).forEach(([campo, mensaje]) => {
      const errorId = mapaIds[campo]
      if (errorId) mostrarErrorCampo(errorId, mensaje)
    })
    // Foco en el primer campo con error
    const primerCampoError = Object.keys(errors)[0]
    const inputFoco = form.elements[primerCampoError]
    if (inputFoco) inputFoco.focus()
    return
  }

  // ── Estado de envío ────────────────────────────────────────────────────────
  if (btnEnv) {
    btnEnv.disabled    = true
    btnEnv.textContent = 'Enviando…'
  }

  // ── Llamar a enviarRespuesta ───────────────────────────────────────────────
  const resultado = await enviarRespuesta(campos)

  // ── Manejar resultado ──────────────────────────────────────────────────────
  if (resultado.ok) {
    // Req 3.5: mensaje de éxito + cambiar a vista solo lectura
    mostrarSoloLectura(campos, true)

  } else if (resultado.error === 'duplicado') {
    // Req 3.4, 11.3: mostrar mensaje de duplicado y cargar respuesta existente
    mostrarErrorEnvio(
      'Ya existe una respuesta registrada para este evento. ' +
      'Puedes verla en tu lista de formularios enviados.'
    )
    // Intentar cargar la respuesta existente y mostrarla en solo lectura
    const { data: respExistente } = await obtenerRespuestaExistente(eventoId, sesion.matricula)
    if (respExistente) {
      mostrarSoloLectura(respExistente, false)
    }

  } else {
    // Req 3.7, 15.2: error de red — preservar datos del formulario, re-habilitar botón
    mostrarErrorEnvio(
      'No se pudo enviar tu respuesta. Verifica tu conexión e intenta de nuevo.'
    )
    if (btnEnv) {
      btnEnv.disabled    = false
      btnEnv.textContent = 'Enviar respuesta'
    }
  }

  // Restaurar botón si sigue visible (caso error de red ya lo hace arriba;
  // en éxito el formulario se oculta, así que este bloque solo aplica en el
  // improbable caso de un flujo adicional)
  if (btnEnv && !btnEnv.disabled) {
    btnEnv.textContent = 'Enviar respuesta'
  }
}

// ── Inicialización ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── 1. Guardia de sesión (Req 2.5, 13.4) ──────────────────────────────────
  const sesion = getSesionPadre()
  if (!sesion) {
    window.location.href = '../index.html'
    return
  }

  // Mostrar nombre del alumno en la barra (Req 1.4)
  const nombreAlumnoEl = document.getElementById('nombre-alumno')
  if (nombreAlumnoEl) nombreAlumnoEl.textContent = sesion.nombre

  // ── 2. Botón logout ────────────────────────────────────────────────────────
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    logoutPadre((mensaje, tipo) => mostrarToast(mensaje, tipo))
  })

  // ── 3. Leer evento_id de la URL ─────────────────────────────────────────────
  const params  = new URLSearchParams(window.location.search)
  const eventoId = params.get('evento_id')

  if (!eventoId) {
    mostrarError('No se especificó un formulario. Regresa a la lista e intenta de nuevo.')
    return
  }

  mostrarCargando()

  // ── 4. Cargar datos del evento ───────────────────────────────────────────────
  let evento
  try {
    const { data, error } = await supabase
      .from('eventos_autorizaciones')
      .select('id, titulo, descripcion, fecha_evento, activo')
      .eq('id', eventoId)
      .maybeSingle()

    if (error) {
      console.error('[Supabase Error]', {
        timestamp:  new Date().toISOString(),
        tabla:      'eventos_autorizaciones',
        operacion:  'SELECT',
        error,
      })
      mostrarError('No se pudo conectar a la base de datos. Verifica tu conexión a internet.')
      return
    }

    if (!data) {
      mostrarError('El formulario solicitado no existe o ya no está disponible.')
      return
    }

    // Evento inactivo — no debe ser accesible (Req 12.2)
    if (data.activo !== true) {
      mostrarError('Este formulario ya no está disponible.')
      return
    }

    evento = data

  } catch (err) {
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla:     'eventos_autorizaciones',
      operacion: 'SELECT',
      err,
    })
    mostrarError('No se pudo conectar a la base de datos. Verifica tu conexión a internet.')
    return
  }

  // ── 5. Verificar respuesta existente (Req 11.4) ───────────────────────────
  const { data: respuestaExistente, error: errorRespuesta } = await obtenerRespuestaExistente(
    eventoId,
    sesion.matricula
  )

  // Mostrar contenido principal
  document.getElementById('estado-cargando')?.classList.add('hidden')
  document.getElementById('contenido-principal')?.classList.remove('hidden')
  rellenarEncabezadoEvento(evento)

  const vencido = esVencido(evento.fecha_evento)

  if (errorRespuesta) {
    // No pudimos verificar duplicados — mostrar formulario pero advertir
    mostrarToast(
      'No se pudo verificar si ya existe una respuesta. Procede con cuidado.',
      'advertencia'
    )
    mostrarFormulario(vencido)

  } else if (respuestaExistente) {
    // Ya respondió — modo solo lectura (Req 11.4)
    mostrarSoloLectura(respuestaExistente, false)

  } else {
    // Sin respuesta previa — mostrar formulario editable
    mostrarFormulario(vencido)
  }

  // ── 6. Conectar envío del formulario ────────────────────────────────────────
  const formRespuesta = document.getElementById('form-respuesta')
  if (formRespuesta) {
    formRespuesta.addEventListener('submit', (event) => manejarEnvio(event, sesion, eventoId))
  }

})
