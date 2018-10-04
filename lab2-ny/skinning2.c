// Part B: Many-bone worm

// New version by Ingemar 2010
// Removed all dependencies of the Wild Magic (wml) library.
// Replaced it with VectorUtils2 (in source)
// Replaced old shader module with the simpler "ShaderUtils" unit.

// 2013: Adapted to VectorUtils3 and MicroGlut.

// gcc skinning2.c ../common/*.c -lGL -o skinning2 -I../common
// not working any more. This is untested but closer to the truth:
// gcc skinning2.c -o skinning2 ../common/*.c ../common/Linux/MicroGlut.c -I../common -I../common/Linux -DGL_GLEXT_PROTOTYPES -lXt -lX11 -lGL -lm

#include <stdio.h>
#include <math.h>
#include <stdlib.h>
#ifdef __APPLE__
// Mac
#include <OpenGL/gl3.h>
//uses framework Cocoa
#else
#ifdef WIN32
// MS
#include <stdio.h>
#include <GL/glew.h>
#else
// Linux
#include <GL/gl.h>
#endif
#endif

#include "MicroGlut.h"
#include "GL_utilities.h"
#include "VectorUtils3.h"
#include "loadobj.h"
#include <string.h>

// Ref till shader
GLuint g_shader;


// vec2 is mostly useful for texture coordinates, otherwise you don't use it much.
// That is why VectorUtils3 doesn't support it (yet)
typedef struct vec2
{
	GLfloat s, t;
}
vec2, *vec2Ptr;


typedef struct Triangle
{
	GLuint        v1;
	GLuint        v2;
	GLuint        v3;
} Triangle;

#define CYLINDER_SEGMENT_LENGTH 0.37
#define kMaxRow 100
#define kMaxCorners 8
#define kMaxBones 10
#define kMaxg_poly ((kMaxRow-1) * kMaxCorners * 2)
#ifndef Pi
#define Pi 3.1416
#endif
#ifndef true
#define true 1
#endif

#define BONE_LENGTH 4.0

Triangle g_poly[kMaxg_poly];

// vertices
vec3 g_vertsOrg[kMaxRow][kMaxCorners];
vec3 g_normalsOrg[kMaxRow][kMaxCorners];
vec3 g_vertsRes[kMaxRow][kMaxCorners];
vec3 g_normalsRes[kMaxRow][kMaxCorners];

// vertex attributes
float g_boneWeights[kMaxRow][kMaxCorners][kMaxBones];
vec2 g_boneWeightVis[kMaxRow][kMaxCorners]; // Copy data to here to visualize your weights

mat4 boneRestMatrices[kMaxBones];

Model *cylinderModel; // Collects all the above for drawing with glDrawElements

mat4 modelViewMatrix, projectionMatrix;

///////////////////////////////////////////////////
//		I N I T  B O N E  W E I G H T S
// Desc:  initierar benvikterna
//
void initBoneWeights(void) {
	long row, corner;
	int bone;

	// sätter värden till alla vertexar i meshen
	for (row = 0; row < kMaxRow; row++) {
		for (corner = 0; corner < kMaxCorners; corner++) {
			float boneWeights[kMaxBones];
			float totalBoneWeight = 0.f;

			float maxBoneWeight = 0.f;

			for (bone = 0; bone < kMaxBones; bone++) {
				float bonePos = BONE_LENGTH * bone;
				float boneDist = fabs(bonePos - g_vertsOrg[row][corner].x);
				float boneWeight = (BONE_LENGTH - boneDist) / (BONE_LENGTH);
				if (boneWeight < 0)
				boneWeight = 0;
				boneWeights[bone] = boneWeight;
				totalBoneWeight += boneWeight;

				if (maxBoneWeight < boneWeight)
				maxBoneWeight = boneWeight;
			}

			g_boneWeightVis[row][corner].s = 0;
			g_boneWeightVis[row][corner].t = 0;
			for (bone = 0; bone < kMaxBones; bone++) {
				g_boneWeights[row][corner][bone] = boneWeights[bone] / totalBoneWeight;

				//				printf("%d %d %d\n", bone, bone & 1, (bone+1) & 1);
				if (bone & 1) g_boneWeightVis[row][corner].s += g_boneWeights[row][corner][bone]; // Copy data to here to visualize your weights or anything else
				if ((bone+1) & 1) g_boneWeightVis[row][corner].t += g_boneWeights[row][corner][bone]; // Copy data to here to visualize your weights
				/* printf("%f ", bone, g_boneWeights[row][corner][bone]); */
			}
			/* printf("\n"); */

			// Visar vertexraderna
			//			g_boneWeightVis[row][corner].s = row & 1; // Copy data to here to visualize your weights or anything else
			//			g_boneWeightVis[row][corner].t = (row+1) & 1; // Copy data to here to visualize your weights
		}
	}

	corner = 0;
	for (row = 0; row < kMaxRow; row++) {
		for (bone = 0; bone < kMaxBones; bone++) {
			//				printf("%d %d %f\n", row, bone, g_boneWeights[row][corner][bone]);
		}
	}
	//		for (corner = 0; corner < kMaxCorners; corner++)
}



///////////////////////////////////////////////////
//		B U I L D  C Y L I N D E R
// Desc:  bygger upp cylindern
//
void BuildCylinder()
{
	long	row, corner, cornerIndex;

	// sätter värden till alla vertexar i meshen
	for (row = 0; row < kMaxRow; row++)
	for (corner = 0; corner < kMaxCorners; corner++)
	{
		g_vertsOrg[row][corner].x = (float) row * CYLINDER_SEGMENT_LENGTH;
		g_vertsOrg[row][corner].y = cos(corner * 2*Pi / kMaxCorners);
		g_vertsOrg[row][corner].z = sin(corner * 2*Pi / kMaxCorners);

		g_normalsOrg[row][corner].x = 0;
		g_normalsOrg[row][corner].y = cos(corner * 2*Pi / kMaxCorners);
		g_normalsOrg[row][corner].z = sin(corner * 2*Pi / kMaxCorners);
	};

	// g_poly definerar mellan vilka vertexar som
	// trianglarna ska ritas
	for (row = 0; row < kMaxRow-1; row++)
	for (corner = 0; corner < kMaxCorners; corner++)
	{
		// Quads built from two triangles

		if (corner < kMaxCorners-1)
		{
			cornerIndex = row * kMaxCorners + corner;
			g_poly[cornerIndex * 2].v1 = cornerIndex;
			g_poly[cornerIndex * 2].v2 = cornerIndex + 1;
			g_poly[cornerIndex * 2].v3 = cornerIndex + kMaxCorners + 1;

			g_poly[cornerIndex * 2 + 1].v1 = cornerIndex;
			g_poly[cornerIndex * 2 + 1].v2 = cornerIndex + kMaxCorners + 1;
			g_poly[cornerIndex * 2 + 1].v3 = cornerIndex + kMaxCorners;
		}
		else
		{ // Specialfall: sista i varvet, gå runt hörnet korrekt
			cornerIndex = row * kMaxCorners + corner;
			g_poly[cornerIndex * 2].v1 = cornerIndex;
			g_poly[cornerIndex * 2].v2 = cornerIndex + 1 - kMaxCorners;
			g_poly[cornerIndex * 2].v3 = cornerIndex + kMaxCorners + 1 - kMaxCorners;

			g_poly[cornerIndex * 2 + 1].v1 = cornerIndex;
			g_poly[cornerIndex * 2 + 1].v2 = cornerIndex + kMaxCorners + 1 - kMaxCorners;
			g_poly[cornerIndex * 2 + 1].v3 = cornerIndex + kMaxCorners;
		}
	}

	// lägger en kopia av orginal modellen i g_vertsRes
	memcpy(g_vertsRes,  g_vertsOrg, kMaxRow * kMaxCorners* sizeof(vec3));
	memcpy(g_normalsRes,  g_normalsOrg, kMaxRow * kMaxCorners* sizeof(vec3));
}


//////////////////////////////////////
//		B O N E
// Desc:	en enkel ben-struct med en
//			pos-vektor och en rot-vektor
//			rot vektorn skulle lika gärna
//			kunna vara av 3x3 men VectorUtils2 har bara 4x4
typedef struct Bone
{
	vec3 pos;
	mat4 rot;
} Bone;


///////////////////////////////////////
//		G _ B O N E S
// vårt skelett
Bone g_bones[kMaxBones]; // Ursprungsdata, ändra ej
Bone g_bonesRes[kMaxBones]; // Animerat

vec3 bone_rel_pos(int b) {
	if (b == kMaxBones - 1) {
		return g_bones[b].pos;
	} else {
		return VectorSub(g_bones[b+1].pos, g_bones[b].pos);
	}
}

mat4 TByVec(vec3 pos) {
	return T(pos.x, pos.y, pos.z);
}


///////////////////////////////////////////////////////
//		S E T U P  B O N E S
//
void setupBones(void)
{
	int bone;

	mat4 boneLocalRest[kMaxBones];
	for (bone = 0; bone < kMaxBones; bone++)
	{
		g_bones[bone].pos = SetVector((float) bone * BONE_LENGTH, 0.0f, 0.0f);
		g_bones[bone].rot = IdentityMatrix();
		
		boneLocalRest[bone] = TByVec(bone_rel_pos(bone));
	}

	for (bone = 0; bone < kMaxBones; bone++) {
		boneLocalRest[bone] = TByVec(bone_rel_pos(bone));
	}

	for (int b = kMaxBones - 1; b >= 0; --b) {
		if(b == kMaxBones - 1){
			boneRestMatrices[b] = InvertMat4(boneLocalRest[b]);
		} else {
			boneRestMatrices[b] = Mult(
				InvertMat4(boneLocalRest[b]),
				boneRestMatrices[b+1]
			);
		}
	}
}

///////////////////////////////////////////////////////
//		D E F O R M  C Y L I N D E R
//
// Desc:	deformera cylinder-meshen enligt skelettet
void DeformCylinder()
{
	int row, corner;

	printf("\nhej\n\n\n");

	mat4 boneLocalAnimMatrices[kMaxBones];
	for (int b = 0; b < kMaxBones; ++b) {
		mat4 translation = TByVec(bone_rel_pos(b));
		boneLocalAnimMatrices[b] = Mult(translation, g_bonesRes[b].rot);
	}

	mat4 boneAnimMatrices[kMaxBones];
	for(int b = 0; b < kMaxBones; ++b){
		if(b == 0){
			boneAnimMatrices[b] = boneLocalAnimMatrices[b];
		} else {
			boneAnimMatrices[b] = Mult(
				boneLocalAnimMatrices[b],
				boneAnimMatrices[b-1]
			);
		}
	}

	mat4 completeMatrix[kMaxBones];
	for (int b = 0; b < kMaxBones; ++b) {
		completeMatrix[b] = Mult(boneAnimMatrices[b], boneRestMatrices[b]);
		printMat4(completeMatrix[b]);
	}


	// för samtliga vertexar
	for (row = 0; row < kMaxRow; row++) {
		//printf("\nrow %d\n", row);
		for (corner = 0; corner < kMaxCorners; corner++) {
			g_vertsRes[row][corner] = (vec3){0, 0, 0};
			for(int b = 0; b < kMaxBones; b++) {
				vec3 transformedVert = MultVec3(completeMatrix[b], g_vertsOrg[row][corner]);
				vec3 weightedVert = ScalarMult(transformedVert, g_boneWeights[row][corner][b]);
				g_vertsRes[row][corner] = VectorAdd(g_vertsRes[row][corner], weightedVert);
			}
			//printVec3(g_vertsRes[row][corner]);
			// ---------=========  UPG 4 ===========---------
			// TODO: skinna meshen mot alla benen.
			//
			// data som du kan använda:
			// g_bonesRes[].rot
			// g_bones[].pos
			// g_boneWeights
			// g_vertsOrg
			// g_vertsRes

		}
	}
}


/////////////////////////////////////////////
//		A N I M A T E  B O N E S
// Desc:	en väldigt enkel animation av skelettet
//			vrider ben 1 i en sin(counter)
void animateBones(void)
{
	int bone;
	// Hur mycket kring varje led? ändra gärna.
	float angleScales[10] = { 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 };

	float time = glutGet(GLUT_ELAPSED_TIME) / 1000.0;
	// Hur mycket skall vi vrida?
	float angle = sin(time * 3.f) / 2.0f;

	memcpy(&g_bonesRes, &g_bones, kMaxBones*sizeof(Bone));

	g_bonesRes[0].rot = Rz(angle * angleScales[0]);

	for (bone = 1; bone < kMaxBones; bone++)
	g_bonesRes[bone].rot = Rz(angle * angleScales[bone]);
}


///////////////////////////////////////////////
//		S E T  B O N E  R O T A T I O N
// Desc:	sätter bone rotationen i vertex shadern
// (Ej obligatorisk.)
void setBoneRotation(void)
{
}


///////////////////////////////////////////////
//		 S E T  B O N E  L O C A T I O N
// Desc:	sätter bone positionen i vertex shadern
// (Ej obligatorisk.)
void setBoneLocation(void)
{
}


///////////////////////////////////////////////
//		 D R A W  C Y L I N D E R
// Desc:	sätter bone positionen i vertex shadern
void DrawCylinder()
{
	animateBones();

	// ---------=========  UPG 2 (extra) ===========---------
	// ersätt DeformCylinder med en vertex shader som gör vad DeformCylinder gör.
	// begynelsen till shaderkoden ligger i filen "ShaderCode.vert" ...
	//

	DeformCylinder();

	// setBoneLocation();
	// setBoneRotation();

	// update cylinder vertices:
	glBindVertexArray(cylinderModel->vao);
	glBindBuffer(GL_ARRAY_BUFFER, cylinderModel->vb);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vec3)*kMaxRow*kMaxCorners, g_vertsRes, GL_DYNAMIC_DRAW);

	DrawModel(cylinderModel, g_shader, "in_Position", "in_Normal", "in_TexCoord");
}


void DisplayWindow()
{
	mat4 m;

	glClearColor(0.4, 0.4, 0.2, 1);
	glClear(GL_COLOR_BUFFER_BIT+GL_DEPTH_BUFFER_BIT);

	m = Mult(projectionMatrix, modelViewMatrix);
	glUniformMatrix4fv(glGetUniformLocation(g_shader, "matrix"), 1, GL_TRUE, m.m);

	DrawCylinder();

	glutSwapBuffers();
};

void OnTimer(int value)
{
	glutPostRedisplay();
	glutTimerFunc(20, &OnTimer, value);
}

void keyboardFunc( unsigned char key, int x, int y)
{
	if(key == 27)	//Esc
	exit(1);
}

void reshape(GLsizei w, GLsizei h)
{
	vec3 cam = {0,0,100};
	vec3 look = {10,0,0};

	glViewport(0, 0, w, h);
	GLfloat ratio = (GLfloat) w / (GLfloat) h;
	projectionMatrix = perspective(90, ratio, 0.1, 1000);
	modelViewMatrix = lookAt(cam.x, cam.y, cam.z,
		look.x, look.y, look.z,
		0,1,0);
}

/////////////////////////////////////////
//		M A I N
//
int main(int argc, char **argv)
{
	glutInit(&argc, argv);

	glutInitWindowSize(512, 512);
	glutInitDisplayMode(GLUT_RGB | GLUT_DOUBLE | GLUT_DEPTH);
	glutInitContextVersion(3, 2); // Might not be needed in Linux
	glutCreateWindow("Them bones, them bones");

	glutDisplayFunc(DisplayWindow);
	glutTimerFunc(20, &OnTimer, 0);
	glutKeyboardFunc( keyboardFunc );
	glutReshapeFunc(reshape);

	g_shader = loadShaders("shader.vert" , "shader.frag");

	// Set up depth buffer
	glEnable(GL_DEPTH_TEST);

	// initiering
#ifdef WIN32
	glewInit();
#endif
	BuildCylinder();
	setupBones();
	initBoneWeights();

	// Build Model from cylinder data
	cylinderModel = LoadDataToModel(
		(GLfloat*) g_vertsRes,
		(GLfloat*) g_normalsRes,
		(GLfloat*) g_boneWeightVis, // texCoords
		NULL, // (GLfloat*) g_boneWeights, // colors
		(GLuint*) g_poly, // indices
		kMaxRow*kMaxCorners,
		kMaxg_poly * 3);

	glutMainLoop();
	exit(0);
}
