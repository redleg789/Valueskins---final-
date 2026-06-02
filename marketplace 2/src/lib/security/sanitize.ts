const DANGEROUS_PATTERNS = {
  htmlTags: /<[^>]*>/gi,
  scriptInjection: /<script[^>]*>.*?<\/script>/gis,
  scriptSelfClosing: /<script[^>]*\/?>/gi,
  eventHandlers: /\bon\w+\s*=\s*["']?[^"'>]*/gi,
  javascriptProtocol: /javascript\s*:/gi,
  dataUrls: /data\s*:/gi,
  vbscriptProtocol: /vbscript\s*:/gi,
  urlWithExecutables: /https?:\/\/[^\s]*(\bexec\b|\beval\b|\balert\b)/gi,
  sqlInjectionPatterns: [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b|\bEXEC\b|\bEXECUTE\b)/gi,
    /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?|\bAND\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/gi,
    /(--|;|\/\*|\*\/|@@|char\(|exec\(|execute\(|executescalar\(|sp_executesql)/gi,
    /(\bor\b\s+['"][^'"]*['"]?\s*=\s*['"][^'"]*['"]?)/gi,
  ],
  pathTraversal: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c|%252e%252e%252f|%252e%252e%5c)/gi,
  commandInjection: /[;&|`$\\<>]/gi,
  newlines: /\r?\n|\r/gi,
  multipleNewlines: /\n{3,}|\r{3,}/gi,
};

interface SanitizeOptions {
  allowBasicFormatting?: boolean;
  maxLength?: number;
  stripHtml?: boolean;
  preventSqlInjection?: boolean;
  preventXss?: boolean;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  allowBasicFormatting: false,
  maxLength: 10000,
  stripHtml: true,
  preventSqlInjection: true,
  preventXss: true,
};

export function sanitizeHtml(html: string, options: Partial<SanitizeOptions> = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let sanitized = html;
  
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  sanitized = sanitized.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  sanitized = sanitized.replace(/\//g, '&#x2F;');
  
  if (opts.stripHtml) {
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.scriptInjection, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.scriptSelfClosing, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.htmlTags, '');
  }
  
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.eventHandlers, '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.javascriptProtocol, '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.dataUrls, '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.vbscriptProtocol, '');
  
  if (opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
  }
  
  return sanitized.trim();
}

export function sanitizeText(text: string, options: Partial<SanitizeOptions> = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let sanitized = text;
  
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.scriptInjection, '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.scriptSelfClosing, '');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.htmlTags, '');
  
  if (opts.preventXss) {
    sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.eventHandlers, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.javascriptProtocol, '');
    sanitized = sanitized.replace(DANGEROUS_PATTERNS.dataUrls, '');
  }
  
  if (opts.preventSqlInjection) {
    for (const pattern of DANGEROUS_PATTERNS.sqlInjectionPatterns) {
      sanitized = sanitized.replace(pattern, ' ');
    }
    sanitized = sanitized.replace(/'/g, "''").replace(/\\/g, '\\\\');
    sanitized = sanitized.replace(/--/g, '  ').replace(/\/\*/g, ' ').replace(/\*\//g, ' ');
    sanitized = sanitized.replace(/;/g, '');
  }
  
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.newlines, ' ');
  sanitized = sanitized.replace(DANGEROUS_PATTERNS.multipleNewlines, '\n\n');
  
  if (opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
  }
  
  return sanitized.trim();
}

export function sanitizeUrl(url: string): string {
  let sanitized = url.trim().toLowerCase();
  
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.aws',
  ];
  
  const blockedPatterns = [
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /localhost/i,
  ];
  
  try {
    const urlObj = new URL(sanitized);
    
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return '';
    }
    
    if (blockedHosts.includes(urlObj.hostname)) {
      return '';
    }
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(urlObj.hostname)) {
        return '';
      }
    }
    
    if (urlObj.hostname === 'localhost' || urlObj.hostname.endsWith('.local')) {
      return '';
    }
    
    return sanitized;
  } catch {
    return '';
  }
}

export function sanitizeFilename(filename: string): string {
  let sanitized = filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\0/g, '')
    .trim();
  
  sanitized = sanitized.substring(0, 255);
  
  if (!sanitized || sanitized === '.') {
    sanitized = 'file';
  }
  
  return sanitized;
}

export function sanitizeEmail(email: string): string {
  const cleaned = email
    .replace(DANGEROUS_PATTERNS.newlines, '')
    .replace(DANGEROUS_PATTERNS.sqlInjectionPatterns[2], '')
    .trim()
    .toLowerCase();
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return '';
  }
  
  const maxEmailLength = 254;
  if (cleaned.length > maxEmailLength) {
    return '';
  }
  
  return cleaned;
}

export function detectMaliciousInput(input: string): { isMalicious: boolean; threatType: string | null; details: string } {
  const testInput = input.toLowerCase();
  
  if (/<script[^>]*>.*?<\/script>/gis.test(input) || /<script[^>]*\/?>/gi.test(input)) {
    return { isMalicious: true, threatType: 'XSS', details: 'Script tags detected' };
  }
  
  if (DANGEROUS_PATTERNS.eventHandlers.test(input)) {
    return { isMalicious: true, threatType: 'XSS', details: 'Event handlers detected' };
  }
  
  if (DANGEROUS_PATTERNS.javascriptProtocol.test(input)) {
    return { isMalicious: true, threatType: 'XSS', details: 'JavaScript protocol detected' };
  }
  
  if (DANGEROUS_PATTERNS.dataUrls.test(input)) {
    return { isMalicious: true, threatType: 'XSS', details: 'Data URL detected' };
  }
  
  for (const pattern of DANGEROUS_PATTERNS.sqlInjectionPatterns) {
    if (pattern.test(input)) {
      return { isMalicious: true, threatType: 'SQL_INJECTION', details: 'SQL pattern detected' };
    }
  }
  
  if (DANGEROUS_PATTERNS.pathTraversal.test(input)) {
    return { isMalicious: true, threatType: 'PATH_TRAVERSAL', details: 'Path traversal detected' };
  }
  
  if (/[;&|`$<>\\]/.test(input)) {
    return { isMalicious: true, threatType: 'COMMAND_INJECTION', details: 'Command injection characters detected' };
  }
  
  if (DANGEROUS_PATTERNS.newlines.test(input)) {
    return { isMalicious: true, threatType: 'HEADER_INJECTION', details: 'Newline characters detected' };
  }
  
  return { isMalicious: false, threatType: null, details: '' };
}

export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToSanitize: string[],
  sanitizer: (value: unknown) => string
): T {
  const sanitized = { ...obj };
  
  for (const field of fieldsToSanitize) {
    if (field in sanitized) {
      (sanitized as Record<string, unknown>)[field] = sanitizer(sanitized[field]);
    }
  }
  
  return sanitized;
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripAllHtml(html: string): string {
  let sanitized = html;
  
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
  sanitized = sanitized.replace(/<script[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  sanitized = sanitized.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  sanitized = sanitized.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#039;/g, "'");
  sanitized = sanitized.replace(/&amp;/g, '&');
  
  sanitized = sanitized.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  sanitized = sanitized.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  sanitized = sanitized.replace(/\0/g, '');
  
  return sanitized.trim();
}

export function isReDoSResistant(pattern: RegExp, testString: string, timeoutMs: number = 100): boolean {
  const start = Date.now();
  try {
    const result = pattern.test(testString);
    const elapsed = Date.now() - start;
    return elapsed < timeoutMs;
  } catch {
    return true;
  }
}

export function safeRegex(pattern: string): RegExp | null {
  const dangerousPatterns = [
    /(\.\*)\+/,
    /(\+)\.\*/,
    /(\.\*)\*/,
    /(\*)\.\*/,
    /\(\.\*\)\{/,
    /\(\.\+\)\{/,
  ];
  
  for (const danger of dangerousPatterns) {
    if (danger.test(pattern)) {
      return null;
    }
  }
  
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}