precision highp float;

varying vec2 v_uv;

uniform float dt;
uniform vec2 t_size;
uniform sampler2D velocity;

float sigmoid(float x) {
  if(x >= 0.0) {
    return 1.0 / (1.0 + exp(-x));
  }
  return exp(x) / (exp(x) + 1.0);
}

float logit(float x) {
  if(x == 0.0) {
    return 1e-5;
  }
  if(x == 1.0) {
    return 1.0 - 1e-5;
  }
  return log(x / (1.0 - x));
}

vec4 decode(vec4 v) {
  return vec4(logit(v.x), logit(v.y), 0.0, 1.0);
}

vec4 encode(vec4 v) {
  return vec4(sigmoid(v.x), sigmoid(v.y), 0.0, 1.0);
}

void main() {
  float l = decode(texture2D(velocity, v_uv - t_size.x)).x;
  float r = decode(texture2D(velocity, v_uv + t_size.x)).x;
  float u = decode(texture2D(velocity, v_uv + t_size.y)).y;
  float d = decode(texture2D(velocity, v_uv - t_size.y)).y;

  float divergence = -2.0 * dot(t_size, vec2(r - l, u - d));
  gl_FragColor = vec4(sigmoid(divergence), 0.0, 0.0, 1.0);
}