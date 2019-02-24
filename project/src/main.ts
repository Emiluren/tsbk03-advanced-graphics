import treeVertexShader from './shader.vert'
import treeFragmentShader from './shader.frag'

import rayVertexShader from './ray.vert'
import rayFragmentShader from './ray.frag'

import sandFragmentShader from './sand.frag'

function shaderType(filename: string): GLenum {
    let typeMap = {
        "shader.vert": gl.VERTEX_SHADER,
        "shader.frag": gl.FRAGMENT_SHADER,
        "ray.vert": gl.VERTEX_SHADER,
        "ray.frag": gl.FRAGMENT_SHADER,
        "sand.frag": gl.FRAGMENT_SHADER
    };
    return typeMap[filename];
}

import mat4 from 'tsm/src/mat4'
import vec4 from 'tsm/src/vec4'
import vec3 from 'tsm/src/vec3'

enum Shapes {
    Conical,
    Spherical,
    Hemispherical,
    Cylindrical,
    TaperedCylindrical,
    Flame,
    InverseConical,
    TendFlame
}

// All constants that are arrays below have their elements affect branches at
// a level corresponding to the index of the element in question

// Number of segments per branch. Keep low if using high SEG_SPLIT as the number of segments will grow exponentially.
let CURVE_RES = [6];
// Decides curvature type of branches.
// 0: Curves upward, !0: S-curve Quite buggy
let CURVE_BACK = [0];

// Controls magnitude of x-axis curvature in branches
let CURVE = [Math.PI / 3];

// Controls magnitude of y-axis curvature in branches
let CURVE_V = [Math.PI / 4];

// Controls amount of clones created each segment.
let SEG_SPLIT = [0.5];
// Controls how much new clones will rotate away from their parents.
let SPLIT_ANGLE = [Math.PI * 0.6];
// Controls lenght of branches
let LENGTH = [0.8];

// Defines shapeRatio mode, see function.
let SHAPE: Shapes = Shapes.Cylindrical;

// Decides radius of the tree along the base, which also has an effect on the
// overall height of the tree.
let BASE_SIZE = 1;

// Decides overall size of the whole tree.
let SCALE = 0.6;

// Controls thickness of branches somehow TODO: improve comment.
let RATIO = 0.2;
let RATIO_POWER = 1;

// Controls amount of tapering of branch thickness [0, 3].
let TAPER = [1.5];

var canvas : HTMLCanvasElement, gl;

var tree;
var treeShader, rayShader, sandShader;
var randomTexture;
var treeMesh, sandMesh;

let leftPressed = false;
let rightPressed = false;
let upPressed = false;
let downPressed = false;

function handleKeyEvent(keyCode: string, newState: boolean) {
    switch (keyCode) {
        case "KeyA":
        case "ArrowLeft":
            leftPressed = newState;
            break;
        case "KeyD":
        case "ArrowRight":
            rightPressed = newState;
            break;
        case "KeyW":
        case "ArrowUp":
            upPressed = newState;
            break;
        case "KeyS":
        case "ArrowDown":
            downPressed = newState;
            break;
    }
}

window.addEventListener('keydown', (event) => {
    handleKeyEvent(event.code, true);
    event.preventDefault();
}, true);

window.addEventListener('keyup', (event) => {
    handleKeyEvent(event.code, false);
    event.preventDefault();
}, true);

interface Resource {
    filename: string;
    contents: string;
}

interface Branch {
    endPoint: vec3;
    children: Branch[];
}

interface Segment {
    level: number
    radius: number
    position: vec3
    children: Segment[]
    transform: mat4
}

let cameraPositionAngle = 0;
let cameraPositionRadius = 5;
let y = 3;

const CAMERA_FOV = 45;
let cameraTarget = new vec3([0, 2, 0]);

function cameraPosition(): vec3 {
    let camPosX = Math.sin(cameraPositionAngle) * cameraPositionRadius;
    let camPosZ = Math.cos(cameraPositionAngle) * cameraPositionRadius;
    return new vec3([camPosX, y, camPosZ]);
}

// Debug drawing for raycasts
function drawRays(proj: mat4) {
    let vertexData = new Float32Array(
        raycasts.flatMap(
            ray =>
                // Make a small + to mark the start point
                [ray.point.x + 0.1, ray.point.y, ray.point.z,
                 ray.point.x - 0.1, ray.point.y, ray.point.z,
                 ray.point.x, ray.point.y, ray.point.z + 0.1,
                 ray.point.x, ray.point.y, ray.point.z - 0.1,

                 ray.point.x, ray.point.y, ray.point.z,
                 ray.point.x + ray.dir.x,
                 ray.point.y + ray.dir.y,
                 ray.point.z + ray.dir.z]
        )
    );
    gl.useProgram(rayShader.id);

    // For the ray debug draw we make a new buffer each frame because
    // its not supposed to be used in ordinary cases.
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

    let posLocation = gl.getAttribLocation(rayShader.id, "a_position");
    gl.enableVertexAttribArray(posLocation);

    gl.uniformMatrix4fv(rayShader.uniformLocations["mvp"], false, proj.all());

    gl.vertexAttribPointer(posLocation, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, vertexData.length / 3);
}

let lastRenderTime = 0;
function render(time: number): void {
    let dt = Math.min((time - lastRenderTime) / 1000, 1 / 30);
    lastRenderTime = time;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    let proj = mat4.perspective(CAMERA_FOV, canvas.width / canvas.height, 0.1, 100);

    let angularVelocity = 0;
    if (leftPressed) {
        angularVelocity -= 2;
    }
    if (rightPressed) {
        angularVelocity += 2;
    }
    cameraPositionAngle += angularVelocity * dt;

    let vy = 0;
    if (upPressed) {
        vy += 10;
    }
    if (downPressed) {
        vy -= 10;
    }
    y += vy * dt;

    let camPosX = Math.sin(cameraPositionAngle) * cameraPositionRadius;
    let camPosZ = Math.cos(cameraPositionAngle) * cameraPositionRadius;

    let viewMatrix = mat4.lookAt(cameraPosition(), cameraTarget, new vec3([0, 1, 0]));
    proj.multiply(viewMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(treeShader.id);
    gl.bindVertexArray(treeMesh.vao);
    gl.uniformMatrix4fv(treeShader.uniformLocations["world"], false, mat4.identity.all());
    gl.uniformMatrix4fv(treeShader.uniformLocations["mvp"], false, proj.all());

    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, randomTexture);
    // gl.uniform1i(textureLocation, 0);

    gl.drawElements(gl.TRIANGLES, treeMesh.indexAmount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.useProgram(sandShader.id);
    gl.bindVertexArray(sandMesh.vao)
    gl.uniformMatrix4fv(sandShader.uniformLocations["world"], false, mat4.identity.all());
    gl.uniformMatrix4fv(sandShader.uniformLocations["mvp"], false, proj.all());
    gl.drawElements(gl.TRIANGLES, sandMesh.indexAmount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    if (raycasts.length > 0) {
        drawRays(proj);
    }

    requestAnimationFrame(render);
}

interface BranchVertexData {
    position: vec3;
    normal: vec3;
}

interface BranchMeshPart {
    vertices: BranchVertexData[];
    indices: Uint16Array;
}

let branchSideIndices = [0, 1, 2, 1, 2, 3];
let BRANCH_RESOLUTION = 8; // Number of vertices on each side of a branch
let BRANCH_INDEX_AMOUNT = branchSideIndices.length * BRANCH_RESOLUTION;
let BRANCH_VERTEX_AMOUNT = BRANCH_RESOLUTION * 2; // Two ends on each branch

function generateBranchData(startSegment: Segment, endSegment: Segment): BranchMeshPart {
    let meshPart = {
        vertices: new Array<BranchVertexData>(BRANCH_VERTEX_AMOUNT),
        indices: new Uint16Array(BRANCH_INDEX_AMOUNT)
    };

    let startSegmentCenterPosition = startSegment.transform.multiplyVec3(new vec3([0, 0, 0]))
    let endCenterPosition = endSegment.transform.multiplyVec3(new vec3([0, 0, 0]))

    for (let i = 0; i < BRANCH_RESOLUTION; i++) {
        let angle = i / BRANCH_RESOLUTION * (2 * Math.PI);
        let x = Math.cos(angle);
        let z = Math.sin(angle);
        let startEdgePos = startSegment.transform.multiplyVec3(
            new vec3([x, 0, z]).scale(startSegment.radius)
        );
        let endEdgePos = endSegment.transform.multiplyVec3(
            new vec3([x, 0, z]).scale(endSegment.radius)
        );

        meshPart.vertices[i * 2] = {
            position: startEdgePos,
            normal: new vec3(startEdgePos.xyz).subtract(startSegmentCenterPosition)
        };

        meshPart.vertices[i * 2 + 1] = {
            position: endEdgePos,
            normal: new vec3(endEdgePos.xyz).subtract(endCenterPosition)
        };

        meshPart.indices.set(
            branchSideIndices.map(b => (b + i * 2) % 16),
            i * branchSideIndices.length
        );
    }

    return meshPart;
}

function generateAllMeshParts(seg: Segment): BranchMeshPart[] {
    let parts = [];
    for(let child of seg.children){
        parts.push(generateBranchData(seg, child));
        parts = parts.concat(generateAllMeshParts(child));
    }
    return parts;
}

interface ShaderProgram {
    id: WebGLProgram;
    uniformLocations: {[key: string]: WebGLUniformLocation};
}

interface Mesh {
    vao: WebGLVertexArrayObject;
    indexAmount: number;
}

let DATA_PER_VERTEX = 6; // x, y and z coords for both position and normal

function createMesh(vertexData: Float32Array, indices: Uint16Array, shaderId: WebGLProgram) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    let posLocation = gl.getAttribLocation(shaderId, "a_position");
    let normLocation = gl.getAttribLocation(shaderId, "a_normal");
    gl.enableVertexAttribArray(posLocation);
    gl.enableVertexAttribArray(normLocation);

    // Normals come after positions in the array
    let size = 3, normalize = false, stride = DATA_PER_VERTEX * 4;
    gl.vertexAttribPointer(posLocation, size, gl.FLOAT, normalize, stride, 0);
    gl.vertexAttribPointer(normLocation, size, gl.FLOAT, normalize, stride, 12);

    // Buffer indices
    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {vao: vao, indexAmount: indices.length };
}

function createTreeMesh(seg: Segment): Mesh {
    let meshParts = generateAllMeshParts(seg);

    let branchAmount = meshParts.length;
    let VERTEX_ARRAY_SIZE = BRANCH_VERTEX_AMOUNT * branchAmount * DATA_PER_VERTEX;
    let numIndices = BRANCH_INDEX_AMOUNT * branchAmount;

    let vertexData = new Float32Array(VERTEX_ARRAY_SIZE);
    let indices = new Uint16Array(numIndices);

    // Indices need to be offset based on their position in the final array
    for (let i = 0; i < meshParts.length; i++) {
        let indexIndex = i * BRANCH_INDEX_AMOUNT;
        let vertexIndex = i * BRANCH_VERTEX_AMOUNT;
        let part = meshParts[i];
        indices.set(
            part.indices.map(ind => ind + vertexIndex), indexIndex
        );

        for (let j = 0; j < part.vertices.length; j++) {
            let vertex = part.vertices[j];
            let thisData = vertex.position.xyz.concat(vertex.normal.xyz);
            vertexData.set(thisData, (vertexIndex + j) * DATA_PER_VERTEX);
        }
    }

    return createMesh(vertexData, indices, treeShader.id);
}

// Create the upper half of a sphere as ground
function createSandMesh(): Mesh {
    let VERTEX_RING_AMOUNT = 32;
    let numRings = 5;
    let numVertices = 1 + VERTEX_RING_AMOUNT * numRings;
    let VERTEX_ARRAY_SIZE = numVertices * DATA_PER_VERTEX;
    let GROUND_RADIUS = 5

    let indicesInFirstRing = VERTEX_RING_AMOUNT * 3;
    let indicesInOtherRings = VERTEX_RING_AMOUNT * 6;
    let numIndices = indicesInFirstRing +
        indicesInOtherRings * (numRings - 1);

    let vertexData = new Float32Array(VERTEX_ARRAY_SIZE);
    let indices = new Uint16Array(numIndices);

    vertexData.set([0, 0, 0], 0);
    vertexData.set([0, 1, 0], 3);

    // Create vertices for all rings
    for (let ring_i = 0; ring_i < numRings; ring_i++) {
        for (let i = 0; i < VERTEX_RING_AMOUNT; i++) {
            let tiltAngle = Math.PI / (numRings * 2) * (ring_i + 1);
            let planeAngle = 2 * Math.PI / VERTEX_RING_AMOUNT * i;
            let x = Math.cos(planeAngle) * Math.sin(tiltAngle);
            let y = Math.cos(tiltAngle);
            let z = Math.sin(planeAngle) * Math.sin(tiltAngle);

            vertexData.set(
                [GROUND_RADIUS * x, -GROUND_RADIUS * (1 - y), GROUND_RADIUS * z,
                 x, y, z],
                (1 + i + VERTEX_RING_AMOUNT * ring_i) * DATA_PER_VERTEX
            );
        }
    }

    // Create triangles for inner ring
    for (let i = 0; i < VERTEX_RING_AMOUNT; i++) {
        let endIndex = i == VERTEX_RING_AMOUNT - 1 ? 1 : i + 2;
        indices.set([0, i + 1, endIndex], i * 3);
    }

    // Create triangles for other rings
    for (let ring_i = 0; ring_i < numRings - 1; ring_i++) {
        for (let i = 0; i < VERTEX_RING_AMOUNT; i++) {
            let ringStartIndex1 = 1 + ring_i * VERTEX_RING_AMOUNT;

            // Two indices each on two consecutive rings
            let startIndex1 = ringStartIndex1 + i;
            let endIndex1 = i == VERTEX_RING_AMOUNT - 1 ?
                ringStartIndex1 : startIndex1 + 1;

            let startIndex2 = startIndex1 + VERTEX_RING_AMOUNT;
            let endIndex2 = endIndex1 + VERTEX_RING_AMOUNT;

            let indexOffset =
                indicesInFirstRing + indicesInOtherRings * ring_i + i * 6;
            indices.set([startIndex1, startIndex2, endIndex1], indexOffset);
            indices.set([startIndex2, endIndex2, endIndex1], indexOffset + 3);
        }
    }

    return createMesh(vertexData, indices, sandShader.id);
}

// Based on http://geomalgorithms.com/a07-_distance.html
function rayIntersectsCylinder(cylStart: vec3, cylEnd: vec3, startThickness: number, endThickness: number, rayPoint: vec3, rayDir: vec3): boolean {
    let cylDir = vec3.difference(cylEnd, cylStart);
    let w = vec3.difference(cylStart, rayPoint);

    let a = vec3.dot(cylDir, cylDir); // always >= 0
    let b = vec3.dot(cylDir, rayDir);
    let c = vec3.dot(rayDir, rayDir); // always >= 0
    let d = vec3.dot(cylDir, w);
    let e = vec3.dot(rayDir, w);
    let D = a*c - b*b; // always >= 0

    let cylClosest, rayClosest;
    // compute the line parameters of the two closest points
    if (D < 0.001) {          // the lines are almost parallel
        cylClosest = 0.0;
        rayClosest = (b>c ? d/b : e/c);    // use the largest denominator
    }
    else {
        cylClosest = (b*e - c*d) / D;
        rayClosest = (a*e - b*d) / D;
    }

    // If the closest point is outside the cylinder there is no collision
    // There is also no collision if the point is behind the camera
    if (cylClosest < 0 || cylClosest > 1 || rayClosest < 0) {
        return false;
    }

    let cylClosestPoint = cylDir.copy().scale(cylClosest).add(cylStart);
    let rayClosestPoint = rayDir.copy().scale(rayClosest).add(rayPoint);

    // get the difference of the two closest points
    let separation = cylClosestPoint.copy().subtract(rayClosestPoint);  // =  L1(sc) - L2(tc)

    let thicknessAtClosest = endThickness * cylClosest + startThickness * (1 - cylClosest);
    return separation.length() <= thicknessAtClosest;
}

function cutTree(seg: Segment, rayPos: vec3, rayDir: vec3): boolean {
    for(let child of seg.children) {
        let start = seg.transform.multiplyVec3(new vec3([0, 0, 0]));
        let end = child.transform.multiplyVec3(new vec3([0, 0, 0]));

        if (rayIntersectsCylinder(start, end, seg.radius, child.radius, rayPos, rayDir)) {
            seg.children.splice(seg.children.indexOf(child), 1);
            return true;
        }

        if (cutTree(child, rayPos, rayDir)) {
            return true;
        }
    }

    return false;
}

/**
 * Compiles a shader to be used in a GPU program.
 * @param {number} type - The type of shader. gl.VERTEX_SHADER/gl.FRAGMENT_SHADER/etc
 * @param {string} source - The shader source code.
 * @returns {WebGLShader} The OpenGL shader id of the compiled shader
 */
function createShader(type: number, source: string): WebGLShader {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Log an error if the compilation fails
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

    if (success) {
        return shader;
    } else {
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
}

function createProgram(shaderSources: Resource[], uniforms: string[]): ShaderProgram {
    let programId = gl.createProgram();
    for (let shaderData of shaderSources) {
        let shader = createShader(
            shaderType(shaderData.filename),
            shaderData.contents
        );
        gl.attachShader(programId, shader);
    }
    gl.linkProgram(programId);

    // Log an error if the compilation failed
    let success = gl.getProgramParameter(programId, gl.LINK_STATUS);
    if (success) {
        let program = { id: programId, uniformLocations: {} };
        for (let uniformName of uniforms) {
            program.uniformLocations[uniformName] =
                gl.getUniformLocation(programId, uniformName);
        }
        return program;
    } else {
        console.log(gl.getProgramInfoLog(programId));
        gl.deleteProgram(programId);
        return null;
    }
}

function loadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                      srcFormat, srcType, image);

        gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;

    return texture;
}

// This is only used for debugging
let raycasts = [];

function onLoad(): void {
    canvas = document.querySelector("#glCanvas");
    gl = canvas.getContext("webgl2");

    if (gl === null) {
        alert("Unable to initialize WebGL");
        return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clearColor(0.7, 0.7, 1.0, 1.0);
    treeShader = createProgram([
        { filename: "shader.vert", contents: treeVertexShader },
        { filename: "shader.frag", contents: treeFragmentShader }
    ], ["mvp", "world"]);

    rayShader = createProgram([
        { filename: "ray.vert", contents: rayVertexShader },
        { filename: "ray.frag", contents: rayFragmentShader }
    ], ["mvp"]);

    sandShader = createProgram([
        { filename: "shader.vert", contents: treeVertexShader },
        { filename: "sand.frag", contents: sandFragmentShader }
    ], ["mvp", "world"]);

    tree = generateTree();
    treeMesh = createTreeMesh(tree);

    sandMesh = createSandMesh();

    canvas.addEventListener('click', (event) => {
        let camPos = cameraPosition()

        let x = 2 * event.clientX / canvas.width - 1;
        let y = 1 - 2 * event.clientY / canvas.height;
        let rayClip = new vec4([x, y, -1, 1]);

        let proj = mat4.perspective(CAMERA_FOV, canvas.width / canvas.height, 0.1, 100);
        proj.inverse();
        let rayEye = proj.multiplyVec4(rayClip);
        rayEye.z = -1;
        rayEye.w = 0;

        let viewMatrix = mat4.lookAt(camPos, cameraTarget, new vec3([0, 1, 0]));
        viewMatrix.inverse()
        let rayWorld = new vec3(viewMatrix.multiplyVec4(rayEye).xyz);
        rayWorld.normalize();
        rayWorld.scale(10);

        if (cutTree(tree, camPos, rayWorld)) {
            treeMesh = createTreeMesh(tree);
        }
    }, false);

    requestAnimationFrame(render);
}

// ShapeRatio function as defined by Penn and Weber, essentially controls
// length of branches, which ends up controlling the overall shape of the foiliage
function shapeRatio(shape: Shapes, ratio: number){
    switch(shape){
        case Shapes.Conical:
            return 0.2 + 0.8 * ratio;
        case Shapes.Spherical:
            return 0.2 + 0.8 * Math.sin(Math.PI * ratio);
        case Shapes.Hemispherical:
        return 0.2 + 0.8 * Math.sin(0.5 * Math.PI * ratio);
        case Shapes.Cylindrical:
            return 1;
        case Shapes.TaperedCylindrical:
            return 0.5 + 0.5 * ratio;
        case Shapes.Flame:
            if (ratio <= 0.7) return ratio / 0.7;
            return (1 - ratio) / 0.3;
        case Shapes.InverseConical:
            return 1 - 0.8 * ratio;
        case Shapes.TendFlame:
            if (ratio <= 0.7) return 0.5 + 0.5 * ratio / 0.7
            return 0.5 + 0.5 * (1 - ratio) / 0.3
        default:
            return 1
    }
}

// Generate a new branch starting in position start.
// level: number of parents for this branch
// startSegment: If this branch has been split, this should state which number on the branch the next segment will be
// parentLength: length of the branch parenting this one, zero for trunk.
// childOffset: how far along the parent branch this one starts, zero for trunk.
function generateBranch(level: number, startSegment: number, start: Segment, parentLength: number, childOffset: number, parentTransform: mat4): Segment{
    let splitError: number = 0.0;
    let effectiveSplit: number = 0;

    let branchLength: number;
    if (level == 0) {
        //Stem length
        branchLength = LENGTH[0]
    } else if (level == 1) {
        //First level branches
        branchLength = parentLength * (LENGTH[1]) * shapeRatio(SHAPE, (parentLength - childOffset) / (parentLength - BASE_SIZE * (SCALE)))
    } else {
        branchLength = (LENGTH[level]) * (parentLength - 0.6 * childOffset)
    }
    //Length between each segment in a branch
    let segmentOffset: number = branchLength / (CURVE_RES[level] - 1)

    let branchRadius: number;
    if(level == 0){
        branchRadius = branchLength * RATIO * SCALE;
    } else {
        //TODO: set branchRadius for non-trunk branches.
    }
    let unitTaper: number;
    if(0 <= TAPER[level] && TAPER[level] < 1){
        unitTaper = TAPER[level];
    } else if(1 <= TAPER[level] && TAPER[level] < 2){
        unitTaper = 2 - TAPER[level];
    } else {
        unitTaper = 0;
    }

    let current: Segment = start;
    let currentTransform: mat4 = parentTransform;
    let localTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, segmentOffset, 0]));
    let localRot: mat4;
    let localRotEnd: mat4;
    let localRotX: mat4;
    let localRotXEnd: mat4; //Angle end half of segments should rotate in S-branches.
    let localRotY: mat4 = new mat4().setIdentity().rotate(CURVE_V[level] / CURVE_RES[level], new vec3([0, 1, 0]));

    let localTransform: mat4;
    let localTransformEnd: mat4; //For the end of S-branches;

    if(CURVE_BACK[level] == 0){
        //Rotate along x axis
        localRotX = new mat4().setIdentity().rotate(CURVE[level] / CURVE_RES[level], new vec3([1, 0, 0]));
        localRot = localRotY.multiply(localRotX)
        localTransform = localRot.multiply(localTranslation);
    } else {
        //S-shaped branch.
        //Rotate first halv of the branches' segments one way, and the other
        //half the other other way
        let sCurveStart: number = CURVE[level] / (CURVE_RES[level] / 2);
        let sCurveEnd: number = CURVE_BACK[level] / (CURVE_RES[level] / 2);
        //Calculate the different rotation matrices for the S-branch rotations.
        localRotX = new mat4().setIdentity().rotate(sCurveStart, new vec3([1, 0, 0]));
        localRotXEnd = new mat4().setIdentity().rotate(-sCurveEnd, new vec3([1, 0, 0]));
        localRot = localRotY.copy().multiply(localRotX);
        localRotEnd = localRotY.multiply(localRotXEnd);
        //Create the total transformations for the different parts of the S-branch.
        localTransform = localRot.multiply(localTranslation);
        localTransformEnd = localRotEnd.multiply(localTranslation);
    }

    for(let i = startSegment; i <= CURVE_RES[level]; ++i){
        let seg: Segment = {
            level: 0,
            radius: 0,
            position: new vec3([0, 0, 0]),
            children: [],
            transform: new mat4()
        }

        seg.radius = branchRadius * (1 - unitTaper * i/CURVE_RES[level]);

        //Select the current transform for creating the S-shape branch.
        if(CURVE_BACK[level] == 0 || i < CURVE_RES[level] / 2){
            currentTransform = localTransform.multiply(currentTransform);
        } else {
            currentTransform = localTransformEnd.multiply(currentTransform);
        }
        seg.position = currentTransform.multiplyVec3(seg.position);
        seg.transform = currentTransform;
        current.children.push(seg);

        //Split and clone the branch.
        effectiveSplit = Math.floor(SEG_SPLIT[level] + splitError); //Floyd-Steinberg Error Diffusion.

        if(effectiveSplit >= 1){
            //Split the branch into effectiveSplit + 1 clones. Each clone is
            //generated as a new branch, meaning the current loop should break.
            let declination = seg.position.length ? Math.PI - Math.atan(seg.position.y / seg.position.length()) : 0;
            let angleSplit: number = SPLIT_ANGLE[level] - declination;
            let cloneTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, segmentOffset, 0]));
            let cloneRotX: mat4 = new mat4().setIdentity().rotate(angleSplit, new vec3([1, 0, 0]));

            for(let j: number = 0; j <= effectiveSplit + 1; ++j){
                let cloneAngle = (20 + 0.75 * (30 + Math.abs(declination - 90)) * Math.random()**2) * (Math.round(Math.random()) ? -1 : 1);
                let cloneRotY: mat4 = new mat4().setIdentity().rotate(Math.PI * cloneAngle / 180, new vec3([0, 1, 0]));
                let clone: Segment = {
                    level: level,
                    radius: 0,
                    position : new vec3([0, 0, 0]),
                    children: [],
                    transform: new mat4()
                };
                clone.radius = branchRadius * (1 - unitTaper * (i/CURVE_RES[level]));
                let cloneRot: mat4 = cloneRotY.multiply(cloneRotX);
                let cloneTransform: mat4 = cloneRot.multiply(cloneTranslation).multiply(currentTransform);
                clone.position = cloneTransform.multiplyVec3(clone.position);
                clone.transform = cloneTransform;
                seg.children.push(clone);
                generateBranch(level, i + 1, clone, branchLength, segmentOffset * i, cloneTransform);
            }
            break;
        } else {
            //No splitting, keep generating a singular branch.
            splitError -= effectiveSplit - SEG_SPLIT[level];
            current = seg;
        }
    }
    return start;
}

function generateTree(): Segment {
    let root: Segment = {
        level: 0,
        radius: LENGTH[0] * RATIO * SCALE,
        position: new vec3([0, 0, 0]),
        children: [],
        transform: new mat4().setIdentity()
    };
    return generateBranch(0, 0, root, 0, 0, new mat4().setIdentity());
}

window.onload = () => onLoad();
