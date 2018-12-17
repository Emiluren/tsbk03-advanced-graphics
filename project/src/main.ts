import vertexShader from './shader.vert'
import fragmentShader from './shader.frag'

import mat4 from 'tsm/src/mat4'
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

// Number of segments per branch.
let CURVE_RES = [6];
// Decides curvature type of branches.
// 0: Curves upward, !0: S-curve Slightly buggy
let CURVE_BACK = [0];

// Controls magnitude of x-axis curvature in branches
let CURVE = [100];

// Controls magnitude of y-axis curvature in branches
let CURVE_V = [2];

// Controls amount of clones created each segment.
let SEG_SPLIT = [1];
// Controls how much new clones will rotate away from their parents.
let SPLIT_ANGLE =   [5];
let SPLIT_ANGLE_V = [4];
// Controls lenght of branches
let LENGTH =    [3];
let LENGTH_V =  [2];

// Defines shapeRatio mode, see function.
let SHAPE: Shapes = Shapes.Conical;

// Decides radius of the tree along the base, which also has an effect on the
// overall height of the tree.
let BASE_SIZE = 5;

// Decides overall size of the whole tree.
let SCALE = 1;
let SCALE_V = 1;

// Controls thickness of branches somehow TODO: improve comment.
let RATIO = 1;
let RATIO_POWER = 1;

// Controls amount of tapering of branch thickness [0, 3].
let TAPER = [1];


//List where each index n specifies how many times a stem generate a clone on
//average for a stem with n parents.
const STEM_BRANCHING_FACTORS: number[] = [1, 1, 1, 1, 0];

//List where each index n specifies how many non-clone branches may be
//generated by each branch with n parents.
const BRANCHING_FACTORS: number[] = [0, 2, 3, 4, 1, 1];

var canvas : HTMLCanvasElement, gl;

var treeMesh, shaderProgram, mvpLocation, worldLocation;

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
    position: vec3;
    children: Segment[]
}

let testTree = {
    endPoint: new vec3([0, 1, 0]),
    children: [
        { endPoint: new vec3([0.5, 2, 0.5]), children: [] },
        { endPoint: new vec3([-0.1, 2, 0]), children: [] }
    ]
}

let cameraPositionAngle = 0;
let cameraPositionRadius = 10;
let y = 3;

let lastRenderTime = 0;
function render(time: number): void {
    let dt = Math.min((time - lastRenderTime) / 1000, 1 / 30);
    lastRenderTime = time;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    let proj = mat4.perspective(45, canvas.width / canvas.height, 0.1, 100);

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
    let cameraTarget = new vec3([0, 7, 0]);

    let viewMatrix = mat4.lookAt(
        new vec3([camPosX, y, camPosZ]),
        cameraTarget,
        new vec3([0, 1, 0])
    );
    proj.multiply(viewMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shaderProgram);
    gl.bindVertexArray(treeMesh.vao);
    gl.uniformMatrix4fv(worldLocation, false, mat4.identity.all());
    gl.uniformMatrix4fv(mvpLocation, false, proj.all());
    gl.drawElements(gl.TRIANGLES, treeMesh.indexAmount, gl.UNSIGNED_SHORT, 0);

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

function generateBranchData(startPoint: vec3, endPoint: vec3): BranchMeshPart {
    let meshPart = {
        vertices: new Array<BranchVertexData>(BRANCH_VERTEX_AMOUNT),
        indices: new Uint16Array(BRANCH_INDEX_AMOUNT)
    };

    for (let i = 0; i < BRANCH_RESOLUTION; i++) {
        let angle = i / BRANCH_RESOLUTION * (2 * Math.PI);
        let x = Math.cos(angle) * 0.1;
        let z = Math.sin(angle) * 0.1;

        meshPart.vertices[i * 2] = {
            position: new vec3([startPoint.x + x, startPoint.y, startPoint.z + z]),
            normal: new vec3([x, 0, z])
        };

        meshPart.vertices[i * 2 + 1] = {
            position: new vec3([endPoint.x + x, endPoint.y, endPoint.z + z]),
            normal: new vec3([x, 0, z])
        }

        meshPart.indices.set(
            branchSideIndices.map(b => (b + i * 2) % 16),
            i * branchSideIndices.length
        );
    }

    return meshPart;
}

function generateAllMeshParts(seg: Segment, startPoint: vec3): BranchMeshPart[] {
    let thisData = generateBranchData(startPoint, seg.position);
    let childrenData: BranchMeshPart[] = seg.children.flatMap(
        c => generateAllMeshParts(c, seg.position)
    );
    childrenData.push(thisData);

    return childrenData;
}

interface Mesh {
    vao: WebGLVertexArrayObject;
    indexAmount: number;
}

function createTreeMesh(seg: Segment): Mesh {
    let meshParts = generateAllMeshParts(seg, new vec3([0, 0, 0]));

    let branchAmount = meshParts.length;
    let DATA_PER_VERTEX = 6; // x, y and z coords for both position and normal
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

    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    let pos_location = gl.getAttribLocation(shaderProgram, "a_position");
    let norm_location = gl.getAttribLocation(shaderProgram, "a_normal");
    gl.enableVertexAttribArray(pos_location);
    gl.enableVertexAttribArray(norm_location);

    // Normals come after positions in the array
    let size = 3, normalize = false, stride = DATA_PER_VERTEX * 4;
    gl.vertexAttribPointer(pos_location, size, gl.FLOAT, normalize, stride, 0);
    gl.vertexAttribPointer(norm_location, size, gl.FLOAT, normalize, stride, 12);

    // Buffer indices
    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {vao: vao, indexAmount: numIndices };
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

function createProgram(shaderSources: Array<Resource>): WebGLProgram {
    let shaderTypes = {
        "shader.vert": gl.VERTEX_SHADER,
        "shader.frag": gl.FRAGMENT_SHADER
    };

    var program = gl.createProgram();
    for (let shaderData of shaderSources) {
        let shader = createShader(
            shaderTypes[shaderData.filename],
            shaderData.contents
        );
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);

    // Log an error if the compilation failed
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    } else {
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
}

function onLoad(): void {
    canvas = document.querySelector("#glCanvas");
    gl = canvas.getContext("webgl2");

    if (gl === null) {
        alert("Unable to initialize WebGL");
        return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    shaderProgram = createProgram([
        { filename: "shader.vert", contents: vertexShader },
        { filename: "shader.frag", contents: fragmentShader }
    ]);

    treeMesh = createTreeMesh(generateTree());
    mvpLocation = gl.getUniformLocation(shaderProgram, "mvp");
    worldLocation = gl.getUniformLocation(shaderProgram, "world");

    requestAnimationFrame(render);
}

// ShapeRatio function as defined by Penn and Weber, essentially controls
// length of branches, which ends up controlling the overall shape of the foiliage
function shapeRatio(shape: Shapes, ratio: number){
    switch(shape){
        case Shapes.Conical:
            return 0.2 + 0.8 * ratio;
        case Shapes.Spherical:
            0.2 + 0.8 * Math.sin(Math.PI * ratio);
        case Shapes.Hemispherical:
            0.2 + 0.8 * Math.sin(0.5 * Math.PI * ratio);
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
function generateBranch(level: number, startSegment: number, start: vec3, parentLength: number, childOffset: number): Segment{
    let root: Segment = {
        level: level,
        position: start,
        children: []
    };

    let branchLength: number;
    if (level == 0) {
        //Stem length
        branchLength = LENGTH[0] - LENGTH_V[0]
    } else if (level == 1) {
        //First level branches
        branchLength = parentLength * (LENGTH[1] - LENGTH_V[1]) * shapeRatio(SHAPE, (parentLength - childOffset) / (parentLength - BASE_SIZE * (SCALE - SCALE_V)))
    } else {
        branchLength = (LENGTH[level] - LENGTH_V[level]) * (parentLength - 0.6 * childOffset)
    }

    //Length between each segment in a branch
    let segmentOffset: number = branchLength / (CURVE_RES[level] - 1)

    let current: Segment = root;
    let currentTransform: mat4 = mat4.identity;

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
        localRotX = new mat4().setIdentity().rotate(CURVE[level] / CURVE_RES[level] / 180 * Math.PI, new vec3([1, 0, 0]));
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
            position: new vec3([0, 0, 0]),
            children: []
        }

        seg.position = currentTransform.multiplyVec3(seg.position);

        //Select the current transform for creating the S-shape branch.
        if(CURVE_BACK[level] == 0 || i < CURVE_RES[level] / 2){
            currentTransform = localTransform.multiply(currentTransform);
        } else {
            currentTransform = localTransformEnd.multiply(currentTransform);
        }

        current.children.push(seg);

        current = seg;
    }
    return root;
}

function generateTree(): Segment {
    let root = generateBranch(0, 0, new vec3([0, 0, 0]), 0, 0)

    return root;
}

window.onload = () => onLoad();
