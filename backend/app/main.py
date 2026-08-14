import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.models import (
    ErrorResponse,
    HealthResponse,
    MealSearchResponse,
    SchoolSearchResponse,
)
from app.neis import NeisClient, NeisError, NeisTimeoutError


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    client = NeisClient(
        api_key=os.getenv("NEIS_API_KEY", "sample"),
        base_url=os.getenv("NEIS_BASE_URL", "https://open.neis.go.kr"),
    )
    app.state.neis_client = client
    yield
    await client.close()


app = FastAPI(
    title="급식 배틀 API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_neis_client(request: Request) -> NeisClient:
    client: NeisClient = request.app.state.neis_client
    return client


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, _exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            code="INVALID_REQUEST", detail="요청 값을 확인해 주세요."
        ).model_dump(),
    )


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(
    _request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "요청을 처리할 수 없습니다."
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(code="INVALID_REQUEST", detail=detail).model_dump(),
    )


@app.exception_handler(NeisTimeoutError)
async def timeout_error_handler(
    _request: Request, exc: NeisTimeoutError
) -> JSONResponse:
    return JSONResponse(
        status_code=504,
        content=ErrorResponse(code=exc.code, detail=exc.detail).model_dump(),
    )


@app.exception_handler(NeisError)
async def neis_error_handler(_request: Request, exc: NeisError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content=ErrorResponse(code=exc.code, detail=exc.detail).model_dump(),
    )


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/schools", response_model=SchoolSearchResponse)
async def search_schools(
    q: str = Query(min_length=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=1000),
    client: NeisClient = Depends(get_neis_client),
) -> SchoolSearchResponse:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="학교 이름을 입력해 주세요.")
    items, total = await client.search_schools(query, page, page_size)
    return SchoolSearchResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        has_next=page * page_size < total,
    )

@app.get("/api/meals", response_model=MealSearchResponse)
async def get_meals(
    office_code: str = Query(min_length=1),
    school_code: str = Query(min_length=1),
    start_date: date = Query(),
    end_date: date = Query(),
    client: NeisClient = Depends(get_neis_client),
) -> MealSearchResponse:
    if end_date < start_date:
        raise HTTPException(
            status_code=422, detail="종료일은 시작일보다 빠를 수 없습니다."
        )
    items = await client.get_meals(
        office_code,
        school_code,
        start_date.strftime("%Y%m%d"),
        end_date.strftime("%Y%m%d"),
    )
    return MealSearchResponse(items=items)
