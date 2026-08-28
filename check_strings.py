text = open('scripts/update_data.js').read()
def check_quote(q):
    in_str = False
    escape = False
    for i, c in enumerate(text):
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if c == q:
            in_str = not in_str
    print(f"Quote {q} matched: {not in_str}")

check_quote('"')
check_quote("'")
check_quote("`")
