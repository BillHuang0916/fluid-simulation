precision highp float;

varying vec2 v_uv;

uniform float dt;
uniform vec2 t_size;
uniform sampler2D velocity;

void main() {
  float l = texture2D(velocity, v_uv + vec2(-1.0, 0.0) * t_size).x;
  float r = texture2D(velocity, v_uv + vec2(1.0, 0.0) * t_size).x;
  float u = texture2D(velocity, v_uv + vec2(0.0, 1.0) * t_size).y;
  float d = texture2D(velocity, v_uv + vec2(0.0, -1.0) * t_size).y;

  float divergence = (r - l + u - d) / 2.0;
  gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}