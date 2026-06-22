/**
 * Formats a Date object to ICS date-time format (YYYYMMDDTHHMMSSZ).
 * @param {Date|string|number} val - Date to format.
 * @returns {string} ICS formatted date-time string.
 */
const formatDateToICS = (val) => {
  const date = val instanceof Date ? val : new Date(val);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

/**
 * Escapes characters that are special in ICS format according to RFC 5545.
 * @param {string} text - Raw text string.
 * @returns {string} Escaped string.
 */
const escapeICSText = (text) => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
};

/**
 * Generates an RFC 5545 standard .ics file as a string from a list of event objects.
 * @param {Array<Object>} events - List of events to serialize.
 * @returns {string} Serialized ICS calendar string.
 */
export const generateICS = (events) => {
  if (!events || events.length === 0) return '';
  
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AURA//Calendar Sync//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(event => {
    const uid = event.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@aura.com`;
    const dtStamp = formatDateToICS(new Date());
    const dtStart = formatDateToICS(event.start);
    const dtEnd = formatDateToICS(event.end);
    const summary = escapeICSText(event.title);
    const description = escapeICSText(event.description);
    const location = escapeICSText(event.location);

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${dtStamp}`);
    icsLines.push(`DTSTART:${dtStart}`);
    icsLines.push(`DTEND:${dtEnd}`);
    icsLines.push(`SUMMARY:${summary}`);
    
    if (description) {
      icsLines.push(`DESCRIPTION:${description}`);
    }
    if (location) {
      icsLines.push(`LOCATION:${location}`);
    }
    
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
};
