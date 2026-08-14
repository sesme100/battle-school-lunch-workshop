import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

const school = {
  office_code: "B10",
  office_name: "서울특별시교육청",
  school_code: "123",
  name: "한빛중학교",
  school_type: "중학교",
  location: "서울특별시",
  address: "서울시 한빛로 1",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("학교 검색부터 날짜 선택과 급식 결과 표시까지 진행한다", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      jsonResponse({
        items: [school],
        page: 1,
        page_size: 10,
        total: 1,
        has_next: false,
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            date: "2026-08-14",
            menu_items: ["쌀밥", "김치찌개"],
            calories: "650 Kcal",
          },
        ],
      }),
    );

  render(<App />);
  await user.type(screen.getByLabelText("학교 이름"), "한빛");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await user.click(
    await screen.findByRole("button", { name: "이 학교 선택" }),
  );
  await user.click(screen.getByRole("button", { name: "급식 조회" }));

  expect(await screen.findByText("김치찌개")).toBeInTheDocument();
  expect(screen.getByText("열량 650 Kcal")).toBeInTheDocument();
});

test("빈 검색 결과와 빈 급식 결과를 안내한다", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      jsonResponse({
        items: [],
        page: 1,
        page_size: 10,
        total: 0,
        has_next: false,
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        items: [school],
        page: 1,
        page_size: 10,
        total: 1,
        has_next: false,
      }),
    )
    .mockResolvedValueOnce(jsonResponse({ items: [] }));

  render(<App />);
  const input = screen.getByLabelText("학교 이름");
  await user.type(input, "없는학교");
  await user.click(screen.getByRole("button", { name: "검색" }));
  expect(
    await screen.findByText(/검색 결과가 없습니다/),
  ).toBeInTheDocument();

  await user.clear(input);
  await user.type(input, "한빛");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await user.click(
    await screen.findByRole("button", { name: "이 학교 선택" }),
  );
  await user.click(screen.getByRole("button", { name: "급식 조회" }));
  expect(
    await screen.findByText(/선택한 기간에는 급식 정보가 없습니다/),
  ).toBeInTheDocument();
});

test("잘못된 날짜 범위는 API 호출 전에 차단한다", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    jsonResponse({
      items: [school],
      page: 1,
      page_size: 10,
      total: 1,
      has_next: false,
    }),
  );
  render(<App />);
  await user.type(screen.getByLabelText("학교 이름"), "한빛");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await user.click(
    await screen.findByRole("button", { name: "이 학교 선택" }),
  );

  const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
  await user.clear(dateInputs[0]);
  await user.type(dateInputs[0], "2026-08-15");
  await user.clear(dateInputs[1]);
  await user.type(dateInputs[1], "2026-08-14");
  await user.click(screen.getByRole("button", { name: "급식 조회" }));

  expect(await screen.findByText(/종료일은 시작일보다/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("API 오류를 사용자에게 안내한다", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    jsonResponse(
      { code: "NEIS_UNAVAILABLE", detail: "NEIS API가 일시적으로 응답하지 않습니다." },
      502,
    ),
  );
  render(<App />);
  await user.type(screen.getByLabelText("학교 이름"), "한빛");
  await user.click(screen.getByRole("button", { name: "검색" }));

  expect(
    await screen.findByText("NEIS API가 일시적으로 응답하지 않습니다."),
  ).toBeInTheDocument();
});

test("연속 검색에서는 가장 최근 응답만 반영한다", async () => {
  const user = userEvent.setup();
  let resolveFirst: ((response: Response) => void) | undefined;
  const firstResponse = new Promise<Response>((resolve) => {
    resolveFirst = resolve;
  });
  vi.spyOn(globalThis, "fetch")
    .mockReturnValueOnce(firstResponse)
    .mockResolvedValueOnce(
      jsonResponse({
        items: [{ ...school, name: "최신학교" }],
        page: 1,
        page_size: 10,
        total: 1,
        has_next: false,
      }),
    );
  render(<App />);
  const input = screen.getByLabelText("학교 이름");
  await user.type(input, "이전");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await user.clear(input);
  await user.type(input, "최신");
  await user.click(screen.getByRole("button", { name: "검색" }));

  expect(await screen.findByText("최신학교")).toBeInTheDocument();
  resolveFirst?.(
    jsonResponse({
      items: [{ ...school, name: "이전학교" }],
      page: 1,
      page_size: 10,
      total: 1,
      has_next: false,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByText("이전학교")).not.toBeInTheDocument(),
  );
});

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
