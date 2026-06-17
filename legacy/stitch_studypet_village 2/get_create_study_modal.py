import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
content = open('../index.html', encoding='utf-8').read()

match = re.search(r'<div\b[^>]*?id="create-study-modal".*?>', content)
if match:
    start_idx = match.start()
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(content)):
        if content[i:i+4] == '<div':
            depth += 1
        elif content[i:i+5] == '</div':
            depth -= 1
            if depth == 0:
                end_idx = i + 6
                break
    if end_idx != -1:
        print(content[start_idx:end_idx])
