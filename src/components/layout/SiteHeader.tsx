"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="G2B 스마트 비교 홈으로 이동"
          >
            <span aria-hidden="true">🏛️</span>
            <span>G2B 스마트 비교</span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="주 메뉴" className="hidden md:flex items-center gap-6">
            <Link
              href="/search"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              <Search size={15} aria-hidden="true" />
              상품 검색
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            >
              서비스 소개
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden p-2 text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            aria-label="모바일 메뉴"
            className="md:hidden py-3 border-t border-gray-100 flex flex-col gap-3"
          >
            <Link
              href="/search"
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-700 px-1"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Search size={15} aria-hidden="true" />
              상품 검색
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-700 hover:text-blue-700 px-1"
              onClick={() => setMobileMenuOpen(false)}
            >
              서비스 소개
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
