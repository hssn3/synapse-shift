from pathlib import Path

p = Path('public/js/shift-schedule.js')
src = p.read_text(encoding='utf-8')

# 1) سربرگ تب بحران: دکمه‌های برنامه شیفت + پنل‌ها
marker = '${I(\'shield\', \'lg\')}'
i = src.index(marker)
j = src.index('<div class="pbody" style="padding-top:0">', i)
new_head = """${I('shield', 'lg')}<div style="flex:1"><h3>برنامه بحران — بخش «${e(SS.wardTitle)}»</h3>
        <div class="sub">${JM[SS.month - 1]} ${F(SS.year)} — روی هر خانه بزن تا شیفت آن روز را بگذاری.</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssToggleSettings()">${I('settings')} ساعتِ شیفت</button>` : ''}
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssTogglePrintCfg()">${I('settings')} نام‌های امضا / قالب چاپ</button>` : ''}
          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssOpenPositions()">${I('settings')} سمت‌ها</button>` : ''}
          ${SS.isManager && SS.wardId ? `<button class="btn btn-o btn-sm" onclick="ssResetWardPass()">${I('key') || I('settings')} رمز ورود این بخش</button>` : ''}
          <button class="btn btn-o btn-sm" onclick="ssGenderCheck()">${I('users')} بررسی همگنی آقا/خانم</button>
          <button class="btn btn-g btn-sm" onclick="ssPrintCrisis()">${I('print')} چاپ فرم A4 افقی</button>
        </div>
      </div>
      <div class="pbody" style="padding-top:0">
        <div id="ssSettingsPanel">${SS.showSettings ? ssSettingsHtml() : ''}</div>
        <div id="ssPrintCfgPanel">${SS.showPrintCfg ? (SS.printCfg ? ssPrintCfgHtml() : '<div class="empty">در حال بارگذاری…</div>') : ''}</div>
"""
# از ابتدای marker تا ابتدای pbody، ولی خود pbody را حفظ می‌کنیم
src = src[:i] + new_head + src[j + len('<div class="pbody" style="padding-top:0">'):]

# 2) امکان override برای عنوان چاپ
src = src.replace("global.ssPrint = async function () {", "global.ssPrint = async function (override) {")
src = src.replace("const html = ssBuildPrintHtml(SS.printCfg || {});",
                  "const html = ssBuildPrintHtml(Object.assign({}, SS.printCfg || {}, override || {}));")

p.write_text(src, encoding='utf-8')
print('done')
