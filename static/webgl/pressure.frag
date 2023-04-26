precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform sampler2D pressure;
uniform sampler2D divergence;

float sigmoid(float x) {
  return 1.0 / (1.0 + exp(-x));
}

float logit(float x) {
  if(x == 0.0) {
    return 0.0;
  }
  if(x == 1.0) {
    return 1.0;
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
    float l = decode(texture2D(pressure, v_uv + vec2(-2.0, 0.0) * t_size)).x;
    float r = decode(texture2D(pressure, v_uv + vec2(2.0, 0.0) * t_size)).x;
    float u = decode(texture2D(pressure, v_uv + vec2(0.0, 2.0) * t_size)).x;
    float d = decode(texture2D(pressure, v_uv + vec2(0.0, -2.0) * t_size)).x;
    float divergence = decode(texture2D(divergence, v_uv)).x;
    float newPressure = (l + r + u + d - divergence) * 0.25;
    gl_FragColor = vec4(sigmoid(newPressure), 0.0, 0.0, 1.0);
}