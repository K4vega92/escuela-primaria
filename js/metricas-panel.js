/**
 * metricas-panel.js
 * Módulo de Métricas por Grupo y Respuestas del panel de maestros.
 *
 * Columnas reales de la BD:
 *   alumnos:                 matricula, nombre, grupo
 *   eventos_autorizaciones:  id, tipo, titulo, descripcion, fecha_evento, activo, created_at
 *   respuestas_autorizaciones: id, evento_id, matricula_alumno, nombre_tutor,
 *                              parentesco_tutor, autoriza, alergias, nota_adicional, created_at
 *   usuarios_maestros:       id, email, password, nombre, grupo_asignado
 *
 * Responsabilidades:
 *  - Selector de evento (últimos 50 activos ordenados por fecha DESC) — Req 9.1
 *  - Calcular y mostrar métricas por grupo — Req 9.2, 9.3, 9.4
 *  - Lista de alumnos sin respuesta — Req 9.5
 *  - Suscripción Realtime para actualización automática — Req 9.6
 *  - Mostrar solo grupos asignados al maestro autenticado — Req 9.7
 *  - Vista de respuestas detalladas por evento — Req 9.8
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import { supabase } from '../supabaseClient.js'

// ── Estado del módulo ─────────────────────────────────────────────────────────
let _eventoSeleccionadoId   = null
let _sesionMaestro          = null
let _suscripcionRealtime    = null
let _timeoutMetricas        = null

// ── Toast helper ──────────────────────────────────────────────────────────────
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
    toast.style.opacity = '0'; toast.style.transition = 'opacity 300ms ease'
    setTimeout(() => toast.remove(), 300)
  }, duracionMs)
}

// ── Formato de fecha ──────────────────────────────────────────────────────────
function formatearFecha(fechaIso) {
  if (!fechaIso) return '—'
  const [anio, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}/${anio}`
}

function formatearFechaHora(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const dia  = String(d.getDate()).padStart(2, '0')
  const mes  = String(d.getMonth() + 1).padStart(2, '0')
  const anio = d.getFullYear()
  const hrs  = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${anio} ${hrs}:${min}`
}

// ── Referencias DOM — Métricas ────────────────────────────────────────────────
function getMetricasEls() {
  return {
    selectEvento:     document.getElementById('metricas-select-evento'),
    estadoCargando:   document.getElementById('metricas-cargando'),
    estadoVacio:      document.getElementById('metricas-sin-eventos'),
    estadoError:      document.getElementById('metricas-error'),
    contenido:        document.getElementById('metricas-contenido'),
    tarjetasGrupos:   document.getElementById('metricas-tarjetas-grupos'),
    listaFaltantes:   document.getElementById('metricas-lista-faltantes'),
    tituloEvento:     document.getElementById('metricas-titulo-evento'),
    realtime:         document.getElementById('metricas-realtime-badge'),
  }
}

// ── Referencias DOM — Respuestas ──────────────────────────────────────────────
function getRespuestasEls() {
  return {
    selectEvento:   document.getElementById('respuestas-select-evento'),
    estadoCargando: document.getElementById('respuestas-cargando'),
    estadoVacio:    document.getElementById('respuestas-sin-datos'),
    tabla:          document.getElementById('respuestas-tabla'),
    tbody:          document.getElementById('respuestas-tbody'),
    totalLabel:     document.getElementById('respuestas-total-label'),
  }
}

// ── Cargar selector de eventos ────────────────────────────────────────────────

/**
 * Carga los últimos 50 eventos activos en un <select>.
 * Muestra mensaje vacío si no hay ninguno — Req 9.8.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {boolean} [soloActivos=true]
 * @returns {Promise<boolean>} true si hay al menos un evento
 */
async function cargarOpcionesEventos(selectEl, soloActivos = true) {
  if (!selectEl) return false

  selectEl.disabled = true
  selectEl.innerHTML = '<option value="">Cargando eventos…</option>'

  try {
    let query = supabase
      .from('eventos_autorizaciones')
      .select('id, titulo, fecha_evento, activo')
      .order('fecha_evento', { ascending: false })
      .limit(50)

    if (soloActivos) query = query.eq('activo', true)

    const { data: eventos, error } = await query

    if (error) {
      console.error('[Supabase Error]', { timestamp: new Date().toISOString(), tabla: 'eventos_autorizaciones', error })
      selectEl.innerHTML = '<option value="">Error al cargar eventos</option>'
      return false
    }

    if (!eventos || eventos.length === 0) {
      selectEl.innerHTML = '<option value="">No hay eventos disponibles</option>'
      selectEl.disabled = false
      return false
    }

    selectEl.innerHTML = '<option value="">— Selecciona un evento —</option>'
    eventos.forEach((ev) => {
      const opt = document.createElement('option')
      opt.value       = ev.id
      opt.textContent = `${formatearFecha(ev.fecha_evento)} · ${ev.titulo}`
      selectEl.appendChild(opt)
    })
    selectEl.disabled = false
    return true

  } catch (err) {
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    selectEl.innerHTML = '<option value="">Error al cargar eventos</option>'
    selectEl.disabled = false
    return false
  }
}

// ── Cálculo de métricas ───────────────────────────────────────────────────────

/**
 * Calcula métricas de respuestas para un evento, filtrando por grupos
 * asignados al maestro autenticado.
 *
 * Retorna dentro de 3 s o muestra error — Req 9.2, 9.9.
 *
 * @param {string} eventoId
 * @param {string|null} grupoAsignado — grupo del maestro (puede ser null = todos)
 */
async function calcularYMostrarMetricas(eventoId, grupoAsignado) {
  const els = getMetricasEls()

  // Mostrar estado de carga
  if (els.estadoCargando) els.estadoCargando.classList.remove('hidden')
  if (els.contenido)      els.contenido.classList.add('hidden')
  if (els.estadoError)    els.estadoError.classList.add('hidden')

  // Timeout de 3 segundos — Req 9.9
  let timedOut = false
  _timeoutMetricas = setTimeout(() => {
    timedOut = true
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    if (els.estadoError) {
      els.estadoError.textContent = 'Las métricas no están disponibles temporalmente. Intenta de nuevo.'
      els.estadoError.classList.remove('hidden')
    }
  }, 3000)

  try {
    // 1. Obtener todos los alumnos del/los grupo(s) del maestro
    let queryAlumnos = supabase
      .from('alumnos')
      .select('matricula, nombre, grupo')
      .order('grupo', { ascending: true })
      .order('nombre', { ascending: true })

    if (grupoAsignado) {
      queryAlumnos = queryAlumnos.eq('grupo', grupoAsignado)
    }

    // 2. Obtener respuestas de este evento
    const [resAlumnos, resRespuestas] = await Promise.all([
      queryAlumnos,
      supabase
        .from('respuestas_autorizaciones')
        .select('matricula_alumno')
        .eq('evento_id', eventoId),
    ])

    if (timedOut) return  // ya se mostró el error de timeout

    clearTimeout(_timeoutMetricas)

    if (resAlumnos.error || resRespuestas.error) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        errorAlumnos: resAlumnos.error,
        errorRespuestas: resRespuestas.error,
      })
      if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
      if (els.estadoError) {
        els.estadoError.textContent = 'Las métricas no están disponibles temporalmente.'
        els.estadoError.classList.remove('hidden')
      }
      return
    }

    const alumnos    = resAlumnos.data    ?? []
    const respondidos = new Set((resRespuestas.data ?? []).map((r) => r.matricula_alumno))

    if (alumnos.length === 0) {
      if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
      if (els.estadoError) {
        els.estadoError.textContent = grupoAsignado
          ? `No hay alumnos registrados en el grupo ${grupoAsignado}.`
          : 'No hay alumnos registrados en la escuela.'
        els.estadoError.classList.remove('hidden')
      }
      return
    }

    // 3. Agrupar por grupo
    const porGrupo = {}
    alumnos.forEach((alumno) => {
      if (!porGrupo[alumno.grupo]) {
        porGrupo[alumno.grupo] = { total: 0, respondieron: 0, faltantes: [] }
      }
      porGrupo[alumno.grupo].total++
      if (respondidos.has(alumno.matricula)) {
        porGrupo[alumno.grupo].respondieron++
      } else {
        porGrupo[alumno.grupo].faltantes.push(alumno)
      }
    })

    // 4. Renderizar tarjetas de grupos — Req 9.3, 9.4
    renderizarTarjetasGrupos(porGrupo, els)

    // 5. Renderizar lista de faltantes — Req 9.5
    renderizarListaFaltantes(porGrupo, els)

    // Mostrar contenido
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    if (els.contenido)      els.contenido.classList.remove('hidden')

  } catch (err) {
    if (timedOut) return
    clearTimeout(_timeoutMetricas)
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    if (els.estadoError) {
      els.estadoError.textContent = 'Las métricas no están disponibles temporalmente.'
      els.estadoError.classList.remove('hidden')
    }
  }
}

function renderizarTarjetasGrupos(porGrupo, els) {
  if (!els.tarjetasGrupos) return

  const grupos = Object.keys(porGrupo).sort()
  els.tarjetasGrupos.innerHTML = ''

  grupos.forEach((grupo) => {
    const { total, respondieron } = porGrupo[grupo]
    const faltantes  = total - respondieron
    const porcentaje = total > 0 ? Math.round((respondieron / total) * 100) : 0
    const colorBarra = porcentaje >= 80 ? '#059669' : porcentaje >= 50 ? '#F59E0B' : '#DC2626'

    const tarjeta = document.createElement('div')
    tarjeta.className = 'card mb-4'
    tarjeta.setAttribute('role', 'region')
    tarjeta.setAttribute('aria-label', `Grupo ${grupo}`)
    tarjeta.innerHTML = `
      <div class="actions-row justify-between mb-3">
        <h3 class="subtitulo">Grupo ${grupo}</h3>
        <span class="badge" style="background: var(--color-primario-light); color: var(--color-primario);">${porcentaje}%</span>
      </div>
      <div class="actions-row" style="gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div class="text-center" style="flex: 1; min-width: 80px;">
          <p class="titulo-principal" style="color: var(--color-primario); margin-bottom: 0;">${total}</p>
          <p class="texto-base text-gray-500 text-sm">Total</p>
        </div>
        <div class="text-center" style="flex: 1; min-width: 80px;">
          <p class="titulo-principal" style="color: var(--color-exito); margin-bottom: 0;">${respondieron}</p>
          <p class="texto-base text-gray-500 text-sm">Respondieron</p>
        </div>
        <div class="text-center" style="flex: 1; min-width: 80px;">
          <p class="titulo-principal" style="color: ${faltantes > 0 ? 'var(--color-error)' : 'var(--color-texto-muted)'}; margin-bottom: 0;">${faltantes}</p>
          <p class="texto-base text-gray-500 text-sm">Faltan</p>
        </div>
      </div>
      <!-- Barra de progreso -->
      <div
        style="height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden;"
        role="progressbar"
        aria-valuenow="${porcentaje}"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progreso de respuestas: ${porcentaje}%"
      >
        <div style="height: 100%; width: ${porcentaje}%; background: ${colorBarra}; transition: width 0.5s ease;"></div>
      </div>
    `
    els.tarjetasGrupos.appendChild(tarjeta)
  })
}

function renderizarListaFaltantes(porGrupo, els) {
  if (!els.listaFaltantes) return

  const grupos   = Object.keys(porGrupo).sort()
  const todosFaltantes = []
  grupos.forEach((g) => todosFaltantes.push(...porGrupo[g].faltantes))

  if (todosFaltantes.length === 0) {
    els.listaFaltantes.innerHTML = `
      <div class="card text-center py-6">
        <p class="texto-base" style="color: var(--color-exito);">✅ Todos los alumnos han respondido</p>
      </div>
    `
    return
  }

  // Limitar a 200 — Req 9.5
  const mostrar = todosFaltantes.slice(0, 200)

  const contenedor = document.createElement('div')
  contenedor.className = 'card'
  contenedor.innerHTML = `
    <h3 class="subtitulo mb-4">
      Alumnos sin respuesta
      <span class="badge badge-vencido ml-2">${todosFaltantes.length}</span>
      ${todosFaltantes.length > 200 ? '<span class="texto-base text-gray-400 text-sm ml-1">(mostrando primeros 200)</span>' : ''}
    </h3>
  `

  let grupoActual = null
  mostrar.forEach((alumno) => {
    if (alumno.grupo !== grupoActual) {
      grupoActual = alumno.grupo
      const header = document.createElement('p')
      header.className = 'form-label mt-3 mb-2'
      header.textContent = `Grupo ${grupoActual}`
      contenedor.appendChild(header)
    }

    const fila = document.createElement('div')
    fila.className = 'divider py-2'
    fila.style.cssText = 'display: flex; justify-content: space-between; align-items: center;'
    fila.innerHTML = `
      <span class="texto-base">${alumno.nombre}</span>
      <span class="texto-base text-gray-400 text-sm" style="font-family: monospace;">${alumno.matricula}</span>
    `
    contenedor.appendChild(fila)
  })

  els.listaFaltantes.innerHTML = ''
  els.listaFaltantes.appendChild(contenedor)
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Suscribe a cambios en respuestas_autorizaciones para el evento seleccionado.
 * Actualiza métricas automáticamente cuando llega una nueva respuesta — Req 9.6.
 *
 * @param {string}      eventoId
 * @param {string|null} grupoAsignado
 */
function suscribirRealtime(eventoId, grupoAsignado) {
  // Cancelar suscripción anterior si existe
  cancelarRealtime()

  const els = getMetricasEls()

  _suscripcionRealtime = supabase
    .channel(`respuestas-evento-${eventoId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'respuestas_autorizaciones',
        filter: `evento_id=eq.${eventoId}`,
      },
      () => {
        // Nueva respuesta recibida — actualizar métricas dentro de 5 s
        calcularYMostrarMetricas(eventoId, grupoAsignado)
        mostrarToast('Nueva respuesta recibida. Métricas actualizadas.', 'exito', 3000)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && els.realtime) {
        els.realtime.classList.remove('hidden')
      }
    })
}

export function cancelarRealtime() {
  if (_suscripcionRealtime) {
    supabase.removeChannel(_suscripcionRealtime)
    _suscripcionRealtime = null
  }
  const els = getMetricasEls()
  if (els.realtime) els.realtime.classList.add('hidden')
}

// ── Vista de respuestas detalladas ────────────────────────────────────────────

/**
 * Carga las respuestas detalladas de un evento en la pestaña Respuestas.
 *
 * @param {string} eventoId
 */
async function cargarRespuestasDetalladas(eventoId) {
  const els = getRespuestasEls()

  if (els.estadoCargando) els.estadoCargando.classList.remove('hidden')
  if (els.tabla)          els.tabla.classList.add('hidden')
  if (els.estadoVacio)    els.estadoVacio.classList.add('hidden')

  try {
    const { data: respuestas, error } = await supabase
      .from('respuestas_autorizaciones')
      .select(`
        id,
        matricula_alumno,
        nombre_tutor,
        parentesco_tutor,
        autoriza,
        alergias,
        nota_adicional,
        created_at,
        alumnos ( nombre, grupo )
      `)
      .eq('evento_id', eventoId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')

    if (error) {
      console.error('[Supabase Error]', { timestamp: new Date().toISOString(), tabla: 'respuestas_autorizaciones', error })
      mostrarToast('No se pudieron cargar las respuestas. Verifica tu conexión.', 'error')
      if (els.estadoVacio) {
        els.estadoVacio.textContent = 'Error al cargar respuestas.'
        els.estadoVacio.classList.remove('hidden')
      }
      return
    }

    if (!respuestas || respuestas.length === 0) {
      if (els.estadoVacio) els.estadoVacio.classList.remove('hidden')
      return
    }

    // Rellenar tabla
    if (els.totalLabel) els.totalLabel.textContent = `${respuestas.length} respuesta${respuestas.length !== 1 ? 's' : ''}`

    if (els.tbody) {
      els.tbody.innerHTML = ''
      respuestas.forEach((r) => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td class="py-3 px-4 texto-base" style="white-space: nowrap;">${r.alumnos?.nombre ?? r.matricula_alumno}</td>
          <td class="py-3 px-4 texto-base text-gray-500" style="white-space: nowrap;">${r.alumnos?.grupo ?? '—'}</td>
          <td class="py-3 px-4 texto-base" style="white-space: nowrap;">${r.nombre_tutor}</td>
          <td class="py-3 px-4 texto-base text-gray-500" style="white-space: nowrap;">${r.parentesco_tutor}</td>
          <td class="py-3 px-4 text-center">
            <span class="${r.autoriza ? 'badge badge-enviado' : 'badge badge-vencido'}" style="white-space: nowrap;">
              ${r.autoriza ? '✓ Sí' : '✗ No'}
            </span>
          </td>
          <td class="py-3 px-4 texto-base text-gray-500 text-sm">${r.alergias?.trim() || '—'}</td>
          <td class="py-3 px-4 texto-base text-gray-400 text-sm" style="white-space: nowrap;">${formatearFechaHora(r.created_at)}</td>
        `
        els.tbody.appendChild(tr)
      })
    }

    if (els.tabla) els.tabla.classList.remove('hidden')

  } catch (err) {
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    console.error('[Red Error]', { timestamp: new Date().toISOString(), err })
    mostrarToast('No se pudieron cargar las respuestas.', 'error')
    if (els.estadoVacio) els.estadoVacio.classList.remove('hidden')
  }
}

// ── Inicialización pública ────────────────────────────────────────────────────

/**
 * Inicializa la pestaña de Métricas.
 * Conecta el selector de evento y arranca la primera carga.
 *
 * @param {{ id, nombre, correo, grupo_asignado }} sesion — sesión del maestro
 */
export async function inicializarMetricas(sesion) {
  _sesionMaestro = sesion
  const els = getMetricasEls()

  // Cargar opciones del selector
  const hayEventos = await cargarOpcionesEventos(els.selectEvento, true)

  if (!hayEventos) {
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    if (els.estadoVacio)    els.estadoVacio.classList.remove('hidden')
    return
  }

  if (els.estadoCargando) els.estadoCargando.classList.add('hidden')

  // Escuchar cambio en selector
  els.selectEvento?.addEventListener('change', async () => {
    const eventoId = els.selectEvento.value
    _eventoSeleccionadoId = eventoId || null
    cancelarRealtime()

    if (!eventoId) {
      if (els.contenido)   els.contenido.classList.add('hidden')
      if (els.estadoError) els.estadoError.classList.add('hidden')
      return
    }

    // Actualizar título del evento seleccionado
    const opcion = els.selectEvento.options[els.selectEvento.selectedIndex]
    if (els.tituloEvento) els.tituloEvento.textContent = opcion.textContent

    await calcularYMostrarMetricas(eventoId, sesion.grupo_asignado ?? null)
    suscribirRealtime(eventoId, sesion.grupo_asignado ?? null)
  })
}

/**
 * Inicializa la pestaña de Respuestas.
 * Conecta el selector de evento y arranca la primera carga.
 *
 * @param {{ id, nombre, correo, grupo_asignado }} sesion
 */
export async function inicializarRespuestas(sesion) {
  const els = getRespuestasEls()

  // Cargar opciones — incluir también inactivos para ver historial
  const hayEventos = await cargarOpcionesEventos(els.selectEvento, false)

  if (!hayEventos) {
    if (els.estadoCargando) els.estadoCargando.classList.add('hidden')
    if (els.estadoVacio)    els.estadoVacio.classList.remove('hidden')
    return
  }

  if (els.estadoCargando) els.estadoCargando.classList.add('hidden')

  els.selectEvento?.addEventListener('change', async () => {
    const eventoId = els.selectEvento.value
    if (!eventoId) {
      if (els.tabla)       els.tabla.classList.add('hidden')
      if (els.estadoVacio) els.estadoVacio.classList.add('hidden')
      return
    }
    await cargarRespuestasDetalladas(eventoId)
  })
}
