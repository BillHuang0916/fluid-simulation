precision highp float;

varying vec2 v_uv;

uniform sampler2D source;

void main() {
  gl_FragColor = texture2D(source, v_uv);
}