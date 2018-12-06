import vertexShader from './shader.vert'
import fragmentShader from './shader.frag'

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
let CURVE_RES = [5];
// Decides curvature type of branches.
// 0: Curves upward, !0: S-curve
let CURVE_BACK = [0];
// Controls magnitude of curvature in braches
let CURVE = [2];

// Controls amount of clones created each segment.
let SEG_SPLIT = [1];
// Controls how much new clones will rotate away from their parents.
let SPLIT_ANGLE =   [5];
let SPLIT_ANGLE_V = [4];
// Controls lenght of branches
let LENGTH =    [8];
let LENGHT_V =  [4];

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

var canvas : HTMLCanvasElement, gl;

var treeVao, shaderProgram;

interface Resource {
    filename: string;
    contents: string;
}

interface Vec3 {
    x: number, y: number, z: number
}

interface Branch {
    segments: Array<Segment>;
    length: number;
}

interface Segment {
    level: number
    position: Vec3;
    children: Array<Segment>
}

let testTree = {
    endPoint: { x: 0, y: 0.1, z: 0 },
    children: []
}

let segmentIndices = [0, 1, 2, 1, 2, 3];
let BRANCH_SEGMENTS = 8;
let NUM_INDICES = segmentIndices.length * (BRANCH_SEGMENTS - 1);

function render(time: number): void {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(shaderProgram);
    gl.bindVertexArray(treeVao);
    gl.drawElements(gl.TRIANGLES, NUM_INDICES, gl.UNSIGNED_SHORT, 0);
    //gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function createTreeMesh(): WebGLVertexArrayObject {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let vertexPositions = new Float32Array(BRANCH_SEGMENTS * 6);
    let indices = new Uint16Array(NUM_INDICES);

    for (let i = 0; i < BRANCH_SEGMENTS; i++) {
        let angle = i / BRANCH_SEGMENTS * (2 * Math.PI);
        let y = Math.cos(angle) * 0.1;
        let z = Math.sin(angle) * 0.1;

        vertexPositions[i * 6] = -0.5;
        vertexPositions[i * 6 + 1] = y;
        vertexPositions[i * 6 + 2] = z;

        vertexPositions[i * 6 + 3] = 0.5;
        vertexPositions[i * 6 + 4] = y;
        vertexPositions[i * 6 + 5] = z;

        for (let j = 0; j < segmentIndices.length; j++) {
            indices[i * segmentIndices.length + j] =
                segmentIndices[j] + i * 2 % (BRANCH_SEGMENTS * 2);
        }
    }

    let positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLocation);
    let size = 3, type = gl.FLOAT, normalize = false, stride = 0, offset = 0;
    gl.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return vao;
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

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    shaderProgram = createProgram([
        { filename: "shader.vert", contents: vertexShader },
        { filename: "shader.frag", contents: fragmentShader }
    ]);

    treeVao = createTreeMesh();

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

function generateTree(): Segment {
    let root = {
        level: 0,
        position: {x: 0, y: 0, z: 0},
        children: []
    };

    for(let i = 1; i <= CURVE_RES[root.level]; ++i){
        let seg = {
            level: 0,
            position: {},
            children: []
        }
    }

    return root;
}

window.onload = () => onLoad();
