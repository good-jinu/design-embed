import { ProductCard } from "./ProductCard.view";

export function ProductGrid() {
	return (
		<div className="product-grid">
			<ProductCard>
				<span className="badge">
					BEST
				</span>
				<img alt="Comfortable Running Shoes" height="200" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="200" style={{ height: "200px", width: "100%" }}></img>
				<h3>
					Comfortable Running Shoes
				</h3>
				<p className="price">
					$89.00
				</p>
			</ProductCard>
			<ProductCard>
				<img alt="Daily Backpack" height="200" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="200" style={{ height: "200px", width: "100%" }}></img>
				<h3>
					Daily Backpack
				</h3>
				<p className="price">
					$55.00
				</p>
			</ProductCard>
		</div>
	);
}
