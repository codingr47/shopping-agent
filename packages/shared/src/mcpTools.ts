import { z } from "zod";

export const searchProductsInput = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(10).default(5).optional(),
  skip: z.number().int().min(0).default(0).optional(),
});
export type SearchProductsInput = z.infer<typeof searchProductsInput>;

export const listProductsInput = z.object({
  limit: z.number().int().min(1).max(20).default(10).optional(),
  skip: z.number().int().min(0).default(0).optional(),
  sortBy: z.enum(["title", "price", "rating"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
export type ListProductsInput = z.infer<typeof listProductsInput>;

export const getProductByIdInput = z.object({
  id: z.number().int().positive("Product ID must be a positive integer"),
});
export type GetProductByIdInput = z.infer<typeof getProductByIdInput>;

export const listCategoriesInput = z.object({}).strict();
export type ListCategoriesInput = z.infer<typeof listCategoriesInput>;

export const getProductsByCategoryInput = z.object({
  slug: z.string().min(1, "Category slug is required"),
  limit: z.number().int().min(1).max(20).default(10).optional(),
  skip: z.number().int().min(0).default(0).optional(),
});
export type GetProductsByCategoryInput = z.infer<typeof getProductsByCategoryInput>;
