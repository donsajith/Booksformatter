#!/usr/bin/env python3
import os
H = os.path.dirname(os.path.abspath(__file__))
order = ['fonts', 'hyph', 'core', 'specs', 'layout', 'cover', 'export', 'import', 'preflight', 'sample', 'ui-core', 'ui-panes']
js = '\n'.join(open(os.path.join(H, 'src', n + '.js')).read() for n in order)
assert '</script' not in js.lower()
html = open(os.path.join(H, 'src', 'index.template.html')).read().replace('/*__BUNDLE__*/', js)
open(os.path.join(H, 'index.html'), 'w').write(html)
print('index.html', round(len(html) / 1024), 'KB')
