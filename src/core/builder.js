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
  const finalSiteDir = path.resolve(process.cwd(), outputDir);
  const publicDir = path.resolve(process.cwd(), 'public');
  const templatesDir = path.resolve(__dirname, '../templates');
  const toolDistDir = path.resolve(__dirname, '../../dist'); // The tool's own dist folder

  logger.info(`Cleaning output directory: ${finalSiteDir}`);
  await fse.remove(finalSiteDir);

  logger.info(`Copying public assets from ${publicDir}`);
  if (fs.existsSync(publicDir)) {
    await fse.copy(publicDir, finalSiteDir);
  }

  logger.info(`Copying compiled theme styles`);
  const stylePath = path.join(toolDistDir, 'style.css');
  if (fs.existsSync(stylePath)) {
    await fse.copy(stylePath, path.join(finalSiteDir, 'style.css'));
  } else {
    logger.warn(`style.css not found in ${toolDistDir}. Run 'npm run build:themes' first.`);
  }

  const markdownFiles = findFilesByExtension(contentDir, '.md');
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
      const outputPath = path.join(finalSiteDir, relativePath.replace(/\.md$/, '.html'));

      const layoutPath = path.join(templatesDir, `layouts/${config.theme}.ejs`);
      
      // Data to be passed to all templates
      const templateData = {
        config,
        page: { frontMatter },
        content: htmlContent,
        toc: [] // Placeholder for your TOC logic
      };

      // Render the full page using the main layout
      const renderedHtml = await ejs.renderFile(layoutPath, templateData);

      await fse.ensureDir(path.dirname(outputPath));
      await fs.promises.writeFile(outputPath, renderedHtml);
      logger.success(`Rendered: ${path.relative(process.cwd(), outputPath)}`);
    } catch (error) {
        logger.error(`Failed to process file: ${file}`);
        if(error instanceof Error) {
            logger.error(error.message);
        }
    }
  }
}

module.exports = { buildSite };
