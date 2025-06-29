const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chokidar = require('chokidar');
const express = require('express');
const liveReload = require('livereload');
const { buildSite } = require('../core/builder');
const { loadConfig } = require('../core/config-loader');
const logger = require('../utils/logger');
const packageJson = require('../../package.json');

/**
 * Main CLI Implementation
 * =======================
 * Handles all command execution and coordination
 */

// ----------------------------------
// Utility Functions
// ----------------------------------

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function createFile(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  return filePath;
}

// ----------------------------------
// Command Implementations
// ----------------------------------

/**
 * Build Site Command
 * @param {string} inputDir 
 * @param {string} outputDir 
 * @param {string} configFile 
 * @param {object} options 
 */
async function buildCommand(inputDir, outputDir, configFile, options = {}) {
  try {
    logger.info('🚀 Starting RetroMark build...');
    const startTime = Date.now();
    
    const config = await loadConfig(configFile);
    
    // Apply CLI overrides
    if (options.theme) config.theme = options.theme;
    if (options.toc) config.toc.position = options.toc;
    if (options.math) config.math.engine = options.math;
    
    await buildSite(inputDir, outputDir, config);
    
    const duration = (Date.now() - startTime) / 1000;
    logger.success(`✅ Build completed in ${duration.toFixed(2)}s`);
    logger.info(`📂 Output: ${resolvePath(outputDir)}`);
  } catch (error) {
    logger.error('❌ Build failed:');
    logger.error(error.message);
    process.exit(1);
  }
}

/**
 * Serve Site Command
 * @param {string} inputDir 
 * @param {string} outputDir 
 * @param {string} configFile 
 * @param {number} port 
 */
async function serveCommand(inputDir, outputDir, configFile, port) {
  try {
    // Initial build
    logger.info('🔨 Building initial site...');
    const config = await loadConfig(configFile);
    await buildSite(inputDir, outputDir, config);
    
    // Setup server
    const app = express();
    app.use(express.static(outputDir));
    
    const server = app.listen(port, () => {
      logger.info(`🌐 Server running at http://localhost:${port}`);
      logger.info('👀 Watching for changes... Press Ctrl+C to stop');
    });
    
    // Live reload setup
    const lrServer = liveReload.createServer({
      exts: ['html', 'css', 'js', 'md'],
      delay: 300,
    });
    lrServer.watch(outputDir);
    
    // Watch for changes
    const watcher = chokidar.watch(inputDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });
    
    watcher.on('all', async (event, filePath) => {
      logger.info(`🔄 Detected change: ${path.basename(filePath)}`);
      try {
        await buildSite(inputDir, outputDir, config);
        logger.success('✅ Site rebuilt');
      } catch (error) {
        logger.error('❌ Rebuild failed:', error.message);
      }
    });
    
    // Handle exit
    process.on('SIGINT', () => {
      watcher.close();
      lrServer.close();
      server.close();
      logger.info('\n👋 Server stopped');
      process.exit();
    });
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

/**
 * Initialize Project Command
 * @param {string} directory 
 */
function initCommand(directory) {
  try {
    const projectPath = resolvePath(directory || 'retromark-site');
    
    // Create directory structure
    ensureDirectory(projectPath);
    const dirs = ['content', 'assets', 'themes'];
    dirs.forEach(dir => ensureDirectory(path.join(projectPath, dir)));
    
    // Create sample files
    const templates = {
      'retro.yml': `# RetroMark Configuration
theme: academic
title: "My Retro Site"
author: "Your Name"
baseUrl: "/"

# Layout Options
layout:
  header: fixed
  sidebar: left
  footer: true

# Navigation
nav:
  - title: "Home"
    path: "/"
  - title: "Chapters"
    path: "/chapters/"

# Table of Contents
toc:
  position: sticky-left
  depth: 3

# Math Support
math:
  engine: katex

# Custom Assets
custom:
  css: "override.css"
`,
      'content/index.md': `# Welcome to RetroMark

This is a sample page with **retro styling** and math support:

## Euler's Identity

$$ e^{i\pi} + 1 = 0 $$

## Features

- 📚 Multiple retro themes 
- 📐 Math equation support 
- 🧭 Customizable navigation
`,
      'content/chapters.md': `# Chapters

1. [Introduction](/chapters/01-intro)
2. [Advanced Topics](/chapters/02-advanced)
`,
      'themes/override.css': `/* Custom Theme Overrides */
:root {
  --primary-color: #8b0000;
  --secondary-color: #556b2f;
  --background-color: #f9f3e9;
  --text-color: #333333;
}`,
      'assets/favicon.ico': '' // Placeholder
    };
    
    Object.entries(templates).forEach(([filePath, content]) => {
      const fullPath = path.join(projectPath, filePath);
      createFile(fullPath, content);
    });
    
    logger.success(`✅ Project created at ${projectPath}`);
    logger.info(`👉 Next steps:
  1. cd ${path.basename(projectPath)}
  2. npx retromark serve
  3. Open http://localhost:3000`);
  } catch (error) {
    logger.error('❌ Project creation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Create New Page Command
 * @param {string} title 
 * @param {object} options 
 */
function newPageCommand(title, options) {
  try {
    const contentDir = resolvePath(options.dir || 'content');
    ensureDirectory(contentDir);
    
    // Generate filename
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');
    
    let filename = `${cleanTitle}.md`;
    
    if (options.chapter) {
      // Auto-number chapters
      const files = fs.existsSync(contentDir) 
        ? fs.readdirSync(contentDir) 
        : [];
      
      const chapterCount = files.filter(f => 
        f.match(/^\d{2}-/) && fs.statSync(path.join(contentDir, f)).isFile()
      ).length;
      
      const chapterNum = String(chapterCount + 1).padStart(2, '0');
      filename = `${chapterNum}-${cleanTitle}.md`;
    }
    
    // Create file
    const filePath = path.join(contentDir, filename);
    const frontmatter = `---
title: "${title}"
date: ${new Date().toISOString()}
${options.chapter ? 'chapter: true\n' : ''}---\n\n# ${title}\n\nStart writing your content here...`;
    
    createFile(filePath, frontmatter);
    
    logger.success(`📄 Created new page: ${filename}`);
    logger.info(`📍 Path: ${filePath}`);
  } catch (error) {
    logger.error('❌ Page creation failed:', error.message);
    process.exit(1);
  }
}

// ----------------------------------
// CLI Setup
// ----------------------------------

function setupCLI() {
  program
    .name('retromark')
    .description('Retro-themed static site generator with math support')
    .version(packageJson.version);
  
  // Build Command
  program.command('build')
    .description('Build static site from Markdown files')
    .option('-i, --input <dir>', 'Source directory', 'content')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('-c, --config <file>', 'Configuration file', 'retro.yml')
    .option('--theme <theme>', 'Override theme (academic/novel/zine/etc)')
    .option('--toc <position>', 'TOC position (top/bottom/sticky-left/sticky-right)')
    .option('--math <engine>', 'Math engine (katex/mathjax)')
    .action((options) => {
      buildCommand(
        options.input,
        options.output,
        options.config,
        {
          theme: options.theme,
          toc: options.toc,
          math: options.math
        }
      );
    });
  
  // Serve Command
  program.command('serve')
    .description('Start development server with live reload')
    .option('-i, --input <dir>', 'Source directory', 'content')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('-c, --config <file>', 'Configuration file', 'retro.yml')
    .option('-p, --port <number>', 'Server port', '3000')
    .action((options) => {
      serveCommand(
        options.input,
        options.output,
        options.config,
        parseInt(options.port, 10)
      );
    });
  
  // Init Command
  program.command('init [directory]')
    .description('Create new RetroMark project')
    .action((directory) => {
      initCommand(directory);
    });
  
  // New Page Command
  program.command('new <title>')
    .description('Create new content page')
    .option('-c, --chapter', 'Create as chapter with numbering')
    .option('-d, --dir <directory>', 'Content directory', 'content')
    .action((title, options) => {
      newPageCommand(title, options);
    });
  
  // Error handling for unknown commands
  program.on('command:*', () => {
    logger.error('❌ Invalid command. See available commands:');
    program.outputHelp();
    process.exit(1);
  });
  
  // Show help if no command provided
  if (process.argv.length < 3) {
    program.outputHelp();
  }
  
  // Parse arguments
  program.parse(process.argv);
}

// ----------------------------------
// Module Export
// ----------------------------------

module.exports = {
  run: setupCLI
};
