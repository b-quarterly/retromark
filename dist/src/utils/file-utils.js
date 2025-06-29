"use strict";
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
/**
 * Ensures that a directory exists, creating it if necessary.
 * @param {string} dirPath - The path to the directory.
 */
function ensureDirectoryExists(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    catch (error) {
        console.error(`Error ensuring directory exists: ${dirPath}`, error);
        throw error;
    }
}
/**
 * Reads the content of a file asynchronously.
 * @param {string} filePath - The path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content.
 */
async function readFileAsync(filePath) {
    try {
        return await fs.promises.readFile(filePath, 'utf8');
    }
    catch (error) {
        console.error(`Error reading file asynchronously: ${filePath}`, error);
        throw error;
    }
}
/**
 * Reads the content of a file synchronously.
 * @param {string} filePath - The path to the file.
 * @returns {string} The content of the file.
 */
function readFileSync(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    }
    catch (error) {
        console.error(`Error reading file synchronously: ${filePath}`, error);
        throw error;
    }
}
/**
 * Writes content to a file asynchronously, creating the directory if it doesn't exist.
 * @param {string} filePath - The path to the file.
 * @param {string} content - The content to write to the file.
 * @returns {Promise<void>}
 */
async function writeFileAsync(filePath, content) {
    try {
        const dir = path.dirname(filePath);
        await fse.ensureDir(dir);
        await fs.promises.writeFile(filePath, content, 'utf8');
    }
    catch (error) {
        console.error(`Error writing file asynchronously: ${filePath}`, error);
        throw error;
    }
}
/**
 * Copies a file from a source path to a destination path.
 * @param {string} sourcePath - The path of the file to copy.
 * @param {string} destinationPath - The path to copy the file to.
 * @returns {Promise<void>}
 */
async function copyFile(sourcePath, destinationPath) {
    try {
        const destDir = path.dirname(destinationPath);
        await fse.ensureDir(destDir);
        await fs.promises.copyFile(sourcePath, destinationPath);
    }
    catch (error) {
        console.error(`Error copying file from ${sourcePath} to ${destinationPath}`, error);
        throw error;
    }
}
/**
 * Recursively finds all files in a directory that match a given extension.
 * @param {string} startPath - The directory to start the search from.
 * @param {string} extension - The file extension to search for (e.g., '.md').
 * @returns {string[]} An array of file paths.
 */
function findFilesByExtension(startPath, extension) {
    let results = [];
    if (!fs.existsSync(startPath)) {
        return [];
    }
    const files = fs.readdirSync(startPath);
    for (let i = 0; i < files.length; i++) {
        const filename = path.join(startPath, files[i]);
        const stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            results = results.concat(findFilesByExtension(filename, extension));
        }
        else if (filename.endsWith(extension)) {
            results.push(filename);
        }
    }
    return results;
}
/**
 * Copies a directory recursively.
 * @param {string} sourceDir - The source directory path.
 * @param {string} destinationDir - The destination directory path.
 * @returns {Promise<void>}
 */
async function copyDirectory(sourceDir, destinationDir) {
    try {
        await fse.copy(sourceDir, destinationDir);
    }
    catch (error) {
        console.error(`Error copying directory from ${sourceDir} to ${destinationDir}`, error);
        throw error;
    }
}
/**
 * Deletes a directory and all its contents.
 * @param {string} dirPath The path to the directory to delete.
 * @returns {Promise<void>}
 */
async function deleteDirectory(dirPath) {
    try {
        await fse.remove(dirPath);
    }
    catch (error) {
        console.error(`Error deleting directory: ${dirPath}`, error);
        throw error;
    }
}
module.exports = {
    ensureDirectoryExists,
    readFileAsync,
    readFileSync,
    writeFileAsync,
    copyFile,
    findFilesByExtension,
    copyDirectory,
    deleteDirectory
};
