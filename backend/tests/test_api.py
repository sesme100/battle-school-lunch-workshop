from datetime import date

import httpx
import pytest

from app.main import app, get_neis_client
from app.models import Meal, School
from app.neis import NeisError, NeisTimeoutError


class FakeNeisClient:
    def __init__(self) -> None:
        self.error: NeisError | None = None

    async def search_schools(
        self, query: str, page: int, page_size: int
    ) -> tuple[list[School], int]:
        if self.error:
            raise self.error
        if query == "없음":
            return [], 0
        return [
            School(
                office_code="B10",
                office_name="서울특별시교육청",
                school_code="123",
                name="한빛중학교",
                school_type="중학교",
                location="서울특별시",
            )
        ], 11

    async def get_meals(
        self, office_code: str, school_code: str, start_date: str, end_date: str
    ) -> list[Meal]:
        if self.error:
            raise self.error
        return [
            Meal(
                date=date(2026, 8, 14),
                menu_items=["쌀밥", "김치찌개"],
                calories="650 Kcal",
            )
        ]


@pytest.fixture
async def client() -> tuple[httpx.AsyncClient, FakeNeisClient]:
    fake = FakeNeisClient()
    app.dependency_overrides[get_neis_client] = lambda: fake
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as test_client:
        yield test_client, fake
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_school_search_returns_page_metadata(
    client: tuple[httpx.AsyncClient, FakeNeisClient],
) -> None:
    test_client, _fake = client

    response = await test_client.get(
        "/api/schools", params={"q": "한빛", "page": 1, "page_size": 10}
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["name"] == "한빛중학교"
    assert response.json()["has_next"] is True


@pytest.mark.asyncio
async def test_empty_and_invalid_school_search(
    client: tuple[httpx.AsyncClient, FakeNeisClient],
) -> None:
    test_client, _fake = client

    empty_response = await test_client.get("/api/schools", params={"q": "없음"})
    invalid_response = await test_client.get("/api/schools", params={"q": "  "})

    assert empty_response.status_code == 200
    assert empty_response.json()["items"] == []
    assert invalid_response.status_code == 422
    assert invalid_response.json()["code"] == "INVALID_REQUEST"


@pytest.mark.asyncio
async def test_meal_date_range_validation_and_success(
    client: tuple[httpx.AsyncClient, FakeNeisClient],
) -> None:
    test_client, _fake = client
    params = {
        "office_code": "B10",
        "school_code": "123",
        "start_date": "2026-08-14",
        "end_date": "2026-08-14",
    }

    response = await test_client.get("/api/meals", params=params)
    invalid_response = await test_client.get(
        "/api/meals",
        params={**params, "start_date": "2026-08-15"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["menu_items"] == ["쌀밥", "김치찌개"]
    assert invalid_response.status_code == 422
    assert "종료일" in invalid_response.json()["detail"]


@pytest.mark.asyncio
async def test_upstream_errors_have_distinct_statuses(
    client: tuple[httpx.AsyncClient, FakeNeisClient],
) -> None:
    test_client, fake = client
    fake.error = NeisTimeoutError("NEIS_TIMEOUT", "시간 초과")
    timeout_response = await test_client.get("/api/schools", params={"q": "한빛"})
    fake.error = NeisError("NEIS_UNAVAILABLE", "일시 오류")
    unavailable_response = await test_client.get(
        "/api/schools", params={"q": "한빛"}
    )

    assert timeout_response.status_code == 504
    assert timeout_response.json()["code"] == "NEIS_TIMEOUT"
    assert unavailable_response.status_code == 502
    assert unavailable_response.json()["code"] == "NEIS_UNAVAILABLE"
