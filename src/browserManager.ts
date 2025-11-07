/**
 * Browser Session Manager with automatic cleanup
 * Manages Puppeteer browser instances with proper lifecycle management
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { Browser, Page, LaunchOptions } from 'puppeteer';

// Use dynamic import for puppeteer-extra to avoid issues if not installed
let puppeteerExtra: any;
let StealthPlugin: any;

const SESSION_DIR = path.join(__dirname, '../data/sessions');
const MAX_IDLE_TIME = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

interface BrowserSession {
  browser: Browser;
  pages: Set<Page>;
  lastActivity: number;
  headless: boolean;
  sessionId: string;
}

export class BrowserManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    this.startCleanupTimer();
    this.ensureSessionDir();
  }

  /**
   * Initialize puppeteer-extra with stealth plugin
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      puppeteerExtra = require('puppeteer-extra');
      StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteerExtra.use(StealthPlugin());
      this.initialized = true;
      console.log('Browser manager initialized with stealth plugin');
    } catch (error) {
      console.error('Failed to initialize puppeteer-extra:', error);
      throw new Error('Puppeteer not installed. Run: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth');
    }
  }

  private ensureSessionDir(): void {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
  }

  /**
   * Get or create a browser session
   * @param sessionId - Unique identifier for the session
   * @param headless - Whether to run in headless mode
   */
  async getSession(sessionId: string, headless: boolean = true): Promise<Browser> {
    await this.initialize();

    let session = this.sessions.get(sessionId);

    if (session && !session.browser.isConnected()) {
      // Browser was closed, remove it
      this.sessions.delete(sessionId);
      session = undefined;
    }

    if (!session) {
      const browser = await this.launchBrowser(sessionId, headless);
      session = {
        browser,
        pages: new Set(),
        lastActivity: Date.now(),
        headless,
        sessionId
      };
      this.sessions.set(sessionId, session);
      console.log(`Created new browser session: ${sessionId} (headless: ${headless})`);
    }

    session.lastActivity = Date.now();
    return session.browser;
  }

  /**
   * Launch a new browser instance
   */
  private async launchBrowser(sessionId: string, headless: boolean): Promise<Browser> {
    const userDataDir = path.join(SESSION_DIR, sessionId);

    const options: LaunchOptions = {
      headless: headless ? 'new' : false,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };

    // If not headless, show a proper window
    if (!headless) {
      options.args?.push('--start-maximized');
      options.defaultViewport = null;
    }

    const browser = await puppeteerExtra.launch(options);

    // Handle browser disconnect
    browser.on('disconnected', () => {
      console.log(`Browser session ${sessionId} disconnected`);
      this.sessions.delete(sessionId);
    });

    return browser;
  }

  /**
   * Create a new page in a session
   */
  async createPage(sessionId: string, headless: boolean = true): Promise<Page> {
    const browser = await this.getSession(sessionId, headless);
    const page = await browser.newPage();

    const session = this.sessions.get(sessionId);
    if (session) {
      session.pages.add(page);
      session.lastActivity = Date.now();

      // Remove page from set when closed
      page.on('close', () => {
        session.pages.delete(page);
      });
    }

    // Set reasonable defaults
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    return page;
  }

  /**
   * Close a specific session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`Closing browser session: ${sessionId}`);

    // Close all pages
    for (const page of session.pages) {
      try {
        await page.close();
      } catch (error) {
        console.error(`Error closing page in session ${sessionId}:`, error);
      }
    }

    // Close browser
    try {
      await session.browser.close();
    } catch (error) {
      console.error(`Error closing browser session ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    console.log(`Closing all ${this.sessions.size} browser sessions`);
    const closePromises = Array.from(this.sessions.keys()).map(id => this.closeSession(id));
    await Promise.all(closePromises);
  }

  /**
   * Check if a session has cached cookies (is logged in)
   */
  async isSessionAuthenticated(sessionId: string, domain: string): Promise<boolean> {
    try {
      const browser = await this.getSession(sessionId, true);
      const pages = await browser.pages();

      if (pages.length === 0) return false;

      const page = pages[0];
      const cookies = await page.cookies();

      return cookies.some(cookie =>
        cookie.domain.includes(domain) &&
        (cookie.name.includes('session') || cookie.name.includes('auth'))
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Save session cookies
   */
  async saveSessionCookies(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const pages = await session.browser.pages();
      if (pages.length === 0) return;

      const cookies = await pages[0].cookies();
      const cookiesFile = path.join(SESSION_DIR, sessionId, 'cookies.json');
      await fs.writeJson(cookiesFile, cookies, { spaces: 2 });
      console.log(`Saved cookies for session ${sessionId}`);
    } catch (error) {
      console.error(`Error saving cookies for session ${sessionId}:`, error);
    }
  }

  /**
   * Load session cookies
   */
  async loadSessionCookies(sessionId: string, page: Page): Promise<void> {
    try {
      const cookiesFile = path.join(SESSION_DIR, sessionId, 'cookies.json');
      if (!fs.existsSync(cookiesFile)) return;

      const cookies = await fs.readJson(cookiesFile);
      await page.setCookie(...cookies);
      console.log(`Loaded cookies for session ${sessionId}`);
    } catch (error) {
      console.error(`Error loading cookies for session ${sessionId}:`, error);
    }
  }

  /**
   * Cleanup idle sessions
   */
  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivity;

      if (idleTime > MAX_IDLE_TIME) {
        console.log(`Session ${sessionId} idle for ${Math.round(idleTime / 1000)}s, closing...`);
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, CLEANUP_INTERVAL);

    console.log('Browser cleanup timer started');
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('Browser cleanup timer stopped');
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    totalPages: number;
    sessions: Array<{ id: string; pages: number; idleTime: number; headless: boolean }>;
  } {
    const now = Date.now();
    const sessions = Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      pages: session.pages.size,
      idleTime: Math.round((now - session.lastActivity) / 1000),
      headless: session.headless
    }));

    return {
      activeSessions: this.sessions.size,
      totalPages: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.pages.size, 0),
      sessions
    };
  }

  /**
   * Shutdown manager and cleanup all resources
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down browser manager...');
    this.stopCleanupTimer();
    await this.closeAll();
  }
}

// Singleton instance
export const browserManager = new BrowserManager();

// Cleanup on process exit
process.on('exit', () => {
  browserManager.shutdown();
});

process.on('SIGINT', async () => {
  await browserManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserManager.shutdown();
  process.exit(0);
});
