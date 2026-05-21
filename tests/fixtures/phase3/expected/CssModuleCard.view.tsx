import styles from "./CssModuleCard.module.css";

export function CssModuleCard() {
	return (
		<section className="panel">
			<div className={["card", styles.style1].filter(Boolean).join(" ")}>
				Module styles
			</div>
		</section>
	);
}
