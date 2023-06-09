let dt = 0.0133;
const forceAmplifier = .02;
let diffusionSteps = 5;
let pressureSteps = 5;
let mouseEffectRadius = 100;
let viscosity = 100;
const wall_size = 2;

let canvas = document.querySelector("#fluid_sim");
let gl = canvas.getContext("webgl");
let fillProgram;
let fillFromSourceProgram;
let fillFromSourceFlipProgram;
let diffusionProgram;
let fieldProgram;
let divergenceProgram;
let pressureProgram;
let velocityUpdateProgram;
let advectionProgram;
let colorProgram;
let fillColorProgram;
let vBoundaryProgram;
let zBoundaryProgram;

let divergenceFbo;
let velocityFbos = [];
let pressureFbos = [];
let diffusionFbos = [];

let colorFbos = [];
let pressureInit = false;
let velocitySwapped = false;
let pressureSwapped = false;
let diffusionSwapped = false;
let colorSwapped = false;
let mouseHeld = false
let force = null;
let vMousePos = null;
let mousePos = null;
let prevMousePos = null;
let paused = false;
let useViscosity = true;

let imageMode = false;
let image;
let images = ["image.png", "image2.png", "image3.jpg", "image4.jpg"];
let imageIndex = 0;

function imageToggle(){
    imageMode = !imageMode;
    reset();
}
function cycleImage(){
    imageIndex += 1;
    imageIndex = imageIndex%images.length;
    console.log(imageIndex);

    img2 = new Image();
    img2.src = images[imageIndex];
    console.log(img2.src);
    img2.onload = function () {
        console.log("here");
        setup(img2);
        image = img2;
    };
}

function setViscosity(input) {
    //console.log(input);
    if (input * dt > 1.0) {
        viscosity = input;
    }  
}

function playPause() {
    paused = !paused;
}

function setdt(input) {
    //console.log(input);
    dt = input; 
}
function setMouseRadius(input) {
    //console.log(input);
    mouseEffectRadius = input; 
}
function setDiffSteps(input) {
    //console.log(input);
    diffusionSteps = input; 
}
function setPressureSteps(input) {
    //console.log(input);
    pressureSteps = input; 
}

function toggleViscosity(input) {
    useViscosity = !useViscosity;  
}

function reset() {
    /*gl.useProgram(fillProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[velocitySwapped % 2].fbo);
    gl.uniform4fv(fillProgram.uniforms.color, [0.0, 0.0, 0.0, 1.0]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    pressureInit = false;*/

    setup(image);
}


function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = canvas.height - (event.clientY - rect.top);
    return [x, y];
}

canvas.addEventListener('mousedown', function (e) {
    if(!paused) {
        mouseHeld = true;
        prevMousePos = getCursorPosition(canvas, e);
        force = null;
    }
    
    //console.log("x: " + prevMousePos[0] + " y: " + prevMousePos[1]);
})

canvas.addEventListener('mousemove', function (e) {
    if (!mouseHeld) {
        return;
    }
    mousePos = getCursorPosition(canvas, e);
    vMousePos = [2.0 * (mousePos[0] / canvas.width) - 1.0, 2.0 * (mousePos[1] / canvas.height) - 1.0];
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
const fillFromSourceFlipShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D source;

void main() {
  vec2 flipped = vec2(v_uv.x, 1.0 - v_uv.y);
  gl_FragColor = texture2D(source, flipped);
}`;

const fillFromSourceShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D source;

void main() {
  gl_FragColor = texture2D(source, v_uv);
}`;

const defaultVertexShaderStr = `
attribute vec2 aPosition;
varying vec2 v_uv;
varying vec2 v_pos;

void main() {
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


const fillColorShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec4 color1;
uniform vec4 color2;
uniform vec4 color3;

void main() {
    if(v_uv.x < 0.33) {
        gl_FragColor = color1;
    } else if(v_uv.x < 0.67) {
        gl_FragColor = color2;
    } else {
        gl_FragColor = color3;
    }
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
  p_uv = p_uv + vec2(-0.5,-0.5);
  vec2 weights = fract(p_uv);
  vec2 floored_uv = floor(p_uv) / c_size;
  vec4 a = texture2D(sam, floored_uv);
  vec4 b = texture2D(sam, floored_uv + vec2(1.0, 0.0) * t_size);
  vec4 c = texture2D(sam, floored_uv + vec2(0.0, 1.0) * t_size);
  vec4 d = texture2D(sam, floored_uv + vec2(1.0, 1.0) * t_size);
  return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main() {
  vec2 prev_uv = v_uv - dt * bilerp(velocity, v_uv).xy;
  vec4 advection = bilerp(velocity, prev_uv);
  gl_FragColor = advection;
}`;

const diffusionShaderStr = `
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
}`;

const divergenceShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform float dt;
uniform vec2 t_size;
uniform sampler2D velocity;

void main() {
  float l = texture2D(velocity, v_uv + vec2(-1.0, 0.0) * t_size).x;
  float r = texture2D(velocity, v_uv + vec2(1.0, 0.0) * t_size).x;
  float u = texture2D(velocity, v_uv + vec2(0.0, 1.0) * t_size).y;
  float d = texture2D(velocity, v_uv + vec2(0.0, -1.0) * t_size).y;

  float divergence = (r - l + u - d) / 2.0;
  gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}`;

const pressureCalcShaderStr = `
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
}`;

const pressureUpdateShaderStr = `
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
}`;

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
}`;

const colorShaderStr = `
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
}`;

const colorPrevShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 c_size;
uniform vec2 t_size;
uniform sampler2D velocity;
uniform sampler2D colors;
uniform float dt;

vec4 bilerp(sampler2D sam, vec2 uv) {
  vec2 p_uv = uv * c_size;
  p_uv = p_uv + vec2(-0.5,-0.5);
  vec2 weights = fract(p_uv);
  vec2 floored_uv = floor(p_uv) / c_size;
  vec4 a = texture2D(sam, floored_uv);
  vec4 b = texture2D(sam, floored_uv + vec2(1.0, 0.0) * t_size);
  vec4 c = texture2D(sam, floored_uv + vec2(0.0, 1.0) * t_size);
  vec4 d = texture2D(sam, floored_uv + vec2(1.0, 1.0) * t_size);
  return mix(mix(a, b, weights.x), mix(c, d, weights.x), weights.y);
}

void main() {
  vec2 prev_uv = v_uv - dt * texture2D(velocity, v_uv).xy;
  vec4 color;
  if(length(texture2D(velocity, v_uv).xy) < 0.0001) {
    color = texture2D(colors, prev_uv);
  } else {
    color = bilerp(colors, prev_uv);
  }
  gl_FragColor = color;
}`;

const velocityBoundaryShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 wall_size;
uniform sampler2D velocity;

void main() {
    if(v_uv.x < wall_size.x) {
        // Left wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.x) < wall_size.x) {
        // Right wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if(v_uv.y < wall_size.y) {
        // Floor
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.y) < wall_size.y) {
        // Ceiling
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = texture2D(velocity, v_uv);
    }
}`;

const zeroBoundaryShaderStr = `
precision highp float;

varying vec2 v_uv;

uniform vec2 wall_size;
uniform sampler2D velocity;

void main() {
    if(v_uv.x < wall_size.x) {
        // Left wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.x) < wall_size.x) {
        // Right wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if(v_uv.y < wall_size.y) {
        // Floor
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.y) < wall_size.y) {
        // Ceiling
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = texture2D(velocity, v_uv);
    }
}`;

let vertexShader = createShader(gl.VERTEX_SHADER, defaultVertexShaderStr);
let fillShader = createShader(gl.FRAGMENT_SHADER, fillShaderStr);
let fieldShader = createShader(gl.FRAGMENT_SHADER, mouseShaderStr);
let fillColorShader = createShader(gl.FRAGMENT_SHADER, fillColorShaderStr);
let advectionShader = createShader(gl.FRAGMENT_SHADER, advectionShaderStr);
let fillFromSourceShader = createShader(gl.FRAGMENT_SHADER, fillFromSourceShaderStr);
let fillFromSourceFlipShader = createShader(gl.FRAGMENT_SHADER, fillFromSourceFlipShaderStr);
let diffusionShader = createShader(gl.FRAGMENT_SHADER, diffusionShaderStr);
let divergenceShader = createShader(gl.FRAGMENT_SHADER, divergenceShaderStr);
let pressureCalcShader = createShader(gl.FRAGMENT_SHADER, pressureCalcShaderStr);
let pressureUpdateShader = createShader(gl.FRAGMENT_SHADER, pressureUpdateShaderStr);
let colorShader = createShader(gl.FRAGMENT_SHADER, colorShaderStr);
let colorPrevShader = createShader(gl.FRAGMENT_SHADER, colorPrevShaderStr);
let velocityBoundaryShader = createShader(gl.FRAGMENT_SHADER, velocityBoundaryShaderStr);
let zeroBoundaryShader = createShader(gl.FRAGMENT_SHADER, zeroBoundaryShaderStr);

function setup(image) {
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
    fillFromSourceProgram = new Program(vertexShader, fillFromSourceShader);
    fillFromSourceFlipProgram = new Program(vertexShader, fillFromSourceFlipShader);
    diffusionProgram = new Program(vertexShader, diffusionShader);
    divergenceProgram = new Program(vertexShader, divergenceShader);
    pressureProgram = new Program(vertexShader, pressureCalcShader);
    velocityProgram = new Program(vertexShader, pressureUpdateShader);
    fillColorProgram = new Program(vertexShader, fillColorShader);
    vBoundaryProgram = new Program(vertexShader, velocityBoundaryShader);
    zBoundaryProgram = new Program(vertexShader, zeroBoundaryShader);
    colorPrevProgram = new Program(vertexShader, colorPrevShader);

    divergenceFbo = new FBO(gl.FLOAT);
    colorFbos = [new FBO(gl.UNSIGNED_BYTE), new FBO(gl.UNSIGNED_BYTE)];
    velocityFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];
    diffusionFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];
    pressureFbos = [new FBO(gl.FLOAT), new FBO(gl.FLOAT)];

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /*gl.useProgram(fillColorProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbos[(colorSwapped) % 2].fbo);
    gl.uniform4fv(fillColorProgram.uniforms.color1, [0.5, 0.0, 0.0, 1.0]);
    gl.uniform4fv(fillColorProgram.uniforms.color2, [0.1, 0.4, 0.0, 1.0]);
    gl.uniform4fv(fillColorProgram.uniforms.color3, [0.1, 0.3, 0.7, 1.0]);
    gl.uniform2fv(fillColorProgram.uniforms.c_size, [canvas.width, canvas.height]);
    gl.uniform2fv(fillColorProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);*/
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.useProgram(fillFromSourceFlipProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbos[(colorSwapped) % 2].fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(fillFromSourceFlipProgram.uniforms.source, 0);
    gl.uniform2fv(fillFromSourceFlipProgram.uniforms.c_size, [canvas.width, canvas.height]);
    gl.uniform2fv(fillFromSourceFlipProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function enforceBoundaries(fbos, swapped) {
    // Bind Zero Boundary Program
    gl.useProgram(zBoundaryProgram.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[(swapped + 1) % 2].fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbos[swapped % 2].texture);
    gl.uniform1i(zBoundaryProgram.uniforms.grid, 0);
    gl.uniform2fv(zBoundaryProgram.uniforms.wall_size, [wall_size / canvas.width, wall_size / canvas.height]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    return !swapped;
}


function render() {
    //resizeCanvasToDisplaySize(canvas);
    // Clear the canvas

    if(!paused){
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
            gl.uniform2fv(fieldProgram.uniforms.v_mouse, vMousePos);
            gl.uniform1f(fieldProgram.uniforms.display_ratio, canvas.width / canvas.height);
            gl.uniform1f(fieldProgram.uniforms.v_radius, mouseEffectRadius / canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.viewport(0, 0, canvas.width, canvas.height);
            velocitySwapped = !velocitySwapped;
            velocitySwapped = enforceBoundaries(velocityFbos, velocitySwapped);
            prevMousePos = mousePos;
        }

        //start of advection

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
        velocitySwapped = enforceBoundaries(velocityFbos, velocitySwapped);

        //end of advection

        //start of diffusion

        if (useViscosity) {
            gl.useProgram(fillFromSourceProgram.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, diffusionFbos[diffusionSwapped % 2].fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
            gl.uniform1i(fillFromSourceProgram.uniforms.source, 0);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            for (let i = 0; i < diffusionSteps; i++) {
                // Bind Diffusion Calculation Program
                gl.useProgram(diffusionProgram.program);
                gl.bindFramebuffer(gl.FRAMEBUFFER, diffusionFbos[(diffusionSwapped + 1) % 2].fbo);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, diffusionFbos[diffusionSwapped % 2].texture);
                gl.uniform1i(diffusionProgram.uniforms.diffusion, 0);

                gl.activeTexture(gl.TEXTURE0 + 1);
                gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
                gl.uniform1i(diffusionProgram.uniforms.velocity, 1);

                gl.uniform2fv(diffusionProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
                gl.uniform1f(diffusionProgram.uniforms.dt, dt);
                gl.uniform1f(diffusionProgram.uniforms.viscosity, viscosity);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                gl.viewport(0, 0, canvas.width, canvas.height);
                diffusionSwapped = !diffusionSwapped;
                diffusionSwapped = enforceBoundaries(diffusionFbos, diffusionSwapped);
            }

            gl.useProgram(fillFromSourceProgram.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFbos[velocitySwapped % 2].fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, diffusionFbos[diffusionSwapped % 2].texture);
            gl.uniform1i(fillFromSourceProgram.uniforms.source, 0);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        //end of diffusion

        //start of pressure
        pressureSwapped = enforceBoundaries(pressureFbos, pressureSwapped);

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

        if (!pressureInit) {
            // Bind Fill Program to set initial pressure guess of 0 everywhere
            gl.useProgram(fillProgram.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, pressureFbos[pressureSwapped % 2].fbo);
            gl.uniform4fv(fillProgram.uniforms.color, [0.0, 0.0, 0.0, 1.0]);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            pressureInit = true;
        }

        // Run Jacobi's method to calculate pressure
        for (let i = 0; i < pressureSteps; i++) {
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
            pressureSwapped = enforceBoundaries(pressureFbos, pressureSwapped);
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
        gl.uniform2fv(velocityProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
        gl.uniform1f(velocityProgram.uniforms.dt, dt);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.viewport(0, 0, canvas.width, canvas.height);
        velocitySwapped = !velocitySwapped;
        velocitySwapped = enforceBoundaries(velocityFbos, velocitySwapped);

        //end of pressure
    
    // Bind Color Program
        if (!imageMode){
            gl.useProgram(colorProgram.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbos[(colorSwapped + 1) % 2].fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
            gl.uniform1i(colorProgram.uniforms.velocity, 0);
            gl.uniform2fv(colorProgram.uniforms.c_size, [canvas.width, canvas.height]);
            gl.uniform2fv(colorProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.viewport(0, 0, canvas.width, canvas.height);
            colorSwapped = !colorSwapped;
        }
        else{
            gl.useProgram(colorPrevProgram.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbos[(colorSwapped + 1) % 2].fbo);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocityFbos[velocitySwapped % 2].texture);
            gl.uniform1i(colorPrevProgram.uniforms.velocity, 0);
            gl.activeTexture(gl.TEXTURE0 + 1);
            gl.bindTexture(gl.TEXTURE_2D, colorFbos[colorSwapped % 2].texture);
            gl.uniform1i(colorPrevProgram.uniforms.colors, 1);
            gl.uniform2fv(colorPrevProgram.uniforms.c_size, [canvas.width, canvas.height]);
            gl.uniform2fv(colorPrevProgram.uniforms.t_size, [1.0 / canvas.width, 1.0 / canvas.height]);
            gl.uniform1f(colorPrevProgram.uniforms.dt, dt);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.viewport(0, 0, canvas.width, canvas.height);
            colorSwapped = !colorSwapped;
        }
    }

    // Display
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(render);
}

function main() {
    image = new Image();
    image.src = images[0];
    image.onload = function () {
        resizeCanvasToDisplaySize(canvas);
        setup(image);
        requestAnimationFrame(render);
    }
}

main();