# تست محاسبات شیفت روی سرور محلی (D1 محلی) — فقط برای بررسی، دادهٔ تولید را دست نمی‌زند.
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8787'
$sid = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ user_id = '4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password = '0000' } | ConvertTo-Json
Invoke-RestMethod "$base/api/entry/role-login" -Method POST -WebSession $sid -ContentType 'application/json' -Body $loginBody | Out-Null

function J($obj) { $obj | ConvertTo-Json -Depth 6 -Compress }

$ward = 'انبار'
$year = 1405
$month = 5   # مرداد = ۳۱ روز
$days = 31

$existing = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
foreach ($s in $existing) {
  if ($s.last_name -like 'تست*') { Invoke-RestMethod "$base/api/shift/staff/$($s.id)" -Method DELETE -WebSession $sid | Out-Null }
}

$mk = { param($fn, $ln, $gender, $pos, $fixed, $quota)
  Invoke-RestMethod "$base/api/shift/staff" -Method POST -WebSession $sid -ContentType 'application/json' -Body (J @{
    ward = $ward; first_name = $fn; last_name = $ln; gender = $gender; position = $pos;
    fixed_shift = $fixed; monthly_hour_quota = $quota; employment_status = 'قراردادی';
    hire_date = ''; years_experience = 5; extra_info = @{}
  })
}
& $mk 'تست‌الف' 'تست‌یک' 'زن' 'پرستار' 'M' 100 | Out-Null
& $mk 'تست‌ب' 'تست‌دو' 'مرد' 'کمک‌پرستار' 'N' 100 | Out-Null

$staff = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
$idA = ($staff | Where-Object { $_.last_name -eq 'تست‌یک' }).id
$idB = ($staff | Where-Object { $_.last_name -eq 'تست‌دو' }).id

$plan = @{}
for ($d = 1; $d -le $days; $d++) {
  if ($d -le 10) { $plan["$d|A"] = 'M' }
  elseif ($d -le 20) { $plan["$d|A"] = 'E' }
  elseif ($d -le 25) { $plan["$d|A"] = 'H' }
  else { $plan["$d|A"] = 'N' }
  $plan["$d|B"] = 'N'
}
foreach ($d in 1..$days) {
  Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{
    ward = $ward; year = $year; month = $month; day = $d; staff_id = $idA; codes = $plan["$d|A"]
  }) | Out-Null
  Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{
    ward = $ward; year = $year; month = $month; day = $d; staff_id = $idB; codes = $plan["$d|B"]
  }) | Out-Null
}

$sc = Invoke-RestMethod "$base/api/shift/schedule?ward=$([uri]::EscapeDataString($ward))&year=$year&month=$month" -WebSession $sid
$rowA = $sc.staff | Where-Object { $_.id -eq $idA }
$rowB = $sc.staff | Where-Object { $_.id -eq $idB }
"days reported: $($sc.schedule.days)"
"A: total=$($rowA.total_hours) overtime=$($rowA.overtime) (expected 237 / +137)"
"B: total=$($rowB.total_hours) overtime=$($rowB.overtime) (expected 372 / +272)"
"headcount day1: M=$($sc.headcount.'1'.M) E=$($sc.headcount.'1'.E) N=$($sc.headcount.'1'.N) H=$($sc.headcount.'1'.H) (expected 1/0/1/0)"
"headcount day12: M=$($sc.headcount.'12'.M) E=$($sc.headcount.'12'.E) N=$($sc.headcount.'12'.N) H=$($sc.headcount.'12'.H) (expected 0/1/1/0)"
"headcount day22: H=$($sc.headcount.'22'.H) N=$($sc.headcount.'22'.N) (expected 1/1)"
"cell A day31 = $($rowA.cells.'31'); B day31 = $($rowB.cells.'31')"

try {
  Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{
    ward = $ward; year = $year; month = $month; day = 3; staff_id = $idA; codes = 'MH'
  }) | Out-Null
  'H+M accepted (BAD)'
} catch { "H+M rejected: $($_.Exception.Response.StatusCode.value__) (expected 400)" }

Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{
  ward = $ward; year = $year; month = $month; day = 5; staff_id = $idA; codes = 'M'; lead = $true
}) | Out-Null
Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{
  ward = $ward; year = $year; month = $month; day = 5; staff_id = $idB; codes = 'N'; lead = $true
}) | Out-Null
$sc2 = Invoke-RestMethod "$base/api/shift/schedule?ward=$([uri]::EscapeDataString($ward))&year=$year&month=$month" -WebSession $sid
$leadA = ($sc2.staff | Where-Object { $_.id -eq $idA }).leads.'5'
$leadB = ($sc2.staff | Where-Object { $_.id -eq $idB }).leads.'5'
"lead day5: A=$leadA B=$leadB (expected A=false B=true)"

$sc3 = Invoke-RestMethod "$base/api/shift/schedule?ward=$([uri]::EscapeDataString($ward))&year=$year&month=8" -WebSession $sid
"month 8 (Aban) days from server: $($sc3.schedule.days) — code form (client) shows 31"

$all = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
foreach ($s in $all) { if ($s.last_name -like 'تست*') { Invoke-RestMethod "$base/api/shift/staff/$($s.id)" -Method DELETE -WebSession $sid | Out-Null } }
'cleanup done'
