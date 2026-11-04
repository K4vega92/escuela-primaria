/**
 * eventos.js
 * Módulo de gestión de eventos de autorización para padres.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.2, 15.1, 15.3
 */

import { supabase } from '../supabaseClient.js'

/**
 * Obtiene los eventos activos de la tabla `eventos_autorizaciones`
 * y para cada uno verifica si el alumno (por matrícula) ya respondió.
 *
 * Los resultados se ordenan por `fecha_evento` ascendente (más próximos primero).
 *
 * @param {string} matricula — Matrícula del alumno cuya sesión está activa
 * @returns {Promise<
 *   { data: Array<Evento & { respondido: boolean }>, error: null } |
 *   { data: null, error: string }
 * >}
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 12.2
 */
export async function obtenerEventosActivos(matricula) {
  try {
    // 1. Consultar eventos donde activo sea true ordenados por fecha_evento ASC
    const { data: eventos, error: errorEventos } = await supabase
      .from('eventos_autorizaciones')
      .select('id, tipo, titulo, descripcion, fecha_evento, activo, created_at')
      .eq('activo', true)
      .order('fecha_evento', { ascending: true })

    if (errorEventos) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla: 'eventos_autorizaciones',
        operacion: 'SELECT',
        error: errorEventos,
      })
      return {
        data: null,
        error: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet',
      }
    }

    // Sin eventos activos → lista vacía (Req 4.5)
    if (!eventos || eventos.length === 0) {
      return { data: [], error: null }
    }

    // 2. Consultar todas las respuestas de este alumno de una sola vez (eficiencia)
    const { data: respuestas, error: errorRespuestas } = await supabase
      .from('respuestas_autorizaciones')
      .select('evento_id')
      .eq('matricula_alumno', matricula)

    if (errorRespuestas) {
      console.error('[Supabase Error]', {
        timestamp: new Date().toISOString(),
        tabla: 'respuestas_autorizaciones',
        operacion: 'SELECT',
        error: errorRespuestas,
      })
      // Error no crítico: seguimos mostrando eventos pero sin flag respondido
      // (mejor mostrar algo que nada)
      return {
        data: eventos.map((ev) => ({ ...ev, respondido: false })),
        error: null,
      }
    }

    // Crear un Set de evento_ids respondidos para O(1) lookup
    const respondidosSet = new Set((respuestas ?? []).map((r) => r.evento_id))

    // 3. Combinar eventos con flag respondido (Req 4.3)
    const eventosConFlag = eventos.map((ev) => ({
      ...ev,
      respondido: respondidosSet.has(ev.id),
    }))

    return { data: eventosConFlag, error: null }

  } catch (err) {
    console.error('[Red Error]', {
      timestamp: new Date().toISOString(),
      tabla: 'eventos_autorizaciones',
      operacion: 'SELECT',
      err,
    })
    return {
      data: null,
      error: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet',
    }
  }
}

/**
 * Formatea una fecha ISO `YYYY-MM-DD` al formato legible `DD/MM/YYYY`.
 *
 * @param {string} fechaIso — Fecha en formato 'YYYY-MM-DD'
 * @returns {string} Fecha en formato 'DD/MM/YYYY'
 *
 * Requirement: 4.2
 */
export function formatearFecha(fechaIso) {
  if (!fechaIso) return ''
  // Parsear sin zona horaria para evitar desplazamiento de día
  const [anio, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}/${anio}`
}

/**
 * Determina si un evento está vencido comparando su fecha_evento con hoy.
 *
 * @param {string} fechaLimiteIso — Fecha en formato 'YYYY-MM-DD'
 * @returns {boolean}
 *
 * Requirement: 4.6
 */
export function esVencido(fechaLimiteIso) {
  if (!fechaLimiteIso) return false
  // Comparar solo la parte de fecha (sin hora) para evitar problemas de zona horaria
  const hoy = new Date()
  const [anio, mes, dia] = fechaLimiteIso.split('-').map(Number)
  const fechaLimite = new Date(anio, mes - 1, dia) // mes es 0-indexed
  // Normalizar "hoy" a medianoche
  const hoyNormalizado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return fechaLimite < hoyNormalizado
}
