import type { ReactNode } from "react";

interface ButtonProps {
	variant?: string;
	children?: ReactNode;
}

export function Button({ children }: ButtonProps) {
	return (
		<button data-role="primary" style={{ padding: "8px 12px" }}>
			{children}
		</button>
	);
}
