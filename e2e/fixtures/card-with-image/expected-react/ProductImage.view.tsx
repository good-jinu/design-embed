interface ProductImageProps {
	src?: string;
	alt?: string;
}

export function ProductImage({ src, alt }: ProductImageProps) {
	return (
		<img alt={alt} src={src} />
	);
}
