#include <math.h>
#include <stdio.h>
#include <stdarg.h>
#include <emscripten/emscripten.h>
#include <emscripten/emmalloc.h>

EMSCRIPTEN_KEEPALIVE int data[4096 * 4096];
EMSCRIPTEN_KEEPALIVE int ctable[1048576];
EMSCRIPTEN_KEEPALIVE char *logstart = 0;
EMSCRIPTEN_KEEPALIVE int logsize = 4096;
EMSCRIPTEN_KEEPALIVE int loglen = 0;
EMSCRIPTEN_KEEPALIVE int pixelMin = 128 * 128;
EMSCRIPTEN_KEEPALIVE int width, height, pixelCount, pixelMax = 0;
EMSCRIPTEN_KEEPALIVE int cx, cy, xpos, ypos, cdx, cdy;
EMSCRIPTEN_KEEPALIVE double dscale, xmin, ymin, maxIter;
EMSCRIPTEN_KEEPALIVE int pixel = 0;
EMSCRIPTEN_KEEPALIVE int smooth = 1;

void EMSCRIPTEN_KEEPALIVE jprintf(char *fmt, ...) {
  va_list args;
  va_start(args, fmt);
  loglen += vsprintf(logstart + loglen, fmt, args);
  va_end(args);
}
int* EMSCRIPTEN_KEEPALIVE init(int pixels) {
  if (pixels < pixelMin)
    pixels = pixelMin;
  pixelCount = pixelMax = pixels;
  return &data[0];
}

void EMSCRIPTEN_KEEPALIVE setupSize(int w, int h, int i, int s,
                                    double ds, double xm, double ym) {
  if (w < 8) w = 8;
  if (h < 8) h = 8;
  if (i < 8) i = 8;
  pixelCount = w * h;
  if (pixelCount > pixelMax)
    pixelCount = pixelMax;
  width = w;
  height = h;
  maxIter = i;
  smooth = s;
  cx = w >> 1;
  cy = h >> 1;
  pixel = xpos = ypos = cdx = 0; cdy = -1;
  dscale = ds;
  xmin = xm;
  ymin = ym;
}

double EMSCRIPTEN_KEEPALIVE mandelbrot(int px, int py) {
  double x0 = px * dscale + xmin;
  double y0 = py * dscale + ymin;
  double x = x0; //z.r
  double y = y0; //z.i
  double i = 0;
  double xsq = x*x;
  double ysq = y*y;
  do {
    y = x * y;
    y += y;
    y += y0;
    x = xsq - ysq + x0;
    xsq = x * x;
    ysq = y * y;
    i++;
  } while (i < maxIter && xsq + ysq <= 256);
  if (smooth && i < maxIter - 2) {
    i += 1-log((0.5 * log(xsq + ysq))/log(2))/log(2);
  }
  return i; 
}

int EMSCRIPTEN_KEEPALIVE calcWork(int workUnit) {
  for (int work = 0; pixel < pixelCount  && work < workUnit; work++) {
    // calculate in spiral from center
    int x = cx + xpos;
    int y = cy + ypos;
    if (x >= 0 && x < width && y >= 0 && y <= height) {
      int o = y * width + x;
      double it = mandelbrot(x, y);
      int i = floor(it);
      if (smooth && i < maxIter) {
        double e = (float)(i + 1) - it;
        if (i <= 0) i = e = 0;
        double f = 1 - e;
        double r = e * (ctable[i] & 0xff) + f * (ctable[i+1] & 0xff);
        double g = e * ((ctable[i] >> 8) & 0xff) + f * ((ctable[i+1] >> 8) & 0xff);
        double b = e * ((ctable[i] >> 16) & 0xff) + f * ((ctable[i+1] >> 16) & 0xff);
        data[o] = 0xff000000 | (int)floor(r) | ((int)floor(g) << 8) | ((int)floor(b) << 16);
      } else {
        data[o] = ctable[i];
      }
      pixel++;
    }
    if ((xpos == ypos) || ((xpos < 0) && (xpos == -ypos)) ||
      ((xpos > 0) && (xpos == 1 - ypos))) {
      int dx = cdx;
      cdx = -cdy;
      cdy = dx;
    }
    xpos += cdx;
    ypos += cdy;
  }
  return pixel;
}
