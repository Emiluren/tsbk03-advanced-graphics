// SpriteLight - Heavily simplified sprite engine
// by Ingemar Ragnemalm 2009
// Converted to OpenGL 3.2+ 2013.

// What does a mogwai say when it sees a can of soda?
// Eeek! Sprite light! Sprite light!

#include "SpriteLight.h"
#include "LoadTGA.h"
#include <math.h>
#include "VectorUtils3.h"
#include "GL_utilities.h"

// Globals: The sprite list, background texture and viewport dimensions (virtual or real pixels)
SpritePtr gSpriteRoot = NULL;
GLuint backgroundTexID = 0;
long gWidth=800, gHeight=600;

// vertex array object
unsigned int vertexArrayObjID;
//GLuint tex;
// Reference to shader program
GLuint program;

// Uncomment if you are on a system without fabs
//GLfloat fabs(GLfloat in)
//{
//  if (in<0) return -1*in;
//  else return in;
//}

TextureData *GetFace(char *fileName)
{
	TextureData *fp;

	fp = (TextureData *)malloc(sizeof(TextureData));
	
	if (!LoadTGATexture(fileName, fp)) return NULL;
	glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	printf("Loaded %s\n", fileName);
	return fp;
}

struct SpriteRec *NewSprite(TextureData *f, GLfloat h, GLfloat v, GLfloat hs, GLfloat vs)
{
	SpritePtr sp;
	
	sp = (SpriteRec *)malloc(sizeof(SpriteRec));
	
	sp->next = gSpriteRoot;
	gSpriteRoot = sp;
	
	sp->position.h = h;
	sp->position.v = v;
	sp->speed.h = hs;
	sp->speed.v = vs;
	sp->face = f;
	sp->rotation = 0;
	return sp;
}

// A simple movement
void HandleSprite(SpritePtr sp)
{
// Move by speed, bounce off screen edges.
	sp->position.h += sp->speed.h;
	sp->position.v += sp->speed.v;
	if (sp->position.h < 0)
	{
		sp->speed.h = fabs(sp->speed.h);
		sp->position.h = 0;
	}
	if (sp->position.v < 0)
	{
		sp->speed.v = fabs(sp->speed.v);
		sp->position.v = 0;
	}
	if (sp->position.h > gWidth)
	{
		sp->speed.h = -fabs(sp->speed.h);
		sp->position.h = gWidth;
	}
	if (sp->position.v > gHeight)
	{
		sp->speed.v = -fabs(sp->speed.v);
		sp->position.v = gHeight;
	}
	
	sp->rotation = atan2(sp->speed.v, sp->speed.h) * 180.0/3.1416;
}

void DrawSprite(SpritePtr sp)
{
	mat4 trans, rot, scale, m;
	
	glUseProgram(program);
	// Update matrices
	scale = S((float)sp->face->width/gWidth * 2, (float)sp->face->height/gHeight * 2, 1);
//	trans = T(sp->position.h/gWidth, sp->position.v/gHeight, 0);
	trans = T(sp->position.h/gWidth * 2 - 1, sp->position.v/gHeight * 2 - 1, 0);
	rot = Rz(sp->rotation * 3.14 / 180);
	m = Mult(trans, Mult(scale, rot));
	
	glUniformMatrix4fv(glGetUniformLocation(program, "m"), 1, GL_TRUE, m.m);
	glBindTexture(GL_TEXTURE_2D, sp->face->texID);
	
	// Draw
	glBindVertexArray(vertexArrayObjID);	// Select VAO
	glDrawArrays(GL_TRIANGLES, 0, 6);	// draw object
}

void DrawBackground()
{
	mat4 scale;
	
	glUseProgram(program);
	glBindTexture(GL_TEXTURE_2D, backgroundTexID);
	// Update matrices
	scale = S(2, 2, 1);
	glUniformMatrix4fv(glGetUniformLocation(program, "m"), 1, GL_TRUE, scale.m);
	
	// Draw
	glBindVertexArray(vertexArrayObjID);	// Select VAO
	glDrawArrays(GL_TRIANGLES, 0, 6);	// draw object
}






GLfloat vertices[] = {	-0.5f,-0.5f,0.0f,
						-0.5f,0.5f,0.0f,
						0.5f,-0.5f,0.0f,
						
						0.5f,-0.5f,0.0f,
						-0.5f,0.5f,0.0f,
						0.5f,0.5f,0.0f };

GLfloat texcoord[] = {	0.0f, 1.0f,
						0.0f, 0.0f,
						1.0f, 1.0f,
						
						1.0f, 1.0f,
						0.0f, 0.0f,
						1.0f, 0.0f};

void InitSpriteLight()
{
	// two vertex buffer objects, used for uploading the
	unsigned int vertexBufferObjID;
	unsigned int texCoordBufferObjID;

	// GL inits
//	glClearColor(0.2,0.2,0.5,0);
//	glEnable(GL_DEPTH_TEST);
//	printError("GL inits");

	// Load and compile shader
	program = loadShaders("SpriteLight.vert", "SpriteLight.frag");
	glUseProgram(program);
	printError("init shader");
	
	// Upload geometry to the GPU:
	
	// Allocate and activate Vertex Array Object
	glGenVertexArrays(1, &vertexArrayObjID);
	glBindVertexArray(vertexArrayObjID);
	// Allocate Vertex Buffer Objects
	glGenBuffers(1, &vertexBufferObjID);
	glGenBuffers(1, &texCoordBufferObjID);
	
	// VBO for vertex data
	glBindBuffer(GL_ARRAY_BUFFER, vertexBufferObjID);
	glBufferData(GL_ARRAY_BUFFER, 18*sizeof(GLfloat), vertices, GL_STATIC_DRAW);
	glVertexAttribPointer(glGetAttribLocation(program, "inPosition"), 3, GL_FLOAT, GL_FALSE, 0, 0); 
	glEnableVertexAttribArray(glGetAttribLocation(program, "inPosition"));

	// VBO for texCoord data
	glBindBuffer(GL_ARRAY_BUFFER, texCoordBufferObjID);
	glBufferData(GL_ARRAY_BUFFER, 12*sizeof(GLfloat), texcoord, GL_STATIC_DRAW);
	glVertexAttribPointer(glGetAttribLocation(program, "inTexCoord"), 2, GL_FLOAT, GL_FALSE, 0, 0);
	glEnableVertexAttribArray(glGetAttribLocation(program, "inTexCoord"));

	glUniform1i(glGetUniformLocation(program, "tex"), 0); // Texture unit 0
//	LoadTGATextureSimple("maskros512.tga", &tex); // 5c
	
	// End of upload of geometry
	
	printError("init arrays");
}
