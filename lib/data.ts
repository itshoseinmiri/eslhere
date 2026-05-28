import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(name: string) {
  return join(DATA_DIR, name);
}

export function readJsonFile<T>(filename: string, fallback: T): T {
  ensureDataDir();
  const filePath = getFilePath(filename);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filename: string, data: unknown) {
  ensureDataDir();
  const filePath = getFilePath(filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
