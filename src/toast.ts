import { spawn } from "node:child_process";
import { isWindowsHost } from "./platform.ts";

/**
 * Windows PowerShell registers itself as a toast-capable app, so reusing its
 * AppId lets the notification come from an app the OS already knows about.
 */
export const POWER_SHELL_APP_ID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

const POWER_SHELL_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"] as const;

export function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Builds the WinRT toast XML payload for the given title and body. */
export function buildToastXml(title: string, body: string): string {
	return `<toast><visual><binding template="ToastGeneric"><text>${escapeXml(title)}</text><text>${escapeXml(body)}</text></binding></visual></toast>`;
}

/** Builds the PowerShell script that loads WinRT and shows the toast. */
export function buildToastScript(title: string, body: string): string {
	return [
		"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
		"[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
		"$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
		`$xml.LoadXml('${buildToastXml(title, body)}')`,
		`[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${POWER_SHELL_APP_ID}').Show($xml)`,
	].join("\n");
}

/** Base64 UTF-16LE, so no quoting or escaping happens on the command line. */
export function encodePowerShellCommand(script: string): string {
	return Buffer.from(script, "utf16le").toString("base64");
}

export type ToastResult = {
	ok: boolean;
	code: number | null;
	stdout: string;
	stderr: string;
	error?: string;
};

/**
 * Runs the toast script and waits for PowerShell, so callers can surface real
 * errors. Used by the test command; the agent-finished path uses showToast().
 */
export function runToast(title: string, body: string, timeoutMs = 15_000): Promise<ToastResult> {
	if (!isWindowsHost()) {
		return Promise.resolve({
			ok: false,
			code: null,
			stdout: "",
			stderr: "",
			error: `unsupported platform: ${process.platform} (Windows or WSL required)`,
		});
	}

	const encoded = encodePowerShellCommand(buildToastScript(title, body));
	return new Promise((resolve) => {
		const child = spawn("powershell.exe", [...POWER_SHELL_ARGS, encoded], {
			windowsHide: true,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;

		const finish = (result: ToastResult) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};

		const timer = setTimeout(() => {
			child.kill();
			finish({ ok: false, code: null, stdout, stderr, error: `timed out after ${timeoutMs}ms` });
		}, timeoutMs);

		child.stdout?.on("data", (chunk) => {
			stdout += String(chunk);
		});
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			finish({ ok: false, code: null, stdout, stderr, error: error.message });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			finish({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
		});
	});
}

/**
 * Shows a Windows toast. Fire-and-forget: every failure is swallowed so
 * notifications never break the agent loop.
 *
 * Do not use `detached: true` here. On native Windows, a detached PowerShell
 * process with ignored stdio never actually runs (verified: it exits without
 * executing the script), so the toast silently disappears. A regular child
 * process plus `unref()` still lets nife exit without waiting for it.
 */
export function showToast(title: string, body: string): void {
	if (!isWindowsHost()) return;

	const encoded = encodePowerShellCommand(buildToastScript(title, body));
	const child = spawn("powershell.exe", [...POWER_SHELL_ARGS, encoded], {
		stdio: "ignore",
		windowsHide: true,
	});
	child.on("error", () => {});
	child.unref();
}
