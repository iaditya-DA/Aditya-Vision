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
import { extractModelKey, normalizeItemCode } from "./vanPdfExtractionService";

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

/**
 * Checks for legacy vanMeta/active and migrates it to vanCompanies/imported
 */
export async function migrateLegacyVanMeta() {
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
 * Publishes parsed items for a specific company
 * Safe flow: writes new items first -> flips activeUploadId -> deletes old upload items
 */
export async function publishCompanyVanData({
  companyName,
  file,
  itemsToPublish,
  totalRowsRead = 0,
  user,
  onProgress,
}) {
  const companyKey = getCompanyKey(companyName);
  if (!companyKey) {
    throw new Error("Company name is required.");
  }

  const validItems = itemsToPublish.filter(
    (it) => it.itemCode && it.itemCode.trim().length > 0
  );

  if (validItems.length === 0) {
    throw new Error("No valid item code rows found to publish.");
  }

  // 1. Check existing company doc for old upload ID
  const companyRef = doc(db, "vanCompanies", companyKey);
  const companySnap = await getDoc(companyRef);
  const oldUploadId = companySnap.exists() ? companySnap.data().activeUploadId : null;

  // 2. Generate new uploadId
  const uploadId = `up_${companyKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 3. Write items in chunks of 400 (under Firestore 500 limit)
  const CHUNK_SIZE = 400;
  const totalChunks = Math.ceil(validItems.length / CHUNK_SIZE);

  for (let c = 0; c < totalChunks; c++) {
    const batch = writeBatch(db);
    const chunk = validItems.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);

    chunk.forEach((it) => {
      // Primary document by unique model + code
      const itemDocId = `${it.modelKey || "item"}_${it.itemCode}`;
      const itemRef = doc(db, "vanUploads", uploadId, "items", itemDocId);
      const itemData = {
        modelKey: it.modelKey || "",
        modelNumber: it.modelNumber || it.modelKey || it.description,
        itemCode: it.itemCode,
        description: (it.description || "").slice(0, 300),
        searchTokens: it.searchTokens || [],
        rawRow: it.rawRow || [],
        companyKey,
        companyName,
        uploadId,
        updatedAt: new Date().toISOString(),
      };
      // Store extra ticked column values (up to 6 entries, 100 chars each)
      if (it.extra && typeof it.extra === "object" && Object.keys(it.extra).length > 0) {
        const trimmedExtra = {};
        const keys = Object.keys(it.extra).slice(0, 6);
        keys.forEach((k) => {
          trimmedExtra[k] = String(it.extra[k] || "").slice(0, 100);
        });
        itemData.extra = trimmedExtra;
      }
      batch.set(itemRef, itemData);

      // Also index by modelKey directly for O(1) exact lookup if modelKey exists
      if (it.modelKey) {
        const exactRef = doc(db, "vanUploads", uploadId, "items", it.modelKey);
        const exactData = { ...itemData };
        delete exactData.rawRow; // avoid duplication
        batch.set(exactRef, exactData);
      }
    });

    await batch.commit();

    if (onProgress) {
      const percent = Math.round(((c + 1) / totalChunks) * 80);
      onProgress(percent);
    }
  }

  // 4. Create vanUploads/{uploadId} metadata doc
  await setDoc(doc(db, "vanUploads", uploadId), {
    id: uploadId,
    companyKey,
    companyName,
    fileName: file.name,
    totalRowsRead: totalRowsRead || validItems.length,
    rowCount: validItems.length,
    selectedCount: validItems.length,
    createdAt: serverTimestamp(),
    publishedAt: new Date().toISOString(),
    createdByName: user?.name || "Super Admin",
    createdBy: user?.uid || user?.id,
    status: "published",
  });

  if (onProgress) onProgress(90);

  // 5. Flip activeUploadId atomically on vanCompanies/{companyKey}
  await setDoc(companyRef, {
    key: companyKey,
    name: companyName,
    activeUploadId: uploadId,
    fileName: file.name,
    rowCount: validItems.length,
    publishedAt: new Date().toISOString(),
    publishedByName: user?.name || "Super Admin",
  });

  if (onProgress) onProgress(95);

  // 6. Asynchronously purge old items if present (does not block active status)
  if (oldUploadId && oldUploadId !== uploadId) {
    try {
      const oldItemsSnap = await getDocs(collection(db, "vanUploads", oldUploadId, "items"));
      for (let i = 0; i < oldItemsSnap.docs.length; i += CHUNK_SIZE) {
        const delBatch = writeBatch(db);
        oldItemsSnap.docs.slice(i, i + CHUNK_SIZE).forEach((d) => delBatch.delete(d.ref));
        await delBatch.commit();
      }
      await updateDoc(doc(db, "vanUploads", oldUploadId), {
        status: "archived",
        archivedAt: serverTimestamp(),
      });
    } catch (cleanErr) {
      console.warn("Could not purge old items for previous upload:", cleanErr);
    }
  }

  if (onProgress) onProgress(100);

  return { uploadId, companyKey, rowCount: validItems.length };
}

/**
 * Removes a company's active dataset and its vanCompanies document
 */
export async function removeCompanyVanData(companyKey) {
  const companyRef = doc(db, "vanCompanies", companyKey);
  const snap = await getDoc(companyRef);
  if (snap.exists()) {
    const activeUploadId = snap.data().activeUploadId;
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

    // 1. Exact lookup on modelKey
    if (modelKeyQuery) {
      try {
        const exactDoc = await getDoc(doc(itemsCol, modelKeyQuery));
        if (exactDoc.exists() && !seen.has(exactDoc.id)) {
          seen.add(exactDoc.id);
          results.unshift({ id: exactDoc.id, ...exactDoc.data() });
        }
      } catch (err) {
        console.warn(`Exact get error for company ${comp.name}:`, err);
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
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...d.data() });
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
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...d.data() });
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
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push({ id: d.id, ...d.data() });
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
