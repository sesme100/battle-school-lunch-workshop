import { expect, test } from "@playwright/test";

test("학교 검색부터 급식 결과까지 전체 흐름을 표시한다", async ({ page }) => {
  await page.route("**/api/schools**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            office_code: "B10",
            office_name: "서울특별시교육청",
            school_code: "123",
            name: "한빛중학교",
            school_type: "중학교",
            location: "서울특별시",
            address: "서울시 한빛로 1",
          },
        ],
        page: 1,
        page_size: 10,
        total: 1,
        has_next: false,
      }),
    });
  });
  await page.route("**/api/meals**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            date: "2026-08-14",
            menu_items: ["쌀밥", "김치찌개"],
            calories: "650 Kcal",
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("학교 이름").fill("한빛");
  await page.getByRole("button", { name: "검색" }).click();
  await page.getByRole("button", { name: "이 학교 선택" }).click();
  await page.getByRole("button", { name: "급식 조회" }).click();

  await expect(page.getByText("김치찌개")).toBeVisible();
  await expect(page.getByText("열량 650 Kcal")).toBeVisible();
});
