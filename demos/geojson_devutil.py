import re

with open("sample_map.js", "r+") as sample:
	text = sample.read()
	pattern = re.compile("(-?[0-9]+\.[0-9]+),\n *(-?[0-9]+\.[0-9]+)")
	text = re.sub(pattern, r"\2,\n\1", text)
	sample.seek(0)
	sample.write(text)
	sample.truncate()
