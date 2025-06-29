"use strict";
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const fse = require('fs-extra');
const { marked } = require('marked');
const { gfmHeadingId } = require("marked-gfm-heading-id");
const logger = require('../utils/logger');
const { findFilesByExtension } = require('../utils/file-utils');
marked.use(gfmHeadingId());
async function buildSite(inputDir, outputDir, config) {
    const contentDir = path.resolve(process.cwd(), inputDir);
    const distDir = path.resolve(process.cwd(), outputDir);
    const publicDir = path.resolve(process.cwd(), 'public');
    const templatesDir = path.resolve(__dirname, '../templates');
    logger.info(`Cleaning output directory: ${distDir}`);
    await fse.remove(distDir);
    if (fs.existsSync(publicDir)) {
        logger.info(`Copying public assets from ${publicDir}`);
        await fse.copy(publicDir, distDir);
    }
    const themePath = path.resolve(__dirname, `../themes/${config.theme}.scss`);
    if (fs.existsSync(themePath)) {
        logger.info(`Theme '${config.theme}' would be compiled here into dist/style.css`);
        const dummyCss = `/* Styles for ${config.theme} theme */ body { font-family: sans-serif; }`;
        await fse.outputFile(path.join(distDir, 'style.css'), dummyCss);
    }
    const markdownFiles = findFilesByExtension(contentDir, '.md');
    if (markdownFiles.length === 0) {
        logger.warn(`No markdown files found in ${contentDir}.`);
        return;
    }
    logger.info(`Found ${markdownFiles.length} markdown files to process.`);
    for (const file of markdownFiles) {
        try {
            const fileContent = fs.readFileSync(file, 'utf8');
            const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
            const match = fileContent.match(frontMatterRegex);
            const frontMatter = match ? require('js-yaml').load(match[1]) : {};
            const markdownBody = match ? fileContent.slice(match[0].length) : fileContent;
            const htmlContent = marked.parse(markdownBody);
            const relativePath = path.relative(contentDir, file);
            const outputPath = path.join(distDir, relativePath.replace(/\.md$/, '.html'));
            const layoutPath = path.join(templatesDir, `layouts/${config.theme}.ejs`);
            const templateData = {
                config,
                page: { frontMatter },
                content: htmlContent,
                toc: []
            };
            const renderedHtml = await ejs.renderFile(layoutPath, templateData, { async: true });
            await fse.ensureDir(path.dirname(outputPath));
            await fs.promises.writeFile(outputPath, renderedHtml);
            logger.success(`Rendered: ${path.relative(process.cwd(), outputPath)}`);
        }
        catch (error) {
            logger.error(`Failed to process file: ${file}`);
            if (error instanceof Error) {
                logger.error(error.message);
            }
        }
    }
}
module.exports = { buildSite };
