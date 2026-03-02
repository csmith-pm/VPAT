import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `vpat-config-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeConfig = (config: Record<string, unknown>): string => {
    const path = join(tmpDir, 'vpat.config.json');
    writeFileSync(path, JSON.stringify(config));
    return path;
  };

  const validConfig = {
    product: 'TestProduct',
    reportDate: '2025-01-01',
    templatePath: './template.docx',
    outputPath: './output.docx',
    productSectionIndex: 0,
    urls: ['https://example.com'],
  };

  it('loads a valid config successfully', () => {
    const path = writeConfig(validConfig);
    const config = loadConfig(path);
    expect(config.product).toBe('TestProduct');
    expect(config.reportDate).toBe('2025-01-01');
    expect(config.urls).toEqual(['https://example.com']);
  });

  it('applies default scanOptions', () => {
    const path = writeConfig(validConfig);
    const config = loadConfig(path);
    expect(config.scanOptions.concurrency).toBe(3);
    expect(config.scanOptions.timeout).toBe(60000);
    expect(config.scanOptions.waitForSelector).toBe('body');
  });

  it('applies default carryForwardPath as null', () => {
    const path = writeConfig(validConfig);
    const config = loadConfig(path);
    expect(config.carryForwardPath).toBeNull();
  });

  it('respects explicit scanOptions', () => {
    const path = writeConfig({
      ...validConfig,
      scanOptions: { concurrency: 5, timeout: 30000, waitForSelector: '#app' },
    });
    const config = loadConfig(path);
    expect(config.scanOptions.concurrency).toBe(5);
    expect(config.scanOptions.timeout).toBe(30000);
    expect(config.scanOptions.waitForSelector).toBe('#app');
  });

  it('throws on missing required field (product)', () => {
    const { product, ...withoutProduct } = validConfig;
    const path = writeConfig(withoutProduct);
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on missing required field (urls)', () => {
    const { urls, ...withoutUrls } = validConfig;
    const path = writeConfig(withoutUrls);
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on empty urls array', () => {
    const path = writeConfig({ ...validConfig, urls: [] });
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on invalid URL in urls array', () => {
    const path = writeConfig({ ...validConfig, urls: ['not-a-url'] });
    expect(() => loadConfig(path)).toThrow();
  });

  it('throws on non-existent config file', () => {
    expect(() => loadConfig('/nonexistent/path/config.json')).toThrow();
  });
});
