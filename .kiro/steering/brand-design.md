---
inclusion: always
---

# Skill: Diseño de Marca e Identidad Visual - Escuela Primaria  
  
## Propósito  
Definir la identidad visual, paleta de colores y componentes de interfaz para que el sistema web escolar de la primaria de Sofía luzca profesional, amigable, accesible y con una atmósfera cálida e institucional (evitando diseños fríos o genéricos).  
  
## 1. Paleta de Colores Institucional  
- **Azul Primario (Confianza y Seguridad):** Usar `bg-blue-600` para encabezados principales, botones de navegación e identidad general. Hover: `bg-blue-700`.  
- **Verde Éxito / Autorizado (Frescura y Crecimiento):** Usar `bg-emerald-600` para estados de "Autorizado", botones de éxito o confirmaciones de envío.  
- **Amarillo / Ámbar de Acento (Alegría y Alertas):** Usar `bg-amber-500` para destacar avisos importantes, pendientes o llamadas de atención amigables.  
- **Fondos Neutrales (Limpieza):** Fondos generales en `bg-slate-50` y tarjetas contenedoras en blanco puro `bg-white` con sombras suaves (`shadow-md`).  
  
## 2. Tipografía y Textos  
- **Fuente:** Familias sans-serif limpias y modernas (como Inter, System-UI o Roboto).  
- **Jerarquía Clara:**  
  - Títulos principales: `text-2xl font-bold text-gray-800`  
  - Subtítulos o nombres de alumnos: `text-lg font-semibold text-gray-600`  
  - Textos de lectura general: `text-base text-gray-700`  
  
## 3. Componentes Visuales y UI (Enfoque Mobile-First)  
- **Tarjetas (Cards):** Bordes redondeados amplios (`rounded-2xl`), con padding generoso (`p-6`) y sombras sutiles para separar secciones de formularios o eventos.  
- **Botones Táctiles:**   
  - Altura y padding grande (`py-4 px-6 text-lg rounded-xl font-medium`).  
  - Transiciones suaves al toque (`transition-all active:scale-95`).  
- **Campos de Formulario (Inputs):** Bordes claros (`border border-gray-300`), esquinas redondeadas (`rounded-xl`), texto amplio (`text-lg p-4`) para evitar errores de digitación en celulares.  
- **Iconografía y Badges:** Uso de etiquetas flotantes redondeadas (`px-3 py-1 rounded-full text-sm font-semibold`) para diferenciar grupos (ej. "3°A") o estatus (Pendiente / Autorizado).
