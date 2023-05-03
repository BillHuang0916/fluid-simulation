precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform sampler2D pressure;
uniform sampler2D velocity;

void main() {
  vec2 cur_vel = texture2D(velocity, v_uv).xy;
  float l = texture2D(pressure, v_uv + vec2(-1.0, 0.0) * t_size).x;
  float r = texture2D(pressure, v_uv + vec2(1.0, 0.0) * t_size).x;
  float u = texture2D(pressure, v_uv + vec2(0.0, 1.0) * t_size).x;
  float d = texture2D(pressure, v_uv + vec2(0.0, -1.0) * t_size).x;

  float gradPx = (r - l) / 2.0;
  float gradPy = (u - d) / 2.0;

  vec2 new_vel = vec2(cur_vel.x - dt * gradPx, cur_vel.y - dt * gradPy);

  gl_FragColor = vec4(new_vel, 0.0, 1.0);
}