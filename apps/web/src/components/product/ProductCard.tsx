import { ProductSummary } from "@shopping-agent/shared";
import "./ProductCard.css";

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="product-card">
      <div className="product-image">
        <img src={product.thumbnail} alt={product.title} />
      </div>
      <div className="product-content">
        <h3 className="product-title">{product.title}</h3>
        <p className="product-description">{product.shortDescription}</p>
        <div className="product-footer">
          <div className="product-price">${product.price.toFixed(2)}</div>
          <div className="product-rating">★ {product.rating.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
