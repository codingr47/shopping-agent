import { ProductSummary } from "@shopping-agent/shared";
import { ProductCard } from "./ProductCard.js";
import "./ProductGrid.css";

interface ProductGridProps {
  products: ProductSummary[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products || products.length === 0) {
    return <div className="product-grid-empty">No products found</div>;
  }

  console.error("[ProductGrid] products:", products);
  if (products.length > 0) {
    console.error("[ProductGrid] first product:", products[0]);
  }

  return (
    <div className="product-grid">
      {products.map((product, idx) => (
        <ProductCard key={product.id ?? idx} product={product} />
      ))}
    </div>
  );
}
