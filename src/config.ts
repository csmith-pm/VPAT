import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { VpatConfig } from './types.js';

const configSchema = z.object({
  product: z.string().min(1),
  reportDate: z.string().min(1),
  templatePath: z.string().min(1),
  outputPath: z.string().min(1),
  productSectionIndex: z.number().int().min(0),
  urls: z.array(z.string().url()).min(1),
  scanOptions: z.object({
    concurrency: z.number().int().min(1).max(10).default(3),
    timeout: z.number().int().min(5000).default(60000),
    waitForSelector: z.string().default('body'),
  }).default({}),
  carryForwardPath: z.string().nullable().default(null),
});

export function loadConfig(configPath: string): VpatConfig {
  const absolutePath = resolve(configPath);
  const raw = readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return configSchema.parse(parsed);
}
