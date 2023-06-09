precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
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

vec4 bilerp(sampler2D sam, vec2 uv) {
    vec2 p_uv = uv * c_size;
    vec2 weights = fract(p_uv);
    vec4 a = decode(texture2D(sam, uv + vec2(-1.0, -1.0) * t_size));
    vec4 b = decode(texture2D(sam, uv + vec2(1.0, -1.0) * t_size));
    vec4 c = decode(texture2D(sam, uv + vec2(-1.0, 1.0) * t_size));
    vec4 d = decode(texture2D(sam, uv + vec2(1.0, 1.0) * t_size));
    return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main() {
  vec2 vel = bilerp(velocity, v_uv).xy;
  //vec2 vel = decode(texture2D(velocity, v_uv)).xy;
  float color = length(vel);
  //float color = vel.x;
  //float color = texture2D(velocity, v_uv).x;
  
  gl_FragColor = vec4(0.0, color, 0.0, 1.0);
}