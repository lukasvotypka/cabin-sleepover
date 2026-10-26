import json, sys
tpl = open(sys.argv[1], encoding='utf-8').read()
cap = sys.argv[2]
scenes = {n: open(f'{cap}/{n}.svg', encoding='utf-8').read() for n in ['2026-10-29', '2026-10-30', '2026-10-31']}
css = open(f'{cap}/css.css', encoding='utf-8').read()
out = tpl.replace('/*APPCSS*/', css).replace('/*SCENES*/', json.dumps(scenes, ensure_ascii=False).replace('</', '<\\/'))
open(sys.argv[3], 'w', encoding='utf-8').write(out)
print(len(out))
