import { minify as htmlMinify } from 'html-minifier-terser';
import { minify as terserMinify } from 'terser';
import postcss from 'postcss';
import cssnano from 'cssnano';
import { Logger } from './logger.js';

export class Minifier {
  private logger: Logger;
  private enabled: boolean;

  constructor(enabled: boolean, logger: Logger) {
    this.enabled = enabled;
    this.logger = logger;
  }

  /**
   * Minify HTML with optimal settings for production
   */
  async minifyHTML(html: string): Promise<string> {
    if (!this.enabled) return html;

    try {
      const startTime = Date.now();
      const originalSize = Buffer.byteLength(html, 'utf8');

      const minified = await htmlMinify(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyCSS: true,
        minifyJS: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        removeRedundantAttributes: true,
        collapseBooleanAttributes: true,
        html5: true,
        decodeEntities: true,
        // Preserve Nunjucks and other template syntax
        ignoreCustomFragments: [
          /<%[\s\S]*?%>/,
          /<\?[\s\S]*?\?>/,
          /{{[\s\S]*?}}/,
          /{%[\s\S]*?%}/
        ]
      });

      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
      const duration = Date.now() - startTime;

      this.logger.debug(
        `HTML minified: ${originalSize} → ${minifiedSize} bytes (${reduction}% reduction) in ${duration}ms`
      );

      return minified;
    } catch (error) {
      this.logger.error(`HTML minification failed: ${(error as Error).message}`);
      return html;
    }
  }

  /**
   * Minify CSS with optimal settings for production
   */
  async minifyCSS(css: string, from?: string): Promise<string> {
    if (!this.enabled) return css;

    try {
      const startTime = Date.now();
      const originalSize = Buffer.byteLength(css, 'utf8');

      const result = await postcss([
        cssnano({
          preset: 'default'
        })
      ]).process(css, {
        from: from || 'input.css'
      });

      const minifiedSize = Buffer.byteLength(result.css, 'utf8');
      const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
      const duration = Date.now() - startTime;

      this.logger.debug(
        `CSS minified: ${originalSize} → ${minifiedSize} bytes (${reduction}% reduction) in ${duration}ms`
      );

      return result.css;
    } catch (error) {
      this.logger.error(`CSS minification failed: ${(error as Error).message}`);
      return css;
    }
  }

  /**
   * Minify JavaScript with optimal settings for production
   */
  async minifyJS(js: string, filename?: string): Promise<string> {
    if (!this.enabled) return js;

    try {
      const startTime = Date.now();
      const originalSize = Buffer.byteLength(js, 'utf8');

      const result = await terserMinify(js, {
        compress: {
          drop_console: false, // Keep console logs for debugging
          drop_debugger: true,
          passes: 2
        },
        mangle: true,
        format: {
          comments: false
        }
      });

      if (result.code) {
        const minifiedSize = Buffer.byteLength(result.code, 'utf8');
        const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
        const duration = Date.now() - startTime;

        this.logger.debug(
          `JS minified${filename ? ` (${filename})` : ''}: ${originalSize} → ${minifiedSize} bytes (${reduction}% reduction) in ${duration}ms`
        );

        return result.code;
      }

      return js;
    } catch (error) {
      this.logger.error(`JS minification failed: ${(error as Error).message}`);
      return js;
    }
  }
}