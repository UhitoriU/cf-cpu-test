// src/App.tsx

import { useState } from "react";
import "./App.css";

function App() {
	const [logs, setLogs] = useState<string[]>([]);
	const [running, setRunning] = useState<"worker" | "do" | null>(null);
	const [params, setParams] = useState({
		items: 8000,
		itemSize: 256,
		loops: 6,
	});

	const appendLog = (entry: string) =>
		setLogs((prev) => [entry, ...prev].slice(0, 20));

	const runTest = async (mode: "worker" | "do") => {
		if (running) return;
		setRunning(mode);
		const label = mode === "worker" ? "Worker" : "Durable Object";
		const start = performance.now();
		try {
			const qs = new URLSearchParams({
				items: String(params.items),
				itemSize: String(params.itemSize),
				loops: String(params.loops),
			});
			const endpoint = mode === "worker" ? "/api/worker-cpu" : "/api/do-cpu";
			const res = await fetch(`${endpoint}?${qs.toString()}`);
			const contentType = res.headers.get("content-type") ?? "";
			if (!res.ok || !contentType.includes("application/json")) {
				const text = await res.text();
				throw new Error(
					`http=${res.status} content-type=${contentType} body=${text.slice(0, 160)}`
				);
			}
			const data = await res.json();
			const elapsed = Number((performance.now() - start).toFixed(2));
			const cpuMs =
				typeof data.elapsedMs === "number"
					? data.elapsedMs.toFixed(6)
					: String(data.elapsedMs);
			const wallMs =
				typeof data.wallMs === "number"
					? data.wallMs.toFixed(6)
					: String(data.wallMs);
			const cpuUs =
				typeof data.elapsedUs === "number"
					? `${data.elapsedUs}us`
					: String(data.elapsedUs);
			const wallUs =
				typeof data.wallUs === "number" ? `${data.wallUs}us` : String(data.wallUs);
			const p = data.params ?? params;
			appendLog(
				`${new Date().toLocaleTimeString()} | ${label} | cpu=${cpuMs}ms (${cpuUs}) | wall=${wallMs}ms (${wallUs}) | client=${elapsed}ms | items=${p.items} itemSize=${p.itemSize} loops=${p.loops} | checksum=${data.checksum}`
			);
		} catch (err) {
			appendLog(
				`${new Date().toLocaleTimeString()} | ${label} | error=${
					err instanceof Error ? err.message : String(err)
				}`
			);
		} finally {
			setRunning(null);
		}
	};

	return (
		<div className="layout">
			<header>
				<h1>Cloudflare CPU 计时对比</h1>
				<p className="subtitle">
					同样的序列化任务，分别在 Worker 与 Durable Object 里执行。
				</p>
			</header>
			<section className="card">
				<div className="controls">
					<button onClick={() => runTest("worker")} disabled={running !== null}>
						运行 Worker 任务
					</button>
					<button onClick={() => runTest("do")} disabled={running !== null}>
						运行 DO 任务
					</button>
				</div>
				<div className="params">
					<label>
						items
						<input
							type="number"
							min={1}
							max={200000}
							value={params.items}
							onChange={(event) =>
								setParams((prev) => ({
									...prev,
									items: Number(event.target.value),
								}))
							}
						/>
					</label>
					<label>
						itemSize
						<input
							type="number"
							min={1}
							max={2048}
							value={params.itemSize}
							onChange={(event) =>
								setParams((prev) => ({
									...prev,
									itemSize: Number(event.target.value),
								}))
							}
						/>
					</label>
					<label>
						loops
						<input
							type="number"
							min={1}
							max={100}
							value={params.loops}
							onChange={(event) =>
								setParams((prev) => ({
									...prev,
									loops: Number(event.target.value),
								}))
							}
						/>
					</label>
				</div>
			</section>
			<section className="card">
				<h2>日志</h2>
				{logs.length === 0 ? (
					<p className="empty">暂无记录，点击按钮开始测试。</p>
				) : (
					<ul className="log">
						{logs.map((entry) => (
							<li key={entry}>{entry}</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

export default App;
