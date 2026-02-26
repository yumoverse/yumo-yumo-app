/**
 * Text normalization utilities for language-agnostic document classification
 */

/**
 * Replace Turkish-specific characters with ASCII equivalents for better matching
 * This ensures "NAKİT" -> "nakit" matches with "nakit" in keywords
 */
function turkishToAscii(text: string): string {
  return text
    .replace(/İ/g, 'I')  // Turkish capital İ -> I
    .replace(/ı/g, 'i')  // Turkish lowercase ı -> i
    .replace(/Ğ/g, 'G')  // Turkish Ğ -> G
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')  // Turkish Ü -> U
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 'S')  // Turkish Ş -> S
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'O')  // Turkish Ö -> O
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')  // Turkish Ç -> C
    .replace(/ç/g, 'c');
}

/**
 * Normalize text for classification
 * - Lowercasing
 * - Unicode normalization (NFKC)
 * - Turkish character replacement (İ -> I, ş -> s, etc.)
 * - Collapse whitespace
 * - Keep both original and normalized forms
 */
export function normalizeText(text: string): { original: string; normalized: string } {
  const original = text;
  
  // Unicode normalization (NFKC - Compatibility Decomposition + Canonical Composition)
  let normalized = text.normalize("NFKC");
  
  // Replace Turkish characters BEFORE lowercasing to avoid İ -> i problem
  normalized = turkishToAscii(normalized);
  
  // Lowercase
  normalized = normalized.toLowerCase();
  
  // Collapse whitespace (multiple spaces/tabs/newlines -> single space)
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return { original, normalized };
}

/**
 * Tokenize text into words
 */
export function tokenizeWords(text: string): string[] {
  // Split by whitespace and punctuation, keep alphanumeric sequences
  const tokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.filter(t => t.length > 0);
}

/**
 * Generate bigrams from tokens
 */
export function generateBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Normalize and tokenize text for classification
 */
export function prepareTextForClassification(text: string): {
  original: string;
  normalized: string;
  words: string[];
  bigrams: string[];
  lines: string[];
} {
  const { original, normalized } = normalizeText(text);
  const words = tokenizeWords(normalized);
  const bigrams = generateBigrams(words);
  
  // Also keep line-level strings (normalized)
  const lines = text
    .split(/\r?\n/)
    .map(line => normalizeText(line).normalized)
    .filter(line => line.length > 0);
  
  return {
    original,
    normalized,
    words,
    bigrams,
    lines,
  };
}





