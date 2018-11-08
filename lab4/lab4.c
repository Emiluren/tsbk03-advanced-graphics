// Demo of heavily simplified sprite engine
// by Ingemar Ragnemalm 2009
// used as base for lab 4 in TSBK03.
// OpenGL 3 conversion 2013.

#ifdef __APPLE__
	#include <OpenGL/gl3.h>
	#include "MicroGlut.h"
	// uses framework Cocoa
#else
	#include <GL/gl.h>
	#include "MicroGlut.h"
#endif

#include <stdlib.h>
#include "LoadTGA.h"
#include "SpriteLight.h"
#include "GL_utilities.h"
#include "math.h"

// Lägg till egna globaler här efter behov.
TextureData *sheepFace, *metalFace, *dogFace, *foodFace;
//Decides maximum shenanigans per tick that may be performed by black sheep.
const float maxShenanigans = 0.001f;
const int blackSheepChance = 20;

float cohesionFactor = 0.0012f;
float sheeparationFactor = 0.04f;
float alignmentFactor = 0.005f;

const float maxDist = 40;

//Globals for mouse
bool pressed = false;
FPoint mousePos;
float mouseFactor = 0.02f;

float distance(FPoint a, FPoint b){
	float hdiff = a.h - b.h;
	float vdiff = a.v - b.v;
	return sqrt(hdiff*hdiff + vdiff*vdiff);
}

void SpriteBehavior() {
	// Lägg till din labbkod här. Det går bra att ändra var som helst i
	// koden i övrigt, men mycket kan samlas här. Du kan utgå från den
	// globala listroten, gSpriteRoot, för att kontrollera alla sprites
	// hastigheter och positioner, eller arbeta från egna globaler.


	SpritePtr mySprite = gSpriteRoot;
	do {
		//Reset values for each new boid iteration.
		FPoint cohesionVector = {0, 0};
		FPoint sheeparationVector = {0, 0};
		FPoint alignmentVector = {0, 0};
		int otherSprites = 0;

		SpritePtr other = gSpriteRoot;
		do{
			float dist = distance(mySprite->position, other->position);
			if(mySprite != other && dist < maxDist){
				FPoint toOther = {0, 0}; //Vector from mySprite to other
				toOther.h = other->position.h - mySprite->position.h;
				toOther.v = other->position.v - mySprite->position.v;
				++otherSprites;

				//Cohesion
				cohesionVector.h += toOther.h;
				cohesionVector.v += toOther.v;

				//Sheeparation
				sheeparationVector.h -= fmin(1 / (dist), 0.5f) * toOther.h;
				sheeparationVector.v -= fmin(1 / (dist), 0.5f) * toOther.v;

				//Alignment
				alignmentVector.h += other->speed.h - mySprite->speed.h;
				alignmentVector.v += other->speed.v - mySprite->speed.v;

			}
			other = other->next;
		} while(other != NULL);

		if(pressed){
			float mouseDist = distance(mySprite->position, mousePos);
			mySprite->speed.h += mouseFactor / mouseDist * (mousePos.h - mySprite->position.h);
			mySprite->speed.v += mouseFactor / mouseDist * (mousePos.v - mySprite->position.v);
		}

		mySprite->newSpeed = mySprite->speed;
		mySprite->newSpeed.h *= 0.9999f;
		mySprite->newSpeed.v *= 0.9999f;

		if(otherSprites > 0){
			//Cohesion
			mySprite->newSpeed.h += cohesionFactor * cohesionVector.h / otherSprites;
			mySprite->newSpeed.v += cohesionFactor * cohesionVector.v / otherSprites;
			//Sheeparation
			mySprite->newSpeed.h += sheeparationFactor * sheeparationVector.h / otherSprites;
			mySprite->newSpeed.v += sheeparationFactor * sheeparationVector.v / otherSprites;
			//Alignment
			mySprite->newSpeed.h += alignmentFactor * alignmentVector.h / otherSprites;
			mySprite->newSpeed.v += alignmentFactor * alignmentVector.v / otherSprites;
		}

		//DEBUG STUFF
		// if(mySprite == gSpriteRoot){
		// 	// printf("Cohesion h:%f, v:%f\n", cohesionVector.h, cohesionVector.v);
		// 	// printf("Sheeparation h:%f, v:%f\n", sheeparationVector.h, sheeparationVector.v);
		// 	// printf("Alignment h:%f, v:%f\n", alignmentVector.h, alignmentVector.v);
		// 	// printf("Position h:%f, v:%f\n", mySprite->position.h, mySprite->position.v);
		// 	// printf("Schpeed h:%f, v:%f\n", mySprite->speed.h, mySprite->speed.v);
		//
		// }

		mySprite = mySprite->next;
	} while (mySprite != NULL);

	//Update all speed values
	mySprite = gSpriteRoot;
	do {
		mySprite->speed = mySprite->newSpeed;
		if(mySprite->face == metalFace){
			float angle = (random() % 180) / 3.1415f * maxShenanigans;
			mySprite->speed.h = cos(angle) * mySprite->speed.h - sin(angle) * mySprite->speed.v;
			mySprite->speed.v = sin(angle) * mySprite->speed.h + cos(angle) * mySprite->speed.v;

			//mySprite->speed.h += rand()
		}
		mySprite = mySprite->next;
	} while (mySprite != NULL);
}

// Drawing routine
void Display()
{
	SpritePtr sp;

	glClearColor(0, 0, 0.2, 1);
	glClear(GL_COLOR_BUFFER_BIT+GL_DEPTH_BUFFER_BIT);
	glEnable(GL_TEXTURE_2D);
	glEnable(GL_BLEND);
	glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

	DrawBackground();

	SpriteBehavior(); // Din kod!

	// Loop though all sprites. (Several loops in real engine.)
	sp = gSpriteRoot;
	do
	{
		HandleSprite(sp); // Callback in a real engine
		DrawSprite(sp);
		sp = sp->next;
	} while (sp != NULL);

	glutSwapBuffers();
}

void Reshape(int h, int v)
{
	glViewport(0, 0, h, v);
	gWidth = h;
	gHeight = v;
}

void Timer(int value)
{
	glutTimerFunc(20, Timer, 0);
	glutPostRedisplay();
}

// Example of user controllable parameter
float someValue = 0.0;

void Key(unsigned char key,
         __attribute__((unused)) int x,
         __attribute__((unused)) int y)
{
  switch (key) {
	case 'c':
		cohesionFactor *= 0.999f;
		printf("cohesionFactor now: %f\n", cohesionFactor);
		break;
	case 'C':
		cohesionFactor *= 1.001;
		printf("cohesionFactor now: %f\n", cohesionFactor);
		break;
	case 's':
		sheeparationFactor *= 0.999f;
		printf("sheeparationFactor now: %f\n", sheeparationFactor);
		break;
	case 'S':
		sheeparationFactor *= 1.001;
		printf("sheeparationFactor now: %f\n", sheeparationFactor);
		break;
	case 'a':
		alignmentFactor *= 0.999;
		printf("alignmentFactor now: %f\n", alignmentFactor);
		break;
	case 'A':
		cohesionFactor *= 1.001;
		printf("alignmentFactor now: %f\n", alignmentFactor);
		break;
    case 0x1b:
      exit(0);
  }
}

void Init()
{

	LoadTGATextureSimple("bilder/leaves.tga", &backgroundTexID); // Bakgrund

	sheepFace = GetFace("bilder/sheep.tga"); // Ett f�r
	metalFace = GetFace("bilder/blackie.tga"); // Ett svart f�r
	dogFace = GetFace("bilder/dog.tga"); // En hund
	foodFace = GetFace("bilder/mat.tga"); // Mat

	NewSprite(sheepFace, 100, 200, 1, 1);
	NewSprite(sheepFace, 200, 100, 1.5, -1);
	NewSprite(sheepFace, 250, 200, -1, 1.5);
	NewSprite(metalFace, 0, 0, 0, 0);
	for(int i = 0; i < 100; ++i){
		TextureData* face = rand() % blackSheepChance == 0 ? metalFace : sheepFace;
		NewSprite(face, rand() % 800, rand() % 600, rand() % 6 - 3, rand() % 6 - 3);
	}
}

void mouse(int button, int state, int x, int y){
	printf("Is this even on?\n");
	if(button == 0){
		pressed = !state;
		mousePos.h = x;
		mousePos.v = 600 - y;
	}
}

int main(int argc, char **argv)
{
	glutInit(&argc, argv);
	glutInitDisplayMode(GLUT_RGBA | GLUT_DOUBLE);
	glutInitWindowSize(800, 600);
	glutInitContextVersion(3, 2);
	glutCreateWindow("SpriteLight demo / Flocking");

	glutDisplayFunc(Display);
	glutTimerFunc(20, Timer, 0); // Should match the screen synch
	glutReshapeFunc(Reshape);
	glutKeyboardFunc(Key);
	glutMouseFunc(mouse);

	InitSpriteLight();
	Init();

	glutMainLoop();
	return 0;
}
