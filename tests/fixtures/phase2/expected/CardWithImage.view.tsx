import { ProductImage } from "@/components/media/ProductImage";
import { ProductLink } from "@/components/ui/ProductLink";

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
