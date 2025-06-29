"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chokidar_1 = __importDefault(require("chokidar"));
const express_1 = __importDefault(require("express"));
const livereload_1 = __importDefault(require("livereload"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const builder_1 = require("./core/builder.js");
const config_loader_1 = require("./core/config-loader.js");
const logger_1 = __importDefault(require("./utils/logger.js"));
const package_json_1 = require("../package.json");
// --- Helper Functions ---
const resolvePath = (inputPath) => {
    return path_1.default.isAbsolute(inputPath) ? inputPath : path_1.default.resolve(process.cwd(), inputPath);
};
const ensureDirectory = (dirPath) => {
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
};
const createFile = (filePath, content) => {
    ensureDirectory(path_1.default.dirname(filePath));
    fs_1.default.writeFileSync(filePath, content);
    return filePath;
};
// --- Command Implementations ---
async function buildCommand(inputDir, outputDir, configFile, options = {}) {
    try {
        logger_1.default.start('Starting RetroMark build...');
        const startTime = Date.now();
        // Cast the config to our new interface
        const config = await (0, config_loader_1.loadConfig)(configFile);
        if (options.theme)
            config.theme = options.theme;
        if (options.toc)
            config.toc.position = options.toc;
        if (options.math)
            config.math.engine = options.math;
        await (0, builder_1.buildSite)(inputDir, outputDir, config);
        const duration = (Date.now() - startTime) / 1000;
        logger_1.default.success(`Build completed in ${duration.toFixed(2)}s`);
        logger_1.default.info(`Output directory: ${resolvePath(outputDir)}`);
    }
    catch (error) {
        logger_1.default.error('Build failed:');
        if (error instanceof Error) {
            logger_1.default.error(error.message);
        }
        else {
            logger_1.default.error(error);
        }
        process.exit(1);
    }
}
async function serveCommand(inputDir, outputDir, configFile, port) {
    try {
        logger_1.default.info('Performing initial build...');
        const config = await (0, config_loader_1.loadConfig)(configFile);
        await (0, builder_1.buildSite)(inputDir, outputDir, config);
        const app = (0, express_1.default)();
        app.use(express_1.default.static(outputDir));
        const server = app.listen(port, () => {
            logger_1.default.info(`Server running at http://localhost:${port}`);
            logger_1.default.info('Watching for changes... (Press Ctrl+C to stop)');
        });
        const lrServer = livereload_1.default.createServer({ exts: ['html', 'css', 'js', 'md'], delay: 300 });
        lrServer.watch(outputDir);
        const watcher = chokidar_1.default.watch(inputDir, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
        });
        watcher.on('all', async (event, filePath) => {
            logger_1.default.info(`Change detected in: ${path_1.default.basename(filePath)}`);
            try {
                await (0, builder_1.buildSite)(inputDir, outputDir, config);
                logger_1.default.success('Site rebuilt successfully.');
            }
            catch (error) {
                logger_1.default.error('Rebuild failed:');
                if (error instanceof Error) {
                    logger_1.default.error(error.message);
                }
                else {
                    logger_1.default.error(error);
                }
            }
        });
        process.on('SIGINT', () => {
            watcher.close();
            lrServer.close();
            server.close();
            logger_1.default.info('\nServer stopped.');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:');
        if (error instanceof Error) {
            logger_1.default.error(error.message);
        }
        else {
            logger_1.default.error(error);
        }
        process.exit(1);
    }
}
function initCommand(directory = 'retromark-site') {
    try {
        const projectPath = resolvePath(directory);
        logger_1.default.info(`Initializing new RetroMark project at ${projectPath}`);
        ensureDirectory(projectPath);
        ['content', 'assets', 'themes'].forEach(dir => ensureDirectory(path_1.default.join(projectPath, dir)));
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
        createFile(path_1.default.join(projectPath, 'retro.yml'), sampleConfig.trim());
        createFile(path_1.default.join(projectPath, 'content/index.md'), sampleIndex.trim());
        logger_1.default.success(`Project created at ${projectPath}`);
        logger_1.default.info('Next steps:');
        logger_1.default.plain(`  1. cd ${directory}`);
        logger_1.default.plain('  2. npx retromark serve');
    }
    catch (error) {
        logger_1.default.error('Project initialization failed:');
        if (error instanceof Error) {
            logger_1.default.error(error.message);
        }
        else {
            logger_1.default.error(error);
        }
        process.exit(1);
    }
}
function newPageCommand(title, options) {
    try {
        const contentDir = resolvePath(options.dir || 'content');
        ensureDirectory(contentDir);
        const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        let filename = `${slug}.md`;
        if (options.chapter) {
            const files = fs_1.default.readdirSync(contentDir);
            const chapterCount = files.filter(f => /^\d{2}-/.test(f)).length;
            const chapterNum = String(chapterCount + 1).padStart(2, '0');
            filename = `${chapterNum}-${slug}.md`;
        }
        const filePath = path_1.default.join(contentDir, filename);
        const frontmatter = `---
title: "${title}"
date: ${new Date().toISOString()}
---

# ${title}

Start writing your amazing content here.
`;
        createFile(filePath, frontmatter.trim());
        logger_1.default.success(`Created new page: ${filename}`);
        logger_1.default.info(`Path: ${filePath}`);
    }
    catch (error) {
        logger_1.default.error('Page creation failed:');
        if (error instanceof Error) {
            logger_1.default.error(error.message);
        }
        else {
            logger_1.default.error(error);
        }
        process.exit(1);
    }
}
// --- CLI Setup ---
commander_1.program
    .name('retromark')
    .description('A retro-themed static site generator with math support and customizable layouts.')
    .version(package_json_1.version);
commander_1.program
    .command('build')
    .description('Build static site from Markdown files')
    .option('-i, --input <dir>', 'Source directory', 'content')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('-c, --config <file>', 'Configuration file', 'retro.yml')
    .option('--theme <theme>', 'Override the configured theme')
    .option('--toc <position>', 'Override Table of Contents position')
    .option('--math <engine>', 'Override math rendering engine (katex/mathjax)')
    .action((options) => buildCommand(options.input, options.output, options.config, options));
commander_1.program
    .command('serve')
    .description('Start a local development server with live reload')
    .option('-i, --input <dir>', 'Source directory', 'content')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('-c, --config <file>', 'Configuration file', 'retro.yml')
    .option('-p, --port <number>', 'Server port', '3000')
    .action((options) => serveCommand(options.input, options.output, options.config, parseInt(options.port, 10)));
commander_1.program
    .command('init [directory]')
    .description('Create a new RetroMark project in a specified directory')
    .action((directory) => initCommand(directory));
commander_1.program
    .command('new <title>')
    .description('Create a new content page')
    .option('-c, --chapter', 'Format as a chapter with numeric prefix')
    .option('-d, --dir <directory>', 'Content directory', 'content')
    .action((title, options) => newPageCommand(title, options));
commander_1.program.on('command:*', () => {
    logger_1.default.error(`Invalid command: ${commander_1.program.args.join(' ')}`);
    logger_1.default.info('See --help for a list of available commands.');
    process.exit(1);
});
if (process.argv.length < 3) {
    commander_1.program.outputHelp();
}
commander_1.program.parse(process.argv);
