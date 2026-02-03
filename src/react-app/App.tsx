// src/App.tsx

import { useMemo, useState } from "react";
import "./App.css";

function App() {
	const [logs, setLogs] = useState<string[]>([]);
	const [running, setRunning] = useState<"worker" | "do" | null>(null);
	const params = useMemo(
		() => ({
			items: 8000,
			itemSize: 256,
			loops: 6,
		}),
		[]
	);

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
			const data = await res.json();
			const elapsed = Number((performance.now() - start).toFixed(2));
			appendLog(
				`${new Date().toLocaleTimeString()} | ${label} | cpu=${data.elapsedMs}ms | client=${elapsed}ms | checksum=${data.checksum}`
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
				<p className="hint">
					参数: items={params.items}, itemSize={params.itemSize}, loops=
					{params.loops}
				</p>
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
