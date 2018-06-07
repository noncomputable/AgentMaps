import re
with open("sample_map3.js", "r+") as sample:
	text = sample.read()
	print(text[-100:])
	pattern = re.compile("(-?[0-9]+\.[0-9]+),\n *(-?[0-9]+\.[0-9]+)")
	print(re.match(pattern, "oijf43.435093,\n-9043.90345jkkh"))
	text = re.sub(pattern, r"\2,\n\1", text)
	print(text[-100:])
	sample.seek(0)
	sample.write(text)
	sample.truncate()
