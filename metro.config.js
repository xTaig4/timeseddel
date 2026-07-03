const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as source (.sql inlined by babel-plugin-inline-import)
config.resolver.sourceExts.push('sql');

module.exports = config;
