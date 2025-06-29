import { program } from 'commander';
import chokidar from 'chokidar';
import express from 'express';
import liveReload from 'livereload';
import path from 'path';
import fs from 'fs';
import { buildSite } from './core/builder';
import { loadConfig } from './core/config-loader';
import logger from './utils/logger';
import { version } from '../package.json';

// --- Helper Functions ---

const resolvePath = (inputPath: string): string => {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
};

const ensureDirectory = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createFile = (filePath: string, content: string): string => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  return filePath;
};


// --- Command Implementations ---

async function buildCommand(inputDir: string, outputDir: string, configFile: string, options: any = {}): Promise<void> {
  try {
    logger.start('Starting RetroMark build...');
    const startTime = Date.now();
    const config = await loadConfig(configFile);

    if (options.theme) config.theme = options.theme;
    if (options.toc) config.toc.position = options.toc;
    if (options.math) config.math.engine = options.math;

    await buildSite(inputDir, outputDir, config);
    
    const duration = (Date.now() - startTime) / 1000;
    logger.success(`Build completed in ${duration.toFixed(2)}s`);
    logger.info(`Output directory: ${resolvePath(outputDir)}`);
  } catch (error) {
    logger.error('Build failed:');
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error(error);
    }
    process.exit(1);
  }
}

async function serveCommand(inputDir: string, outputDir: string, configFile: string, port: number): Promise<void> {
  try {
    logger.info('Performing initial build...');
    const config = await loadConfig(configFile);
    await buildSite(inputDir, outputDir, config);
    
    const app = express();
    app.use(express.static(outputDir));
    
    const server = app.listen(port, () => {
      logger.info(`Server running at http://localhost:${port}`);
      logger.info('Watching for changes... (Press Ctrl+C to stop)');
    });
    
    const lrServer = liveReload.createServer({ exts: ['html', 'css', 'js', 'md'], delay: 300 });
    lrServer.watch(outputDir);
    
    const watcher = chokidar.watch(inputDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });
    
    watcher.on('all', async (event, filePath) => {
      logger.info(`Change detected in: ${path.basename(filePath)}`);
      try {
        await buildSite(inputDir, outputDir, config);
        logger.success('Site rebuilt successfully.');
      } catch (error) {
        logger.error('Rebuild failed:');
        if (error instanceof Error) {
            logger.error(error.message);
        } else {
            logger.error(error);
        }
      }
    });

    process.on('SIGINT', () => {
      watcher.close();
      lrServer.close();
      server.close();
      logger.info('\nServer stopped.');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:');
    if (error instanceof Error) {
        logger.error(error.message);
    } else {
        logger.error(error);
    }
    process.exit(1);
  }
}

function initCommand(directory: string = 'retromark-site'): void {
    try {
        const projectPath = resolvePath(directory);
        logger.info(`Initializing new RetroMark project at ${projectPath}`);

        ensureDirectory(projectPath);
        ['content', 'assets', 'themes'].forEach(dir => ensureDirectory(path.join(projectPath, dir)));

        const sampleConfig = `
# RetroMark Configuration
theme: academic
title: "My New Retro Site"
author: "Your Name"
baseUrl: "/"
nav:
  - title: "Home"
    path: "/"
`;
        const sampleIndex = `
# Welcome to RetroMark!

This is your new retro-styled site.

Start by editing \`content/index.md\`.
`;
        createFile(path.join(projectPath, 'retro.yml'), sampleConfig.trim());
        createFile(path.join(projectPath, 'content/index.md'), sampleIndex.trim());

        logger.success(`Project created at ${projectPath}`);
        logger.info('Next steps:');
        logger.plain(`  1. cd ${directory}`);
        logger.plain('  2. npx retromark serve');
    } catch (error) {
        logger.error('Project initialization failed:');
        if (error instanceof Error) {
            logger.error(error.message);
        } else {
            logger.error(error);
        }
        process.exit(1);
    }
}

function newPageCommand(title: string, options: any): void {
    try {
        const contentDir = resolvePath(options.dir || 'content');
        ensureDirectory(contentDir);

        const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        let filename = `${slug}.md`;

        if (options.chapter) {
            const files = fs.readdirSync(contentDir);
            const chapterCount = files.filter(f => /^\d{2}-/.test(f)).length;
            const chapterNum = String(chapterCount + 1).padStart(2, '0');
            filename = `${chapterNum}-${slug}.md`;
        }

        const filePath = path.join(contentDir, filename);
        const frontmatter = `---
title: "${title}"
date: ${new Date().toISOString()}
---

# ${title}

Start writing your amazing content here.
`;
        createFile(filePath, frontmatter.trim());

        logger.success(`Created new page: ${filename}`);
        logger.info(`Path: ${filePath}`);
    } catch (error) {
        logger.error('Page creation failed:');
        if (error instanceof Error) {
            logger.error(error.message);
        } else {
            logger.error(error);
        }
        process.exit(1);
    }
}


// --- CLI Setup ---

program
  .name('retromark')
  .description('A retro-themed static site generator with math support and customizable layouts.')
  .version(version);

program
  .command('build')
  .description('Build static site from Markdown files')
  .option('-i, --input <dir>', 'Source directory', 'content')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-c, --config <file>', 'Configuration file', 'retro.yml')
  .option('--theme <theme>', 'Override the configured theme')
  .option('--toc <position>', 'Override Table of Contents position')
  .option('--math <engine>', 'Override math rendering engine (katex/mathjax)')
  .action((options) => buildCommand(options.input, options.output, options.config, options));

program
  .command('serve')
  .description('Start a local development server with live reload')
  .option('-i, --input <dir>', 'Source directory', 'content')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-c, --config <file>', 'Configuration file', 'retro.yml')
  .option('-p, --port <number>', 'Server port', '3000')
  .action((options) => serveCommand(options.input, options.output, options.config, parseInt(options.port, 10)));

program
  .command('init [directory]')
  .description('Create a new RetroMark project in a specified directory')
  .action((directory) => initCommand(directory));

program
  .command('new <title>')
  .description('Create a new content page')
  .option('-c, --chapter', 'Format as a chapter with numeric prefix')
  .option('-d, --dir <directory>', 'Content directory', 'content')
  .action((title, options) => newPageCommand(title, options));

program.on('command:*', () => {
  logger.error(`Invalid command: ${program.args.join(' ')}`);
  logger.info('See --help for a list of available commands.');
  process.exit(1);
});

if (process.argv.length < 3) {
  program.outputHelp();
}

program.parse(process.argv);
