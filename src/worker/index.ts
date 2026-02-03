import { Hono } from "hono";

type EnvBindings = {
	CPU_DO: DurableObjectNamespace;
};

type CpuParams = {
	items: number;
	itemSize: number;
	loops: number;
};

const DEFAULT_PARAMS: CpuParams = {
	items: 8000,
	itemSize: 256,
	loops: 6,
};

const MAX_PARAMS: CpuParams = {
	items: 200000,
	itemSize: 2048,
	loops: 100,
};

const app = new Hono<{ Bindings: EnvBindings }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

app.get("/api/worker-cpu", (c) => {
	try {
		const params = readCpuParams(c.req.url);
		const result = runCpuTask(params);
		c.header("Cache-Control", "no-store");
		return c.json({
			mode: "worker",
			...result,
		});
	} catch (error) {
		c.header("Cache-Control", "no-store");
		return c.json(
			{
				mode: "worker",
				error: error instanceof Error ? error.message : String(error),
			},
			500
		);
	}
});

app.get("/api/do-cpu", async (c) => {
	const params = readCpuParams(c.req.url);
	const id = c.env.CPU_DO.idFromName("cpu-task");
	const stub = c.env.CPU_DO.get(id);
	const url = new URL("https://do/cpu");
	url.search = new URLSearchParams({
		items: String(params.items),
		itemSize: String(params.itemSize),
		loops: String(params.loops),
	}).toString();
	const response = await stub.fetch(url.toString(), { method: "GET" });
	const payload = await response.json();
	return c.json(payload);
});

export class CpuDurableObject {
	async fetch(request: Request): Promise<Response> {
		try {
			const params = readCpuParams(request.url);
			const result = runCpuTask(params);
			return Response.json({
				mode: "durable-object",
				...result,
			}, { headers: { "Cache-Control": "no-store" } });
		} catch (error) {
			return Response.json(
				{
					mode: "durable-object",
					error: error instanceof Error ? error.message : String(error),
				},
				{ status: 500, headers: { "Cache-Control": "no-store" } }
			);
		}
	}
}

function readCpuParams(url: string): CpuParams {
	const parsed = new URL(url);
	const rawItems = Number(parsed.searchParams.get("items"));
	const rawItemSize = Number(parsed.searchParams.get("itemSize"));
	const rawLoops = Number(parsed.searchParams.get("loops"));

	return {
		items: clampNumber(rawItems, DEFAULT_PARAMS.items, MAX_PARAMS.items),
		itemSize: clampNumber(rawItemSize, DEFAULT_PARAMS.itemSize, MAX_PARAMS.itemSize),
		loops: clampNumber(rawLoops, DEFAULT_PARAMS.loops, MAX_PARAMS.loops),
	};
}

function clampNumber(value: number, fallback: number, max: number): number {
	if (!Number.isFinite(value) || value <= 0) return fallback;
	return Math.min(Math.floor(value), max);
}

function runCpuTask(params: CpuParams) {
	const startedAt = performance.now();
	const wallStartedAt = Date.now();
	let checksum = 0;

	for (let loop = 0; loop < params.loops; loop += 1) {
		const payload = buildPayload(params.items, params.itemSize, loop);
		const json = JSON.stringify(payload);
		checksum ^= json.length + loop;
	}

	const endedAt = performance.now();
	const wallEndedAt = Date.now();
	const elapsedMs = endedAt - startedAt;
	const wallMs = wallEndedAt - wallStartedAt;

	return {
		params,
		elapsedMs,
		wallMs,
		elapsedUs: Math.round(elapsedMs * 1000),
		wallUs: Math.round(wallMs * 1000),
		checksum,
		startedAt,
		endedAt,
		wallStartedAt,
		wallEndedAt,
	};
}

function buildPayload(items: number, itemSize: number, seed: number) {
	const repeatChar = String.fromCharCode(97 + (seed % 26));
	const baseText = repeatChar.repeat(itemSize);
	const data = new Array(items);

	for (let i = 0; i < items; i += 1) {
		data[i] = {
			id: i,
			label: `${baseText}-${i}`,
			meta: {
				index: i,
				seed,
				hash: (i * 2654435761) >>> 0,
			},
		};
	}

	return { seed, data };
}

export default app;
