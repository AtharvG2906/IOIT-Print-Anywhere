# Print Anywhere — Windows print agent

Runs on the Windows PC connected to the printer. Every few seconds it asks the server for paid orders.
For each order it prints the **cover sheet** (name, PRN, printing code) and then the **document**,
on **A4, black & white**, with the chosen page range and copies. Then it waits for the Windows
print queue to empty and marks the order **ready**, which emails the student.

The agent only makes outgoing HTTPS requests, so you don't need port forwarding or a static IP.

## Setup (one time)

1. Install **Node.js 20 or newer** (LTS) from <https://nodejs.org>.
2. Install **SumatraPDF** from <https://www.sumatrapdfreader.org> (the default install path is fine).
3. Install the printer driver and print a Windows test page.
   Then set the printer's default paper size to **A4** in *Printing Preferences*.
4. Copy this `agent` folder to the PC, for example to `C:\PrintAnywhere\agent`.
5. Copy `agent.config.example.json` to `agent.config.json` and fill it in:
   - `serverUrl`: your site, for example `https://print.yourcollege.in`
   - `apiKey`: the `AGENT_API_KEY` value from the server's environment
   - `printerName`: the exact name shown in *Settings → Printers*, or by running
     `Get-Printer | Select Name` in PowerShell
   - `sumatraPath`: change it only if SumatraPDF is installed somewhere else
6. Do a test run first with `"dryRun": true`:
   ```
   cd C:\PrintAnywhere\agent
   node agent.mjs
   ```
   Place a test order. The agent logs the exact SumatraPDF commands without printing anything.
7. Set `"dryRun": false` and test with the **Microsoft Print to PDF** printer, then with the real printer.

## Run automatically on boot

From an **Administrator** PowerShell in the agent folder (needs [NSSM](https://nssm.cc), e.g. `winget install nssm`):

```
powershell -ExecutionPolicy Bypass -File .\install-service.ps1
```

Logs are written to `logs\agent.log`. If the log says `printer not found`, the service account can't
see the printer. Run the service as the Windows user that installed the printer:
`nssm set PrintAnywhereAgent ObjectName .\YourUser YourPassword`, then `nssm restart PrintAnywhereAgent`.

Alternative without NSSM: create a Task Scheduler task that runs `node C:\PrintAnywhere\agent\agent.mjs`
**at log on** for the desk user, with "restart on failure" enabled.

## What happens to a job

| Step | Detail |
| --- | --- |
| Claim | The server moves the oldest paid order to *Printing* |
| Print | `SumatraPDF -print-to "<printer>" -print-settings "1-3,5,monochrome,paper=A4,fit,2x" -silent file.pdf` |
| Wait | Polls `Get-PrintJob` until the job leaves the queue. Paper jams and out-of-paper errors show on the desk dashboard |
| Done | The order becomes *Ready* and the student gets an email |
| Error | The order is retried up to 3 times, then marked *Failed* on the desk dashboard for a manual reprint |

Pages that aren't A4 are scaled to fit A4 (`fit`). The cover sheet prints once per order and is free.
