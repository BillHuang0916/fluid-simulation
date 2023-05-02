const dt = 0.01;
const forceAmplifier = 1 / 20;
const PRESSURE_STEPS = 10;
const mouseEffectRadius = 100;

let canvas = document.querySelector("#fluid_sim");
let gl = canvas.getContext("webgl");
let fillProgram;
let fieldProgram;
let divergenceProgram;
let pressureProgram;
let velocityUpdateProgram;
let advectionProgram;
let colorProgram;
let positionBuffer;

let divergenceFbo;
let velocityFbos = [];
let pressureFbos = [];
let diffusionFbos = [];
let colorFbo;
let velocitySwapped = false;
let pressureSwapped = false;
let diffusionSwapped = false;
let mouseHeld = false
let force = null;
let mousePos = null;
let prevMousePos = null;


function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = canvas.height - (event.clientY - rect.top);
    return [x, y];
}

canvas.addEventListener('mousedown', function (e) {
    mouseHeld = true;
    prevMousePos = getCursorPosition(canvas, e);
    console.log("x: " + prevMousePos[0] + " y: " + prevMousePos[1]);
})

canvas.addEventListener('mousemove', function (e) {
    if (!mouseHeld) {
        return;
    }
    mousePos = getCursorPosition(canvas, e);
    if (mousePos[0] == prevMousePos[0] && mousePos[1] == prevMousePos[1]) {
        force = [0, 0];
    } else {
        force = [(mousePos[0] - prevMousePos[0]) * forceAmplifier, (mousePos[1] - prevMousePos[1]) * forceAmplifier];
    }
})

canvas.addEventListener('mouseup', function (e) {
    prevMousePos = null;
    force = null;
    mouseHeld = false;
})

gl.getExtension("OES_texture_float");

function getCurrentFramebuffer(FBArray, i) {
    return FBArray[i % 2];
}

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    return needResize;
}

function createShader(type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

class Program {
    constructor(vertexShader, fragmentShader) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }
}

function createProgram(vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    let success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

/*
 * Function to generate a dictionary of uniform locations for easy access.
 * Taken from https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/54ed78b00d7d8209790dd167dece747bfe9c5b88/script.js#L408
 */
function getUniforms(program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}

class FBO {
    constructor(buffer_type) {
        this.texture = createAndSetupTexture(buffer_type);
        this.fbo = createFrameBufferObject(this.texture);
    }
}

function createAndSetupTexture(buffer_type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
        gl.RGBA, buffer_type, null);
    return texture;
}

function createFrameBufferObject(texture) {
    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return fbo;
}


/* Create Programs */

const defaultVertexShaderStr = `
attribute vec2 aPosition;
varying vec2 v_uv;
varying vec2 v_pos;

void main() {
  // We need to negate the y coordinate because p5.js has (0,0) defined
  // in the bottom left corner while WebGL has it in the top left corner.
  v_uv = aPosition;
  
  // WebGL canvas ranges from -1 to 1 for both x and y.
  v_pos = v_uv * 2.0 - 1.0;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}`;

const fillShaderStr = `
precision highp float;

uniform vec4 color;

void main() {
  gl_FragColor = color;
}`;

const advectionShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform float dt;
uniform sampler2D velocity;

vec4 bilerp(sampler2D sam, vec2 uv) {
    vec2 p_uv = uv * c_size;
    vec2 weights = fract(p_uv);
    vec2 floored = floor(p_uv)/c_size;
    vec4 a = texture2D(sam, floored);
    vec4 b = texture2D(sam, floored + vec2(1.0, 0) * t_size);
    vec4 c = texture2D(sam, floored + vec2(0, 1.0) * t_size);
    vec4 d = texture2D(sam, floored + vec2(1.0, 1.0) * t_size);
    return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main(){
    vec2 prev_uv = v_uv - dt * texture2D(velocity, v_uv).xy;
    vec4 advection = texture2D(velocity, prev_uv);
    // vec2 prev_uv = v_uv - dt * bilerp(velocity, v_uv).xy;
    // vec4 advection = texture2D(velocity, prev_uv);
    gl_FragColor = advection;
}
`;

const diffusionShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform float viscosity;
uniform sampler2D velocity;
uniform vec2 c_size;

vec4 bilerp(sampler2D sam, vec2 uv) {
    vec2 p_uv = uv * c_size;
    vec2 weights = fract(p_uv);
    vec2 floored = floor(p_uv)/c_size;
    vec4 a = texture2D(sam, floored);
    vec4 b = texture2D(sam, floored + vec2(1.0, 0) * t_size);
    vec4 c = texture2D(sam, floored + vec2(0, 1.0) * t_size);
    vec4 d = texture2D(sam, floored + vec2(1.0, 1.0) * t_size);
    return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main(){
    vec2 prev_uv = v_uv - dt * bilerp(velocity, v_uv).xy;

    vec2 l = texture2D(velocity, v_uv - 2.0 * t_size.x).xy;
    vec2 r = texture2D(velocity, v_uv + 2.0 * t_size.x).xy;
    vec2 u = texture2D(velocity, v_uv + 2.0 * t_size.y).xy;
    vec2 d = texture2D(velocity, v_uv - 2.0 * t_size.y).xy;

    float diffX = 4.0 * prev_uv.x + viscosity*dt*(l.x + r.x + u.x + d.x);
    float diffY = 4.0 * prev_uv.y + viscosity*dt*(l.y + r.y + u.y + d.y);

    vec2 diff = vec2(diffX, diffY) / (4.0*(1.0 + viscosity*dt));

    gl_FragColor = vec4(diff, 0.0, 1.0);
}
`;

const divergenceShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform float dt;
uniform vec2 t_size;
uniform sampler2D velocity;

void main(){
    float l = texture2D(velocity, v_uv - t_size.x).x;
    float r = texture2D(velocity, v_uv + t_size.x).x;
    float u = texture2D(velocity, v_uv + t_size.y).y;
    float d = texture2D(velocity, v_uv - t_size.y).y;

    float divergence = (r - l + u - d)/2.0;
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;

const pressureCalcShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform sampler2D pressure;
uniform sampler2D divergence;

void main(){
    float l = texture2D(pressure, v_uv - 2.0 * t_size.x).x;
    float r = texture2D(pressure, v_uv + 2.0 * t_size.x).x;
    float u = texture2D(pressure, v_uv + 2.0 * t_size.y).x;
    float d = texture2D(pressure, v_uv - 2.0 * t_size.y).x;
    float diverge = texture2D(divergence, v_uv).x;
    float newPressure = (l + r + u + d) * 0.25 - diverge/dt;
    gl_FragColor = vec4(newPressure, 0.0, 0.0, 1.0);
}
`;

const pressureUpdateShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 t_size;
uniform float dt;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform vec2 c_size;

vec4 bilerp(sampler2D sam, vec2 uv) {
    vec2 p_uv = uv * c_size;
    vec2 weights = fract(p_uv);
    vec4 a = texture2D(sam, uv + vec2(-1.0, -1.0) * t_size);
    vec4 b = texture2D(sam, uv + vec2(1.0, -1.0) * t_size);
    vec4 c = texture2D(sam, uv + vec2(-1.0, 1.0) * t_size);
    vec4 d = texture2D(sam, uv + vec2(1.0, 1.0) * t_size);
    return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main(){
    vec2 prev_uv = v_uv - dt * bilerp(velocity, v_uv).xy;
    float l = texture2D(pressure, v_uv - 1.0 * t_size.x).x;
    float r = texture2D(pressure, v_uv + 1.0 * t_size.x).x;
    float u = texture2D(pressure, v_uv + 1.0 * t_size.y).x;
    float d = texture2D(pressure, v_uv - 1.0 * t_size.y).x;

    float gradPx = (r - l)/2.0;
    float gradPy = (u - d)/2.0;

    vec2 new_vel = vec2(prev_uv.x - dt*gradPx, prev_uv.y - dt*gradPy);

    gl_FragColor = vec4(new_vel, 0.0, 1.0);
}
`;

const mouseShaderStr = `
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
`;

const colorShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform sampler2D velocity;

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
    vec2 vel = texture2D(velocity, v_uv).xy;
    float len = length(vel);
    vel = vel * 0.5 + 0.5;
    
    vec3 color = vec3(vel.x, vel.y, 1.0);
    color = mix(vec3(1.0), color, len);

    gl_FragColor = vec4(color,  1.0);
}
`;

let vertexShader = createShader(gl.VERTEX_SHADER, defaultVertexShaderStr);
let fillShader = createShader(gl.FRAGMENT_SHADER, fillShaderStr);
let fieldShader = createShader(gl.FRAGMENT_SHADER, mouseShaderStr);
let advectionShader = createShader(gl.FRAGMENT_SHADER, advectionShaderStr);
let diffusionShader = createShader(gl.FRAGMENT_SHADER, diffusionShaderStr);
let divergenceShader = createShader(gl.FRAGMENT_SHADER, divergenceShaderStr);
let pressureCalcShader = createShader(gl.FRAGMENT_SHADER, pressureCalcShaderStr);
let pressureUpdateShader = createShader(gl.FRAGMENT_SHADER, pressureUpdateShaderStr);
let colorShader = createShader(gl.FRAGMENT_SHADER, colorShaderStr);

function setup() {
    positionBuffer = gl.createBuffer()

    fillProgram = new Program(vertexShader, fillShader);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, ]), gl.STATIC_DRAW)
    let positionLocation = gl.getAttribLocation(fillProgram.program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    fieldProgram = new Program(vertexShader, fieldShader);
    colorProgram = new Program(vertexShader, colorShader);
    advectionProgram = new Program(vertexShader, advectionShader);
    diffusionProgram = new Program(vertexShader, diffusionShader);
    divergenceProgram = new Program(vertexShader, divergenceShader);
    pressureProgram = new Program(vertexShader, pressureCalcShader);
    velocityProgram = new Program(vertexShader, pressureUpdateShader);

    divergenceFbo = new FBO(gl.FLOAT);
    colorFbo = new FBO(gl.UNSIGNED_BYTE);
    velocityFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];
    diffusionFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];
    pressureFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];
}


function render() {
    resizeCanvasToDisplaySize(canvas);
    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (mouseHeld && force != null) {
        // Bind Field Program
        gl.useProgram(fieldProgram.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[(velocitySwapped + 1) % 2].fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
        gl.uniform1i(fieldProgram.uniforms.velocity, 0);
        gl.uniform2fv(fieldProgram.uniforms.force, force);
        let vMousePos = [2.0 * (mousePos[0] / canvas.width) - 1.0, 2.0 * (mousePos[1] / canvas.height) - 1.0];
        gl.uniform2fv(fieldProgram.uniforms.v_mouse, vMousePos);
        gl.uniform1f(fieldProgram.uniforms.display_ratio, canvas.width / canvas.height);
        gl.uniform1f(fieldProgram.uniforms.v_radius, mouseEffectRadius / canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.viewport(0, 0, canvas.width, canvas.height);
        velocitySwapped = !velocitySwapped;
        prevMousePos = mousePos;

        // Bind Fill Program
        // gl.useProgram(fillProgram.program);
        // gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[(velocitySwapped + 1) % 2].fbo);
        // gl.uniform4fv(fillProgram.uniforms.color, [0.0, 0.5, 0.0, 1.0]);
        // gl.viewport(0, 0, canvas.width, canvas.height);
        // gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Bind Advection Program
    gl.useProgram(advectionProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[(velocitySwapped + 1) % 2].fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
    gl.uniform1i(advectionProgram.uniforms.velocity, 0);
    gl.uniform2fv(advectionProgram.uniforms.c_size, [canvas.width, canvas.height]);
    gl.uniform2fv(advectionProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    velocitySwapped = !velocitySwapped;

    // Bind Divergence Program
    gl.useProgram(divergenceProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, divergenceFbo.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
    gl.uniform1i(divergenceProgram.uniforms.velocity, 0);
    gl.uniform2fv(divergenceProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.uniform1f(divergenceProgram.uniforms.dt, dt);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Bind Fill Program to set initial pressure guess of 0 everywhere
    gl.useProgram(fillProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pressureFbos[pressureSwapped % 2].fbo);
    gl.uniform4fv(fillProgram.uniforms.color, [0.0, 0.0, 0.0, 1.0]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Run Jacobi's method to calculate pressure
    for (let i = 0; i < PRESSURE_STEPS; i++) {
        // Bind Pressure Calculation Program
        gl.useProgram(pressureProgram.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, pressureFbos[(pressureSwapped + 1) % 2].fbo);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pressureFbos[pressureSwapped % 2].texture);
        gl.uniform1i(pressureProgram.uniforms.pressure, 0);
        gl.activeTexture(gl.TEXTURE0 + 1);
        gl.bindTexture(gl.TEXTURE_2D, divergenceFbo.texture);
        gl.uniform1i(pressureProgram.uniforms.divergence, 1);
        gl.uniform2fv(pressureProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
        gl.uniform1f(pressureProgram.uniforms.dt, dt);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.viewport(0, 0, canvas.width, canvas.height);
        pressureSwapped = !pressureSwapped;
    }

    // Bind Velocity Update Program
    gl.useProgram(velocityProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[(velocitySwapped + 1) % 2].fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
    gl.uniform1i(velocityProgram.uniforms.velocity, 0);
    gl.activeTexture(gl.TEXTURE0 + 1);
    gl.bindTexture(gl.TEXTURE_2D, pressureFbos[pressureSwapped % 2].texture);
    gl.uniform1i(velocityProgram.uniforms.pressure, 1);
    gl.uniform2fv(velocityProgram.uniforms.c_size, [canvas.width, canvas.height]);
    gl.uniform2fv(velocityProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.uniform1f(velocityProgram.uniforms.dt, dt);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Bind Color Program
    gl.useProgram(colorProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbo.fbo);
    gl.activeTexture(gl.TEXTURE0);
    //gl.bindTexture(gl.TEXTURE_2D, divergenceFbo.texture);
    gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
    gl.uniform1i(fillProgram.uniforms.velocity, 0);
    gl.uniform2fv(fillProgram.uniforms.c_size, [canvas.width, canvas.height]);
    gl.uniform2fv(fillProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Display
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(render);
}

function main() {
    setup();
    requestAnimationFrame(render);
}

main();