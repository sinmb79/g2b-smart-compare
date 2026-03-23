"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  initialQuery?: string;
  autoFocus?: boolean;
  size?: "default" | "large";
}

const RECENT_SEARCHES_KEY = "g2b_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  try {
    const existing = getRecentSearches();
    const updated = [query, ...existing.filter((q) => q !== query)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function SearchBar({ initialQuery = "", autoFocus = false, size = "default" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches from localStorage (client only)
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Autocomplete fetch with debounce
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&autocomplete=true`);
      if (res.ok) {
        const data = (await res.json()) as { suggestions: string[] };
        setSuggestions(data.suggestions);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
  };

  const handleSubmit = (searchQuery: string = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setShowDropdown(false);
    setSuggestions([]);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const clearQuery = () => {
    setQuery("");
    setSuggestions([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = suggestions.length > 0 ? suggestions : recentSearches;
    if (!showDropdown || items.length === 0) {
      if (e.key === "Enter") handleSubmit();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        setQuery(items[activeIndex]);
        handleSubmit(items[activeIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  // Click outside closes dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isLarge = size === "large";
  const dropdownItems = suggestions.length > 0 ? suggestions : (showDropdown ? recentSearches : []);

  return (
    <div className="relative w-full" role="search">
      <div
        className={`flex items-center gap-2 bg-white border-2 rounded-xl ${
          isLarge ? "border-blue-500 px-4 py-3" : "border-gray-300 px-3 py-2"
        } focus-within:border-blue-500 transition-colors shadow-sm`}
      >
        <Search
          size={isLarge ? 20 : 16}
          className="text-gray-400 shrink-0"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="상품 검색"
          aria-autocomplete="list"
          aria-expanded={showDropdown && dropdownItems.length > 0}
          aria-controls="search-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          placeholder="품목명, 규격, 브랜드 검색..."
          value={query}
          autoFocus={autoFocus}
          className={`flex-1 outline-none bg-transparent text-gray-900 placeholder:text-gray-400 ${
            isLarge ? "text-lg" : "text-sm"
          }`}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="검색어 지우기"
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSubmit()}
          aria-label="검색"
          className={`shrink-0 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors ${
            isLarge ? "px-5 py-2 text-base" : "px-3 py-1.5 text-sm"
          }`}
        >
          검색
        </button>
      </div>

      {/* Dropdown: suggestions or recent searches */}
      {showDropdown && dropdownItems.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          role="listbox"
          aria-label="검색 제안"
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {suggestions.length === 0 && recentSearches.length > 0 && (
            <p className="text-xs text-gray-400 px-4 pt-2 pb-1">최근 검색</p>
          )}
          {dropdownItems.map((item, i) => (
            <button
              key={item}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 focus:outline-none ${
                i === activeIndex ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                setQuery(item);
                handleSubmit(item);
              }}
            >
              <Search size={13} className="text-gray-400 shrink-0" aria-hidden="true" />
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
