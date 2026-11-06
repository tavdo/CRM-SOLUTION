$ErrorActionPreference = 'Stop'
$backupWorkspace = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$backupNode = (Get-Command node -ErrorAction Stop).Source
$backupEnvironment = Join-Path $backupWorkspace '.env.live.local'
$backupScript = Join-Path $backupWorkspace 'scripts/scheduled-backup.mjs'
if (-not (Test-Path -LiteralPath $backupEnvironment)) { throw 'Live settings are missing' }
if ((Get-TimeZone).Id -ne 'Georgian Standard Time') { throw 'Schedule must be reviewed for the computer time zone; expected Tbilisi' }
$backupTaskName = 'CRMsolution2026-DailyBackup'
if (Get-ScheduledTask -TaskName $backupTaskName -ErrorAction SilentlyContinue) { throw 'Backup task already exists; its settings were preserved' }
$backupAction = New-ScheduledTaskAction -Execute $backupNode -Argument "--env-file=`"$backupEnvironment`" `"$backupScript`"" -WorkingDirectory $backupWorkspace
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '04:00'
$backupPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger $backupTrigger -Principal $backupPrincipal -Settings $backupSettings -Description 'Daily encrypted Supabase DB and private media backup; keeps seven copies on this PC. Requires signed-in user and internet; starts when available.' | Out-Null
Get-ScheduledTask -TaskName $backupTaskName | Select-Object TaskName,State
