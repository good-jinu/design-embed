import type { ReactNode } from "react";

interface ButtonProps {
	children?: ReactNode;
	variant?: string;
}

export function Button({ children }: ButtonProps) {
	return <button type="button">{children}</button>;
}
