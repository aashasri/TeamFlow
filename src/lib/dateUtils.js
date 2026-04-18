/**
 * Date formatting utilities for TeamFlow.
 * All display dates use dd/mm/yyyy format.
 */

/**
 * Convert an ISO date string (yyyy-mm-dd) or Date object to dd/mm/yyyy format.
 * Returns '—' if the input is falsy or invalid.
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} Formatted date string in dd/mm/yyyy format
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  try {
    let d;
    if (typeof dateInput === 'string') {
      // Handle ISO date strings like "2026-04-18" or full ISO "2026-04-18T00:00:00"
      d = new Date(dateInput.includes('T') ? dateInput : dateInput + 'T00:00:00');
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      return '—';
    }
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

/**
 * Format a date with time as dd/mm/yyyy, HH:mm
 * @param {string|Date} dateInput
 * @returns {string}
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  } catch {
    return '—';
  }
};
