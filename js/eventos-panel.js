/**
 * eventos-panel.js
 * Módulo de gestión de eventos del panel administrativo de maestros.
 *
 * Columnas reales de la tabla `eventos_autorizaciones`:
 *   id, tipo, titulo, descripcion, fecha_evento (DATE), activo (BOOLEAN), created_at
 *
 * Responsabilidades:
 *  - Cargar y renderizar todos los eventos (activos e inactivos)
 *  - Crear nuevos eventos en `eventos_autorizaciones`
 *  - Editar eventos existentes
 *  - Cambiar `activo` entre true/false
 *  - Abrir/cerrar el modal de creación/edición
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7,
 *               8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7,
 *               12.1, 12.3, 12.4, 12.5, 12.6
 */

import { supabase } from '../supabaseClient.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const LIMITES = {
  titulo:      150,   // según la BD: titulo VARCHAR(150)
  descripcion: 2000,  // TEXT sin límite fijo — usamos límite práctico de UI
}

const TIPOS_EVENTO = ['evento', 'vacuna', 'salida']

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/**
 * Devuelve la fecha de hoy en formato YYYY-MM-DD (sin zona horaria).
 * @returns {string}
 */
function hoyISO() {
  const hoy  = new Date()
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
  if (!fechaIso) return '—'
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
 * Valida los campos de un evento contra el esquema real de la BD.
 *
 * Reglas:
 *  - titulo:       no vacío, máx 150 chars
 *  - descripcion:  no vacío
 *  - fecha_evento: no vacío, formato YYYY-MM-DD, NO anterior a hoy
 *  - tipo:         debe ser uno de 'evento', 'vacuna', 'salida'
 *
 * @param {{ titulo, descripcion, fecha_evento, tipo }} campos
 * @returns {{ valid: boolean, errors: object }}
 */
export function validarCamposEvento(campos) {
  const errors = {}

  if (!campos.titulo?.trim()) {
    errors.titulo = 'El título es obligatorio.'
  } else if (campos.titulo.trim().length > LIMITES.titulo) {
    errors.titulo = `El título no puede exceder ${LIMITES.titulo} caracteres.`
  }

  if (!campos.descripcion?.trim()) {
    errors.descripcion = 'La descripción es obligatoria.'
  } else if (campos.descripcion.trim().length > LIMITES.descripcion) {
    errors.descripcion = `La descripción no puede exceder ${LIMITES.descripcion} caracteres.`
  }

  if (!campos.fecha_evento?.trim()) {
    errors.fecha_evento = 'La fecha del evento es obligatoria.'
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.fecha_evento)) {
    errors.fecha_evento = 'El formato de fecha no es válido.'
  } else if (campos.fecha_evento < hoyISO()) {
    errors.fecha_evento = 'La fecha del evento no puede ser anterior a hoy.'
  }

  if (!campos.tipo || !TIPOS_EVENTO.includes(campos.tipo)) {
    errors.tipo = 'Selecciona un tipo de evento válido.'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// ── Renderizado de la lista ───────────────────────────────────────────────────

/**
 * Etiqueta legible para el tipo de evento.
 * @param {string} tipo
 * @returns {string}
 */
function etiquetaTipo(tipo) {
  const mapa = { evento: '📋 Evento', vacuna: '💉 Vacuna', salida: '🚌 Salida' }
  return mapa[tipo] ?? tipo
}

/**
 * Crea el elemento <li> para un evento en el panel.
 *
 * @param {object} evento — Registro de eventos_autorizaciones
 * @returns {HTMLLIElement}
 */
function crearItemEventoPanel(evento) {
  const esActivo    = evento.activo === true
  const fechaFmt    = formatearFecha(evento.fecha_evento)
  const badgeClase  = esActivo ? 'badge badge-activo' : 'badge badge-inactivo'
  const badgeTexto  = esActivo ? '● Activo' : '○ Inactivo'
  const btnEstadoTx = esActivo ? 'Desactivar' : 'Activar'
  const nuevoActivo = !esActivo  // bool opuesto

  const li = document.createElement('li')
  li.className = 'card mb-4'
  li.dataset.eventoId = evento.id

  li.innerHTML = `
    <div class="actions-row justify-between mb-2" style="align-items: flex-start;">
      <div style="flex: 1; min-width: 0; margin-right: 0.75rem;">
        <p class="texto-base text-gray-400 text-sm mb-1">${etiquetaTipo(evento.tipo)}</p>
        <h3 class="subtitulo" style="margin-bottom: 0.25rem; word-break: break-word;">${evento.titulo}</h3>
        <p class="texto-base" style="font-size: 0.875rem; color: var(--color-texto-muted); margin-bottom: 0;">
          📅 Fecha del evento: <strong>${fechaFmt}</strong>
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
        data-nuevo-activo="${nuevoActivo}"
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
 * Carga y renderiza todos los eventos (activos e inactivos) desde Supabase.
 * Ordena por created_at DESC para mostrar los más recientes primero.
 *
 * Requirements: 12.1, 12.4, 12.5
 */
export async function cargarEventosPanel() {
  const elCargando = document.getElementById('eventos-cargando')
  const elLista    = document.getElementById('lista-eventos-panel')
  const elVacio    = document.getElementById('eventos-vacio')

  if (elCargando) elCargando.classList.remove('hidden')
  if (elLista)    elLista.classList.add('hidden')
  if (elVacio)    elVacio.classList.add('hidden')

  try {
    const { data: eventos, error } = await supabase
      .from('eventos_autorizaciones')
      .select('id, tipo, titulo, descripcion, fecha_evento, activo, created_at')
      .order('created_at', { ascending: false })

    if (elCargando) elCargando.classList.add('hidden')

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'SELECT',
        error,
      })
      mostrarToast('No se pudo cargar la lista de eventos. Verifica tu conexión.', 'error')
      if (elVacio) elVacio.classList.remove('hidden')
      return
    }

    if (!eventos || eventos.length === 0) {
      if (elVacio) elVacio.classList.remove('hidden')
      return
    }

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
          const btn       = e.currentTarget
          const eventoId  = btn.dataset.eventoId
          // dataset siempre es string — convertir a boolean
          const nuevoAct  = btn.dataset.nuevoActivo === 'true'
          btn.disabled    = true
          btn.textContent = 'Actualizando…'

          const resultado = await cambiarActivoEvento(eventoId, nuevoAct)
          if (resultado.ok) {
            await cargarEventosPanel()
          } else {
            btn.disabled    = false
            btn.textContent = nuevoAct ? 'Activar' : 'Desactivar'
          }
        })

        elLista.appendChild(li)
      })
      elLista.classList.remove('hidden')
    }

  } catch (err) {
    if (elCargando) elCargando.classList.add('hidden')
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    mostrarToast('No se pudo cargar la lista de eventos. Verifica tu conexión.', 'error')
    if (elVacio) elVacio.classList.remove('hidden')
  }
}

// ── CRUD de eventos ───────────────────────────────────────────────────────────

/**
 * Inserta un nuevo evento en `eventos_autorizaciones`.
 * La columna `activo` por defecto es `true` (definido en la BD).
 *
 * @param {{ titulo, descripcion, fecha_evento, tipo }} campos
 * @returns {Promise<{ ok: true, evento: object } | { ok: false, error: string, errors: object }>}
 */
export async function crearEvento(campos) {
  const { valid, errors } = validarCamposEvento(campos)
  if (!valid) return { ok: false, error: 'validacion', errors }

  try {
    const { data, error } = await supabase
      .from('eventos_autorizaciones')
      .insert({
        titulo:       campos.titulo.trim(),
        descripcion:  campos.descripcion.trim(),
        fecha_evento: campos.fecha_evento,
        tipo:         campos.tipo,
        activo:       true,
      })
      .select('id, tipo, titulo, descripcion, fecha_evento, activo, created_at')
      .single()

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'INSERT',
        error,
      })
      return { ok: false, error: 'red', errors: {} }
    }

    return { ok: true, evento: data }

  } catch (err) {
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    return { ok: false, error: 'red', errors: {} }
  }
}

/**
 * Actualiza un evento existente.
 * Soporta cambio de titulo, descripcion, fecha_evento, tipo y activo.
 *
 * @param {string} id
 * @param {{ titulo, descripcion, fecha_evento, tipo, activo }} campos
 * @returns {Promise<{ ok: true } | { ok: false, error: string, errors: object }>}
 */
export async function actualizarEvento(id, campos) {
  const { valid, errors } = validarCamposEvento(campos)
  if (!valid) return { ok: false, error: 'validacion', errors }

  try {
    const { error } = await supabase
      .from('eventos_autorizaciones')
      .update({
        titulo:       campos.titulo.trim(),
        descripcion:  campos.descripcion.trim(),
        fecha_evento: campos.fecha_evento,
        tipo:         campos.tipo,
        activo:       campos.activo ?? true,
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
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    return { ok: false, error: 'red', errors: {} }
  }
}

/**
 * Cambia el campo `activo` (boolean) de un evento.
 * Al desactivar NO borra las respuestas — integridad garantizada por FK CASCADE. — Req 12.3
 *
 * @param {string}  id
 * @param {boolean} nuevoActivo
 * @returns {Promise<{ ok: true } | { ok: false, mensajeUsuario: string }>}
 */
export async function cambiarActivoEvento(id, nuevoActivo) {
  try {
    const { error } = await supabase
      .from('eventos_autorizaciones')
      .update({ activo: nuevoActivo })
      .eq('id', id)

    if (error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla:     'eventos_autorizaciones',
        operacion: 'UPDATE (activo)',
        error,
      })
      mostrarToast('No se pudo actualizar el estado del evento. Intenta de nuevo.', 'error')
      return { ok: false, mensajeUsuario: 'No se pudo actualizar el estado del evento.' }
    }

    const accion = nuevoActivo ? 'activado' : 'desactivado'
    mostrarToast(`Evento ${accion} correctamente.`, 'exito')
    return { ok: true }

  } catch (err) {
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    mostrarToast('No se pudo actualizar el estado del evento. Intenta de nuevo.', 'error')
    return { ok: false, mensajeUsuario: 'No se pudo actualizar el estado del evento.' }
  }
}

// ── Gestión del modal ─────────────────────────────────────────────────────────

function getModalEls() {
  return {
    overlay:      document.getElementById('overlay-modal'),
    tituloModal:  document.getElementById('modal-titulo'),
    form:         document.getElementById('form-evento'),
    inputId:      document.getElementById('evento-id-edicion'),
    inputTitulo:  document.getElementById('evento-titulo-input'),
    inputDesc:    document.getElementById('evento-descripcion-input'),
    inputFecha:   document.getElementById('evento-fecha-input'),
    selectTipo:   document.getElementById('evento-tipo-select'),
    checkActivo:  document.getElementById('evento-activo-check'),
    grupoActivo:  document.getElementById('grupo-activo'),
    errorGeneral: document.getElementById('modal-error-general'),
    btnGuardar:   document.getElementById('btn-guardar-evento'),
    btnCerrar:    document.getElementById('btn-cerrar-modal'),
    errorTitulo:  document.getElementById('evento-titulo-error'),
    errorDesc:    document.getElementById('evento-descripcion-error'),
    errorFecha:   document.getElementById('evento-fecha-error'),
    errorTipo:    document.getElementById('evento-tipo-error'),
  }
}

function limpiarErroresModal() {
  const { errorTitulo, errorDesc, errorFecha, errorTipo, errorGeneral,
          inputTitulo, inputDesc, inputFecha, selectTipo } = getModalEls()
  if (errorTitulo)  errorTitulo.textContent  = ''
  if (errorDesc)    errorDesc.textContent    = ''
  if (errorFecha)   errorFecha.textContent   = ''
  if (errorTipo)    errorTipo.textContent    = ''
  if (errorGeneral) { errorGeneral.textContent = ''; errorGeneral.classList.add('hidden') }
  inputTitulo?.classList.remove('is-error')
  inputDesc?.classList.remove('is-error')
  inputFecha?.classList.remove('is-error')
  selectTipo?.classList.remove('is-error')
}

function mostrarErroresModal(errors) {
  const { errorTitulo, errorDesc, errorFecha, errorTipo,
          inputTitulo, inputDesc, inputFecha, selectTipo } = getModalEls()
  if (errors.titulo)       { if (errorTitulo) errorTitulo.textContent = errors.titulo;       inputTitulo?.classList.add('is-error') }
  if (errors.descripcion)  { if (errorDesc)   errorDesc.textContent   = errors.descripcion;  inputDesc?.classList.add('is-error') }
  if (errors.fecha_evento) { if (errorFecha)  errorFecha.textContent  = errors.fecha_evento; inputFecha?.classList.add('is-error') }
  if (errors.tipo)         { if (errorTipo)   errorTipo.textContent   = errors.tipo;         selectTipo?.classList.add('is-error') }
}

function setModalVisible(visible) {
  const { overlay } = getModalEls()
  if (!overlay) return
  if (visible) {
    overlay.classList.remove('hidden')
    overlay.setAttribute('aria-hidden', 'false')
    setTimeout(() => getModalEls().inputTitulo?.focus(), 50)
  } else {
    overlay.classList.add('hidden')
    overlay.setAttribute('aria-hidden', 'true')
  }
}

/**
 * Abre el modal en modo creación.
 */
export function abrirModalNuevoEvento() {
  const { tituloModal, inputId, inputTitulo, inputDesc, inputFecha,
          selectTipo, grupoActivo, btnGuardar } = getModalEls()

  limpiarErroresModal()
  if (tituloModal) tituloModal.textContent = 'Nuevo evento'
  if (inputId)     inputId.value           = ''
  if (inputTitulo) inputTitulo.value       = ''
  if (inputDesc)   inputDesc.value         = ''
  if (inputFecha)  { inputFecha.value = ''; inputFecha.min = hoyISO() }
  if (selectTipo)  selectTipo.value        = 'evento'
  // Ocultar toggle de activo en creación — siempre activo al crear
  if (grupoActivo) grupoActivo.classList.add('hidden')
  if (btnGuardar)  btnGuardar.textContent  = 'Guardar evento'

  setModalVisible(true)
}

/**
 * Abre el modal en modo edición con datos precargados.
 * @param {object} evento
 */
function abrirModalEdicion(evento) {
  const { tituloModal, inputId, inputTitulo, inputDesc, inputFecha,
          selectTipo, checkActivo, grupoActivo, btnGuardar } = getModalEls()

  limpiarErroresModal()
  if (tituloModal) tituloModal.textContent = 'Editar evento'
  if (inputId)     inputId.value           = evento.id
  if (inputTitulo) inputTitulo.value       = evento.titulo
  if (inputDesc)   inputDesc.value         = evento.descripcion
  if (inputFecha)  { inputFecha.value = evento.fecha_evento ?? ''; inputFecha.min = hoyISO() }
  if (selectTipo)  selectTipo.value        = evento.tipo ?? 'evento'
  if (checkActivo) checkActivo.checked     = evento.activo === true
  if (grupoActivo) grupoActivo.classList.remove('hidden')
  if (btnGuardar)  btnGuardar.textContent  = 'Guardar cambios'

  setModalVisible(true)
}

// ── Inicialización del modal ──────────────────────────────────────────────────

/**
 * Conecta los eventos del modal. Llamar una sola vez al cargar el DOM.
 */
export function inicializarModal() {
  const { btnCerrar, overlay, form } = getModalEls()

  btnCerrar?.addEventListener('click', () => setModalVisible(false))

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) setModalVisible(false)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setModalVisible(false)
  })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    await manejarEnvioModal()
  })
}

async function manejarEnvioModal() {
  const { inputId, inputTitulo, inputDesc, inputFecha, selectTipo,
          checkActivo, errorGeneral, btnGuardar } = getModalEls()

  limpiarErroresModal()

  const id        = inputId?.value?.trim() || null
  const esEdicion = Boolean(id)
  const campos = {
    titulo:       inputTitulo?.value  ?? '',
    descripcion:  inputDesc?.value    ?? '',
    fecha_evento: inputFecha?.value   ?? '',
    tipo:         selectTipo?.value   ?? 'evento',
    activo:       checkActivo?.checked ?? true,
  }

  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…' }

  const resultado = esEdicion
    ? await actualizarEvento(id, campos)
    : await crearEvento(campos)

  if (resultado.ok) {
    setModalVisible(false)
    mostrarToast(
      esEdicion ? 'Evento actualizado exitosamente.' : 'Evento creado exitosamente.',
      'exito'
    )
    await cargarEventosPanel()

  } else if (resultado.error === 'validacion') {
    mostrarErroresModal(resultado.errors)
    const { inputTitulo: iT, inputDesc: iD, inputFecha: iF, selectTipo: iS } = getModalEls()
    if (resultado.errors.titulo)       iT?.focus()
    else if (resultado.errors.descripcion) iD?.focus()
    else if (resultado.errors.fecha_evento) iF?.focus()
    else if (resultado.errors.tipo)     iS?.focus()
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = esEdicion ? 'Guardar cambios' : 'Guardar evento' }

  } else {
    if (errorGeneral) {
      errorGeneral.textContent = 'No se pudo guardar. Verifica tu conexión e intenta de nuevo.'
      errorGeneral.classList.remove('hidden')
    }
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = esEdicion ? 'Guardar cambios' : 'Guardar evento' }
  }
}
