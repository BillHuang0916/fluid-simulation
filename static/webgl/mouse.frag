precision highp float;

varying vec2 v_uv;
varying vec2 v_pos;

uniform vec2 force;
uniform vec2 v_mouse;
uniform sampler2D velocity;

void main(){
  vec4 oldVel = texture2D(velocity, v_uv);

  // The more mouse-centered, the larger the value.
  float intensity = 1.0 - min(length(v_mouse.xy - v_pos), 1.0);
  intensity = pow(intensity, 10.0);
  // Just add the size of the mouse at the uv point to the velocity.
  gl_FragColor = vec4(oldVel.xy + intensity * force, 0, 1.0);
}