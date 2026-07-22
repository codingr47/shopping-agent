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
          {product.price !== undefined && (
            <div className="product-price">${typeof product.price === "number" ? product.price.toFixed(2) : "N/A"}</div>
          )}
          {product.rating !== undefined && (
            <div className="product-rating">★ {typeof product.rating === "number" ? product.rating.toFixed(1) : "N/A"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
