# آزمون ۳۱ روزه بودن همهٔ ماه‌ها (آبان = ۳۰ روز تقویمی) روی D1 محلی
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8787'
$sid = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod "$base/api/entry/role-login" -Method POST -WebSession $sid -ContentType 'application/json' -Body (@{ user_id = '4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password = '0000' } | ConvertTo-Json) | Out-Null
function J($o) { $o | ConvertTo-Json -Depth 6 -Compress }

$ward = 'انبار'; $year = 1405; $month = 8; $days = 31
$existing = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
foreach ($s in $existing) { if ($s.last_name -like 'آزمون*') { Invoke-RestMethod "$base/api/shift/staff/$($s.id)" -Method DELETE -WebSession $sid | Out-Null } }

foreach ($p in @(@('آزمون‌الف','یک','زن','پرستار',100), @('آزمون‌ب','دو','مرد','کمک‌پرستار',100))) {
  Invoke-RestMethod "$base/api/shift/staff" -Method POST -WebSession $sid -ContentType 'application/json' -Body (J @{
    ward=$ward; first_name=$p[0]; last_name=$p[1]; gender=$p[2]; position=$p[3]; fixed_shift='';
    monthly_hour_quota=$p[4]; employment_status='قراردادی'; hire_date=''; years_experience=3; extra_info=@{}
  }) | Out-Null
}
$staff = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
$idA = ($staff | Where-Object { $_.last_name -eq 'یک' }).id
$idB = ($staff | Where-Object { $_.last_name -eq 'دو' }).id

foreach ($d in 1..$days) {
  $ca = 'M'
  $cb = if ($d -le 15) { 'N' } else { 'H' }
  Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{ ward=$ward; year=$year; month=$month; day=$d; staff_id=$idA; codes=$ca }) | Out-Null
  Invoke-RestMethod "$base/api/shift/schedule/cell" -Method PUT -WebSession $sid -ContentType 'application/json' -Body (J @{ ward=$ward; year=$year; month=$month; day=$d; staff_id=$idB; codes=$cb }) | Out-Null
}

$sc = Invoke-RestMethod "$base/api/shift/schedule?ward=$([uri]::EscapeDataString($ward))&year=$year&month=$month" -WebSession $sid
$rowA = $sc.staff | Where-Object { $_.id -eq $idA }
$rowB = $sc.staff | Where-Object { $_.id -eq $idB }
"days = $($sc.schedule.days)  (expected 31)"
"cell A 31 = $($rowA.cells.'31')   cell B 31 = $($rowB.cells.'31')"
"A total=$($rowA.total_hours) overtime=$($rowA.overtime)  (expected 217 / 117 = 31×7 − 100)"
"B total=$($rowB.total_hours) overtime=$($rowB.overtime)  (expected 292 / 192 = 15×12 + 16×7 − 100)"
"headcount day31: M=$($sc.headcount.'31'.M) E=$($sc.headcount.'31'.E) N=$($sc.headcount.'31'.N) H=$($sc.headcount.'31'.H)  (expected 1/0/0/1)"
"headcount day10: M=$($sc.headcount.'10'.M) N=$($sc.headcount.'10'.N)  (expected 1/1)"
"holidays day 22 registered client-side only"

$all = (Invoke-RestMethod "$base/api/shift/staff?ward=$([uri]::EscapeDataString($ward))" -WebSession $sid).staff
foreach ($s in $all) { if ($s.last_name -in @('یک','دو')) { Invoke-RestMethod "$base/api/shift/staff/$($s.id)" -Method DELETE -WebSession $sid | Out-Null } }
'cleanup done'
