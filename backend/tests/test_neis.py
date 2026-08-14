import json

import httpx
import pytest

from app.neis import NeisClient, NeisError, NeisTimeoutError, parse_menu


def _response(payload: object, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code,
        content=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
    )


@pytest.mark.asyncio
async def test_search_schools_parses_pagination_and_school() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["SCHUL_NM"] == "한빛"
        assert request.url.params["pIndex"] == "2"
        return _response(
            {
                "schoolInfo": [
                    {
                        "head": [
                            {"list_total_count": 11},
                            {"RESULT": {"CODE": "INFO-000", "MESSAGE": "정상"}},
                        ]
                    },
                    {
                        "row": [
                            {
                                "ATPT_OFCDC_SC_CODE": "B10",
                                "ATPT_OFCDC_SC_NM": "서울특별시교육청",
                                "SD_SCHUL_CODE": "123",
                                "SCHUL_NM": "한빛중학교",
                                "SCHUL_KND_SC_NM": "중학교",
                                "LCTN_SC_NM": "서울특별시",
                                "ORG_RDNMA": "서울시 한빛로",
                                "ORG_RDNDA": "1",
                            }
                        ]
                    },
                ]
            }
        )

    client = NeisClient("sample", transport=httpx.MockTransport(handler))
    schools, total = await client.search_schools("한빛", 2, 10)
    await client.close()

    assert total == 11
    assert schools[0].name == "한빛중학교"
    assert schools[0].address == "서울시 한빛로 1"


@pytest.mark.asyncio
async def test_info_200_is_an_empty_result() -> None:
    transport = httpx.MockTransport(
        lambda _request: _response(
            {"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}
        )
    )
    client = NeisClient("sample", transport=transport)

    schools, total = await client.search_schools("없는학교", 1, 10)
    meals = await client.get_meals("B10", "123", "20260801", "20260802")
    await client.close()

    assert schools == []
    assert total == 0
    assert meals == []


@pytest.mark.asyncio
async def test_meals_parse_html_and_allergen_suffixes() -> None:
    transport = httpx.MockTransport(
        lambda _request: _response(
            {
                "mealServiceDietInfo": [
                    {
                        "head": [
                            {"list_total_count": 1},
                            {"RESULT": {"CODE": "INFO-000", "MESSAGE": "정상"}},
                        ]
                    },
                    {
                        "row": [
                            {
                                "MLSV_YMD": "20260814",
                                "DDISH_NM": "쌀밥<br/>김치찌개 (5.6)<br>사과&amp;배",
                                "CAL_INFO": "650 Kcal",
                            }
                        ]
                    },
                ]
            }
        )
    )
    client = NeisClient("sample", transport=transport)

    meals = await client.get_meals("B10", "123", "20260814", "20260814")
    await client.close()

    assert meals[0].date.isoformat() == "2026-08-14"
    assert meals[0].menu_items == ["쌀밥", "김치찌개 (5.6)", "사과&배"]
    assert parse_menu("<script>alert(1)</script>") == ["<script>alert(1)</script>"]


@pytest.mark.asyncio
async def test_timeout_is_retried_then_mapped() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("slow", request=request)

    client = NeisClient(
        "sample", max_retries=1, transport=httpx.MockTransport(handler)
    )

    with pytest.raises(NeisTimeoutError) as error:
        await client.search_schools("한빛", 1, 10)
    await client.close()

    assert attempts == 2
    assert error.value.code == "NEIS_TIMEOUT"


@pytest.mark.asyncio
async def test_rate_limit_is_retried_then_mapped() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return _response({}, status_code=429)

    client = NeisClient(
        "sample", max_retries=1, transport=httpx.MockTransport(handler)
    )

    with pytest.raises(NeisError) as error:
        await client.search_schools("한빛", 1, 10)
    await client.close()

    assert attempts == 2
    assert error.value.code == "NEIS_UNAVAILABLE"


@pytest.mark.asyncio
async def test_application_rate_limit_is_retried_then_mapped() -> None:
    attempts = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return _response(
            {"RESULT": {"CODE": "ERROR-337", "MESSAGE": "일별 트래픽 초과"}}
        )

    client = NeisClient(
        "sample", max_retries=1, transport=httpx.MockTransport(handler)
    )

    with pytest.raises(NeisError) as error:
        await client.search_schools("한빛", 1, 10)
    await client.close()

    assert attempts == 2
    assert error.value.code == "NEIS_UNAVAILABLE"


@pytest.mark.asyncio
async def test_invalid_row_is_mapped_to_neis_error() -> None:
    transport = httpx.MockTransport(
        lambda _request: _response(
            {
                "schoolInfo": [
                    {
                        "head": [
                            {"list_total_count": 1},
                            {"RESULT": {"CODE": "INFO-000", "MESSAGE": "정상"}},
                        ]
                    },
                    {"row": [{"SCHUL_NM": "불완전한 학교"}]},
                ]
            }
        )
    )
    client = NeisClient("sample", transport=transport)

    with pytest.raises(NeisError) as error:
        await client.search_schools("학교", 1, 10)
    await client.close()

    assert error.value.code == "NEIS_INVALID_RESPONSE"
