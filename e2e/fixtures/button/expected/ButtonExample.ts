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
		const variant = this.getAttribute("variant");
	}
}

customElements.define("button-el", ButtonEl);
