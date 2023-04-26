precision highp float;

varying vec2 v_uv;
varying vec2 v_pos;

uniform vec2 c_size;
uniform vec2 t_size;
uniform float dt;
uniform sampler2D velocity;

float sigmoid(float x) {
  return 1.0 / (1.0 + exp(-x));
}

float logit(float x) {
  if(x == 1.0) {
    return 0.0;
  }
  return log(x / (1.0 - x));
}

vec4 decode(vec4 v) {
    return vec4(logit(v.x), logit(v.y), 0.0, 1.0);
}

vec4 encode(vec4 v) {
    return vec4(sigmoid(v.x), sigmoid(v.y), 0.0, 1.0);
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

void main(){
    vec2 prev_uv = v_uv - dt * bilerp(velocity, v_uv).xy;
    vec4 advection = encode(bilerp(velocity, prev_uv));
    gl_FragColor = advection;
}