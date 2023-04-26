precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
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

void main(){
    float l = decode(texture2D(velocity, v_uv + vec2(-1.0, 0.0) * t_size)).x;
    float r = decode(texture2D(velocity, v_uv + vec2(1.0, 0.0) * t_size)).x;
    float u = decode(texture2D(velocity, v_uv + vec2(0.0, 1.0) * t_size)).y;
    float d = decode(texture2D(velocity, v_uv + vec2(0.0, -1.0) * t_size)).y;

    float divergence = 0.5 * (r - l + u - d);
    gl_FragColor = vec4(sigmoid(divergence), 0.0, 0.0, 1.0);
}