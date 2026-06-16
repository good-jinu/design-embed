import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fetchWithRetry, mapWithConcurrency } from "./httpClient.ts";

function jsonResponse(status: number, headers: Record<string, string> = {}) {
	return new Response(status === 204 ? null : "{}", { status, headers });
}

describe("fetchWithRetry", () => {
	test("retries on 429 and returns the eventual success", async () => {
		const statuses = [429, 429, 200];
		let calls = 0;
		const slept: number[] = [];

		const response = await fetchWithRetry(
			"https://api.figma.com/x",
			undefined,
			{
				fetcher: async () => jsonResponse(statuses[calls++] ?? 200),
				baseDelayMs: 10,
				sleep: async (ms) => {
					slept.push(ms);
				},
			},
		);

		assert.equal(response.status, 200);
		assert.equal(calls, 3);
		// Exponential backoff: 10ms then 20ms.
		assert.deepEqual(slept, [10, 20]);
	});

	test("honors a numeric Retry-After header over computed backoff", async () => {
		let calls = 0;
		const slept: number[] = [];

		await fetchWithRetry("https://api.figma.com/x", undefined, {
			fetcher: async () =>
				calls++ === 0
					? jsonResponse(429, { "retry-after": "2" })
					: jsonResponse(200),
			baseDelayMs: 10,
			sleep: async (ms) => {
				slept.push(ms);
			},
		});

		assert.deepEqual(slept, [2000]);
	});

	test("gives up after maxRetries and returns the last failing response", async () => {
		let calls = 0;
		const response = await fetchWithRetry(
			"https://api.figma.com/x",
			undefined,
			{
				fetcher: async () => {
					calls++;
					return jsonResponse(429);
				},
				maxRetries: 2,
				sleep: async () => {},
			},
		);

		assert.equal(response.status, 429);
		assert.equal(calls, 3); // initial + 2 retries
	});

	test("does not retry non-retryable status codes", async () => {
		let calls = 0;
		const response = await fetchWithRetry(
			"https://api.figma.com/x",
			undefined,
			{
				fetcher: async () => {
					calls++;
					return jsonResponse(404);
				},
				sleep: async () => {},
			},
		);

		assert.equal(response.status, 404);
		assert.equal(calls, 1);
	});
});

describe("mapWithConcurrency", () => {
	test("never exceeds the concurrency limit and preserves order", async () => {
		let inFlight = 0;
		let peak = 0;
		const items = Array.from({ length: 20 }, (_, index) => index);

		const results = await mapWithConcurrency(items, 4, async (item) => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 1));
			inFlight -= 1;
			return item * 2;
		});

		assert.ok(peak <= 4, `peak concurrency ${peak} exceeded limit`);
		assert.deepEqual(
			results,
			items.map((item) => item * 2),
		);
	});
});
