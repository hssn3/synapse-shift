$ErrorActionPreference = 'Continue'
$base = 'https://synapse-shift.hcode016.workers.dev'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Invoke-WebRequest "$base/healthz" -UseBasicParsing -TimeoutSec 20 | ForEach-Object { "healthz: $($_.StatusCode)" }
Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id='4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password='0000' }|ConvertTo-Json) -ContentType 'application/json' -WebSession $s -UseBasicParsing -TimeoutSec 25 | Out-Null

$c99 = (Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $s -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json
$c55 = (Invoke-WebRequest "$base/api/shift/codes?type=55&year=1405&month=8" -WebSession $s -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json
"codes 99 entries=$($c99.entries.Count)  codes 55 entries=$($c55.entries.Count)"

$sample = $c99.entries | Where-Object { $_.day -eq 1 -and $_.shift -eq 'M' } | Sort-Object role_no
"day1 M: " + (($sample | ForEach-Object { "$($_.role_no)=$($_.person_name)" }) -join ' | ')

$meta = (Invoke-WebRequest "$base/api/shift/codes/meta?type=crisis" -WebSession $s -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json
"meta crisis: " + ($meta.meta | ConvertTo-Json -Compress -Depth 3).Substring(0, 80)

$js = (Invoke-WebRequest "$base/js/shift-schedule.js" -UseBasicParsing -TimeoutSec 25).Content
"asset has crisis chip: " + ($js -match 'بحران اورژانس')
"asset has meta save: " + ($js -match 'ssSaveCodeMeta')
$css = (Invoke-WebRequest "$base/css/code-print.css" -UseBasicParsing -TimeoutSec 25).Content
"css has logo: " + ($css -match '\.cd-logo')
