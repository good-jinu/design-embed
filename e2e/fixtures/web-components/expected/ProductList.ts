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
		if (!this.parentNode) return;
		const el = document.createElement("div");
		el.setAttribute("class", "filter-section");
		el.innerHTML = this.innerHTML;
		this.replaceWith(el);
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
		if (!this.parentNode) return;
		const el = document.createElement("div");
		el.setAttribute("class", "product-grid");
		el.innerHTML = this.innerHTML;
		this.replaceWith(el);
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
		if (!this.parentNode) return;
		const el = document.createElement("div");
		el.setAttribute("class", "product-card");
		el.innerHTML = this.innerHTML;
		this.replaceWith(el);
	}
}

customElements.define("product-filter", ProductFilter);
customElements.define("product-list", ProductList);
customElements.define("product-card", ProductCard);
