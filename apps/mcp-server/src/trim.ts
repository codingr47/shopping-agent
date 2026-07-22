import { ProductSummary, ProductDetail } from "@shopping-agent/shared";

export interface DummyJsonProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  category: string;
  rating: number;
}

export function toSummary(p: DummyJsonProduct): ProductSummary {
  const desc = p.description;
  const maxLen = 140;
  return {
    id: p.id,
    title: p.title,
    shortDescription:
      desc.length > maxLen ? desc.slice(0, maxLen - 1) + "…" : desc,
    price: p.price,
    thumbnail: p.thumbnail,
    category: p.category,
    rating: p.rating,
  };
}

export function toDetail(p: any): ProductDetail {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    discountPercentage: p.discountPercentage || 0,
    rating: p.rating || 0,
    stock: p.stock || 0,
    tags: p.tags || [],
    brand: p.brand || "",
    sku: p.sku || "",
    weight: p.weight || 0,
    dimensions: p.dimensions || { width: 0, height: 0, depth: 0 },
    warrantyInformation: p.warrantyInformation || "",
    shippingInformation: p.shippingInformation || "",
    availabilityStatus: p.availabilityStatus || "",
    images: p.images || [],
    thumbnail: p.thumbnail || "",
    category: p.category || "",
  };
}
