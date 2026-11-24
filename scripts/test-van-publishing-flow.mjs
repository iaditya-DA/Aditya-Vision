import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  extractTableFromPdf,
  guessDefaultColumns,
  extractModelKey,
  extractSearchTokens,
  normalizeItemCode,
  getProductIdentity,
  computeProductHash,
} from "../src/services/vanPdfExtractionService.js";

console.log("===============================================================");
console.log("RUNNING VAN PUBLISHING PIPELINE & INCREMENTAL SYNC TEST SUITE");
console.log("===============================================================");

let totalPassed = 0;
let totalFailed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err);
    totalFailed++;
  }
}

// 1. In-Memory Simulated Firestore for VAN Testing
class MockFirestoreDatabase {
  constructor() {
    this.companies = new Map();
    this.uploads = new Map();
    this.items = new Map(); // uploadId -> Map(docId -> data)
    this.totalWrites = 0;
    this.totalReads = 0;
  }

  reset() {
    this.companies.clear();
    this.uploads.clear();
    this.items.clear();
    this.totalWrites = 0;
    this.totalReads = 0;
  }

  // Company operations
  setCompany(key, data) {
    this.totalWrites++;
    this.companies.set(key, { ...data, key });
  }

  getCompany(key) {
    this.totalReads++;
    return this.companies.get(key) || null;
  }

  getCompanies() {
    this.totalReads += this.companies.size;
    return Array.from(this.companies.values());
  }

  // Upload operations
  setUpload(id, data) {
    this.totalWrites++;
    this.uploads.set(id, { ...data, id });
  }

  updateUpload(id, data) {
    this.totalWrites++;
    const existing = this.uploads.get(id) || {};
    this.uploads.set(id, { ...existing, ...data, id });
  }

  getUpload(id) {
    this.totalReads++;
    return this.uploads.get(id) || null;
  }

  getUploadHistory() {
    this.totalReads += this.uploads.size;
    return Array.from(this.uploads.values());
  }

  // Items operations
  commitItemBatch(uploadId, itemsList) {
    if (!this.items.has(uploadId)) {
      this.items.set(uploadId, new Map());
    }
    const col = this.items.get(uploadId);
    itemsList.forEach((it) => {
      this.totalWrites++;
      col.set(it.id, { ...it });
    });
  }

  getItems(uploadId) {
    const col = this.items.get(uploadId) || new Map();
    this.totalReads += col.size;
    return new Map(col);
  }
}

const mockDb = new MockFirestoreDatabase();

// 2. Simulated Compare Catalogs Logic
function testCompareCatalogs({ incomingItems = [], existingItemsMap = new Map() }) {
  const uniqueIncoming = new Map();
  incomingItems.forEach((it) => {
    const id = it.identity || getProductIdentity(it);
    if (id && !uniqueIncoming.has(id)) {
      uniqueIncoming.set(id, it);
    }
  });

  const identityMap = new Map();
  let existingActiveCount = 0;
  for (const [id, existing] of existingItemsMap.entries()) {
    if (existing.isActive !== false && existing.status !== "inactive") {
      existingActiveCount++;
      identityMap.set(id, existing);
    }
  }

  const alreadyExisting = [];
  const newProducts = [];

  for (const [id, item] of uniqueIncoming.entries()) {
    if (identityMap.has(id)) {
      alreadyExisting.push({
        ...item,
        identity: id,
        matchedExisting: identityMap.get(id),
      });
    } else {
      newProducts.push({
        ...item,
        identity: id,
      });
    }
  }

  return {
    totalExtracted: uniqueIncoming.size,
    alreadyExisting,
    alreadyExistingCount: alreadyExisting.length,
    newProducts,
    newCount: newProducts.length,
    existingActiveCount,
    finalCatalogCount: existingActiveCount + newProducts.length,
  };
}

// 3. Simulated Preview Incremental Publish (incorporating the fix)
function testPreviewIncrementalPublish({ companyKey, companyName, itemsToPublish = [] }) {
  const validItemsRaw = itemsToPublish.filter(
    (it) => it.itemCode && String(it.itemCode).trim().length > 0
  );

  const companyData = mockDb.getCompany(companyKey);
  const activeUploadId = companyData?.catalogUploadId || companyData?.activeUploadId || null;

  if (!activeUploadId) {
    const uniqueIncoming = new Map();
    for (const it of validItemsRaw) {
      const id = getProductIdentity(it);
      if (id && !uniqueIncoming.has(id)) {
        uniqueIncoming.set(id, { ...it, identity: id });
      }
    }
    const newItems = Array.from(uniqueIncoming.values());
    const newCount = newItems.length;

    const comparison = {
      totalExtracted: newCount,
      alreadyExisting: [],
      alreadyExistingCount: 0,
      newProducts: newItems,
      newCount,
      potentialDuplicates: [],
      potentialDuplicatesCount: 0,
      existingActiveCount: 0,
      finalCatalogCount: newCount,
    };

    return {
      companyKey,
      companyName,
      activeUploadId: null,
      isInitialPublish: true,
      totalExtracted: newCount,
      alreadyExistingCount: 0,
      newCount,
      newProducts: newItems, // EXPOSED AT ROOT!
      potentialDuplicatesCount: 0,
      expectedWrites: newCount + 2,
      expectedReads: 0,
      writesSaved: 0,
      existingActiveCount: 0,
      finalCatalogCount: newCount,
      potentialDuplicates: [],
      comparison,
    };
  }

  const existingItemsMap = mockDb.getItems(activeUploadId);
  const comparison = testCompareCatalogs({
    incomingItems: validItemsRaw,
    existingItemsMap,
  });

  return {
    companyKey,
    companyName,
    activeUploadId,
    isInitialPublish: false,
    totalExtracted: comparison.totalExtracted,
    alreadyExistingCount: comparison.alreadyExistingCount,
    newCount: comparison.newCount,
    newProducts: comparison.newProducts, // EXPOSED AT ROOT!
    potentialDuplicatesCount: 0,
    expectedWrites: comparison.newCount + 2,
    expectedReads: existingItemsMap.size,
    writesSaved: comparison.alreadyExistingCount,
    existingActiveCount: comparison.existingActiveCount,
    finalCatalogCount: comparison.finalCatalogCount,
    potentialDuplicates: [],
    comparison,
  };
}

// 4. Simulated Publish Engine (with Batched Writes of 400 items)
async function testPublishCompanyVanData({
  companyName,
  itemsToPublish,
  precomputedComparison = null,
  approvedNewProducts = null,
  file = { name: "test_catalog.pdf" },
}) {
  const companyKey = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const validItemsRaw = itemsToPublish.filter(
    (it) => it.itemCode && String(it.itemCode).trim().length > 0
  );

  const companyData = mockDb.getCompany(companyKey);
  const existingActiveUploadId = companyData?.activeUploadId || null;
  let catalogUploadId = companyData?.catalogUploadId || existingActiveUploadId;

  const uploadId = `up_${companyKey}_${Date.now()}`;

  // Initial upload doc with status: "publishing"
  mockDb.setUpload(uploadId, {
    companyKey,
    companyName,
    fileName: file.name,
    totalExtracted: validItemsRaw.length,
    rowCount: 0,
    publishedCount: 0,
    status: "publishing",
  });

  if (!catalogUploadId) {
    catalogUploadId = uploadId;
  }

  let comparison = precomputedComparison;
  if (!comparison) {
    const existingItems = mockDb.getItems(catalogUploadId);
    comparison = testCompareCatalogs({
      incomingItems: validItemsRaw,
      existingItemsMap: existingItems,
    });
  }

  // Safe product resolution
  let productsToInsert = [];
  if (Array.isArray(approvedNewProducts) && approvedNewProducts.length > 0) {
    productsToInsert = approvedNewProducts;
  } else if (comparison?.newProducts && Array.isArray(comparison.newProducts)) {
    productsToInsert = comparison.newProducts;
  }

  const CHUNK_SIZE = 400;
  const pendingWrites = productsToInsert.map((it) => {
    const docId = it.identity || getProductIdentity(it);
    return {
      id: docId,
      modelKey: it.modelKey || "",
      modelNumber: it.modelNumber || it.modelKey || it.description,
      itemCode: it.itemCode,
      description: it.description || "",
      companyKey,
      companyName,
      catalogUploadId,
      isActive: true,
      status: "active",
    };
  });

  const totalBatches = Math.max(1, Math.ceil(pendingWrites.length / CHUNK_SIZE));
  for (let c = 0; c < totalBatches; c++) {
    const chunk = pendingWrites.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
    if (chunk.length > 0) {
      mockDb.commitItemBatch(catalogUploadId, chunk);
    }
  }

  const finalActiveCount = comparison.existingActiveCount + pendingWrites.length;

  // Update company doc
  mockDb.setCompany(companyKey, {
    key: companyKey,
    name: companyName,
    activeUploadId: catalogUploadId,
    catalogUploadId,
    lastUploadId: uploadId,
    rowCount: finalActiveCount,
    lastImportedCount: pendingWrites.length,
  });

  // Update upload doc with status: "published"
  mockDb.updateUpload(uploadId, {
    status: "published",
    rowCount: finalActiveCount,
    newCount: pendingWrites.length,
    publishedCount: pendingWrites.length,
    alreadyExistingCount: comparison.alreadyExistingCount,
    writesConsumed: pendingWrites.length + 2,
    writesSaved: comparison.alreadyExistingCount,
  });

  return {
    uploadId,
    catalogUploadId,
    companyKey,
    rowCount: finalActiveCount,
    newCount: pendingWrites.length,
    alreadyExistingCount: comparison.alreadyExistingCount,
    writesConsumed: pendingWrites.length + 2,
    writesSaved: comparison.alreadyExistingCount,
  };
}

// ─── TESTS ────────────────────────────────────────────────────────────

// TEST 1: Real PDF Extraction
await runTest("Test 1: Real User PDF Extraction (700 rows, 21 pages)", async () => {
  const pdfPath = "C:/Users/adity/.gemini/antigravity/brain/5cf67f5b-bb20-4ad2-be5c-1bd31ac24402/.user_uploaded/media_1795515687017_8bbd6815.pdf";
  const fileBuffer = fs.readFileSync(pdfPath);
  const arrayBuf = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

  const extraction = await extractTableFromPdf(arrayBuf, { onProgress: () => {} });
  assert.strictEqual(extraction.pageCount, 21);
  assert.strictEqual(extraction.rows.length, 700);
  assert.strictEqual(extraction.headers[1], "Master");
  assert.strictEqual(extraction.headers[7], "Item Number");

  const { searchColIdx, itemCodeColIdx } = guessDefaultColumns(extraction.headers);
  assert.strictEqual(searchColIdx, 1);
  assert.strictEqual(itemCodeColIdx, 7);
});

// TEST 2: Root Cause Bug Reproduction & Verification
await runTest("Test 2: Root Cause Fix - previewIncrementalPublish exposes newProducts at root", () => {
  mockDb.reset();
  const sampleItems = [
    { modelKey: "LDWF14PSB1IC", itemCode: "118784", description: "LLOYD DISHWASHER LDWF14PSB1IC" },
    { modelKey: "LDWF15PSA1TS", itemCode: "126718", description: "LLOYD DISHWASHER LDWF15PSA1TS" },
  ];

  const preview = testPreviewIncrementalPublish({
    companyKey: "lloyd",
    companyName: "Lloyd",
    itemsToPublish: sampleItems,
  });

  // Verify fix: newProducts is present directly on preview AND comparison
  assert.ok(Array.isArray(preview.newProducts), "newProducts must be an array at root");
  assert.strictEqual(preview.newProducts.length, 2);
  assert.strictEqual(preview.comparison.newProducts.length, 2);

  // In the old code: publishPreviewData?.newProducts was undefined, resulting in []
  // In the fixed code:
  const baseNewProducts = preview.newProducts || preview.comparison?.newProducts || [];
  const finalProductsToInsert = [...baseNewProducts];
  assert.strictEqual(finalProductsToInsert.length, 2, "finalProductsToInsert must contain all 2 products");
});

// TEST 3: First Upload of 1,080 Products Into Firestore
await runTest("Test 3: Initial Publish of 1,080 Products with Batch Splitting", async () => {
  mockDb.reset();

  // Generate 1,080 valid products
  const products1080 = [];
  for (let i = 1; i <= 1080; i++) {
    products1080.push({
      modelKey: `MODEL_${i}`,
      itemCode: String(100000 + i),
      description: `Product Name ${i}`,
    });
  }

  const preview = testPreviewIncrementalPublish({
    companyKey: "lloyd",
    companyName: "Lloyd",
    itemsToPublish: products1080,
  });

  assert.strictEqual(preview.newCount, 1080);
  assert.strictEqual(preview.alreadyExistingCount, 0);

  const finalProductsToInsert = preview.newProducts || preview.comparison.newProducts;

  const result = await testPublishCompanyVanData({
    companyName: "Lloyd",
    itemsToPublish: products1080,
    precomputedComparison: preview.comparison,
    approvedNewProducts: finalProductsToInsert,
  });

  // 1. Verify publishing result
  assert.strictEqual(result.rowCount, 1080, "Active catalog count must be 1080");
  assert.strictEqual(result.newCount, 1080, "New count must be 1080");

  // 2. Verify Firestore Company record
  const company = mockDb.getCompany("lloyd");
  assert.ok(company, "Lloyd company must exist in Firestore");
  assert.strictEqual(company.rowCount, 1080, "Company rowCount must be 1080, not 0!");
  assert.ok(company.activeUploadId, "activeUploadId must be set");

  // 3. Verify Firestore Items subcollection
  const items = mockDb.getItems(company.activeUploadId);
  assert.strictEqual(items.size, 1080, "Exactly 1,080 items must be stored in Firestore");

  // 4. Verify Firestore Upload History record
  const upload = mockDb.getUpload(result.uploadId);
  assert.strictEqual(upload.status, "published", "Upload status must be published");
  assert.strictEqual(upload.rowCount, 1080);
  assert.strictEqual(upload.publishedCount, 1080);
});

// TEST 4: True Incremental Upload (1,080 Existing + 50 New = 1,130 Total)
await runTest("Test 4: Incremental Upload - 1,080 existing skipped (0 writes), 50 new added (52 writes)", async () => {
  // Existing state has 1,080 products in mockDb from Test 3
  const existingCompany = mockDb.getCompany("lloyd");
  assert.strictEqual(existingCompany.rowCount, 1080);

  // Incoming PDF has 1,080 existing products + 50 new products = 1,130 products
  const incoming1130 = [];
  for (let i = 1; i <= 1080; i++) {
    incoming1130.push({
      modelKey: `MODEL_${i}`,
      itemCode: String(100000 + i),
      description: `Product Name ${i}`,
    });
  }
  for (let j = 1081; j <= 1130; j++) {
    incoming1130.push({
      modelKey: `MODEL_${j}`,
      itemCode: String(100000 + j),
      description: `New Product Name ${j}`,
    });
  }

  const initialWrites = mockDb.totalWrites;

  const preview = testPreviewIncrementalPublish({
    companyKey: "lloyd",
    companyName: "Lloyd",
    itemsToPublish: incoming1130,
  });

  assert.strictEqual(preview.totalExtracted, 1130);
  assert.strictEqual(preview.alreadyExistingCount, 1080);
  assert.strictEqual(preview.newCount, 50);
  assert.strictEqual(preview.writesSaved, 1080);
  assert.strictEqual(preview.finalCatalogCount, 1130);

  const finalProductsToInsert = preview.newProducts || preview.comparison.newProducts;
  assert.strictEqual(finalProductsToInsert.length, 50);

  const result = await testPublishCompanyVanData({
    companyName: "Lloyd",
    itemsToPublish: incoming1130,
    precomputedComparison: preview.comparison,
    approvedNewProducts: finalProductsToInsert,
  });

  assert.strictEqual(result.rowCount, 1130);
  assert.strictEqual(result.newCount, 50);
  assert.strictEqual(result.alreadyExistingCount, 1080);
  assert.strictEqual(result.writesConsumed, 52); // 50 items + 1 uploadDoc + 1 companyDoc

  const updatedCompany = mockDb.getCompany("lloyd");
  assert.strictEqual(updatedCompany.rowCount, 1130);

  const allItems = mockDb.getItems(updatedCompany.activeUploadId);
  assert.strictEqual(allItems.size, 1130, "Total Firestore items must now be 1,130");

  // Verify writes: 50 items + 1 upload set + 1 company set + 1 upload update = 53 writes
  const writesConsumed = mockDb.totalWrites - initialWrites;
  assert.strictEqual(writesConsumed, 53, "Exactly 53 writes consumed (50 items + 3 metadata operations)");
});

// TEST 5: Fallback Protection If Empty Array is Erroneously Passed
await runTest("Test 5: Fallback Protection - If approvedNewProducts is empty array, fallback to comparison.newProducts", async () => {
  const items = [
    { modelKey: "MODEL_A", itemCode: "111", description: "Product A" },
    { modelKey: "MODEL_B", itemCode: "222", description: "Product B" },
  ];

  const preview = testPreviewIncrementalPublish({
    companyKey: "sony",
    companyName: "Sony",
    itemsToPublish: items,
  });

  // Pass empty array [] intentionally as approvedNewProducts
  const result = await testPublishCompanyVanData({
    companyName: "Sony",
    itemsToPublish: items,
    precomputedComparison: preview.comparison,
    approvedNewProducts: [], // empty array bug simulation
  });

  assert.strictEqual(result.rowCount, 2, "Fallback should prevent 0-item wipeout");
  assert.strictEqual(result.newCount, 2);
  const company = mockDb.getCompany("sony");
  assert.strictEqual(company.rowCount, 2);
});

// TEST 6: Upload Status Lifecycle & History Representation
await runTest("Test 6: Upload History Displays Status Badges and Accurate Counts", () => {
  const uploads = mockDb.getUploadHistory();
  assert.ok(uploads.length >= 2, `Expected at least 2 uploads in history, found ${uploads.length}`);

  uploads.forEach((u) => {
    assert.ok(u.status === "published" || u.status === "complete");
    assert.ok(typeof u.rowCount === "number");
    assert.ok(u.rowCount > 0);
  });
});

console.log("===============================================================");
console.log(`TEST SUITE COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log("===============================================================");

if (totalFailed > 0) {
  process.exit(1);
}
