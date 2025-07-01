"use strict";
const { logger } = require('../utils/logger');
/**
 * RetroMark Table of Contents Generator
 * =====================================
 * Creates a hierarchical TOC from headers with customization options:
 * - Position (sticky-left, sticky-right, top, bottom)
 * - Depth control
 * - Numbering system
 * - Indentation guides
 * - Style variants
 * - Responsive behavior
 */
class TocGenerator {
    /**
     * Generate TOC HTML from header data
     * @param {Array} headers - Array of header objects {id, level, text}
     * @param {Object} options - TOC configuration options
     * @returns {string} HTML for the table of contents
     */
    generate(headers, options = {}) {
        if (!headers || headers.length === 0)
            return '';
        const { position = 'sticky-left', depth = 3, style = 'classic', numbering = false, indentGuides = true } = options;
        // Filter headers based on depth
        const filteredHeaders = headers.filter(h => h.level <= depth);
        if (filteredHeaders.length === 0)
            return '';
        // Create nested TOC structure
        const tocTree = this.createNestedStructure(filteredHeaders);
        // Generate HTML
        const tocHtml = this.renderToc(tocTree, {
            style,
            numbering,
            indentGuides
        });
        // Wrap in position container
        return this.wrapToc(tocHtml, position);
    }
    /**
     * Convert flat header array to nested tree structure
     * @param {Array} headers
     * @returns {Array} Nested tree structure
     */
    createNestedStructure(headers) {
        const tree = [];
        const stack = [];
        let currentLevel = 0;
        headers.forEach(header => {
            const node = {
                id: header.id,
                text: header.text,
                level: header.level,
                children: []
            };
            if (header.level > currentLevel) {
                // Descending to a deeper level
                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                }
                stack.push(node);
            }
            else if (header.level === currentLevel) {
                // Same level
                if (stack.length > 0) {
                    stack.pop();
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(node);
                    }
                    else {
                        tree.push(node);
                    }
                    stack.push(node);
                }
                else {
                    tree.push(node);
                }
            }
            else {
                // Ascending to a higher level
                while (stack.length > 0 && header.level <= stack[stack.length - 1].level) {
                    stack.pop();
                }
                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(node);
                }
                else {
                    tree.push(node);
                }
                stack.push(node);
            }
            currentLevel = header.level;
        });
        return tree;
    }
    /**
     * Render TOC HTML from nested tree
     * @param {Array} tree
     * @param {Object} options
     * @param {number} level - Current recursion depth
     * @returns {string} HTML for TOC
     */
    renderToc(tree, options, level = 1) {
        if (!tree || tree.length === 0)
            return '';
        const { style, numbering, indentGuides } = options;
        let html = `<ul class="toc-level-${level} ${indentGuides ? 'toc-indent' : ''}">\n`;
        tree.forEach((node, index) => {
            // Calculate numbering (e.g. 1.2.3)
            let number = '';
            if (numbering) {
                number = this.calculateNumber(node, index, level);
            }
            html += `<li class="toc-item toc-level-${node.level}">`;
            html += `<a href="#${node.id}" class="toc-link">`;
            if (number) {
                html += `<span class="toc-number">${number}</span> `;
            }
            html += node.text;
            html += '</a>';
            // Render children recursively
            if (node.children && node.children.length > 0) {
                html += this.renderToc(node.children, options, level + 1);
            }
            html += '</li>\n';
        });
        html += '</ul>';
        return html;
    }
    /**
     * Calculate numbering for TOC item
     * @param {Object} node
     * @param {number} index
     * @param {number} level
     * @returns {string} Numbering string
     */
    calculateNumber(node, index, level) {
        // In a real implementation, this would track hierarchical numbering
        // For simplicity, we'll return a placeholder
        return `${index + 1}`;
    }
    /**
     * Wrap TOC in position-specific container
     * @param {string} tocHtml
     * @param {string} position
     * @returns {string} Wrapped TOC HTML
     */
    wrapToc(tocHtml, position) {
        const positionClasses = {
            'sticky-left': 'toc-sticky toc-left',
            'sticky-right': 'toc-sticky toc-right',
            'top': 'toc-top',
            'bottom': 'toc-bottom',
            'none': ''
        };
        const positionClass = positionClasses[position] || 'toc-sticky toc-left';
        if (position === 'none')
            return '';
        return `
      <nav class="retro-toc ${positionClass}">
        <div class="toc-header">
          <span class="toc-title">Contents</span>
          <button class="toc-toggle" aria-label="Toggle table of contents">
            <span class="toc-icon"></span>
          </button>
        </div>
        <div class="toc-content">
          ${tocHtml}
        </div>
      </nav>
    `;
    }
    /**
     * Generate TOC CSS based on options
     * @param {Object} options
     * @returns {string} CSS for TOC
     */
    generateTocStyles(options) {
        const { position, style } = options;
        return `
      /* Table of Contents */
      .retro-toc {
        background-color: var(--sidebar-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 1rem;
        font-family: var(--font-body);
        max-height: 80vh;
        overflow-y: auto;
      }
      
      .toc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border-color);
      }
      
      .toc-title {
        font-weight: bold;
        font-family: var(--font-headings);
        font-size: 1.2rem;
      }
      
      .toc-toggle {
        background: none;
        border: none;
        cursor: pointer;
        display: none; /* Visible only on mobile */
      }
      
      .toc-content ul {
        list-style-type: none;
        padding-left: ${options.indentGuides ? '1.5rem' : '0.5rem'};
        margin: 0;
      }
      
      .toc-content li {
        margin-bottom: 0.3rem;
        position: relative;
      }
      
      .toc-content a {
        color: var(--text-color);
        text-decoration: none;
        display: block;
        padding: 0.2rem 0.5rem;
        border-radius: 3px;
        transition: all 0.2s ease;
      }
      
      .toc-content a:hover {
        background-color: rgba(0,0,0,0.05);
        color: var(--link-color);
      }
      
      .toc-number {
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
        display: inline-block;
        min-width: 1.5em;
        margin-right: 0.3rem;
      }
      
      /* Indentation guides */
      .toc-indent li::before {
        content: "";
        position: absolute;
        left: -10px;
        top: 0;
        bottom: 0;
        width: 2px;
        background-color: var(--border-color);
        opacity: 0.5;
      }
      
      /* Sticky positions */
      .toc-sticky {
        position: sticky;
        top: 1rem;
        max-width: 280px;
        z-index: 100;
      }
      
      .toc-left {
        float: left;
        margin-right: 1.5rem;
      }
      
      .toc-right {
        float: right;
        margin-left: 1.5rem;
      }
      
      /* Top position */
      .toc-top {
        width: 100%;
        margin-bottom: 2rem;
      }
      
      /* Bottom position */
      .toc-bottom {
        width: 100%;
        margin-top: 2rem;
      }
      
      /* Style variants */
      .toc-style-classic .toc-content a {
        border-left: 3px solid var(--primary-color);
        padding-left: 0.8rem;
      }
      
      .toc-style-modern .toc-content a {
        padding: 0.3rem 0.5rem;
      }
      
      .toc-style-minimal .toc-content a {
        font-size: 0.9rem;
        padding: 0.1rem 0.3rem;
      }
      
      /* Responsive behavior */
      @media (max-width: 768px) {
        .toc-sticky {
          position: relative;
          float: none;
          max-width: 100%;
          margin: 1rem 0;
        }
        
        .toc-toggle {
          display: block;
        }
        
        .toc-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }
        
        .toc-expanded .toc-content {
          max-height: 500px;
        }
      }
    `;
    }
    /**
     * Generate JavaScript for TOC interactivity
     * @returns {string} JavaScript code
     */
    generateTocScript() {
        return `
      document.addEventListener('DOMContentLoaded', () => {
        // Mobile toggle functionality
        const tocToggles = document.querySelectorAll('.toc-toggle');
        tocToggles.forEach(toggle => {
          toggle.addEventListener('click', () => {
            const toc = toggle.closest('.retro-toc');
            toc.classList.toggle('toc-expanded');
          });
        });
        
        // Smooth scrolling with offset for fixed header
        const tocLinks = document.querySelectorAll('.toc-content a');
        tocLinks.forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
              const headerHeight = document.querySelector('header')?.offsetHeight || 70;
              const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
              
              window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
              });
              
              // Update URL without jumping
              history.pushState(null, null, targetId);
            }
          });
        });
        
        // Highlight current section in TOC
        const observerOptions = {
          root: null,
          rootMargin: '0px',
          threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const tocLink = document.querySelector(\`.toc-content a[href="#\${id}"]\`);
            
            if (tocLink) {
              if (entry.isIntersecting) {
                tocLink.classList.add('toc-active');
              } else {
                tocLink.classList.remove('toc-active');
              }
            }
          });
        }, observerOptions);
        
        // Observe all headers with IDs
        document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
          .forEach(header => {
            observer.observe(header);
          });
      });
    `;
    }
}
module.exports = new TocGenerator();
