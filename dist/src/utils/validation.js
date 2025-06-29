"use strict";
const path = require('path');
/**
 * Checks if a value is a non-empty string.
 * @param {*} value The value to check.
 * @returns {boolean} True if the value is a non-empty string.
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}
/**
 * Checks if a value is a valid URL.
 * @param {string} string The string to check.
 * @returns {boolean} True if the string is a valid URL.
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    }
    catch (_) {
        return false;
    }
}
/**
 * Checks if a given value is present in a specific array.
 * @param {*} value The value to check for.
 * @param {Array} validValues The array of valid values.
 * @returns {boolean} True if the value is in the array.
 */
function isInArray(value, validValues) {
    return Array.isArray(validValues) && validValues.includes(value);
}
/**
 * Checks if a value is a plain object.
 * @param {*} value The value to check.
 * @returns {boolean} True if the value is a plain object.
 */
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Checks if a value is a valid CSS color (basic hex check).
 * @param {string} color The string to check.
 * @returns {boolean} True if the value is a plausible hex color.
 */
function isValidColor(color) {
    if (typeof color !== 'string')
        return false;
    const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
    return hexRegex.test(color);
}
/**
 * Validates the structure of navigation items.
 * @param {Array} navArray The array of navigation items to validate.
 * @returns {Array} The validated and cleaned navigation array.
 */
function validateNavItems(navArray) {
    if (!Array.isArray(navArray)) {
        return [];
    }
    return navArray.filter(item => {
        const hasTitle = isNonEmptyString(item.title);
        const hasPath = isNonEmptyString(item.path);
        if (!hasTitle || !hasPath) {
            console.warn('Skipping invalid navigation item:', item);
            return false;
        }
        if (item.children) {
            item.children = validateNavItems(item.children);
        }
        return true;
    });
}
/**
 * Validates a configuration object against a set of rules.
 * @param {object} config The configuration object to validate.
 * @param {object} rules A rules object defining the validation checks.
 * @returns {boolean} True if the configuration is valid.
 */
function validateConfig(config, rules) {
    let isValid = true;
    for (const key in rules) {
        if (Object.prototype.hasOwnProperty.call(config, key)) {
            const rule = rules[key];
            const value = config[key];
            if (rule.type && typeof value !== rule.type) {
                console.error(`Config Error: '${key}' should be of type ${rule.type}.`);
                isValid = false;
            }
            if (rule.required && (value === undefined || value === null || value === '')) {
                console.error(`Config Error: '${key}' is a required field.`);
                isValid = false;
            }
            if (rule.validValues && !isInArray(value, rule.validValues)) {
                console.error(`Config Error: '${key}' has an invalid value. Valid options are: ${rule.validValues.join(', ')}.`);
                isValid = false;
            }
        }
        else if (rules[key].required) {
            console.error(`Config Error: Missing required field '${key}'.`);
            isValid = false;
        }
    }
    return isValid;
}
module.exports = {
    isNonEmptyString,
    isValidUrl,
    isInArray,
    isObject,
    isValidColor,
    validateNavItems,
    validateConfig,
};
