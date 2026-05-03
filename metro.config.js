const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .csv files to be bundled as static assets
config.resolver.assetExts.push('csv');

module.exports = config;
