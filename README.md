# AcademicAI 

AcademicAI es una plataforma web moderna de gestión académica diseñada para estudiantes. Combina herramientas tradicionales de organización (horarios, tareas) con Inteligencia Artificial avanzada (RAG) para ofrecer un asistente de estudio personalizado que responde preguntas basándose **exclusivamente en tus propios apuntes**.

##  Características Principales

*   **Asistente de IA (Motor RAG):** Sube tus documentos (PDF, Word, TXT) y hazle preguntas a la IA. El sistema extraerá el texto localmente y la IA (potenciada por Groq / Llama 3) te responderá usando únicamente la información de tus archivos.
*   **Gestión Inteligente de Fuentes:** Puedes seleccionar, deseleccionar, renombrar y eliminar documentos del contexto de la IA en tiempo real para enfocar su lectura.
*   **Dashboard Dinámico:** Un panel principal que lee tu reloj en tiempo real para mostrarte tu clase actual ("AHORA") y la siguiente ("PRÓXIMA"), calculando matemáticamente la posición en el tiempo.
*   **Gestor de Horarios:** Interfaz visual para cargar y visualizar tu carga académica semanal de forma estructurada.
*   **Diseño Moderno (Glassmorphism):** Una interfaz de usuario pulida, con soporte nativo para Modo Oscuro, tipografías modernas (Plus Jakarta Sans) y micro-animaciones fluidas.

##  Tecnologías Utilizadas

Este proyecto utiliza un stack moderno enfocado en la velocidad, el procesamiento híbrido (extracción en el navegador y almacenamiento estructurado) y la integración con Inteligencia Artificial de vanguardia.

###  Frontend (Interfaz de Usuario)
*   **React.js (v18):** Librería principal para construir la interfaz de usuario de forma modular y reactiva.
*   **Vite:** Herramienta de construcción ultrarrápida (Bundler) para el entorno de desarrollo y empaquetado.
*   **CSS3 Vanilla:** Estilos nativos utilizando variables CSS, flexbox, grid y un sistema de diseño propio basado en *Glassmorphism* (desenfoques y transparencias).
*   **Lucide React:** Colección de iconos SVG limpios y modernos para toda la interfaz.
*   **Marked / React Markdown:** Procesador de Markdown a HTML rápido y seguro, usado para renderizar las respuestas de la IA.
*   **Vite Plugin PWA:** Configuración de la Progressive Web App para habilitar el funcionamiento offline y la visualización de notificaciones del sistema.

###  Inteligencia Artificial y Procesamiento
*   **Groq API (Cloud):** Motor de inferencia ultrarrápido utilizado como cerebro principal del asistente. Utiliza actualmente el modelo **Llama 3.1 (8B Instant)** de Meta.
*   **Gemini API (Google):** Procesador multimodal de visión artificial (`gemini-2.5-flash`) utilizado en el módulo de digitalización de horarios para extraer la estructura tabular a partir de imágenes.
*   **pdfjs-dist (Mozilla):** Extractor local de texto crudo a partir de documentos PDF cargados por el usuario.
*   **mammoth.js:** Conversor local que extrae texto estructurado desde documentos Word (`.docx`).

###  Almacenamiento y Backend (BaaS)
*   **Supabase (BaaS):** Utilizado para la persistencia en la nube de los usuarios (autenticación JWT), tareas, horarios y documentos extraídos.
*   **LocalStorage (Nativo del Navegador):** Usado para almacenar de forma persistente notas de apuntes locales, calificaciones por asignatura, y caché de recomendaciones y configuraciones de alertas.

##  Funcionamiento del Asistente (RAG Ligero)

El sistema implementa una arquitectura de **Generación Aumentada por Recuperación (RAG)** híbrida:
1. **Extracción en Cliente:** El navegador del usuario extrae el texto del documento (PDF/DOCX/TXT) localmente con `pdf.js` o `mammoth.js`.
2. **Almacenamiento Sincronizado:** El texto extraído y el archivo original se guardan en Supabase (base de datos relacional y almacenamiento de objetos).
3. **Contextualización:** Al realizar una consulta en el chat, el frontend obtiene el texto del repositorio seleccionado, lo concatena, limita su tamaño a 8000 caracteres para asegurar la compatibilidad con el límite de tokens, y lo inyecta directamente como contexto en el prompt enviado al LLM.
4. **Generación con Llama 3.1:** Groq procesa la consulta utilizando el contexto inyectado de forma efímera (política de retención cero) y devuelve una respuesta estructurada libre de alucinaciones.