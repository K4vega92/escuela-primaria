/**
 * login-maestros.js
 * Controlador del formulario de login de maestros (login-maestros.html).
 *
 * Autenticación simplificada: comparación directa de texto plano contra
 * la columna `password` de la tabla `usuarios_maestros`.
 *
 * Flujo:
 *  1. Si ya hay sesión válida → redirigir directo a panel-maestros.html
 *  2. Validar campos no vacíos
 *  3. Consultar usuarios_maestros WHERE email = correo
 *  4. Comparar password con === (texto plano)
 *  5. Si ok → guardar sesión en sessionStorage → redirigir a panel-maestros.html
 *  6. Si falla → mostrar "Credenciales inválidas"
 */

import { supabase } from '../supabaseClient.js'

// ── Constantes ────────────────────────────────────────────────────────────────
const CLAVE_SESION  = 'sesion_maestro'
const TTL_8H        = 8 * 60 * 60 * 1000

// ── Sesión ────────────────────────────────────────────────────────────────────

function guardarSesion(maestro) {
  const sesion = {
    id:             maestro.id,
    nombre:         maestro.nombre,
    correo:         maestro.email,
    grupo_asignado: maestro.grupo_asignado ?? null,
    expiresAt:      Date.now() + TTL_8H,
  }
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
}

function sesionValida() {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION)
    if (!raw) return false
    const s = JSON.parse(raw)
    return s.expiresAt > Date.now()
  } catch {
    return false
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const errorGeneral  = document.getElementById('login-error-general')
const errorCorreo   = document.getElementById('correo-error')
const errorPassword = document.getElementById('contrasena-error')
const inputCorreo   = document.getElementById('correo')
const inputPass     = document.getElementById('contrasena')
const btnSubmit     = document.getElementById('btn-login-submit')
const btnTexto      = document.getElementById('btn-login-texto')

function limpiarErrores() {
  errorGeneral.textContent  = ''
  errorGeneral.classList.add('hidden')
  errorCorreo.textContent   = ''
  errorPassword.textContent = ''
  inputCorreo.classList.remove('is-error')
  inputPass.classList.remove('is-error')
}

function mostrarErrorGeneral(msg) {
  errorGeneral.textContent = msg
  errorGeneral.classList.remove('hidden')
}

function setLoading(loading) {
  btnSubmit.disabled   = loading
  btnTexto.textContent = loading ? 'Verificando…' : 'Iniciar sesión'
}

// ── Si ya tiene sesión activa, saltar directo al panel ────────────────────────
if (sesionValida()) {
  window.location.href = 'panel-maestros.html'
}

// ── Manejo del formulario ─────────────────────────────────────────────────────

document.getElementById('form-login-maestro')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  limpiarErrores()

  const correo   = inputCorreo.value.trim()
  const password = inputPass.value

  // Validación de campos vacíos
  let hayError = false
  if (!correo) {
    errorCorreo.textContent = 'El correo es obligatorio.'
    inputCorreo.classList.add('is-error')
    hayError = true
  }
  if (!password) {
    errorPassword.textContent = 'La contraseña es obligatoria.'
    inputPass.classList.add('is-error')
    hayError = true
  }
  if (hayError) return

  setLoading(true)

  try {
    // Consultar la tabla usando el email (case-insensitive)
    const { data, error } = await supabase
      .from('usuarios_maestros')
      .select('id, email, password, nombre, grupo_asignado')
      .ilike('email', correo)
      .maybeSingle()

    if (error) {
      console.error('[Supabase Error]', error)
      mostrarErrorGeneral('No se pudo conectar a la base de datos. Verifica tu conexión.')
      setLoading(false)
      return
    }

    // Usuario no encontrado o contraseña incorrecta — mismo mensaje (no revelar cuál)
    if (!data || data.password !== password) {
      mostrarErrorGeneral('Credenciales inválidas. Verifica tu correo y contraseña.')
      inputPass.value = ''
      setLoading(false)
      return
    }

    // Login exitoso
    guardarSesion(data)
    btnTexto.textContent = '¡Bienvenido!'
    // Pequeño delay para que se note el feedback antes de redirigir
    setTimeout(() => {
      window.location.href = 'panel-maestros.html'
    }, 400)

  } catch (err) {
    console.error('[Red Error]', err)
    mostrarErrorGeneral('No se pudo conectar. Verifica tu conexión a internet.')
    setLoading(false)
  }
})
