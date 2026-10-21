from pathlib import Path

p = Path('public/js/shift-schedule.js')
src = p.read_text(encoding='utf-8')

old = "        lists[role] = [...new Set(docs.concat(matched, extra))];"
new = """        const all = docs.concat(matched, extra);
        const seen = new Set();
        const uniq = [];
        for (const n of all) {
          const k = String(n).replace(/\\u064A/g, '\\u06CC').replace(/\\u0643/g, '\\u06A9').trim();
          if (!k || seen.has(k)) continue;
          seen.add(k);
          uniq.push(k);
        }
        lists[role] = uniq;"""

if old not in src:
    raise SystemExit('anchor not found')
src = src.replace(old, new, 1)
p.write_text(src, encoding='utf-8')
print('dedupe ok')
