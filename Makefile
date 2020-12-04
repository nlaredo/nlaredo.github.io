mandelbrot.html: mandelbrot.wasm
	grep -B99999 BEGIN-WASM $@ | awk '/app_version/{gsub("[.0-9][.0-9]*","'`git rev-list --count HEAD`'")} {print}' >/tmp/t
	base64 $^ | awk '{ print "\x27"$$0"\x27 +"; } END { print "\x27\x27;" }' >>/tmp/t
	grep -A99999 END-WASM mandelbrot.html >>/tmp/t
	cp /tmp/t $@

%.wasm: %.c
	emcc --no-entry -O3 -Os $< -s WASM=1 -s TOTAL_MEMORY=128MB -o $@
