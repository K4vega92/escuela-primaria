/**
 * eventos-panel.js
 * Módulo de gestión de eventos del panel administrativo de maestros.
 *
 * Responsabilidades:
 *  - Cargar y renderizar todos los eventos (activos e inactivos)
 *  - Crear nuevos eventos en `eventos_autorizaciones`
 *  - Editar eventos existentes
 *  - Cambiar estado entre activo/inactivo
 *  - Abrir/cerrar el modal de creación/edición
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7,
 *               8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7,
 *               12.1, 12.3, 12.4, 12.5, 12.6
 */

import { supabase } from '../supabaseClient.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const LIMITES = {
  titulo:      200,
  descripcion: 1000,
}

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (sin zona horaria).
 * @returns {string}
 */
function hoyISO() {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes  = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia  = String(hoy.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Formatea una fecha ISO `YYYY-MM-DD` al formato legible `DD/MM/YYYY`.
 * @param {string} fechaIso
 * @returns {string}
 */
function formatearFecha(fechaIso) {
  if (!fechaIso) return ''
  const [anio, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}/${anio}`
}

// ── Toast (helper local) ──────────────────────────────────────────────────────

/**
 * Muestra un toast no bloqueante.
 * @param {string} mensaje
 * @param {'exito'|'error'|'advertencia'} tipo
 * @param {number} [duracionMs=4000]
 */
function mostrarToast(mensaje, tipo = 'exito', duracionMs = 4000) {
  const contenedor = document.getElementById('toast-container')
  if (!contenedor) return

  const iconos = { exito: '✅', error: '❌', advertencia: '⚠️' }
  const toast  = document.createElement('div')
  toast.className = `toast toast-${tipo}`
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.textContent = `${iconos[tipo] ?? ''} ${mensaje}`

  contenedor.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity    = '0'
    toast.style.transition = 'opacity 300ms ease'
    setTimeout(() => toast.remove(), 300)
  }, duracionMs)
}

// ── Validación ────────────────────────────────────────────────────────────────

/**
 * Valida los campos de un evento.
 *
 * Reglas:
 *  - titulo:       no vacío (sin solo-whitespace), máx 200 chars — Req 7.1, 7.3, 7.7
 *  - descripcion:  no vacío, máx 1000 chars — Req 7.1, 7.3, 7.7
 *  - fecha_limite: no vacío, formato YYYY-MM-DD, NO anterior a hoy — Req 7.1, 7.7
 *
 * @param {{ titulo: string, descripcion: string, fecha_limite: string }} campos
 * @returns {{ valid: boolean, errors: { titulo?: string, descripcion?: string, fecha_limite?: string } }}
 */
export function validarCamposEvento(campos) {
  const errors = {}

  // Título — Req 7.1, 7.3, 7.7
  if (!campos.titulo?.trim()) {
    errors.titulo = 'El título es obligatorio.'
  } else if (campos.titulo.trim().length > LIMITES.titulo) {
    errors.titulo = `El título no puede exceder ${LIMITES.titulo} caracteres.`
  }

  // Descripción — Req 7.1, 7.3, 7.7
  if (!campos.descripcion?.trim()) {
    errors.descripcion = 'La descripción es obligatoria.'
  } else if (campos.descripcion.trim().length > LIMITES.descripcion) {
    errors.descripcion = `La descripción no puede exceder ${LIMITES.descripcion} caracteres.`
  }

  // Fecha límite — Req 7.1, 7.7
  if (!campos.fecha_limite?.trim()) {
    errors.fecha_limite = 'La fecha límite es obligatoria.'
  } else {
    // Validar formato YYYY-MM-DD básico
    const regexFecha = /^\d{4}-\d{2}-\d{2}$/
    if (!regexFecha.test(campos.fecha_limite)) {
      errors.fecha_limite = 'El formato de fecha no es válido.'
    } else {
      // No debe ser anterior a hoy (comparar solo parte de fecha)
      if (campos.fecha_limite < hoyISO()) {
        errors.fecha_limite = 'La fecha límite no puede ser anterior a hoy.'
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// ── Renderizado de la lista ───────────────────────────────────────────────────

/**
 * Crea el elemento <li> para un evento en el panel.
 *
 * @param {object} evento — Registro de eventos_autorizaciones
 * @returns {HTMLLIElement}
 */
function crearItemEventoPanel(evento) {
  const esActivo    = evento.estado === 'activo'
  const fechaFmt    = formatearFecha(evento.fecha_limite)
  const badgeClase  = esActivo ? 'badge badge-activo' : 'badge badge-inactivo'
  const badgeTexto  = esActivo ? '● Activo' : '○ Inactivo'
  const btnEstadoTx = esActivo ? 'Desactivar' : 'Activar'
  const nuevoEstado = esActivo ? 'inactivo' : 'activo'

  const li = document.createElement('li')
  li.className = 'card mb-4'
  li.dataset.eventoId = evento.id

  li.innerHTML = `
    <div class="actions-row justify-between mb-2" style="align-items: flex-start;">
      <div style="flex: 1; min-width: 0; margin-right: 0.75rem;">
        <h3 class="subtitulo" style="margin-bottom: 0.25rem; word-break: break-word;">${evento.titulo}</h3>
        <p class="texto-base" style="font-size: 0.875rem; color: var(--color-texto-muted); margin-bottom: 0;">
          📅 Fecha límite: <strong>${fechaFmt}</strong>
        </p>
      </div>
      <span class="${badgeClase}" aria-label="Estado: ${esActivo ? 'Activo' : 'Inactivo'}">${badgeTexto}</span>
    </div>
    <p class="texto-base mb-4" style="white-space: pre-wrap; word-break: break-word;">${evento.descripcion}</p>
    <div class="actions-row" style="justify-content: flex-end; gap: 0.75rem; margin-bottom: 0;">
      <button
        type="button"
        class="btn btn-secondary btn-toggle-estado"
        data-evento-id="${evento.id}"
        data-nuevo-estado="${nuevoEstado}"
        aria-label="${btnEstadoTx} evento ${evento.titulo}"
        style="margin-bottom: 0;"
      >
        ${btnEstadoTx}
      </button>
      <button
        type="button"
        class="btn btn-primary btn-editar-evento"
        data-evento-id="${evento.id}"
        aria-label="Editar evento ${evento.titulo}"
        style="margin-bottom: 0;"
      >
        Editar
      </button>
    </div>
  `

  return li
}

// ── Carga de eventos ──────────────────────────────────────────────────────────

/**
 * Carga y renderiza todos los eventos (activos e inactivos) desde Supabase
 * en el panel administrativo.
 *
 * Requirements: 12.1, 12.4, 12.5
 */
export async function cargarEventosPanel() {
  const elCargando = document.getElementById('eventos-cargando')
  const elLista    = document.getElementById('lista-eventos-panel')
  const elVacio    = document.getElementById('eventos-vacio')

  // Estado de carga
  if (elCargando) elCargando.classList.remove('hidden')
  if (elLista)    elLista.classList.add('hidden')
  if (elVacio)    elVacio.classList.add('hidden')

  try {
    const { data: eventos, error } = await supabase
      .from('eventos_autorizaciones')
      .select('id, titulo, descripcion, fecha_limite, estado, created_at')
      .order('created_at', { ascending: false })

    if (elCargando) elCargando.classList.add('hidden')

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'SELECT',
        error,
      })
      mostrarToast(
        'No se pudo conectar a la base de datos. Verifica tu conexión a internet.',
        'error'
      )
      if (elVacio) elVacio.classList.remove('hidden')
      return
    }

    if (!eventos || eventos.length === 0) {
      if (elVacio) elVacio.classList.remove('hidden')
      return
    }

    // Renderizar lista
    if (elLista) {
      elLista.innerHTML = ''
      eventos.forEach((evento) => {
        const li = crearItemEventoPanel(evento)

        // Botón Editar
        li.querySelector('.btn-editar-evento')?.addEventListener('click', () => {
          abrirModalEdicion(evento)
        })

        // Botón Activar / Desactivar
        li.querySelector('.btn-toggle-estado')?.addEventListener('click', async (e) => {
          const btn        = e.currentTarget
          const eventoId   = btn.dataset.eventoId
          const nuevoEst   = btn.dataset.nuevoEstado
          btn.disabled     = true
          btn.textContent  = 'Actualizando…'

          const resultado = await cambiarEstadoEvento(eventoId, nuevoEst)

          if (resultado.ok) {
            // Re-renderizar la lista completa para reflejar el nuevo estado
            await cargarEventosPanel()
          } else {
            btn.disabled    = false
            btn.textContent = nuevoEst === 'inactivo' ? 'Desactivar' : 'Activar'
          }
        })

        elLista.appendChild(li)
      })
      elLista.classList.remove('hidden')
    }

  } catch (err) {
    if (elCargando) elCargando.classList.add('hidden')
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla:     'eventos_autorizaciones',
      operacion: 'SELECT',
      err,
    })
    mostrarToast(
      'No se pudo conectar a la base de datos. Verifica tu conexión a internet.',
      'error'
    )
    if (elVacio) elVacio.classList.remove('hidden')
  }
}

// ── CRUD de eventos ───────────────────────────────────────────────────────────

/**
 * Inserta un nuevo evento en `eventos_autorizaciones` con estado = 'activo'.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * @param {{ titulo: string, descripcion: string, fecha_limite: string }} campos
 * @returns {Promise<
 *   { ok: true,  evento: object } |
 *   { ok: false, error: 'validacion'|'red', errors: object }
 * >}
 */
export async function crearEvento(campos) {
  // 1. Validar campos — Req 7.1, 7.3, 7.7
  const { valid, errors } = validarCamposEvento(campos)
  if (!valid) {
    return { ok: false, error: 'validacion', errors }
  }

  try {
    const { data, error } = await supabase
      .from('eventos_autorizaciones')
      .insert({
        titulo:       campos.titulo.trim(),
        descripcion:  campos.descripcion.trim(),
        fecha_limite: campos.fecha_limite,
        estado:       'activo',          // Req 7.2 — siempre activo al crear
      })
      .select('id, titulo, descripcion, fecha_limite, estado, created_at')
      .single()

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'INSERT',
        error,
      })
      return {
        ok:     false,
        error:  'red',
        errors: {},
      }
    }

    return { ok: true, evento: data }

  } catch (err) {
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla:     'eventos_autorizaciones',
      operacion: 'INSERT',
      err,
    })
    return { ok: false, error: 'red', errors: {} }
  }
}

/**
 * Actualiza un evento existente en `eventos_autorizaciones`.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 *
 * @param {string} id — UUID del evento
 * @param {{ titulo: string, descripcion: string, fecha_limite: string, estado: string }} campos
 * @returns {Promise<
 *   { ok: true } |
 *   { ok: false, error: 'validacion'|'red', errors: object }
 * >}
 */
export async function actualizarEvento(id, campos) {
  // 1. Validar campos — Req 8.1, 8.2, 8.4
  const { valid, errors } = validarCamposEvento(campos)
  if (!valid) {
    return { ok: false, error: 'validacion', errors }
  }

  try {
    const { error } = await supabase
      .from('eventos_autorizaciones')
      .update({
        titulo:       campos.titulo.trim(),
        descripcion:  campos.descripcion.trim(),
        fecha_limite: campos.fecha_limite,
        estado:       campos.estado ?? 'activo',
      })
      .eq('id', id)

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'UPDATE',
        error,
      })
      return { ok: false, error: 'red', errors: {} }
    }

    return { ok: true }

  } catch (err) {
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla:     'eventos_autorizaciones',
      operacion: 'UPDATE',
      err,
    })
    return { ok: false, error: 'red', errors: {} }
  }
}

/**
 * Cambia el estado de un evento entre 'activo' e 'inactivo'.
 * Al desactivar NO borra respuestas — la integridad la garantiza la BD. — Req 12.3
 *
 * Requirements: 12.1, 12.3, 12.4, 12.6
 *
 * @param {string} id           — UUID del evento
 * @param {'activo'|'inactivo'} nuevoEstado
 * @returns {Promise<{ ok: true } | { ok: false, mensajeUsuario: string }>}
 */
export async function cambiarEstadoEvento(id, nuevoEstado) {
  try {
    const { error } = await supabase
      .from('eventos_autorizaciones')
      .update({ estado: nuevoEstado })
      .eq('id', id)

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'UPDATE (estado)',
        error,
      })
      mostrarToast(
        'No se pudo actualizar el estado del evento. Intenta de nuevo.',
        'error'
      )
      return {
        ok:              false,
        mensajeUsuario:  'No se pudo actualizar el estado del evento. Intenta de nuevo.',
      }
    }

    const accionTexto = nuevoEstado === 'activo' ? 'activado' : 'desactivado'
    mostrarToast(`Evento ${accionTexto} correctamente.`, 'exito')
    return { ok: true }

  } catch (err) {
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla:     'eventos_autorizaciones',
      operacion: 'UPDATE (estado)',
      err,
    })
    mostrarToast(
      'No se pudo actualizar el estado del evento. Intenta de nuevo.',
      'error'
    )
    return {
      ok:             false,
      mensajeUsuario: 'No se pudo actualizar el estado del evento. Intenta de nuevo.',
    }
  }
}

// ── Gestión del modal ─────────────────────────────────────────────────────────

/** Referencia al overlay del modal (se resuelve una sola vez al primer uso). */
function getModalEls() {
  return {
    overlay:       document.getElementById('overlay-modal'),
    titulo:        document.getElementById('modal-titulo'),
    form:          document.getElementById('form-evento'),
    inputId:       document.getElementById('evento-id-edicion'),
    inputTitulo:   document.getElementById('evento-titulo'),
    inputDesc:     document.getElementById('evento-descripcion'),
    inputFecha:    document.getElementById('evento-fecha-limite'),
    selectEstado:  document.getElementById('evento-estado'),
    grupoEstado:   document.getElementById('grupo-estado'),
    errorGeneral:  document.getElementById('modal-error-general'),
    btnGuardar:    document.getElementById('btn-guardar-evento'),
    btnCerrar:     document.getElementById('btn-cerrar-modal'),
    errorTitulo:   document.getElementById('evento-titulo-error'),
    errorDesc:     document.getElementById('evento-descripcion-error'),
    errorFecha:    document.getElementById('evento-fecha-error'),
  }
}

/** Limpia todos los errores inline del modal. */
function limpiarErroresModal() {
  const { errorTitulo, errorDesc, errorFecha, errorGeneral,
          inputTitulo, inputDesc, inputFecha } = getModalEls()

  if (errorTitulo)  errorTitulo.textContent  = ''
  if (errorDesc)    errorDesc.textContent    = ''
  if (errorFecha)   errorFecha.textContent   = ''
  if (errorGeneral) {
    errorGeneral.textContent = ''
    errorGeneral.classList.add('hidden')
  }
  inputTitulo?.classList.remove('is-error')
  inputDesc?.classList.remove('is-error')
  inputFecha?.classList.remove('is-error')
}

/** Muestra los errores de validación en los campos del modal. */
function mostrarErroresModal(errors) {
  const { errorTitulo, errorDesc, errorFecha,
          inputTitulo, inputDesc, inputFecha } = getModalEls()

  if (errors.titulo) {
    if (errorTitulo) errorTitulo.textContent = errors.titulo
    inputTitulo?.classList.add('is-error')
  }
  if (errors.descripcion) {
    if (errorDesc) errorDesc.textContent = errors.descripcion
    inputDesc?.classList.add('is-error')
  }
  if (errors.fecha_limite) {
    if (errorFecha) errorFecha.textContent = errors.fecha_limite
    inputFecha?.classList.add('is-error')
  }
}

/**
 * Muestra u oculta el overlay del modal.
 * @param {boolean} visible
 */
function setModalVisible(visible) {
  const { overlay } = getModalEls()
  if (!overlay) return

  if (visible) {
    overlay.classList.remove('hidden')
    overlay.setAttribute('aria-hidden', 'false')
    // Foco al primer campo del formulario para accesibilidad
    setTimeout(() => getModalEls().inputTitulo?.focus(), 50)
  } else {
    overlay.classList.add('hidden')
    overlay.setAttribute('aria-hidden', 'true')
  }
}

/**
 * Abre el modal en modo creación (campos vacíos).
 *
 * Requirements: 7.1, 7.2
 */
export function abrirModalNuevoEvento() {
  const { titulo, inputId, inputTitulo, inputDesc, inputFecha,
          selectEstado, grupoEstado, btnGuardar } = getModalEls()

  limpiarErroresModal()

  if (titulo)      titulo.textContent      = 'Nuevo evento'
  if (inputId)     inputId.value           = ''
  if (inputTitulo) inputTitulo.value       = ''
  if (inputDesc)   inputDesc.value         = ''
  if (inputFecha) {
    inputFecha.value = ''
    inputFecha.min   = hoyISO()   // Req 7.7 — no permitir fechas pasadas
  }
  if (selectEstado) selectEstado.value     = 'activo'
  // Ocultar selector de estado en creación (siempre activo — Req 7.2)
  if (grupoEstado)  grupoEstado.classList.add('hidden')
  if (btnGuardar)   btnGuardar.textContent = 'Guardar evento'

  setModalVisible(true)
}

/**
 * Abre el modal en modo edición con los datos del evento precargados.
 *
 * Requirements: 8.1, 8.2, 8.3
 *
 * @param {object} evento — Registro completo del evento
 */
function abrirModalEdicion(evento) {
  const { titulo, inputId, inputTitulo, inputDesc, inputFecha,
          selectEstado, grupoEstado, btnGuardar } = getModalEls()

  limpiarErroresModal()

  if (titulo)      titulo.textContent      = 'Editar evento'
  if (inputId)     inputId.value           = evento.id
  if (inputTitulo) inputTitulo.value       = evento.titulo
  if (inputDesc)   inputDesc.value         = evento.descripcion
  if (inputFecha) {
    inputFecha.value = evento.fecha_limite
    inputFecha.min   = hoyISO()   // Req 7.7 — validación mínima de fecha
  }
  if (selectEstado) selectEstado.value     = evento.estado ?? 'activo'
  // Mostrar selector de estado en edición — Req 8.3
  if (grupoEstado)  grupoEstado.classList.remove('hidden')
  if (btnGuardar)   btnGuardar.textContent = 'Guardar cambios'

  setModalVisible(true)
}

// ── Inicialización del modal ──────────────────────────────────────────────────

/**
 * Conecta los eventos del modal: cierre y envío del formulario.
 * Debe llamarse una sola vez al cargar el DOM.
 */
export function inicializarModal() {
  const { btnCerrar, overlay, form } = getModalEls()

  // Cerrar con botón ✕
  btnCerrar?.addEventListener('click', () => setModalVisible(false))

  // Cerrar al hacer clic en el overlay (fuera del diálogo)
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) setModalVisible(false)
  })

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setModalVisible(false)
  })

  // Envío del formulario
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    await manejarEnvioModal()
  })
}

/**
 * Orquesta la validación y envío del formulario del modal.
 * Maneja tanto creación como edición según si hay ID en el campo oculto.
 *
 * Requirements: 7.1–7.7, 8.1–8.7
 */
async function manejarEnvioModal() {
  const { inputId, inputTitulo, inputDesc, inputFecha,
          selectEstado, errorGeneral, btnGuardar } = getModalEls()

  limpiarErroresModal()

  const id            = inputId?.value?.trim()     || null
  const esEdicion     = Boolean(id)
  const campos = {
    titulo:       inputTitulo?.value  ?? '',
    descripcion:  inputDesc?.value    ?? '',
    fecha_limite: inputFecha?.value   ?? '',
    estado:       selectEstado?.value ?? 'activo',
  }

  // Estado de carga
  if (btnGuardar) {
    btnGuardar.disabled    = true
    btnGuardar.textContent = 'Guardando…'
  }

  let resultado

  if (esEdicion) {
    // ── Modo edición — Req 8.1–8.7 ──────────────────────────────────────────
    resultado = await actualizarEvento(id, campos)
  } else {
    // ── Modo creación — Req 7.1–7.7 ─────────────────────────────────────────
    resultado = await crearEvento(campos)
  }

  if (resultado.ok) {
    // Éxito
    setModalVisible(false)

    if (esEdicion) {
      mostrarToast('Evento actualizado exitosamente.', 'exito')   // Req 8.6
    } else {
      mostrarToast('Evento creado exitosamente.', 'exito')        // Req 7.4
    }

    // Actualizar lista sin recargar página — Req 7.5
    await cargarEventosPanel()

  } else if (resultado.error === 'validacion') {
    // Mostrar errores por campo — Req 7.3, 7.7, 8.4
    mostrarErroresModal(resultado.errors)

    // Foco al primer campo con error
    const { inputTitulo: iTit, inputDesc: iDesc, inputFecha: iFec } = getModalEls()
    if (resultado.errors.titulo)       iTit?.focus()
    else if (resultado.errors.descripcion) iDesc?.focus()
    else if (resultado.errors.fecha_limite) iFec?.focus()

    if (btnGuardar) {
      btnGuardar.disabled    = false
      btnGuardar.textContent = esEdicion ? 'Guardar cambios' : 'Guardar evento'
    }

  } else {
    // Error de red — preservar datos del formulario — Req 7.6, 8.5
    if (errorGeneral) {
      errorGeneral.textContent = 'No se pudo guardar la información. Verifica tu conexión a internet e intenta nuevamente.'
      errorGeneral.classList.remove('hidden')
    }

    if (btnGuardar) {
      btnGuardar.disabled    = false
      btnGuardar.textContent = esEdicion ? 'Guardar cambios' : 'Guardar evento'
    }
  }
}
