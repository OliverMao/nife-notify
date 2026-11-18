import { readFileSync } from "node:fs";

/**
 * True inside a WSL distro, where `process.platform` is `linux` but Windows
 * executables are still reachable through WSL interop.
 */
export function isWsl(): boolean {
	if (process.platform !== "linux") return false;
	if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
	try {
		return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
	} catch {
		return false;
	}
}

/** True on native Windows and inside WSL, where the toast API is reachable. */
export function isWindowsHost(): boolean {
	return process.platform === "win32" || isWsl();
}
