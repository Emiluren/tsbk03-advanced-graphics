import genericVertexShader from './shader.vert'

import treeFragmentShader from './tree.frag'
import sandFragmentShader from './sand.frag'
import waterFragmentShader from './water.frag'

import leafVertexShader from './leaf.vert'
import leafFragmentShader from './leaf.frag'

import rayVertexShader from './ray.vert'
import rayFragmentShader from './ray.frag'

import vec4 from 'tsm/src/vec4'
import vec3 from 'tsm/src/vec3'
import mat4 from 'tsm/src/mat4'
import quat from 'tsm/src/quat'

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
let CURVE_RES = [6, 0, 0];

// Controls magnitude of x-axis curvature in branches
let CURVE = [Math.PI / 3, Math.PI / 0.05, Math.PI / 14];
// Controls magnitude of y-axis curvature in branches
let CURVE_V = [Math.PI / 3, Math.PI / 1.5, Math.PI / 3];

// Controls amount of clones created each segment.
let SEG_SPLIT = [0.35, 0.4, 9999999];
// Controls how much new clones will rotate away from their parents.
let SPLIT_ANGLE = [Math.PI / 3, Math.PI / 2, Math.PI / 43];

// Controls lenght of branches
let LENGTH = [4, 0.5, 1];
// Defines shapeRatio mode, see function.
let SHAPE: Shapes = Shapes.Cylindrical;

// Decides radius of the tree along the base, which also has an effect on the
// overall height of the tree.
let BASE_SIZE = 1;
// Decides overall size of the whole tree.
let SCALE = 0.6;

// Controls thickness of branches somehow TODO: improve comment.
let RATIO = 0.1;
let RATIO_POWER = 1;
// Controls amount of tapering of branch thickness [0, 3].
let TAPER = [1, 1, 0.1];

//Sub-Branch variables, these are not implemented, set BRANCHES to a non-zero value at your own risk!//
//Controls number of child branches for each leves, values above 10 give very weird results.
let BRANCHES = [0, 0, 0];
//The distance any branch will stretch before any branches begin shootinf off of it.
let CHILD_OFFSET = 1.5;
//Angle with wich child branches will rotate away from their parents y-axis around their x-axis.
let CHILD_ANGLE_X = [Math.PI / 0.1, Math.PI / 0.1, Math.PI / 5];
//Child branches are rotated in a helical pattern around their parent.
//This value decides how much more each new branch rotates than the last.
let CHILD_ANGLE_Y = [Math.PI / 13, Math.PI / 14, 0];

//Controls number of leaves per segment-pair. Grows exponentially with SEG_SPLIT, use with caution.
let LEAVES = 10;
let LEAF_ANGLE = Math.PI / 0.3; //Leaf rotation around y-axis

let ZERO_VECTOR = new vec3([0, 0, 0]);
let UP_VECTOR = new vec3([0, 1, 0]);
let RIGHT_VECTOR: vec3 = new vec3([1, 0, 0]);

var canvas : HTMLCanvasElement, gl;

var tree;
var treeShader, rayShader, sandShader, waterShader, leafShader;
var randomTexture;
var treeMesh, sandMesh, waterMesh, leafMesh;

let leftPressed = false;
let rightPressed = false;
let upPressed = false;
let downPressed = false;

let lightLeftPressed = false;
let lightRightPressed = false;
let lightUpPressed = false;
let lightDownPressed = false;

// Returns true if the event was handled and false if not
function handleKeyEvent(keyCode: string, newState: boolean): boolean {
    switch (keyCode) {
        case "KeyA":
        case "ArrowLeft":
            leftPressed = newState;
            return true;
            break;
        case "KeyD":
        case "ArrowRight":
            rightPressed = newState;
            return true;
            break;
        case "KeyW":
        case "ArrowUp":
            upPressed = newState;
            return true;
            break;
        case "KeyS":
        case "ArrowDown":
            downPressed = newState;
            return true;
            break;

        case "KeyJ":
            lightLeftPressed = newState;
            return true;
            break;
        case "KeyL":
            lightRightPressed = newState;
            return true;
            break;
        case "KeyI":
            lightUpPressed = newState;
            return true;
            break;
        case "KeyK":
            lightDownPressed = newState;
            return true;
            break;
    }
    return false;
}

window.addEventListener('keydown', (event) => {
    if (handleKeyEvent(event.code, true)) {
        event.preventDefault();
    }
}, true);

window.addEventListener('keyup', (event) => {
    if (handleKeyEvent(event.code, false)) {
        event.preventDefault();
    }
}, true);

interface ShaderSource {
    shaderType: GLenum;
    contents: string;
}

interface BranchData {
    //Used to evenly distribute what segments are used for branch splitting.
    splitError: number
    //essentially the number of parents above this branch.
    level: number
    childBranches: number
    branchLength: number
    //Length between each segment in the branch.
    segmentOffset: number
    //Overall thickness of the segments in the branch.
    branchRadius: number
    //How thickness of the branch changes over its length
    unitTaper: number
    //Angles controlling curvature of the branch.
    angle: number
    angleBack: number
}

interface Segment {
    radius: number
    children: Segment[]
    leaves: Leaf[]
    transform: mat4
    rot: quat
}

interface Leaf {
    transform: mat4
}

let cameraPositionAngle = 0;
let cameraPositionRadius = 10;
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

function drawMesh(mesh: Mesh, shader: ShaderProgram, worldMatrix: mat4, mvpMatrix: mat4): void {
    gl.useProgram(shader.id);
    gl.bindVertexArray(mesh.vao);
    gl.uniformMatrix4fv(shader.uniformLocations["world"], false, worldMatrix.all());
    gl.uniformMatrix4fv(shader.uniformLocations["mvp"], false, mvpMatrix.all());
    gl.drawElements(gl.TRIANGLES, mesh.indexAmount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
}

let lightHeight = Math.PI / 4;
let lightAngle = Math.PI / 4;

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

    let lightHeightVelocity = 0;
    if (lightDownPressed) {
        lightHeightVelocity -= 2;
    }
    if (lightUpPressed) {
        lightHeightVelocity += 2;
    }
    lightHeight += lightHeightVelocity * dt;
    lightHeight = Math.max(Math.min(lightHeight, Math.PI / 2), 0);

    let lightAngleVelocity = 0;
    if (lightLeftPressed) {
        lightAngleVelocity -= 2;
    }
    if (lightRightPressed) {
        lightAngleVelocity += 2;
    }
    lightAngle += lightAngleVelocity * dt;

    let lightdir =
        new mat4().setIdentity().rotate(
            lightHeight, new vec3([-1, 0, 0])
        ).rotate(
            lightAngle, new vec3([0, 1, 0])
        ).multiplyVec3(new vec3([0, 0, 1]));

    let viewMatrix = mat4.lookAt(cameraPosition(), cameraTarget, new vec3([0, 1, 0]));
    proj.multiply(viewMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(treeShader.id);
    gl.uniform3fv(treeShader.uniformLocations["lightdir"], lightdir.xyz);
    drawMesh(treeMesh, treeShader, mat4.identity, proj);

    gl.useProgram(sandShader.id);
    gl.uniform3fv(sandShader.uniformLocations["lightdir"], lightdir.xyz);
    drawMesh(sandMesh, sandShader, mat4.identity, proj);

    gl.useProgram(leafShader.id);
    gl.uniform3fv(leafShader.uniformLocations["lightdir"], lightdir.xyz);
    drawMesh(leafMesh, leafShader, mat4.identity, proj);

    drawMesh(waterMesh, waterShader, mat4.identity, proj);

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
    indices: number[];
}

let BRANCH_RESOLUTION = 8; // Number of vertices on each side of a branch
let BRANCH_INDEX_AMOUNT = 6 * BRANCH_RESOLUTION;

function generateBranchVertices(seg: Segment): BranchVertexData[] {
    let vertices = new Array<BranchVertexData>(BRANCH_RESOLUTION);
    let centerPosition = seg.transform.multiplyVec3(ZERO_VECTOR);

    for (let i = 0; i < BRANCH_RESOLUTION; i++) {
        let angle = i / BRANCH_RESOLUTION * (2 * Math.PI);
        let x = Math.cos(angle);
        let z = Math.sin(angle);
        let edgePos = seg.transform.multiplyVec3(
            new vec3([x, 0, z]).scale(seg.radius)
        );

        vertices[i] = {
            position: edgePos,
            normal: new vec3(edgePos.xyz).subtract(centerPosition)
        };
    }

    return vertices;
}

function generateAllMeshParts(seg: Segment, startIndex: number): BranchMeshPart {
    let vertices = generateBranchVertices(seg);
    let indices = new Array<number>();

    let childIndex = startIndex + vertices.length;
    for (let child of seg.children) {
        vertices = vertices.concat(generateBranchVertices(child));
        for (let i = 0; i < BRANCH_RESOLUTION; i++) {
            let si = startIndex + i;
            let ci = childIndex + i;

            if (i == BRANCH_RESOLUTION - 1) {
                indices = indices.concat(
                    [si, ci, startIndex,
                     ci, startIndex, childIndex]
                );
            } else {
                indices = indices.concat(
                    [si, ci, si + 1,
                     ci, si + 1, ci + 1]
                );
            }
        }
        childIndex += BRANCH_RESOLUTION;
    }

    for (let child of seg.children) {
        let childPart = generateAllMeshParts(child, childIndex);
        vertices = vertices.concat(childPart.vertices);
        indices = indices.concat(childPart.indices);
        childIndex += childPart.vertices.length;
    }

    return {
        vertices: vertices,
        indices: indices
    };
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
    let meshParts = generateAllMeshParts(seg, 0);

    let indices = new Uint16Array(meshParts.indices);

    let VERTEX_ARRAY_SIZE = meshParts.vertices.length * DATA_PER_VERTEX;
    let vertexData = new Float32Array(VERTEX_ARRAY_SIZE);

    for (let i = 0; i < meshParts.vertices.length; i++) {
        let vertex = meshParts.vertices[i];
        let thisData = vertex.position.xyz.concat(vertex.normal.xyz);
        vertexData.set(thisData, i * DATA_PER_VERTEX);
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
                [GROUND_RADIUS * x, -GROUND_RADIUS * (0.9 - y), GROUND_RADIUS * z,
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

function createWaterMesh(): Mesh {
    let OCEAN_RADIUS = 20;
    let OCEAN_VERTICES = 32;

    let vertexData = new Float32Array((OCEAN_VERTICES + 1) * DATA_PER_VERTEX);
    let indices = new Uint16Array(OCEAN_VERTICES * 3);

    vertexData.set([0, -3, 0, 0, 1, 0]);
    for (let i = 0; i < OCEAN_VERTICES; i++) {
        let angle = 2 * Math.PI / OCEAN_VERTICES * i;
        let x = Math.cos(angle) * OCEAN_RADIUS;
        let z = Math.sin(angle) * OCEAN_RADIUS;
        vertexData.set([x, -3, z, 0, 1, 0], (1 + i) * DATA_PER_VERTEX);
        indices.set([0, i + 1, ((i + 1) % OCEAN_VERTICES) + 1], i * 3);
    }

    return createMesh(vertexData, indices, waterShader.id);
}

function findAllLeaves(seg: Segment): Leaf[] {
    let leaves = seg.leaves;
    for (let child of seg.children) {
        leaves.push(...findAllLeaves(child));
    }
    return leaves;
}

function createLeafMesh(leaves: Leaf[]) {
    let shaderId = leafShader.id;

    let DATA_PER_LEAF_VERTEX = 8;

    let vertexData = new Float32Array(leaves.length * DATA_PER_LEAF_VERTEX * 4);
    for (let i = 0; i < leaves.length; i++) {
        let pos = leaves[i].transform.multiplyVec3(ZERO_VECTOR);
        vertexData.set(
            [
                ...(new vec3([0, 0, 0]).add(pos).xyz),
                0, 1, 0,
                0, 0,

                ...(new vec3([0, 0, 0.1]).add(pos).xyz),
                0, 1, 0,
                0, 1,

                ...(new vec3([0.1, 0, 0]).add(pos).xyz),
                0, 1, 0,
                1, 0,

                ...(new vec3([0.1, 0, 0.1]).add(pos).xyz),
                0, 1, 0,
                1, 1,
            ],
            i * DATA_PER_LEAF_VERTEX * 4
        );
    }

    let indices = new Uint16Array(leaves.length * 6);
    for (let x of Array(leaves.length).keys()) {
        let i = x * 4;
        indices.set(
            [i, i + 1, i + 2, i + 1, i + 3, i + 2],
            x * 6
        );
    }

    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    let posLocation = gl.getAttribLocation(shaderId, "a_position");
    let normLocation = gl.getAttribLocation(shaderId, "a_normal");
    let texCoordsLocation = gl.getAttribLocation(shaderId, "a_tex_coords");
    gl.enableVertexAttribArray(posLocation);
    gl.enableVertexAttribArray(normLocation);
    gl.enableVertexAttribArray(texCoordsLocation);

    // Normals come after positions in the array
    let size = 3, normalize = false, stride = (DATA_PER_VERTEX + 2) * 4;
    gl.vertexAttribPointer(posLocation, size, gl.FLOAT, normalize, stride, 0);
    gl.vertexAttribPointer(normLocation, size, gl.FLOAT, normalize, stride, 3*4);
    gl.vertexAttribPointer(texCoordsLocation, 2, gl.FLOAT, normalize, stride, 6*4);

    // Buffer indices
    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {vao: vao, indexAmount: indices.length };
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

function createProgram(shaderSources: ShaderSource[], uniforms: string[]): ShaderProgram {
    let programId = gl.createProgram();
    for (let shaderData of shaderSources) {
        let shader = createShader(shaderData.shaderType, shaderData.contents);
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
        { shaderType: gl.VERTEX_SHADER, contents: genericVertexShader },
        { shaderType: gl.FRAGMENT_SHADER, contents: treeFragmentShader }
    ], ["mvp", "world", "lightdir"]);

    rayShader = createProgram([
        { shaderType: gl.VERTEX_SHADER, contents: rayVertexShader },
        { shaderType: gl.FRAGMENT_SHADER, contents: rayFragmentShader }
    ], ["mvp"]);

    sandShader = createProgram([
        { shaderType: gl.VERTEX_SHADER, contents: genericVertexShader },
        { shaderType: gl.FRAGMENT_SHADER, contents: sandFragmentShader }
    ], ["mvp", "world", "lightdir"]);

    waterShader = createProgram([
        { shaderType: gl.VERTEX_SHADER, contents: genericVertexShader },
        { shaderType: gl.FRAGMENT_SHADER, contents: waterFragmentShader }
    ], ["mvp", "world"]);

    leafShader = createProgram([
        { shaderType: gl.VERTEX_SHADER, contents: leafVertexShader },
        { shaderType: gl.FRAGMENT_SHADER, contents: leafFragmentShader }
    ], ["mvp", "world", "lightdir"]);

    tree = generateTree();
    treeMesh = createTreeMesh(tree);

    sandMesh = createSandMesh();
    waterMesh = createWaterMesh();

    let leaves = findAllLeaves(tree);
    leafMesh = createLeafMesh(leaves);

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
            let leaves = findAllLeaves(tree);
            leafMesh = createLeafMesh(leaves);
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

let totalLeaves: number = 0;

function generateLeaves(root: Segment, totalLevels: number, level: number, leaves: Leaf[],) {
    for(let childSegment of root.children) {
        let localLeaves: number = (level / totalLevels) * LEAVES; //Number of leaves to generate this iteration.
        //Offset between each leaf in the y-direction.
        let localOffset = childSegment.transform.multiplyVec3(ZERO_VECTOR).subtract(root.transform.multiplyVec3(ZERO_VECTOR)).length() / localLeaves;
        //generate leaves between root and childSegment
        for(let i: number = 0; i < localLeaves; ++i) {
            let newLeaf: Leaf = {
                transform: new mat4()
            };
            let leafTranslation: mat4 = new mat4().setIdentity().translate(new vec3([root.radius, localOffset * i, 0]));
            let leafRotation: mat4 = new mat4().setIdentity().rotate(LEAF_ANGLE * i, UP_VECTOR);
            let leafTransform: mat4 = root.transform.copy().multiply(leafTranslation).multiply(leafRotation);
            newLeaf.transform = leafTransform;
            leaves.push(newLeaf);
            childSegment.leaves.push(newLeaf);
            totalLeaves++;
        }
        generateLeaves(childSegment, totalLevels, level + 1, leaves);
    }
}

// Populate a BranchData struct with values for every segment of that branch.
// Set parent to null to generate the stem branch.
// offset is a value [0, 1] correlating to how far along the parent this branch starts.
function createBranchData(parent: BranchData, offset: number): BranchData {
    let data: BranchData = {
        splitError: 0.0,
        level: 0,
        childBranches: 0,
        branchLength: 0,
        segmentOffset: 0,
        branchRadius: 0,
        unitTaper: 0,
        angle: 0,
        angleBack: 0
    };
    if(parent != null){
        data.level = parent.level + 1;
    }

    if (data.level == 0) {
        //Stem length
        data.branchLength = LENGTH[0]
    } else if (data.level == 1) {
        //Length of first level branches
        data.branchLength = parent.branchLength * (LENGTH[1]) * shapeRatio(SHAPE, (parent.branchLength - offset) / (parent.branchLength - BASE_SIZE * (SCALE)))
    } else {
        //length of other branches
        data.branchLength = (LENGTH[data.level]) * (parent.branchLength - 0.6 * offset)
    }
    data.segmentOffset = data.branchLength / (CURVE_RES[data.level] - 1);

    //Calculate number of child branches for the branch
    if(data.level == 0){
        data.childBranches = BRANCHES[0];
    }
    else if (data.level == 1){
        data.childBranches = BRANCHES[1] * (0.2 + 0.8 * (LENGTH[data.level]/LENGTH[data.level]) / data.branchLength);
    } else if (data.level > 1) {
        data.childBranches = BRANCHES[data.level] * (1 - 0.5 * CHILD_OFFSET / LENGTH[parent.level]);
    }

    //Calculate branch thickness.
    if(data.level == 0){
        data.branchRadius = data.branchLength * RATIO * SCALE;
    } else {
        data.branchRadius = parent.branchRadius * (LENGTH[data.level] / LENGTH[parent.level])**RATIO_POWER;
    }

    //Calculate unitTaper for the branch
    if(0 <= TAPER[data.level] && TAPER[data.level] < 1){
        data.unitTaper = TAPER[data.level];
    } else if(1 <= TAPER[data.level] && TAPER[data.level] < 2){
        data.unitTaper = 2 - TAPER[data.level];
    } else {
        data.unitTaper = 0;
    }

    //Calculate angles for branch curvature.
    data.angle = CURVE[data.level] / CURVE_RES[data.level];
    return data;
}

//Traverses a given branch and places new child roots along its length, these can then be used to grow new branches
//eventually populating the entire tree.
function generateChildBranches(start: Segment, data: BranchData, startOffset: number): void {
    let segments: number = 0; //Number of segments climbed past in the traversal.
    //Since a branch may split into clones we must keep track of a frontier of segments who will parent the new children.
    let segmentFrontier: Segment[] = [start];
    let newChildren: Segment[][] = [[]]; //Keeps track of children until they can be safely parented.
    //Distance between each child. Calculated using length of branch after the start offset has been
    //taken into account, along with a mutliplier so that he last child will never be placed at the tip of
    //the branch.
    let childOffset: number = ((data.branchLength - startOffset) * 0.8) / data.childBranches;
    let totalOffset: number = startOffset; //Total length traversed across the branches so faar.
    //Loop once for every new child that should be created along this branch.
    for(let branches: number = 0; branches < data.childBranches; ++branches){
        //Check if we have moved past a segment already.
        while (totalOffset > (segments + 1) * data.segmentOffset){
            let newFrontier = segmentFrontier.flatMap(x => x.children); //Get the next generation of parent.
            segmentFrontier.forEach((item, index) => item.children = item.children.concat(newChildren[index])); //Give our new children to their parents.
            //Clear arrays for subsequent iterations
            segmentFrontier = newFrontier;
            newChildren = new Array(segmentFrontier.length).fill([]);
            ++segments;
        }
        //Place one new child between every segment in the frontier and each of their child segments.
        let localRotY: quat = quat.fromAxisAngle(UP_VECTOR, CHILD_ANGLE_Y[data.level] * Math.floor(totalOffset / childOffset));
        let localOffset: number = totalOffset - segments * data.segmentOffset; //Offset from the current segment.
        for(let startSeg of segmentFrontier){
            for(let endSeg of startSeg.children){
                //Generate an extra segment childOffset further along the branch.
                //This is used as a stepping stone for the child, ensuring it comes
                //out of the branch with an offset, rather than from the base of the branch.
                let offsetSegment: Segment = {
                    radius: 0.6 * startSeg.radius,
                    children: [],
                    leaves: [],
                    transform: new mat4(),
                    rot: quat.mix(new quat().setIdentity(), endSeg.rot, 0.5)
                };
                let offsetTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, localOffset, 0]));
                let offsetTransform: mat4 = startSeg.transform.copy().multiply(offsetTranslation).multiply(offsetSegment.rot.toMat4());
                offsetSegment.transform = offsetTransform;
                newChildren[segmentFrontier.indexOf(startSeg)].push(offsetSegment);

                //Generate BranchData for the child.
                let childData: BranchData = createBranchData(data, totalOffset / data.branchLength);
                let childRoot: Segment = {
                    radius: 0,
                    children: [],
                    leaves: [],
                    transform: new mat4(),
                    rot: new quat().setIdentity()
                };
                //Let offset and chld use the same radius to avoid convex structures.
                console.log("SegOff: " + childData.segmentOffset);
                offsetSegment.radius = offsetSegment.radius = data.branchRadius * (1 - childData.unitTaper * totalOffset / data.branchLength);
                childRoot.radius = offsetSegment.radius = data.branchRadius * (1 - childData.unitTaper * totalOffset / data.branchLength);
                let localTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, childData.segmentOffset, 0]));
                let localRotX: quat = quat.fromAxisAngle(RIGHT_VECTOR, CHILD_ANGLE_X[childData.level]);
                let localRot: quat = localRotY.copy().multiply(localRotX);
                let childTransform: mat4 = offsetSegment.transform.copy().multiply(localTranslation).multiply(localRot.toMat4());
                childRoot.transform = childTransform;
                childRoot.rot = localRot;
                offsetSegment.children.push(childRoot);
                generateBranch(childData, 0, childRoot);
            }
        }
        totalOffset += childOffset;
    }
    //Lastly, add any remaining new children to their parents.
    segmentFrontier.forEach((item, index) => item.children.concat(newChildren[index]));
}

// Generate a new branch starting in position start.
// data: A BranchData object holding various metadata about the branch.
// startSegment: If this branch has been split, this should state which number on the branch the next segment will be
// start: The root segment from which this branch springs.
function generateBranch(data: BranchData, startSegment: number, start: Segment): Segment{
    let effectiveSplit: number = 0.0;

    let current: Segment = start;
    let currentTransform: mat4 = start.transform;
    let localTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, data.segmentOffset, 0]));
    let localRot: quat
    let localRotX: quat;
    let localRotY: quat = quat.fromAxisAngle(UP_VECTOR, CURVE_V[data.level] / CURVE_RES[data.level]);

    let localTransform: mat4;

    //Rotate along x axis
    localRotX = quat.fromAxisAngle(RIGHT_VECTOR, data.angle);
    localRot = localRotY.multiply(localRotX);

    for(let i = startSegment; i <= CURVE_RES[data.level]; ++i){
        localTransform = localTranslation.copy().multiply(localRot.toMat4());
        let seg: Segment = {
            radius: 0,
            children: [],
            leaves:[],
            transform: new mat4(),
            rot: localRot
        };

        seg.radius = data.branchRadius * (1 - data.unitTaper * i/CURVE_RES[data.level]);

        //Add parent transform to the branch' local one.
        localTransform = currentTransform.copy().multiply(localTransform);
        seg.transform = localTransform;
        current.children.push(seg);

        //Split and clone the branch.
        //Uses Floyd-Steinberg error diffusion to evenly distribute clones along the branch.
        effectiveSplit = Math.floor(SEG_SPLIT[data.level] + data.splitError);

        if(effectiveSplit >= 1){
            //Split the branch into effectiveSplit + 1 clones. Each clone is
            //generated as a new branch, meaning the current loop should break.
            let position = seg.transform.multiplyVec3(ZERO_VECTOR);
            let xz_length = Math.sqrt(position.x**2 + position.z**2);
            let declination = xz_length ? Math.PI / 2 - Math.atan(position.y / xz_length) : 0;
            let angleSplit: number = SPLIT_ANGLE[data.level] - declination;
            let cloneTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, data.segmentOffset, 0]));
            let cloneRotX: quat = quat.fromAxisAngle(RIGHT_VECTOR, angleSplit);

            for(let j: number = 0; j <= effectiveSplit + 1; ++j){
                let cloneAngle = (Math.PI /  + 0.75 * (Math.PI / 6 + Math.abs(declination - Math.PI / 2)) * Math.random()**2) * (Math.round(Math.random()) ? -1 : 1);
                let cloneRotY: quat = quat.fromAxisAngle(UP_VECTOR, cloneAngle);
                let cloneRot: quat = cloneRotY.multiply(cloneRotX);
                let clone: Segment = {
                    radius: 0,
                    children: [],
                    leaves: [],
                    transform: new mat4(),
                    rot: cloneRot
                };
                clone.radius = data.branchRadius * (1 - data.unitTaper * (i/CURVE_RES[data.level]));

                let cloneTransform: mat4 = currentTransform.copy().multiply(cloneTranslation).multiply(cloneRot.toMat4());
                clone.transform = cloneTransform;
                seg.children.push(clone);
                //Apparently the best way to deep-copy a javascript object.
                let cloneData: BranchData = JSON.parse(JSON.stringify(data));
                generateBranch(cloneData, i + 1, clone);
            }
        }
        currentTransform = localTransform;
        //No splitting, keep generating a singular branch.
        data.splitError -= effectiveSplit - SEG_SPLIT[data.level];
        current = seg;
    }
    return start;
}

let leaves: Leaf[] = [];

function generateTree(): Segment {
    let root: Segment = {
        radius: LENGTH[0] * RATIO * SCALE,
        children: [],
        leaves: [],
        transform: new mat4().setIdentity(),
        rot: new quat().setIdentity()
    };
    let stemData: BranchData = createBranchData(null, 0);
    generateBranch(stemData, 0, root);
    generateChildBranches(root, stemData, CHILD_OFFSET);
    generateLeaves(root, CURVE_RES[0], 0, leaves);
    console.log("Total leaves: " + totalLeaves);
    return root;
}

window.onload = () => onLoad();
