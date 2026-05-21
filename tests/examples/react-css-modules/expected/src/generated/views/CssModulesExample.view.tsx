import styles from "./CssModulesExample.module.css";

export function CssModulesExample() {
	return (
		<section className={["panel", styles.style2].filter(Boolean).join(" ")}>
			<h2>
				Launch checklist
			</h2>
			<button className={[styles.style1].filter(Boolean).join(" ")} data-role="primary">
				Review
			</button>
		</section>
	);
}
