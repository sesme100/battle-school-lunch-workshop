export interface School {
  office_code: string;
  office_name: string;
  school_code: string;
  name: string;
  school_type: string;
  location: string;
  address: string | null;
}

export interface SchoolSearchResponse {
  items: School[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

export interface Meal {
  date: string;
  menu_items: string[];
  calories: string | null;
}

export interface MealSearchResponse {
  items: Meal[];
}

export interface ErrorResponse {
  code: string;
  detail: string;
}
