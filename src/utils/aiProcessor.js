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
