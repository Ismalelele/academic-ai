const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

export const processScheduleImage = async (file) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("❌ Error: No se encontró la API Key de Groq. Asegúrate de tener VITE_GROQ_API_KEY en el archivo .env.");
  }

  const base64Image = await fileToBase64(file);

  const prompt = `Eres un extractor experto de datos de horarios escolares/universitarios.
He subido una imagen de un horario. Tu única tarea es extraer todas las clases/asignaturas mostradas en el horario y devolverlas en formato JSON estrictamente válido. No incluyas NINGÚN texto adicional, solo el JSON, ni bloques de código (sin \`\`\`json).

El formato esperado debe ser exactamente un arreglo de objetos con las siguientes claves:
[
  {
    "title": "Nombre de la asignatura",
    "room": "Sala o laboratorio",
    "day": 0,
    "startH": 8,
    "startM": 15,
    "endH": 9,
    "endM": 35
  }
]

Aclaraciones clave:
- "day": Un número entero donde 0 = Lunes, 1 = Martes, 2 = Miércoles, 3 = Jueves, 4 = Viernes, 5 = Sábado, 6 = Domingo.
- "startH" y "endH": Formato de 24 horas (ej. 14 para 2 PM).
- Si una clase abarca múltiples bloques contiguos de tiempo, únelos en un solo objeto que inicie en el primer bloque y termine en el último bloque.
- Extrae la información con la mayor precisión posible.

Responde únicamente con el JSON válido.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq Vision Error:", data);
      throw new Error(`Error de API: ${data.error?.message || 'Desconocido'}`);
    }

    const content = data.choices[0].message.content;
    
    // Limpiar posibles bloques de código que la IA pueda escupir por error
    const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(jsonString);
    
    if (!Array.isArray(parsedData)) {
        throw new Error("El JSON devuelto no es un arreglo.");
    }
    
    return parsedData;
  } catch (error) {
    console.error("Fetch/Vision Error:", error);
    throw error;
  }
};
