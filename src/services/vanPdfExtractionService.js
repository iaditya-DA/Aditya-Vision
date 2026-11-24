import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Configure worker URL across browser, bundler, and test environments
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || "6.5.438"}/legacy/build/pdf.worker.min.mjs`;
  }
}

/* ── Geometry & Transform Helpers ──────────────────────────────── */

function applyMatrix(m, x, y) {
  return [
    x * m[0] + y * m[2] + m[4],
    x * m[1] + y * m[3] + m[5],
  ];
}

export function normalizeItemCode(itemCode) {
  if (itemCode === null || itemCode === undefined) return "";
  return String(itemCode).trim().replace(/\s+/g, "");
}

export function extractModelKey(cellText = "") {
  const clean = String(cellText || "").trim();
  if (!clean) return "";
  const words = clean.split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1] : clean;
  return lastWord.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractSearchTokens(cellText = "") {
  const clean = String(cellText || "").trim();
  if (!clean) return [];
  const words = clean.split(/\s+/).filter(Boolean);
  return Array.from(
    new Set(
      words.map((w) => w.toUpperCase().replace(/^[^A-Z0-9_-]+|[^A-Z0-9_-]+$/g, "")).filter(Boolean)
    )
  );
}

/**
 * Computes SHA-256 hash of a PDF array buffer for same-PDF detection
 */
export async function computePdfHash(arrayBuffer) {
  if (!arrayBuffer) return "";
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      console.warn("crypto.subtle.digest failed:", err);
    }
  }
  // Fast 64-bit combined hash fallback if WebCrypto unavailable in test or older env
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761);
    h2 = Math.imul(h2 ^ bytes[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Generates a stable unique identity string for a product
 * Uses sanitized uppercase modelKey + normalized itemCode digits
 * e.g. "GLC24B3XWAAGOUT_132341"
 */
export function getProductIdentity(item) {
  if (!item) return "";
  const code = normalizeItemCode(item.itemCode || "");
  if (!code) return "";
  const model = extractModelKey(item.modelKey || item.modelNumber || item.description || "");
  const safeModel = (model || "item").replace(/[^A-Za-z0-9_-]/g, "").toUpperCase();
  return `${safeModel}_${code}`;
}

/**
 * Returns a canonical deterministic string representing all display, pricing,
 * and search-relevant fields of a product, excluding volatile timestamps.
 */
export function getProductCanonicalString(item) {
  if (!item) return "";
  const modelKey = (item.modelKey || "").trim().toUpperCase();
  const modelNumber = (item.modelNumber || "").trim();
  const itemCode = normalizeItemCode(item.itemCode || "");
  const description = (item.description || "").trim();

  const tokens = Array.isArray(item.searchTokens)
    ? [...item.searchTokens]
        .map((t) => String(t || "").trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join(",")
    : "";

  let extraStr = "";
  if (item.extra && typeof item.extra === "object") {
    const keys = Object.keys(item.extra).sort();
    extraStr = keys
      .map((k) => `${k}:${String(item.extra[k] || "").trim()}`)
      .join("|");
  }

  const rawStr = Array.isArray(item.rawRow)
    ? item.rawRow.map((c) => String(c || "").trim()).join("|")
    : "";

  return `${modelKey}#${modelNumber}#${itemCode}#${description}#${tokens}#${extraStr}#${rawStr}`;
}

/**
 * Computes deterministic SHA-256 hash of a product's canonical representation
 * Used for O(1) comparison between incoming PDF items and existing Firestore catalog items
 */
export async function computeProductHash(item) {
  const canonical = getProductCanonicalString(item);
  if (!canonical) return "";

  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(canonical);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      console.warn("computeProductHash WebCrypto failed:", err);
    }
  }

  // Fast 64-bit deterministic hash fallback
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < canonical.length; i++) {
    const code = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Computes multi-field similarity and confidence between two products
 * Compares normalized Model Number, Item Code, Brand, Description and extra specs
 * Returns: { confidence: number (0..100), matchType: string, reason: string }
 */
export function calculateProductSimilarity(itemA, itemB) {
  if (!itemA || !itemB) return { confidence: 0, matchType: "NONE", reason: "Missing product" };

  const codeA = normalizeItemCode(itemA.itemCode);
  const codeB = normalizeItemCode(itemB.itemCode);
  const modelA = extractModelKey(itemA.modelKey || itemA.modelNumber || itemA.description || "");
  const modelB = extractModelKey(itemB.modelKey || itemB.modelNumber || itemB.description || "");

  // 1. Exact Identity match (same modelKey and same itemCode)
  if (codeA && codeB && codeA === codeB && modelA && modelB && modelA === modelB) {
    return {
      confidence: 100,
      matchType: "EXACT_IDENTITY",
      reason: `Exact match on Item Code (${codeA}) and Model (${modelA})`,
    };
  }

  // 2. Same Item Code
  if (codeA && codeB && codeA === codeB) {
    if (modelA && modelB && (modelA.includes(modelB) || modelB.includes(modelA))) {
      return {
        confidence: 95,
        matchType: "CODE_MATCH_SIMILAR_MODEL",
        reason: `Same Item Code (${codeA}) with matching model variant (${modelA} vs ${modelB})`,
      };
    }
    return {
      confidence: 85,
      matchType: "SAME_ITEM_CODE_DIFFERENT_MODEL",
      reason: `Same Item Code (${codeA}), but different model text (${modelA || "N/A"} vs ${modelB || "N/A"})`,
    };
  }

  // 3. Same Model Key
  if (modelA && modelB && modelA === modelB) {
    return {
      confidence: 80,
      matchType: "SAME_MODEL_DIFFERENT_CODE",
      reason: `Same Model Number (${modelA}), but different Item Code (${codeA || "N/A"} vs ${codeB || "N/A"})`,
    };
  }

  // 4. Token overlap on description & Brand
  const tokensA = new Set(extractSearchTokens(itemA.description || itemA.modelNumber || ""));
  const tokensB = new Set(extractSearchTokens(itemB.description || itemB.modelNumber || ""));

  if (tokensA.size > 0 && tokensB.size > 0) {
    let intersection = 0;
    tokensA.forEach((t) => {
      if (tokensB.has(t)) intersection++;
    });
    const union = new Set([...tokensA, ...tokensB]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    const brandA = (itemA.extra?.Brand || itemA.extra?.brand || "").trim().toUpperCase();
    const brandB = (itemB.extra?.Brand || itemB.extra?.brand || "").trim().toUpperCase();
    const brandMatches = brandA && brandB && brandA === brandB;

    if (jaccard >= 0.75 || (jaccard >= 0.5 && brandMatches)) {
      const conf = Math.round(jaccard * 75 + (brandMatches ? 15 : 0));
      return {
        confidence: Math.min(75, conf),
        matchType: "HIGH_DESCRIPTION_SIMILARITY",
        reason: `High word overlap (${Math.round(jaccard * 100)}%) with existing product description`,
      };
    }
  }

  return {
    confidence: 0,
    matchType: "NONE",
    reason: "No significant similarity found",
  };
}

function mergeCoordinates(values, tolerance = 1.5) {
  if (!values || values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const result = [];
  let curGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i];
    const avg = curGroup.reduce((a, b) => a + b, 0) / curGroup.length;
    if (Math.abs(v - avg) <= tolerance) {
      curGroup.push(v);
    } else {
      result.push(avg);
      curGroup = [v];
    }
  }
  if (curGroup.length > 0) {
    result.push(curGroup.reduce((a, b) => a + b, 0) / curGroup.length);
  }
  return result;
}

/* ── Extract Ruling Lines (Vertical and Horizontal) ─────────────── */

export function extractRulingLines(operatorList, viewport) {
  const { fnArray, argsArray } = operatorList;
  if (!fnArray || !argsArray) return { vLines: [], hLines: [] };

  let ctm = [1, 0, 0, 1, 0, 0];
  const ctmStack = [];
  const rawV = [];
  const rawH = [];

  function checkVLine(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    if (dx <= 2.5 && dy >= 8.0) {
      rawV.push({ coord: (x1 + x2) / 2, start: Math.min(y1, y2), end: Math.max(y1, y2) });
    }
  }

  function checkHLine(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    if (dy <= 2.5 && dx >= 8.0) {
      rawH.push({ coord: (y1 + y2) / 2, start: Math.min(x1, x2), end: Math.max(x1, x2) });
    }
  }

  function checkRect(x, y, w, h, matrix) {
    const p1 = applyMatrix(matrix, x, y);
    const p2 = applyMatrix(matrix, x + w, y);
    const p3 = applyMatrix(matrix, x + w, y + h);
    const p4 = applyMatrix(matrix, x, y + h);

    const minX = Math.min(p1[0], p2[0], p3[0], p4[0]);
    const maxX = Math.max(p1[0], p2[0], p3[0], p4[0]);
    const minY = Math.min(p1[1], p2[1], p3[1], p4[1]);
    const maxY = Math.max(p1[1], p2[1], p3[1], p4[1]);

    const rw = maxX - minX;
    const rh = maxY - minY;

    if (rw <= 2.5 && rh >= 8.0) {
      rawV.push({ coord: (minX + maxX) / 2, start: minY, end: maxY });
    }
    if (rh <= 2.5 && rw >= 8.0) {
      rawH.push({ coord: (minY + maxY) / 2, start: minX, end: maxX });
    }
  }

  let currentPt = [0, 0];
  let subpathStart = [0, 0];

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (fn === pdfjsLib.OPS.save) {
      ctmStack.push([...ctm]);
    } else if (fn === pdfjsLib.OPS.restore) {
      if (ctmStack.length > 0) ctm = ctmStack.pop();
    } else if (fn === pdfjsLib.OPS.transform && args) {
      ctm = pdfjsLib.Util.transform(ctm, args);
    } else if (fn === pdfjsLib.OPS.constructPath && args) {
      const totalMatrix = pdfjsLib.Util.transform(viewport.transform, ctm);

      // Check minMax bounding box if provided in args[2]
      if (args.length >= 3 && ArrayBuffer.isView(args[2]) && args[2].length >= 4) {
        const mm = args[2];
        checkRect(mm[0], mm[1], mm[2] - mm[0], mm[3] - mm[1], totalMatrix);
      }

      let flat = null;
      let ops = null;
      let coords = null;

      if (Array.isArray(args)) {
        if (args.length >= 2 && ArrayBuffer.isView(args[0]) && ArrayBuffer.isView(args[1])) {
          ops = args[0]; coords = args[1];
        } else if (Array.isArray(args[1]) && args[1].length >= 2 && ArrayBuffer.isView(args[1][0]) && ArrayBuffer.isView(args[1][1])) {
          ops = args[1][0]; coords = args[1][1];
        } else if (Array.isArray(args[1]) && ArrayBuffer.isView(args[1][0])) {
          flat = args[1][0];
        } else if (ArrayBuffer.isView(args[1])) {
          flat = args[1];
        }
      }

      if (ops && coords) {
        let cIdx = 0;
        for (let oIdx = 0; oIdx < ops.length; oIdx++) {
          const op = ops[oIdx];
          if (op === 0) {
            const vp = applyMatrix(totalMatrix, coords[cIdx++], coords[cIdx++]);
            currentPt = vp; subpathStart = vp;
          } else if (op === 1) {
            const vp = applyMatrix(totalMatrix, coords[cIdx++], coords[cIdx++]);
            checkVLine(currentPt[0], currentPt[1], vp[0], vp[1]);
            checkHLine(currentPt[0], currentPt[1], vp[0], vp[1]);
            currentPt = vp;
          } else if (op === 2) {
            cIdx += 6;
          } else if (op === 3) {
            cIdx += 4;
          } else if (op === 4) {
            checkVLine(currentPt[0], currentPt[1], subpathStart[0], subpathStart[1]);
            checkHLine(currentPt[0], currentPt[1], subpathStart[0], subpathStart[1]);
            currentPt = subpathStart;
          } else if (op === 5 || op === 19) {
            checkRect(coords[cIdx++], coords[cIdx++], coords[cIdx++], coords[cIdx++], totalMatrix);
          }
        }
      } else if (flat) {
        let k = 0;
        while (k < flat.length) {
          const op = flat[k++];
          if (op === 0) {
            const vp = applyMatrix(totalMatrix, flat[k++], flat[k++]);
            currentPt = vp; subpathStart = vp;
          } else if (op === 1) {
            const vp = applyMatrix(totalMatrix, flat[k++], flat[k++]);
            checkVLine(currentPt[0], currentPt[1], vp[0], vp[1]);
            checkHLine(currentPt[0], currentPt[1], vp[0], vp[1]);
            currentPt = vp;
          } else if (op === 2) {
            k += 6;
          } else if (op === 3) {
            k += 4;
          } else if (op === 4) {
            checkVLine(currentPt[0], currentPt[1], subpathStart[0], subpathStart[1]);
            checkHLine(currentPt[0], currentPt[1], subpathStart[0], subpathStart[1]);
            currentPt = subpathStart;
          } else if (op === 5 || op === 19) {
            checkRect(flat[k++], flat[k++], flat[k++], flat[k++], totalMatrix);
          }
        }
      }
    } else if (fn === pdfjsLib.OPS.moveTo && args) {
      const totalMatrix = pdfjsLib.Util.transform(viewport.transform, ctm);
      const vp = applyMatrix(totalMatrix, args[0], args[1]);
      currentPt = vp; subpathStart = vp;
    } else if (fn === pdfjsLib.OPS.lineTo && args) {
      const totalMatrix = pdfjsLib.Util.transform(viewport.transform, ctm);
      const vp = applyMatrix(totalMatrix, args[0], args[1]);
      checkVLine(currentPt[0], currentPt[1], vp[0], vp[1]);
      checkHLine(currentPt[0], currentPt[1], vp[0], vp[1]);
      currentPt = vp;
    } else if (fn === pdfjsLib.OPS.rectangle && args) {
      const totalMatrix = pdfjsLib.Util.transform(viewport.transform, ctm);
      checkRect(args[0], args[1], args[2], args[3], totalMatrix);
    }
  }

  return { vLines: rawV, hLines: rawH };
}

/* ── STEP A: In-Memory PDF Parsing ─────────────────────────────── */

export async function parsePdfDocument(arrayBuffer, onProgress) {
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/cmaps/",
    cMapPacked: true,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];
  let isScanned = false;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) onProgress(Math.round((pageNum / numPages) * 75), pageNum, numPages);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const opList = await page.getOperatorList();
    const { vLines, hLines } = extractRulingLines(opList, viewport);

    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack = [];
    let textMatrix = [1, 0, 0, 1, 0, 0];
    let textLineMatrix = [1, 0, 0, 1, 0, 0];
    let fontSize = 10;

    const opItems = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === pdfjsLib.OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === pdfjsLib.OPS.restore) {
        if (ctmStack.length > 0) ctm = ctmStack.pop();
      } else if (fn === pdfjsLib.OPS.transform && args) {
        ctm = pdfjsLib.Util.transform(ctm, args);
      } else if (fn === pdfjsLib.OPS.beginText) {
        textMatrix = [1, 0, 0, 1, 0, 0];
        textLineMatrix = [1, 0, 0, 1, 0, 0];
      } else if (fn === pdfjsLib.OPS.setFont && args) {
        fontSize = args[1] || 10;
      } else if (fn === pdfjsLib.OPS.moveText && args) {
        textLineMatrix = pdfjsLib.Util.transform(textLineMatrix, [1, 0, 0, 1, args[0], args[1]]);
        textMatrix = [...textLineMatrix];
      } else if (fn === pdfjsLib.OPS.setTextMatrix && args) {
        textMatrix = [...args];
        textLineMatrix = [...args];
      } else if (fn === pdfjsLib.OPS.showText && args) {
        const glyphs = args[0];
        let str = "";
        let width = 0;
        for (const g of glyphs) {
          str += g.unicode || "";
          width += (g.width || 0) * (fontSize / 1000);
        }
        if (str.trim()) {
          const totalTransform = pdfjsLib.Util.transform(
            pdfjsLib.Util.transform(viewport.transform, ctm),
            textMatrix
          );
          const vx = totalTransform[4];
          const vy = totalTransform[5];
          const height = fontSize;

          opItems.push({
            str: str.trim(),
            left: vx,
            right: vx + width,
            top: vy - height,
            bottom: vy,
            width,
            height,
            centerX: vx + width / 2,
            centerY: vy - height / 2,
          });
        }
      }
    }

    let items = opItems;
    if (items.length === 0) {
      let tc;
      try {
        tc = await page.getTextContent({ includeMarkedContent: false, disableCombineTextItems: true });
      } catch {
        tc = await page.getTextContent({ includeMarkedContent: false });
      }
      items = tc.items.map((it) => {
        const str = String(it.str || "").trim();
        if (!str) return null;
        const tt = pdfjsLib.Util.transform(viewport.transform, it.transform);
        const vx = tt[4];
        const vy = tt[5];
        const h = it.height || 10;
        return {
          str,
          left: vx,
          right: vx + it.width,
          top: vy - h,
          bottom: vy,
          width: it.width,
          height: h,
          centerX: vx + it.width / 2,
          centerY: vy - h / 2,
        };
      }).filter(Boolean);
    }

    if (items.length === 0) {
      isScanned = true;
    }

    const avgHeight = items.length > 0
      ? items.reduce((s, it) => s + it.height, 0) / items.length
      : 10;

    pages.push({
      pageNum,
      width: viewport.width,
      height: viewport.height,
      items,
      vLines,
      hLines,
      avgHeight,
    });
  }

  return { pdfDoc, numPages, pages, isScanned };
}

/* ── STEP B: Table Area Auto-Detection ─────────────────────────── */

export function autoDetectTableArea(page1) {
  const { width, height, vLines, items, avgHeight } = page1;

  // Filter significant vertical lines (excluding page outer border < 5 or > width - 5)
  const groups = [];
  for (const v of vLines) {
    if (v.coord < 5 || v.coord > width - 5) continue;
    let g = groups.find((grp) => Math.abs(grp.coord - v.coord) <= 2.0);
    if (!g) {
      g = { coord: v.coord, minStart: Infinity, maxEnd: -Infinity };
      groups.push(g);
    }
    g.minStart = Math.min(g.minStart, v.start);
    g.maxEnd = Math.max(g.maxEnd, v.end);
  }

  const tableVLines = groups.filter((g) => (g.maxEnd - g.minStart) >= height * 0.18);
  tableVLines.sort((a, b) => a.coord - b.coord);

  if (tableVLines.length >= 2) {
    const minX = tableVLines[0].coord;
    const maxX = tableVLines[tableVLines.length - 1].coord;

    // For tableTop, use the topmost start of internal column dividers if available
    const internalDividers = tableVLines.length > 2 ? tableVLines.slice(1, -1) : tableVLines;
    const tableTop = Math.min(...internalDividers.map((d) => d.minStart));
    const tableBottom = Math.max(...internalDividers.map((d) => d.maxEnd));

    return {
      left: Math.max(0, (minX - 2) / width),
      right: Math.min(1, (maxX + 2) / width),
      top: Math.max(0, (tableTop - 1) / height),
      bottom: Math.min(1, (tableBottom + 2) / height),
    };
  }

  // Fallback from text gaps
  if (items.length > 0) {
    const sorted = [...items].sort((a, b) => a.top - b.top);
    const lines = [];
    for (const item of sorted) {
      let matched = null;
      for (const line of lines) {
        if (Math.abs(item.centerY - line.centerY) <= avgHeight * 0.4) {
          matched = line;
          break;
        }
      }
      if (matched) {
        matched.items.push(item);
        matched.centerY = matched.items.reduce((s, it) => s + it.centerY, 0) / matched.items.length;
        matched.top = Math.min(matched.top, item.top);
        matched.bottom = Math.max(matched.bottom, item.bottom);
      } else {
        lines.push({ centerY: item.centerY, top: item.top, bottom: item.bottom, items: [item] });
      }
    }

    lines.sort((a, b) => a.top - b.top);

    let tableStartLineIdx = 0;
    for (let i = 0; i < Math.min(lines.length - 1, 10); i++) {
      const gap = lines[i + 1].top - lines[i].bottom;
      if (gap > avgHeight * 2.2 && lines[i].bottom < height * 0.45) {
        tableStartLineIdx = i + 1;
        break;
      }
    }

    const tableLines = lines.slice(tableStartLineIdx);
    if (tableLines.length > 0) {
      const tableItems = tableLines.flatMap((l) => l.items);
      const minX = Math.min(...tableItems.map((it) => it.left));
      const maxX = Math.max(...tableItems.map((it) => it.right));
      const minY = tableLines[0].top;
      let maxY = tableLines[tableLines.length - 1].bottom;
      if (tableLines.length > 3 && tableLines[tableLines.length - 1].items.length === 1) {
        maxY = tableLines[tableLines.length - 2].bottom;
      }

      return {
        left: Math.max(0, (minX - 5) / width),
        right: Math.min(1, (maxX + 5) / width),
        top: Math.max(0, (minY - 2) / height),
        bottom: Math.min(1, (maxY + 5) / height),
      };
    }
  }

  return { left: 0.05, right: 0.95, top: 0.08, bottom: 0.95 };
}

/* ── STEP C: Column Boundaries Calculation ─────────────────────── */

export function calculateColBoundaries(page1, area, customColBoundaries, allPages = [page1]) {
  const { width, height, vLines } = page1;
  const areaLeft = area.left * width;
  const areaRight = area.right * width;
  const areaTop = area.top * height;
  const areaBottom = area.bottom * height;

  if (customColBoundaries && customColBoundaries.length >= 2) {
    const absBounds = customColBoundaries.map((b) => (b <= 1.0 ? b * width : b));
    return mergeCoordinates(absBounds, 2.0).sort((a, b) => a - b);
  }

  // 1. From significant vertical ruling lines
  const groups = [];
  for (const v of vLines) {
    if (v.coord < 5 || v.coord > width - 5) continue;
    if (v.coord < areaLeft - 4 || v.coord > areaRight + 4) continue;
    let g = groups.find((grp) => Math.abs(grp.coord - v.coord) <= 2.0);
    if (!g) {
      g = { coord: v.coord, minStart: Infinity, maxEnd: -Infinity };
      groups.push(g);
    }
    g.minStart = Math.min(g.minStart, v.start);
    g.maxEnd = Math.max(g.maxEnd, v.end);
  }

  const tableVLines = groups.filter((g) => (g.maxEnd - g.minStart) >= height * 0.18);

  if (tableVLines.length >= 2) {
    tableVLines.sort((a, b) => a.coord - b.coord);
    const coords = tableVLines.map((g) => g.coord);
    const merged = mergeCoordinates(coords, 2.0).sort((a, b) => a - b);
    return merged;
  }

  // 2. Robust Gap Fallback (when ruling lines < 2)
  // Gutter >= 4 units wide, free of text in >= 99% of data rows across ALL pages
  const allDataRows = [];
  for (const page of allPages) {
    const pItems = page.items.filter(
      (it) =>
        it.centerX >= areaLeft &&
        it.centerX <= areaRight &&
        it.centerY >= areaTop &&
        it.centerY <= areaBottom
    );
    const sorted = [...pItems].sort((a, b) => a.centerY - b.centerY);
    const pLines = [];
    for (const item of sorted) {
      let matched = null;
      for (const line of pLines) {
        if (Math.abs(item.centerY - line.centerY) <= page.avgHeight * 0.4) {
          matched = line;
          break;
        }
      }
      if (matched) {
        matched.items.push(item);
        matched.centerY = matched.items.reduce((s, it) => s + it.centerY, 0) / matched.items.length;
      } else {
        pLines.push({ centerY: item.centerY, items: [item] });
      }
    }
    allDataRows.push(...pLines);
  }

  const minGap = 4.0;
  const numSteps = 500;
  const stepSize = (areaRight - areaLeft) / numSteps;
  const candidateGutters = [];

  for (let s = 1; s < numSteps - 1; s++) {
    const x = areaLeft + s * stepSize;
    let occupiedCount = 0;
    for (const row of allDataRows) {
      const collides = row.items.some((it) => it.left - 1.0 < x && it.right + 1.0 > x);
      if (collides) occupiedCount++;
    }
    const freeRate = 1 - (allDataRows.length > 0 ? occupiedCount / allDataRows.length : 0);
    if (freeRate >= 0.99) {
      candidateGutters.push(x);
    }
  }

  const gutters = [];
  let curGut = [];
  for (let i = 0; i < candidateGutters.length; i++) {
    const gx = candidateGutters[i];
    if (curGut.length === 0 || Math.abs(gx - curGut[curGut.length - 1] - stepSize) <= 0.1) {
      curGut.push(gx);
    } else {
      if (curGut[curGut.length - 1] - curGut[0] >= minGap) {
        gutters.push((curGut[0] + curGut[curGut.length - 1]) / 2);
      }
      curGut = [gx];
    }
  }
  if (curGut.length > 0 && curGut[curGut.length - 1] - curGut[0] >= minGap) {
    gutters.push((curGut[0] + curGut[curGut.length - 1]) / 2);
  }

  const bounds = [areaLeft, ...gutters, areaRight];
  return mergeCoordinates(bounds, 3.0).sort((a, b) => a - b);
}

/* ── Assign Items to Columns ───────────────────────────────────── */

function assignItemsToColumns(items, colBoundaries) {
  const colCount = colBoundaries.length - 1;
  const colTokens = Array.from({ length: colCount }, () => []);

  for (const item of items) {
    let cIdx = -1;
    for (let c = 0; c < colCount; c++) {
      if (item.centerX >= colBoundaries[c] - 1.5 && item.centerX < colBoundaries[c + 1] + 1.5) {
        cIdx = c;
        break;
      }
    }
    if (cIdx === -1) {
      let minDist = Infinity;
      for (let c = 0; c < colCount; c++) {
        const mid = (colBoundaries[c] + colBoundaries[c + 1]) / 2;
        const dist = Math.abs(item.centerX - mid);
        if (dist < minDist) { minDist = dist; cIdx = c; }
      }
    }
    if (cIdx >= 0 && cIdx < colCount) {
      colTokens[cIdx].push(item);
    }
  }

  return colTokens.map((tokens) => {
    if (tokens.length === 0) return "";
    tokens.sort((a, b) => (Math.abs(a.centerY - b.centerY) > 2 ? a.centerY - b.centerY : a.centerX - b.centerX));
    let cellText = "";
    for (const t of tokens) {
      const s = t.str.trim();
      if (!s) continue;
      if (!cellText) {
        cellText = s;
      } else if (cellText.endsWith("-")) {
        cellText += s;
      } else {
        cellText += " " + s;
      }
    }
    return cellText.trim();
  });
}

/* ── STEP D: Generic Row Detection & Table Assembly ────────────── */

export function extractTableFromParsedPdf(parsedPdfData, options = {}) {
  const { pages, numPages, isScanned } = parsedPdfData;
  if (!pages || pages.length === 0) {
    throw new Error("No pages found in PDF document.");
  }

  const page1 = pages[0];
  const tableArea = options.tableArea || autoDetectTableArea(page1);
  let colBoundaries = calculateColBoundaries(page1, tableArea, options.colBoundaries, pages);
  let colCount = colBoundaries.length - 1;

  // 1. Identify Serial Number Column
  let bestSerialCol = -1;
  let bestSerialScore = 0;
  let serialAnchorsByPage = new Map();

  for (let c = 0; c < colCount; c++) {
    const colLeft = colBoundaries[c];
    const colRight = colBoundaries[c + 1];

    let score = 0;
    let prevVal = -1;
    const pageAnchors = new Map();

    for (const page of pages) {
      const pItems = page.items.filter(
        (it) =>
          it.centerX >= colLeft - 2 &&
          it.centerX <= colRight + 2 &&
          it.centerY >= tableArea.top * page.height &&
          it.centerY <= tableArea.bottom * page.height &&
          /^\d{1,6}$/.test(it.str.trim())
      );
      pItems.sort((a, b) => a.centerY - b.centerY);

      const anchorsThisPage = [];
      for (const it of pItems) {
        const val = parseInt(it.str.trim(), 10);
        if (prevVal !== -1 && val === prevVal + 1) {
          score++;
        }
        prevVal = val;
        anchorsThisPage.push(it);
      }
      pageAnchors.set(page.pageNum, anchorsThisPage);
    }

    if (score > bestSerialScore) {
      bestSerialScore = score;
      bestSerialCol = c;
      serialAnchorsByPage = pageAnchors;
    }
  }

  let anchorCol = 0;
  let activeStrategy;

  if (options.anchorColName && options.anchorColName !== "auto") {
    activeStrategy = "custom_anchor";
  } else if (bestSerialScore >= 4) {
    anchorCol = bestSerialCol;
    activeStrategy = "serial";
  } else {
    anchorCol = 0;
    activeStrategy = "first_column";
  }

  // 2. Identify Page 1 Header Lines
  const p1AreaTop = tableArea.top * page1.height;

  let firstRowY = p1AreaTop + 25;
  if (activeStrategy === "serial" && serialAnchorsByPage.get(1)?.length > 0) {
    const firstAnchor = serialAnchorsByPage.get(1)[0];
    firstRowY = firstAnchor.centerY - page1.avgHeight * 0.6;
  }

  // Header items on page 1 are inside tableArea and strictly above firstRowY
  const headerItems = page1.items.filter(
    (it) =>
      it.centerY >= p1AreaTop &&
      it.centerY < firstRowY &&
      it.centerX >= tableArea.left * page1.width - 2 &&
      it.centerX <= tableArea.right * page1.width + 2
  );

  let headers = assignItemsToColumns(headerItems, colBoundaries);

  // Cross-check with header: If column count > header count, merge neighbouring columns
  // where a single header block spans across multiple columns
  if (!options.colBoundaries) {
    let mergedSomething = true;
    while (mergedSomething && colBoundaries.length > 3) {
      mergedSomething = false;
      for (let c = 0; c < headers.length - 1; c++) {
        const boundaryX = colBoundaries[c + 1];
        const spanningItem = headerItems.find((it) => it.left < boundaryX - 2 && it.right > boundaryX + 2);
        if (spanningItem) {
          colBoundaries.splice(c + 1, 1);
          headers = assignItemsToColumns(headerItems, colBoundaries);
          mergedSomething = true;
          break;
        }
      }
    }
  }

  if (activeStrategy === "custom_anchor") {
    const foundIdx = headers.findIndex((h) => h.toLowerCase() === options.anchorColName.toLowerCase());
    if (foundIdx !== -1) anchorCol = foundIdx;
  }

  headers = headers.map((h, i) => (h && h.trim()) || `Column ${i + 1}`);

  // 3. Extract Rows for All Pages
  const allRows = [];
  const anchorValues = [];

  for (const page of pages) {
    const pAreaLeft = tableArea.left * page.width;
    const pAreaRight = tableArea.right * page.width;
    const pAreaTop = tableArea.top * page.height;
    const pAreaBottom = tableArea.bottom * page.height;

    const pItems = page.items.filter(
      (it) =>
        it.centerX >= pAreaLeft - 2 &&
        it.centerX <= pAreaRight + 2 &&
        it.centerY >= pAreaTop &&
        it.centerY <= pAreaBottom + 10
    );

    let pAnchors;
    if (activeStrategy === "serial") {
      pAnchors = serialAnchorsByPage.get(page.pageNum) || [];
    } else {
      const aLeft = colBoundaries[anchorCol];
      const aRight = colBoundaries[anchorCol + 1];
      const cand = pItems.filter((it) => it.centerX >= aLeft - 2 && it.centerX <= aRight + 2);
      cand.sort((a, b) => a.centerY - b.centerY);
      const skipY = page.pageNum === 1 ? firstRowY : pAreaTop + (firstRowY - p1AreaTop);
      pAnchors = cand.filter((it) => it.centerY >= skipY && it.str.trim());
    }

    if (pAnchors.length === 0) continue;
    pAnchors.sort((a, b) => a.centerY - b.centerY);

    for (let k = 0; k < pAnchors.length; k++) {
      const curAnchor = pAnchors[k];
      const nextAnchor = pAnchors[k + 1];

      const bandTop = curAnchor.centerY - page.avgHeight * 0.6;
      const bandBottom = nextAnchor
        ? nextAnchor.centerY - page.avgHeight * 0.6
        : Math.min(pAreaBottom, curAnchor.centerY + page.avgHeight * 4.5);

      const rowItems = pItems.filter((it) => it.centerY >= bandTop && it.centerY < bandBottom);
      const cellValues = assignItemsToColumns(rowItems, colBoundaries);

      const anchorVal = parseInt(cellValues[anchorCol], 10);
      if (!isNaN(anchorVal)) anchorValues.push(anchorVal);

      allRows.push({
        _rowId: `p${page.pageNum}_r${allRows.length + 1}`,
        _pageNumber: page.pageNum,
        _rawValues: cellValues,
      });
    }
  }

  // 4. Drop phantom columns (columns with no text across all rows and empty header)
  const activeColMask = headers.map((h, c) => {
    const hasHeader = h && !h.startsWith("Column ");
    const hasData = allRows.some((r) => r._rawValues[c] && r._rawValues[c].trim().length > 0);
    return hasHeader || hasData;
  });

  const finalHeaders = headers.filter((_, i) => activeColMask[i]);
  const finalColBoundaries = colBoundaries.filter((_, i) => i === 0 || activeColMask[i - 1]);
  const finalRows = allRows.map((r) => ({
    ...r,
    _rawValues: r._rawValues.filter((_, i) => activeColMask[i]),
  }));

  let finalAnchorCol = 0;
  if (anchorCol < activeColMask.length) {
    let countBefore = 0;
    for (let i = 0; i < anchorCol; i++) {
      if (activeColMask[i]) countBefore++;
    }
    finalAnchorCol = countBefore;
  }

  // 5. Validation and Health Checks
  let lastSno = 0;
  const missingSno = [];
  if (anchorValues.length > 0) {
    lastSno = Math.max(...anchorValues);
    const seen = new Set(anchorValues);
    for (let s = 1; s <= lastSno; s++) {
      if (!seen.has(s)) missingSno.push(s);
    }
  }

  let rowDetectionFailed = false;
  let failureReason = "";

  if (finalRows.length === 0) {
    rowDetectionFailed = true;
    failureReason = "No data rows were extracted from the PDF.";
  } else if (finalRows.length < 2 * numPages && numPages > 1) {
    rowDetectionFailed = true;
    failureReason = `Only ${finalRows.length} rows detected across ${numPages} pages. Expected at least ${2 * numPages}.`;
  }

  // Check for multi-digit numeric token corruption
  for (const row of finalRows) {
    for (const cell of row._rawValues) {
      const tokens = (cell || "").match(/\b\d{5,7}\b/g);
      if (tokens && tokens.length > 3) {
        rowDetectionFailed = true;
        failureReason = `Cell contains ${tokens.length} numeric tokens (5-7 digits), indicating unmerged row bands.`;
        break;
      }
    }
    if (rowDetectionFailed) break;
  }

  return {
    headers: finalHeaders,
    rows: finalRows,
    pageCount: numPages,
    isScanned,
    anchorCol: finalAnchorCol,
    lastSno,
    missingSno,
    rowDetectionFailed,
    failureReason,
    tableArea,
    colBoundaries: finalColBoundaries,
    parsedPdfData,
  };
}

/* ── Full Pipeline Call ────────────────────────────────────────── */

export async function extractTableFromPdf(arrayBuffer, options = {}) {
  const { onProgress } = options;
  const parsedPdfData = await parsePdfDocument(arrayBuffer, onProgress);
  const result = extractTableFromParsedPdf(parsedPdfData, options);
  if (onProgress) onProgress(100, parsedPdfData.numPages, parsedPdfData.numPages);
  return result;
}

/* ── Default Column Guessing ──────────────────────────────────── */

export function guessDefaultColumns(headers = []) {
  let searchColIdx = -1;
  let itemCodeColIdx = -1;

  headers.forEach((h, idx) => {
    const lower = h.toLowerCase().trim();
    if (searchColIdx === -1) {
      if (
        lower === "master" ||
        lower.startsWith("master ") ||
        lower.includes("model") ||
        lower.includes("description") ||
        lower.includes("product name")
      ) {
        searchColIdx = idx;
      }
    }
    if (itemCodeColIdx === -1) {
      if (
        lower.includes("item number") ||
        lower.includes("item code") ||
        lower.includes("item no") ||
        lower === "code" ||
        lower.includes("article") ||
        lower.includes("sku")
      ) {
        itemCodeColIdx = idx;
      }
    }
  });

  if (searchColIdx === -1) searchColIdx = headers.length > 1 ? 1 : 0;
  if (itemCodeColIdx === -1) itemCodeColIdx = Math.max(0, headers.length - 1);

  return { searchColIdx, itemCodeColIdx };
}
