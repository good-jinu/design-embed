import { Button } from "@/components/ui/Button";

export function SimpleCard() {
	return (
		<article className="card" style={{ background: "#ffffff", padding: "16px" }}>
			<h1 data-role="title">
				Phase One
			</h1>
			<p>
				Local HTML compile path.
			</p>
			<Button variant="primary">Continue</Button>
		</article>
	);
}
