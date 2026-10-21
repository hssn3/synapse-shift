from pathlib import Path

p = Path('public/js/shift-schedule.js')
src = p.read_text(encoding='utf-8')

start = src.index('  // فرم اورژانس بحران')
end = src.index('})(window);')

new_fn = r"""  // چاپ برنامه بحران = همان برگهٔ برنامه شیفت (همان سربرگ و پاورقی) فقط عنوان بحران.
  global.ssPrintCrisis = async function () {
    if (!SS.sched) { if (typeof toast === 'function') toast('اول برنامهٔ ماه را باز کنید', true); return; }
    const days = (SS.sched.schedule && SS.sched.schedule.days) || 30;
    const st = SS.settings || {};
    const hoursOf = (c) => {
      if (!c) return 0;
      if (c.includes('H')) return Number(st.hour_h) || 0;
      let h = 0;
      if (c.includes('M')) h += Number(st.hour_m) || 0;
      if (c.includes('E')) h += Number(st.hour_e) || 0;
      if (c.includes('N')) h += Number(st.hour_n) || 0;
      return h;
    };
    const backup = SS.sched.staff;
    SS.sched.staff = ((SS.crisis && SS.crisis.rows) || []).map(s => {
      const cells = s.cells || {};
      let total = 0;
      for (let d = 1; d <= days; d++) total += hoursOf(cells[d]);
      return Object.assign({}, s, { cells: cells, total_hours: total, monthly_hour_quota: s.monthly_hour_quota || 0 });
    });
    try {
      await ssPrint({ title: 'برنامه بحران بخش ' + SS.wardTitle + ' — ' + JM[SS.month - 1] + ' ' + F(SS.year) });
    } finally {
      SS.sched.staff = backup;
    }
  };

"""

src = src[:start] + new_fn + src[end:]
p.write_text(src, encoding='utf-8')
print('replaced', end - start, '->', len(new_fn))
