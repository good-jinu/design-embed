import { ProductCard } from "./ProductCard.view";

export function ProductGrid() {
	return (
		<>
			<ProductCard>
				<span className="badge">
					BEST
				</span>
				<img alt="Comfortable Running Shoes" src="shoes.jpg" style={{ width: "100%" }}></img>
				<h3>
					Comfortable Running Shoes
				</h3>
				<p className="price">
					$89.00
				</p>
			</ProductCard>
			<ProductCard>
				<img alt="Daily Backpack" src="bag.jpg" style={{ width: "100%" }}></img>
				<h3>
					Daily Backpack
				</h3>
				<p className="price">
					$55.00
				</p>
			</ProductCard>
		</>
	);
}
