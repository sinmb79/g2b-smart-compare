# G2B 스마트 비교

나라장터 종합쇼핑몰 공공데이터 기반 관급자재 검색·비교 서비스 (비영리 공익 보조도구)

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database**: PostgreSQL 15
- **Search**: Elasticsearch 8.x (Korean nori analyzer)
- **Cache**: Redis 7
- **ETL**: Node.js (csv-parse, xlsx)

## 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env.local
# .env.local 파일에 API 키 입력
```

### 2. 인프라 실행 (Docker)

```bash
docker-compose up -d
```

### 3. DB 스키마 초기화

```bash
npm run db:init
```

### 4. Elasticsearch 인덱스 초기화

```bash
npm run es:init
```

### 5. 데이터 인제스트 (조달데이터허브 CSV/Excel)

```bash
npm run ingest -- "path/to/g2b_data.csv"
```

### 6. 납품활동 지표 계산

```bash
npm run scores:recalc
```

### 7. 개발 서버 실행

```bash
npm run dev
```

## 주요 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run db:init` | PostgreSQL 스키마 초기화 |
| `npm run es:init` | Elasticsearch 인덱스 생성 |
| `npm run ingest -- <file>` | 데이터 파일 인제스트 |
| `npm run scores:recalc` | 납품활동 지표 재계산 |
| `npm run price:fetch` | Naver Shopping 참고 가격 수집 |

## 디렉토리 구조

```
g2b-smart-compare/
├── db/init/              # PostgreSQL 스키마 SQL
├── docker-compose.yml    # PostgreSQL + ES + Redis
├── scripts/              # ETL CLI 스크립트
└── src/
    ├── app/              # Next.js App Router 페이지 + API 라우트
    ├── components/       # React 컴포넌트
    ├── lib/
    │   ├── db/           # PostgreSQL 클라이언트
    │   ├── es/           # Elasticsearch 클라이언트 + 인덱스
    │   ├── etl/          # ETL 파이프라인, 정규화, 스코어링
    │   ├── matching/     # TF-IDF 상품명 매칭
    │   ├── price/        # Naver Shopping 가격 수집
    │   ├── redis/        # Redis 캐시
    │   └── search/       # 검색 엔진
    └── types/            # TypeScript 공통 타입
```

## 면책 고지

본 서비스는 나라장터 공공데이터를 가공·재제공하는 비영리 공익 보조도구입니다.
제공되는 정보는 의사결정 참고 자료이며, 공식 평가가 아닙니다.
납품활동 지표는 참고 지표이며, 업체 신뢰도·품질을 보증하지 않습니다.
외부 쇼핑몰 가격은 참고용이며 구성·조건이 다를 수 있습니다.
