precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform sampler2D velocity;
uniform sampler2D colors;
uniform float dt;

vec4 bilerp(sampler2D sam, vec2 uv) {
  vec2 p_uv = uv * c_size;
  vec2 weights = fract(p_uv);
  vec2 floored_uv = floor(p_uv) / c_size;
  vec4 a = texture2D(sam, floored_uv);
  vec4 b = texture2D(sam, floored_uv + vec2(1.0, 0.0) * t_size);
  vec4 c = texture2D(sam, floored_uv + vec2(0.0, 1.0) * t_size);
  vec4 d = texture2D(sam, floored_uv + vec2(1.0, 1.0) * t_size);
  return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main() {
  vec2 prev_uv = v_uv - dt * texture2D(velocity, v_uv).xy;
  vec4 color;
  if(length(texture2D(velocity, v_uv).xy) < 0.000001) {
    color = texture2D(colors, prev_uv);
  } else {
    color = bilerp(colors, prev_uv);
  }
  gl_FragColor = color;
}