precision highp float;

varying vec2 v_uv;
varying vec2 v_pos;

uniform vec2 force;
uniform vec2 v_mouse;
uniform float display_ratio;
uniform float v_radius;
uniform sampler2D velocity;

void main() {
  vec2 oldVel = texture2D(velocity, v_uv).xy;

  // The more mouse-centered, the larger the value.
  vec2 dir = vec2(display_ratio * (v_mouse.x - v_pos.x), v_mouse.y - v_pos.y);
  float intensity = 1.0 - min(length(dir) / v_radius, 1.0);
  // Just add the size of the mouse at the uv point to the velocity.
  vec2 newVel = oldVel + intensity * force;
  gl_FragColor = vec4(newVel, 0.0, 1.0);
}