"use strict";
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const { logger } = require('../utils/logger');
const { parseMarkdownFile } = require('./parser');
/**
 * RetroMark Theme Loader
 * =====================
 * Handles theme loading, compilation, and customization with:
 * - SCSS compilation with variables
 * - Theme inheritance system
 * - Customization overrides
 * - Font management
 * - Asset handling
 */
// Default theme variables
const DEFAULT_VARIABLES = {
    // Colors
    'primary-color': '#8b0000',
    'secondary-color': '#556b2f',
    'background-color': '#f9f3e9',
    'text-color': '#333333',
    'link-color': '#0066cc',
    'link-hover-color': '#8b0000',
    'header-bg': '#ffffff',
    'sidebar-bg': '#f5f2e9',
    'code-bg': '#f8f5e9',
    'border-color': '#dcd6c2',
    // Typography
    'font-body': '"Garamond", "Times New Roman", serif',
    'font-headings': '"Playfair Display", "Georgia", serif',
    'font-code': '"Courier Prime", monospace',
    // Sizes
    'base-font-size': '18px',
    'h1-size': '2.5rem',
    'h2-size': '2rem',
    'h3-size': '1.75rem',
    'max-content-width': '800px',
    'line-height': '1.6',
    // Effects
    'paper-texture': 'none',
    'ink-bleed': '0.5px',
};
/**
 * Theme Manager Class
 */
class ThemeManager {
    constructor(config) {
        this.config = config;
        this.themeName = config.theme || 'academic';
        this.themeVariables = { ...DEFAULT_VARIABLES };
        this.customCss = '';
        this.fontImports = [];
    }
    /**
     * Load and compile theme CSS
     * @returns {string} Compiled CSS
     */
    async loadTheme() {
        try {
            // Step 1: Load theme variables
            await this.loadThemeVariables();
            // Step 2: Compile main theme SCSS
            const themeCss = this.compileTheme();
            // Step 3: Apply customizations
            this.loadCustomCss();
            // Step 4: Add KaTeX CSS if needed
            const mathCss = this.getMathCss();
            return `${this.fontImports.join('\n')}\n${themeCss}\n${this.customCss}\n${mathCss}`;
        }
        catch (error) {
            logger.error(`❌ Theme loading failed: ${error.message}`);
            return '';
        }
    }
    /**
     * Load theme variables from preset or config
     */
    async loadThemeVariables() {
        // Load preset if specified
        if (this.config.preset) {
            await this.loadPreset(this.config.preset);
        }
        // Apply theme-specific variables
        if (this.config.themeVariables) {
            Object.entries(this.config.themeVariables).forEach(([key, value]) => {
                this.themeVariables[`${key}`] = value;
            });
        }
        // Apply color customizations
        if (this.config.colors) {
            Object.entries(this.config.colors).forEach(([key, value]) => {
                this.themeVariables[`${key}-color`] = value;
            });
        }
        // Apply typography customizations
        if (this.config.typography) {
            const { font, sizes } = this.config.typography;
            if (font) {
                if (font.body)
                    this.themeVariables['font-body'] = font.body;
                if (font.headings)
                    this.themeVariables['font-headings'] = font.headings;
                if (font.code)
                    this.themeVariables['font-code'] = font.code;
            }
            if (sizes) {
                if (sizes.base)
                    this.themeVariables['base-font-size'] = sizes.base;
                if (sizes.h1)
                    this.themeVariables['h1-size'] = sizes.h1;
                if (sizes.h2)
                    this.themeVariables['h2-size'] = sizes.h2;
                if (sizes.h3)
                    this.themeVariables['h3-size'] = sizes.h3;
                if (sizes.max_width)
                    this.themeVariables['max-content-width'] = sizes.max_width;
                if (sizes.line_height)
                    this.themeVariables['line-height'] = sizes.line_height;
            }
        }
        // Add custom fonts
        if (this.config.custom?.fonts) {
            this.config.custom.fonts.forEach(font => {
                if (font.url) {
                    this.fontImports.push(`@import url('${font.url}');`);
                }
            });
        }
    }
    /**
     * Load theme preset variables
     * @param {string} presetName
     */
    async loadPreset(presetName) {
        const presetPath = path.join(__dirname, '../../presets', `${presetName}.yml`);
        if (!fs.existsSync(presetPath)) {
            logger.warn(`⚠️ Preset not found: ${presetName}. Using defaults.`);
            return;
        }
        try {
            const presetContent = fs.readFileSync(presetPath, 'utf8');
            const preset = yaml.load(presetContent);
            // Apply preset variables
            if (preset.colors) {
                Object.entries(preset.colors).forEach(([key, value]) => {
                    this.themeVariables[`${key}-color`] = value;
                });
            }
            if (preset.typography) {
                const { font, sizes } = preset.typography;
                if (font) {
                    if (font.body)
                        this.themeVariables['font-body'] = font.body;
                    if (font.headings)
                        this.themeVariables['font-headings'] = font.headings;
                    if (font.code)
                        this.themeVariables['font-code'] = font.code;
                }
                if (sizes) {
                    if (sizes.base)
                        this.themeVariables['base-font-size'] = sizes.base;
                    if (sizes.h1)
                        this.themeVariables['h1-size'] = sizes.h1;
                    if (sizes.h2)
                        this.themeVariables['h2-size'] = sizes.h2;
                    if (sizes.h3)
                        this.themeVariables['h3-size'] = sizes.h3;
                    if (sizes.max_width)
                        this.themeVariables['max-content-width'] = sizes.max_width;
                    if (sizes.line_height)
                        this.themeVariables['line-height'] = sizes.line_height;
                }
            }
            logger.info(`✅ Loaded preset: ${presetName}`);
        }
        catch (error) {
            logger.error(`❌ Error loading preset ${presetName}: ${error.message}`);
        }
    }
    /**
     * Compile theme SCSS to CSS
     * @returns {string} Compiled CSS
     */
    compileTheme() {
        const themePaths = [
            path.join(__dirname, `../../themes/${this.themeName}.scss`),
            path.join(__dirname, `../../themes/_${this.themeName}.scss`),
            path.join(process.cwd(), `themes/${this.themeName}.scss`),
        ];
        let themePath;
        for (const path of themePaths) {
            if (fs.existsSync(path)) {
                themePath = path;
                break;
            }
        }
        if (!themePath) {
            throw new Error(`Theme "${this.themeName}" not found in any search paths`);
        }
        // Generate SCSS variables
        let scssVars = '';
        Object.entries(this.themeVariables).forEach(([key, value]) => {
            scssVars += `$${key}: ${value};\n`;
        });
        // Read theme file
        const themeContent = fs.readFileSync(themePath, 'utf8');
        // Compile SCSS
        const result = sass.compileString(`${scssVars}\n${themeContent}`, {
            style: 'compressed',
            loadPaths: [
                path.dirname(themePath),
                path.join(__dirname, '../../themes'),
                path.join(process.cwd(), 'themes')
            ]
        });
        return result.css;
    }
    /**
     * Load custom CSS overrides
     */
    loadCustomCss() {
        if (!this.config.custom?.css)
            return;
        const cssPaths = Array.isArray(this.config.custom.css)
            ? this.config.custom.css
            : [this.config.custom.css];
        cssPaths.forEach(cssPath => {
            const fullPath = path.resolve(process.cwd(), cssPath);
            if (fs.existsSync(fullPath)) {
                try {
                    this.customCss += `\n/* Custom CSS: ${cssPath} */\n`;
                    this.customCss += fs.readFileSync(fullPath, 'utf8');
                }
                catch (error) {
                    logger.warn(`⚠️ Error loading custom CSS ${cssPath}: ${error.message}`);
                }
            }
            else {
                logger.warn(`⚠️ Custom CSS file not found: ${cssPath}`);
            }
        });
    }
    /**
     * Get KaTeX CSS if math is enabled
     * @returns {string} KaTeX CSS
     */
    getMathCss() {
        if (this.config.math?.engine !== 'katex')
            return '';
        try {
            const katexPath = require.resolve('katex/dist/katex.min.css');
            return fs.readFileSync(katexPath, 'utf8');
        }
        catch (error) {
            logger.warn('⚠️ KaTeX CSS not found. Math may not render properly.');
            return '';
        }
    }
    /**
     * Get theme assets (textures, fonts, etc.)
     * @returns {Array} List of asset paths to copy
     */
    getThemeAssets() {
        const assets = [];
        // Add paper texture if specified
        if (this.themeVariables['paper-texture'] &&
            this.themeVariables['paper-texture'] !== 'none') {
            const texturePath = this.themeVariables['paper-texture']
                .replace('url(', '')
                .replace(')', '')
                .replace(/'/g, '')
                .replace(/"/g, '');
            assets.push({
                src: path.resolve(process.cwd(), texturePath),
                dest: 'assets/textures/' + path.basename(texturePath)
            });
        }
        // Add custom fonts
        if (this.config.custom?.fonts) {
            this.config.custom.fonts.forEach(font => {
                if (font.local) {
                    assets.push({
                        src: path.resolve(process.cwd(), font.local),
                        dest: 'assets/fonts/' + path.basename(font.local)
                    });
                }
            });
        }
        return assets;
    }
    /**
     * Apply theme to HTML content
     * @param {string} html HTML content
     * @returns {string} Themed HTML
     */
    applyThemeClasses(html) {
        return html
            .replace(/<body([^>]*)>/, `<body$1 class="theme-${this.themeName}">`)
            .replace(/<html([^>]*)>/, `<html$1 class="theme-${this.themeName}">`);
    }
    /**
     * Generate theme preview HTML
     * @returns {string} Preview HTML
     */
    generateThemePreview() {
        const previewContent = `
      <div class="theme-preview">
        <h1>${this.themeName} Theme Preview</h1>
        <p>This is a paragraph showing the body text style. <strong>Strong text</strong>, <em>emphasized text</em>, and a <a href="#">sample link</a>.</p>
        
        <h2>Heading Level 2</h2>
        <h3>Heading Level 3</h3>
        
        <blockquote>
          <p>A blockquote demonstrating the styling for quoted text.</p>
        </blockquote>
        
        <div class="code-block">
          <pre><code>// Code block example
function hello() {
  return "World!";
}</code></pre>
        </div>
        
        <div class="math-block">
          $$ e^{i\pi} + 1 = 0 $$
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Row 1, Cell 1</td>
              <td>Row 1, Cell 2</td>
            </tr>
            <tr>
              <td>Row 2, Cell 1</td>
              <td>Row 2, Cell 2</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
        return this.applyThemeClasses(previewContent);
    }
}
module.exports = ThemeManager;
