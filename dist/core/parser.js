"use strict";
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const yaml = require('js-yaml');
const katex = require('katex');
const { logger } = require("../utils/logger.js");
/**
 * RetroMark Markdown Parser
 * =========================
 * Handles Markdown processing with:
 * - Front matter extraction
 * - Math equation support (KaTeX)
 * - Syntax highlighting
 * - Header anchoring
 * - Table of Contents generation
 * - Custom renderers for retro themes
 */
// Custom tokenizer for front matter
const frontMatterExtension = {
    name: 'frontMatter',
    level: 'block',
    start(src) {
        return src.match(/^---\s*\n/)?.index;
    },
    tokenizer(src) {
        const match = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (match) {
            return {
                type: 'frontMatter',
                raw: match[0],
                text: match[1].trim()
            };
        }
    }
};
// Add custom extension to marked
marked.use({ extensions: [frontMatterExtension] });
/**
 * Parse Markdown file with front matter
 * @param {string} filePath Path to Markdown file
 * @returns {object} { content, frontMatter, toc }
 */
function parseMarkdownFile(filePath) {
    try {
        const markdownContent = fs.readFileSync(filePath, 'utf8');
        return parseMarkdown(markdownContent);
    }
    catch (error) {
        logger.error(`❌ Error reading file ${filePath}: ${error.message}`);
        return { content: '', frontMatter: {}, toc: [] };
    }
}
/**
 * Parse Markdown content
 * @param {string} markdownContent Raw Markdown content
 * @returns {object} { content, frontMatter, toc }
 */
function parseMarkdown(markdownContent) {
    const toc = [];
    // Custom renderer for Markdown
    const renderer = new marked.Renderer();
    // Header processing for TOC
    renderer.heading = (text, level, raw) => {
        const anchor = raw.toLowerCase().replace(/[^\w]+/g, '-');
        toc.push({ level, text, anchor });
        return `
      <h${level} id="${anchor}" class="retro-header">
        <a href="#${anchor}" class="header-anchor">#</a>
        ${text}
      </h${level}>
    `;
    };
    // Math equation rendering
    renderer.codespan = (code) => {
        if (code.startsWith('$') && code.endsWith('$')) {
            const math = code.slice(1, -1);
            try {
                return katex.renderToString(math, { displayMode: false });
            }
            catch (e) {
                logger.warn(`⚠️ KaTeX error in inline math: ${math}`);
                return `<code>${math}</code>`;
            }
        }
        return `<code>${code}</code>`;
    };
    renderer.code = (code, language) => {
        // Handle math blocks
        if (language === 'math') {
            try {
                return `
          <div class="math-block">
            ${katex.renderToString(code, { displayMode: true })}
          </div>
        `;
            }
            catch (e) {
                logger.warn(`⚠️ KaTeX error in block math: ${code}`);
                return `<pre><code>${code}</code></pre>`;
            }
        }
        // Syntax highlighting
        const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
        const highlighted = hljs.highlight(code, { language: validLang }).value;
        return `
      <div class="code-block">
        <div class="code-header">
          <span class="language-tag">${validLang}</span>
        </div>
        <pre><code class="hljs ${validLang}">${highlighted}</code></pre>
      </div>
    `;
    };
    // Retro-themed blockquotes
    renderer.blockquote = (quote) => {
        return `
      <blockquote class="retro-blockquote">
        <div class="quote-decoration">❝</div>
        ${quote}
        <div class="quote-decoration">❞</div>
      </blockquote>
    `;
    };
    // Vintage image styling
    renderer.image = (href, title, text) => {
        const isPolaroid = href.includes('#polaroid');
        const cleanHref = href.replace('#polaroid', '');
        return `
      <div class="image-container ${isPolaroid ? 'polaroid' : ''}">
        <img src="${cleanHref}" alt="${text}" title="${title || text}">
        ${title ? `<div class="image-caption">${title}</div>` : ''}
      </div>
    `;
    };
    // Table styling
    renderer.table = (header, body) => {
        return `
      <div class="retro-table-container">
        <table>
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
    };
    // Custom link handling
    renderer.link = (href, title, text) => {
        const isExternal = !href.startsWith('#') && !href.startsWith('/');
        const linkClass = isExternal ? 'external-link' : 'internal-link';
        return `
      <a href="${href}" 
         title="${title || text}" 
         class="${linkClass}"
         ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
        ${text}
        ${isExternal ? '<span class="external-icon">↗</span>' : ''}
      </a>
    `;
    };
    // Parse the Markdown
    let frontMatter = {};
    const tokens = marked.lexer(markdownContent);
    // Extract front matter if present
    if (tokens.length > 0 && tokens[0].type === 'frontMatter') {
        try {
            frontMatter = yaml.load(tokens[0].text) || {};
        }
        catch (e) {
            logger.warn(`⚠️ Error parsing front matter: ${e.message}`);
        }
        tokens.shift(); // Remove front matter token
    }
    // Convert tokens to HTML
    const content = marked.parser(tokens, { renderer });
    return { content, frontMatter, toc };
}
/**
 * Generate Table of Contents HTML
 * @param {Array} toc Table of contents entries
 * @param {number} maxDepth Maximum header depth to include
 * @returns {string} HTML for TOC
 */
function generateTOC(toc, maxDepth = 3) {
    if (!toc.length)
        return '';
    let currentLevel = toc[0].level;
    let html = '<div class="retro-toc">\n<ul>\n';
    toc.forEach((item) => {
        if (item.level > maxDepth)
            return;
        if (item.level > currentLevel) {
            html += '<ul>\n';
        }
        else if (item.level < currentLevel) {
            html += '</ul>\n'.repeat(currentLevel - item.level);
        }
        html += `<li><a href="#${item.anchor}">${item.text}</a></li>\n`;
        currentLevel = item.level;
    });
    // Close any remaining lists
    if (currentLevel > 1) {
        html += '</ul>\n'.repeat(currentLevel - 1);
    }
    html += '</ul>\n</div>';
    return html;
}
/**
 * Process math equations in HTML content
 * @param {string} html HTML content
 * @param {object} options Math options
 * @returns {string} Processed HTML
 */
function processMath(html, options = {}) {
    const { delimiters = { inline: ['$', '$'], display: ['$$', '$$'] } } = options;
    const [inlineStart, inlineEnd] = delimiters.inline;
    const [displayStart, displayEnd] = delimiters.display;
    // Process display math
    html = html.replace(new RegExp(`${escapeRegExp(displayStart)}([\\s\\S]*?)${escapeRegExp(displayEnd)}`, 'g'), (match, math) => {
        try {
            return katex.renderToString(math, { displayMode: true });
        }
        catch (e) {
            logger.warn(`⚠️ KaTeX error in display math: ${math}`);
            return `<div class="math-error">${math}</div>`;
        }
    });
    // Process inline math
    html = html.replace(new RegExp(`${escapeRegExp(inlineStart)}(.*?)${escapeRegExp(inlineEnd)}`, 'g'), (match, math) => {
        try {
            return katex.renderToString(math, { displayMode: false });
        }
        catch (e) {
            logger.warn(`⚠️ KaTeX error in inline math: ${math}`);
            return `<span class="math-error">${math}</span>`;
        }
    });
    return html;
}
// Helper to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
module.exports = {
    parseMarkdownFile,
    parseMarkdown,
    generateTOC,
    processMath
};
