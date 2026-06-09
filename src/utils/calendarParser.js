import ICAL from 'ical.js';

/**
 * Parses an RFC 5545 standard .ics file content into a unified event format.
 * @param {string} icsText - Raw string contents of the .ics file.
 * @returns {Array<Object>} List of parsed, structured calendar events.
 */
export const parseICS = (icsText) => {
  if (!icsText) return [];
  try {
    const jcalData = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map(vevent => {
      const event = new ICAL.Event(vevent);
      
      const title = event.summary || 'Sin título';
      const description = event.description || '';
      const location = event.location || '';
      
      // Convert to JS dates
      let start = null;
      let end = null;
      if (event.startDate) {
        start = event.startDate.toJSDate();
      }
      if (event.endDate) {
        end = event.endDate.toJSDate();
      }

      // Fallbacks for start/end in case parsing fails
      if (!start) start = new Date();
      if (!end) end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

      // Lógica de clasificación
      let type = 'clase';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();

      if (/examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerTitle) || /examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerDesc)) {
        type = 'examen';
      } else if (/estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerTitle) || /estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerDesc)) {
        type = 'estudio';
      }

      return {
        id: event.uid || Math.random().toString(36).substr(2, 9),
        title,
        start,
        end,
        description,
        location,
        type
      };
    });
  } catch (error) {
    console.error('Error al parsear el archivo ICS:', error);
    return [];
  }
};

/**
 * Parses Google Calendar API events format into a unified event format.
 * @param {Object} gCalEventsJSON - JSON response from Google Calendar list events API.
 * @returns {Array<Object>} List of structured calendar events.
 */
export const parseGoogleCalendarEvents = (gCalEventsJSON) => {
  if (!gCalEventsJSON || !gCalEventsJSON.items) return [];
  try {
    return gCalEventsJSON.items.map(item => {
      const startStr = item.start ? (item.start.dateTime || item.start.date) : null;
      const endStr = item.end ? (item.end.dateTime || item.end.date) : null;
      
      const start = startStr ? new Date(startStr) : new Date();
      const end = endStr ? new Date(endStr) : new Date(start.getTime() + 60 * 60 * 1000);
      
      const title = item.summary || 'Sin título';
      const description = item.description || '';
      const location = item.location || '';

      let type = 'clase';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();

      if (/examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerTitle) || /examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerDesc)) {
        type = 'examen';
      } else if (/estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerTitle) || /estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerDesc)) {
        type = 'estudio';
      }

      return {
        id: item.id || Math.random().toString(36).substr(2, 9),
        title,
        start,
        end,
        description,
        location,
        type
      };
    });
  } catch (error) {
    console.error('Error al parsear eventos de Google Calendar:', error);
    return [];
  }
};
