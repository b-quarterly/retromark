"use strict";
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require("../utils/logger.js");
// A default configuration to ensure the application has all necessary properties.
const DEFAULT_CONFIG = {
    title: "RetroMark Site",
    description: "A retro-styled static site",
    baseUrl: "/",
    author: "Author",
    language: "en-US",
    theme: "academic",
    layout: {
        type: "sidebar-left",
        header: { position: "fixed", style: "minimal" },
        footer: { enabled: true, content: "Built with RetroMark • © {year}" }
    },
    toc: {
        enabled: true,
        position: "sticky-left",
        depth: 3,
        style: "classic"
    },
    nav: [{ title: "Home", path: "/" }],
    math: {
        engine: "katex",
        delimiters: {
            inline: ['$', '$'],
            display: ['$$', '$$']
        }
    },
    output: "dist"
};
/**
 * Deeply merges a user's configuration with the default configuration.
 * @param {object} target - The default configuration object.
 * @param {object} source - The user's configuration object.
 * @returns {object} The merged configuration object.
 */
function mergeDeep(target, source) {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object') {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                }
                else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            }
            else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
/**
 * Loads and parses the retro.yml configuration file.
 * @param {string} configPath - The path to the configuration file.
 * @returns {Promise<object>} A promise that resolves with the fully merged configuration object.
 */
async function loadConfig(configPath = 'retro.yml') {
    const fullPath = path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(fullPath)) {
        logger.warn(`Config file not found at '${fullPath}'. Using defaults.`);
        return DEFAULT_CONFIG;
    }
    try {
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const userConfig = yaml.load(fileContents);
        logger.info("Configuration file loaded successfully.");
        return mergeDeep(DEFAULT_CONFIG, userConfig);
    }
    catch (error) {
        logger.error("Error loading or parsing config file:");
        if (error instanceof Error) {
            logger.error(error.message);
        }
        return DEFAULT_CONFIG;
    }
}
module.exports = { loadConfig };
