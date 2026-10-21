$ErrorActionPreference = 'Continue'
$base = 'http://127.0.0.1:3000'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Start-Sleep -Seconds 4

Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body (@{ user_id='4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password='0000' }|ConvertTo-Json) -ContentType 'application/json' -WebSession $s -UseBasicParsing | Out-Null

$g = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $s -UseBasicParsing -TimeoutSec 30
$d = $g.Content | ConvertFrom-Json
"codes 99: $($g.StatusCode) entries=$($d.entries.Count) people=$($d.people.Count)"

$m = Invoke-WebRequest "$base/api/shift/codes/meta?type=99" -WebSession $s -UseBasicParsing -TimeoutSec 30
"meta 99: $($m.StatusCode) $($m.Content.Substring(0,[Math]::Min(120,$m.Content.Length)))"

$mc = Invoke-WebRequest "$base/api/shift/codes/meta?type=crisis" -WebSession $s -UseBasicParsing -TimeoutSec 30
"meta crisis: $($mc.StatusCode) $($mc.Content.Substring(0,[Math]::Min(80,$mc.Content.Length)))"

# ذخیرهٔ تنظیمات نمونه و بازخوانی
$body = @{ type='crisis'; meta=@{ title='برنامه درمانی ماهانه بخش اورژانس بحران'; form_code='MFH-HM-FR-00/17'; beds=4; method='Case Method'; contract_hours=158; level_avg=@(50,120,550,90,$null); level_hours=@(4,6,5,5,$null); training_title='افراد معرفی شده به کلاس‌های آموزشی:'; signs=@(@{label='سرپرستار';name='مریم بهنامی نژاد'},@{label='سوپروایزر';name='سودابه جهانگیری'},@{label='مدیریت پرستاری';name='سلیمه احتسابی'},@{label='ریاست';name='دکتر فرزاد سالاری'}) } } | ConvertTo-Json -Depth 6
try {
  $p = Invoke-WebRequest "$base/api/shift/codes/meta" -Method PUT -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' -WebSession $s -UseBasicParsing -TimeoutSec 30
  "meta PUT: $($p.StatusCode)"
} catch { "meta PUT ERR: $($_.Exception.Message)" }
$m2 = Invoke-WebRequest "$base/api/shift/codes/meta?type=crisis" -WebSession $s -UseBasicParsing -TimeoutSec 30
$mm = ($m2.Content | ConvertFrom-Json).meta
"saved crisis: title=$($mm.title) beds=$($mm.beds) avg=$($mm.level_avg -join ',') signs=$($mm.signs.Count)"
