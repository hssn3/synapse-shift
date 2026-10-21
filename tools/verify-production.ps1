$ErrorActionPreference = 'Continue'
$base = 'https://synapse-shift.hcode016.workers.dev'
$mgr = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$head = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Show($label, $r) {
  $c = $r.Content; if ($c.Length -gt 150) { $c = $c.Substring(0, 150) }
  "{0,-42} {1}  {2}" -f $label, $r.StatusCode, $c
}

try { $r = Invoke-WebRequest "$base/healthz" -UseBasicParsing -TimeoutSec 20; Show 'healthz' $r } catch { "healthz ERR: $($_.Exception.Message)" }

# بدون نشست → باید ۴۰۱ بدهد (یعنی مسیر وجود دارد)
try { $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -UseBasicParsing -TimeoutSec 20; "codes anon: $($r.StatusCode)" } catch { "codes anon: $($_.Exception.Response.StatusCode.value__) (expect 401)" }

# مدیر
try {
  $r = Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id='4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password='0000' }|ConvertTo-Json) -ContentType 'application/json' -WebSession $mgr -UseBasicParsing -TimeoutSec 25
  $u = ($r.Content | ConvertFrom-Json).user
  "login manager: $($u.full_name) is_manager=$($u.is_manager)"
} catch { "login manager ERR: $($_.Exception.Message)" }

try {
  $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $mgr -UseBasicParsing -TimeoutSec 25
  $d = $r.Content | ConvertFrom-Json
  "codes manager: $($r.StatusCode) entries=$($d.entries.Count) people=$($d.people.Count)"
} catch { "codes manager ERR: $($_.Exception.Message)" }

# سرپرستار
try {
  $r = Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id='e2f7a3b9-6f0d-4c2e-9a51-8d3f5b1c7a90'; password='0000' }|ConvertTo-Json) -ContentType 'application/json' -WebSession $head -UseBasicParsing -TimeoutSec 25
  $u = ($r.Content | ConvertFrom-Json).user
  "login head: $($u.full_name) is_manager=$($u.is_manager)"
} catch { "login head ERR: $($_.Exception.Message)" }
try { $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $head -UseBasicParsing -TimeoutSec 25; "codes head: $($r.StatusCode)" } catch { "codes head: $($_.Exception.Response.StatusCode.value__) (expect 403)" }

# دارایی‌های تازه در تولید
foreach ($p in @('/css/code-print.css', '/js/shift-schedule.js')) {
  try {
    $r = Invoke-WebRequest ($base + $p) -UseBasicParsing -TimeoutSec 25
    $flag = ''
    if ($p -like '*shift-schedule.js') { $flag = if ($r.Content -match 'ss-ward-groups' -and $r.Content -match '/api/shift/codes') { ' [شامل کدهای جدید]' } else { ' [نسخهٔ قدیم!]' } }
    "{0,-42} {1}  len={2}{3}" -f $p, $r.StatusCode, $r.Content.Length, $flag
  } catch { "$p ERR: $($_.Exception.Message)" }
}
