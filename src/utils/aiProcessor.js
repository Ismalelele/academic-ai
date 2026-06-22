const fetchGroqWithRetry = async (url, options = {}, maxRetries = 3) => {
  let retries = 0;
  while (true) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        retries++;
        if (retries > maxRetries) {
          return response;
        }

        let retryAfter = 0;
        const headerVal = response.headers.get('retry-after');
        if (headerVal) {
          retryAfter = parseFloat(headerVal) * 1000;
        } else {
          try {
            const clone = response.clone();
            const body = await clone.json();
            const errMsg = body?.error?.message || '';
            const match = errMsg.match(/try again in ([0-9.]+)\s*s/i) || errMsg.match(/try again in ([0-9.]+)\s*ms/i);
            if (match) {
              const isMs = errMsg.toLowerCase().includes('ms');
              retryAfter = parseFloat(match[1]) * (isMs ? 1 : 1000);
            }
          } catch (e) {
            // Ignorar errores al parsear JSON
          }
        }

        if (!retryAfter || isNaN(retryAfter)) {
          retryAfter = Math.pow(2, retries) * 1000;
        }

        const waitMs = retryAfter + 500;
        console.warn(`[Groq API] rate limit (429) detected. Retrying ${retries}/${maxRetries} in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      return response;
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        throw error;
      }
      const waitMs = Math.pow(2, retries) * 1000;
      console.warn(`[Groq API] fetch error. Retrying ${retries}/${maxRetries} in ${waitMs}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
};

export const askGroq = async (question, contextText, unselectedDocs = []) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    return "❌ Error: No se encontró la API Key de Groq. Asegúrate de tener VITE_GROQ_API_KEY en el archivo .env.";
  }

  let unselectedInfo = "";
  if (unselectedDocs && unselectedDocs.length > 0) {
    unselectedInfo = `\nEl usuario tiene otros documentos subidos pero los ha DESMARCADO. Nombres de documentos desmarcados: ${unselectedDocs.join(', ')}. Si la pregunta del usuario parece referirse a estos documentos, no inventes la respuesta. En su lugar, dile amablemente: "Parece que buscas información sobre ese tema, pero no puedo leer el documento correspondiente porque no está marcado en la lista. Por favor, marca la casilla de ese apunte e inténtalo de nuevo."`;
  }

  // Truncate contextText to max 12,000 characters (approx 3,000 tokens)
  let text = contextText || "";
  if (text.length > 12000) {
    text = text.substring(0, 12000) + "\n\n... [Texto truncado por límite de contexto de la IA]";
  }

  const systemPrompt = `Eres un asistente académico experto. 
Tu única fuente de conocimiento es el texto proporcionado a continuación. 
Responde la pregunta del usuario utilizando EXCLUSIVAMENTE la información del texto proporcionado. 
Si la respuesta no se encuentra en el texto proporcionado, debes responder: "No lo sé, los apuntes marcados actualmente no mencionan esto." No inventes información.${unselectedInfo}

--- INICIO DEL DOCUMENTO ---
${text}
--- FIN DEL DOCUMENTO ---`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
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
      if (response.status === 429) {
        return "⚠️ El servidor de Inteligencia Artificial (Groq) está saturado. Por favor, espera unos segundos e intenta enviar de nuevo su consulta.";
      }
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
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        return "⚠️ Servidor de IA saturado. Por favor, intenta de nuevo en unos segundos.";
      }
      return "Error de IA.";
    }
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

Rutina de estudio optimizada.

Reglas obligatorias:
- REGLA DE ORO DE LOS BLOQUES: CADA BLOQUE DE ESTUDIO QUE GENERES DEBE CORRESPONDER EXACTAMENTE A UNO DE LOS BLOQUES LIBRES PROPORCIONADOS. Debes copiar exactamente el "day", "startH", "startM", "endH" y "endM" de alguno de los bloques de la lista de Bloques libres. NO inventes horarios de inicio ni de fin que no estén presentados en los bloques libres.
- REGLA DE ORO DE LAS TAREAS: USA ÚNICAMENTE LAS TAREAS PENDIENTES PROPORCIONADAS POR EL USUARIO. Si no hay tareas pendientes, devuelve la rutina vacía: {"rutina": []}. NO INVENTES ASIGNATURAS NI TAREAS.
- NO GENERES BLOQUES DUPLICADOS O SUPERPUESTOS en el mismo día y hora.
- Genera SOLO la cantidad de bloques necesarios según el tiempo estimado de la tarea.
- Prioriza tareas urgentes.
- Mapea 'day' del 0 (Lunes) al 4 (Viernes).
- No estudiar más de 2 horas seguidas.
- Evita estudiar después de las 23:00.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
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
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo en unos segundos.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    const rutina = parsed.rutina || [];

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
- Genera exactamente 4 categorías de herramientas/recursos o metodologías de estudio.
- El valor de 'icono' debe ser uno de los siguientes strings: 'Brain', 'PencilLine', 'Code', 'Database', 'Rocket', 'Users', 'Share2', 'ShieldCheck'.
- Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
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
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

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

  // Truncar notas a un máximo de 12,000 caracteres
  let text = notesText || "";
  if (text.length > 12000) {
    text = text.substring(0, 12000) + "\n\n... [Texto de apuntes truncado por límite de la IA]";
  }

  const systemPrompt = `Eres un docente universitario experto. Tu objetivo es generar un quiz de evaluación interactiva basado exclusivamente en los apuntes proporcionados por el estudiante para la asignatura: "${subjectName}".

Reglas:
- Genera exactamente 5 preguntas de opción múltiple de alta calidad.
- Señala cuál es la respuesta correcta usando su índice (0, 1, 2, o 3).

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
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

  const userPrompt = `Aquí están mis apuntes de ${subjectName}:\n---\n${text}\n---\nPor favor genera mi quiz interactivo de 5 preguntas sobre estos apuntes.`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.quiz || [];
  } catch (error) {
    console.error("Error en generateQuizFromNotes:", error);
    throw error;
  }
};

export const analyzeUploadedDocument = async (documentText) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const systemPrompt = `Eres un evaluador académico experto e implacable.
Tu tarea es realizar un análisis crítico del texto proporcionado y calificarlo del 1 al 10.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "score": [Número entero del 1 al 10],
  "criticalAnalysis": "[Análisis crítico cualitativo en formato Markdown]",
  "improvementAreas": [
    "[Área de mejora 1]",
    "[Área de mejora 2]",
    "[Área de mejora 3]"
  ]
}`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Error en analyzeUploadedDocument:", error);
    throw error;
  }
};

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
    ? `Eres un experto en síntesis de información. Genera un resumen CORTITO del texto proporcionado en viñetas Markdown.`
    : `Eres un redactor académico experto. Genera un resumen COMPLETO, detallado y estructurado en Markdown del texto proporcionado.`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera un resumen ${isShort ? 'corto' : 'completo'} del siguiente texto:\n\n${text}` }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en generateDocumentSummary:", error);
    throw error;
  }
};

export const generateQuizFromText = async (documentText) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const systemPrompt = `Eres un docente universitario experto. Genera un quiz interactivo de exactamente 5 preguntas basadas en el texto.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
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
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.quiz || [];
  } catch (error) {
    console.error("Error en generateQuizFromText:", error);
    throw error;
  }
};

export const getAcademicRiskAnalysis = async (subjectName, currentGrades, remainingWeight, gradeNeededToPass) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const parseGrade = (val) => {
    if (!val) return 0;
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    if (num >= 10 && num <= 70) return num / 10;
    if (num >= 1 && num <= 7) return num;
    return num / 10;
  };

  const gradesString = currentGrades.map(g => `Nota: ${parseGrade(g.note).toFixed(1)} (Ponderación: ${g.weight}%)`).join(', ');

  const systemPrompt = `Eres un consejero académico y mentor estudiantil de IA.
Analiza la situación académica del estudiante en "${subjectName}" y entrega un veredicto realista y motivador.

Contexto:
- Notas: [${gradesString}]
- Restante: ${remainingWeight}%
- Nota necesaria: ${gradeNeededToPass > 7.0 ? 'Imposible' : gradeNeededToPass.toFixed(2)}

Devuelve tu respuesta estructurada en dos o tres párrafos cortos en formato Markdown.`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
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
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en getAcademicRiskAnalysis:", error);
    throw error;
  }
};

export const transcribeAudio = async (audioBlob) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No se encontró la API Key de Groq en el entorno.");
  }

  let extension = "webm";
  if (audioBlob.type) {
    const mime = audioBlob.type.toLowerCase();
    if (mime.includes("mp4")) extension = "mp4";
    else if (mime.includes("m4a")) extension = "m4a";
    else if (mime.includes("mpeg") || mime.includes("mp3")) extension = "mp3";
    else if (mime.includes("wav")) extension = "wav";
    else if (mime.includes("ogg")) extension = "ogg";
  }

  const formData = new FormData();
  formData.append("file", audioBlob, `grabacion.${extension}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "json");

  try {
    const response = await fetchGroqWithRetry("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Error en Groq Whisper:", data);
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de transcripción (Groq Whisper) está saturado. Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || "Error al transcribir el audio.");
    }

    return data.text;
  } catch (error) {
    console.error("Error en transcribeAudio:", error);
    throw error;
  }
};

export const generateRecordingSummary = async (transcript) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No se encontró la API Key de Groq en el entorno.");
  }

  const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
  
  // Calculate proportional counts:
  // - Questions: 1 question per 200 words, min 1, max 10.
  // - Flashcards: 1 flashcard per 120 words, min 1, max 15.
  const targetQuestions = Math.min(10, Math.max(1, Math.round(wordCount / 200)));
  const targetFlashcards = Math.min(15, Math.max(1, Math.round(wordCount / 120)));

  const systemPrompt = `Analiza la siguiente transcripción de una clase universitaria y genera material de estudio en JSON.
Genera exactamente ${targetQuestions} preguntas de autoevaluación (preguntasPrueba) y exactamente ${targetFlashcards} fichas de estudio (flashcards). Esto es proporcional a la extensión de la clase (${wordCount} palabras).
Formato:
{
  "resumen": "Resumen estructurado de la clase en Markdown.",
  "conceptosClave": [{"concepto": "Concepto 1", "definicion": "Definición o explicación detallada en el contexto de la clase."}],
  "preguntasPrueba": [{"pregunta": "P?", "opciones": ["A", "B"], "respuestaCorrecta": "A", "explicacion": "Ex"}],
  "flashcards": [{"front": "Q", "back": "A"}]
}`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcripción de la clase:\n${transcript}` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || "Error al generar los materiales de la clase.");
    }

    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("Error en generateRecordingSummary:", error);
    throw error;
  }
};

export const askTranscriptAI = async (transcript, question) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No se encontró la API Key de Groq en el entorno.");
  }

  // Truncar transcripción a un máximo de 12,000 caracteres
  let text = transcript || "";
  if (text.length > 12000) {
    text = text.substring(0, 12000) + "\n\n... [Transcripción truncada por límite de la IA]";
  }

  const systemPrompt = `Eres un asistente de estudio enfocado en una clase grabada.
Tu única fuente de conocimiento para responder es la transcripción proporcionada.

--- INICIO DE LA TRANSCRIPCIÓN ---
${text}
--- FIN DE LA TRANSCRIPCIÓN ---`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return "⚠️ El servidor de Inteligencia Artificial (Groq) está saturado. Por favor, espera unos segundos e intenta enviar de nuevo su consulta.";
      }
      throw new Error(data.error?.message || "Error al procesar la pregunta.");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error en askTranscriptAI:", error);
    return "❌ Error de red al intentar contactar a Groq.";
  }
};

export const generateCustomQuiz = async (documentText, numQuestions = 5) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No se encontró la API Key de Groq.");

  const MAX_CHARS = 8000;
  let text = documentText;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de caracteres]";
  }

  const systemPrompt = `Eres un docente universitario experto. Genera un quiz de exactamente ${numQuestions} preguntas basado en el texto.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "quiz": [
    {
      "id": 1,
       pregrunta: "", opciones: [], respuestaCorrecta: 0
    }
  ]
}`;

  try {
    const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera mi quiz interactivo de ${numQuestions} preguntas basado en este texto:\n\n${text}` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("⚠️ El servidor de Groq está saturado (Límite 429). Por favor, intenta de nuevo.");
      }
      throw new Error(data.error?.message || 'Error de API');
    }

    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.quiz || [];
  } catch (error) {
    console.error("Error en generateCustomQuiz:", error);
    throw error;
  }
};

export const scheduleAiNotifications = async (userId, schedule = [], tasks = [], studyBlocks = []) => {
  if (!userId) return [];
  const key = `academic_${userId}_ai_scheduled_alerts`;
  const now = new Date();

  // Try to generate via Groq if API Key is available
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey) {
    try {
      const localNowString = now.toLocaleString('es-ES', { timeZoneName: 'short' });
      const systemPrompt = `Eres un coach motivacional y mentor de estudio. Tu rol es EXCLUSIVAMENTE inspirar, motivar y dar soporte psicológico/académico al estudiante.
Tu labor es calendarizar alertas de motivación, consejos de estudio y soporte emocional para el estudiante en las próximas 24 horas.
Recibirás:
- La fecha y hora actual: ${localNowString}
- El horario de clases: ${JSON.stringify(schedule)}
- Las tareas pendientes: ${JSON.stringify(tasks.filter(t => t.status !== 'done'))}
- Los bloques de estudio: ${JSON.stringify(studyBlocks)}

REGLAS DE PROGRAMACIÓN ESTRICTAS:
1. ROL EXCLUSIVO DE COACH MOTIVACIONAL: Tu mensaje debe ser inspirador y de aliento. No eres un gestor de calendario.
2. PROHIBICIÓN ABSOLUTA DE HORAS EXACTAS DE EVENTOS ACADÉMICOS: Tienes terminantemente PROHIBIDO programar alertas para avisar del inicio de clases o el inicio/vencimiento exacto de tareas. El sistema de la aplicación se encargará de avisar sobre esos eventos de forma automática y determinista.
3. RESTRICCIÓN DE HORARIO DIURNO (08:00 A 20:00): El campo 'triggerTime' DEBE estar comprendido estrictamente entre las 08:00 y las 20:00. NUNCA programes una notificación antes de las 08:00 o después de las 20:00.
4. FORMATO DE TIEMPO ABSOLUTO: Cuando hagas referencia al tiempo en tus mensajes, usa siempre tiempo absoluto (ej: "Hoy a las 14:00", "Mañana a las 10:00"). Nunca uses tiempo relativo ("en 1 hora", "en 15 minutos", "hace poco").

Devuelve EXCLUSIVAMENTE un JSON:
{ "alerts": [{ "id": "ai-alert-id", "title": "⚡ Mensaje Motivacional", "message": "Tu mensaje inspirador con tiempo absoluto", "triggerTime": "ISO String" }] }`;

      const response = await fetchGroqWithRetry('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: "Genera mis consejos motivacionales y alertas de acompañamiento para las próximas 24 horas." }
          ],
          temperature: 0.6,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (response.ok) {
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        if (parsed.alerts && Array.isArray(parsed.alerts)) {
          // Add fired: false to all alerts and validate boundary constraint
          const formattedAlerts = parsed.alerts
            .map(alert => {
              const trigger = new Date(alert.triggerTime);
              if (trigger.getHours() < 8) {
                trigger.setHours(8, 0, 0, 0);
              } else if (trigger.getHours() >= 20) {
                trigger.setHours(20, 0, 0, 0);
              }
              
              // Evitar que la alerta sea en el pasado
              if (trigger <= now) {
                return null;
              }

              return {
                ...alert,
                triggerTime: trigger.toISOString(),
                fired: false
              };
            })
            .filter(alert => alert !== null);
          localStorage.setItem(key, JSON.stringify(formattedAlerts));
          return formattedAlerts;
        }
      }
    } catch (e) {
      console.warn("Error calling Groq for AI scheduled notifications, falling back to local heuristic scheduling:", e);
    }
  }

  // Fallback: local heuristic scheduling (if offline or error occurs)
  console.log("Using local heuristic alert generator...");
  const fallbackAlerts = [];

  // Helper to check and clamp time between 08:00 and 20:00
  const clampToDaytime = (date) => {
    const hours = date.getHours();
    if (hours < 8) {
      date.setHours(8, 0, 0, 0);
    } else if (hours >= 20) {
      date.setHours(20, 0, 0, 0);
    }
    return date;
  };

  // Alert 1: Study Block reminder if there is one
  if (studyBlocks && studyBlocks.length > 0) {
    const nextBlock = studyBlocks[0];
    let blockTime = new Date();
    blockTime.setHours(nextBlock.startH, nextBlock.startM - 5, 0, 0);
    blockTime = clampToDaytime(blockTime);

    if (blockTime > now) {
      fallbackAlerts.push({
        id: `ai-alert-fallback-block-${Date.now()}`,
        title: `⚡ Coach Motivacional`,
        message: `Hoy a las ${nextBlock.startH.toString().padStart(2, '0')}:${nextBlock.startM.toString().padStart(2, '0')} tienes un bloque de estudio programado. ¡Prepara tus materiales y confía en tu capacidad!`,
        triggerTime: blockTime.toISOString(),
        fired: false
      });
    }
  }

  // Alert 2: General focus/motivational reminder in 3 hours
  let motivTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  motivTime = clampToDaytime(motivTime);
  const pendingUrgentes = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
  let motivMsg = "¡Hola! Mantén el foco en tus metas de hoy. Recuerda tomar pequeños descansos.";
  if (pendingUrgentes.length > 0) {
    motivMsg = `Hoy a las 20:00: recuerda avanzar en la tarea "${pendingUrgentes[0].title}". ¡Confío en que lograrás completarla paso a paso!`;
  }

  fallbackAlerts.push({
    id: `ai-alert-fallback-motiv-${Date.now()}`,
    title: `⚡ Impulso de Enfoque`,
    message: motivMsg,
    triggerTime: motivTime.toISOString(),
    fired: false
  });

  // Alert 3: Check-in reminder in 6 hours
  let checkTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  checkTime = clampToDaytime(checkTime);
  fallbackAlerts.push({
    id: `ai-alert-fallback-check-${Date.now()}`,
    title: `🌱 Balance de Estudio`,
    message: "Hacer un descanso ahora te ayudará a retener mejor lo aprendido. ¡El descanso es parte del éxito!",
    triggerTime: checkTime.toISOString(),
    fired: false
  });

  localStorage.setItem(key, JSON.stringify(fallbackAlerts));
  return fallbackAlerts;
};
