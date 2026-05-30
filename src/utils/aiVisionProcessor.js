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
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey && !groqKey) {
    throw new Error("❌ Error: No se encontró ninguna API Key (Gemini o Groq) en el archivo .env.");
  }

  const base64Image = await compressImage(file);
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

  let lastError = null;

  // Intento 1: Gemini
  if (apiKey) {
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
        throw new Error(`Error de API Gemini: ${data.error?.message || 'Desconocido'}`);
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
          throw new Error("No se recibió respuesta de Gemini.");
      }
      
      const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(jsonString);
      
      if (!Array.isArray(parsedData)) {
          throw new Error("El JSON devuelto por Gemini no es un arreglo.");
      }
      
      return parsedData;
    } catch (error) {
      console.warn("Fallo en Gemini Vision. Intentando fallback con Groq Llama Vision...", error);
      lastError = error;
    }
  }

  // Intento 2: Fallback de Groq Llama 3.2 Vision
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Groq Vision Error:", data);
        throw new Error(data.error?.message || 'Error en Groq API');
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No se recibió respuesta de Groq.");
      }

      const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(jsonString);
      
      if (!Array.isArray(parsedData)) {
        throw new Error("El JSON devuelto por Groq no es un arreglo.");
      }

      return parsedData;
    } catch (groqErr) {
      console.error("Fallo también en Groq Vision Fallback:", groqErr);
      const mainErr = lastError ? (lastError.message || lastError) : "Gemini API no configurada";
      throw new Error(`Error en el procesamiento del horario: ${mainErr}. Fallback de Groq falló también: ${groqErr.message || groqErr}`);
    }
  }

  throw lastError || new Error("No se pudo procesar la imagen del horario.");
};
