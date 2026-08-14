from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class School(BaseModel):
    model_config = ConfigDict(frozen=True)

    office_code: str
    office_name: str
    school_code: str
    name: str
    school_type: str
    location: str
    address: str | None = None


class SchoolSearchResponse(BaseModel):
    items: list[School]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=1000)
    total: int = Field(ge=0)
    has_next: bool


class Meal(BaseModel):
    model_config = ConfigDict(frozen=True)

    date: date
    menu_items: list[str]
    calories: str | None = None


class MealSearchResponse(BaseModel):
    items: list[Meal]


class ErrorResponse(BaseModel):
    code: str
    detail: str


class HealthResponse(BaseModel):
    status: str


class NeisSchool(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ATPT_OFCDC_SC_CODE: str
    ATPT_OFCDC_SC_NM: str
    SD_SCHUL_CODE: str
    SCHUL_NM: str
    SCHUL_KND_SC_NM: str
    LCTN_SC_NM: str
    ORG_RDNMA: str | None = None
    ORG_RDNDA: str | None = None


class NeisMeal(BaseModel):
    model_config = ConfigDict(extra="ignore")

    MLSV_YMD: str = Field(pattern=r"^\d{8}$")
    DDISH_NM: str
    CAL_INFO: str | None = None
