/**
 * supabaseClient.js
 * Singleton que inicializa y exporta el cliente de Supabase para toda la aplicación.
 *
 * ⚠️  IMPORTANTE: Reemplaza los valores de SUPABASE_URL y SUPABASE_ANON_KEY
 *     con las credenciales reales de tu proyecto en Supabase antes de desplegar.
 *     Las encontrarás en: Supabase Dashboard → Project Settings → API
 */

// Importar la función createClient desde el CDN oficial de Supabase (ES modules)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ── Credenciales del proyecto ────────────────────────────────────────────────
// Reemplaza estos valores con los de tu proyecto en Supabase.
// NUNCA uses aquí la service_role key; usa únicamente la anon/publishable key.
const SUPABASE_URL = 'https://vumbkxtgkosnfuzsifyd.supabase.co'       
const SUPABASE_ANON_KEY = 'sb_publishable_b2KWsaLg7rOMqZbA3YcEZA_-GzrzUgy' 

// ── Inicialización del cliente ───────────────────────────────────────────────
// Se crea una sola instancia (patrón Singleton) reutilizada por todos los módulos.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Guía de manejo de errores para los módulos que consuman este cliente:
 *
 *  - Req 15.1 / Req 15.2: Ante cualquier error retornado por Supabase, muestra
 *    al usuario un mensaje en lenguaje natural sin exponer términos técnicos
 *    (nunca "HTTP 500", "network timeout", "query failed", etc.).
 *
 *  - Req 15.3: Registra siempre el detalle técnico en consola para diagnóstico:
 *
 *      const { data, error } = await supabase.from('tabla').select()
 *      if (error) {
 *        console.error('[Supabase Error]', {
 *          timestamp: new Date().toISOString(),
 *          tabla: 'tabla',
 *          operacion: 'SELECT',
 *          error
 *        })
 *        return { ok: false, mensajeUsuario: 'No se pudo conectar a la base de datos. Verifica tu conexión a internet.' }
 *      }
 */
