import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Copy,
  Check,
  Building2,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
  getVanCompanies,
  searchVanItems,
  migrateLegacyVanMeta,
} from "../../services/vanService";
import { formatDate } from "../../utils/formatters";

const VanSearchPage = () => {
  const toast = useToast();
  const { isSuperAdmin, hasPermission } = useAuth();
  const canManage = isSuperAdmin || hasPermission("van.manage");

  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Load companies & run legacy migration on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await migrateLegacyVanMeta();
        const list = await getVanCompanies();
        if (mounted) {
          setCompanies(list);
          setLoadingCompanies(false);
        }
      } catch (err) {
        console.warn("Could not load companies:", err);
        if (mounted) setLoadingCompanies(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Live search execution with 200ms debounce
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSearching(true);
      setHasSearched(true);
      try {
        const targetCompanies =
          selectedCompanyFilter === "all"
            ? companies
            : companies.filter((c) => c.key === selectedCompanyFilter);

        const items = await searchVanItems(q, targetCompanies);
        setResults(items);
      } catch (err) {
        console.error("Search failed:", err);
        toast.error("Search query failed. Please check connection.");
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, selectedCompanyFilter, companies, toast]);

  const handleQueryChange = (val) => {
    setQuery(val);
    if (!val.trim() || val.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setHasSearched(false);
    }
  };

  const handleClearQuery = () => {
    setQuery("");
    setResults([]);
    setSearching(false);
    setHasSearched(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied code: ${code}`);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  // Find newest published date across active companies
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

  const activeCompaniesCount = companies.filter((c) => c.activeUploadId).length;
  const totalCatalogRows = companies.reduce((acc, c) => acc + (c.rowCount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#FFF1F0] text-[#E53935]">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-[#202124]">
                  VAN Number & Item Code Lookup
                </h1>
                <p className="text-xs text-[#6B7280]">
                  Instant search across active company price-lists and appliance catalogs
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {newestUpdatedDate && (
              <div
                className="text-right text-xs bg-gray-50 border border-[#E5E7EB] px-3 py-1.5 rounded-xl cursor-help"
                title={companies
                  .map(
                    (c) =>
                      `${c.name}: ${
                        c.publishedAt ? new Date(c.publishedAt).toLocaleDateString("en-IN") : "N/A"
                      } (${c.rowCount || 0} items)`
                  )
                  .join("\n")}
              >
                <span className="text-[#6B7280] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#E53935]" />
                  Last updated:
                </span>
                <span className="font-semibold text-[#202124]">
                  {formatDate(newestUpdatedDate)}
                </span>
              </div>
            )}

            {canManage && (
              <Link
                to="/van/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E53935] hover:bg-[#C62828] text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Manage Catalogs</span>
              </Link>
            )}
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="mt-6 relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-[#9CA3AF] absolute left-4 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by Model Number (e.g. GLC48, LDWF14) or Item Code (e.g. 118784)..."
              className="w-full pl-12 pr-24 py-3.5 bg-gray-50/70 border border-[#D1D5DB] focus:border-[#E53935] focus:bg-white focus:ring-2 focus:ring-[#E53935]/20 rounded-2xl text-sm font-medium text-[#202124] transition-all outline-hidden shadow-inner"
              autoFocus
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {searching && (
                <div className="p-1 text-[#E53935]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company Quick-Filter Chips */}
        {companies.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[#6B7280] font-medium mr-1 shrink-0">Company:</span>
            <button
              type="button"
              onClick={() => setSelectedCompanyFilter("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                selectedCompanyFilter === "all"
                  ? "bg-[#E53935] text-white shadow-2xs"
                  : "bg-gray-100 text-[#4B5563] hover:bg-gray-200"
              }`}
            >
              All Companies ({totalCatalogRows})
            </button>
            {companies.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedCompanyFilter(c.key)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selectedCompanyFilter === c.key
                    ? "bg-[#E53935] text-white shadow-2xs"
                    : "bg-gray-100 text-[#4B5563] hover:bg-gray-200"
                }`}
              >
                <span>{c.name}</span>
                <span className="text-[10px] opacity-75 font-mono">
                  ({c.rowCount || 0})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Display Area */}
      {hasSearched ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#6B7280] px-1">
            <span>
              Found <strong className="text-[#202124]">{results.length}</strong> matching item
              {results.length === 1 ? "" : "s"}
            </span>
            <span>Click &apos;Copy&apos; to copy Item Code to clipboard</span>
          </div>

          {results.length === 0 && !searching ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-2xs">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#202124]">No Matching Item Code Found</h3>
              <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
                No model or item code in the active company catalogs matched &quot;{query}&quot;. Try
                searching with a shorter model prefix or check another company filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((item) => {
                const isCopied = copiedCode === item.itemCode;
                return (
                  <div
                    key={`${item.companyKey}_${item.modelKey}`}
                    className="bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#E53935]/40 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3 shadow-2xs group"
                  >
                    <div>
                      {/* Top Row: Company Chip & Model Number */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-base text-[#202124] block tracking-tight group-hover:text-[#E53935] transition-colors truncate">
                            {item.modelNumber}
                          </span>
                          {item.description && (
                            <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          )}
                          {/* Extra column chips */}
                          {item.extra && typeof item.extra === "object" && Object.keys(item.extra).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(item.extra).map(([key, val]) => (
                                val && (
                                  <span
                                    key={key}
                                    className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[10px] text-[#6B7280] font-medium"
                                    title={key}
                                  >
                                    {val}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF1F0] text-[#E53935] border border-[#FECDD3] text-[11px] font-bold shrink-0">
                          <Building2 className="w-3 h-3" />
                          <span>{item.companyName || "Catalog"}</span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Item Code & Big Copy Button */}
                    <div className="pt-2 border-t border-[#F3F4F6] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#9CA3AF] block">
                          ITEM CODE / VAN NUMBER
                        </span>
                        <span className="font-mono text-xl font-extrabold text-[#E53935] tracking-wider block">
                          {item.itemCode}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(item.itemCode, e)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-[#FFF1F0] hover:bg-[#E53935] text-[#E53935] hover:text-white border border-[#FECDD3]"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Empty Search Guidance State */
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 sm:p-12 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-[#E53935] flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-[#202124]">
              Fast Appliance Model & VAN Code Lookup
            </h3>
            <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
              Start typing an appliance model number or code. The system searches across active
              company catalogs ({activeCompaniesCount} published active companies) and provides
              instant one-click copyable Item Codes.
            </p>
          </div>

          {activeCompaniesCount === 0 && !loadingCompanies && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 max-w-md mx-auto flex items-center justify-between gap-3">
              <span>No company catalogs have been published yet.</span>
              {canManage && (
                <Link
                  to="/van/admin"
                  className="font-bold text-[#E53935] hover:underline flex items-center gap-1 shrink-0"
                >
                  Upload Catalog <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VanSearchPage;
