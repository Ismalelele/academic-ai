# AcademicAI



AcademicAI es una plataforma web moderna y premium de gestión académica diseñada para estudiantes. Combina herramientas tradicionales de organización (horarios, tareas) con Inteligencia Artificial avanzada (RAG) para ofrecer un asistente de estudio personalizado, simuladores predictivos y chats de curso con bibliotecas colaborativas.



## Características Principales



* Asistente de IA (Motor RAG Híbrido)

  * *Contextualización Efímera:* Sube tus apuntes en formato PDF, Word o TXT. El frontend extrae el texto localmente y la IA (Groq / Llama 3.1) te responde basándose exclusivamente en tu material.

  * *Gestión de Contexto:* Habilita, deshabilita o renombra archivos de forma interactiva en la barra lateral para afinar el foco de lectura del asistente.


* Clases Grabadas & Nombramiento de Apuntes (Audio & Notes Studio)

  * *Reproductor de Audio Integrado:* Escucha grabaciones de tus clases directamente desde la interfaz con controles de reproducción optimizados.

  * *Nombramiento Interactivo:* Permite asignar nombres de manera dinámica a los apuntes de voz al guardarlos, con asignación por defecto inteligente ("nueva nota").

  * *Control de Volumen:* Ajusta el nivel de audio de las grabaciones de tus apuntes con controles personalizados.



* Análisis Crítico de Documentos (Doc Critic & Quiz Wizard)

  * *Extractor Multiformato:* Lee archivos .pdf, .docx, .txt y .pptx (PowerPoint) gracias a un extractor local personalizado basado en jjszip.

  * *Evaluación Cualitativa:* Gráfico de anillo animado (semáforo de notas del 1 al 10) que indica la calidad académica del documento y enumera áreas de mejora.

  * *Generador de Resúmenes:* Genera resúmenes ejecutivos cortos o completos listos para copiar con un solo clic.

  * *Quizzes Interactivos:* Generación inteligente de cuestionarios paso a paso en formato JSON con retroalimentación inmediata por pregunta y puntaje final de comprensión.



* Pronóstico Académico Predictivo & Horario Interactivo (Subject Simulator & Inline Editor)

  * *Cálculo de Promedios Ponderados:* Administra las calificaciones de cada asignatura y simula las notas restantes necesarias para aprobar (nota 4.0) o eximirte (nota 5.0).

  * *Editor de Horario Inline:* Corrección rápida e inline de asignaturas, aulas, bloques de horas y días directamente desde la página sin necesidad de modales intrusivos.

  * *Paleta de Colores Extendida:* Personalización de asignaturas con 16 combinaciones vibrantes de color totalmente sincronizadas entre el visor principal y el editor.

  * *Semáforo de Riesgo Físico:* Widget interactivo con luces tricolor que cambian en tiempo real según el promedio acumulado.

  * *Predicciones con IA:* Utiliza Groq Llama-3.1 para analizar tu rendimiento actual y recibir mentoría personalizada en Markdown.



* Chats Grupales de Asignatura & Biblioteca Colaborativa

  * *Canales y Códigos de Invitación:* Crea salas de estudio para tus ramos y comparte códigos únicos para que tus compañeros se unan.

  * *Biblioteca del Grupo:* Comparte apuntes, resúmenes o fichas interactivas con tus compañeros. Los recursos pueden ser calificados mediante un sistema de votación por estrellas (1-5).

  * *Fichas de Estudio (Flashcards):* Visor interactivo con animación 3D de volteo al hacer clic para estudiar de manera dinámica.

  * *Perfiles de Integrantes:* Pestaña dedicada para ver la lista de miembros, sus carreras, universidades, biografías y avatares. Haz clic sobre el nombre de cualquier remitente en el chat para desplegar su ficha de perfil.



* Resiliencia Offline (Local-First Mirroring) & Sincronización en Tiempo Real

  * *Sincronización Híbrida:* Soporte para sincronización bidireccional en tiempo real con Supabase. Permite el funcionamiento cooperativo de pizarras colaborativas (`GroupWhiteboard`), hilos de conversación y salas de juego competitivas multiplayer (`GroupVersus`).

  * *Mitigación de Errores de Red:* La aplicación implementa bloques de control try-catch robustos en todas las llamadas externas para evitar alertas molestas y excepciones "Failed to fetch".

  * *Espejo Local Automático:* Tus tareas, apuntes, notificaciones y conversaciones se replican optimistamente en localStorage, garantizando un funcionamiento fluido en modo sin conexión.

  * *Sesiones Locales:* Inicio de sesión y registro de cuentas de forma transparente en modo local/offline ante caídas de red o bases de datos de Supabase inaccesibles.



* Gestión Determinista de Notificaciones (Relevancia de Evento)

  * *Sin Reprogramaciones Aleatorias:* Se eliminó el uso de tiempos aleatorios (`Math.random()`) para el re-agendamiento de notificaciones vencidas. Si una alerta se genera para una hora en el pasado (incluso después del ajuste diurno), se descarta de forma silenciosa para asegurar el determinismo.

  * *Ventana de Expiración Estricta:* Las notificaciones retrasadas o almacenadas en LocalStorage que tienen más de 10 minutos de antigüedad se consideran vencidas y se marcan como disparadas sin molestar al usuario.

  * *Horario Diurno Protegido:* Validación a nivel de motor de alertas que restringe el disparo de notificaciones físicas al horario comprendido estrictamente entre las 08:00 AM y las 08:00 PM.



* UI de Navegación Adaptable (Responsive Glassmorphism)

  * *Dock Flotante Premium (Desktop):* Menú inferior flotante estilo macOS/iOS con efecto de cristal esmerilado (backdrop-filter) y centrado suave.

  * *Barra Lateral Izquierda (Mobile):* En celulares, la barra se transforma en un menú vertical compacto fijado al lateral izquierdo. Los submenús, popovers de perfil y el asistente de chat se despliegan hacia la derecha con transiciones fluidas.

  * *Ajuste Inteligente de Padding:* Modificación responsiva dinámica del área de visualización (`padding-left: 80px` con menú lateral abierto, y colapso completo a `padding-left: 16px/15px` al cerrarlo) para que las cabeceras, tarjetas de contenido y listas aprovechen el 100% de la pantalla de forma simétrica y perfectamente alineadas.

  * *Flexbox de Alto Constante:* Extracción de la regla `.height-constrained-page` al ámbito global para obligar a que las páginas interactivas complejas (Asistente IA, Chats) se ajusten al viewport del teléfono (`height: 100%; overflow: hidden`), previniendo que el teclado del celular o los scroll-to-view desplacen y corten las cabeceras principales de la interfaz.



## Tecnologías Utilizadas



Este proyecto implementa un stack moderno enfocado en la velocidad de ejecución y la privacidad (procesamiento del lado del cliente):



### Frontend e Interfaz

* React.js (v18): Estructura del sitio basada en componentes reutilizables.

* Vite: Compilación y entorno de desarrollo de alta velocidad.

* Vanilla CSS3: Sistema de diseño personalizado de Glassmorphism sin dependencias pesadas.

* Lucide React: Iconos vectoriales modernos.

* Marked: Parseador rápido para renderizar Markdown del asistente y pronósticos.

* Vite Plugin PWA: Automatización de Service Workers para caché offline.



### Inteligencia Artificial

* Groq API / Llama 3.1 (8B Instant): Inferencia ultrarrápida para el Asistente de IA y predicción de calificaciones.

* Gemini 2.5 Flash (Google Vision): Digitalización inteligente de horarios subidos como imagen o PDF.

* pdfjs-dist (Mozilla): Extracción local de texto en PDF.

* mammoth.js: Extractor local de texto en archivos Word.

* jjszip: Parser de archivos PowerPoint (.pptx) para extraer texto de las diapositivas localmente.



### Backend y Base de Datos

* Supabase (BaaS): Autenticación JWT, tablas relacionales e inserciones de chats en tiempo real.

* LocalStorage: Persistencia híbrida en el cliente para el espejo local-first.

