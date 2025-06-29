#!/usr/bin/env node
/**
 * RetroMark Command Line Interface
 * ================================
 * Entry point for the RetroMark static site generator
 * 
 * Commands:
 *   build      Build static site
 *   serve      Start development server
 *   init       Create starter project
 *   new        Create new content page
 * 
 * Usage:
 *   npx retromark build [options]
 *   npx retromark serve [options]
 *   npx retromark init [directory]
 *   npx retromark new "Page Title" [--chapter]
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chokidar = require('chokidar');
const express = require('express');
const { buildSite } = require('../dist/core/builder');
const { loadConfig } = require('../dist/core/config-loader');
const logger = require('../dist/utils/logger');

// CLI Setup
program
  .name('retromark')
  .description('Retro-themed static site generator with math support')
  .version(require('../package.json').version);

// Build Command
program.command('build')
  .description('Build static site from Markdown files')
  .option('-i, --input <dir>', 'Source directory', 'content')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-c, --config <file>', 'Configuration file', 'retro.yml')
  .option('--theme <theme>', 'Override theme (academic/novel/zine/etc)')
  .option('--toc <position>', 'Table of Contents position')
  .action(async (options) => {
    try {
      logger.info('🚀 Starting RetroMark build...');
      const startTime = Date.now();
      
      const config = await loadConfig(options.config);
      
      // Apply CLI overrides
      if (options.theme) config.theme = options.theme;
      if (options.toc) config.toc.position = options.toc;
      
      await buildSite(options.input, options.output, config);
      
      const duration = (Date.now() - startTime) / 1000;
      logger.success(`✅ Build completed in ${duration.toFixed(2)}s`);
      logger.info(`📂 Output: ${path.resolve(options.output)}`);
    } catch (error) {
      logger.error('❌ Build failed:');
      logger.error(error.message);
      process.exit(1);
    }
  });

// Serve Command
program.command('serve')
  .description('Start development server with live reload')
  .option('-i, --input <dir>', 'Source directory', 'content')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-c, --config <file>', 'Configuration file', 'retro.yml')
  .option('-p, --port <number>', 'Server port', '3000')
  .action(async (options) => {
    try {
      // Initial build
      logger.info('🔨 Building initial site...');
      const config = await loadConfig(options.config);
      await buildSite(options.input, options.output, config);
      
      // Setup server
      const app = express();
      app.use(express.static(options.output));
      
      app.listen(options.port, () => {
        logger.info(`🌐 Server running at http://localhost:${options.port}`);
        logger.info('👀 Watching for changes...');
      });
      
      // Live reload setup
      const server = require('livereload').createServer();
      server.watch(options.output);
      
      // Watch for changes
      const watcher = chokidar.watch(options.input, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true
      });
      
      watcher.on('all', async (event, filePath) => {
        logger.info(`🔄 Detected change: ${path.basename(filePath)}`);
        try {
          await buildSite(options.input, options.output, config);
          logger.success('✅ Site rebuilt');
        } catch (error) {
          logger.error('❌ Rebuild failed:', error.message);
        }
      });
      
      // Handle exit
      process.on('SIGINT', () => {
        watcher.close();
        server.close();
        process.exit();
      });
      
    } catch (error) {
      logger.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  });

// Init Command
program.command('init [directory]')
  .description('Create new RetroMark project')
  .action((directory = 'retromark-site') => {
    try {
      const projectPath = path.resolve(directory);
      
      // Create directory structure
      fs.mkdirSync(projectPath, { recursive: true });
      const dirs = ['content', 'assets', 'themes'];
      dirs.forEach(dir => fs.mkdirSync(path.join(projectPath, dir)));
      
      // Create sample files
      const templates = {
        'retro.yml': `# RetroMark Configuration
theme: academic
title: "My Retro Site"
`,
        'content/index.md': `# Welcome to RetroMark

This is a sample page with **retro styling** and math support:

$$ e^{i\pi} + 1 = 0 $$

[Explore chapters](/chapters)
`,
        'content/chapters.md': `# Chapters

1. [Introduction](/chapters/01-intro)
2. [Advanced Topics](/chapters/02-advanced)
`,
        'themes/custom.scss': `/* Custom Theme Overrides */
:root {
  --primary-color: #8b0000;
}`
      };
      
      Object.entries(templates).forEach(([filePath, content]) => {
        const fullPath = path.join(projectPath, filePath);
        fs.writeFileSync(fullPath, content);
      });
      
      logger.success(`✅ Project created at ${projectPath}`);
      logger.info(`👉 Run: cd ${directory} && npx retromark serve`);
    } catch (error) {
      logger.error('❌ Project creation failed:', error.message);
      process.exit(1);
    }
  });

// New Page Command
program.command('new <title>')
  .description('Create new content page')
  .option('-c, --chapter', 'Create as chapter with numbering')
  .option('-d, --dir <directory>', 'Content directory', 'content')
  .action((title, options) => {
    try {
      const contentDir = path.resolve(options.dir);
      if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
      }
      
      // Generate filename
      const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let filename = `${cleanTitle}.md`;
      
      if (options.chapter) {
        // Auto-number chapters
        const files = fs.readdirSync(contentDir);
        const chapterCount = files.filter(f => f.match(/^\d{2}-/)).length;
        const chapterNum = String(chapterCount + 1).padStart(2, '0');
        filename = `${chapterNum}-${cleanTitle}.md`;
      }
      
      // Create file
      const filePath = path.join(contentDir, filename);
      const frontmatter = `---
title: "${title}"
date: ${new Date().toISOString()}
---\n\n# ${title}\n\nStart writing here...`;
      
      fs.writeFileSync(filePath, frontmatter);
      
      logger.success(`📄 Created new page: ${filename}`);
      logger.info(`📍 Path: ${filePath}`);
    } catch (error) {
      logger.error('❌ Page creation failed:', error.message);
      process.exit(1);
    }
  });

// Error handling for unknown commands
program.on('command:*', () => {
  logger.error('❌ Invalid command. See available commands:');
  program.outputHelp();
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
