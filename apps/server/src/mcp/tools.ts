import {
  SearchProductsInput,
  ListProductsInput,
  GetProductByIdInput,
  ListCategoriesInput,
  GetProductsByCategoryInput,
  ProductSummary,
  ProductDetail,
} from "@shopping-agent/shared";
import { getMcpClient } from "./client.js";

export async function searchProducts(
  input: SearchProductsInput,
): Promise<{ products: ProductSummary[]; total: number }> {
  const client = getMcpClient();
  const result = await client.callTool({
    name: "search_products",
    arguments: input,
  });
  const content = (result.content as any[])?.[0];
  if (content && content.type === "text") {
    return JSON.parse(content.text);
  }
  return { products: [], total: 0 };
}

export async function listProducts(
  input: ListProductsInput,
): Promise<{ products: ProductSummary[]; total: number }> {
  const client = getMcpClient();
  const result = await client.callTool({
    name: "list_products",
    arguments: input,
  });
  const content = (result.content as any[])?.[0];
  if (content && content.type === "text") {
    return JSON.parse(content.text);
  }
  return { products: [], total: 0 };
}

export async function getProductById(
  input: GetProductByIdInput,
): Promise<ProductDetail> {
  const client = getMcpClient();
  const result = await client.callTool({
    name: "get_product_by_id",
    arguments: input,
  });
  const content = (result.content as any[])?.[0];
  if (content && content.type === "text") {
    return JSON.parse(content.text);
  }
  throw new Error("Failed to fetch product details");
}

export async function listCategories(
  input: ListCategoriesInput,
): Promise<{ categories: string[] }> {
  const client = getMcpClient();
  const result = await client.callTool({
    name: "list_categories",
    arguments: input,
  });
  const content = (result.content as any[])?.[0];
  if (content && content.type === "text") {
    return JSON.parse(content.text);
  }
  return { categories: [] };
}

export async function getProductsByCategory(
  input: GetProductsByCategoryInput,
): Promise<{ products: ProductSummary[]; total: number }> {
  const client = getMcpClient();
  const result = await client.callTool({
    name: "get_products_by_category",
    arguments: input,
  });
  const content = (result.content as any[])?.[0];
  if (content && content.type === "text") {
    return JSON.parse(content.text);
  }
  return { products: [], total: 0 };
}
