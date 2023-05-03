attribute vec2 aPosition;
varying vec2 v_uv;
varying vec2 v_pos;

void main() {
  v_uv = aPosition;

  // WebGL canvas ranges from -1 to 1 for both x and y.
  v_pos = v_uv * 2.0 - 1.0;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}