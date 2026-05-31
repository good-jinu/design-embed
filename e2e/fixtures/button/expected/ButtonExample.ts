class ButtonEl extends HTMLElement {
	static get observedAttributes(): string[] {
		return ["variant"];
	}

	connectedCallback(): void {
		this.render();
	}

	attributeChangedCallback(): void {
		this.render();
	}

	private render(): void {
		if (!this.parentNode) return;
		const variant = this.getAttribute("variant");
		const el = document.createElement("button");
		el.setAttribute("data-role", "primary");
		el.setAttribute("style", "padding: 8px 12px;");
		el.innerHTML = this.innerHTML;
		this.replaceWith(el);
	}
}

customElements.define("button-el", ButtonEl);
