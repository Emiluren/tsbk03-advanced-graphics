
// Converted to MicroGlut and VectorUtils3 2013.
// MicroGLut currently exists for Linux and Mac OS X, and a beta for Windows.
// You will also need GLEW for Windows. You may sometimes need to work around
// differences, e.g. additions in MicroGlut that don't exist in FreeGlut.

// 2015: 

// Linux: gcc lab0.c ../common/*.c ../common/Linux/MicroGlut.c -lGL -o lab0 -I../common -I../common/Linux

// Mac: gcc lab0.c ../common/*.c ../common/Mac/MicroGlut.m -o lab0 -framework OpenGL -framework Cocoa -I../common/Mac -I../common

#ifdef __APPLE__
#include <OpenGL/gl3.h>
#include "MicroGlut.h"
//uses framework Cocoa
#else
#include <GL/gl.h>
#include "MicroGlut.h"
#endif
#include "GL_utilities.h"
#include "VectorUtils3.h"
#include "loadobj.h"
//#include "zpr.h"
#include "LoadTGA.h"

//constants
const int initWidth=512,initHeight=512;

// Model-to-world matrix
// Modify this matrix.
// See below for how it is applied to your model.
mat4 objectExampleMatrix = {{ 1.0, 0.0, 0.0, 0.0,
                              0.0, 1.0, 0.0, 0.0,
                              0.0, 0.0, 1.0, 0.0,
                              0.0, 0.0, 0.0, 1.0}};
// World-to-view matrix. Usually set by lookAt() or similar.
mat4 viewMatrix;
// Projection matrix, set by a call to perspective().
mat4 projectionMatrix;

// Globals
// * Model(s)
Model *bunny;
// * Reference(s) to shader program(s)
GLuint program;
// * Texture(s)
GLuint texture;

void init(void)
{
    dumpInfo();

    // GL inits
    glClearColor(0.2,0.2,0.5,0);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);
    glCullFace(GL_BACK);
    printError("GL inits");

    projectionMatrix = perspective(90, 1.0, 0.1, 1000);
    viewMatrix = lookAt(0,0,1.5, 0,0,0, 0,1,0);

    // Load and compile shader
    program = loadShaders("lab0.vert", "lab0.frag");
    printError("init shader");
	
    // Upload geometry to the GPU:
    bunny = LoadModelPlus("objects/stanford-bunny.obj");
    printError("load models");

    // Load textures
    LoadTGATextureSimple("textures/maskros512.tga",&texture);
    printError("load textures");
}

float time = 0;
void display(void)
{
    time += 0.2;
    printError("pre display");

    // clear the screen
    glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

    //activate the program, and set its variables
    glUseProgram(program);
    glUniformMatrix4fv(glGetUniformLocation(program, "projectionMatrix"), 1, GL_TRUE, projectionMatrix.m);
    glUniform1f(glGetUniformLocation(program, "time"), time);
    mat4 world = Mult(Ry(time * 0.1), objectExampleMatrix);
    mat4 m = Mult(viewMatrix, world);
    glUniformMatrix4fv(glGetUniformLocation(program, "viewMatrix"), 1, GL_TRUE, m.m);

    //draw the model
    DrawModel(bunny, program, "in_Position", "in_Normal", NULL);
	
    printError("display");
	
    glutSwapBuffers();
}

int main(int argc, char *argv[])
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_RGBA|GLUT_DEPTH|GLUT_DOUBLE);
    glutInitContextVersion(3, 2);
    glutCreateWindow ("Lab 0 - OpenGL 3.2+ Introduction");
    glutDisplayFunc(display); 
    glutRepeatingTimer(20);
    init ();
    glutMainLoop();
    exit(0);
}

