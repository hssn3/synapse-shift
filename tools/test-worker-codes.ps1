# تست مسیرهای فرم‌های کد روی Worker محلی (شبیه Cloudflare)
$ErrorActionPreference = 'Continue'
$base = 'http://127.0.0.1:8787'
$mgr = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$head = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$mgrId = '4ee9de45-dca3-4c1d-921a-e1c631c2967c'
$headId = 'e2f7a3b9-6f0d-4c2e-9a51-8d3f5b1c7a90'

Start-Sleep -Seconds 4
function Show($label, $r) {
  $c = $r.Content; if ($c.Length -gt 200) { $c = $c.Substring(0, 200) + '…' }
  "{0,-40} {1}  {2}" -f $label, $r.StatusCode, $c
}

try { $h = Invoke-WebRequest "$base/healthz" -UseBasicParsing -TimeoutSec 15; Show 'healthz' $h } catch { "healthz ERR: $($_.Exception.Message)" }

# لاگین مدیر
try {
  $r = Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id = $mgrId; password = '0000' } | ConvertTo-Json) -ContentType 'application/json' -WebSession $mgr -UseBasicParsing -TimeoutSec 20
  $u = ($r.Content | ConvertFrom-Json).user
  "login manager: $($u.full_name)  is_manager=$($u.is_manager)"
} catch { "login manager ERR: $($_.Exception.Message)" }

# لاگین سرپرستار
try {
  $r = Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id = $headId; password = '0000' } | ConvertTo-Json) -ContentType 'application/json' -WebSession $head -UseBasicParsing -TimeoutSec 20
  $u = ($r.Content | ConvertFrom-Json).user
  "login head: $($u.full_name)  is_manager=$($u.is_manager)"
} catch { "login head ERR: $($_.Exception.Message)" }

# GET به‌عنوان مدیر
try {
  $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $mgr -UseBasicParsing -TimeoutSec 20
  $d = $r.Content | ConvertFrom-Json
  "GET codes (manager): $($r.StatusCode) entries=$($d.entries.Count) people=$($d.people.Count)"
} catch { "GET codes (manager) ERR: $($_.Exception.Message)" }

# PUT به‌عنوان مدیر
$cell = @{ type = '99'; year = 1405; month = 8; day = 5; shift = 'E'; role = 3; name = 'تست ورکر — تکنسین' } | ConvertTo-Json
try { $r = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body $cell -ContentType 'application/json' -WebSession $mgr -UseBasicParsing -TimeoutSec 20; Show 'PUT codes (manager)' $r } catch { "PUT ERR: $($_.Exception.Message)" }

try {
  $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $mgr -UseBasicParsing -TimeoutSec 20
  $row = ($r.Content | ConvertFrom-Json).entries | Where-Object { $_.day -eq 5 -and $_.shift -eq 'E' -and $_.role_no -eq 3 }
  "stored: '$($row.person_name)'"
} catch { "reload ERR: $($_.Exception.Message)" }

# سرپرستار باید ۴۰۳ بگیرد
try { $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $head -UseBasicParsing -TimeoutSec 20; "GET as head: $($r.StatusCode)" } catch { "GET as head: $($_.Exception.Response.StatusCode.value__) (expect 403)" }
try { $r = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body $cell -ContentType 'application/json' -WebSession $head -UseBasicParsing -TimeoutSec 20; "PUT as head: $($r.StatusCode)" } catch { "PUT as head: $($_.Exception.Response.StatusCode.value__) (expect 403)" }

# بدون نشست
try { $r = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -UseBasicParsing -TimeoutSec 20; "GET anon: $($r.StatusCode)" } catch { "GET anon: $($_.Exception.Response.StatusCode.value__) (expect 401)" }

# پاک‌سازی تست
try { $r = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body (@{ type='99';year=1405;month=8;day=5;shift='E';role=3;name='' } | ConvertTo-Json) -ContentType 'application/json' -WebSession $mgr -UseBasicParsing -TimeoutSec 20; Show 'PUT clear' $r } catch { "clear ERR: $($_.Exception.Message)" }
