<script setup lang="ts">
import Button from "./Button.vue";
</script>

<template>
	<article class="card" :style="{ 'background': '#ffffff', 'padding': '16px' }">
		<h1 data-role="title">
			Phase One
		</h1>
		<p>
			Local HTML compile path.
		</p>
		<Button variant="primary">
			<template #children>Continue</template>
		</Button>
	</article>
</template>
