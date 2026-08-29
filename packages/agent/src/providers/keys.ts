export function getApiKeys(envVar: string): string[] {
  const value = process.env[envVar] || "";
  return value
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export function getRandomKey(keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;
  return keys[Math.floor(Math.random() * keys.length)];
}
