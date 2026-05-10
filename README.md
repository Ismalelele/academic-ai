# AcademicAI 

AcademicAI es una plataforma web moderna de gestión académica diseñada para estudiantes. Combina herramientas tradicionales de organización (horarios, tareas) con Inteligencia Artificial avanzada (RAG) para ofrecer un asistente de estudio personalizado que responde preguntas basándose **exclusivamente en tus propios apuntes**.

##  Características Principales

*   **Asistente de IA (Motor RAG):** Sube tus documentos (PDF, Word, TXT) y hazle preguntas a la IA. El sistema extraerá el texto localmente y la IA (potenciada por Groq / Llama 3) te responderá usando únicamente la información de tus archivos.
*   **Gestión Inteligente de Fuentes:** Puedes seleccionar, deseleccionar, renombrar y eliminar documentos del contexto de la IA en tiempo real para enfocar su lectura.
*   **Dashboard Dinámico:** Un panel principal que lee tu reloj en tiempo real para mostrarte tu clase actual ("AHORA") y la siguiente ("PRÓXIMA"), calculando matemáticamente la posición en el tiempo.
*   **Gestor de Horarios:** Interfaz visual para cargar y visualizar tu carga académica semanal de forma estructurada.
*   **Diseño Moderno (Glassmorphism):** Una interfaz de usuario pulida, con soporte nativo para Modo Oscuro, tipografías modernas (Plus Jakarta Sans) y micro-animaciones fluidas.

##  Tecnologías Utilizadas y por Implementar

Este proyecto utiliza un stack moderno enfocado en la velocidad, la privacidad del usuario (procesamiento local) y la integración con Inteligencia Artificial de vanguardia.

###  Frontend (Interfaz de Usuario)
*   **React.js (v18):** Librería principal para construir la interfaz de usuario de forma modular y reactiva.
*   **Vite:** Herramienta de construcción ultrarrápida (Bundler) que ofrece un entorno de desarrollo mucho más veloz que Create React App.
*   **CSS3 Vanilla:** Estilos nativos sin frameworks pesados, utilizando variables CSS, flexbox, grid y un sistema de diseño propio basado en *Glassmorphism* (desenfoques y transparencias).
*   **Lucide React:** Colección de iconos SVG limpios y modernos para toda la interfaz.
*   **Marked:** Parseador de Markdown a HTML rápido y seguro, usado para renderizar las respuestas de la IA.

###  Inteligencia Artificial y Procesamiento (RAG)
*   **Groq API (Cloud):** Motor de inferencia ultrarrápido utilizado como "cerebro" principal del asistente. Utiliza actualmente el modelo **Llama 3.1 (8B Instant)** de Meta.
*   **Gemini API (Google) / Modelos de Visión (*Planeado*):** Se implementará para el procesamiento OCR avanzado (Lectura de imágenes de horarios para convertirlos en datos estructurados).
*   **pdfjs-dist (Mozilla):** Librería robusta para leer y extraer texto crudo de documentos PDF de manera 100% local en el navegador del usuario.
*   **mammoth.js:** Conversor diseñado para transformar documentos de Word (`.docx`) a HTML/Texto conservando el significado semántico, procesado localmente.

###  Almacenamiento y Backend
*   **LocalStorage (Nativo del Navegador):** Actualmente usado para persistir configuraciones, tareas y el horario básico sin necesidad de servidor.
*   **Supabase / Firebase (*Planeado*):** Base de datos en la nube (BaaS) que se implementará en el futuro para guardar el estado completo del usuario (apuntes, historial de chat de la IA, tareas completadas) y permitir el inicio de sesión en múltiples dispositivos.


El sistema implementa **Retrieval-Augmented Generation (RAG)** de forma ligera en el cliente:
1. El usuario sube un archivo (PDF/DOCX/TXT).
2. El navegador extrae el texto usando librerías nativas de JavaScript, manteniendo la privacidad y velocidad sin depender de servidores backend pesados.
3. El texto extraído de los documentos *marcados* (activos) se inyecta como contexto en un prompt del sistema.
4. Groq procesa la solicitud mediante un modelo Llama 3 ultrarrápido y devuelve la respuesta en formato Markdown, limitándose a no inventar información fuera del contexto.
