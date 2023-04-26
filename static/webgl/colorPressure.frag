precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform sampler2D pressure;

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
    return vec4(logit(v.x), 0.0, 0.0, 1.0);
}

void main() {
  float pressure = texture2D(pressure, v_uv).x;
  float r = logit(pressure) >= 0.0? pressure: 0.0;
  float b = logit(pressure) < 0.0? pressure: 0.0;
  gl_FragColor = vec4(0.0, pressure, 0.0, 1.0);
}