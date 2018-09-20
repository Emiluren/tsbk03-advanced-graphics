#ifndef _MICROGLUT_
#define _MICROGLUT_

#ifdef __cplusplus
extern "C" {
#endif

// If this is compiled on the Mac or Windows, tell me!
#ifdef __APPLE__
	ERROR! This is NOT the Mac version of MicroGlut and will not work on the Mac!
#endif
#ifdef _WIN32
	ERROR! This is NOT the Windows version of MicroGlut and will not work on Windows!
#endif

// Same or similar to old GLUT calls
void glutMainLoop();
void glutCheckLoop();
void glutInit(int *argcp, char **argv);
void glutPostRedisplay();

void glutReshapeFunc(void (*func)(int width, int height));
void glutDisplayFunc(void (*func)(void));
void glutKeyboardFunc(void (*func)(unsigned char key, int x, int y));
void glutKeyboardUpFunc(void (*func)(unsigned char key, int x, int y));
void glutSpecialFunc(void (*func)(unsigned char key, int x, int y));
void glutSpecialUpFunc(void (*func)(unsigned char key, int x, int y));

void glutMouseFunc(void (*func)(int button, int state, int x, int y));
void glutPassiveMotionFunc(void (*func)(int x, int y));
void glutMotionFunc(void (*func)(int x, int y));

void glutInitWindowPosition (int x, int y);
void glutInitWindowSize (int width, int height);
void glutCreateWindow (const char *windowTitle);

void glutSwapBuffers();

#define GLUT_ELAPSED_TIME		(700)
#define GLUT_WINDOW_WIDTH		(102)
#define GLUT_WINDOW_HEIGHT		(103)
#define GLUT_MOUSE_POSITION_X		(802)
#define GLUT_MOUSE_POSITION_Y		(803)
// #define GLUT_QUIT_FLAG			(801)
// To do: quit flag
int glutGet(int type);

void glutInitDisplayMode(unsigned int mode);
void glutIdleFunc(void (*func)(void));

// Standard GLUT timer
void glutTimerFunc(int millis, void (*func)(int arg), int arg);
// Ingemar's version
void glutRepeatingTimer(int millis);
 // Old name, will be removed:
#define glutRepeatingTimerFunc glutRepeatingTimer

// New call for polling the keyboard, good for games
char glutKeyIsDown(unsigned char c);
// And the same for the mouse
char glutMouseIsDown(unsigned char c);

void glutWarpPointer( int x, int y );
void glutShowCursor();
void glutHideCursor();

void glutReshapeWindow(int width, int height);
void glutPositionWindow(int x, int y);
void glutSetWindowTitle(char *title);
void glutInitContextVersion(int major, int minor);

void glutFullScreen();
void glutExitFullScreen();
void glutToggleFullScreen();
void glutExit();

/* Mouse buttons. */
#define GLUT_LEFT_BUTTON		0
// No support for middle yet
#define GLUT_MIDDLE_BUTTON		1
#define GLUT_RIGHT_BUTTON		2

/* Mouse button  state. */
#define GLUT_DOWN			0
#define GLUT_UP				1

// Special keys.
// I am reusing unused ASCII codes with no mercy!
#define GLUT_KEY_F1			1
#define GLUT_KEY_F2			2
#define GLUT_KEY_F3			3
#define GLUT_KEY_F4			4
#define GLUT_KEY_F5			5
#define GLUT_KEY_F6			6
#define GLUT_KEY_F7			7
// F8 and up ignored since they are not possible on some keyboards - like mine
#define GLUT_KEY_LEFT			28
#define GLUT_KEY_UP				29
#define GLUT_KEY_RIGHT			30
#define GLUT_KEY_DOWN			31
#define GLUT_KEY_PAGE_UP		22
#define GLUT_KEY_PAGE_DOWN		23
#define GLUT_KEY_HOME			24
#define GLUT_KEY_END			25
#define GLUT_KEY_INSERT			26

#define GLUT_KEY_LEFT_SHIFT		14
#define GLUT_KEY_RIGHT_SHIFT	15
#define GLUT_KEY_CONTROL		16
#define GLUT_KEY_ALT			17
#define GLUT_KEY_COMMAND		18
#define GLUT_KEY_KEYPAD5		19
#define GLUT_KEY_KEYPAD_NUMLOCK	20

// These obvious ones...
#define GLUT_KEY_ESC			27
#define GLUT_KEY_TAB			9
#define GLUT_KEY_RETURN			13
// more


// Only some modes supported
#define GLUT_STENCIL			32
#define GLUT_MULTISAMPLE		128
//#define GLUT_STEREO			256
#define GLUT_RGB			0
#define GLUT_RGBA			GLUT_RGB
#define GLUT_ALPHA			GLUT_RGB
#define GLUT_SINGLE			0
#define GLUT_DOUBLE			2
#define GLUT_DEPTH			16


#ifdef __cplusplus
}
#endif


#endif
