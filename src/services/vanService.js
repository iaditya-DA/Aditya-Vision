import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  extractModelKey,
  normalizeItemCode,
  getProductIdentity,
  computeProductHash,
  calculateProductSimilarity,
} from "./vanPdfExtractionService";

/**
 * Normalizes company name to URL-friendly lowercase key
 * e.g. "Lloyd" -> "lloyd", "LG Electronics" -> "lg-electronics"
 */
export function getCompanyKey(name = "") {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fetches all active companies
 */
export async function getVanCompanies() {
  try {
    const snap = await getDocs(collection(db, "vanCompanies"));
    return snap.docs.map((d) => ({
      key: d.id,
      ...d.data(),
    }));
  } catch (err) {
    console.warn("getVanCompanies error:", err);
    return [];
  }
}

let legacyMigrationChecked = false;

/**
 * Checks for legacy vanMeta/active and migrates it to vanCompanies/imported
 * Uses in-memory session flag to prevent repeated redundant reads
 */
export async function migrateLegacyVanMeta() {
  if (legacyMigrationChecked) return;
  try {
    const metaRef = doc(db, "vanMeta", "active");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      const data = metaSnap.data();
      const importedKey = "imported";
      await setDoc(doc(db, "vanCompanies", importedKey), {
        key: importedKey,
        name: "Imported",
        activeUploadId: data.uploadId || data.activeUploadId || "",
        fileName: data.fileName || "Legacy Data",
        rowCount: data.rowCount || 0,
        publishedAt: data.publishedAt || new Date().toISOString(),
        publishedByName: data.publishedByName || "System Migration",
      });
      await deleteDoc(metaRef);
    }
    legacyMigrationChecked = true;
  } catch (err) {
    console.warn("migrateLegacyVanMeta error:", err.message);
  }
}

/**
 * Fetches all saved format presets for Super Admin
 */
export async function getVanPresets() {
  try {
    const q = query(collection(db, "vanPresets"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "vanPresets"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

/**
 * Saves or updates a preset
 */
export async function saveVanPreset(presetData, user) {
  const presetId =
    presetData.id ||
    `preset_${getCompanyKey(presetData.companyName)}_${Date.now().toString(36)}`;

  const ref = doc(db, "vanPresets", presetId);
  const data = {
    id: presetId,
    companyName: presetData.companyName,
    searchColumnHeader: presetData.searchColumnHeader || "",
    itemCodeColumnHeader: presetData.itemCodeColumnHeader || "",
    tickedColumnHeaders: presetData.tickedColumnHeaders || [],
    createdAt: serverTimestamp(),
    createdByName: user?.name || "Super Admin",
    createdBy: user?.uid || user?.id,
  };
  if (presetData.tableArea) data.tableArea = presetData.tableArea;
  if (presetData.colBoundaries) data.colBoundaries = presetData.colBoundaries;
  if (presetData.anchorColName) data.anchorColName = presetData.anchorColName;
  if (presetData.headerLineCount !== undefined) data.headerLineCount = presetData.headerLineCount;

  await setDoc(ref, data);

  return presetId;
}

/**
 * Renames a preset's company name
 */
export async function renameVanPreset(presetId, newCompanyName) {
  const ref = doc(db, "vanPresets", presetId);
  await updateDoc(ref, {
    companyName: newCompanyName.trim(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a format preset
 */
export async function deleteVanPreset(presetId) {
  await deleteDoc(doc(db, "vanPresets", presetId));
}

/**
 * Fetches upload history
 */
export async function getVanUploadHistory(limitCount = 50) {
  try {
    const q = query(collection(db, "vanUploads"), orderBy("createdAt", "desc"), fsLimit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(collection(db, "vanUploads"), fsLimit(limitCount)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

/**
 * Fetches existing catalog items for an active upload
 * Returns Map of { itemDocId => itemData }
 */
export async function getExistingCompanyCatalog(catalogUploadId) {
  if (!catalogUploadId) return new Map();
  try {
    const itemsCol = collection(db, "vanUploads", catalogUploadId, "items");
    const snap = await getDocs(itemsCol);
    const catalogMap = new Map();
    snap.docs.forEach((d) => {
      catalogMap.set(d.id, { id: d.id, ...d.data() });
    });
    return catalogMap;
  } catch (err) {
    console.warn(`getExistingCompanyCatalog error for upload ${catalogUploadId}:`, err);
    return new Map();
  }
}

/**
 * Compares incoming PDF products against the active Firestore catalog for
 * TRUE INCREMENTAL PRODUCT IMPORT (Additive Import)
 *
 * Rules:
 * 1. If product already exists (exact match on Model & Code): skip completely (0 writes).
 * 2. If product does not exist: classify as new (to be inserted).
 * 3. If product has uncertain match (same code/diff model or vice versa): flag as potential duplicate for Admin review.
 * 4. NEVER delete, deactivate, overwrite or mark existing products as removed.
 * 5. Existing catalog remains 100% active and searchable throughout.
 */
export async function compareCatalogs({ incomingItems = [], existingItemsMap = new Map() }) {
  // Deduplicate incoming items on getProductIdentity
  const uniqueIncoming = new Map();
  incomingItems.forEach((it) => {
    const id = getProductIdentity(it);
    if (id && !uniqueIncoming.has(id)) {
      uniqueIncoming.set(id, it);
    }
  });

  // Build lookup indexes of existing active catalog
  const identityMap = new Map();
  const codeMap = new Map();
  const modelMap = new Map();

  let existingActiveCount = 0;
  for (const [id, existing] of existingItemsMap.entries()) {
    const isCurrentlyActive = existing.isActive !== false && existing.status !== "inactive";
    if (isCurrentlyActive) {
      existingActiveCount++;
      const normId = id || getProductIdentity(existing);
      identityMap.set(normId, existing);

      const normCode = normalizeItemCode(existing.itemCode);
      if (normCode && !codeMap.has(normCode)) {
        codeMap.set(normCode, existing);
      }

      const normModel = extractModelKey(existing.modelKey || existing.modelNumber || existing.description);
      if (normModel && !modelMap.has(normModel)) {
        modelMap.set(normModel, existing);
      }
    }
  }

  const alreadyExisting = [];
  const potentialDuplicates = [];
  const newProducts = [];

  for (const [id, item] of uniqueIncoming.entries()) {
    const itemHash = item.productHash || (await computeProductHash(item));
    const normalizedItem = {
      ...item,
      identity: id,
      productHash: itemHash,
    };

    // 1. Exact Identity match (ModelKey + ItemCode match 100%)
    if (identityMap.has(id)) {
      alreadyExisting.push({
        ...normalizedItem,
        matchedExisting: identityMap.get(id),
        confidence: 100,
        reason: "Exact match in active catalog (Model & Code)",
      });
      continue;
    }

    // 2. Check for potential duplicate / code or model conflict
    const normCode = normalizeItemCode(item.itemCode);
    const normModel = extractModelKey(item.modelKey || item.modelNumber || item.description);
    let candidate = null;

    if (normCode && codeMap.has(normCode)) {
      candidate = codeMap.get(normCode);
    } else if (normModel && modelMap.has(normModel)) {
      candidate = modelMap.get(normModel);
    }

    if (candidate) {
      const similarity = calculateProductSimilarity(item, candidate);
      if (similarity.confidence >= 70) {
        potentialDuplicates.push({
          incomingItem: normalizedItem,
          matchedExistingItem: candidate,
          matchType: similarity.matchType,
          confidence: similarity.confidence,
          reason: similarity.reason,
          action: "skip", // Default choice for review
        });
        continue;
      }
    }

    // 3. Genuinely new product
    newProducts.push(normalizedItem);
  }

  const finalCatalogCount = existingActiveCount + newProducts.length;

  return {
    totalExtracted: uniqueIncoming.size,
    alreadyExisting,
    alreadyExistingCount: alreadyExisting.length,
    newProducts,
    newCount: newProducts.length,
    potentialDuplicates,
    potentialDuplicatesCount: potentialDuplicates.length,
    existingActiveCount,
    finalCatalogCount,
    // Backwards-compatible aliases
    unchanged: alreadyExisting,
    unchangedCount: alreadyExisting.length,
    modified: [],
    modifiedCount: 0,
    removed: [],
    removedCount: 0,
    isIntegrityWarning: false,
    totalIncoming: uniqueIncoming.size,
  };
}

/**
 * Calculates a preview of the incremental product import without writing anything to Firestore
 */
export async function previewIncrementalPublish({ companyName, itemsToPublish = [] }) {
  const companyKey = getCompanyKey(companyName);
  if (!companyKey) {
    throw new Error("Validation Error: Company name is required.");
  }

  const validItemsRaw = itemsToPublish.filter(
    (it) => it.itemCode && String(it.itemCode).trim().length > 0
  );

  const companyRef = doc(db, "vanCompanies", companyKey);
  const companySnap = await getDoc(companyRef);
  const companyData = companySnap.exists() ? companySnap.data() : null;
  const activeUploadId = companyData?.catalogUploadId || companyData?.activeUploadId || null;

  if (!activeUploadId) {
    // Brand new company, first upload
    const uniqueIncoming = new Map();
    for (const it of validItemsRaw) {
      const id = getProductIdentity(it);
      if (id && !uniqueIncoming.has(id)) {
        const itemHash = it.productHash || (await computeProductHash(it));
        uniqueIncoming.set(id, { ...it, identity: id, productHash: itemHash });
      }
    }
    const newItems = Array.from(uniqueIncoming.values());
    const newCount = newItems.length;
    return {
      companyKey,
      companyName,
      activeUploadId: null,
      isInitialPublish: true,
      totalExtracted: newCount,
      alreadyExistingCount: 0,
      newCount,
      newProducts: newItems,
      potentialDuplicatesCount: 0,
      expectedWrites: newCount + 2, // items + uploadDoc + companyDoc
      expectedReads: 0,
      writesSaved: 0,
      existingActiveCount: 0,
      finalCatalogCount: newCount,
      potentialDuplicates: [],
      // Compatibility aliases
      unchangedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
      isIntegrityWarning: false,
      comparison: {
        totalExtracted: newCount,
        alreadyExisting: [],
        alreadyExistingCount: 0,
        newProducts: newItems,
        newCount,
        potentialDuplicates: [],
        potentialDuplicatesCount: 0,
        existingActiveCount: 0,
        finalCatalogCount: newCount,
        unchanged: [],
        unchangedCount: 0,
        modified: [],
        modifiedCount: 0,
        removed: [],
        removedCount: 0,
        totalIncoming: newCount,
      },
    };
  }

  const existingItemsMap = await getExistingCompanyCatalog(activeUploadId);
  const comparison = await compareCatalogs({
    incomingItems: validItemsRaw,
    existingItemsMap,
  });

  const newCount = comparison.newCount;
  const alreadyExistingCount = comparison.alreadyExistingCount;
  const potentialDuplicatesCount = comparison.potentialDuplicatesCount;
  const expectedWrites = newCount + 2;
  const writesSaved = alreadyExistingCount;
  const expectedReads = existingItemsMap.size;

  return {
    companyKey,
    companyName,
    activeUploadId,
    isInitialPublish: false,
    totalExtracted: comparison.totalExtracted,
    alreadyExistingCount,
    newCount,
    newProducts: comparison.newProducts,
    potentialDuplicatesCount,
    expectedWrites,
    expectedReads,
    writesSaved,
    existingActiveCount: comparison.existingActiveCount,
    finalCatalogCount: comparison.finalCatalogCount,
    potentialDuplicates: comparison.potentialDuplicates,
    // Compatibility aliases
    unchangedCount: alreadyExistingCount,
    modifiedCount: 0,
    removedCount: 0,
    isIntegrityWarning: false,
    comparison,
  };
}

/**
 * Publishes new products incrementally into the active company catalog
 * TRUE INCREMENTAL PRODUCT IMPORT:
 * - 0 existing products updated
 * - 0 existing products deleted/deactivated
 * - Only genuinely new, approved products inserted (1 write each)
 * - Metadata updated with cumulative catalog count
 */
export async function publishCompanyVanData({
  companyName,
  file,
  fileHash = "",
  forcePublish = false,
  itemsToPublish,
  totalRowsRead = 0,
  user,
  onProgress,
  abortSignal,
  precomputedComparison = null,
  approvedNewProducts = null,
}) {
  const companyKey = getCompanyKey(companyName);
  if (!companyKey) {
    throw new Error("Validation Error: Company name is required.");
  }

  // Pre-publish duplicate filtering and invalid row filtering
  const validItemsRaw = itemsToPublish.filter(
    (it) => it.itemCode && String(it.itemCode).trim().length > 0
  );

  if (validItemsRaw.length === 0) {
    throw new Error("Validation Error: No valid item code rows found to publish.");
  }

  // 1. Check existing company doc for old upload ID and fileHash
  const companyRef = doc(db, "vanCompanies", companyKey);
  const companySnap = await getDoc(companyRef);
  const companyData = companySnap.exists() ? companySnap.data() : null;
  const existingActiveUploadId = companyData?.activeUploadId || null;

  // Same PDF Detection
  if (existingActiveUploadId && fileHash && !forcePublish) {
    if (companyData?.fileHash && companyData.fileHash === fileHash) {
      return {
        skipped: true,
        alreadyUpToDate: true,
        uploadId: existingActiveUploadId,
        companyKey,
        companyName,
        rowCount: companyData.rowCount || validItemsRaw.length,
        message: `Catalog is already up to date with this identical PDF for ${companyName}. Publishing skipped to save Firestore writes.`,
      };
    }
  }

  // 2. Generate new uploadId for audit / version tracking
  const uploadId = `up_${companyKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const uploadRef = doc(db, "vanUploads", uploadId);

  // Set status "publishing" (initial in-flight status)
  await setDoc(uploadRef, {
    id: uploadId,
    companyKey,
    companyName,
    fileName: file?.name || `${companyName}_catalog.pdf`,
    fileHash: fileHash || null,
    totalRowsRead: totalRowsRead || validItemsRaw.length,
    totalExtracted: validItemsRaw.length,
    rowCount: 0,
    publishedCount: 0,
    selectedCount: validItemsRaw.length,
    createdAt: serverTimestamp(),
    createdByName: user?.name || "Super Admin",
    createdBy: user?.uid || user?.id,
    status: "publishing",
  });

  // 3. Compute or use precomputed comparison
  let comparison = precomputedComparison;
  let catalogUploadId = companyData?.catalogUploadId || existingActiveUploadId;

  if (!catalogUploadId) {
    // First upload for this company: catalogUploadId will be uploadId
    catalogUploadId = uploadId;
    const uniqueIncoming = new Map();
    for (const it of validItemsRaw) {
      const id = getProductIdentity(it);
      if (id && !uniqueIncoming.has(id)) {
        const itemHash = it.productHash || (await computeProductHash(it));
        uniqueIncoming.set(id, { ...it, identity: id, productHash: itemHash });
      }
    }
    const newItems = Array.from(uniqueIncoming.values());
    comparison = {
      totalExtracted: newItems.length,
      alreadyExisting: [],
      alreadyExistingCount: 0,
      newProducts: newItems,
      newCount: newItems.length,
      potentialDuplicates: [],
      potentialDuplicatesCount: 0,
      existingActiveCount: 0,
      finalCatalogCount: newItems.length,
      unchanged: [],
      unchangedCount: 0,
      modified: [],
      modifiedCount: 0,
      removed: [],
      removedCount: 0,
    };
  } else if (!comparison) {
    const existingItemsMap = await getExistingCompanyCatalog(catalogUploadId);
    comparison = await compareCatalogs({
      incomingItems: validItemsRaw,
      existingItemsMap,
    });
  }

  // Determine products to insert: either explicitly approved new products or comparison.newProducts
  let productsToInsert = [];
  if (Array.isArray(approvedNewProducts) && approvedNewProducts.length > 0) {
    productsToInsert = approvedNewProducts;
  } else if (comparison?.newProducts && Array.isArray(comparison.newProducts)) {
    productsToInsert = comparison.newProducts;
  }

  // Prepare batch writes ONLY for new products
  const itemsCol = collection(db, "vanUploads", catalogUploadId, "items");
  const pendingWrites = [];

  productsToInsert.forEach((it) => {
    const docId = it.identity || getProductIdentity(it);
    const ref = doc(itemsCol, docId);
    const data = {
      id: docId,
      modelKey: it.modelKey || "",
      modelNumber: it.modelNumber || it.modelKey || it.description,
      itemCode: it.itemCode,
      description: (it.description || "").slice(0, 300),
      searchTokens: it.searchTokens || [],
      rawRow: it.rawRow || [],
      companyKey,
      companyName,
      catalogUploadId,
      productHash: it.productHash || "",
      isActive: true,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (it.extra && typeof it.extra === "object" && Object.keys(it.extra).length > 0) {
      const trimmedExtra = {};
      Object.keys(it.extra).slice(0, 6).forEach((k) => {
        trimmedExtra[k] = String(it.extra[k] || "").slice(0, 100);
      });
      data.extra = trimmedExtra;
    }
    pendingWrites.push({ type: "set", ref, data });
  });

  const CHUNK_SIZE = 400;
  const totalItemWrites = pendingWrites.length;
  const totalBatches = Math.max(1, Math.ceil(totalItemWrites / CHUNK_SIZE));
  const startTime = Date.now();

  if (onProgress) {
    onProgress({
      percent: 10,
      savedCount: 0,
      totalCount: totalItemWrites,
      batchesDone: 0,
      totalBatches,
      elapsedSeconds: 0,
      alreadyExistingCount: comparison.alreadyExistingCount,
      writesSaved: comparison.alreadyExistingCount,
      message: `Starting import... (0 of ${totalItemWrites} new products, ${comparison.alreadyExistingCount} existing products skipped)`,
    });
  }

  try {
    // Commit new products in chunks of 400
    for (let c = 0; c < totalBatches; c++) {
      if (abortSignal?.aborted) {
        throw new Error("Import cancelled by user. Existing catalog remains active.");
      }

      const chunk = pendingWrites.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      if (chunk.length > 0) {
        const batch = writeBatch(db);
        chunk.forEach((op) => {
          batch.set(op.ref, op.data, { merge: true });
        });

        // 45s timeout per batch
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new Error(
                `Batch ${c + 1} of ${totalBatches} timed out after 45s. Firestore quota may be exhausted, network disconnected, or permission denied.`
              )
            );
          }, 45000);
        });

        try {
          await Promise.race([batch.commit(), timeoutPromise]);
        } catch (commitErr) {
          const msg = String(commitErr?.message || commitErr);
          if (
            commitErr?.code === "resource-exhausted" ||
            msg.toLowerCase().includes("quota") ||
            msg.toLowerCase().includes("exhausted")
          ) {
            throw new Error(
              "QUOTA_EXCEEDED: Firestore daily write limit (20,000 writes/day on free Spark plan) exceeded. Upgrade to Blaze plan in Firebase Console, or wait for daily reset at 1:30 PM IST.",
              { cause: commitErr }
            );
          }
          throw commitErr;
        } finally {
          clearTimeout(timeoutHandle);
        }
      }

      const batchesDone = c + 1;
      const savedCount = Math.min(totalItemWrites, batchesDone * CHUNK_SIZE);
      const percent = 10 + Math.round((batchesDone / totalBatches) * 85);
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      if (onProgress) {
        onProgress({
          percent,
          savedCount,
          totalCount: totalItemWrites,
          batchesDone,
          totalBatches,
          elapsedSeconds,
          alreadyExistingCount: comparison.alreadyExistingCount,
          writesSaved: comparison.alreadyExistingCount,
          message: `Imported ${savedCount} of ${totalItemWrites} new products (${comparison.alreadyExistingCount} existing products preserved without writes)`,
        });
      }
    }

    if (abortSignal?.aborted) {
      throw new Error("Import cancelled by user. Existing catalog remains active.");
    }

    // 4. Calculate cumulative active catalog count: existing active + newly inserted
    const finalActiveCount = comparison.existingActiveCount + totalItemWrites;

    // 5. Update vanCompanies/{companyKey}
    await setDoc(companyRef, {
      key: companyKey,
      name: companyName,
      activeUploadId: catalogUploadId,
      catalogUploadId,
      lastUploadId: uploadId,
      fileName: file?.name || `${companyName}_catalog.pdf`,
      fileHash: fileHash || null,
      rowCount: finalActiveCount,
      lastImportedCount: totalItemWrites,
      publishedAt: new Date().toISOString(),
      publishedByName: user?.name || "Super Admin",
    });

    // 6. Update manifest doc vanUploads/{uploadId}
    await updateDoc(uploadRef, {
      status: "published",
      publishedAt: new Date().toISOString(),
      catalogUploadId,
      importType: "incremental_product_import",
      totalExtracted: comparison.totalExtracted,
      alreadyExistingCount: comparison.alreadyExistingCount,
      newCount: totalItemWrites,
      publishedCount: totalItemWrites,
      potentialDuplicatesCount: comparison.potentialDuplicatesCount || 0,
      writesSaved: comparison.alreadyExistingCount,
      writesConsumed: totalItemWrites + 2,
      rowCount: finalActiveCount,
    });

    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    if (onProgress) {
      onProgress({
        percent: 100,
        savedCount: totalItemWrites,
        totalCount: totalItemWrites,
        batchesDone: totalBatches,
        totalBatches,
        elapsedSeconds: totalElapsed,
        alreadyExistingCount: comparison.alreadyExistingCount,
        writesSaved: comparison.alreadyExistingCount,
        message: `Import complete! ${totalItemWrites} new products added. Total active catalog: ${finalActiveCount} products.`,
      });
    }

    return {
      uploadId,
      catalogUploadId,
      companyKey,
      rowCount: finalActiveCount,
      totalExtracted: comparison.totalExtracted,
      alreadyExistingCount: comparison.alreadyExistingCount,
      newCount: totalItemWrites,
      potentialDuplicatesCount: comparison.potentialDuplicatesCount || 0,
      writesSaved: comparison.alreadyExistingCount,
      writesConsumed: totalItemWrites + 2,
      // Compatibility aliases
      unchangedCount: comparison.alreadyExistingCount,
      modifiedCount: 0,
      removedCount: 0,
      skipped: false,
    };
  } catch (err) {
    // If cancelled or failed, update the upload doc status so it's clearly marked for cleanup
    try {
      const isAbort = abortSignal?.aborted || err.message?.includes("cancelled");
      await updateDoc(uploadRef, {
        status: isAbort ? "cancelled" : "failed",
        failureError: String(err.message || err).slice(0, 300),
      });
    } catch {
      // Ignore if metadata updateDoc fails
    }
    throw err;
  }
}

/**
 * Filters inactive or incomplete uploads purely in memory from existing lists (0 Firestore reads!)
 */
export function filterIncompleteOrOldUploads(companies = [], uploads = []) {
  const activeUploadIds = new Set(
    companies.flatMap((c) => [c.activeUploadId, c.catalogUploadId]).filter(Boolean)
  );
  return uploads.filter((u) => {
    if (activeUploadIds.has(u.id)) return false;
    return (
      u.status === "failed" ||
      u.status === "cancelled" ||
      u.status === "publishing" ||
      u.status === "uploading" ||
      !u.status
    );
  });
}

/**
 * Lists vanUploads documents which are NOT the activeUploadId of any company
 * Reuses existing in-memory company/upload arrays if provided to avoid duplicate reads
 */
export async function getIncompleteOrOldUploads(limitCount = 100, existingCompanies = null, existingUploads = null) {
  if (existingCompanies && existingUploads) {
    return filterIncompleteOrOldUploads(existingCompanies, existingUploads);
  }
  try {
    const [companies, uploads] = await Promise.all([
      existingCompanies || getVanCompanies(),
      existingUploads || getVanUploadHistory(limitCount),
    ]);
    return filterIncompleteOrOldUploads(companies, uploads);
  } catch (err) {
    console.warn("getIncompleteOrOldUploads error:", err);
    return [];
  }
}

/**
 * Categorizes and classifies VAN errors into clear technical domains
 */
export function classifyVanError(err) {
  if (!err) return { type: "UNKNOWN", message: "An unexpected error occurred." };
  const msg = String(err.message || err);
  const code = err.code || "";

  if (
    code === "resource-exhausted" ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("exhausted")
  ) {
    return {
      type: "FIRESTORE_QUOTA_ERROR",
      message: "Firestore daily write limit (20,000 writes/day on Spark plan) reached.",
      original: err,
    };
  }
  if (code === "permission-denied" || msg.toLowerCase().includes("permission")) {
    return {
      type: "FIRESTORE_PERMISSION_ERROR",
      message: "Firestore permission denied. Ensure you are signed in as Super Admin.",
      original: err,
    };
  }
  if (
    code === "unavailable" ||
    msg.toLowerCase().includes("network") ||
    msg.toLowerCase().includes("timed out") ||
    msg.toLowerCase().includes("timeout")
  ) {
    return {
      type: "NETWORK_ERROR",
      message: "Network request timed out or connection is unavailable.",
      original: err,
    };
  }
  if (msg.includes("Validation") || msg.includes("required") || msg.includes("valid item")) {
    return {
      type: "VALIDATION_ERROR",
      message: msg,
      original: err,
    };
  }
  if (msg.includes("PDF") || msg.includes("pdfjs") || msg.includes("scanned")) {
    return {
      type: "PDF_ERROR",
      message: msg,
      original: err,
    };
  }
  return {
    type: "PUBLISH_ERROR",
    message: msg,
    original: err,
  };
}

/**
 * Deletes an inactive or incomplete upload and all its items in batches of 450
 * Never allows deleting an upload that is currently active.
 */
export async function deleteVanUpload(uploadId, onProgress) {
  if (!uploadId) throw new Error("Upload ID is required.");

  // Safety check: ensure this upload is NOT the active upload of any company
  const companies = await getVanCompanies();
  const activeCompany = companies.find((c) => c.activeUploadId === uploadId);
  if (activeCompany) {
    throw new Error(
      `Cannot delete upload ${uploadId} because it is currently the active catalog for "${activeCompany.name}".`
    );
  }

  const itemsCol = collection(db, "vanUploads", uploadId, "items");
  let deletedCount = 0;
  const BATCH_SIZE = 450;

  while (true) {
    const snap = await getDocs(query(itemsCol, fsLimit(BATCH_SIZE)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    deletedCount += snap.docs.length;
    if (onProgress) {
      onProgress({ deletedCount });
    }
  }

  // Delete the upload document itself
  await deleteDoc(doc(db, "vanUploads", uploadId));

  return { deletedCount };
}

/**
 * Removes a company's active dataset and its vanCompanies document
 */
export async function removeCompanyVanData(companyKey) {
  const companyRef = doc(db, "vanCompanies", companyKey);
  const snap = await getDoc(companyRef);
  if (snap.exists()) {
    const activeUploadId = snap.data().catalogUploadId || snap.data().activeUploadId;
    if (activeUploadId) {
      try {
        const itemsSnap = await getDocs(collection(db, "vanUploads", activeUploadId, "items"));
        const CHUNK_SIZE = 400;
        for (let i = 0; i < itemsSnap.docs.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          itemsSnap.docs.slice(i, i + CHUNK_SIZE).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        await deleteDoc(doc(db, "vanUploads", activeUploadId));
      } catch (err) {
        console.warn("Error removing company upload items:", err);
      }
    }
  }

  await deleteDoc(companyRef);
}

/**
 * Searches across active companies in parallel
 * Queries active company catalogs by modelKey, any token word, or item code
 */
export async function searchVanItems(rawQuery, companies = []) {
  const queryStr = String(rawQuery || "").trim();
  if (!queryStr || queryStr.length < 2) return [];

  const modelKeyQuery = extractModelKey(queryStr);
  const digitsQuery = normalizeItemCode(queryStr);
  const upperTokenQuery = queryStr.toUpperCase();

  const targetCompanies = companies.filter((c) => c.activeUploadId).slice(0, 20);

  const searchPromises = targetCompanies.map(async (comp) => {
    const results = [];
    const seen = new Set();
    const itemsCol = collection(db, "vanUploads", comp.activeUploadId, "items");

    // 1. Exact lookup on modelKey (query without requiring duplicate document writes)
    if (modelKeyQuery) {
      try {
        const qExact = query(itemsCol, where("modelKey", "==", modelKeyQuery), fsLimit(5));
        const exactSnap = await getDocs(qExact);
        exactSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.isActive === false || data.status === "inactive") return;
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.unshift({ id: d.id, ...data });
          }
        });
      } catch (err) {
        console.warn(`Exact query error for company ${comp.name}:`, err);
      }

      // 2. Prefix query on modelKey (limit 8 per company)
      try {
        const qModel = query(
          itemsCol,
          where("modelKey", ">=", modelKeyQuery),
          where("modelKey", "<=", modelKeyQuery + "\uf8ff"),
          fsLimit(8)
        );
        const snap = await getDocs(qModel);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.isActive === false || data.status === "inactive") return;
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...data });
          }
        });
      } catch (err) {
        console.warn(`Prefix search error for company ${comp.name}:`, err);
      }
    }

    // 3. Search by searchTokens (array-contains for any word like "CASSETTE", "SGBT3PB")
    if (upperTokenQuery.length >= 2) {
      try {
        const qToken = query(
          itemsCol,
          where("searchTokens", "array-contains", upperTokenQuery),
          fsLimit(8)
        );
        const snap = await getDocs(qToken);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.isActive === false || data.status === "inactive") return;
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...data });
          }
        });
      } catch (err) {
        console.warn(`Token search error for company ${comp.name}:`, err);
      }
    }

    // 4. If query contains digits, also query by itemCode
    if (/^\d{3,12}$/.test(digitsQuery)) {
      try {
        const qCode = query(itemsCol, where("itemCode", "==", digitsQuery), fsLimit(8));
        const codeSnap = await getDocs(qCode);
        codeSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.isActive === false || data.status === "inactive") return;
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...data });
          }
        });
      } catch (err) {
        console.warn(`Item code search error for company ${comp.name}:`, err);
      }
    }

    return results;
  });

  const nestedResults = await Promise.all(searchPromises);
  const allResults = nestedResults.flat();

  // Deduplicate across combinations of companyKey + itemCode
  const uniqueMap = new Map();
  allResults.forEach((item) => {
    const key = `${item.companyKey}_${item.itemCode}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  return Array.from(uniqueMap.values());
}
