#ifndef _MICROGLUT_
#define _MICROGLUT_

#ifdef __cplusplus
extern "C" {
#endif


// If this is not compiled on the Mac, tell me!
#ifndef __APPLE__
	ERROR! This is the Mac version of the MicroGlut header which will not work on other platforms!
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
int glutCreateWindow (char *windowTitle);

void glutSwapBuffers();

// glutGet constants
#define GLUT_ELAPSED_TIME		(700)
#define GLUT_WINDOW_WIDTH		102
#define GLUT_WINDOW_HEIGHT		103
#define GLUT_QUIT_FLAG			801
#define GLUT_MOUSE_POSITION_X	802
#define GLUT_MOUSE_POSITION_Y	803
// This looks less than perfect...
#define GLUT_SCREEN_WIDTH GLUT_WINDOW_WIDTH
#define GLUT_SCREEN_HEIGHT GLUT_WINDOW_HEIGHT
int glutGet(int type);

void glutInitDisplayMode(unsigned int mode);
void glutIdleFunc(void (*func)(void));

// Standard GLUT timer
void glutTimerFunc(int millis, void (*func)(int arg), int arg);
// Ingemar's version
void glutRepeatingTimerFunc(int millis); // Old name, will be removed
void glutRepeatingTimer(int millis);
// New call for polling the keyboard, good for games
char glutKeyIsDown(unsigned char c);
// And for the mouse button(s):
char glutMouseIsDown(unsigned char c);

void glutReshapeWindow(int width, int height);
void glutPositionWindow(int x, int y);
void glutSetWindowTitle(char *title);
void glutInitContextVersion(int major, int minor);

/* Mouse buttons. */
#define GLUT_LEFT_BUTTON		0
// No support for middle yet
#define GLUT_MIDDLE_BUTTON		1
#define GLUT_RIGHT_BUTTON		2

/* Mouse button  state. */
#define GLUT_DOWN			0
#define GLUT_UP				1

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

// Special keys.
#define GLUT_KEY_F1			1
#define GLUT_KEY_F2			2
#define GLUT_KEY_F3			3
#define GLUT_KEY_F4			4
#define GLUT_KEY_F5			5
#define GLUT_KEY_F6			6
#define GLUT_KEY_F7			7
// F8 and up ignored since they are not possible on some keyboards - like mine
//#define GLUT_KEY_LEFT			100
//#define GLUT_KEY_UP				101
//#define GLUT_KEY_RIGHT			102
//#define GLUT_KEY_DOWN			103
//#define GLUT_KEY_PAGE_UP		104
//#define GLUT_KEY_PAGE_DOWN		105
//#define GLUT_KEY_HOME			106
//#define GLUT_KEY_END			107
//#define GLUT_KEY_INSERT			108
// Re-mapped 2015-09-23: Make EVERYTHING "ordinary", no need for "special!"
// I know that these codes mean something else, but none of them mean any keys!
#define GLUT_KEY_LEFT			28
#define GLUT_KEY_UP				29
#define GLUT_KEY_RIGHT			30
#define GLUT_KEY_DOWN			31
#define GLUT_KEY_PAGE_UP		22
#define GLUT_KEY_PAGE_DOWN		23
#define GLUT_KEY_HOME			24
#define GLUT_KEY_END			25
#define GLUT_KEY_INSERT			26
// Visibility
#define GLUT_NOT_VISIBLE		0
#define GLUT_VISIBLE			1

// These feel less important to me
#define GLUT_KEY_ESC			 27
#define GLUT_KEY_TAB			  9
#define GLUT_KEY_RETURN			 13
#define GLUT_KEY_SPACE			' ' 
#define GLUT_KEY_SEMICOLON		';'
#define GLUT_KEY_COMMA			','
#define GLUT_KEY_DECIMAL		'.'
#define GLUT_KEY_GRAVE			'`'
#define GLUT_KEY_QUOTE			'\''
#define GLUT_KEY_LBRACKET		'['
#define GLUT_KEY_RBRACKET		']'
#define GLUT_KEY_BACKSLASH		'\\'
#define GLUT_KEY_SLASH			'/'
#define GLUT_KEY_EQUAL			'='


// Menu support
int glutCreateMenu(void (*func)(int value));
void glutAddMenuEntry(char *name, int value);
void glutAttachMenu(int button);
void glutDetachMenu(int button);
void glutAddSubMenu(char *name, int menu);
void glutSetMenu(int menu);
int glutGetMenu(void);
void glutChangeToMenuEntry(int index, char *name, int value);

// Visibility not-really-support
void glutVisibilityFunc(void (*visibility)(int status));

// Move mouse pointer, conforms with GLUT
void glutWarpPointer(int x, int y);

// New calls: Show/hide mouse pointer. Great for mouse controlled games.
// (Untested and so far missing in Linux/Windows API)
// Rename to GLUT-conforming glutSetCursor?
void glutShowCursor();
void glutHideCursor();

void glutFullScreen();
void glutExitFullScreen();
void glutToggleFullScreen();

void glutExit();

// Placeholders, we only support one window, unlike FreeGlut.
void glutSetWindow(int win);
int glutGetWindow(void);

#ifdef __cplusplus
}
#endif


#endif
