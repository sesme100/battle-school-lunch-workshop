import asyncio
import html
import json
import re
from collections.abc import Mapping
from datetime import datetime
from typing import TypeAlias

import httpx
from pydantic import TypeAdapter, ValidationError

from app.models import Meal, NeisMeal, NeisSchool, School

JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)
SCHOOL_ROWS = TypeAdapter(list[NeisSchool])
MEAL_ROWS = TypeAdapter(list[NeisMeal])
BR_TAG = re.compile(r"<br\s*/?>", re.IGNORECASE)


class NeisError(Exception):
    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


class NeisTimeoutError(NeisError):
    pass


class NeisRateLimitError(NeisError):
    pass


class NeisClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://open.neis.go.kr",
        *,
        timeout: float = 5.0,
        max_retries: int = 2,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(timeout),
            transport=transport,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def search_schools(
        self, query: str, page: int, page_size: int
    ) -> tuple[list[School], int]:
        payload = await self._get(
            "/hub/schoolInfo",
            {
                "SCHUL_NM": query,
                "pIndex": str(page),
                "pSize": str(page_size),
            },
        )
        sections = _get_sections(payload, "schoolInfo")
        if sections is None:
            return [], 0
        total = _get_total(sections)
        try:
            rows = SCHOOL_ROWS.validate_python(_get_rows(sections))
        except ValidationError as exc:
            raise NeisError(
                "NEIS_INVALID_RESPONSE", "NEIS 학교 응답 형식이 올바르지 않습니다."
            ) from exc
        schools = [
            School(
                office_code=row.ATPT_OFCDC_SC_CODE,
                office_name=row.ATPT_OFCDC_SC_NM,
                school_code=row.SD_SCHUL_CODE,
                name=row.SCHUL_NM,
                school_type=row.SCHUL_KND_SC_NM,
                location=row.LCTN_SC_NM,
                address=_join_address(row.ORG_RDNMA, row.ORG_RDNDA),
            )
            for row in rows
        ]
        return schools, total

    async def get_meals(
        self, office_code: str, school_code: str, start_date: str, end_date: str
    ) -> list[Meal]:
        payload = await self._get(
            "/hub/mealServiceDietInfo",
            {
                "ATPT_OFCDC_SC_CODE": office_code,
                "SD_SCHUL_CODE": school_code,
                "MMEAL_SC_CODE": "2",
                "MLSV_FROM_YMD": start_date,
                "MLSV_TO_YMD": end_date,
                "pIndex": "1",
                "pSize": "1000",
            },
        )
        sections = _get_sections(payload, "mealServiceDietInfo")
        if sections is None:
            return []
        try:
            rows = MEAL_ROWS.validate_python(_get_rows(sections))
        except ValidationError as exc:
            raise NeisError(
                "NEIS_INVALID_RESPONSE", "NEIS 급식 응답 형식이 올바르지 않습니다."
            ) from exc
        return [
            Meal(
                date=datetime.strptime(row.MLSV_YMD, "%Y%m%d").date(),
                menu_items=parse_menu(row.DDISH_NM),
                calories=row.CAL_INFO,
            )
            for row in rows
        ]

    async def _get(self, path: str, params: dict[str, str]) -> dict[str, JsonValue]:
        request_params = {
            "Key": self._api_key,
            "Type": "json",
            **params,
        }
        for attempt in range(self._max_retries + 1):
            try:
                response = await self._client.get(path, params=request_params)
            except httpx.TimeoutException as exc:
                if attempt == self._max_retries:
                    raise NeisTimeoutError(
                        "NEIS_TIMEOUT", "NEIS API 응답 시간이 초과되었습니다."
                    ) from exc
                await asyncio.sleep(0.1 * (2**attempt))
                continue
            except httpx.TransportError as exc:
                if attempt == self._max_retries:
                    raise NeisError(
                        "NEIS_UNAVAILABLE", "NEIS API에 연결할 수 없습니다."
                    ) from exc
                await asyncio.sleep(0.1 * (2**attempt))
                continue

            if response.status_code == 429 or response.status_code >= 500:
                if attempt < self._max_retries:
                    await asyncio.sleep(0.1 * (2**attempt))
                    continue
                raise NeisError(
                    "NEIS_UNAVAILABLE",
                    "NEIS API가 일시적으로 요청을 처리할 수 없습니다.",
                )
            if response.is_error:
                raise NeisError(
                    "NEIS_REQUEST_FAILED",
                    "NEIS API 요청이 거부되었습니다.",
                )

            try:
                decoded: object = json.loads(response.content)
                payload_value = _validate_json(decoded)
            except (json.JSONDecodeError, ValueError) as exc:
                raise NeisError(
                    "NEIS_INVALID_RESPONSE", "NEIS API 응답 형식이 올바르지 않습니다."
                ) from exc
            if not isinstance(payload_value, dict):
                raise NeisError(
                    "NEIS_INVALID_RESPONSE", "NEIS API 응답 형식이 올바르지 않습니다."
                )
            payload = payload_value
            try:
                _raise_for_result(payload)
            except NeisRateLimitError:
                if attempt < self._max_retries:
                    await asyncio.sleep(0.1 * (2**attempt))
                    continue
                raise NeisError(
                    "NEIS_UNAVAILABLE",
                    "NEIS API가 일시적으로 요청을 처리할 수 없습니다.",
                )
            return payload
        raise RuntimeError("unreachable")


def parse_menu(raw_menu: str) -> list[str]:
    normalized = BR_TAG.sub("\n", raw_menu)
    return [
        html.unescape(item).strip()
        for item in normalized.splitlines()
        if item.strip()
    ]


def _raise_for_result(payload: Mapping[str, JsonValue]) -> None:
    result = payload.get("RESULT")
    if result is None:
        return
    if not isinstance(result, Mapping):
        raise NeisError("NEIS_INVALID_RESPONSE", "NEIS 오류 응답 형식이 잘못되었습니다.")
    code = result.get("CODE")
    message = result.get("MESSAGE")
    if code == "INFO-200":
        return
    if not isinstance(code, str) or not isinstance(message, str):
        raise NeisError("NEIS_INVALID_RESPONSE", "NEIS 오류 응답 형식이 잘못되었습니다.")
    if code == "ERROR-337":
        raise NeisRateLimitError(code, message)
    if code != "INFO-000":
        raise NeisError("NEIS_REQUEST_FAILED", message)


def _get_sections(
    payload: Mapping[str, JsonValue], key: str
) -> list[JsonValue] | None:
    if "RESULT" in payload:
        return None
    sections = payload.get(key)
    if not isinstance(sections, list):
        raise NeisError("NEIS_INVALID_RESPONSE", "NEIS 응답에 필수 데이터가 없습니다.")
    return sections


def _get_total(sections: list[JsonValue]) -> int:
    for section in sections:
        if not isinstance(section, Mapping):
            continue
        head = section.get("head")
        if not isinstance(head, list):
            continue
        for item in head:
            if isinstance(item, Mapping):
                total = item.get("list_total_count")
                if isinstance(total, int) and not isinstance(total, bool):
                    return total
    raise NeisError("NEIS_INVALID_RESPONSE", "NEIS 응답에 전체 건수가 없습니다.")


def _get_rows(sections: list[JsonValue]) -> list[JsonValue]:
    for section in sections:
        if isinstance(section, Mapping):
            rows = section.get("row")
            if isinstance(rows, list):
                return rows
    return []


def _join_address(main: str | None, detail: str | None) -> str | None:
    address = " ".join(part.strip() for part in (main, detail) if part and part.strip())
    return address or None


def _validate_json(value: object) -> JsonValue:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, list):
        return [_validate_json(item) for item in value]
    if isinstance(value, dict):
        result: dict[str, JsonValue] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("JSON object key must be a string")
            result[key] = _validate_json(item)
        return result
    raise ValueError("Unsupported JSON value")
