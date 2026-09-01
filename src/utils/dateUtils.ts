/**
 * Formats a date string, Date object, or timestamp to Indian format (dd/mm/yyyy)
 */
export function formatDate(dateInput: any): string {
  if (!dateInput) return '';
  try {
    // If it's already in dd/mm/yyyy format, return it
    if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Automatically detects and formats date strings or keys to dd/mm/yyyy
 */
export function formatIfDate(value: any, keyName?: string): any {
  if (!value) return value;
  
  // If it's a Date object, format it
  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value !== 'string') {
    return value;
  }

  // Detect YYYY-MM-DD or ISO format
  const isDatePattern = /^\d{4}-\d{2}-\d{2}$/.test(value) || 
                        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  
  const isDateKey = keyName && (
    keyName.toLowerCase().includes('date') ||
    keyName.toLowerCase().includes('until') ||
    keyName.toLowerCase().includes('from')
  );

  if (isDatePattern || isDateKey) {
    return formatDate(value);
  }

  return value;
}
