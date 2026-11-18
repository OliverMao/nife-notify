# nife-notify

`nife-notify` shows a Windows toast notification when a nife task finishes and the agent is waiting for input.

It uses the Windows WinRT toast API through Windows PowerShell, so it works in any terminal (Windows Terminal, conhost, VS Code terminal) and inside WSL, as long as `powershell.exe` is reachable.

## Behavior

- Fires once per completed task on `agent_settled`, after automatic retries, auto-compaction retries, and queued follow-ups are done.
- Shows `Nife` / `任务完成`, or `Nife` / `任务出错` when the run ended with an error.
- Skips aborted runs (Esc), so an interrupted task does not report success.
- Does nothing on macOS and plain Linux.
- Never blocks or breaks the agent loop: the PowerShell process is detached, and spawn failures are swallowed.

## Install

```bash
nife install npm:nife-notify                          # npm
nife install https://github.com/OliverMao/nife-notify # git
```

Project-scoped install (writes `.nife/settings.json`, shareable with a team):

```bash
nife install -l npm:nife-notify
```

Try it without installing:

```bash
nife -e npm:nife-notify
```

From a checkout of this directory:

```bash
nife -e .
```

## Verify

In nife, run:

```text
/notify-test
```

A toast should appear. If it does not, check that the Windows notification setting for PowerShell is enabled and that Focus Assist / Do Not Disturb is not suppressing notifications.

## WSL

WSL runs `powershell.exe` through interop. Notifications appear on the Windows desktop. No extra configuration is needed when interop is enabled.

## How it works

The extension builds this PowerShell script and passes it to `powershell.exe` as a base64-encoded `-EncodedCommand`, which avoids command-line quoting issues:

```powershell
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast>...</toast>')
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show($xml)
```

## Development

This package lives at `extensions/nife-notify` and is not part of the nife npm workspace, so it keeps its own version and publish flow.

```bash
npm test        # node:test unit tests
npm run typecheck
```

## License

MIT

## Development

This package lives on its own now, no nife checkout required:

```bash
npm install                  # devDeps only; .npmrc points at the nife registry
npm run typecheck            # tsc against the ExtensionAPI types
node --test test/*.test.ts   # node >= 22.19, TypeScript runs through strip-types
```

Runtime deps stay empty: nife provides `nife-coding-agent` and runs
`npm install --omit=dev --legacy-peer-deps` on install, so none of the above is fetched for users.
