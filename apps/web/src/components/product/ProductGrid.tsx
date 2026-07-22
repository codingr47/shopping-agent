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

  return (
    <div className="product-grid">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
