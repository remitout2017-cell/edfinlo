// Advanced JSON Parsing & Repair Utilities

/**
 * Extract JSON from mixed text content
 */
export function extractJSON(text) {
  if (!text || typeof text !== "string") return null;

  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Continue to extraction
  }

  // Remove markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```javascript\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find JSON object or array
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {
      // Try repair
    }
  }

  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      // Try repair
    }
  }

  return null;
}

/**
 * Repair common JSON formatting issues
 */
export function repairJSON(jsonString) {
  if (!jsonString || typeof jsonString !== "string") return null;

  try {
    // First try: Parse as-is
    return JSON.parse(jsonString);
  } catch (e) {
    console.log("🔧 Attempting JSON repair...");
  }

  let repaired = jsonString;

  // Fix 1: Remove trailing commas
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

  // Fix 2: Add missing commas between objects
  repaired = repaired.replace(/\}(\s*)\{/g, "},$1{");

  // Fix 3: Add missing commas between array elements
  repaired = repaired.replace(/\](\s*)\[/g, "],$1[");

  // Fix 4: Fix property names without quotes
  repaired = repaired.replace(
    /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g,
    '$1"$2"$3'
  );

  // Fix 5: Remove multiple consecutive commas
  repaired = repaired.replace(/,+/g, ",");

  // Fix 6: Remove commas before closing brackets (again)
  repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

  // Fix 7: Handle single quotes (convert to double)
  repaired = repaired.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

  try {
    const parsed = JSON.parse(repaired);
    console.log("✅ JSON repair successful");
    return parsed;
  } catch (secondError) {
    console.error("❌ JSON repair failed:", secondError.message);

    // Last resort: Try to truncate at last valid closing brace
    const lastBraceIndex = repaired.lastIndexOf("}");
    if (lastBraceIndex > 0) {
      try {
        const truncated = repaired.substring(0, lastBraceIndex + 1);
        const parsed = JSON.parse(truncated);
        console.log("✅ JSON extracted via truncation");
        return parsed;
      } catch (truncError) {
        console.error("❌ Truncation failed");
      }
    }
  }

  return null;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJSONParse(text, fallback = null, contextLabel = "Agent") {
  if (!text || typeof text !== "string") {
    console.warn(`⚠️ ${contextLabel}: Empty or invalid input`);
    return fallback;
  }

  // Try extraction
  const extracted = extractJSON(text);
  if (extracted) return extracted;

  // Try repair
  const repaired = repairJSON(text);
  if (repaired) return repaired;

  console.error(`❌ ${contextLabel}: Could not parse JSON`);
  console.error("Preview:", text.substring(0, 200));
  return fallback;
}

/**
 * Validate JSON structure matches expected schema
 */
export function validateJSONStructure(json, requiredFields = []) {
  if (!json || typeof json !== "object") return false;

  for (const field of requiredFields) {
    if (!(field in json)) {
      console.warn(`⚠️ Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}
