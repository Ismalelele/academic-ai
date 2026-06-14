/**
 * Carga de forma segura un dato desde localStorage verificando el userId y el patrón de la clave.
 * @param {string} key Clave a consultar. Must follow the pattern: academic_${userId}_${subKey}
 * @param {string} userId ID del usuario activo.
 * @param {*} defaultValue Valor por defecto si falla el check o no existe el dato.
 */
export const getSafeLocalStorage = (key, userId, defaultValue = null) => {
  if (!userId) return defaultValue;

  // Verificar que la clave pertenezca específicamente al usuario activo
  // El patrón esperado es: academic_[userId]_[key]
  const expectedPrefix = `academic_${userId}_`;
  if (!key.startsWith(expectedPrefix)) {
    console.warn(`[Seguridad] Intento de leer clave '${key}' que no pertenece al usuario activo '${userId}'`);
    return defaultValue;
  }

  const saved = localStorage.getItem(key);
  if (!saved) return defaultValue;

  try {
    const data = JSON.parse(saved);
    // Verificación adicional de userId si el objeto guardado lo contiene
    if (data && typeof data === 'object' && data.userId && data.userId !== userId) {
      console.warn(`[Seguridad] Discrepancia de userId interno en los datos de '${key}'`);
      return defaultValue;
    }
    return data;
  } catch (e) {
    // Si no es JSON válido (por ejemplo, un string simple de canvas), lo retornamos tal cual si no hay fallos de seguridad
    return saved;
  }
};
