import re, collections, sys

path = 'database/remote-backup-before-reset-2026-10-19.sql'
txt = open(path, encoding='utf-8', errors='replace').read()

sched_rows = re.findall(r'INSERT INTO "shift_schedules"[^;]*?VALUES\((.*?)\);', txt, re.S)
print('schedules:', len(sched_rows))
ids = {}
for r in sched_rows:
    parts = re.findall(r"'((?:[^']|'')*)'", r)
    if len(parts) >= 5:
        ids[parts[0]] = (parts[2], parts[3], parts[4])
        print(' ', parts[2], parts[3], parts[4], parts[0])

entry_rows = re.findall(r'INSERT INTO "shift_entries"[^;]*?VALUES\((.*?)\);', txt, re.S)
print('shift_entries rows:', len(entry_rows))
cnt = collections.Counter()
for r in entry_rows:
    parts = re.findall(r"'((?:[^']|'')*)'", r)
    if len(parts) >= 2:
        cnt[parts[1]] += 1
for sid, n in cnt.most_common(20):
    print('  schedule', ids.get(sid, ('?', '?', '?')), 'entries', n)
