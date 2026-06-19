import ICAL from 'ical.js';

const dayMap = {
  'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6
};

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
    
    const parsedEvents = [];

    vevents.forEach(vevent => {
      const event = new ICAL.Event(vevent);
      
      const title = event.summary || 'Sin título';
      const description = event.description || '';
      const location = event.location || '';
      
      let start = null;
      let end = null;
      if (event.startDate) {
        start = event.startDate.toJSDate();
      }
      if (event.endDate) {
        end = event.endDate.toJSDate();
      }

      if (!start) start = new Date();
      if (!end) end = new Date(start.getTime() + 60 * 60 * 1000);

      let type = 'clase';
      const lowerTitle = title.toLowerCase();
      const lowerDesc = description.toLowerCase();

      if (/examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerTitle) || /examen|certamen|evaluacion|evaluación|entrega|control|prueba/i.test(lowerDesc)) {
        type = 'examen';
      } else if (/estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerTitle) || /estudio|repaso|quiz|taller|ayudantia|ayudantía|practica|práctica/i.test(lowerDesc)) {
        type = 'estudio';
      }
      
      // Determine base day and times
      const startH = start.getHours();
      const startM = start.getMinutes();
      const endH = end.getHours();
      const endM = end.getMinutes();
      
      let baseDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
      let days = [baseDay];
      
      const rruleProp = vevent.getFirstPropertyValue('rrule');
      if (rruleProp && rruleProp.freq === 'WEEKLY' && rruleProp.parts && rruleProp.parts.BYDAY) {
        const byday = Array.isArray(rruleProp.parts.BYDAY) ? rruleProp.parts.BYDAY : [rruleProp.parts.BYDAY];
        days = byday.map(d => dayMap[d]).filter(d => d !== undefined);
      }
      
      days.forEach(d => {
        parsedEvents.push({
          id: event.uid ? `${event.uid}-${d}` : Math.random().toString(36).substr(2, 9),
          title,
          start,
          end,
          day: d,
          startH,
          startM,
          endH,
          endM,
          description,
          location,
          type
        });
      });
    });

    return parsedEvents;
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
