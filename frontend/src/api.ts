import type {
  ErrorResponse,
  Meal,
  MealSearchResponse,
  School,
  SchoolSearchResponse,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function searchSchools(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<SchoolSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: "10",
  });
  const payload = await requestJson(`/schools?${params}`, signal);
  if (!isSchoolSearchResponse(payload)) {
    throw new ApiError("INVALID_RESPONSE", "학교 검색 응답 형식이 올바르지 않습니다.");
  }
  return payload;
}

export async function getMeals(
  school: School,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<MealSearchResponse> {
  const params = new URLSearchParams({
    office_code: school.office_code,
    school_code: school.school_code,
    start_date: startDate,
    end_date: endDate,
  });
  const payload = await requestJson(`/meals?${params}`, signal);
  if (!isMealSearchResponse(payload)) {
    throw new ApiError("INVALID_RESPONSE", "급식 조회 응답 형식이 올바르지 않습니다.");
  }
  return payload;
}

async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorResponse(payload)) {
      throw new ApiError(payload.code, payload.detail);
    }
    throw new ApiError(
      "REQUEST_FAILED",
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSchool(value: unknown): value is School {
  return (
    isRecord(value) &&
    typeof value.office_code === "string" &&
    typeof value.office_name === "string" &&
    typeof value.school_code === "string" &&
    typeof value.name === "string" &&
    typeof value.school_type === "string" &&
    typeof value.location === "string" &&
    (typeof value.address === "string" || value.address === null)
  );
}

function isSchoolSearchResponse(value: unknown): value is SchoolSearchResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isSchool) &&
    typeof value.page === "number" &&
    typeof value.page_size === "number" &&
    typeof value.total === "number" &&
    typeof value.has_next === "boolean"
  );
}

function isMeal(value: unknown): value is Meal {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    Array.isArray(value.menu_items) &&
    value.menu_items.every((item) => typeof item === "string") &&
    (typeof value.calories === "string" || value.calories === null)
  );
}

function isMealSearchResponse(value: unknown): value is MealSearchResponse {
  return (
    isRecord(value) && Array.isArray(value.items) && value.items.every(isMeal)
  );
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.detail === "string"
  );
}
