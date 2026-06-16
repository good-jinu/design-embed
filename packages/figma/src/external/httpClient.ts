import type { FigmaFetcher } from "./figmaApi.ts";

export interface RetryOptions {
	/** Custom fetch implementation, mainly for testing without the network. */
	fetcher?: FigmaFetcher;
	/** Max retry attempts after the initial request (default 3). */
	maxRetries?: number;
	/** Base backoff in ms; doubles each attempt (default 500). */
	baseDelayMs?: number;
	/** Upper bound for any single backoff wait in ms (default 30000). */
	maxDelayMs?: number;
	/** Injectable sleep, mainly so tests don't wait in real time. */
	sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const defaultSleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches with retry + exponential backoff for rate limits (429) and transient
 * server errors. Honors the `Retry-After` header (seconds or HTTP date) so we
 * back off for exactly as long as Figma asks instead of guessing.
 */
export async function fetchWithRetry(
	input: string,
	init: RequestInit | undefined,
	options: RetryOptions = {},
): Promise<Response> {
	const fetcher = options.fetcher ?? fetch;
	const maxRetries = options.maxRetries ?? 3;
	const baseDelayMs = options.baseDelayMs ?? 500;
	const maxDelayMs = options.maxDelayMs ?? 30000;
	const sleep = options.sleep ?? defaultSleep;

	let lastResponse: Response | undefined;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		const response = await fetcher(input, init);
		if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
			return response;
		}
		lastResponse = response;
		if (attempt === maxRetries) break;

		const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
		const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
		await sleep(retryAfter ?? backoff);
	}

	return lastResponse as Response;
}

function parseRetryAfter(value: string | null): number | undefined {
	if (!value) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
	const dateMs = Date.parse(value);
	if (Number.isNaN(dateMs)) return undefined;
	return Math.max(0, dateMs - Date.now());
}

/**
 * Runs `task` over `items` with at most `limit` in flight at once. Preserves
 * input order in the result. Used to keep asset downloads from stampeding the
 * Figma CDN, which otherwise rate-limits or drops connections under a burst.
 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	const bound = Math.max(1, Math.floor(limit));
	let cursor = 0;

	async function worker(): Promise<void> {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await task(items[index] as T, index);
		}
	}

	const workers = Array.from({ length: Math.min(bound, items.length) }, worker);
	await Promise.all(workers);
	return results;
}
