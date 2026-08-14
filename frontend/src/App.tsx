import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Field,
  FluentProvider,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title1,
  Title3,
  webLightTheme,
} from "@fluentui/react-components";
import { ApiError, getMeals, searchSchools } from "./api";
import type { Meal, School, SchoolSearchResponse } from "./types";
import "./App.css";

type RequestState = "idle" | "loading" | "success" | "error";

const today = formatLocalDate(new Date());

export default function App() {
  const [query, setQuery] = useState("");
  const [schoolResults, setSchoolResults] =
    useState<SchoolSearchResponse | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [searchError, setSearchError] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealState, setMealState] = useState<RequestState>("idle");
  const [mealError, setMealError] = useState("");
  const searchController = useRef<AbortController | null>(null);
  const mealController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      searchController.current?.abort();
      mealController.current?.abort();
    },
    [],
  );

  async function runSearch(page: number) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchState("error");
      setSearchError("학교 이름을 입력해 주세요.");
      setSchoolResults(null);
      return;
    }

    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearchState("loading");
    setSearchError("");
    setSelectedSchool(null);
    setMealState("idle");
    setMeals([]);

    try {
      const result = await searchSchools(trimmedQuery, page, controller.signal);
      if (searchController.current !== controller) return;
      setSchoolResults(result);
      setSearchState("success");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (searchController.current !== controller) return;
      setSearchState("error");
      setSearchError(toUserMessage(error));
      setSchoolResults(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(1);
  }

  function selectSchool(school: School) {
    mealController.current?.abort();
    setSelectedSchool(school);
    setMeals([]);
    setMealState("idle");
    setMealError("");
  }

  async function handleMealSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSchool) return;
    if (!startDate || !endDate) {
      setMealState("error");
      setMealError("시작일과 종료일을 모두 선택해 주세요.");
      return;
    }
    if (endDate < startDate) {
      setMealState("error");
      setMealError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    setMealState("loading");
    setMealError("");
    setMeals([]);
    mealController.current?.abort();
    const controller = new AbortController();
    mealController.current = controller;
    try {
      const result = await getMeals(
        selectedSchool,
        startDate,
        endDate,
        controller.signal,
      );
      if (mealController.current !== controller) return;
      setMeals(result.items);
      setMealState("success");
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (mealController.current !== controller) return;
      setMealState("error");
      setMealError(toUserMessage(error));
    }
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <div id="page-top">
        <nav className="site-nav" aria-label="주요 메뉴">
          <div className="nav-container">
            <a className="brand" href="#page-top">
              급식 배틀
            </a>
            <div className="nav-links">
              <a href="#school-search">학교 검색</a>
              <a href="#date-range">날짜 선택</a>
              <a href="#meal-results">급식 결과</a>
            </div>
          </div>
        </nav>

        <header className="hero">
          <div className="hero-content">
            <LunchAvatar />
            <Title1>급식 배틀</Title1>
            <StarDivider light />
            <Text className="hero-tagline">
              학교 검색 · 날짜 선택 · 오늘의 중식
            </Text>
          </div>
        </header>

        <main>
          <section
            id="school-search"
            aria-labelledby="school-step"
            className="content-section"
          >
            <div className="section-container">
              <div className="section-title">
                <Title1 id="school-step">학교 검색</Title1>
                <StarDivider />
                <Text>
                  학교 이름의 일부를 입력하고 원하는 학교를 선택하세요.
                </Text>
              </div>
            <form onSubmit={handleSearch} className="search-form">
              <Field label="학교 이름" hint="학교 이름의 일부만 입력해도 됩니다.">
                <Input
                  value={query}
                  onChange={(_event, data) => setQuery(data.value)}
                  placeholder="예: 한빛"
                  aria-label="학교 이름"
                />
              </Field>
              <Button appearance="primary" type="submit">
                검색
              </Button>
            </form>

            {searchState === "loading" && (
              <Spinner label="학교를 검색하고 있습니다." />
            )}
            {searchState === "error" && (
              <StatusMessage intent="error" message={searchError} />
            )}
            {searchState === "success" && schoolResults?.items.length === 0 && (
              <StatusMessage
                intent="info"
                message="검색 결과가 없습니다. 다른 학교 이름으로 검색해 보세요."
              />
            )}
            {schoolResults && schoolResults.items.length > 0 && (
              <>
                <Text className="result-count">
                  총 {schoolResults.total.toLocaleString("ko-KR")}개 학교
                </Text>
                <div className="school-grid" role="list">
                  {schoolResults.items.map((school) => {
                    const selected =
                      selectedSchool?.school_code === school.school_code &&
                      selectedSchool.office_code === school.office_code;
                    return (
                      <Card
                        key={`${school.office_code}-${school.school_code}`}
                        className={`school-card ${selected ? "selected" : ""}`}
                        role="listitem"
                      >
                        <Title3>{school.name}</Title3>
                        <Text>
                          {school.school_type} · {school.location}
                        </Text>
                        <Text size={200}>{school.office_name}</Text>
                        {school.address && (
                          <Text size={200}>{school.address}</Text>
                        )}
                        <Button
                          appearance={selected ? "primary" : "secondary"}
                          onClick={() => selectSchool(school)}
                          aria-pressed={selected}
                        >
                          {selected ? "선택됨" : "이 학교 선택"}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
                <nav className="pagination" aria-label="학교 검색 페이지">
                  <Button
                    disabled={schoolResults.page === 1}
                    onClick={() => void runSearch(schoolResults.page - 1)}
                  >
                    이전
                  </Button>
                  <Text>{schoolResults.page}페이지</Text>
                  <Button
                    disabled={!schoolResults.has_next}
                    onClick={() => void runSearch(schoolResults.page + 1)}
                  >
                    다음
                  </Button>
                </nav>
              </>
            )}
            </div>
          </section>

          <section
            id="date-range"
            aria-labelledby="date-step"
            className={`content-section accent-section ${
              selectedSchool ? "" : "disabled-step"
            }`}
          >
            <div className="section-container">
              <div className="section-title">
                <Title1 id="date-step">날짜 범위 선택</Title1>
                <StarDivider light />
                <Text>하루 또는 원하는 기간의 중식을 조회할 수 있습니다.</Text>
              </div>
              {!selectedSchool ? (
                <div className="empty-prompt">먼저 학교를 선택해 주세요.</div>
              ) : (
                <>
                  <Text className="selected-school">
                    선택한 학교: <strong>{selectedSchool.name}</strong>
                  </Text>
                  <form onSubmit={handleMealSearch} className="date-form">
                    <Field label="시작일">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(_event, data) => setStartDate(data.value)}
                      />
                    </Field>
                    <Field label="종료일">
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(_event, data) => setEndDate(data.value)}
                      />
                    </Field>
                    <Button
                      appearance="primary"
                      type="submit"
                      disabled={mealState === "loading"}
                    >
                      급식 조회
                    </Button>
                  </form>
                </>
              )}
            </div>
          </section>

          <section
            id="meal-results"
            aria-labelledby="result-step"
            className={`content-section ${
              mealState === "idle" ? "disabled-step" : ""
            }`}
          >
            <div className="section-container">
              <div className="section-title">
                <Title1 id="result-step">급식 결과</Title1>
                <StarDivider />
                <Text>날짜별 중식 메뉴를 확인하세요.</Text>
              </div>
              {mealState === "idle" && (
                <div className="empty-prompt">학교와 날짜를 선택해 주세요.</div>
              )}
              {mealState === "loading" && (
                <Spinner label="급식 정보를 불러오고 있습니다." />
              )}
              {mealState === "error" && (
                <StatusMessage intent="error" message={mealError} />
              )}
              {mealState === "success" && meals.length === 0 && (
                <StatusMessage
                  intent="info"
                  message="선택한 기간에는 급식 정보가 없습니다. 방학이나 휴일인지 확인해 주세요."
                />
              )}
              {mealState === "success" && meals.length > 0 && (
                <div className="meal-grid">
                  {meals.map((meal) => (
                    <Card key={meal.date} className="meal-card">
                      <Title3>
                        {new Intl.DateTimeFormat("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                          timeZone: "UTC",
                        }).format(new Date(`${meal.date}T00:00:00Z`))}
                      </Title3>
                      <ul>
                        {meal.menu_items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {meal.calories && (
                        <Text size={200}>열량 {meal.calories}</Text>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>

        <footer>
          <div className="footer-main">
            <div>
              <h2>급식 배틀</h2>
              <p>전국 학교의 중식 메뉴를 빠르고 간편하게 확인하세요.</p>
            </div>
            <div>
              <h2>데이터 출처</h2>
              <p>NEIS 교육정보 개방 포털</p>
            </div>
            <div>
              <h2>디자인</h2>
              <p>
                MIT 라이선스의{" "}
                <a
                  href="https://github.com/jeromelachaud/freelancer-theme"
                  target="_blank"
                  rel="noreferrer"
                >
                  Freelancer Theme
                </a>
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            급식 배틀 · 학교 급식 조회 서비스
          </div>
        </footer>
      </div>
    </FluentProvider>
  );
}

function LunchAvatar() {
  return (
    <div className="lunch-avatar" aria-hidden="true">
      <svg viewBox="0 0 240 240" role="img">
        <circle cx="120" cy="120" r="116" fill="#2c3e50" />
        <path
          d="M57 105h126l-12 69c-3 16-16 28-33 28H102c-17 0-30-12-33-28z"
          fill="#fff"
        />
        <path
          d="M77 105c4-28 21-46 43-46s39 18 43 46"
          fill="none"
          stroke="#fff"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M91 139h58M99 164h42"
          stroke="#18bc9c"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function StarDivider({ light = false }: { light?: boolean }) {
  return (
    <div className={`star-divider ${light ? "light" : ""}`} aria-hidden="true">
      <span>★</span>
    </div>
  );
}

function StatusMessage({
  intent,
  message,
}: {
  intent: "error" | "info";
  message: string;
}) {
  return (
    <MessageBar intent={intent}>
      <MessageBarBody>{message}</MessageBarBody>
    </MessageBar>
  );
}

function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
