# 광산구시설관리공단 규정정보센터

전남광주통합특별시광산구시설관리공단 규정을 국가법령정보센터 방식으로 열람하고,
조문을 선택해 **신·구조문대조표**를 생성하는 웹 애플리케이션입니다.

## 주요 기능

- **규정·내규 열람** — 규정 34개(1,519개 조문)와 내규 28개(652개 조문)를
  장(章)/조문 트리로 탐색하며, 상단 탭으로 규정/내규를 전환
- **3-패널 레이아웃** — 목록 · 조문 트리 · 조문 본문 뷰어
- **검색** — 규정·내규명 및 조문 제목·본문 전문 검색
- **개정 이력 표시** — 조문 내 `<개정 …>` 표기 하이라이트, 규정별 최근 개정일
- **신·구조문대조표 생성** — 조문을 선택해 현행/개정안을 편집하면 단어 단위 diff로
  변경 사항(삭제=빨강, 신설=파랑)을 좌우 대조표로 렌더링, 인쇄/PDF 저장 지원

## 실행

```bash
cd app
npm ci          # 최초 1회 (lockfile 기준 설치)
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드 → app/dist/
npm run preview # 빌드 결과 미리보기
```

빌드 결과물은 `app/dist/`에 생성되며, 정적 호스팅으로 바로 서비스할 수 있습니다.

## 데이터 출처 및 추출

### 규정 (`규정 합본.hwp`)

규정 데이터는 한글 배포용 문서에서 추출했습니다. 배포용 문서는
`ViewText` 스트림에 AES-128-ECB로 암호화되어 있으며, `scripts/extract_hwp.py`가
HWPTAG_DISTRIBUTE_DOC_DATA 시드로 키를 유도해 복호화·추출합니다.

```bash
python3 scripts/extract_hwp.py "규정 합본.hwp" paras.json
python3 scripts/build_regulations.py paras.json app/public/regulations.json
```

### 내규 (`내규 합본.hwpx`)

내규 데이터는 암호가 해제된 HWPX 문서에서 추출했습니다. HWPX는 본문을
`Contents/section*.xml`(OWPML)에 저장하며, `scripts/extract_hwpx.py`가 각
`<hp:p>` 문단의 `<hp:t>` 텍스트 런을 순서대로 이어 붙여 문단 목록을 만듭니다.

```bash
python3 scripts/extract_hwpx.py "내규 합본.hwpx" naegyu_paras.json
python3 scripts/build_naegyu.py naegyu_paras.json app/public/naegyu.json
```

추출된 문단은 규정/내규 → 장 → 조문 → 항/호 구조로 파싱되어
`app/public/regulations.json`, `app/public/naegyu.json`에 각각 저장되며,
파이프라인은 결정적(deterministic)이라 동일 입력에 대해 바이트 단위로 동일한
결과를 재생성합니다.

> 참고: 최초 제공된 내규 HWPX는 문서 전체가 AES-256으로 암호화되어 열람이
> 불가능했으나, 이후 암호가 해제된 파일이 제공되어 정상 반영되었습니다.

## 스택

Vite · React 18 · 순수 CSS(디자인 토큰) · Pretendard
