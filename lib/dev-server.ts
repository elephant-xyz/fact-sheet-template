import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { createServer } from 'http';
import open from 'open';
import { Builder } from './builder.js';
import { Logger } from './logger.js';
import { BuilderOptions } from '../types/property.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DevServerOptions extends BuilderOptions {
  port?: number;
  open?: boolean;
  reload?: boolean;
}

export class DevServer {
  private options: DevServerOptions;
  private logger: Logger;
  private builder: Builder;
  private watcher?: chokidar.FSWatcher;
  private server?: ReturnType<typeof createServer>;
  private wss?: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private isBuilding = false;
  private buildQueue: string[] = [];

  constructor(options: DevServerOptions) {
    this.options = {
      ...options,
      port: options.port || 3000,
      reload: options.reload !== false,
      // Use local paths in dev mode
      domain: `http://localhost:${options.port || 3000}`
    };
    
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: false,
      logFile: false // No log file in dev mode
    });
    
    this.builder = new Builder({
      ...this.options,
      dev: true // Add dev flag
    });
  }

  async start(): Promise<void> {
    this.logger.section('Development Server');
    this.logger.info(`Starting development server...`);
    
    try {
      // Initial build
      await this.initialBuild();
      
      // Start HTTP server
      await this.startHttpServer();
      
      // Start WebSocket server for live reload
      if (this.options.reload) {
        this.startWebSocketServer();
      }
      
      // Start file watcher
      this.startFileWatcher();
      
      // Open browser if requested
      if (this.options.open) {
        const url = `http://localhost:${this.options.port || 3000}`;
        this.logger.info(`Opening browser at ${url}`);
        await open(url);
      }
      
      this.logger.success(`Development server ready!`);
      this.logger.info(`Server: http://localhost:${this.options.port || 3000}`);
      if (this.options.reload) {
        this.logger.info(`WebSocket: ws://localhost:${(this.options.port || 3000) + 1}`);
      }
      this.logger.info(`Watching for changes...`);
      
    } catch (error) {
      this.logger.error(`Failed to start dev server: ${(error as Error).message}`);
      throw error;
    }
  }

  private async initialBuild(): Promise<void> {
    this.logger.info('Running initial build...');
    const startTime = Date.now();
    
    try {
      await this.builder.build();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.success(`Initial build complete (${duration}s)`);
    } catch (error) {
      this.logger.error(`Initial build failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private async startHttpServer(): Promise<void> {
    const app = express();
    
    // Serve static files from output directory
    app.use(express.static(this.options.output));
    
    // Inject live reload script in development
    if (this.options.reload) {
      const wsPort = (this.options.port || 3000) + 1;
      app.use((req, res, next) => {
        if (req.path.endsWith('.html') || req.path === '/') {
          const originalSend = res.send;
          res.send = function(data: any) {
            if (typeof data === 'string' && data.includes('</body>')) {
              data = data.replace('</body>', `
                <script>
                  (function() {
                    const ws = new WebSocket('ws://localhost:${wsPort}');
                    ws.onmessage = function(event) {
                      if (event.data === 'reload') {
                        console.log('Reloading page...');
                        window.location.reload();
                      }
                    };
                    ws.onclose = function() {
                      console.log('Lost connection to dev server. Retrying...');
                      setTimeout(() => window.location.reload(), 2000);
                    };
                  })();
                </script>
                </body>`);
            }
            return originalSend.call(this, data);
          };
        }
        next();
      });
    }
    
    // Serve property pages
    app.get('/homes/:propertyId', (req, res) => {
      const propertyPath = path.join(this.options.output, req.params.propertyId, 'index.html');
      if (fs.existsSync(propertyPath)) {
        res.locals.wsPort = (this.options.port || 3000) + 1;
        res.sendFile(propertyPath);
      } else {
        res.status(404).send('Property not found');
      }
    });
    
    // Error handling
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error(`Server error: ${err.message}`);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Build Error</h1>
            <pre>${err.stack || err.message}</pre>
          </body>
        </html>
      `);
    });
    
    this.server = createServer(app);
    
    return new Promise((resolve, reject) => {
      this.server!.listen(this.options.port || 3000, () => {
        resolve();
      }).on('error', reject);
    });
  }

  private startWebSocketServer(): void {
    this.wss = new WebSocketServer({ port: (this.options.port || 3000) + 1 });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.logger.debug('WebSocket client connected');
      
      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger.debug('WebSocket client disconnected');
      });
    });
  }

  private startFileWatcher(): void {
    const watchPaths = [
      path.join(__dirname, '..', '..', 'templates'),
      this.options.input
    ];
    
    this.watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher
      .on('change', (filePath) => this.handleFileChange(filePath, 'changed'))
      .on('add', (filePath) => this.handleFileChange(filePath, 'added'))
      .on('unlink', (filePath) => this.handleFileChange(filePath, 'removed'));
  }

  private async handleFileChange(filePath: string, event: string): Promise<void> {
    const relativePath = path.relative(process.cwd(), filePath);
    this.logger.info(`File ${event}: ${relativePath}`);
    
    // Queue the change
    this.buildQueue.push(filePath);
    
    // Debounce builds
    if (!this.isBuilding) {
      setTimeout(() => this.processBuildQueue(), 100);
    }
  }

  private async processBuildQueue(): Promise<void> {
    if (this.isBuilding || this.buildQueue.length === 0) return;
    
    this.isBuilding = true;
    const files = [...this.buildQueue];
    this.buildQueue = [];
    
    try {
      const startTime = Date.now();
      
      // Determine what needs to be rebuilt
      const needsFullRebuild = files.some(f => 
        f.includes('templates') && !f.includes('assets')
      );
      
      if (needsFullRebuild) {
        this.logger.info('Template change detected, rebuilding all properties...');
        await this.builder.build();
      } else {
        // Smart rebuild for data changes
        const changedProperties = this.getAffectedProperties(files);
        if (changedProperties.length > 0) {
          this.logger.info(`Rebuilding ${changedProperties.length} properties...`);
          for (const propertyId of changedProperties) {
            await this.rebuildProperty(propertyId);
          }
        }
        
        // Copy changed assets
        const changedAssets = files.filter(f => f.includes('assets'));
        if (changedAssets.length > 0) {
          await this.copyChangedAssets(changedAssets);
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.success(`Rebuild complete (${duration}s)`);
      
      // Reload browsers
      if (this.options.reload) {
        this.reloadBrowsers();
      }
      
    } catch (error) {
      this.logger.error(`Build failed: ${(error as Error).message}`);
      // Still reload to show error
      if (this.options.reload) {
        this.reloadBrowsers();
      }
    } finally {
      this.isBuilding = false;
      
      // Process any queued changes
      if (this.buildQueue.length > 0) {
        setTimeout(() => this.processBuildQueue(), 100);
      }
    }
  }

  private getAffectedProperties(files: string[]): string[] {
    const properties = new Set<string>();
    
    for (const file of files) {
      if (file.includes(this.options.input)) {
        // Extract property ID from path
        const relativePath = path.relative(this.options.input, file);
        const parts = relativePath.split(path.sep);
        if (parts.length > 0 && parts[0]) {
          properties.add(parts[0]);
        }
      }
    }
    
    return Array.from(properties);
  }

  private async rebuildProperty(propertyId: string): Promise<void> {
    this.logger.debug(`Rebuilding property: ${propertyId}`);
    
    // Load the specific property data
    const dataLoader = (this.builder as any).dataLoader;
    const properties = await dataLoader.loadPropertyData(this.options.input);
    
    if (properties[propertyId]) {
      await this.builder.buildProperty(propertyId, properties[propertyId]);
    } else {
      this.logger.warn(`Property ${propertyId} not found`);
    }
  }

  private async copyChangedAssets(assetFiles: string[]): Promise<void> {
    this.logger.debug('Copying changed assets...');
    
    for (const file of assetFiles) {
      const relativePath = path.relative(path.join(__dirname, '..', '..', 'templates', 'assets'), file);
      const targetPath = path.join(this.options.output, relativePath);
      
      await fs.ensureDir(path.dirname(targetPath));
      await fs.copy(file, targetPath);
      
      this.logger.debug(`Copied: ${relativePath}`);
    }
  }

  private reloadBrowsers(): void {
    this.logger.debug('Reloading browsers...');
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('reload');
      }
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping development server...');
    
    if (this.watcher) {
      await this.watcher.close();
    }
    
    if (this.wss) {
      this.clients.forEach(client => client.close());
      this.wss.close();
    }
    
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve());
      });
    }
  }
}