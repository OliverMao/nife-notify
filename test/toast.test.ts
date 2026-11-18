import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildToastScript,
	buildToastXml,
	encodePowerShellCommand,
	escapeXml,
	POWER_SHELL_APP_ID,
} from "../src/toast.ts";

test("escapeXml escapes XML metacharacters", () => {
	assert.equal(
		escapeXml(`<a href="x">Tom & Jerry's</a>`),
		"&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
	);
});

test("buildToastXml wraps title and body in a ToastGeneric template", () => {
	const xml = buildToastXml("Nife", "任务完成");
	assert.equal(
		xml,
		'<toast><visual><binding template="ToastGeneric"><text>Nife</text><text>任务完成</text></binding></visual></toast>',
	);
});

test("buildToastScript uses the PowerShell AppId and escaped payload", () => {
	const script = buildToastScript("Nife", "a<b & 'c'");
	assert.match(script, /ToastNotificationManager, Windows\.UI\.Notifications/);
	assert.match(script, /XmlDocument/);
	assert.ok(script.includes(POWER_SHELL_APP_ID));
	assert.ok(script.includes("<text>a&lt;b &amp; &apos;c&apos;</text>"));
});

test("encodePowerShellCommand decodes back to the original script", () => {
	const script = buildToastScript("Nife", "任务完成");
	const decoded = Buffer.from(encodePowerShellCommand(script), "base64").toString("utf16le");
	assert.equal(decoded, script);
});
