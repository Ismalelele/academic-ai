export const askGroq = async (question, contextText, unselectedDocs = []) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey) {
    return "❌ Error: No se encontró la API Key de Groq. Asegúrate de tener VITE_GROQ_API_KEY en el archivo .env.";
  }

  let unselectedInfo = "";
  if (unselectedDocs && unselectedDocs.length > 0) {
    unselectedInfo = `\nEl usuario tiene otros documentos subidos pero los ha DESMARCADO. Nombres de documentos desmarcados: ${unselectedDocs.join(', ')}. Si la pregunta del usuario parece referirse a estos documentos, no inventes la respuesta. En su lugar, dile amablemente: "Parece que buscas información sobre ese tema, pero no puedo leer el documento correspondiente porque no está marcado en la lista. Por favor, marca la casilla de ese apunte e inténtalo de nuevo."`;
  }

  const systemPrompt = `Eres un asistente académico experto. 
Tu única fuente de conocimiento es el texto proporcionado a continuación. 
Responde la pregunta del usuario utilizando EXCLUSIVAMENTE la información del texto proporcionado. 
Si la respuesta no se encuentra en el texto proporcionado, debes responder: "No lo sé, los apuntes marcados actualmente no mencionan esto." No inventes información.${unselectedInfo}

--- INICIO DEL DOCUMENTO ---
${contextText}
--- FIN DEL DOCUMENTO ---`;

  try {
    // Groq usa el mismo formato de API que OpenAI, lo que facilita la migración
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Modelo actual y rápido de Meta en Groq
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Groq Error:", data);
        return `❌ Error de Groq: ${data.error?.message || 'Error desconocido'}`;
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Fetch Error:", error);
    return "❌ Error de red al intentar contactar a Groq.";
  }
};

export const askDashboardGroq = async (question, contextText) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return "❌ Error: API Key faltante.";

  const systemPrompt = `Eres un asistente de productividad estudiantil amigable y conciso.
Responde de forma muy breve (máximo 2 oraciones), como un widget de chat rápido en un dashboard.
El contexto actual del usuario es: ${contextText}
Usa este contexto para dar una recomendación. Sé directo, y si hay tareas pendientes, sugiere una tarea en específico por su nombre literal. Por ejemplo: "¿Por qué no priorizas la tarea X?". No uses frases cliché como "liberar espacio mental".`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.5
      })
    });
    const data = await response.json();
    if (!response.ok) return "Error de IA.";
    return data.choices[0].message.content;
  } catch (error) {
    return "Error de red.";
  }
};

export const generateStudyPlan = async (availableBlocks, pendingTasks) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");
  
  const systemPrompt = `Eres un planificador académico inteligente.
Recibirás:
1. Bloques de tiempo libres
2. Tareas y evaluaciones pendientes

Genera una rutina de estudio optimizada.

Reglas obligatorias:
- REGLA DE ORO DE LOS BLOQUES: CADA BLOQUE DE ESTUDIO QUE GENERES DEBE CORRESPONDER EXACTAMENTE A UNO DE LOS BLOQUES LIBRES PROPORCIONADOS. Debes copiar exactamente el "day", "startH", "startM", "endH" y "endM" de alguno de los bloques de la lista de Bloques libres. NO inventes horarios de inicio ni de fin que no estén presentados en los bloques libres.
- REGLA DE ORO DE LAS TAREAS: USA ÚNICAMENTE LAS TAREAS PENDIENTES PROPORCIONADAS POR EL USUARIO. Si no hay tareas pendientes, devuelve la rutina vacía: {"rutina": []}. NO INVENTES ASIGNATURAS NI TAREAS.
- NO GENERES BLOQUES DUPLICADOS O SUPERPUESTOS en el mismo día y hora.
- Genera SOLO la cantidad de bloques necesarios según el tiempo estimado de la tarea (Ej: si la tarea dura 2h, genera máximo 3 bloques de 40 mins).
- Prioriza tareas urgentes (evalúa por fecha límite y prioridad).
- Mapea 'day' del 0 (Lunes) al 4 (Viernes).
- No estudiar más de 2 horas seguidas.
- Evita estudiar después de las 23:00.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (NO expliques nada, NO uses formato markdown tipo \`\`\`json):
{
  "rutina": [
    {
      "day": 0,
      "startH": 15,
      "startM": 0,
      "endH": 15,
      "endM": 40,
      "taskTitle": "[USA EXCLUSIVAMENTE UN NOMBRE DE LAS TAREAS RECIBIDAS]",
      "priority": "high",
      "reason": "[Motivo breve]"
    }
  ]
}`;

  const userPrompt = `Bloques libres:\n${JSON.stringify(availableBlocks)}\n\nTareas pendientes:\n${JSON.stringify(pendingTasks)}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    const rutina = parsed.rutina || [];

    // Post-procesamiento para eliminar bloques duplicados o superpuestos por alucinaciones de la IA
    const uniqueBlocks = [];
    const seenKeys = new Set();
    for (const b of rutina) {
      const key = `${b.day}-${b.startH}-${b.startM}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueBlocks.push(b);
      }
    }

    return uniqueBlocks;
  } catch (error) {
    console.error("Error en generateStudyPlan:", error);
    throw error;
  }
};

export const generateToolSuggestions = async (subjects) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");
  
  if (!subjects || subjects.length === 0) {
    return [];
  }

  const subjectName = subjects[0];
  const systemPrompt = `Eres un asesor académico y tutor experto especializado exclusivamente en la asignatura: "${subjectName}".
Tu objetivo es recomendar metodologías de estudio específicas, herramientas de software especializadas y recursos digitales para dominar esta materia.

Reglas:
- Genera exactamente 4 categorías de herramientas/recursos o metodologías de estudio que sean de vital importancia y directamente aplicables a "${subjectName}" (ej: si es Matemáticas/Cálculo, sugiere graficadores y software de ecuaciones; si es Inglés, sugiere herramientas de pronunciación, tarjetas de vocabulario y lectura activa; si es Programación, editores y compiladores).
- En cada categoría, sugiere 1 o 2 herramientas o técnicas concretas.
- El valor de 'icono' debe ser uno de los siguientes strings: 'Brain', 'PencilLine', 'Code', 'Database', 'Rocket', 'Users', 'Share2', 'ShieldCheck'. Elige el que mejor se adapte a la categoría.
- MUY IMPORTANTE: Todo el contenido debe ser 100% específico para "${subjectName}". No sugieras lenguajes de programación como Python ni bases de datos a menos que la asignatura esté directamente relacionada con desarrollo, computación o análisis de datos.
- Explica detallada pero concisamente por qué y cómo usar cada herramienta/técnica en el contexto de "${subjectName}".

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (NO expliques nada, NO uses markdown tipo \`\`\`json):
{
  "sugerencias": [
    {
      "categoria": "Nombre de Categoría",
      "icono": "Brain",
      "herramientas": [
        {
          "nombre": "Nombre de la Herramienta o Técnica",
          "descripcion": "Descripción de cómo usarla para dominar ${subjectName}."
        }
      ]
    }
  ]
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera las sugerencias de estudio específicas para la asignatura de: ${subjectName}.` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.sugerencias || [];
  } catch (error) {
    console.error("Error en generateToolSuggestions:", error);
    return [];
  }
};

export const generateQuizFromNotes = async (notesText, subjectName) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");
  
  if (!notesText || notesText.trim() === '') {
    throw new Error("No hay apuntes seleccionados para generar el Quiz.");
  }

  const systemPrompt = `Eres un docente universitario experto. Tu objetivo es generar un quiz de evaluación interactiva basado exclusivamente en los apuntes proporcionados por el estudiante para la asignatura: "${subjectName}".

Reglas:
- Genera exactamente 5 preguntas de opción múltiple de alta calidad y relevancia respecto al texto de los apuntes.
- Cada pregunta debe tener exactamente 4 opciones de respuesta coherentes.
- Señala cuál es la respuesta correcta usando su índice (0 para la primera opción, 1 para la segunda, 2 para la tercera, y 3 para la cuarta).
- Asegúrate de que las preguntas pongan a prueba el entendimiento real del estudiante (ej: definiciones clave, relaciones conceptuales, lógica de programación, etc.).

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (NO expliques nada, NO uses markdown tipo \`\`\`json):
{
  "quiz": [
    {
      "id": 1,
      "pregunta": "¿Qué es X en el contexto de Y?",
      "opciones": [
        "Opción A",
        "Opción B",
        "Opción C",
        "Opción D"
      ],
      "respuestaCorrecta": 0
    }
  ]
}`;

  const userPrompt = `Aquí están mis apuntes de ${subjectName}:\n---\n${notesText}\n---\nPor favor genera mi quiz interactivo de 5 preguntas sobre estos apuntes.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.quiz || [];
  } catch (error) {
    console.error("Error en generateQuizFromNotes:", error);
    throw error;
  }
};

/**
 * Realiza un análisis crítico de un documento y lo evalúa del 1 al 10.
 * @param {string} documentText Texto extraído del documento.
 * @returns {Promise<object>} JSON con la nota, análisis crítico y áreas de mejora.
 */
export const analyzeUploadedDocument = async (documentText) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  // Truncar texto si excede límite para evitar sobrecarga de la API
  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const systemPrompt = `Eres un evaluador académico experto e implacable.
Tu tarea es realizar un análisis crítico y riguroso de la calidad, estructura, redacción y coherencia del texto proporcionado.
Debes calificar el documento con una nota del 1 al 10 (donde 1 es extremadamente deficiente y 10 es perfecto, de nivel de publicación científica).

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (NO uses formato markdown tipo \`\`\`json ni expliques nada adicional):
{
  "score": [Número entero del 1 al 10],
  "criticalAnalysis": "[Tu análisis crítico cualitativo en formato Markdown, señalando fortalezas, debilidades, rigor conceptual y claridad de ideas. Sé detallado y constructivo.]",
  "improvementAreas": [
    "[Área de mejora 1 detallada]",
    "[Área de mejora 2 detallada]",
    "[Área de mejora 3 detallada]"
  ]
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analiza críticamente el siguiente texto:\n\n${text}` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Error en analyzeUploadedDocument:", error);
    throw error;
  }
};

/**
 * Genera un resumen del documento, ya sea corto o completo.
 * @param {string} documentText Texto extraído del documento.
 * @param {string} summaryType Tipo de resumen: 'short' o 'complete'.
 * @returns {Promise<string>} Texto del resumen en formato Markdown.
 */
export const generateDocumentSummary = async (documentText, summaryType) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const isShort = summaryType === 'short';
  const systemPrompt = isShort 
    ? `Eres un experto en síntesis de información. Genera un resumen CORTITO, directo y al grano del texto proporcionado.
Usa viñetas (bullets) para destacar los puntos clave. No te extiendas más de 3 párrafos cortos o 5 viñetas principales. Entrega la respuesta directamente en formato Markdown.`
    : `Eres un redactor académico experto. Genera un resumen COMPLETO, detallado y bien estructurado del documento proporcionado.
Divide el resumen en subtítulos conceptuales acordes con los temas del texto, desarrolla explicaciones claras de cada concepto y entrega una conclusión de la lectura. Utiliza formato Markdown premium.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera un resumen ${isShort ? 'corto y sintético' : 'completo y estructurado'} del siguiente texto:\n\n${text}` }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en generateDocumentSummary:", error);
    throw error;
  }
};

/**
 * Genera un Quiz interactivo de 5 preguntas basado en el texto del documento.
 * @param {string} documentText Texto extraído del documento.
 * @returns {Promise<Array>} Lista de 5 preguntas para el quiz.
 */
export const generateQuizFromText = async (documentText) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const systemPrompt = `Eres un docente universitario experto en evaluaciones.
Genera un quiz de evaluación interactivo de exactamente 5 preguntas basadas exclusivamente en el texto del documento que se te proporciona.

Reglas:
- Genera exactamente 5 preguntas de opción múltiple de alta calidad y relevancia.
- Cada pregunta debe tener exactamente 4 opciones de respuesta coherentes.
- Señala cuál es la respuesta correcta usando su índice (0 para la primera opción, 1 para la segunda, 2 para la tercera, y 3 para la cuarta).
- Asegúrate de que las preguntas evalúen el aprendizaje conceptual real del documento.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura (NO expliques nada, NO uses markdown tipo \`\`\`json):
{
  "quiz": [
    {
      "id": 1,
      "pregunta": "¿Qué define el concepto X?",
      "opciones": [
        "Opción A",
        "Opción B",
        "Opción C",
        "Opción D"
      ],
      "respuestaCorrecta": 1
    }
  ]
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera mi quiz interactivo basado en este texto:\n\n${text}` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.quiz || [];
  } catch (error) {
    console.error("Error en generateQuizFromText:", error);
    throw error;
  }
};

/**
 * Genera un análisis crítico y recomendaciones basadas en las notas y el riesgo académico.
 */
export const getAcademicRiskAnalysis = async (subjectName, currentGrades, remainingWeight, gradeNeededToPass) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const gradesString = currentGrades.map(g => `Nota: ${g.note} (Ponderación: ${g.weight}%)`).join(', ');

  const systemPrompt = `Eres un consejero académico y mentor estudiantil de IA.
Tu objetivo es analizar la situación académica de un estudiante en la asignatura "${subjectName}" y entregarle un veredicto realista, motivador, con consejos específicos y estrategias de estudio recomendadas.

Contexto del estudiante:
- Asignatura: ${subjectName}
- Notas obtenidas actualmente: [${gradesString}]
- Porcentaje restante del ramo: ${remainingWeight}%
- Nota promedio mínima que necesita en lo restante para aprobar (con nota final 4.0): ${gradeNeededToPass > 7.0 ? 'Imposible de aprobar directamente' : gradeNeededToPass.toFixed(2)}

Entrega tu respuesta estructurada en dos o tres párrafos cortos en formato Markdown (puedes usar negritas, listas, etc.). Sé directo, empático pero realista con sus opciones de aprobación.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analiza mi situación actual para el ramo ${subjectName} e indícame qué debo hacer.` }
        ],
        temperature: 0.5
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error de API');

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en getAcademicRiskAnalysis:", error);
    throw error;
  }
};

