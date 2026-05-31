<script setup lang="ts">
defineProps<{
	variant?: any;
	children?: any;
}>();
</script>

<template>
	<button data-role="primary" :style="{ 'padding': '8px 12px' }">
		<slot name="children">{{ children }}</slot>
	</button>
</template>
