/**
 * 浏览器连接器模块
 * @module main/browserConnector
 *
 * 使用 Playwright 的 connectOverCDP 功能连接到用户已有的浏览器实例
 * 复用用户的登录会话，避免重复登录
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * 浏览器连接器类
 * 负责检测、启动和连接到用户的 Chrome/Edge 浏览器
 */
export class BrowserConnector {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private debuggingPort: number = 9222;
  private userDataDir: string;

  constructor() {
    // 使用应用数据目录下的独立用户数据目录
    this.userDataDir = join(app.getPath('userData'), 'BrowserProfile');
  }

  /**
   * 查找浏览器可执行文件路径
   * 优先查找 Edge，然后是 Chrome
   */
  async findBrowserPath(): Promise<string | null> {
    // Windows 常见路径
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    // 尝试使用 where 命令查找 Edge
    try {
      const { stdout } = await execAsync('where msedge.exe');
      const path = stdout.trim().split('\n')[0];
      if (path) return path;
    } catch {
      // 回退到常见路径
    }

    // 尝试使用 where 命令查找 Chrome
    try {
      const { stdout } = await execAsync('where chrome.exe');
      const path = stdout.trim().split('\n')[0];
      if (path) return path;
    } catch {
      // 回退到常见路径
    }

    // 检查常见路径
    for (const path of [...edgePaths, ...chromePaths]) {
      try {
        await fs.access(path);
        return path;
      } catch {
        // 路径不存在，继续检查下一个
      }
    }

    return null;
  }

  /**
   * 检查调试端口是否已激活
   */
  async isDebuggingPortActive(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.debuggingPort}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 查找已运行的浏览器进程
   */
  private async findRunningBrowserPort(): Promise<number | null> {
    // 检查常见的调试端口
    const ports = [9222, 9223, 9224, 9225, 9333];

    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}/json/version`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          return port;
        }
      } catch {
        // 端口未激活，继续检查下一个
      }
    }

    return null;
  }

  /**
   * 启动浏览器并启用远程调试
   */
  async launchBrowserWithDebugging(): Promise<void> {
    // 首先检查是否已有浏览器在调试模式下运行
    const existingPort = await this.findRunningBrowserPort();
    if (existingPort) {
      console.log(`[BrowserConnector] 发现已有浏览器在调试端口 ${existingPort} 运行`);
      this.debuggingPort = existingPort;
      return;
    }

    const browserPath = await this.findBrowserPath();
    if (!browserPath) {
      throw new Error('未找到 Chrome 或 Edge 浏览器，请确保浏览器已安装');
    }

    console.log(`[BrowserConnector] 使用浏览器: ${browserPath}`);
    console.log(`[BrowserConnector] 用户数据目录: ${this.userDataDir}`);

    // 确保用户数据目录存在
    try {
      await fs.mkdir(this.userDataDir, { recursive: true });
    } catch {
      // 目录可能已存在
    }

    // 构建启动参数
    const args = [
      `--remote-debugging-port=${this.debuggingPort}`,
      `--user-data-dir=${this.userDataDir}`,
      '--remote-allow-origins=*',
      '--no-first-run',
      '--no-default-browser-check',
    ];

    console.log(`[BrowserConnector] 启动浏览器: ${browserPath}`);
    console.log(`[BrowserConnector] 启动参数: ${args.join(' ')}`);

    // 启动浏览器（分离进程）
    const child = spawn(browserPath, args, {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
    });

    child.on('error', (error) => {
      console.error('[BrowserConnector] 启动浏览器失败:', error);
    });

    // 忽略子进程的关闭，因为我们希望它独立运行
    child.unref();

    // 等待浏览器启动并激活调试端口
    let attempts = 0;
    const maxAttempts = 30; // 最多等待30秒

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (await this.isDebuggingPortActive()) {
        console.log('[BrowserConnector] 浏览器启动成功，调试端口已激活');
        return;
      }

      attempts++;
      console.log(`[BrowserConnector] 等待浏览器启动... (${attempts}/${maxAttempts})`);
    }

    throw new Error('浏览器启动超时，请检查浏览器是否已正确安装');
  }

  /**
   * 连接到浏览器
   * 如果浏览器未运行，会自动启动
   */
  async connect(): Promise<Page> {
    // 如果已经连接，直接返回现有页面
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    // 确保浏览器已启动
    await this.launchBrowserWithDebugging();

    // 通过 CDP 连接
    console.log(`[BrowserConnector] 连接到浏览器: http://localhost:${this.debuggingPort}`);
    this.browser = await chromium.connectOverCDP(`http://localhost:${this.debuggingPort}`);

    // 获取或创建上下文
    const contexts = this.browser.contexts();
    console.log(`[BrowserConnector] 可用上下文数量: ${contexts.length}`);

    this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

    // 获取或创建页面
    const pages = this.context.pages();
    console.log(`[BrowserConnector] 可用页面数量: ${pages.length}`);

    if (pages.length > 0) {
      // 策略：优先选择当前活动的页面（前台标签页）
      // 如果找不到活动页面，则创建新页面以确保我们在前台操作
      let activePage: Page | null = null;

      for (const p of pages) {
        try {
          // 检查页面是否在前台（可见）
          const isVisible = await p.evaluate(() => document.visibilityState === 'visible').catch(() => false);
          if (isVisible) {
            activePage = p;
            console.log(`[BrowserConnector] 找到活动页面: ${await p.title().catch(() => 'unknown')}`);
            break;
          }
        } catch {
          // 页面可能已关闭，忽略错误
        }
      }

      if (activePage) {
        this.page = activePage;
      } else {
        // 没有活动页面，创建一个新页面
        // 这样可以确保我们在前台操作，而不是在后台标签页
        console.log('[BrowserConnector] 未找到活动页面，创建新页面');
        this.page = await this.context.newPage();
      }
    } else {
      console.log('[BrowserConnector] 没有可用页面，创建新页面');
      this.page = await this.context.newPage();
    }

    // 设置视口大小
    await this.page.setViewportSize({ width: 1200, height: 800 });

    return this.page;
  }

  /**
   * 获取当前页面
   * 如果未连接，会抛出错误
   */
  getPage(): Page {
    if (!this.page || this.page.isClosed()) {
      throw new Error('浏览器未连接，请先调用 connect()');
    }
    return this.page;
  }

  /**
   * 获取当前上下文
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('浏览器未连接，请先调用 connect()');
    }
    return this.context;
  }

  /**
   * 断开连接（保持浏览器运行）
   * 这会断开与浏览器的连接，但不会关闭浏览器
   */
  async disconnect(): Promise<void> {
    console.log('[BrowserConnector] 断开连接');

    // 关闭页面引用（但不关闭实际页面）
    if (this.page) {
      this.page = null;
    }

    // 关闭上下文引用（但不关闭实际上下文）
    if (this.context) {
      this.context = null;
    }

    // 断开浏览器连接（保持浏览器运行）
    // 注意：通过 CDP 连接的浏览器，close() 会关闭浏览器
    // 所以我们只清理引用，不调用 close()
    if (this.browser) {
      // 不要调用 this.browser.close()，这会关闭浏览器
      // 也不要调用 this.browser.disconnect()，这个方法不存在
      // 只需清理引用，让浏览器继续运行
      this.browser = null;
    }
  }

  /**
   * 关闭浏览器
   * 这会完全关闭浏览器进程
   */
  async close(): Promise<void> {
    console.log('[BrowserConnector] 关闭浏览器');

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * 检查浏览器是否已连接
   */
  isConnected(): boolean {
    return this.browser !== null && this.page !== null && !this.page.isClosed();
  }
}

// 导出单例实例
export const browserConnector = new BrowserConnector();
