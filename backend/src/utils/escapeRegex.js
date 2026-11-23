/**
 * Escape user input before putting it inside a RegExp,
 * so characters like ( + * are matched literally and cannot crash the query.
 */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
