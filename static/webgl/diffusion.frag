precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform float viscosity;
uniform sampler2D velocity;

uniform sampler2D diffusion;

void main() {
  vec2 curVel = texture2D(velocity, v_uv).xy;

  vec2 l = texture2D(diffusion, v_uv + vec2(-2.0, 0.0) * t_size).xy;
  vec2 r = texture2D(diffusion, v_uv + vec2(2.0, 0.0) * t_size).xy;
  vec2 u = texture2D(diffusion, v_uv + vec2(0.0, 2.0) * t_size).xy;
  vec2 d = texture2D(diffusion, v_uv + vec2(0.0, -2.0) * t_size).xy;

  float diffX = 4.0 * curVel.x + viscosity * dt * (l.x + r.x + u.x + d.x);
  float diffY = 4.0 * curVel.y + viscosity * dt * (l.y + r.y + u.y + d.y);

  vec2 diff = vec2(diffX, diffY) / (4.0 * (1.0 + viscosity * dt));

  gl_FragColor = vec4(diff, 0.0, 1.0);
}