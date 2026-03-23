/**
 * Product name normalization pipeline
 *
 * Steps:
 *  1. Remove trailing/duplicate whitespace
 *  2. Standardize unit notation (ml→mL, KG→kg, etc.)
 *  3. Extract spec from parentheses → parsedSpec
 *  4. Split brand/model tokens
 *  5. Remove special characters that hurt TF-IDF matching
 */

import type { ParsedSpec } from "@/types";

// Unit notation normalization map
const UNIT_NORMALIZATIONS: Record<string, string> = {
  // Volume
  ML: "mL", ml: "mL", Ml: "mL",
  L: "L", l: "L",
  CC: "cc",
  // Weight
  KG: "kg", Kg: "kg",
  G: "g",
  MG: "mg",
  T: "t",                        // 톤
  // Length
  MM: "mm", Mm: "mm",
  CM: "cm", Cm: "cm",
  M: "m",
  KM: "km", Km: "km",
  // Area / Volume (construction)
  M2: "m²", "M²": "m²",
  M3: "m³", "M³": "m³",
  // Electrical
  W: "W",
  KW: "kW", Kw: "kW",
  V: "V",
  A: "A",
  // Count
  EA: "EA", ea: "EA", Ea: "EA",
  SET: "SET", Set: "SET",
  BOX: "BOX", Box: "BOX",
  ROLL: "ROLL", Roll: "ROLL",
  // Paper
  REAM: "REAM",
};

// Regex to find unit patterns like "500ml", "2kg", "100mm"
const UNIT_REGEX = /(\d+(?:\.\d+)?)\s*([a-zA-Z²³]+)/g;

// Parentheses content extraction: "상품명(규격 500mL, 브랜드)" → extract inner text
const PAREN_REGEX = /[（(]([^）)]+)[）)]/g;

// Brand/model separator patterns commonly seen in Korean procurement data
const BRAND_SEPARATORS = ["/", "｜", "|", "_"];

/**
 * Normalize unit notations within a string
 */
function normalizeUnits(text: string): string {
  return text.replace(UNIT_REGEX, (match, number, unit) => {
    const normalized = UNIT_NORMALIZATIONS[unit];
    return normalized ? `${number}${normalized}` : match;
  });
}

/**
 * Extract specification attributes from parentheses content
 * e.g. "(500mL, 녹색, 삼성)" → { capacity: "500mL", color: "녹색", brand: "삼성" }
 */
function extractSpecFromParens(text: string): { cleanName: string; spec: ParsedSpec } {
  const spec: ParsedSpec = {};
  const parensFound: string[] = [];

  const cleanName = text.replace(PAREN_REGEX, (_, inner) => {
    parensFound.push(inner.trim());
    return " ";
  }).trim();

  for (const fragment of parensFound) {
    const parts = fragment.split(/[,，、]/);
    for (const part of parts) {
      const token = part.trim();
      if (!token) continue;

      // Capacity/size: starts with number + unit
      if (/^\d+(?:\.\d+)?\s*[a-zA-Z²³]+$/.test(token)) {
        spec.capacity = normalizeUnits(token);
        continue;
      }

      // Color keywords
      const colorKeywords = ["빨강", "파랑", "초록", "노랑", "흰색", "검정", "흑", "백", "적", "청", "녹", "황", "white", "black", "red", "blue", "green"];
      if (colorKeywords.some((c) => token.includes(c))) {
        spec.color = token;
        continue;
      }

      // Material keywords
      const materialKeywords = ["스테인레스", "SUS", "강화유리", "PVC", "알루미늄", "철재", "나무", "목재", "플라스틱", "고무"];
      if (materialKeywords.some((m) => token.includes(m))) {
        spec.material = token;
        continue;
      }

      // If it looks like a brand name (short, starts with uppercase or Korean brand)
      if (token.length <= 20 && !spec.brand) {
        spec.brand = token;
      }
    }
  }

  return { cleanName, spec };
}

/**
 * Try to split "brand/model" from product name
 * e.g. "삼성/갤럭시탭 500mL" → brand: "삼성", model: "갤럭시탭"
 */
function splitBrandModel(name: string, existingSpec: ParsedSpec): ParsedSpec {
  const spec = { ...existingSpec };

  for (const sep of BRAND_SEPARATORS) {
    if (name.includes(sep)) {
      const parts = name.split(sep).map((p) => p.trim());
      if (parts.length >= 2 && parts[0].length <= 30 && !spec.brand) {
        spec.brand = parts[0];
        if (parts[1].length <= 50 && !spec.model) {
          spec.model = parts[1];
        }
      }
      break;
    }
  }

  return spec;
}

/**
 * Remove characters that hurt matching quality:
 * - Extra spaces, tabs, newlines
 * - Repeated punctuation
 * - HTML entities
 */
function cleanSpecialChars(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[★☆◆◇●○▲△▼▽■□※]/g, " ")  // decorative characters
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

export interface NormalizationResult {
  normalizedName: string;
  parsedSpec: ParsedSpec;
}

/**
 * Main entry point: normalize a product name for storage and matching.
 *
 * @param rawName  Original product name from 나라장터 data
 * @returns        { normalizedName, parsedSpec }
 */
export function normalizeProductName(rawName: string): NormalizationResult {
  if (!rawName || typeof rawName !== "string") {
    return { normalizedName: "", parsedSpec: {} };
  }

  // Step 1: clean special chars
  let name = cleanSpecialChars(rawName);

  // Step 2: extract spec from parentheses
  const { cleanName, spec } = extractSpecFromParens(name);
  name = cleanName;

  // Step 3: normalize unit notations
  name = normalizeUnits(name);

  // Step 4: split brand/model
  const enrichedSpec = splitBrandModel(name, spec);

  // Step 5: final whitespace cleanup
  const normalizedName = name.replace(/\s+/g, " ").trim();

  return {
    normalizedName,
    parsedSpec: enrichedSpec,
  };
}

/**
 * Batch normalize an array of product names
 */
export function batchNormalize(
  items: Array<{ id: string; productName: string }>
): Array<{ id: string } & NormalizationResult> {
  return items.map(({ id, productName }) => ({
    id,
    ...normalizeProductName(productName),
  }));
}
