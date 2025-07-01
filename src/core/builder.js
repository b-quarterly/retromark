const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const fse = require('fs-extra');
const { marked } = require('marked');
const { gfmHeadingId } = require("marked-gfm-heading-id");
const logger = require('../utils/logger');
const { findFilesByExtension } = require('../utils/file-utils');
const { parseMarkdown } = require('./parser');

marked.use(gfmHeadingId());

async function buildSite(inputDir, outputDir, config) {
  const contentDir = path.resolve(process.cwd(), inputDir);
  const finalSiteDir = path.resolve(process.cwd(), outputDir);
  const publicDir = path.resolve(process.cwd(), 'public');
  const templatesDir = path.resolve(__dirname, '../templates');
  
  logger.info(`Cleaning output directory: ${finalSiteDir}`);
  await fse.remove(finalSiteDir);

  if (fs.existsSync(publicDir)) {
    logger.info(`Copying public assets from ${publicDir}`);
    await fse.copy(publicDir, finalSiteDir);
  }
  
  const stylePath = path.join(process.cwd(), 'dist/style.css');
  if (fs.existsSync(stylePath)) {
    logger.info(`Copying style.css to the site directory.`);
    await fse.copy(stylePath, path.join(finalSiteDir, 'style.css'));
  } else {
    logger.warn(`Warning: style.css not found. Site will be unstyled.`);
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
      const { content: htmlContent, frontMatter, toc } = parseMarkdown(fileContent);
      
      const relativePath = path.relative(contentDir, file);
      const outputPath = path.join(finalSiteDir, relativePath.replace(/\.md$/, '.html'));

      const layoutPath = path.join(templatesDir, `layouts/${config.theme}.ejs`);
      
      const templateData = {
        config,
        page: { frontMatter },
        content: htmlContent,
        toc // Pass the raw toc data
      };

      // Render the EJS template
      const renderedHtml = await ejs.renderFile(layoutPath, templateData, { async: true });

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
