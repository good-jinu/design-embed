class ProductImage extends HTMLElement {
	static get observedAttributes(): string[] {
		return ["alt", "src"];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
		const alt = this.getAttribute("alt");
		const src = this.getAttribute("src");
	}
}

class ProductLink extends HTMLElement {
	static get observedAttributes(): string[] {
		return ["href"];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
		const href = this.getAttribute("href");
	}
}

customElements.define("product-image", ProductImage);
customElements.define("product-link", ProductLink);
