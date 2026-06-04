/**
 * Normalizes a string by converting it to lowercase and removing diacritics (accents).
 * Useful for accent-insensitive and case-insensitive searching.
 * @param {string} str - The string to normalize.
 * @returns {string} - The normalized string.
 */
export const normalizeString = (str) => {
    if (!str) return '';
    return str
        .toString()
        .normalize('NFD') // Decompose combined graphemes into the combination of simple ones
        .replace(/[\u0300-\u036f]/g, '') // Remove the diacritical marks
        .toLowerCase();
};
