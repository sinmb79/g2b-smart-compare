import { SearchBar } from "@/components/search/SearchBar";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center px-4">
      {/* Hero */}
      <div className="max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          나라장터 관급자재 스마트 비교
        </h1>
        <p className="text-gray-500 text-lg">
          품목 검색, 업체 비교, 납품활동 지표 확인 — 모두 무료, 로그인 불필요
        </p>
      </div>

      {/* Search */}
      <div className="w-full max-w-2xl">
        <SearchBar autoFocus size="large" />
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-500">
        <span>인기 검색어:</span>
        {["사무용 의자", "A4 용지", "소화기", "마스크", "에어컨"].map((term) => (
          <a
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            {term}
          </a>
        ))}
      </div>

      {/* Service features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mt-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-left">
          <div className="text-2xl mb-2" aria-hidden="true">🔍</div>
          <h2 className="font-semibold text-gray-900 mb-1">통합 검색</h2>
          <p className="text-sm text-gray-500">품목명, 분류, 키워드로 빠르게 검색</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-left">
          <div className="text-2xl mb-2" aria-hidden="true">📊</div>
          <h2 className="font-semibold text-gray-900 mb-1">납품활동 지표</h2>
          <p className="text-sm text-gray-500">납품실적 기반 업체 활동 참고 지표 제공</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-left">
          <div className="text-2xl mb-2" aria-hidden="true">💰</div>
          <h2 className="font-semibold text-gray-900 mb-1">
            참고 가격{" "}
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Beta</span>
          </h2>
          <p className="text-sm text-gray-500">외부 쇼핑몰 참고 가격 조회 (조건 상이 가능)</p>
        </div>
      </div>
    </div>
  );
}
