precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform sampler2D pressure;
uniform sampler2D divergence;

void main(){
    float l = texture2D(pressure, v_uv + vec2(-1.0, 0.0)* t_size).x;
    float r = texture2D(pressure, v_uv + vec2(1.0, 0.0)* t_size).x;
    float u = texture2D(pressure, v_uv + vec2(0.0, 1.0)* t_size).x;
    float d = texture2D(pressure, v_uv + vec2(0.0, -1.0)* t_size).x;
    float diverge = texture2D(divergence, v_uv).x;
    float newPressure = (l + r + u + d) * 0.25 - diverge/dt;
    gl_FragColor = vec4(newPressure, 0.0, 0.0, 1.0);
}