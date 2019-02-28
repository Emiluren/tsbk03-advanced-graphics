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

// Number of segments per branch. Keep low if using high SEG_SPLIT as the number of segments will grow exponentially.
let CURVE_RES = [4, 2, 2];
// Decides curvature type of branches.
// 0: Curves upward, !0: S-curve Quite buggy
let CURVE_BACK = [0, 0, 0];

// Controls magnitude of x-axis curvature in branches
let CURVE = [Math.PI / 3, Math.PI / 2, Math.PI / 14];

// Controls magnitude of y-axis curvature in branches
let CURVE_V = [Math.PI / 4, Math.PI / 1.5, Math.PI / 3];

// Controls amount of clones created each segment.
let SEG_SPLIT = [1, 0, 0];
// Controls how much new clones will rotate away from their parents.
let SPLIT_ANGLE = [Math.PI * 0.6, Math.PI / 4, Math.PI / 43];
// Controls lenght of branches
let LENGTH = [0.8, 0.4, 0];

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
let TAPER = [1.5, 2, 0];

let BRANCHES = [0, 1, 0];

//The distance any branch will stretch before any branches begin shootinf off of it.
let CHILD_OFFSET = 1;

//Angle with wich child branches will rotate away from their parents y-axis around their x-axis.
let CHILD_ANGLE_X = [Math.PI / 8, Math.PI / 4, Math.PI / 5]
//Child branches are rotated in a helical pattern around their parent.
//This value decides how much more each new branch rotates than the last.
let CHILD_ANGLE_Y = [Math.PI / 13, 0, 0]

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
    position: vec3
    children: Segment[]
    transform: mat4
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
    let cameraTarget = new vec3([0, 2, 0]);

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
        let startEdgePos = startSegment.transform.multiplyVec3(new vec3([x, 0, z]).scale(startSegment.radius));
        let endEdgePos = endSegment.transform.multiplyVec3(new vec3([x, 0, z]).scale(endSegment.radius));

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

function generateAllMeshParts(seg: Segment, parts: BranchMeshPart[]): BranchMeshPart[] {
    for(let child of seg.children){
        parts.push(generateBranchData(seg, child));
        generateAllMeshParts(child, parts);
    }
    return parts;
}

interface Mesh {
    vao: WebGLVertexArrayObject;
    indexAmount: number;
}



function createTreeMesh(seg: Segment): Mesh {
    let meshParts = generateAllMeshParts(seg, []);

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
    //No branches for level 0!
    if (data.level == 1){
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
    if(CURVE_BACK[data.level] == 0){
        data.angle = CURVE[data.level] / CURVE_RES[data.level] / 180 * Math.PI;
    } else {
        data.angle = CURVE[data.level] / (CURVE_RES[data.level] / 2);
        data.angleBack = CURVE_BACK[data.level] / (CURVE_RES[data.level] / 2);
    }

    return data;
}

//Traverses a given branch and places new child roots along its length, these can then be used to grow new branches
//eventually populating the entire tree.
function generateChildBranches(start: Segment, data: BranchData, startOffset: number): void {
    console.log("Generating child branches!");
    let segments: number = 0; //Number of segments climbed past in the traversal.
    //Since a branch may split into clones we must keep track of a frontier of segments who will parent the new children.
    let segmentFrontier: Segment[] = [start];
    let newChildren: Segment[][] = []; //Keeps track of children until they can be safely parented.
    //Distance between each child. Calculated using length of branch after the start offset has been
    //taken into account, along with a mutliplier so that he last child will never be placed at the tip of
    //the branch.
    let childOffset: number = ((data.branchLength - startOffset) * 0.8) / data.childBranches;
    let totalOffset: number = startOffset; //Total length traversed across the branches so faar.
    //Loop once for every new child that should be created along this branch.
    console.log("Will generate " + data.childBranches + " branches!");
    for(let branches: number = 0; branches < data.childBranches; ++branches){
        //Check if we have moved past a segment already.
        if (totalOffset > startOffset + branches * childOffset){
            let newFrontier = segmentFrontier.flatMap(x => x.children); //Get the next generation of parent.
            segmentFrontier.forEach((item, index) => item.children.concat(newChildren[index])); //Give our new children to their parents.
            //Clear arrays for subsequent iterations
            newChildren = [];
            segmentFrontier = newFrontier;
            ++segments;
        }
        //Place one new child between every segment in the frontier and each of their child segments.
        let localRotY: mat4 = new mat4().setIdentity().rotate(CHILD_ANGLE_Y[data.level] * Math.floor(totalOffset / childOffset), new vec3([0, 1, 0]));
        let localOffset: number = totalOffset - segments * data.segmentOffset; //Offset from the current segment.
        for(let startSeg of segmentFrontier){
            for(let endSeg of startSeg.children){
                //Generate an extra segment childOffset further along the branch.
                //This is used as a stepping stone for the child, ensuring it comes
                //out of the branch with an offset, rather than from the base of the branch.
                let offsetSegment: Segment = {
                    radius: 0,
                    position: startSeg.position.copy(),
                    children: [],
                    transform: startSeg.transform.copy()
                };
                let offsetVector: vec3 = (endSeg.position.copy().subtract(startSeg.position)).normalize();
                let offsetTransform: mat4 = new mat4().setIdentity().translate(offsetVector.scale(localOffset));
                offsetTransform.multiply(offsetSegment.transform);
                offsetSegment.position = offsetTransform.multiplyVec3(offsetSegment.position);
                offsetSegment.transform = offsetTransform;
                newChildren[segmentFrontier.indexOf(startSeg)].push(offsetSegment);

                //Generate BranchData for the child.
                let childData: BranchData = createBranchData(data, totalOffset / data.branchLength);
                let childRoot: Segment = {
                    radius: 0,
                    position: new vec3([0, 0, 0]),
                    children: [],
                    transform: new mat4()
                };
                childRoot.radius = data.branchRadius * (1 - childData.unitTaper * totalOffset / data.branchLength);
                let localTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, childData.segmentOffset, 0]));
                let localRotX: mat4 = new mat4().setIdentity().rotate(CHILD_ANGLE_X[childData.level], new vec3([1, 0, 0]));
                let localRot: mat4 = localRotY.copy().multiply(localRotX);
                let localTransform: mat4 = localRot.multiply(localTranslation).multiply(offsetSegment.transform);
                childRoot.position = localTransform.multiplyVec3(childRoot.position);
                childRoot.transform = localTransform;
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
    //console.log("Generating new level" + " branch originating in " + start.position.xyz)
    let effectiveSplit: number = 0.0;

    let current: Segment = start;
    let currentTransform: mat4 = start.transform;
    let localTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, data.segmentOffset, 0]));
    let localRot: mat4;
    let localRotEnd: mat4;
    let localRotX: mat4;
    let localRotXEnd: mat4; //Angle end half of segments should rotate in S-branches.
    let localRotY: mat4 = new mat4().setIdentity().rotate(CURVE_V[data.level] / CURVE_RES[data.level], new vec3([0, 1, 0]));

    let localTransform: mat4;
    let localTransformEnd: mat4; //For the end of S-branches;

    if(CURVE_BACK[data.level] == 0){
        //Rotate along x axis
        localRotX = new mat4().setIdentity().rotate(data.angle, new vec3([1, 0, 0]));
        localRot = localRotY.multiply(localRotX)
        localTransform = localRot.multiply(localTranslation);
    } else {
        //S-shaped branch.
        //Rotate first halv of the branches' segments one way, and the other
        //half the other other way
        //Calculate the different rotation matrices for the S-branch rotations.
        localRotX = new mat4().setIdentity().rotate(data.angle, new vec3([1, 0, 0]));
        localRotXEnd = new mat4().setIdentity().rotate(-data.angleBack, new vec3([1, 0, 0]));
        localRot = localRotY.copy().multiply(localRotX);
        localRotEnd = localRotY.multiply(localRotXEnd);
        //Create the total transformations for the different parts of the S-branch.
        localTransform = localRot.multiply(localTranslation);
        localTransformEnd = localRotEnd.multiply(localTranslation);
    }

    for(let i = startSegment; i <= CURVE_RES[data.level]; ++i){
        let seg: Segment = {
            radius: 0,
            position: new vec3([0, 0, 0]),
            children: [],
            transform: new mat4()
        };

        seg.radius = data.branchRadius * (1 - data.unitTaper * i/CURVE_RES[data.level]);

        //Select the current transform for creating the S-shape branch.
        if(CURVE_BACK[data.level] == 0 || i < CURVE_RES[data.level] / 2){
            currentTransform = localTransform.multiply(currentTransform);
        } else {
            currentTransform = localTransformEnd.multiply(currentTransform);
        }
        seg.position = currentTransform.multiplyVec3(seg.position);
        seg.transform = currentTransform;
        current.children.push(seg);

        //Split and clone the branch.
        //Uses Floyd-Steinberg error diffusion to evenly distribute clones along the branch.
        effectiveSplit = Math.floor(SEG_SPLIT[data.level] + data.splitError);

        if(effectiveSplit >= 1){
            //Split the branch into effectiveSplit + 1 clones. Each clone is
            //generated as a new branch, meaning the current loop should break.
            let declination = seg.position.length ? Math.PI - Math.atan(seg.position.y / seg.position.length()) : 0;
            let angleSplit: number = SPLIT_ANGLE[data.level] - declination;
            let cloneTranslation: mat4 = new mat4().setIdentity().translate(new vec3([0, data.segmentOffset, 0]));
            let cloneRotX: mat4 = new mat4().setIdentity().rotate(angleSplit, new vec3([1, 0, 0]));

            for(let j: number = 0; j <= effectiveSplit + 1; ++j){
                console.log("Generating clone!");
                let cloneAngle = (Math.PI /  + 0.75 * (Math.PI / 6 + Math.abs(declination - Math.PI / 2)) * Math.random()**2) * (Math.round(Math.random()) ? -1 : 1);
                let cloneRotY: mat4 = new mat4().setIdentity().rotate(cloneAngle, new vec3([0, 1, 0]));
                let clone: Segment = {
                    radius: 0,
                    position : new vec3([0, 0, 0]),
                    children: [],
                    transform: new mat4()
                };
                clone.radius = data.branchRadius * (1 - data.unitTaper * (i/CURVE_RES[data.level]));
                let cloneRot: mat4 = cloneRotY.multiply(cloneRotX);
                let cloneTransform: mat4 = cloneRot.multiply(cloneTranslation).multiply(currentTransform);
                clone.position = cloneTransform.multiplyVec3(clone.position);
                clone.transform = cloneTransform;
                seg.children.push(clone);
                //Apparently the best way to deep-copy a javascript object.
                let cloneData: BranchData = JSON.parse(JSON.stringify(data));
                generateBranch(cloneData, i + 1, clone);
            }
            break;
        } else {
            //No splitting, keep generating a singular branch.
            data.splitError -= effectiveSplit - SEG_SPLIT[data.level];
            current = seg;
        }
    }
    return start;
}

function generateTree(): Segment {
    let root: Segment = {
        radius: LENGTH[0] * RATIO * SCALE,
        position: new vec3([0, 0, 0]),
        children: [],
        transform: new mat4().setIdentity()
    };
    let stemData: BranchData = createBranchData(null, 0);
    console.log("data: " + JSON.stringify(stemData));
    generateBranch(stemData, 0, root);
    generateChildBranches(root, stemData, CHILD_OFFSET);
    return root;
}

window.onload = () => onLoad();
