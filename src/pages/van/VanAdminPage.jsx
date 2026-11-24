import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  FileSpreadsheet,
  Building2,
  Trash2,
  CheckCircle2,
  Search,
  Loader2,
  Bookmark,
  AlertTriangle,
  Filter,
  X,
  ArrowRight,
  RefreshCw,
  Clock,
  ExternalLink,
  Edit2,
  AlertCircle,
  Eye,
  RotateCcw,
  Maximize2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Pagination from "../../components/common/Pagination";
import {
  extractTableFromPdf,
  extractTableFromParsedPdf,
  guessDefaultColumns,
  extractModelKey,
  extractSearchTokens,
  normalizeItemCode,
} from "../../services/vanPdfExtractionService";
import {
  getVanCompanies,
  getVanPresets,
  saveVanPreset,
  getVanUploadHistory,
  publishCompanyVanData,
  removeCompanyVanData,
  migrateLegacyVanMeta,
  getCompanyKey,
} from "../../services/vanService";
import { formatDate } from "../../utils/formatters";

const PAGE_SIZE = 50;

const VanAdminPage = () => {
  const toast = useToast();
  const { user, isSuperAdmin } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [presets, setPresets] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Upload & File State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [readingStatusText, setReadingStatusText] = useState("");
  const [parsingPdf, setParsingPdf] = useState(false);
  const [scannedAlert, setScannedAlert] = useState(false);

  // Company Selection
  const [selectedCompany, setSelectedCompany] = useState("");
  const [newCompanyInput, setNewCompanyInput] = useState("");
  const [isNewCompany, setIsNewCompany] = useState(false);

  // Parsed PDF In-Memory Data and Table Result
  const [parsedPdfCache, setParsedPdfCache] = useState(null);
  const [rawGrid, setRawGrid] = useState({
    headers: [],
    rows: [],
    pageCount: 0,
    rowDetectionFailed: false,
    failureReason: "",
    lastSno: 0,
    missingSno: [],
    anchorCol: 0,
    tableArea: null,
    colBoundaries: [],
  });

  // Admin Controls State
  const [tableArea, setTableArea] = useState(null); // { left, right, top, bottom } fractions
  const [colBoundaries, setColBoundaries] = useState([]); // absolute or fractional
  const [anchorColName, setAnchorColName] = useState("auto");
  const [headerLineCount, setHeaderLineCount] = useState("auto");

  // Page Preview Canvas
  const [showPreview, setShowPreview] = useState(true);
  const [previewPageNum, setPreviewPageNum] = useState(1);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  // Column Mapping
  const [searchColIdx, setSearchColIdx] = useState(1);
  const [itemCodeColIdx, setItemCodeColIdx] = useState(7);
  const [savingPreset, setSavingPreset] = useState(false);
  const [tickedCols, setTickedCols] = useState(new Set());

  // Row Selection & Editing
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [lastClickedRowIdx, setLastClickedRowIdx] = useState(null);
  const [editedCells, setEditedCells] = useState({});
  const [editingCell, setEditingCell] = useState(null);

  // Filtering & Pagination
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [filterColumnIdx, setFilterColumnIdx] = useState(-1);
  const [filterColumnValue, setFilterColumnValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Publish Dialog & Deletion
  const [isConfirmPublishOpen, setIsConfirmPublishOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [deleteTargetCompany, setDeleteTargetCompany] = useState(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const fileInputRef = useRef(null);

  // ─── Load Initial Data ─────────────────────────────────
  const loadInitialData = useCallback(async () => {
    setLoadingInitial(true);
    try {
      await migrateLegacyVanMeta();
      const [compList, presetList, histList] = await Promise.all([
        getVanCompanies(),
        getVanPresets(),
        getVanUploadHistory(25),
      ]);
      setCompanies(compList);
      setPresets(presetList);
      setHistory(histList);
    } catch (err) {
      console.warn("Failed to load initial VAN data:", err);
      toast.error("Could not load initial catalog data.");
    } finally {
      setLoadingInitial(false);
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await migrateLegacyVanMeta();
        const [compList, presetList, histList] = await Promise.all([
          getVanCompanies(),
          getVanPresets(),
          getVanUploadHistory(25),
        ]);
        if (mounted) {
          setCompanies(compList);
          setPresets(presetList);
          setHistory(histList);
          setLoadingInitial(false);
        }
      } catch (err) {
        console.warn("Failed to load initial VAN data:", err);
        if (mounted) {
          toast.error("Could not load initial catalog data.");
          setLoadingInitial(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  // ─── Effective Company Name ────────────────────────────
  const effectiveCompanyName = useMemo(() => {
    if (isNewCompany) return newCompanyInput.trim();
    if (selectedCompany) {
      const found = companies.find((c) => c.key === selectedCompany);
      return found ? found.name : selectedCompany;
    }
    return "";
  }, [isNewCompany, newCompanyInput, selectedCompany, companies]);

  // ─── PDF Upload & In-Memory Extraction ─────────────────
  const handlePdfUpload = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a valid PDF document.");
      return;
    }

    setUploadedFile(file);
    setParsingPdf(true);
    setReadingProgress(10);
    setReadingStatusText("Reading PDF into browser memory...");
    setScannedAlert(false);

    try {
      const buffer = await file.arrayBuffer();

      // Check if a preset exists for this company
      const effKey = getCompanyKey(effectiveCompanyName);
      const matchingPreset = presets.find((p) => getCompanyKey(p.companyName) === effKey);

      let initialOptions = {};
      if (matchingPreset) {
        initialOptions = {
          tableArea: matchingPreset.tableArea,
          colBoundaries: matchingPreset.colBoundaries,
          anchorColName: matchingPreset.anchorColName || "auto",
          headerLineCount: matchingPreset.headerLineCount !== undefined ? matchingPreset.headerLineCount : "auto",
        };
      }

      const result = await extractTableFromPdf(buffer, {
        ...initialOptions,
        onProgress: (pct, pageNum, totalPages) => {
          setReadingProgress(pct);
          setReadingStatusText(`Parsing page ${pageNum} of ${totalPages}...`);
        },
      });

      if (result.isScanned || result.rows.length === 0) {
        setScannedAlert(true);
      }

      setParsedPdfCache(result.parsedPdfData);
      setTableArea(result.tableArea);
      setColBoundaries(result.colBoundaries);
      setAnchorColName(initialOptions.anchorColName || "auto");
      setHeaderLineCount(initialOptions.headerLineCount || "auto");

      setRawGrid({
        headers: result.headers,
        rows: result.rows,
        pageCount: result.pageCount,
        rowDetectionFailed: result.rowDetectionFailed || false,
        failureReason: result.failureReason || "",
        lastSno: result.lastSno || 0,
        missingSno: result.missingSno || [],
        anchorCol: result.anchorCol || 0,
        tableArea: result.tableArea,
        colBoundaries: result.colBoundaries,
      });

      // Default: tick all columns, select valid rows
      setTickedCols(new Set(result.headers));
      const allIds = new Set();
      const { searchColIdx: defSearch, itemCodeColIdx: defCode } = guessDefaultColumns(result.headers);

      result.rows.forEach((r) => {
        const codeVal = normalizeItemCode(r._rawValues[defCode >= 0 ? defCode : result.headers.length - 1] || "");
        if (codeVal) allIds.add(r._rowId);
      });
      if (allIds.size === 0) {
        result.rows.forEach((r) => allIds.add(r._rowId));
      }
      setSelectedRowIds(allIds);

      setSearchColIdx(defSearch >= 0 ? defSearch : 1);
      setItemCodeColIdx(defCode >= 0 ? defCode : Math.max(0, result.headers.length - 1));

      // Preset notification
      if (matchingPreset) {
        if (!result.rowDetectionFailed) {
          toast.success(`Preset applied: ${effectiveCompanyName}`);
        } else {
          toast.warning(`Preset gave an invalid result; reset to auto-detect.`);
          handleResetToAuto(result.parsedPdfData);
        }
      } else {
        toast.success(`Extracted ${result.rows.length} rows across ${result.pageCount} page(s).`);
      }

      setEditedCells({});
      setEditingCell(null);
      setTableSearchQuery("");
      setFilterColumnIdx(-1);
      setFilterColumnValue("");
      setCurrentPage(1);
      setPreviewPageNum(1);
    } catch (err) {
      console.error("PDF table extraction failed:", err);
      toast.error(err.message || "Failed to extract table structure from PDF.");
    } finally {
      setParsingPdf(false);
    }
  };

  // ─── Instant Re-parsing when Admin changes controls ────
  const reparseWithParams = useCallback(
    (newArea, newBounds, newAnchorName, newHeaderLines) => {
      if (!parsedPdfCache) return;
      try {
        const opts = {
          tableArea: newArea,
          colBoundaries: newBounds,
          anchorColName: newAnchorName,
          headerLineCount: newHeaderLines,
        };
        const result = extractTableFromParsedPdf(parsedPdfCache, opts);

        setRawGrid({
          headers: result.headers,
          rows: result.rows,
          pageCount: result.pageCount,
          rowDetectionFailed: result.rowDetectionFailed || false,
          failureReason: result.failureReason || "",
          lastSno: result.lastSno || 0,
          missingSno: result.missingSno || [],
          anchorCol: result.anchorCol || 0,
          tableArea: result.tableArea,
          colBoundaries: result.colBoundaries,
        });

        // Retain ticks for matching header names
        setTickedCols((prev) => {
          const next = new Set();
          result.headers.forEach((h) => {
            if (prev.has(h) || prev.size === 0) next.add(h);
          });
          if (next.size === 0) result.headers.forEach((h) => next.add(h));
          return next;
        });

        // Refresh selection
        const allIds = new Set();
        result.rows.forEach((r) => allIds.add(r._rowId));
        setSelectedRowIds(allIds);
      } catch (err) {
        console.warn("Reparse failed:", err);
      }
    },
    [parsedPdfCache]
  );

  const handleResetToAuto = (cache = parsedPdfCache) => {
    if (!cache) return;
    try {
      const result = extractTableFromParsedPdf(cache, {});
      setTableArea(result.tableArea);
      setColBoundaries(result.colBoundaries);
      setAnchorColName("auto");
      setHeaderLineCount("auto");

      setRawGrid({
        headers: result.headers,
        rows: result.rows,
        pageCount: result.pageCount,
        rowDetectionFailed: result.rowDetectionFailed || false,
        failureReason: result.failureReason || "",
        lastSno: result.lastSno || 0,
        missingSno: result.missingSno || [],
        anchorCol: result.anchorCol || 0,
        tableArea: result.tableArea,
        colBoundaries: result.colBoundaries,
      });
      setTickedCols(new Set(result.headers));
      toast.info("Reset table detection to auto.");
    } catch (err) {
      toast.error("Auto reset failed: " + err.message);
    }
  };

  const handleMergeWithNextColumn = (colIdx) => {
    if (!rawGrid.colBoundaries || colIdx >= rawGrid.headers.length - 1) return;
    const updatedBounds = rawGrid.colBoundaries.filter((_, idx) => idx !== colIdx + 1);
    setColBoundaries(updatedBounds);
    reparseWithParams(tableArea, updatedBounds, anchorColName, headerLineCount);
    toast.info(`Merged column "${rawGrid.headers[colIdx]}" with "${rawGrid.headers[colIdx + 1]}".`);
  };

  const handleResetColumnsToAuto = () => {
    setColBoundaries(null);
    reparseWithParams(tableArea, null, anchorColName, headerLineCount);
    toast.info("Reset column boundaries to auto.");
  };

  // ─── Render Page Preview Canvas ────────────────────────
  useEffect(() => {
    if (!parsedPdfCache?.pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await parsedPdfCache.pdfDoc.getPage(previewPageNum);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const containerWidth = canvas.parentElement?.clientWidth || 700;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(1.2, containerWidth / unscaledViewport.width);
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.warn("Preview render error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsedPdfCache, previewPageNum]);

  // ─── Canvas Mouse Drawing for Table Area ───────────────
  const handleCanvasMouseDown = (e) => {
    if (!isDrawingArea || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDrawStart({ x, y });
  };

  const handleCanvasMouseUp = (e) => {
    if (!isDrawingArea || !drawStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newArea = {
      left: Math.min(drawStart.x, x),
      right: Math.max(drawStart.x, x),
      top: Math.min(drawStart.y, y),
      bottom: Math.max(drawStart.y, y),
    };

    if (newArea.right - newArea.left > 0.1 && newArea.bottom - newArea.top > 0.05) {
      setTableArea(newArea);
      setIsDrawingArea(false);
      setDrawStart(null);
      reparseWithParams(newArea, null, anchorColName, headerLineCount);
      toast.success("Updated table bounding area.");
    } else {
      setDrawStart(null);
    }
  };

  // ─── Helper to Read Cell Values with Edits ─────────────
  const getCellValue = useCallback(
    (row, colIdx) => {
      if (editedCells[row._rowId]?.[colIdx] !== undefined) {
        return editedCells[row._rowId][colIdx];
      }
      return row._rawValues[colIdx] || "";
    },
    [editedCells]
  );

  const handleCellEdit = (rowId, colIdx, value) => {
    setEditedCells((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [colIdx]: value },
    }));
  };

  // ─── Health Checks Calculation ─────────────────────────
  const healthChecks = useMemo(() => {
    if (rawGrid.rows.length === 0) {
      return { failed: false, reason: "", junkCount: 0, multiTokenCount: 0, emptyAnchorCount: 0 };
    }

    let junkCount = 0;
    let multiTokenCount = 0;
    let emptyAnchorCount = 0;

    rawGrid.rows.forEach((r) => {
      // Empty anchor
      const anchorVal = getCellValue(r, rawGrid.anchorCol);
      if (!anchorVal || !anchorVal.trim()) emptyAnchorCount++;

      // Junk row: > 75% of cells empty
      const emptyCells = r._rawValues.filter((v) => !v || !v.trim()).length;
      if (emptyCells / r._rawValues.length >= 0.75) junkCount++;

      // Corrupted multi-token cells (> 3 tokens of 5-7 digits)
      for (const val of r._rawValues) {
        const tokens = (val || "").match(/\b\d{5,7}\b/g);
        if (tokens && tokens.length > 3) multiTokenCount++;
      }
    });

    let failed = rawGrid.rowDetectionFailed;
    let reason = rawGrid.failureReason;

    if (!failed && junkCount > rawGrid.rows.length * 0.25) {
      failed = true;
      reason = `${junkCount} junk rows detected with mostly empty cells.`;
    }
    if (!failed && multiTokenCount > 0) {
      failed = true;
      reason = `Corrupted cells detected with concatenated digit tokens.`;
    }

    return { failed, reason, junkCount, multiTokenCount, emptyAnchorCount };
  }, [rawGrid, getCellValue]);

  // ─── Validation Stats for Save Bar ─────────────────────
  const validationStats = useMemo(() => {
    if (rawGrid.rows.length === 0) {
      return { totalSelected: 0, emptyCodeCount: 0, duplicateCount: 0, validItems: [] };
    }
    let emptyCount = 0;
    const codeCounts = new Map();
    const validItems = [];

    rawGrid.rows.forEach((r) => {
      if (!selectedRowIds.has(r._rowId)) return;
      const codeRaw = getCellValue(r, itemCodeColIdx);
      const code = normalizeItemCode(codeRaw);
      if (!code) {
        emptyCount++;
        return;
      }
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);

      const searchCell = getCellValue(r, searchColIdx);
      const modelKey = extractModelKey(searchCell);
      const searchTokens = extractSearchTokens(searchCell);

      // Build extra dictionary from ticked columns
      const extra = {};
      let extraCount = 0;
      rawGrid.headers.forEach((h, idx) => {
        if (idx === searchColIdx || idx === itemCodeColIdx) return;
        if (!tickedCols.has(h)) return;
        if (extraCount >= 6) return;
        const val = getCellValue(r, idx);
        if (val && val.trim()) {
          extra[h] = val.trim().slice(0, 100);
          extraCount++;
        }
      });

      validItems.push({
        rowId: r._rowId,
        modelKey,
        modelNumber: modelKey || searchCell,
        itemCode: code,
        description: searchCell,
        searchTokens,
        rawRow: rawGrid.headers.map((_, idx) => getCellValue(r, idx)),
        extra: Object.keys(extra).length > 0 ? extra : undefined,
      });
    });

    let duplicateCount = 0;
    codeCounts.forEach((cnt) => {
      if (cnt > 1) duplicateCount += cnt - 1;
    });

    return { totalSelected: selectedRowIds.size, emptyCodeCount: emptyCount, duplicateCount, validItems };
  }, [rawGrid.rows, rawGrid.headers, selectedRowIds, itemCodeColIdx, searchColIdx, getCellValue, tickedCols]);

  // ─── Filtering & Pagination ────────────────────────────
  const filterColumnOptions = useMemo(() => {
    if (filterColumnIdx === -1 || rawGrid.rows.length === 0) return [];
    const counts = new Map();
    rawGrid.rows.forEach((r) => {
      const val = (getCellValue(r, filterColumnIdx) || "").trim();
      if (val) counts.set(val, (counts.get(val) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filterColumnIdx, rawGrid.rows, getCellValue]);

  const filteredRows = useMemo(() => {
    return rawGrid.rows.filter((r) => {
      if (filterColumnIdx !== -1 && filterColumnValue) {
        if (getCellValue(r, filterColumnIdx).trim() !== filterColumnValue) return false;
      }
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase().trim();
        const rowText = rawGrid.headers.map((_, idx) => getCellValue(r, idx)).join(" ").toLowerCase();
        if (!rowText.includes(q)) return false;
      }
      return true;
    });
  }, [rawGrid.rows, rawGrid.headers, filterColumnIdx, filterColumnValue, tableSearchQuery, getCellValue]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;

  // ─── Selection Actions ─────────────────────────────────
  const handleToggleRow = (rowId, rowIdx, e) => {
    if (e?.shiftKey && lastClickedRowIdx !== null) {
      const startIdx = Math.min(lastClickedRowIdx, rowIdx);
      const endIdx = Math.max(lastClickedRowIdx, rowIdx);
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        for (let i = startIdx; i <= endIdx; i++) next.add(filteredRows[i]._rowId);
        return next;
      });
    } else {
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
        return next;
      });
    }
    setLastClickedRowIdx(rowIdx);
  };

  const handleSelectAll = () => setSelectedRowIds(new Set(rawGrid.rows.map((r) => r._rowId)));
  const handleDeselectAll = () => setSelectedRowIds(new Set());
  const handleSelectThisPage = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      paginatedRows.forEach((r) => next.add(r._rowId));
      return next;
    });
  };
  const handleDeselectThisPage = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      paginatedRows.forEach((r) => next.delete(r._rowId));
      return next;
    });
  };

  const handleSelectRange = () => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (isNaN(from) || isNaN(to) || from > to) {
      toast.error("Enter a valid row range (from N to M).");
      return;
    }
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      rawGrid.rows.forEach((r) => {
        const sno = parseInt(getCellValue(r, 0), 10);
        if (!isNaN(sno) && sno >= from && sno <= to) next.add(r._rowId);
      });
      return next;
    });
    toast.success(`Selected rows ${from} to ${to}.`);
  };

  // ─── Column Ticks ──────────────────────────────────────
  const handleToggleColTick = (headerText) => {
    if (headerText === rawGrid.headers[searchColIdx] || headerText === rawGrid.headers[itemCodeColIdx]) return;
    setTickedCols((prev) => {
      const next = new Set(prev);
      if (next.has(headerText)) next.delete(headerText);
      else next.add(headerText);
      return next;
    });
  };

  const handleSelectAllCols = () => setTickedCols(new Set(rawGrid.headers));
  const handleDeselectOptionalCols = () => {
    const req = new Set();
    if (rawGrid.headers[searchColIdx]) req.add(rawGrid.headers[searchColIdx]);
    if (rawGrid.headers[itemCodeColIdx]) req.add(rawGrid.headers[itemCodeColIdx]);
    setTickedCols(req);
  };

  // ─── Save Preset ───────────────────────────────────────
  const handleSavePreset = async () => {
    if (!effectiveCompanyName) {
      toast.error("Please enter or select a Company Name.");
      return;
    }
    setSavingPreset(true);
    try {
      const p1Width = parsedPdfCache?.pages?.[0]?.width || 1;
      const fracBounds = colBoundaries
        ? colBoundaries.map((b) => (b <= 1.0 ? b : b / p1Width))
        : null;

      await saveVanPreset(
        {
          companyName: effectiveCompanyName,
          searchColumnHeader: rawGrid.headers[searchColIdx] || "",
          itemCodeColumnHeader: rawGrid.headers[itemCodeColIdx] || "",
          tickedColumnHeaders: rawGrid.headers.filter((h) => tickedCols.has(h)),
          tableArea,
          colBoundaries: fracBounds,
          anchorColName,
          headerLineCount,
        },
        user
      );
      toast.success(`Preset format saved for ${effectiveCompanyName}!`);
      const updated = await getVanPresets();
      setPresets(updated);
    } catch (err) {
      console.error("Save preset error:", err);
      toast.error("Failed to save preset format.");
    } finally {
      setSavingPreset(false);
    }
  };

  // ─── Publish Catalog ───────────────────────────────────
  const handlePublishCatalog = async () => {
    if (!effectiveCompanyName) {
      toast.error("Company Name is required.");
      return;
    }
    if (validationStats.validItems.length === 0) {
      toast.error("No valid items to publish.");
      return;
    }
    setIsConfirmPublishOpen(false);
    setIsPublishing(true);
    setPublishProgress(10);
    try {
      await publishCompanyVanData({
        companyName: effectiveCompanyName,
        file: uploadedFile || { name: `${effectiveCompanyName}_catalog.pdf` },
        itemsToPublish: validationStats.validItems,
        totalRowsRead: rawGrid.rows.length,
        user,
        onProgress: (pct) => setPublishProgress(pct),
      });
      toast.success(`Catalog saved: ${validationStats.validItems.length} products published for ${effectiveCompanyName}!`);
      await loadInitialData();
      setUploadedFile(null);
      setParsedPdfCache(null);
      setRawGrid({ headers: [], rows: [], pageCount: 0, rowDetectionFailed: false, failureReason: "", lastSno: 0, missingSno: [] });
      setSelectedRowIds(new Set());
      setEditedCells({});
    } catch (err) {
      console.error("Publish error:", err);
      toast.error(err.message || "Failed to save catalog.");
    } finally {
      setIsPublishing(false);
      setPublishProgress(0);
    }
  };

  // ─── Delete Company ────────────────────────────────────
  const handleDeleteCompanyConfirm = async () => {
    if (!deleteTargetCompany) return;
    setIsDeletingCompany(true);
    try {
      await removeCompanyVanData(deleteTargetCompany.key);
      toast.success(`Catalog for ${deleteTargetCompany.name} removed.`);
      setDeleteTargetCompany(null);
      await loadInitialData();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete company catalog.");
    } finally {
      setIsDeletingCompany(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* ── TOP HEADER ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#FFF1F0] text-[#E53935]">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#202124]">VAN Number & Price List Upload</h1>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#E53935] text-[10px] font-bold uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Generic multi-company PDF table reader with instant page preview and custom overrides.
              </p>
            </div>
          </div>
          <Link
            to="/van/search"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#202124] text-xs font-semibold transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-[#E53935]" />
            <span>Search Portal</span>
            <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
          </Link>
        </div>
      </div>

      {/* ── STEP 1: UPLOAD & COMPANY SELECTOR ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F3F4F6]">
          <span className="w-6 h-6 rounded-full bg-[#E53935] text-white flex items-center justify-center text-xs font-bold">
            1
          </span>
          <h2 className="text-sm font-bold text-[#202124]">Select Company & Upload PDF</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Company Name <span className="text-[#E53935]">*</span>
            </label>
            {!isNewCompany ? (
              <select
                value={selectedCompany}
                onChange={(e) => {
                  if (e.target.value === "__NEW__") {
                    setIsNewCompany(true);
                    setSelectedCompany("");
                  } else setSelectedCompany(e.target.value);
                }}
                className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-[#202124] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] outline-hidden"
              >
                <option value="">-- Choose Company --</option>
                {companies.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} ({c.rowCount || 0} items)
                  </option>
                ))}
                <option value="__NEW__">+ Add New Company...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  placeholder="e.g. Lloyd, LG"
                  className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-xl text-xs font-medium text-[#202124] focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] outline-hidden"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCompany(false);
                    setNewCompanyInput("");
                  }}
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handlePdfUpload(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-[#D1D5DB] hover:border-[#E53935] bg-[#F9FAFB] hover:bg-[#FFF1F0]/40 rounded-2xl p-4 text-center cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-center gap-3">
                <UploadCloud className="w-6 h-6 text-[#E53935]" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-[#202124]">
                    {uploadedFile ? uploadedFile.name : "Click or drag & drop PDF here"}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    In-browser only. File is NEVER saved to Firebase Storage or servers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {parsingPdf && (
          <div className="bg-[#FFF1F0] border border-[#FECDD3] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#E53935]">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                {readingStatusText}
              </span>
              <span>{readingProgress}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-[#FECDD3]">
              <div
                className="bg-[#E53935] h-2 rounded-full transition-all"
                style={{ width: `${readingProgress}%` }}
              />
            </div>
          </div>
        )}

        {scannedAlert && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>No digital text detected:</strong> This PDF is a scanned image. Upload an original digital PDF.
            </span>
          </div>
        )}
      </div>

      {/* ── STEP 2: PAGE PREVIEW & 3 ADMIN CONTROLS ── */}
      {parsedPdfCache && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#E53935] text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h2 className="text-sm font-bold text-[#202124]">Page Preview & Table Boundary Controls</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 text-xs font-semibold text-[#374151] cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#E53935]" />
                <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleResetToAuto()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-xs font-semibold text-[#374151] cursor-pointer"
                title="Reset table detection to auto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                <span>Reset to auto</span>
              </button>
            </div>
          </div>

          {/* 3 Simple Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 text-xs">
            {/* Control 1: Row Anchor Column */}
            <div className="space-y-1">
              <label className="font-semibold text-[#374151] block">A new row starts when this column has a value:</label>
              <select
                value={anchorColName}
                onChange={(e) => {
                  setAnchorColName(e.target.value);
                  reparseWithParams(tableArea, colBoundaries, e.target.value, headerLineCount);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-xs font-medium text-[#202124] focus:outline-hidden"
              >
                <option value="auto">Auto-detect (SNo sequence / lines)</option>
                {rawGrid.headers.map((h, i) => (
                  <option key={i} value={h}>
                    Column {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Control 2: Header Lines Count */}
            <div className="space-y-1">
              <label className="font-semibold text-[#374151] block">Header lines:</label>
              <select
                value={headerLineCount}
                onChange={(e) => {
                  const val = e.target.value === "auto" ? "auto" : parseInt(e.target.value, 10);
                  setHeaderLineCount(val);
                  reparseWithParams(tableArea, colBoundaries, anchorColName, val);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-xs font-medium text-[#202124] focus:outline-hidden"
              >
                <option value="auto">Auto-detect lines</option>
                <option value={1}>1 line</option>
                <option value={2}>2 lines</option>
                <option value={3}>3 lines</option>
                <option value={4}>4 lines</option>
                <option value={5}>5 lines</option>
                <option value={6}>6 lines</option>
              </select>
            </div>

            {/* Control 3: Interactive Draw Mode Toggle */}
            <div className="space-y-1 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setIsDrawingArea(!isDrawingArea)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                  isDrawingArea
                    ? "bg-[#E53935] text-white border-[#C62828] shadow-sm animate-pulse"
                    : "bg-white text-[#374151] border-[#D1D5DB] hover:bg-gray-100"
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{isDrawingArea ? "Click & drag on page to draw area" : "Draw table area manually"}</span>
              </button>
            </div>
          </div>

          {/* Canvas Preview Container */}
          {showPreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span>
                  Showing page <strong>{previewPageNum}</strong> of <strong>{parsedPdfCache.numPages}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={previewPageNum <= 1}
                    onClick={() => setPreviewPageNum((p) => Math.max(1, p - 1))}
                    className="px-2 py-0.5 rounded border border-[#D1D5DB] hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                  >
                    Prev Page
                  </button>
                  <button
                    type="button"
                    disabled={previewPageNum >= parsedPdfCache.numPages}
                    onClick={() => setPreviewPageNum((p) => Math.min(parsedPdfCache.numPages, p + 1))}
                    className="px-2 py-0.5 rounded border border-[#D1D5DB] hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                  >
                    Next Page
                  </button>
                </div>
              </div>

              <div
                ref={overlayRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                className="relative border border-[#D1D5DB] rounded-xl overflow-hidden bg-gray-100 max-h-[500px] overflow-auto flex justify-center cursor-crosshair select-none"
              >
                <canvas ref={canvasRef} className="block shadow-sm" />

                {/* Table Area Bounding Box Overlay */}
                {tableArea && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${tableArea.left * 100}%`,
                      top: `${tableArea.top * 100}%`,
                      width: `${(tableArea.right - tableArea.left) * 100}%`,
                      height: `${(tableArea.bottom - tableArea.top) * 100}%`,
                      border: "2px dashed #E53935",
                      backgroundColor: "rgba(229, 57, 53, 0.05)",
                      pointerEvents: isDrawingArea ? "none" : "auto",
                    }}
                    title="Detected Table Region"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: TABLE WORKSPACE & VALIDATION BANNER ── */}
      {rawGrid.rows.length > 0 && (
        <div className="space-y-4">
          {/* HEALTH CHECKS BANNER */}
          {healthChecks.failed ? (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3 text-xs text-red-900 shadow-2xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm font-bold">Extraction Check Failed</strong>
                <p className="mt-1">{healthChecks.reason}</p>
                <p className="mt-1 text-red-700 font-semibold">
                  Save to Catalog is disabled. Adjust the boundary overlay above or pick an explicit Row Anchor column.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1.5 rounded-lg font-medium text-[#202124]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Read <strong>{rawGrid.rows.length}</strong> rows
                    {rawGrid.lastSno > 0 && ` (last SNo = ${rawGrid.lastSno})`}
                  </span>

                  {rawGrid.missingSno.length > 0 ? (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium">
                      Missing SNo: {rawGrid.missingSno.slice(0, 8).join(", ")}
                      {rawGrid.missingSno.length > 8 ? "..." : ""}
                    </span>
                  ) : (
                    rawGrid.lastSno > 0 && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium">
                        Serial sequence: Sequential (1 to {rawGrid.lastSno})
                      </span>
                    )
                  )}

                  <span
                    className={`px-2.5 py-1.5 rounded-lg font-medium ${
                      validationStats.emptyCodeCount > 0
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    Empty Item Code: <strong>{validationStats.emptyCodeCount}</strong>
                  </span>

                  {validationStats.duplicateCount > 0 && (
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium">
                      Duplicates: <strong>{validationStats.duplicateCount}</strong>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsConfirmPublishOpen(true)}
                  disabled={
                    !effectiveCompanyName ||
                    validationStats.validItems.length === 0 ||
                    isPublishing ||
                    healthChecks.failed
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Save to Catalog ({validationStats.validItems.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* COLUMN ROLE & PRESET BAR */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#E53935] text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <h3 className="text-xs font-bold text-[#202124]">Search & Item Code Column Mapping</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllCols}
                  className="px-2.5 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 text-[11px] font-semibold text-[#374151] cursor-pointer"
                >
                  Select all columns
                </button>
                <button
                  type="button"
                  onClick={handleDeselectOptionalCols}
                  className="px-2.5 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 text-[11px] font-semibold text-[#374151] cursor-pointer"
                >
                  Deselect optional columns
                </button>
                <span className="text-[11px] text-[#1E40AF] font-bold px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  Columns detected: {rawGrid.headers.length}
                </span>
                <button
                  type="button"
                  onClick={handleResetColumnsToAuto}
                  className="px-2.5 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 text-[11px] font-semibold text-[#374151] cursor-pointer"
                  title="Reset column boundaries to auto detection"
                >
                  Reset columns to auto
                </button>
                <span className="text-[11px] text-[#6B7280] font-medium px-2 py-1 bg-gray-100 rounded-lg">
                  Columns kept: {rawGrid.headers.filter((h) => tickedCols.has(h)).length} of {rawGrid.headers.length}
                </span>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={savingPreset || !effectiveCompanyName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D1D5DB] hover:bg-gray-50 text-xs font-semibold text-[#374151] disabled:opacity-50 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>{savingPreset ? "Saving..." : "Remember this format"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-900 uppercase block">
                    Search column (Model / Name)
                  </span>
                  <p className="text-[10px] text-emerald-700">Full text → description + modelKey + searchTokens</p>
                </div>
                <select
                  value={searchColIdx}
                  onChange={(e) => setSearchColIdx(parseInt(e.target.value, 10))}
                  className="px-2 py-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-bold text-emerald-900 focus:outline-hidden"
                >
                  {rawGrid.headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50/70 border border-blue-300 rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-blue-900 uppercase block">Item Code Column</span>
                  <p className="text-[10px] text-blue-700">Stored as primary Item Number / VAN Code</p>
                </div>
                <select
                  value={itemCodeColIdx}
                  onChange={(e) => setItemCodeColIdx(parseInt(e.target.value, 10))}
                  className="px-2 py-1.5 bg-white border border-blue-400 rounded-lg text-xs font-bold text-blue-900 focus:outline-hidden"
                >
                  {rawGrid.headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TABLE TOOLBAR */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 font-semibold text-[#374151] cursor-pointer"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 font-semibold text-[#374151] cursor-pointer"
              >
                Deselect all
              </button>
              <button
                type="button"
                onClick={handleSelectThisPage}
                className="px-2 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 font-semibold text-[#374151] cursor-pointer"
              >
                Select this page
              </button>
              <button
                type="button"
                onClick={handleDeselectThisPage}
                className="px-2 py-1 rounded-lg border border-[#D1D5DB] hover:bg-gray-50 font-semibold text-[#374151] cursor-pointer"
              >
                Deselect this page
              </button>

              <span className="text-gray-300 mx-0.5">|</span>

              {/* Range selector */}
              <span className="font-medium text-[#6B7280]">Rows</span>
              <input
                type="number"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                placeholder="N"
                className="w-12 px-1.5 py-1 border border-[#D1D5DB] rounded-lg text-center text-[11px]"
              />
              <span className="text-[#6B7280]">to</span>
              <input
                type="number"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                placeholder="M"
                className="w-12 px-1.5 py-1 border border-[#D1D5DB] rounded-lg text-center text-[11px]"
              />
              <button
                type="button"
                onClick={handleSelectRange}
                className="px-2 py-1 rounded-lg bg-[#E53935] text-white font-semibold cursor-pointer"
              >
                Select range
              </button>

              <span className="text-gray-300 mx-0.5">|</span>

              {/* Search box */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-[7px]" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => {
                    setTableSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search table..."
                  className="w-full pl-7 pr-2 py-1 bg-gray-50 border border-[#D1D5DB] rounded-lg text-[11px] text-[#202124] focus:bg-white focus:border-[#E53935] outline-hidden"
                />
              </div>

              {/* Column value filter */}
              <div className="flex items-center gap-1 bg-gray-50 border border-[#D1D5DB] rounded-lg px-2 py-0.5">
                <Filter className="w-3 h-3 text-gray-500" />
                <select
                  value={filterColumnIdx}
                  onChange={(e) => {
                    setFilterColumnIdx(parseInt(e.target.value, 10));
                    setFilterColumnValue("");
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-[11px] font-medium text-[#202124] focus:outline-hidden"
                >
                  <option value={-1}>Filter column...</option>
                  {rawGrid.headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {h}
                    </option>
                  ))}
                </select>
                {filterColumnIdx !== -1 && (
                  <select
                    value={filterColumnValue}
                    onChange={(e) => {
                      setFilterColumnValue(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-[#D1D5DB] rounded px-1.5 py-0.5 text-[11px] text-[#202124] max-w-[160px] focus:outline-hidden"
                  >
                    <option value="">All ({rawGrid.rows.length})</option>
                    {filterColumnOptions.map(([val, cnt], i) => (
                      <option key={i} value={val}>
                        {val} ({cnt})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {(tableSearchQuery || filterColumnValue) && (
                <button
                  type="button"
                  onClick={() => {
                    setTableSearchQuery("");
                    setFilterColumnIdx(-1);
                    setFilterColumnValue("");
                    setCurrentPage(1);
                  }}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* EXACT BORDERED PDF TABLE VIEW */}
          <div className="bg-white border border-[#D1D5DB] shadow-2xs overflow-hidden" style={{ borderRadius: 4 }}>
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full border-collapse" style={{ fontSize: 13, lineHeight: 1.4 }}>
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "#f0f0f0" }}>
                    <th
                      style={{
                        border: "1px solid #bbb",
                        padding: "4px 6px",
                        textAlign: "center",
                        verticalAlign: "top",
                        width: 36,
                        background: "#f0f0f0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          filteredRows.length > 0 &&
                          filteredRows.every((r) => selectedRowIds.has(r._rowId))
                        }
                        onChange={() => {
                          filteredRows.every((r) => selectedRowIds.has(r._rowId))
                            ? handleDeselectAll()
                            : handleSelectAll();
                        }}
                        className="cursor-pointer"
                      />
                    </th>
                    <th
                      style={{
                        border: "1px solid #bbb",
                        padding: "2px 4px",
                        textAlign: "center",
                        verticalAlign: "top",
                        width: 30,
                        background: "#f0f0f0",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#666",
                      }}
                    >
                      Pg
                    </th>

                    {rawGrid.headers.map((h, colIdx) => {
                      const isSearch = colIdx === searchColIdx;
                      const isCode = colIdx === itemCodeColIdx;
                      const isTicked = tickedCols.has(h);
                      const isLocked = isSearch || isCode;

                      return (
                        <th
                          key={colIdx}
                          style={{
                            border: "1px solid #bbb",
                            padding: "4px 6px",
                            textAlign: isCode ? "right" : "center",
                            verticalAlign: "top",
                            fontWeight: 700,
                            fontSize: 11,
                            color: isTicked ? "#333" : "#aaa",
                            background: isTicked ? "#f0f0f0" : "#e8e8e8",
                            whiteSpace: "normal",
                            lineHeight: 1.3,
                            minWidth: colIdx === 0 ? 44 : undefined,
                          }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="checkbox"
                              checked={isTicked}
                              disabled={isLocked}
                              onChange={() => handleToggleColTick(h)}
                              className="cursor-pointer disabled:cursor-not-allowed"
                              title={
                                isLocked
                                  ? "Required: used for search / item code"
                                  : `${isTicked ? "Untick" : "Tick"} column: ${h}`
                              }
                            />
                            <span style={{ wordBreak: "break-word" }}>
                              {h}
                              {isSearch && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: 4,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: "#166534",
                                    background: "#dcfce7",
                                    borderRadius: 3,
                                    padding: "0 4px",
                                  }}
                                >
                                  SEARCH
                                </span>
                              )}
                              {isCode && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: 4,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: "#1e40af",
                                    background: "#dbeafe",
                                    borderRadius: 3,
                                    padding: "0 4px",
                                  }}
                                >
                                  CODE
                                </span>
                              )}
                            </span>

                            {colIdx < rawGrid.headers.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMergeWithNextColumn(colIdx)}
                                className="mt-1 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 hover:text-[#E53935] bg-white hover:bg-red-50 border border-gray-300 rounded cursor-pointer transition-colors"
                                title={`Merge "${h}" with next column`}
                              >
                                Merge with next column
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={rawGrid.headers.length + 2}
                        style={{ padding: 32, textAlign: "center", color: "#999" }}
                      >
                        No matching rows.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const absIdx = filteredRows.indexOf(row);
                      const isSelected = selectedRowIds.has(row._rowId);
                      const codeVal = normalizeItemCode(getCellValue(row, itemCodeColIdx));
                      const isEmptyCode = !codeVal;

                      let bgColor = isSelected ? "#f0fdf4" : "#fafafa";
                      let textColor = isSelected ? "#111" : "#999";
                      if (isSelected && isEmptyCode) {
                        bgColor = "#fef2f2";
                        textColor = "#7f1d1d";
                      }

                      return (
                        <tr
                          key={row._rowId}
                          style={{ background: bgColor, color: textColor, transition: "background 0.1s" }}
                        >
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: "2px 4px",
                              textAlign: "center",
                              verticalAlign: "top",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleRow(row._rowId, absIdx, e)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td
                            style={{
                              border: "1px solid #ddd",
                              padding: "1px 3px",
                              textAlign: "center",
                              fontSize: 10,
                              color: "#999",
                              verticalAlign: "top",
                            }}
                          >
                            {row._pageNumber}
                          </td>

                          {rawGrid.headers.map((h, colIdx) => {
                            const isCode = colIdx === itemCodeColIdx;
                            const isTicked = tickedCols.has(h);
                            const val = getCellValue(row, colIdx);
                            const isBeingEdited =
                              editingCell?.rowId === row._rowId && editingCell?.colIdx === colIdx;
                            const wasEdited = editedCells[row._rowId]?.[colIdx] !== undefined;

                            return (
                              <td
                                key={colIdx}
                                onDoubleClick={() => setEditingCell({ rowId: row._rowId, colIdx })}
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "3px 5px",
                                  textAlign: isCode ? "right" : colIdx === 0 ? "center" : "left",
                                  verticalAlign: "top",
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                  fontFamily: isCode ? "monospace" : "inherit",
                                  fontWeight: isCode ? 600 : "normal",
                                  position: "relative",
                                  color: !isTicked ? "#bbb" : undefined,
                                  background: isSelected && isEmptyCode && isCode ? "#fecaca" : undefined,
                                }}
                              >
                                {isBeingEdited ? (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleCellEdit(row._rowId, colIdx, e.target.value)}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                                    }}
                                    autoFocus
                                    style={{
                                      width: "100%",
                                      border: "1px solid #E53935",
                                      borderRadius: 2,
                                      padding: "1px 3px",
                                      fontSize: 13,
                                      outline: "none",
                                      background: "#fff",
                                    }}
                                  />
                                ) : (
                                  <>
                                    {val}
                                    {wasEdited && (
                                      <Edit2
                                        style={{
                                          width: 10,
                                          height: 10,
                                          position: "absolute",
                                          top: 2,
                                          right: 2,
                                          color: "#E53935",
                                          opacity: 0.6,
                                        }}
                                      />
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: "1px solid #ddd", padding: "6px 12px", background: "#f8f8f8" }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={filteredRows.length}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE COMPANY CATALOGS & UPLOAD HISTORY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#E53935]" />
              <span>Active Catalogs ({companies.length})</span>
            </h3>
            <button
              type="button"
              onClick={loadInitialData}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {loadingInitial ? (
            <div className="py-8 text-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">No active catalogs. Upload a PDF above.</div>
          ) : (
            <div className="space-y-2.5">
              {companies.map((comp) => (
                <div
                  key={comp.key}
                  className="p-3 rounded-xl border border-[#E5E7EB] hover:border-gray-300 bg-gray-50/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-[#202124] block truncate">{comp.name}</span>
                    <span className="text-[11px] text-[#6B7280] block">{comp.rowCount || 0} products</span>
                    {comp.publishedAt && (
                      <span className="text-[10px] text-gray-400 block">
                        Updated {formatDate(comp.publishedAt)}
                      </span>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTargetCompany(comp)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#E53935]" />
            <span>Upload History</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#6B7280]">
                <tr>
                  <th className="p-2.5 font-semibold">Company</th>
                  <th className="p-2.5 font-semibold">File</th>
                  <th className="p-2.5 font-semibold text-center">Items</th>
                  <th className="p-2.5 font-semibold">Published</th>
                  <th className="p-2.5 font-semibold">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400">
                      No records.
                    </td>
                  </tr>
                ) : (
                  history.slice(0, 8).map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="p-2.5 font-bold text-[#202124]">{h.companyName || h.companyKey}</td>
                      <td className="p-2.5 text-gray-600 truncate max-w-[180px]" title={h.fileName}>
                        {h.fileName}
                      </td>
                      <td className="p-2.5 text-center font-mono font-semibold text-[#E53935]">
                        {h.rowCount || h.selectedCount || 0}
                      </td>
                      <td className="p-2.5 text-gray-500">{formatDate(h.publishedAt || h.createdAt)}</td>
                      <td className="p-2.5 text-gray-500">{h.createdByName || "Super Admin"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── DIALOGS ── */}
      <ConfirmDialog
        isOpen={isConfirmPublishOpen}
        onClose={() => setIsConfirmPublishOpen(false)}
        onConfirm={handlePublishCatalog}
        title="Publish Catalog to Firebase"
        message={`Save ${validationStats.validItems.length} products for ${effectiveCompanyName}? This replaces the previous active catalog.`}
        confirmText="Save to Catalog"
        type="primary"
        loading={isPublishing}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTargetCompany)}
        onClose={() => setDeleteTargetCompany(null)}
        onConfirm={handleDeleteCompanyConfirm}
        title="Delete Company Catalog"
        message={`Delete ${deleteTargetCompany?.name}? This removes all ${deleteTargetCompany?.rowCount || 0} products from search.`}
        confirmText="Delete Catalog"
        type="danger"
        loading={isDeletingCompany}
      />

      {isPublishing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl border border-gray-100 text-center">
            <Loader2 className="w-8 h-8 text-[#E53935] animate-spin mx-auto" />
            <div>
              <h4 className="font-bold text-sm text-[#202124]">Publishing Catalog</h4>
              <p className="text-xs text-[#6B7280] mt-1">Writing batches of 400...</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#E53935] h-2 rounded-full transition-all"
                style={{ width: `${publishProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-[#E53935]">{publishProgress}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VanAdminPage;
