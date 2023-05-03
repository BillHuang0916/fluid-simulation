precision highp float;

varying vec2 v_uv;

uniform sampler2D source;

void main() {
  vec2 flipped = vec2(v_uv.x, 1.0 - v_uv.y);
  gl_FragColor = texture2D(source, flipped);
}