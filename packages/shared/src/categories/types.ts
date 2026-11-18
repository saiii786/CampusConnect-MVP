/**
 * Category tree (FR-100). Sensitive categories (FR-104: child care, elder care, pet care) are
 * never returned until ID verification exists.
 */
export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryGroupDto {
  name: string;
  categories: CategoryDto[];
}

/** GET /categories */
export interface CategoriesResponse {
  groups: CategoryGroupDto[];
}
