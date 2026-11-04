/**
 * respuestas.js
 * Módulo de respuestas de autorización.
 *
 * Tarea 3.2: obtenerRespuestaExistente (implementado)
 *            enviarRespuesta (stub — se implementa en tarea 3.3)
 *
 * Requirements: 3.2, 3.4, 3.5, 3.7, 11.1, 11.2, 11.3, 11.4, 15.2
 */

import { supabase } from '../supabaseClient.js'

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Obtiene la respuesta existente para la combinación evento_id + matricula_alumno.
 * Retorna null si no existe ninguna respuesta.
 *
 * @param {string} evento_id
 * @param {string} matricula_alumno
 * @returns {Promise<
 *   { data: Respuesta | null, error: string | null }
 * >}
 *
 * Requirements: 11.4
 */
export async function obtenerRespuestaExistente(evento_id, matricula_alumno) {
  try {
    const { data, error } = await supabase
      .from('respuestas_autorizaciones')
      .select(
        'id, evento_id, matricula_alumno, nombre_tutor, parentesco_tutor, autoriza, alergias, nota_adicional, created_at'
      )
      .eq('evento_id', evento_id)
      .eq('matricula_alumno', matricula_alumno)
      .maybeSingle()

    if (error) {
      console.error('[Supabase Error]', {
        timestamp:  new Date().toISOString(),
        tabla:      'respuestas_autorizaciones',
        operacion:  'SELECT',
        error,
      })
      return {
        data:  null,
        error: 'No se pudo verificar si ya existe una respuesta. Verifica tu conexión a internet',
      }
    }

    return { data: data ?? null, error: null }

  } catch (err) {
    console.error('[Red Error]', {
      timestamp:  new Date().toISOString(),
      tabla:      'respuestas_autorizaciones',
      operacion:  'SELECT',
      err,
    })
    return {
      data:  null,
      error: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet',
    }
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────

/**
 * Verifica unicidad e inserta una respuesta en `respuestas_autorizaciones`.
 *
 * Pasos:
 * 1. Comprueba si ya existe un registro para la combinación evento_id + matricula_alumno.
 * 2. Si existe: retorna { ok: false, error: 'duplicado' } sin tocar la BD.
 * 3. Si es único: inserta el registro con todos los campos.
 *    - autoriza se convierte de string 'si'/'no' a boolean.
 *    - alergias y nota_adicional se almacenan como '' si no se proporcionaron (Req 3.2).
 * 4. Maneja el error de constraint único de la BD (código 23505) como duplicado.
 * 5. Ante cualquier error de red/BD: loguea en consola y retorna { ok: false, error: 'red' }.
 *
 * @param {{
 *   evento_id:         string,
 *   matricula_alumno:  string,
 *   nombre_tutor:      string,
 *   parentesco_tutor:  string,
 *   autoriza:          'si' | 'no',
 *   alergias?:         string,
 *   nota_adicional?:   string
 * }} campos
 * @returns {Promise<
 *   { ok: true } |
 *   { ok: false, error: 'duplicado' | 'red' | 'validacion' }
 * >}
 *
 * Requirements: 3.2, 3.4, 3.5, 3.7, 11.1, 11.2, 11.3, 15.2
 */
export async function enviarRespuesta(campos) {
  try {
    // ── 1. Verificar unicidad (primera línea de defensa) — Req 11.1, 11.2 ───
    const { data: existente, error: errorVerificacion } = await supabase
      .from('respuestas_autorizaciones')
      .select('id')
      .eq('evento_id', campos.evento_id)
      .eq('matricula_alumno', campos.matricula_alumno)
      .maybeSingle()

    if (errorVerificacion) {
      console.error('[Supabase Error]', {
        timestamp:  new Date().toISOString(),
        tabla:      'respuestas_autorizaciones',
        operacion:  'SELECT (verificación duplicado)',
        error:      errorVerificacion,
      })
      return { ok: false, error: 'red' }
    }

    // ── 2. Duplicado detectado en cliente — Req 3.4, 11.2, 11.3 ────────────
    if (existente) {
      return { ok: false, error: 'duplicado' }
    }

    // ── 3. Insertar registro único — Req 3.2 ─────────────────────────────────
    const { error: errorInsert } = await supabase
      .from('respuestas_autorizaciones')
      .insert({
        evento_id:        campos.evento_id,
        matricula_alumno: campos.matricula_alumno,
        nombre_tutor:     campos.nombre_tutor,
        parentesco_tutor: campos.parentesco_tutor,
        autoriza:         campos.autoriza === 'si',           // string → boolean
        alergias:         campos.alergias?.trim()        || '', // nunca null — Req 3.2
        nota_adicional:   campos.nota_adicional?.trim()  || '', // nunca null — Req 3.2
      })

    if (errorInsert) {
      // ── 4. Constraint único de BD (race condition) — código 23505 ──────────
      const esDuplicadoBD =
        errorInsert.code === '23505' ||
        errorInsert.message?.toLowerCase().includes('unique') ||
        errorInsert.message?.toLowerCase().includes('duplicate')

      if (esDuplicadoBD) {
        return { ok: false, error: 'duplicado' }
      }

      console.error('[Supabase Error]', {
        timestamp:  new Date().toISOString(),
        tabla:      'respuestas_autorizaciones',
        operacion:  'INSERT',
        error:      errorInsert,
      })
      return { ok: false, error: 'red' }
    }

    // ── 5. Éxito — Req 3.5 ───────────────────────────────────────────────────
    return { ok: true }

  } catch (err) {
    // Error de red inesperado (Req 15.2)
    console.error('[Red Error]', {
      timestamp:  new Date().toISOString(),
      tabla:      'respuestas_autorizaciones',
      operacion:  'INSERT',
      err,
    })
    return { ok: false, error: 'red' }
  }
}
