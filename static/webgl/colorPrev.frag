precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform sampler2D velocity;
uniform sampler2D colors;
uniform float dt;

vec4 bilerp(sampler2D sam, vec2 uv) {
    vec2 p_uv = uv * c_size;
    vec2 weights = fract(p_uv);
    vec4 a = texture2D(sam, uv + vec2(-1.0, -1.0) * t_size);
    vec4 b = texture2D(sam, uv + vec2(1.0, -1.0) * t_size);
    vec4 c = texture2D(sam, uv + vec2(-1.0, 1.0) * t_size);
    vec4 d = texture2D(sam, uv + vec2(1.0, 1.0) * t_size);
    return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main() {
  //vec2 vel = bilerp(velocity, v_uv).xy;
  //vec2 vel = texture2D(velocity, v_uv).xy;
  //float color = length(vel);
  //float color = vel.x;
  //float color = texture2D(velocity, v_uv).x;

  //gl_FragColor = vec4(0.0, color, 0.0, 1.0);

    vec2 prev_uv = v_uv - dt * texture2D(velocity, v_uv).xy;
    vec4 color = bilerp(colors, prev_uv);
    gl_FragColor = color;
}