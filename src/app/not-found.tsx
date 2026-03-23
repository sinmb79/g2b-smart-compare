import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
      <p className="text-6xl font-bold text-gray-200" aria-hidden="true">404</p>
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-gray-500 text-sm">요청하신 페이지가 존재하지 않거나 삭제되었습니다.</p>
      </div>
      <Link
        href="/"
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
