precision highp float;

varying vec2 v_uv;
varying vec2 v_pos;

uniform vec2 force;
uniform vec2 v_mouse;
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

void main(){
  vec2 oldVel = decode(texture2D(velocity, v_uv)).xy;

  // The more mouse-centered, the larger the value.
  float intensity = 1.0 - min(length(v_mouse.xy - v_pos), 1.0);
  intensity = pow(intensity, 10.0);
  // Just add the size of the mouse at the uv point to the velocity.
  vec2 newVel = oldVel + intensity * force;
  gl_FragColor = vec4(sigmoid(newVel.x), sigmoid(newVel.y), 0.0, 1.0);
}