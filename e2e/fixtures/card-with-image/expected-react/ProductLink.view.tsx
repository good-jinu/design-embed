import type { ReactNode } from "react";

interface ProductLinkProps {
	href?: string;
	children?: ReactNode;
}

export function ProductLink({ href, children }: ProductLinkProps) {
	return (
		<a className="product-link" href={href}>
			{children}
		</a>
	);
}
