path = r'frontend/src/pages/ResultEvaluation.jsx'
content = open(path, 'r', encoding='utf-8').read()
content_lf = content.replace('\r\n', '\n')
lines = content_lf.splitlines()

print("Lines 354-370 (score badge area):")
for i, l in enumerate(lines[353:370], start=354):
    print(f"{i}|{repr(l)}")

print("\nLines 368-385 (writing/speaking area):")
for i, l in enumerate(lines[367:390], start=368):
    print(f"{i}|{repr(l)}")
