import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Copy, Check, X, Clock, SearchX, Settings2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  getVanCompanies,
  searchVanItems,
  migrateLegacyVanMeta,
} from "../../services/vanService";

const STORAGE_KEY_RECENT = "van_recent_searches";

/**
 * Capitalizes company name according to design specifications:
 * if <= 3 characters (e.g. "lg", "ifb", "tcl") -> uppercase ("LG", "IFB", "TCL")
 * else Title Case ("lloyd" -> "Lloyd", "samsung" -> "Samsung")
 */
function formatCompanyName(name) {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length <= 3) {
    return trimmed.toUpperCase();
  }
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Checks whether the typed query exactly matches the model number,
 * model key, or item code.
 */
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

/**
 * Safe localStorage helpers for recent searches
 */
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
    const updated = [clean, ...filtered].slice(0, 5);
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
  } catch {
    // Gracefully handle private browsing or storage errors
  }
}

function clearStoredRecentSearches() {
  try {
    localStorage.removeItem(STORAGE_KEY_RECENT);
  } catch {
    // Gracefully handle errors
  }
}

/* ---------- Design tokens (match the admin screens) ---------- */
const CARD =
  "bg-white/95 rounded-3xl border border-rose-100/80 shadow-[0_12px_40px_-22px_rgba(190,60,60,0.30)]";
const CHIP_MINT =
  "inline-flex items-center gap-2 h-8 px-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#047857] text-[13px] font-medium";
const CHIP_BLUE =
  "inline-flex items-center gap-2 h-8 px-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] text-[13px] font-medium";
const BTN_OUTLINE =
  "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors cursor-pointer";

const CheckDot = () => (
  <span className="w-4 h-4 rounded-full border-[1.5px] border-current flex items-center justify-center shrink-0">
    <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
  </span>
);

const HexOutline = ({ className = "", double = false }) => (
  <svg
    className={`absolute text-rose-300/40 ${className}`}
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
  >
    <path d="M50 6 88 28 88 72 50 94 12 72 12 28Z" />
    {double && <path d="M50 22 74 36 74 64 50 78 26 64 26 36Z" />}
  </svg>
);

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
  const [isScrolled, setIsScrolled] = useState(false);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // The full-bleed background is 100vw wide; clip horizontal overflow so no
  // horizontal scrollbar appears while this page is mounted.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overflowX;
    el.style.overflowX = "clip";
    return () => {
      el.style.overflowX = prev;
    };
  }, []);

  // Load companies & legacy migration on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await migrateLegacyVanMeta();
        const list = await getVanCompanies();
        if (mounted) {
          setCompanies(list);
        }
      } catch (err) {
        console.warn("Could not load companies:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Monitor window scroll to lift the sticky search card
  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Execute search across targeted companies
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

  // Debounced search trigger (200ms)
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(q);
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
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
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSelectRecent = (term) => {
    setQuery(term);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    executeSearch(term);
  };

  const handleClearRecent = () => {
    clearStoredRecentSearches();
    setRecentSearches([]);
  };

  // Copy item code to clipboard with 1.5s visual & aria feedback (no toast needed)
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

  // Partition results into exact match (shown first) and similar matches
  const { exactMatches, similarMatches } = useMemo(() => {
    const exact = [];
    const similar = [];
    results.forEach((item) => {
      if (isExactModelMatch(item, query)) {
        exact.push(item);
      } else {
        similar.push(item);
      }
    });
    return { exactMatches: exact, similarMatches: similar };
  }, [results, query]);

  const allRenderedItems = useMemo(() => {
    return [...exactMatches, ...similarMatches];
  }, [exactMatches, similarMatches]);

  // Derived effective highlighted row index
  const effectiveHighlightedIndex =
    highlightedIndex >= 0 && highlightedIndex < allRenderedItems.length
      ? highlightedIndex
      : allRenderedItems.length > 0
        ? 0
        : -1;

  // Global desktop keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. "/" focuses search input if not currently typing in an input
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

      // 2. Escape clears search or blurs input
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

      // 3. Arrow Down moves highlighted item
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const current = prev >= 0 && prev < allRenderedItems.length ? prev : 0;
          if (current < allRenderedItems.length - 1) return current + 1;
          return 0;
        });
        return;
      }

      // 4. Arrow Up moves highlighted item
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const current = prev >= 0 && prev < allRenderedItems.length ? prev : 0;
          if (current > 0) return current - 1;
          return allRenderedItems.length - 1;
        });
        return;
      }

      // 5. Enter copies highlighted item code
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

  // Find latest published date across companies
  const newestUpdatedDate = useMemo(() => {
    if (!companies.length) return null;
    let newest = null;
    companies.forEach((c) => {
      if (c.publishedAt) {
        const d = new Date(c.publishedAt);
        if (!newest || d > newest) newest = d;
      }
    });
    return newest;
  }, [companies]);

  const formattedUpdatedDate = useMemo(() => {
    if (!newestUpdatedDate) return null;
    try {
      return newestUpdatedDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [newestUpdatedDate]);

  const totalCatalogRows = useMemo(() => {
    return companies.reduce((acc, c) => acc + (c.rowCount || 0), 0);
  }, [companies]);

  // Brand filter pill (sits inside the blue panel)
  const renderFilterPill = (key, label, count) => {
    const isSelected = selectedCompanyFilter === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => setSelectedCompanyFilter(key)}
        className={`shrink-0 snap-start h-9 px-3.5 rounded-xl border text-[13px] transition-all cursor-pointer inline-flex items-center ${isSelected
            ? "bg-white border-[#60A5FA] text-[#1D4ED8] font-semibold ring-2 ring-[#BFDBFE]"
            : "bg-white/70 border-[#DBEAFE] text-[#374151] font-medium hover:bg-white hover:border-[#93C5FD]"
          }`}
      >
        {label}
        <span className="ml-2 tabular-nums text-[11px] font-medium opacity-60">
          {count.toLocaleString("en-IN")}
        </span>
      </button>
    );
  };

  // Group label row inside results card
  const renderGroupLabel = (label, tone) => (
    <li
      role="presentation"
      className={`px-4 sm:px-6 py-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] select-none ${tone === "exact"
          ? "bg-[#ECFDF5] text-[#047857]"
          : "bg-[#F9FAFB] text-[#6B7280]"
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${tone === "exact" ? "bg-[#10B981]" : "bg-[#9CA3AF]"
          }`}
      />
      {label}
    </li>
  );

  // Helper to render individual item row
  const renderItemRow = (item, isExactMatch, flatIndex) => {
    const isCopied = copiedCode === item.itemCode;
    const isHighlighted = effectiveHighlightedIndex === flatIndex;

    const extraValues =
      item.extra && typeof item.extra === "object"
        ? Object.values(item.extra).filter(Boolean).join(" · ")
        : "";

    const rowBg = isExactMatch
      ? isHighlighted
        ? "bg-[#E6F9EF]"
        : "bg-[#F4FDF8]"
      : isHighlighted
        ? "bg-[#FFF6F5]"
        : "bg-white";

    const btnState = isCopied
      ? "bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]"
      : isHighlighted
        ? "bg-gradient-to-r from-[#FF8A85] to-[#F0605B] text-white border border-transparent shadow-[0_8px_18px_-8px_rgba(240,96,91,0.75)]"
        : "bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]";

    return (
      <li
        key={`${item.companyKey}_${item.id || item.modelKey}`}
        onClick={() => handleCopyCode(item.itemCode)}
        onMouseEnter={() => setHighlightedIndex(flatIndex)}
        role="option"
        aria-selected={isHighlighted}
        className={`group px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 cursor-pointer transition-colors ${rowBg}`}
      >
        {/* Left: model, tags, description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#111827] tracking-[-0.01em]">
              {item.modelNumber}
            </span>
            {item.companyName && (
              <span className="text-[11px] font-semibold text-[#4B5563] bg-white border border-[#E5E7EB] px-2 py-0.5 rounded-lg">
                {formatCompanyName(item.companyName)}
              </span>
            )}
            {isExactMatch && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] bg-[#D1FAE5] border border-[#A7F3D0] px-2 py-0.5 rounded-lg">
                <Check className="w-3 h-3" strokeWidth={3} />
                Exact match
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-[13px] text-[#6B7280] line-clamp-2 mt-1 leading-snug">
              {item.description}
            </p>
          )}

          {extraValues && (
            <p className="lg:hidden text-xs text-[#9CA3AF] mt-1 truncate">{extraValues}</p>
          )}
        </div>

        {/* Middle (wide screens): extra fields get their own column */}
        {extraValues && (
          <div className="hidden lg:block lg:w-[24%] xl:w-[28%] min-w-0 shrink-0">
            <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">
              {extraValues}
            </p>
          </div>
        )}

        {/* Right: item code panel + copy */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5">
            <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[#3B82F6] leading-none mb-1">
              Code
            </span>
            <span className="sr-only">Item code:</span>
            <span className="block font-mono tabular-nums text-[17px] font-bold text-[#1E3A8A] leading-none">
              {item.itemCode}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => handleCopyCode(item.itemCode, e)}
            className={`h-11 sm:h-10 min-w-[92px] px-3.5 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.97] ${btnState}`}
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
      {/* Full-bleed blush backdrop: spans the whole screen width */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden bg-gradient-to-b from-transparent via-[#FFF3F2] to-[#FFF8F8]"
      >
        <div className="absolute -top-10 left-[8%] w-[620px] h-[460px] bg-[radial-gradient(closest-side,rgba(248,113,113,0.20),transparent)]" />
        <div className="absolute top-[6%] right-[4%] w-[700px] h-[520px] bg-[radial-gradient(closest-side,rgba(251,146,160,0.22),transparent)]" />
        <div className="absolute bottom-[-6%] left-[30%] w-[820px] h-[420px] bg-[radial-gradient(closest-side,rgba(252,165,165,0.18),transparent)]" />
        <HexOutline double className="right-[2%] top-[4%] w-72 h-72" />
        <HexOutline className="left-[1%] top-[22%] w-56 h-56" />
        <HexOutline double className="left-[6%] bottom-[6%] w-64 h-64" />
        <HexOutline className="right-[8%] bottom-[10%] w-52 h-52" />
      </div>

      {/* Content — fluid, uses the full screen width */}
      <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 pt-1 pb-16 space-y-4">
        {/* Polite Screen Reader Announcement for Copy Action */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {copiedAnnounce}
        </div>

        {/* 1. Header card */}
        <header
          className={`${CARD} px-5 py-4 sm:px-7 sm:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
        >
          <div className="flex items-center gap-3.5">
            <span className="w-10 h-10 rounded-full bg-[#E53935] text-white flex items-center justify-center shrink-0 shadow-[0_6px_14px_-6px_rgba(229,57,53,0.8)]">
              <Search className="w-[18px] h-[18px]" strokeWidth={2.5} />
            </span>
            <div>
              <h1 className="text-[20px] sm:text-[22px] leading-tight font-semibold text-[#111827] tracking-[-0.01em]">
                Item Code Lookup
              </h1>
              <p className="text-[13px] text-[#6B7280] mt-0.5">
                Search a model number or item code
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {totalCatalogRows > 0 && (
              <span className={CHIP_BLUE}>
                <span className="tabular-nums font-semibold">
                  {totalCatalogRows.toLocaleString("en-IN")}
                </span>
                items
              </span>
            )}
            {formattedUpdatedDate && (
              <span className={CHIP_MINT}>
                <CheckDot />
                Updated {formattedUpdatedDate}
              </span>
            )}
            {canManage && (
              <Link to="/van/admin" className={BTN_OUTLINE}>
                <Settings2 className="w-3.5 h-3.5" />
                Manage catalogs
              </Link>
            )}
          </div>
        </header>

        {/* 2. Search card (sticky): mint search panel + blue brand panel side by side */}
        <section
          aria-label="Search controls"
          className={`${CARD} sticky top-3 z-20 p-3 sm:p-4 transition-shadow ${isScrolled ? "shadow-[0_18px_44px_-18px_rgba(190,60,60,0.42)]" : ""
            }`}
        >
          <div
            className={`grid gap-3 ${hasCompanies ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]" : ""
              }`}
          >
            {/* Search panel */}
            <div className="rounded-2xl border border-[#A7F3D0] bg-[#F0FDF7] p-3 sm:p-4">
              <div className="hidden sm:block mb-2.5">
                <p className="text-[12px] font-bold uppercase tracking-wide text-[#065F46]">
                  Search
                </p>
                <p className="text-[12px] text-[#059669]">
                  Model number, product name or item code
                </p>
              </div>

              <div className="relative flex items-center">
                <label htmlFor="van-search-input" className="sr-only">
                  Search a model number or item code
                </label>
                <Search
                  className="w-[18px] h-[18px] text-[#10B981] absolute left-4 pointer-events-none"
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
                  className="w-full h-12 pl-11 pr-12 bg-white border border-[#6EE7B7] rounded-xl text-[16px] sm:text-[15px] text-[#111827] font-semibold caret-[#E53935] placeholder:font-normal placeholder:text-[#9CA3AF] transition-all outline-none hover:border-[#34D399] focus:border-[#10B981] focus:ring-4 focus:ring-[#34D399]/25"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Clear search input"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center absolute right-3.5 pointer-events-none select-none">
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-[#6B7280] bg-[#F3F4F6] border border-[#E5E7EB] rounded-md">
                      /
                    </kbd>
                  </span>
                )}
              </div>
            </div>

            {/* Brand panel */}
            {hasCompanies && (
              <div className="sm:rounded-2xl sm:border sm:border-[#BFDBFE] sm:bg-[#F3F8FF] sm:p-4 flex flex-col justify-center">
                <div className="hidden sm:block mb-2.5">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#1E3A8A]">
                    Brand catalog
                  </p>
                  <p className="text-[12px] text-[#3B82F6]">Filter results by brand</p>
                </div>

                <div
                  role="tablist"
                  aria-label="Filter by company catalog"
                  className="flex items-center gap-2 overflow-x-auto lg:overflow-visible lg:flex-wrap scroll-smooth snap-x snap-mandatory select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {renderFilterPill("all", "All", totalCatalogRows)}
                  {companies.map((c) =>
                    renderFilterPill(c.key, formatCompanyName(c.name), c.rowCount || 0)
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. States */}

        {/* A. Error */}
        {searchError && (
          <div
            role="alert"
            className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F0] px-4 py-3 text-[13px] text-[#B91C1C] flex items-center justify-between gap-3"
          >
            <span className="font-medium">{searchError}</span>
            <button
              type="button"
              onClick={() => executeSearch(query)}
              className="shrink-0 h-9 px-3.5 rounded-xl bg-white border border-[#FECDD3] font-semibold hover:bg-[#FFF8F8] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* B. Loading — skeleton rows inside a card */}
        {searching && (
          <div
            aria-busy="true"
            aria-label="Searching catalogs"
            className={`${CARD} overflow-hidden divide-y divide-[#F4EEEE]`}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-gray-200 rounded-md w-36" />
                    <div className="h-4 bg-gray-100 rounded-md w-14" />
                  </div>
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="h-11 w-28 bg-[#EFF6FF] rounded-xl" />
                  <div className="h-10 w-[92px] bg-gray-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* C. Results */}
        {!searching && hasSearched && (
          <section aria-label="Search results" className="space-y-3">
            {results.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-0.5">
                <span className={CHIP_MINT}>
                  <CheckDot />
                  <span className="tabular-nums">
                    {results.length} result{results.length === 1 ? "" : "s"}
                    {results.length >= 20 ? " (showing first 20)" : ""}
                  </span>
                </span>
                <span className="hidden sm:inline text-xs text-[#9CA3AF]">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#E5E7EB] rounded-md font-mono text-[10px] text-[#6B7280]">
                    ↵
                  </kbd>{" "}
                  or click to copy
                </span>
              </div>
            )}

            {results.length === 0 ? (
              <div className={`${CARD} px-6 py-14 text-center`}>
                <span className="w-14 h-14 mx-auto rounded-full bg-[#FFF1F0] border border-[#FECDD3] text-[#E53935] flex items-center justify-center mb-4">
                  <SearchX className="w-6 h-6" strokeWidth={1.75} />
                </span>
                <p className="text-[15px] font-semibold text-[#111827]">
                  No item found for &ldquo;{query}&rdquo;
                </p>
                <p className="text-[13px] text-[#6B7280] mt-1.5">
                  Check the spelling or try a part of the model or the item code.
                </p>
              </div>
            ) : (
              <ul
                role="listbox"
                className={`${CARD} overflow-hidden divide-y divide-[#F4EEEE]`}
              >
                {exactMatches.length > 0 && renderGroupLabel("Exact match", "exact")}
                {exactMatches.map((item, idx) => renderItemRow(item, true, idx))}

                {exactMatches.length > 0 &&
                  similarMatches.length > 0 &&
                  renderGroupLabel("Similar", "similar")}

                {similarMatches.map((item, idx) =>
                  renderItemRow(item, false, exactMatches.length + idx)
                )}
              </ul>
            )}
          </section>
        )}

        {/* D. Initial state */}
        {!hasSearched && !searching && (
          <section
            aria-label="Recent searches and tips"
            className={`${CARD} p-5 sm:p-7`}
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#FFF1F0] border border-[#FECDD3] text-[#E53935] flex items-center justify-center shrink-0">
                <Search className="w-4 h-4" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[#111827]">
                  Start typing to search
                </p>
                <p className="text-[13px] text-[#6B7280]">Type at least 2 characters</p>
              </div>
            </div>

            {recentSearches.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#F4EEEE]">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">
                    <Clock className="w-3.5 h-3.5" />
                    Recent searches
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="h-8 px-3 rounded-lg text-xs font-medium text-[#6B7280] hover:text-[#E53935] hover:bg-[#FFF1F0] transition-colors cursor-pointer"
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
                      className="h-9 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-medium text-[#374151] hover:text-[#E53935] hover:border-[#FCA5A5] hover:bg-[#FFF8F8] transition-colors cursor-pointer"
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