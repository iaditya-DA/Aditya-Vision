import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Copy, Check, X, Clock, SearchX, ExternalLink } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  getVanCompanies,
  searchVanItems,
  migrateLegacyVanMeta,
} from "../../services/vanService";

const STORAGE_KEY_RECENT = "van_recent_searches";

function formatCompanyName(name) {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isExactModelMatch(item, queryStr) {
  if (!queryStr) return false;
  const cleanQ = queryStr.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanModelKey = (item.modelKey || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanModelNum = (item.modelNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanItemCode = String(item.itemCode || "").trim().toUpperCase();
  return (
    cleanModelKey === cleanQ ||
    cleanModelNum === cleanQ ||
    cleanItemCode === queryStr.trim().toUpperCase()
  );
}

function getStoredRecentSearches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function persistRecentSearch(term) {
  if (!term || term.trim().length < 2) return;
  try {
    const clean = term.trim();
    const existing = getStoredRecentSearches();
    const filtered = existing.filter((s) => s.toLowerCase() !== clean.toLowerCase());
    localStorage.setItem(
      STORAGE_KEY_RECENT,
      JSON.stringify([clean, ...filtered].slice(0, 5))
    );
  } catch {
    // ignore storage errors
  }
}

function clearStoredRecentSearches() {
  try {
    localStorage.removeItem(STORAGE_KEY_RECENT);
  } catch {
    // ignore
  }
}

/* ---------- Design tokens (same feel as admin page) ---------- */
const CARD =
  "bg-white rounded-2xl border border-rose-100 shadow-[0_8px_30px_-20px_rgba(190,60,60,0.25)]";
const BTN_SOFT =
  "inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-gray-50 border border-gray-100 text-[14px] font-medium text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer";

const VanSearchPage = () => {
  const { isSuperAdmin, hasPermission } = useAuth();
  const canManage = isSuperAdmin || hasPermission("van.manage");

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [copiedCode, setCopiedCode] = useState(null);
  const [copiedAnnounce, setCopiedAnnounce] = useState("");
  const [recentSearches, setRecentSearches] = useState(getStoredRecentSearches);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Full-bleed backdrop is 100vw wide; avoid horizontal scrollbar
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overflowX;
    el.style.overflowX = "clip";
    return () => {
      el.style.overflowX = prev;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await migrateLegacyVanMeta();
        const list = await getVanCompanies();
        if (mounted) setCompanies(list);
      } catch (err) {
        console.warn("Could not load companies:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const executeSearch = useCallback(
    async (rawQuery) => {
      const q = rawQuery.trim();
      if (!q || q.length < 2) {
        setResults([]);
        setSearching(false);
        setHasSearched(false);
        setSearchError("");
        return;
      }

      setSearching(true);
      setHasSearched(true);
      setSearchError("");

      try {
        const targetCompanies =
          selectedCompanyFilter === "all"
            ? companies
            : companies.filter((c) => c.key === selectedCompanyFilter);

        const items = await searchVanItems(q, targetCompanies);
        setResults(items);
        if (items.length > 0) {
          persistRecentSearch(q);
          setRecentSearches(getStoredRecentSearches());
        }
      } catch (err) {
        console.error("Search failed:", err);
        setSearchError("Search query failed. Please check your connection.");
      } finally {
        setSearching(false);
      }
    },
    [selectedCompanyFilter, companies]
  );

  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => executeSearch(q), 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, executeSearch]);

  const handleQueryChange = (val) => {
    setQuery(val);
    if (!val.trim() || val.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      setSearchError("");
    }
  };

  const handleClearQuery = () => {
    setQuery("");
    setResults([]);
    setSearching(false);
    setHasSearched(false);
    setSearchError("");
    searchInputRef.current?.focus();
  };

  const handleSelectRecent = (term) => {
    setQuery(term);
    searchInputRef.current?.focus();
    executeSearch(term);
  };

  const handleClearRecent = () => {
    clearStoredRecentSearches();
    setRecentSearches([]);
  };

  const handleCopyCode = (code, e) => {
    if (e) e.stopPropagation();
    if (!code) return;
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setCopiedAnnounce(`Copied item code ${code}`);
      setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
        setCopiedAnnounce("");
      }, 1500);
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
  };

  const { exactMatches, similarMatches } = useMemo(() => {
    const exact = [];
    const similar = [];
    results.forEach((item) => {
      if (isExactModelMatch(item, query)) exact.push(item);
      else similar.push(item);
    });
    return { exactMatches: exact, similarMatches: similar };
  }, [results, query]);

  const allRenderedItems = useMemo(
    () => [...exactMatches, ...similarMatches],
    [exactMatches, similarMatches]
  );

  const effectiveHighlightedIndex =
    highlightedIndex >= 0 && highlightedIndex < allRenderedItems.length
      ? highlightedIndex
      : allRenderedItems.length > 0
        ? 0
        : -1;

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        return;
      }

      if (e.key === "Escape") {
        if (query) {
          e.preventDefault();
          handleClearQuery();
        } else if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (allRenderedItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const current = prev >= 0 && prev < allRenderedItems.length ? prev : 0;
          return current < allRenderedItems.length - 1 ? current + 1 : 0;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const current = prev >= 0 && prev < allRenderedItems.length ? prev : 0;
          return current > 0 ? current - 1 : allRenderedItems.length - 1;
        });
        return;
      }

      if (e.key === "Enter") {
        const idx = effectiveHighlightedIndex;
        if (idx >= 0 && idx < allRenderedItems.length) {
          e.preventDefault();
          handleCopyCode(allRenderedItems[idx].itemCode);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query, allRenderedItems, effectiveHighlightedIndex]);

  const formattedUpdatedDate = useMemo(() => {
    let newest = null;
    companies.forEach((c) => {
      if (c.publishedAt) {
        const d = new Date(c.publishedAt);
        if (!newest || d > newest) newest = d;
      }
    });
    if (!newest) return null;
    try {
      return newest.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [companies]);

  const totalCatalogRows = useMemo(
    () => companies.reduce((acc, c) => acc + (c.rowCount || 0), 0),
    [companies]
  );

  const renderFilterPill = (key, label, count) => {
    const isSelected = selectedCompanyFilter === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => setSelectedCompanyFilter(key)}
        className={`shrink-0 h-9 px-3.5 rounded-xl border text-[13px] transition-colors cursor-pointer inline-flex items-center ${isSelected
            ? "bg-[#E53935] border-[#E53935] text-white font-semibold"
            : "bg-white border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
          }`}
      >
        {label}
        <span className="ml-2 tabular-nums text-[11px] opacity-70">
          {count.toLocaleString("en-IN")}
        </span>
      </button>
    );
  };

  const renderGroupLabel = (label) => (
    <li
      role="presentation"
      className="px-4 sm:px-6 py-2.5 bg-gray-50 text-[12px] font-semibold text-gray-500 select-none"
    >
      {label}
    </li>
  );

  const renderItemRow = (item, isExactMatch, flatIndex) => {
    const isCopied = copiedCode === item.itemCode;
    const isHighlighted = effectiveHighlightedIndex === flatIndex;

    const extraValues =
      item.extra && typeof item.extra === "object"
        ? Object.values(item.extra).filter(Boolean).join(" · ")
        : "";

    const btnState = isCopied
      ? "bg-green-50 border border-green-200 text-green-700"
      : isHighlighted
        ? "bg-[#E53935] border border-[#E53935] text-white"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50";

    return (
      <li
        key={`${item.companyKey}_${item.id || item.modelKey}`}
        onClick={() => handleCopyCode(item.itemCode)}
        onMouseEnter={() => setHighlightedIndex(flatIndex)}
        role="option"
        aria-selected={isHighlighted}
        className={`px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 cursor-pointer transition-colors ${isHighlighted ? "bg-rose-50/50" : "bg-white"
          }`}
      >
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-gray-900">
              {item.modelNumber}
            </span>
            {item.companyName && (
              <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                {formatCompanyName(item.companyName)}
              </span>
            )}
            {isExactMatch && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" strokeWidth={3} />
                Exact match
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-[13px] text-gray-500 line-clamp-2 mt-1 leading-snug">
              {item.description}
            </p>
          )}

          {extraValues && (
            <p className="lg:hidden text-xs text-gray-400 mt-1 truncate">{extraValues}</p>
          )}
        </div>

        {/* Middle (wide screens) */}
        {extraValues && (
          <div className="hidden lg:block lg:w-[24%] xl:w-[28%] min-w-0 shrink-0">
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {extraValues}
            </p>
          </div>
        )}

        {/* Right */}
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <div className="sm:text-right">
            <span className="block text-[10px] uppercase tracking-wide text-gray-400 leading-none mb-1">
              Code
            </span>
            <span className="block font-mono tabular-nums text-[18px] font-bold text-[#E53935] leading-none">
              {item.itemCode}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => handleCopyCode(item.itemCode, e)}
            className={`h-10 min-w-[92px] px-3.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer active:scale-[0.97] ${btnState}`}
            aria-label={`Copy item code ${item.itemCode}`}
            title={isCopied ? "Copied" : "Copy item code"}
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" strokeWidth={2} />
                Copy
              </>
            )}
          </button>
        </div>
      </li>
    );
  };

  const hasCompanies = companies.length > 0;

  return (
    <div className="relative isolate w-full min-h-[calc(100vh-7rem)]">
      {/* Soft blush backdrop (no shapes) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-gradient-to-b from-transparent via-[#FFF5F4] to-[#FFF8F8]"
      />

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-16 space-y-5">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {copiedAnnounce}
        </div>

        {/* 1. Header card */}
        <header
          className={`${CARD} px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
        >
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-xl bg-rose-50 text-[#E53935] flex items-center justify-center shrink-0">
              <Search className="w-5 h-5" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-[20px] sm:text-[24px] leading-tight font-semibold text-gray-900">
                Item Code Lookup
              </h1>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Search a model number or item code
                {totalCatalogRows > 0 &&
                  ` · ${totalCatalogRows.toLocaleString("en-IN")} items`}
                {formattedUpdatedDate && ` · Updated ${formattedUpdatedDate}`}
              </p>
            </div>
          </div>

          {canManage && (
            <Link to="/van/admin" className={BTN_SOFT}>
              <Search className="w-4 h-4 text-[#E53935]" />
              Manage Catalogs
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </Link>
          )}
        </header>

        {/* 2. Search + brand filter */}
        <section
          aria-label="Search controls"
          className={`${CARD} sticky top-3 z-20 p-4 sm:p-5 space-y-4`}
        >
          <div className="relative flex items-center">
            <label htmlFor="van-search-input" className="sr-only">
              Search a model number or item code
            </label>
            <Search
              className="w-[18px] h-[18px] text-gray-400 absolute left-4 pointer-events-none"
              strokeWidth={2}
            />
            <input
              ref={searchInputRef}
              id="van-search-input"
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Model number or item code, e.g. GLC48B0"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full h-12 pl-11 pr-12 bg-white border border-gray-200 rounded-xl text-[16px] sm:text-[15px] text-gray-900 caret-[#E53935] placeholder:text-gray-400 outline-none hover:border-gray-300 focus:border-[#E53935] focus:ring-4 focus:ring-rose-100"
            />

            {query ? (
              <button
                type="button"
                onClick={handleClearQuery}
                className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center absolute right-3.5 pointer-events-none select-none">
                <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded-md">
                  /
                </kbd>
              </span>
            )}
          </div>

          {hasCompanies && (
            <div
              role="tablist"
              aria-label="Filter by company catalog"
              className="flex items-center gap-2 overflow-x-auto sm:flex-wrap select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {renderFilterPill("all", "All", totalCatalogRows)}
              {companies.map((c) =>
                renderFilterPill(c.key, formatCompanyName(c.name), c.rowCount || 0)
              )}
            </div>
          )}
        </section>

        {/* Error */}
        {searchError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 flex items-center justify-between gap-3"
          >
            <span className="font-medium">{searchError}</span>
            <button
              type="button"
              onClick={() => executeSearch(query)}
              className="shrink-0 h-9 px-3.5 rounded-lg bg-white border border-red-200 font-semibold hover:bg-red-50 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {searching && (
          <div
            aria-busy="true"
            aria-label="Searching catalogs"
            className={`${CARD} overflow-hidden divide-y divide-gray-100`}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-36" />
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="h-8 w-24 bg-gray-100 rounded" />
                  <div className="h-10 w-[92px] bg-gray-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!searching && hasSearched && (
          <section aria-label="Search results" className="space-y-3">
            {results.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-[13px] font-medium text-gray-600 tabular-nums">
                  {results.length} result{results.length === 1 ? "" : "s"}
                  {results.length >= 20 ? " (showing first 20)" : ""}
                </span>
                <span className="hidden sm:inline text-xs text-gray-400">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md font-mono text-[10px] text-gray-500">
                    ↵
                  </kbd>{" "}
                  or click to copy
                </span>
              </div>
            )}

            {results.length === 0 ? (
              <div className={`${CARD} px-6 py-14 text-center`}>
                <span className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-[#E53935] flex items-center justify-center mb-4">
                  <SearchX className="w-6 h-6" strokeWidth={1.75} />
                </span>
                <p className="text-[15px] font-semibold text-gray-900">
                  No item found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-[13px] text-gray-500 mt-1.5">
                  Check the spelling or try a part of the model or the item code.
                </p>
              </div>
            ) : (
              <ul
                role="listbox"
                className={`${CARD} overflow-hidden divide-y divide-gray-100`}
              >
                {exactMatches.length > 0 && renderGroupLabel("Exact match")}
                {exactMatches.map((item, idx) => renderItemRow(item, true, idx))}

                {exactMatches.length > 0 &&
                  similarMatches.length > 0 &&
                  renderGroupLabel("Similar")}

                {similarMatches.map((item, idx) =>
                  renderItemRow(item, false, exactMatches.length + idx)
                )}
              </ul>
            )}
          </section>
        )}

        {/* Initial state */}
        {!hasSearched && !searching && (
          <section aria-label="Recent searches and tips" className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 text-[#E53935] flex items-center justify-center shrink-0">
                <Search className="w-4 h-4" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-gray-900">
                  Start typing to search
                </p>
                <p className="text-[13px] text-gray-500">Type at least 2 characters</p>
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                    <Clock className="w-4 h-4 text-[#E53935]" />
                    Recent searches
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="h-8 px-3 rounded-lg text-xs font-medium text-gray-500 hover:text-[#E53935] hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSelectRecent(term)}
                      className="h-9 px-3.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default VanSearchPage;