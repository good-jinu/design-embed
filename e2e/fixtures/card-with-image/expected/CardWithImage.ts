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
		if (!this.parentNode) return;
		const alt = this.getAttribute("alt");
		const src = this.getAttribute("src");
		const el = document.createElement("img");
		if (alt !== null) el.setAttribute("alt", alt);
		if (src !== null) el.setAttribute("src", src);
		this.replaceWith(el);
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
		if (!this.parentNode) return;
		const href = this.getAttribute("href");
		const el = document.createElement("a");
		el.setAttribute("class", "product-link");
		if (href !== null) el.setAttribute("href", href);
		el.innerHTML = this.innerHTML;
		this.replaceWith(el);
	}
}

customElements.define("product-image", ProductImage);
customElements.define("product-link", ProductLink);
