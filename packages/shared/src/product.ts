export interface ProductSummary {
  id: number;
  title: string;
  shortDescription: string;
  price: number;
  thumbnail: string;
  category: string;
  rating: number;
}

export interface ProductDetail {
  id: number;
  title: string;
  description: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand: string;
  sku: string;
  weight: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  warrantyInformation: string;
  shippingInformation: string;
  availabilityStatus: string;
  images: string[];
  thumbnail: string;
  category: string;
}
