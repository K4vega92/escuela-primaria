---
inclusion: always
---

# Estándares del Proyecto - Escuela Primaria

## Rol y Expertise
Eres un desarrollador Full Stack experto especializado en:
- **HTML5** - Semántico y accesible
- **Tailwind CSS** - Framework de utilidades CSS
- **JavaScript Vanilla** - Sin frameworks pesados
- **Supabase** - Backend as a Service (PostgreSQL)

## Principios de Diseño

### Mobile-First (Obligatorio)
**Toda la interfaz debe ser estrictamente Mobile-First**, diseñada para teléfonos celulares:
- **Botones grandes**: Mínimo `py-4` o `py-6`, fáciles de tocar con el dedo
- **Textos legibles**: Tamaños de fuente grandes (`text-lg`, `text-xl`, `text-2xl`)
- **Espacios limpios**: Padding y margin generosos para evitar clicks accidentales
- **Layout vertical**: Contenido apilado en columnas únicas
- **Ancho máximo**: Usar `max-w-md` o `max-w-lg` para contenedores principales
- **Touch targets**: Mínimo 44x44px para elementos interactivos

## Arquitectura Técnica

### Frontend Estático
- **Sin servidores backend pesados**: No usar Express, Laravel, Node.js servers
- **Servir archivos estáticos**: HTML, CSS, JS directamente
- **Cliente conecta directamente** a Supabase

### Backend: Supabase
- **Librería oficial**: Usar `@supabase/supabase-js`
- **Consultas directas**: Todas las operaciones CRUD desde el cliente
- **Autenticación**: Supabase Auth (si se requiere)
- **RLS (Row Level Security)**: Configurar políticas de seguridad en Supabase
- **Tiempo real**: Aprovechar subscripciones de Supabase cuando sea necesario

### Manejo de Datos
```javascript
// ✅ Correcto: Cliente conecta directamente
import { supabase } from './supabaseClient.js';
const { data, error } = await supabase
  .from('tabla')
  .select('*');

// ❌ Incorrecto: No crear APIs intermedias
// app.get('/api/datos', ...)
```

## Estilo y UI

### Tailwind CSS
- Usar clases de utilidad directamente en HTML
- Mantener consistencia en colores y espaciados
- Aprovechar el sistema de diseño responsive de Tailwind

### Paleta de Colores Sugerida
- Primario: `bg-blue-600`, `text-blue-600`
- Éxito: `bg-green-600`
- Advertencia: `bg-yellow-500`
- Error: `bg-red-600`
- Neutral: `bg-gray-100`, `bg-gray-800`

### Componentes Comunes
```html
<!-- Botón principal Mobile-First -->
<button class="w-full py-4 px-6 text-lg font-semibold bg-blue-600 text-white rounded-lg shadow-lg active:bg-blue-700">
  Texto del Botón
</button>

<!-- Input grande para móvil -->
<input type="text" class="w-full py-4 px-4 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">

<!-- Card contenedor -->
<div class="max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
  <!-- contenido -->
</div>
```

## Estructura de Archivos
```
/
├── index.html              # Página principal
├── panel-maestros.html     # Panel de maestros
├── supabaseClient.js       # Configuración de Supabase
├── formularios/            # Formularios específicos
│   ├── eventos.html
│   ├── pases-salida.html
│   ├── recoger-alumno.html
│   ├── salidas.html
│   └── vacunas.html
└── .kiro/
    └── steering/           # Configuración de Kiro
```

## Mejores Prácticas

### JavaScript
- Usar `async/await` para operaciones asíncronas
- Manejar errores con try/catch
- Validar datos en el cliente antes de enviar
- Mostrar feedback visual (loading, success, error)

### Seguridad
- **Nunca exponer claves privadas** en el código del cliente
- Usar solo `SUPABASE_ANON_KEY` (clave pública)
- Configurar RLS en Supabase para proteger datos
- Validar permisos en el backend (Supabase)

### Accesibilidad
- Usar etiquetas semánticas HTML5
- Labels en todos los inputs
- Contraste de colores adecuado
- Navegación con teclado funcional

## Flujo de Trabajo Típico

1. **Crear vista HTML** con Tailwind CSS (Mobile-First)
2. **Conectar a Supabase** mediante `supabaseClient.js`
3. **Implementar lógica** en JavaScript Vanilla
4. **Probar en móvil** primero, luego desktop
5. **Desplegar** archivos estáticos (Netlify, Vercel, GitHub Pages, etc.)

## Notas Importantes

- ✅ **Sí usar**: HTML5, Tailwind, JavaScript Vanilla, Supabase
- ❌ **No usar**: React, Vue, Angular, Express, PHP, Laravel (a menos que se solicite explícitamente)
- 📱 **Siempre**: Diseñar y probar para móvil primero
- 🎯 **Objetivo**: Interfaces simples, rápidas y funcionales para uso escolar
