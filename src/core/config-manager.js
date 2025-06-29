const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { logger } = require('../utils/logger');
const { parseMarkdown } = require('./parser');

/**
 * RetroMark Configuration Manager
 * ===============================
 * Handles loading, merging, and validating configuration for:
 * - Site metadata
 * - Theme settings
 * - Layout options
 * - Navigation structure
 * - Table of Contents
 * - Math processing
 * - Custom assets
 * - Build options
 */

// Default configuration values
const DEFAULT_CONFIG = {
  // Site Metadata
  title: "RetroMark Site",
  description: "A retro-styled static site",
  baseUrl: "/",
  author: "Author Name",
  language: "en-US",
  
  // Theme Settings
  theme: "academic",
  preset: null,
  themeVariables: {},
  
  // Layout
  layout: {
    type: "sidebar-left",  // Options: full-width/sidebar-left/sidebar-right/two-column
    header: {
      position: "fixed",   // fixed/static/sticky/none
      style: "minimal",     // minimal/classic/full
      showTitle: true,
      showLogo: false,
      showNav: true
    },
    sidebar: {
      width: "280px",
      position: "left"     // left/right
    },
    footer: {
      enabled: true,
      content: "Built with RetroMark • © {year}"
    }
  },
  
  // Table of Contents
  toc: {
    enabled: true,
    position: "sticky-left", // top/bottom/sticky-left/sticky-right/none
    depth: 3,                // Header depth (1-6)
    style: "classic",        // classic/modern/minimal
    numbering: false,        // Enable section numbering
    indentGuides: true       // Show hierarchy indentation
  },
  
  // Navigation
  nav: [
    { title: "Home", path: "/" }
  ],
  
  // Typography
  typography: {
    font: {
      body: "Garamond, serif",
      headings: "Times New Roman, serif",
      code: "Courier, monospace"
    },
    sizes: {
      base: "18px",
      h1: "2.5rem",
      h2: "2rem",
      h3: "1.75rem"
    },
    line_height: 1.6,
    max_width: "800px",
    paragraph_indent: "0",
    paragraph_spacing: "1rem"
  },
  
  // Colors
  colors: {
    primary: "#8b0000",
    secondary: "#556b2f",
    background: "#f9f3e9",
    text: "#333333",
    links: "#0066cc",
    links_hover: "#8b0000",
    header_bg: "#ffffff",
    sidebar_bg: "#f5f2e9",
    border: "#dcd6c2",
    code_bg: "#f8f5e9",
    blockquote_border: "#8b0000"
  },
  
  // Math Support
  math: {
    engine: "katex",       // katex/mathjax/none
    delimiters: {
      inline: ['$', '$'],
      display: ['$$', '$$']
    },
    copy_tex: true         // Enable copy TeX source
  },
  
  // Features
  features: {
    syntax_highlighting: true,
    header_anchors: true,
    print_mode: true,
    dark_mode: false,
    progress_bar: false,
    footnotes: true,
    hyphenation: true
  },
  
  // Custom Assets
  custom: {
    css: [],
    js: [],
    fonts: [],
    favicon: null
  },
  
  // Processing Options
  processing: {
    smart_quotes: true,
    typographer: true,
    linkify: true,
    emoji: true,
    preserve_line_breaks: false
  },
  
  // Build Options
  output: "dist",
  exclude: ["drafts/", "*.tmp.md"]
};

/**
 * Configuration Manager Class
 */
class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.env = process.env;
  }
  
  /**
   * Load configuration from file
   * @param {string} configPath Path to config file
   * @returns {object} Configuration object
   */
  async load(configPath = 'retro.yml') {
    try {
      // Resolve config path
      const resolvedPath = this.resolveConfigPath(configPath);
      
      if (!resolvedPath) {
        logger.warn('⚠️ Config file not found. Using defaults.');
        return this.config;
      }
      
      // Load file content
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      
      // Parse YAML
      const userConfig = yaml.load(fileContent);
      
      // Merge with defaults
      this.mergeConfig(userConfig);
      
      // Process environment variables
      this.applyEnvironmentOverrides();
      
      // Validate configuration
      this.validateConfig();
      
      logger.info('✅ Configuration loaded');
      return this.config;
    } catch (error) {
      logger.error(`❌ Error loading config: ${error.message}`);
      return this.config;
    }
  }
  
  /**
   * Resolve configuration file path
   * @param {string} configPath 
   * @returns {string|null} Resolved path or null
   */
  resolveConfigPath(configPath) {
    const searchPaths = [
      configPath,
      path.join(process.cwd(), configPath),
      path.join(process.cwd(), 'config', configPath),
      path.join(process.cwd(), 'retro.yml'),
      path.join(process.cwd(), 'config', 'retro.yml')
    ];
    
    for (const path of searchPaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    return null;
  }
  
  /**
   * Merge user config with defaults
   * @param {object} userConfig 
   */
  mergeConfig(userConfig) {
    // Deep merge function for nested objects
    const deepMerge = (target, source) => {
      for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && !Array.isArray(source[key]) && 
            target[key] instanceof Object && !Array.isArray(target[key])) {
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };
    
    this.config = deepMerge({ ...DEFAULT_CONFIG }, userConfig);
  }
  
  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    const envMap = {
      'RM_THEME': 'theme',
      'RM_TITLE': 'title',
      'RM_BASE_URL': 'baseUrl',
      'RM_OUTPUT_DIR': 'output',
      'RM_MATH_ENGINE': 'math.engine',
      'RM_TOC_POSITION': 'toc.position'
    };
    
    Object.entries(envMap).forEach(([envVar, configPath]) => {
      if (this.env[envVar]) {
        this.setConfigValue(configPath, this.env[envVar]);
      }
    });
  }
  
  /**
   * Set a configuration value using dot notation path
   * @param {string} path Dot notation path (e.g., 'math.engine')
   * @param {any} value Value to set
   */
  setConfigValue(path, value) {
    const parts = path.split('.');
    let current = this.config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Validate configuration values
   */
  validateConfig() {
    // Theme validation
    const validThemes = ['academic', 'novel', 'guidebook', 'terminal', 'vaporwave'];
    if (!validThemes.includes(this.config.theme)) {
      logger.warn(`⚠️ Invalid theme: ${this.config.theme}. Using default (academic).`);
      this.config.theme = 'academic';
    }
    
    // TOC position validation
    const validTocPositions = ['top', 'bottom', 'sticky-left', 'sticky-right', 'none'];
    if (!validTocPositions.includes(this.config.toc.position)) {
      logger.warn(`⚠️ Invalid TOC position: ${this.config.toc.position}. Using default (sticky-left).`);
      this.config.toc.position = 'sticky-left';
    }
    
    // Math engine validation
    const validMathEngines = ['katex', 'mathjax', 'none'];
    if (!validMathEngines.includes(this.config.math.engine)) {
      logger.warn(`⚠️ Invalid math engine: ${this.config.math.engine}. Using default (katex).`);
      this.config.math.engine = 'katex';
    }
    
    // Validate navigation structure
    if (Array.isArray(this.config.nav)) {
      this.config.nav = this.config.nav.map(item => {
        if (!item.path) {
          logger.warn('⚠️ Navigation item missing path. Using "#"');
          return { ...item, path: '#' };
        }
        return item;
      });
    }
    
    // Validate output directory
    if (!this.config.output) {
      this.config.output = 'dist';
    }
  }
  
  /**
   * Get configuration value
   * @param {string} key Dot notation key
   * @param {any} defaultValue Default if not found
   * @returns {any} Configuration value
   */
  get(key, defaultValue = null) {
    const parts = key.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Generate configuration documentation
   * @returns {string} Markdown documentation
   */
  generateDocs() {
    const configDoc = `
# RetroMark Configuration Reference

## Site Metadata
| Key         | Type   | Default       | Description |
|-------------|--------|---------------|-------------|
| title       | string | "RetroMark Site" | Site title |
| description | string | "" | Site description |
| baseUrl     | string | "/" | Base URL for deployment |
| author      | string | "" | Site author |
| language    | string | "en-US" | Site language |

## Theme Settings
| Key            | Type   | Default     | Description |
|----------------|--------|-------------|-------------|
| theme          | string | "academic"  | Theme name (academic, novel, etc.) |
| preset         | string | null        | Configuration preset name |
| themeVariables | object | {}          | Theme-specific variables |

## Layout Options
| Key                  | Type   | Default       | Description |
|----------------------|--------|---------------|-------------|
| layout.type          | string | "sidebar-left" | Layout type |
| layout.header.position | string | "fixed"      | Header position |
| layout.header.style  | string | "minimal"    | Header style |
| layout.sidebar.width | string | "280px"      | Sidebar width |
| layout.footer.enabled| bool   | true         | Show footer |

## Table of Contents
| Key            | Type   | Default       | Description |
|----------------|--------|---------------|-------------|
| toc.enabled    | bool   | true          | Enable TOC |
| toc.position   | string | "sticky-left" | TOC position |
| toc.depth      | number | 3             | Header depth |
| toc.style      | string | "classic"     | TOC style |

## Navigation
Array of navigation items with:
- title: Display text
- path: URL path
- children: Sub-items array

## Math Support
| Key                 | Type   | Default       | Description |
|---------------------|--------|---------------|-------------|
| math.engine         | string | "katex"       | Math engine |
| math.delimiters.inline | array | ["$", "$"] | Inline math delimiters |
| math.delimiters.display | array | ["$$", "$$"] | Display math delimiters |

## Full documentation available at: [docs/CONFIGURATION.md]
`;
    
    return parseMarkdown(configDoc).content;
  }
  
  /**
   * Generate configuration template
   * @returns {string} YAML configuration template
   */
  generateTemplate() {
    return yaml.dump(DEFAULT_CONFIG, {
      skipInvalid: true,
      lineWidth: -1,
      sortKeys: false
    });
  }
}

module.exports = new ConfigManager();
