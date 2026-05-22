import json, os, re
base = r'C:\Users\reeka\.cursor\projects\d-WORKS-FIGMA-Portfolio2026\agent-transcripts'
out = []
for root, dirs, files in os.walk(base):
    for f in files:
        if not f.endswith('.jsonl'):
            continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as fh:
            for line in fh:
                if 'Portfolio2026\\index.html' not in line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for part in obj.get('message', {}).get('content', []):
                    if part.get('type') != 'tool_use':
                        continue
                    inp = part.get('input', {})
                    if not inp.get('path', '').endswith('index.html'):
                        continue
                    ns = inp.get('new_string', '')
                    if len(ns) > 500:
                        out.append((len(ns), path, inp.get('old_string', '')[:80], ns))

out.sort(key=lambda x: -x[0])
print('found', len(out), 'chunks')
for item in out[:5]:
    print('---', item[0], item[1])
    print(item[3][:1500])
    print('...\n')
