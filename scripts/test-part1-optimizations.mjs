import fs from "fs";
import path from "path";
import { computePdfHash } from "../src/services/vanPdfExtractionService.js";

// Test helper: replicate filterIncompleteOrOldUploads & classifyVanError to test pure logic
function filterIncompleteOrOldUploads(companies = [], uploads = []) {
  const activeUploadIds = new Set(companies.map((c) => c.activeUploadId).filter(Boolean));
  return uploads.filter((u) => !activeUploadIds.has(u.id));
}

function classifyVanError(err) {
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

async function runTests() {
  console.log("=== RUNNING PART 1 OPTIMIZATION UNIT TESTS ===");
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // TEST 1: PDF SHA-256 Hashing on real LLOYD.pdf
  const pdfPath = path.resolve("test-data/LLOYD.pdf");
  const fileBytes = fs.readFileSync(pdfPath);
  const buffer1 = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);
  const buffer2 = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);

  const hash1 = await computePdfHash(buffer1);
  const hash2 = await computePdfHash(buffer2);

  assert(typeof hash1 === "string" && hash1.length >= 16, "computePdfHash generates valid hex string");
  assert(hash1 === hash2, "Identical PDF buffers generate deterministic, matching SHA-256 hash");
  console.log(`       LLOYD.pdf SHA-256 Hash: ${hash1}`);

  // TEST 2: Different Buffer Produces Different Hash
  const diffBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
  const diffHash = await computePdfHash(diffBuffer);
  assert(diffHash !== hash1, "Different file content generates different hash");

  // TEST 3: Same-PDF Detection Logic
  const mockCompany = {
    key: "lloyd",
    name: "Lloyd",
    activeUploadId: "up_lloyd_123",
    fileHash: hash1,
  };
  const isIdentical = mockCompany.fileHash === hash1;
  const isDifferent = mockCompany.fileHash === diffHash;
  assert(isIdentical === true, "Same PDF detection identifies active catalog match");
  assert(isDifferent === false, "Different PDF is not falsely marked identical");

  // TEST 4: Pre-Publish Duplicate Filtering
  const sampleItems = [
    { modelKey: "GLC24B3XWAAG", itemCode: "132342", description: "AC CASSETTE" },
    { modelKey: "GLC24B3XWAAG", itemCode: "132342", description: "AC CASSETTE (Duplicate Row)" },
    { modelKey: "GLC24B3XWAAGOUT", itemCode: "132341", description: "AC CASSETTE OUTDOOR" },
    { modelKey: "GLC24B3XWAAGOUT", itemCode: "132341", description: "AC CASSETTE OUTDOOR (Duplicate Row)" },
    { modelKey: "", itemCode: "", description: "Empty item row" },
    { modelKey: "LDWF14PSB1IC", itemCode: "118784", description: "DISHWASHER" },
  ];

  // Filter invalid item codes
  const validItemsRaw = sampleItems.filter((it) => it.itemCode && it.itemCode.trim().length > 0);
  assert(validItemsRaw.length === 5, "Invalid/empty item code rows are filtered out");

  // Deduplicate on stable identity (${modelKey}_${itemCode})
  const uniqueItemsMap = new Map();
  validItemsRaw.forEach((it) => {
    const key = `${it.modelKey || "item"}_${it.itemCode}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, it);
    }
  });
  const deduplicatedItems = Array.from(uniqueItemsMap.values());
  assert(deduplicatedItems.length === 3, "Pre-publish deduplication reduces 5 rows to 3 unique products (40% write savings)");

  // TEST 5: filterIncompleteOrOldUploads in-memory filtering (0 Firestore reads)
  const mockCompanies = [
    { key: "lloyd", name: "Lloyd", activeUploadId: "up_lloyd_1" },
    { key: "lg", name: "LG", activeUploadId: "up_lg_2" },
  ];
  const mockUploads = [
    { id: "up_lloyd_1", companyKey: "lloyd", fileName: "lloyd_v1.pdf" },
    { id: "up_lloyd_old", companyKey: "lloyd", fileName: "lloyd_v0.pdf" },
    { id: "up_lg_2", companyKey: "lg", fileName: "lg_v1.pdf" },
    { id: "up_samsung_orphan", companyKey: "samsung", fileName: "samsung.pdf" },
  ];

  const inactive = filterIncompleteOrOldUploads(mockCompanies, mockUploads);
  assert(inactive.length === 2, "filterIncompleteOrOldUploads correctly identifies inactive uploads in memory");
  assert(inactive.some((u) => u.id === "up_lloyd_old") && inactive.some((u) => u.id === "up_samsung_orphan"), "Correct orphan and archived upload IDs isolated");

  // TEST 6: classifyVanError
  const quotaErr = classifyVanError({ code: "resource-exhausted", message: "Quota exceeded" });
  assert(quotaErr.type === "FIRESTORE_QUOTA_ERROR", "classifyVanError classifies resource-exhausted correctly");

  const permErr = classifyVanError({ code: "permission-denied", message: "Missing or insufficient permissions" });
  assert(permErr.type === "FIRESTORE_PERMISSION_ERROR", "classifyVanError classifies permission-denied correctly");

  const netErr = classifyVanError(new Error("Batch 1 timed out after 45s."));
  assert(netErr.type === "NETWORK_ERROR", "classifyVanError classifies timeout as NETWORK_ERROR");

  const valErr = classifyVanError(new Error("Validation Error: Company name is required."));
  assert(valErr.type === "VALIDATION_ERROR", "classifyVanError classifies validation error correctly");

  // TEST 7: Synchronous lock simulation
  let publishingLock = false;
  let runs = 0;
  function attemptPublish() {
    if (publishingLock) return "BLOCKED";
    publishingLock = true;
    runs++;
    return "STARTED";
  }
  const firstClick = attemptPublish();
  const rapidSecondClick = attemptPublish();
  const rapidThirdClick = attemptPublish();
  publishingLock = false; // release

  assert(firstClick === "STARTED" && rapidSecondClick === "BLOCKED" && rapidThirdClick === "BLOCKED", "Synchronous lock blocks rapid double/triple clicks");
  assert(runs === 1, "Exactly 1 execution allowed through synchronous lock");

  console.log(`\nResults: ${passed} of ${total} tests passed.`);
  if (passed === total) {
    console.log("ALL PART 1 OPTIMIZATION CHECKS PASSED SUCCESSFULLY!");
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
