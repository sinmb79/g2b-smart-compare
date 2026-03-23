/**
 * TF-IDF based product name similarity matching
 *
 * Used to match 나라장터 products to external (Naver Shopping) products.
 * Only results with similarity >= 0.7 are stored and shown in the UI.
 *
 * Algorithm:
 *  1. Tokenize Korean text using character n-grams (bigrams + unigrams)
 *  2. Build TF-IDF vectors for each document corpus
 *  3. Compute cosine similarity between query and candidate vectors
 */

// ---------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------

/**
 * Tokenize Korean text into character n-grams (unigram + bigram).
 * This handles Korean morphology without requiring a full NLP library.
 */
function tokenize(text: string): string[] {
  // Normalize: lowercase, remove special chars, collapse spaces
  const normalized = text
    .toLowerCase()
    .replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uA960-\uA97Fa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens: string[] = [];
  const chars = [...normalized]; // Unicode-aware split

  // Unigrams
  for (const ch of chars) {
    if (ch !== " ") tokens.push(ch);
  }

  // Bigrams
  for (let i = 0; i < chars.length - 1; i++) {
    if (chars[i] !== " " && chars[i + 1] !== " ") {
      tokens.push(chars[i] + chars[i + 1]);
    }
  }

  // Word-level tokens (for English/number parts)
  const words = normalized.split(/\s+/).filter(Boolean);
  tokens.push(...words);

  return tokens;
}

// ---------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------

type TermFreq = Map<string, number>;
type TfIdfVector = Map<string, number>;

function termFreq(tokens: string[]): TermFreq {
  const tf: TermFreq = new Map();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  // Normalize by document length
  for (const [term, count] of tf) {
    tf.set(term, count / tokens.length);
  }
  return tf;
}

function buildIdf(corpus: string[][]): Map<string, number> {
  const N = corpus.length;
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1); // smoothed IDF
  }
  return idf;
}

function tfidfVector(tf: TermFreq, idf: Map<string, number>): TfIdfVector {
  const vec: TfIdfVector = new Map();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 0;
    vec.set(term, tfVal * idfVal);
  }
  return vec;
}

function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, aVal] of a) {
    const bVal = b.get(term) ?? 0;
    dot += aVal * bVal;
    normA += aVal * aVal;
  }
  for (const [, bVal] of b) {
    normB += bVal * bVal;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

export interface SimilarityResult {
  index: number;
  text: string;
  score: number; // 0.0–1.0
}

/**
 * Rank candidates by TF-IDF cosine similarity against a query.
 *
 * @param query       The 나라장터 product name (normalized)
 * @param candidates  External product names from Naver Shopping
 * @param threshold   Minimum score to include (default 0.7)
 * @returns           Sorted results with score >= threshold
 */
export function rankBySimilarity(
  query: string,
  candidates: string[],
  threshold = 0.7
): SimilarityResult[] {
  if (!query || candidates.length === 0) return [];

  const queryTokens = tokenize(query);
  const candidateTokens = candidates.map(tokenize);

  // Build IDF from all documents (query + candidates)
  const corpus = [queryTokens, ...candidateTokens];
  const idf = buildIdf(corpus);

  const queryVec = tfidfVector(termFreq(queryTokens), idf);

  const results: SimilarityResult[] = candidates
    .map((text, index) => {
      const candidateVec = tfidfVector(termFreq(candidateTokens[index]), idf);
      const score = cosineSimilarity(queryVec, candidateVec);
      return { index, text, score };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Find best matching candidate.
 * Returns null if no candidate meets the threshold.
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  threshold = 0.7
): SimilarityResult | null {
  const results = rankBySimilarity(query, candidates, threshold);
  return results[0] ?? null;
}
