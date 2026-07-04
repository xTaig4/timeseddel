module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
    env: {
      // Hermes' dev-bytecode-pipeline fejler på ugyldige \u-escapes i
      // node_modules-kommentarer (fx escape-string-regexp) — strip dem i dev.
      // Prod beholder kommentarer (#__PURE__-annoteringer).
      development: { comments: false },
    },
  };
};
