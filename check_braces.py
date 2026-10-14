text = open('scripts/update_data.js').read()
def check(chars):
  stack = []
  for i, c in enumerate(text):
    if c == chars[0]: stack.append(i)
    elif c == chars[1]:
      if not stack: print(f"Unmatched {c} at {i}"); return
      stack.pop()
  print(f"Unclosed {chars[0]} at {stack}")

check('{}')
check('()')
check('[]')
