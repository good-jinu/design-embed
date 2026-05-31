import { ProductImage } from "./ProductImage.view";
import { ProductLink } from "./ProductLink.view";

export function CardWithImage() {
	return (
		<article className="product-card">
			<ProductImage alt="Trail shoe" src="/assets/shoe.png"></ProductImage>
			<ProductLink href="/products/trail-shoe">
				<span>
					Trail Shoe
				</span>
			</ProductLink>
		</article>
	);
}
