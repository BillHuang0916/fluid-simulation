precision highp float;

varying vec2 v_uv;

uniform sampler2D velocity;

void main() {
  vec2 vel = texture2D(velocity, v_uv).xy;
  float len = length(vel);
  vel = vel * 0.5 + 0.5;

  vec3 color = vec3(vel.x, vel.y, 1.0);
  color = clamp(mix(vec3(1.0), color, len), 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}