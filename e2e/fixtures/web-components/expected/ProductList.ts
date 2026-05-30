class ProductFilter extends HTMLElement {
	static get observedAttributes(): string[] {
		return [];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
	}
}

class ProductList extends HTMLElement {
	static get observedAttributes(): string[] {
		return [];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
	}
}

class ProductCard extends HTMLElement {
	static get observedAttributes(): string[] {
		return [];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
	}
}

customElements.define("product-filter", ProductFilter);
customElements.define("product-list", ProductList);
customElements.define("product-card", ProductCard);
