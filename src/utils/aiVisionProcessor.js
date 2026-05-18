const compressImage = (file, maxWidth = 1200) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // If it's a PDF or something else, return the original base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Comprimir a JPEG con 80% de calidad reduce el tamaño masivamente
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export const processScheduleImage = async (file) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("❌ Error: No se encontró la API Key de Gemini. Asegúrate de tener VITE_GEMINI_API_KEY en el archivo .env.");
  }

  const base64Image = await compressImage(file);
  // Gemini requires base64 string without the prefix
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || "image/jpeg";

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
- IMPORTANTE: Si la imagen no tiene encabezados, la primera columna con cuadros a la derecha de las horas es SIEMPRE el Lunes ("day": 0), la que sigue es el Martes ("day": 1), y así sucesivamente hasta el Domingo ("day": 6).
- Extrae la hora de inicio y fin fijándote a qué línea de las horas (08, 09, etc.) está alineada la tarjeta. (Ej. si abarca del 09 al 11, startH=9, endH=11).
- Responde únicamente con el JSON válido.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Vision Error:", data);
      throw new Error(`Error de API: ${data.error?.message || 'Desconocido'}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
        throw new Error("No se recibió respuesta de Gemini.");
    }
    
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
