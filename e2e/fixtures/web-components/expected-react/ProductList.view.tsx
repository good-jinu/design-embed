import { ProductCard } from "@/components/ProductCard";
import { ProductFilter } from "@/components/ProductFilter";
import { ProductGrid } from "@/components/ProductGrid";

export function ProductList() {
	return (
		<>
			<header>
				<h1>
					New Arrivals (Plain HTML)
				</h1>
			</header>
			<ProductFilter>
				<button>
					Popularity
				</button>
				<button>
					Price: Low to High
				</button>
			</ProductFilter>
			<ProductGrid>
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
			</ProductGrid>
		</>
	);
}
