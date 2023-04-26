let gl;
let myShader;
let velocity;
let mouseHeld = false
let mousePos = null;
let prevMousePos = null;
const width = 1280;
const height = 720;
const texelWidth = 1.0 / width;
const texelHeight = 1.0 / height;
const dt = 0.01;
const forceAmplifier = 3;
const forceOffset = 0.5;


function clamp(x, min, max) {
    return Math.max(min, Math.min(x, max));
}

function getMousePos(evt) {
    if (canvas != null) {
        var rect = document.getElementById("defaultCanvas0").getBoundingClientRect();
        x = clamp((evt.clientX - rect.left) / (rect.right - rect.left), 0.0, 1.0);
        y = clamp((evt.clientY - rect.top) / (rect.bottom - rect.top), 0.0, 1.0);
        prevMousePos = mousePos;
        mousePos = [x * 2.0 - 1.0, y * 2.0 - 1.0];
    }
}

document.addEventListener("mousedown", e => {
    mouseHeld = true;
    getMousePos(e);
})
document.addEventListener("mouseup", e => {
    mouseHeld = false
    mousePos = null;
    prevMousePos = null;
})
document.addEventListener("mousemove", e => {
    if (mouseHeld) {
        getMousePos(e);
    }
})



function preload() {
    // load each shader file (don"t worry, we will come back to these!)
    initialShader = loadShader("static/webgl/shader.vert", "static/webgl/initial.frag")
    fieldShader = loadShader("static/webgl/shader.vert", "static/webgl/mouse.frag");
    advectionShader = loadShader("static/webgl/shader.vert", "static/webgl/advection.frag");
    colorShader = loadShader("static/webgl/shader.vert", "static/webgl/color.frag");
}

function setup() {
    // the canvas has to be created with WEBGL mode
    canvas = createCanvas(width, height, WEBGL);
    gl = canvas.GL;
    var floatTextures = gl.getExtension("OES_texture_float");
    if (!floatTextures) {
        alert("no floating point texture support");
        return;
    }
    velocity = createGraphics(width, height, WEBGL);
    velocity.shader(initialShader);
    velocity.rect(0, 0, width, height);
    describe("Vector field for stable fluids")
}

function draw() {
    if (mouseHeld) {
        velocity.shader(fieldShader);
        fieldShader.setUniform("velocity", velocity);
        fieldShader.setUniform("v_mouse", mousePos);
        fieldShader.setUniform("force", getForce());
        velocity.rect(0, 0, width, height);
    }
    velocity.shader(advectionShader);
    advectionShader.setUniform("velocity", velocity);
    advectionShader.setUniform("c_size", [width, height]);
    advectionShader.setUniform("t_size", [texelWidth, texelHeight]);
    advectionShader.setUniform("dt", dt);
    velocity.rect(0, 0, width, height);

    shader(colorShader)
    colorShader.setUniform("velocity", velocity);
    colorShader.setUniform("c_size", [width, height]);
    colorShader.setUniform("t_size", [texelWidth, texelHeight]);
    rect(0, 0, width, height);
}

function getForce() {
    if(prevMousePos == null) {
        return [0.0, 0.0];
    }
    xForce = forceAmplifier * (mousePos[0] - prevMousePos[0]);
    yForce = forceAmplifier * (mousePos[1] - prevMousePos[1]);
    return [xForce, yForce];
}