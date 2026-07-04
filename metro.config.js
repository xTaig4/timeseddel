const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as source (.sql inlined by babel-plugin-inline-import)
config.resolver.sourceExts.push('sql');

// escape-string-regexp's kildekommentar indeholder et bogstaveligt
// "backslash-unnnn"-eksempel, som Hermes' dev-bytecode-pipeline afviser
// ("invalid Unicode escape"). Alias til en kommentarfri, identisk shim.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'escape-string-regexp') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/shims/escape-string-regexp.js'),
    };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
