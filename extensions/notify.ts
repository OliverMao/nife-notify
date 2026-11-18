import type { ExtensionAPI } from "nife-coding-agent";
import { isWindowsHost, isWsl } from "../src/platform.ts";
import { runToast, showToast } from "../src/toast.ts";

/**
 * Windows toast notification when Nife finishes a task and waits for input.
 *
 * Uses `agent_settled` rather than `agent_end`, because `agent_end` also fires
 * before automatic retries, auto-compaction retries, and queued follow-ups.
 */
export default function (pi: ExtensionAPI) {
	// Stay inert on hosts without the Windows toast API (plain Linux/macOS).
	if (!isWindowsHost()) return;

	let lastStopReason: string | undefined;

	pi.on("message_end", (event) => {
		if (event.message.role === "assistant") {
			lastStopReason = event.message.stopReason;
		}
	});

	pi.on("agent_settled", () => {
		const stopReason = lastStopReason;
		lastStopReason = undefined;
		// Esc / user abort is not a completed task.
		if (stopReason === "aborted") return;
		showToast("Nife", stopReason === "error" ? "任务出错" : "任务完成");
	});

	pi.registerCommand("notify-test", {
		description: "Show a test Windows toast notification and report any PowerShell error",
		handler: async (_args, ctx) => {
			const host = isWsl() ? "WSL" : "Windows";
			const result = await runToast("Nife", "通知测试成功");
			if (result.ok) {
				ctx.ui.notify(
					`Test toast sent (${host}). If nothing appeared, check Windows notification settings.`,
					"info",
				);
				return;
			}

			const detail = result.error ?? result.stderr ?? `PowerShell exit code ${result.code}`;
			ctx.ui.notify(`Toast failed (${host}): ${detail}`, "error");
		},
	});
}
