// Funktionelt identisk med escape-string-regexp@4 (MIT, sindresorhus), men uden
// originalens kildekommentar: den indeholder et bogstaveligt "backslash-unnnn"-
// eksempel, som Hermes' dev-bytecode-pipeline afviser som ugyldig escape.
// Aliaset sættes i metro.config.js og gælder kun Metro-bundlet.
module.exports = (string) => {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
};
