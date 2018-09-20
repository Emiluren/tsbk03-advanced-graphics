// Micro-GLUT, bare essentials

// By Ingemar Ragnemalm 2012
// I wrote this since GLUT seems not to have been updated to support
// creation of a 3.2 context on the Mac. You can use FreeGLUT
// which has this support, but I felt I wanted something without the old-style
// material, and that is small enough to include as a single source file.

// 120309 First Win32 version. Incomplete, lacks timers and more. Also, most settings are not supported.
// 130204 Tried to add GL3 and GLEW. No success.
// Forgotten for too long...
// 1508013 Running with all current utities and GLEW, with the psychedelic teapot demo!
// Timers and rescaling enabled, needs testing.
// 150817: Timers and rescaling runs fine!
// Menus and warp pointer are missing, but this looks good enough for "first beta version"!
// Tested mainly with the Psychedelic Teapot example.
// 150919 Added the very useful glutKeyIsDown plus support for key up events.
// 150920: glutInitWindowPosition and glutInitWindowSize are now working
// 150923: Keyboard events now report ASCII values instead of virtual codes. Also, various special keys like arrow keys should work.
// Finally, I have taken some steps to make special key callbacks obsolete by smarter mapping of special keys.
// 151203: Added a stdio window.
// 160222: Fixed a bug affecting glutKeyIsDown (a very important call which works better now).
// 1602??: Added glutWarpPointer, glutHideCursor, glutShowCursor.
// 160309: Added glutFullScreen, glutExitFullScreen, glutToggleFullScreen.
// 170221: Added glutPositionWindow, glutReshapeWindow. Changed default behavior on resize.
// 170913: Added glutMouseIsDown, corrected support for glutMotionFunc (dragging).
// 180131: New solution for console output. The old one stopped for unknown reasons.


#include <windows.h>
#include "glew.h"
#include <gl/gl.h>
#include "MicroGlut.h"
#include <stdio.h>
#include <io.h>
#include <fcntl.h>

#ifndef _WIN32
	This line causes an error if you are not using Windows. It means that you are accidentally compiling the Windows version.
	Have a look at your paths.
#endif

// Vital internal variables

void (*gDisplay)(void);
void (*gReshape)(int width, int height);
void (*gKey)(unsigned char key, int x, int y);
void (*gKeyUp)(unsigned char key, int x, int y);
void (*gSpecialKey)(unsigned char key, int x, int y); // I consider this obsolete!
void (*gSpecialKeyUp)(unsigned char key, int x, int y); // I consider this obsolete!
void (*gMouseMoved)(int x, int y);
void (*gMouseDragged)(int x, int y);
void (*gMouseFunc)(int button, int state, int x, int y);
unsigned int gContextInitMode = GLUT_RGBA | GLUT_DOUBLE | GLUT_DEPTH;
void (*gIdle)(void);
char updatePending = 1;
char gRunning = 1;
int gContextVersionMajor = 0;
int gContextVersionMinor = 0;
char gKeymap[256];
char gButtonPressed[10] = {0,0,0,0,0,0,0,0,0,0};

// Prototype
static void checktimers();

// -----------

// Globals (was in GLViewDataPtr)
//NSOpenGLContext	*m_context;
float lastWidth, lastHeight;
//NSView *theView;

// Enable OpenGL

void EnableOpenGL(HWND hWnd, HDC * hDC, HGLRC * hRC)
{
	PIXELFORMATDESCRIPTOR pfd;
	int format;
	int zdepth, sdepth;
#if defined WGL_CONTEXT_MAJOR_VERSION_ARB
// NOT tested because WGL_CONTEXT_MAJOR_VERSION_ARB is undefined on my computer
	int attribs[] =
	{
		WGL_CONTEXT_MAJOR_VERSION_ARB, 3,
		WGL_CONTEXT_MINOR_VERSION_ARB, 2,
		WGL_CONTEXT_FLAGS_ARB, 0,
		0
	};
#endif	
	// get the device context (DC)
	*hDC = GetDC( hWnd );

	if (gContextInitMode & GLUT_DEPTH)
		zdepth = 32;
	else
		zdepth = 0;
	
	if (gContextInitMode & GLUT_STENCIL)
		sdepth = 32;
	else
		sdepth = 0;
	
	// set the pixel format for the DC
	// MUCH OF THIS SHOULD BE OPTIONAL (like depth and stencil above)!
	ZeroMemory( &pfd, sizeof( pfd ) );
	pfd.nSize = sizeof( pfd );
	pfd.nVersion = 1;
	pfd.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
	pfd.iPixelType = PFD_TYPE_RGBA;
	pfd.cColorBits = 24;
	pfd.cDepthBits = zdepth;
	pfd.iLayerType = PFD_MAIN_PLANE;
	format = ChoosePixelFormat( *hDC, &pfd );
	SetPixelFormat( *hDC, format, &pfd );

#if defined WGL_CONTEXT_MAJOR_VERSION_ARB
// NOT tested because WGL_CONTEXT_MAJOR_VERSION_ARB is undefined on my computer
// Try to support new OpenGL!
	attribs[1] = gContextVersionMajor;
	attribs[3] = gContextVersionMinor;
 
    if(wglewIsSupported("WGL_ARB_create_context") == 1)
    {
		*hRC = wglCreateContextAttribsARB(*hDC,0, attribs);
		wglMakeCurrent(*hDC, *hRC);
	}
	else
	{	//It's not possible to make a GL 3.x context. Use the old style context (GL 2.1 and before)
		// create and enable the render context (RC)
		*hRC = wglCreateContext( *hDC );
		wglMakeCurrent( *hDC, *hRC );
	}
#else
		*hRC = wglCreateContext( *hDC );
		wglMakeCurrent( *hDC, *hRC );
#endif

}

// Disable OpenGL

void DisableOpenGL(HWND hWnd, HDC hDC, HGLRC hRC)
{
	wglMakeCurrent( NULL, NULL );
	wglDeleteContext( hRC );
	ReleaseDC( hWnd, hDC );
}





void glutPostRedisplay()
{
	updatePending = 1;
}

// ------------------ Main program ---------------------

//MGApplication *myApp;
//NSView *view;
//NSWindow *window;
static struct timeval timeStart;

void glutInit(int *argcp, char **argv)
{
	int i;
	int hCrt;
	FILE *hf;

	for (i = 0; i < 256; i++) gKeymap[i] = 0;

	// Make printf work!
	AllocConsole();
//	hCrt = _open_osfhandle(
//		(long) GetStdHandle(STD_OUTPUT_HANDLE),
//		_O_TEXT
//		);
//	hf = _fdopen( hCrt, "w" );
	freopen_s(&hf, "CONOUT$", "w", stdout);
	freopen_s(&hf, "CONOUT$", "w", stderr);
	//	*stdout = *hf;
//	i = setvbuf( stdout, NULL, _IONBF, 0 );
//	printf("stdio output open\n");
}

int gWindowPosX = 10;
int gWindowPosY = 50;
int gWindowWidth = 400;
int gWindowHeight = 400;

void glutInitWindowPosition (int x, int y)
{
	gWindowPosX = x;
	gWindowPosY = y;
}
void glutInitWindowSize (int width, int height)
{
	gWindowWidth = width;
	gWindowHeight = height;
}

HWND hWnd;
HDC hDC;
HGLRC hRC;
HINSTANCE hInstance;

void glutCreateWindow(char *title)
{
	// Convert title to szTitle!
	#define MAX_LOADSTRING 100
	TCHAR szTitle[MAX_LOADSTRING];					// The title bar text
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &title[0], strlen(title), NULL, 0);
    MultiByteToWideChar(CP_UTF8, 0, &title[0], strlen(title), &szTitle[0], size_needed);
	szTitle[size_needed] = 0; // Zero terminate

	// create main window
	hWnd = CreateWindow( 
		"GLSample" /*This is really wrong, should be 16-bit text like the title!*/, szTitle, 
		WS_CAPTION | WS_POPUPWINDOW | WS_VISIBLE | WS_OVERLAPPEDWINDOW, // WS_OVERLAPPEDWINDOW gives rescalable window
		gWindowPosX, gWindowPosY, gWindowWidth, gWindowHeight,
		NULL, NULL, hInstance, NULL );
//	hWnd = CreateWindow( 
//		"GLSample" /*This is really wrong, should be 16-bit text like the title!*/, szTitle, 
//		WS_CAPTION | WS_POPUPWINDOW | WS_VISIBLE | WS_OVERLAPPEDWINDOW, // WS_OVERLAPPEDWINDOW gives rescalable window
//		0, 0, 256, 256,
//		NULL, NULL, hInstance, NULL );
	
	// enable OpenGL for the window
	EnableOpenGL( hWnd, &hDC, &hRC );
}


void glutMainLoop()
{
	BOOL quit = 0;
	MSG msg;
	
	// program main loop
	while ( !quit )
	{
		
		// check for messages
		if ( PeekMessage( &msg, NULL, 0, 0, PM_REMOVE )  )
		{
			// handle or dispatch messages
			if ( msg.message == WM_QUIT ) 
			{
				quit = TRUE;
			} 
			else 
			{
				TranslateMessage( &msg );
				DispatchMessage( &msg );
			}
		} 
		else 
		{
			if (updatePending)
			{
				gDisplay();
				updatePending = 0;
			}
			if (gIdle)
				gIdle();
			// TIMERS!
			checktimers();
		}
	}
}

// This won't work yet
//void glutCheckLoop()
//{
//}

//void glutTimerFunc(int millis, void (*func)(int arg), int arg)
//{
//}

// Added by Ingemar
//void glutRepeatingTimerFunc(int millis)
//{
//}

void glutDisplayFunc(void (*func)(void))
{
	gDisplay = func;
}

void glutReshapeFunc(void (*func)(int width, int height))
{
	gReshape = func;
}

void glutKeyboardFunc(void (*func)(unsigned char key, int x, int y))
{
	gKey = func;
}

void glutKeyboardUpFunc(void (*func)(unsigned char key, int x, int y))
{
	gKeyUp = func;
}

// I consider this obsolete!
void glutSpecialFunc(void (*func)(unsigned char key, int x, int y))
{
	gSpecialKey = func;
}

// I consider this obsolete!
void glutSpecialUpFunc(void (*func)(unsigned char key, int x, int y))
{
	gSpecialKeyUp = func;
}

void glutPassiveMotionFunc(void (*func)(int x, int y))
{
	gMouseMoved = func;
}

void glutMotionFunc(void (*func)(int x, int y))
{
	gMouseDragged = func;
}

void glutMouseFunc(void (*func)(int button, int state, int x, int y))
{
	gMouseFunc = func;
}

// You can safely skip this
void glutSwapBuffers()
{
 	SwapBuffers(hDC);
}

int glutGet(int type)
{
//	struct timeval tv;
	
//	gettimeofday(&tv, NULL);
//	return (tv.tv_usec - timeStart.tv_usec) / 1000 + (tv.tv_sec - timeStart.tv_sec)*1000;

	return GetTickCount();
}

void glutInitDisplayMode(unsigned int mode)
{
	gContextInitMode = mode;
}

void glutIdleFunc(void (*func)(void))
{
//	printf('WARNING! Idle not yet implemented. Use timers instead.\n');
	gIdle = func;
	glutRepeatingTimer(10);
}

char glutKeyIsDown(unsigned char c)
{
	return gKeymap[c];
}

static unsigned char scan2ascii(WPARAM vk, LPARAM scancode)
{
   static HKL layout;
   static unsigned char State[256];
   static unsigned char chars[2];
   int count;

   layout = GetKeyboardLayout(0);
   if (GetKeyboardState(State)==FALSE)
      return 0;
   count = ToAsciiEx(vk,scancode,State,&chars,0,layout);
   if (count > 0) return chars[0];
   else return 0;
}

static void doKeyboardEvent(WPARAM wParam, LPARAM lParam, void (*keyFunc)(unsigned char key, int x, int y), void (specialKeyFunc)(unsigned char key, int x, int y), char keyMapValue)
{
	unsigned char c;

		switch(wParam)
		{
			case VK_F1:
				c = GLUT_KEY_F1; break;
			case VK_F2:
				c = GLUT_KEY_F2; break;
			case VK_F3:
				c = GLUT_KEY_F3; break;
			case VK_F4:
				c = GLUT_KEY_F4; break;
			case VK_F5:
				c = GLUT_KEY_F5; break;
			case VK_F6:
				c = GLUT_KEY_F6; break;
			case VK_F7:
				c = GLUT_KEY_F7; break;
// F8 and up ignored since they are not possible on some keyboards - like mine

			case VK_LEFT:
				c = GLUT_KEY_LEFT; break;
			case VK_UP:
				c = GLUT_KEY_UP; break;
			case VK_RIGHT:
				c = GLUT_KEY_RIGHT; break;
			case VK_DOWN:
				c = GLUT_KEY_DOWN; break;

			case VK_ESCAPE:
				c = GLUT_KEY_ESC; break;
			case VK_PRIOR:
				c = GLUT_KEY_PAGE_UP; break;
			case VK_NEXT:
				c = GLUT_KEY_PAGE_DOWN; break;
			case VK_HOME:
				c = GLUT_KEY_HOME; break;
			case VK_END:
				c = GLUT_KEY_END; break;
			case VK_INSERT:
				c = GLUT_KEY_INSERT; break;
			default:
				c = scan2ascii(wParam,lParam);
				if (c == 0) return;
		}
		if (keyFunc != NULL)
		{
			keyFunc(c, 0, 0); // TO DO: x and y
		}
		else
		if (specialKeyFunc != NULL && c < 32)
		{
			specialKeyFunc(c, 0, 0); // TO DO: x and y
		}
		gKeymap[c] = keyMapValue;
		printf("key %i %i\n", c, keyMapValue);
}


LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
	int x = LOWORD(lParam);
	int y = HIWORD(lParam);
	
	switch (message)
	{
    case WM_LBUTTONUP:
		if (gMouseFunc != NULL)
			gMouseFunc(GLUT_LEFT_BUTTON, GLUT_UP, x, y);
		gButtonPressed[0] = 0;
        break;

    case WM_LBUTTONDOWN:
		if (gMouseFunc != NULL)
			gMouseFunc(GLUT_LEFT_BUTTON, GLUT_DOWN, x, y);
		gButtonPressed[0] = 1;
     break;

    case WM_RBUTTONUP:
		if (gMouseFunc != NULL)
			gMouseFunc(GLUT_RIGHT_BUTTON, GLUT_UP, x, y);
		gButtonPressed[1] = 0;
        break;

    case WM_RBUTTONDOWN:
		if (gMouseFunc != NULL)
			gMouseFunc(GLUT_RIGHT_BUTTON, GLUT_DOWN, x, y);
		gButtonPressed[1] = 1;
     break;

    case WM_MOUSEMOVE:
		if (gMouseMoved != NULL)
			gMouseMoved(x, y);
		if (gButtonPressed[0] || gButtonPressed[1])
			if (gMouseDragged != NULL)
			gMouseDragged(x, y);
    break;

	case WM_CREATE:
		return 0;
		
	case WM_CLOSE:
		PostQuitMessage( 0 );
		return 0;
		
	case WM_DESTROY:
		return 0;
		
	case WM_KEYDOWN:
		doKeyboardEvent(wParam, lParam, gKey, gSpecialKey, 1);
		return 0;
	case WM_KEYUP:
		doKeyboardEvent(wParam, lParam, gKeyUp, gSpecialKeyUp, 0);
		return 0;
	
	case WM_SIZE:
		if (gReshape != NULL)
			gReshape(LOWORD(lParam), HIWORD(lParam));
		else
		{	glViewport(0,0,LOWORD(lParam), HIWORD(lParam));
			glutPostRedisplay();
		}
		break;
	case WM_PAINT: // Don't have Windows fighting us while resize!
		if (gDisplay)
			gDisplay();
		break;
	case WM_ERASEBKGND:
		return 1;
		break;
	default:
		return DefWindowProc( hWnd, message, wParam, lParam );
	}

	return 0;
}


int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, 
				   LPSTR lpCmdLine, int iCmdShow)
{
	WNDCLASS wc;
	HWND hWnd = NULL;
	HDC hDC = NULL;
	HGLRC hRC = NULL;
//	MSG msg;
	BOOL quit = FALSE;
	float theta = 0.0f;
	
	// register window class
	wc.style = CS_OWNDC;
	wc.lpfnWndProc = WndProc;
	wc.cbClsExtra = 0;
	wc.cbWndExtra = 0;
	wc.hInstance = hInstance;
	wc.hIcon = LoadIcon( NULL, IDI_APPLICATION );
	wc.hCursor = LoadCursor( NULL, IDC_ARROW );
	wc.hbrBackground = (HBRUSH)GetStockObject( BLACK_BRUSH );
	wc.lpszMenuName = NULL;
	wc.lpszClassName = "GLSample";
	RegisterClass( &wc );
	
	main();
	
	// shutdown OpenGL
	DisableOpenGL( hWnd, hDC, hRC );
	
	// destroy the window explicitly
	DestroyWindow( hWnd );
	
	return 0;
//	return msg.wParam;	
}










// NOTE: The timer is not designed with any multithreading in mind!
typedef struct TimerRec
{
	int arg;
	int time;
	int repeatTime;
	void (*func)(int arg);
	char repeating;
	struct TimerRec *next;
	struct TimerRec *prev;
} TimerRec;

TimerRec *gTimers = NULL;

void glutTimerFunc(int millis, void (*func)(int arg), int arg)
{
	TimerRec *t	= (TimerRec *)malloc(sizeof(TimerRec));
	t->arg = arg;
	t->time = millis + glutGet(GLUT_ELAPSED_TIME);
	t->repeatTime = 0;
	t->repeating = 0;
	t->func = func;
	t->next = gTimers;
	t->prev = NULL;
	if (gTimers != NULL)
		gTimers->prev = t;
	gTimers = t;
}

// Added by Ingemar
void glutRepeatingTimer(int millis)
{
	TimerRec *t	= (TimerRec *)malloc(sizeof(TimerRec));
	t->arg = 0;
	t->time = millis + glutGet(GLUT_ELAPSED_TIME);
	t->repeatTime = millis;
	t->repeating = 1;
	t->func = NULL;
	t->next = gTimers;
	t->prev = NULL;
	if (gTimers != NULL)
		gTimers->prev = t;
	gTimers = t;
}

// From http://stackoverflow.com/questions/5801813/c-usleep-is-obsolete-workarounds-for-windows-mingw
void usleep(__int64 usec) 
{ 
    HANDLE timer; 
    LARGE_INTEGER ft; 

    ft.QuadPart = -(10*usec); // Convert to 100 nanosecond interval, negative value indicates relative time

    timer = CreateWaitableTimer(NULL, TRUE, NULL); 
    SetWaitableTimer(timer, &ft, 0, NULL, NULL, 0); 
    WaitForSingleObject(timer, INFINITE); 
    CloseHandle(timer); 
}

static void checktimers()
{
	if (gTimers != NULL)
	{
		TimerRec *t, *firethis = NULL;
		int now = glutGet(GLUT_ELAPSED_TIME);
		int nextTime = now + 1000; // Distant future, 1 second
		t = gTimers;
		for (t = gTimers; t != NULL; t = t->next)
		{
			if (t->time < nextTime) nextTime = t->time; // Time for the next one
			if (t->time < now) // See if this is due to fire
			{
				firethis = t;
			}
		}
		if (firethis != NULL)
		{
		// Fire the timer
			if (firethis->func != NULL)
				firethis->func(firethis->arg);
			else
				glutPostRedisplay();
		// Remove the timer if it was one-shot, otherwise update the time
			if (firethis->repeating)
			{
				firethis->time = now + firethis->repeatTime;
			}
			else
			{
				if (firethis->prev != NULL)
					firethis->prev->next = firethis->next;
				else
					gTimers = firethis->next;
                if (firethis->next != NULL)
					firethis->next->prev = firethis->prev;
				free(firethis);
			}
		}
		// Otherwise, sleep until any timer should fire
        if (!updatePending)
			if (nextTime > now)
            {
		usleep((nextTime - now)*1000);
            }
	}
    else
// If no timer and no update, sleep a little to keep CPU load low
        if (!updatePending)
            usleep(10);
}

void glutInitContextVersion(int major, int minor)
{
	gContextVersionMajor = major;
	gContextVersionMinor = minor;
}


void glutHideCursor()
{
	ShowCursor(0);
}

void glutShowCursor()
{
	ShowCursor(1);
}

void glutWarpPointer(int x, int y)
{
	POINT coords;
	coords.x = x;
	coords.y = y;
	ClientToScreen(hWnd, &coords);
	SetCursorPos(coords.x, coords.y);
}






// ----------------------------- Full-screen mode support! ---------------------------------

static int savedWidth;
static int savedHeight;
static int savedColourBits;
static int savedRefreshRate;
static int savedXPosition;
static int savedYPosition;

// This can be useful if you want to change the resolution.
static int enterFullscreenExt(HWND hwnd, int fullscreenWidth, int fullscreenHeight, int colourBits, int refreshRate)
{
    DEVMODE fullscreenSettings;
    int isChangeSuccessful=0;
    RECT windowBoundary;
	HDC windowHDC;
	
	GetWindowRect(hwnd, &windowBoundary);
	savedWidth  = windowBoundary.right - windowBoundary.left;
	savedHeight = windowBoundary.bottom - windowBoundary.top;
	savedXPosition = windowBoundary.left;
	savedYPosition = windowBoundary.top;

    EnumDisplaySettings(NULL, 0, &fullscreenSettings);
    fullscreenSettings.dmPelsWidth        = fullscreenWidth;
    fullscreenSettings.dmPelsHeight       = fullscreenHeight;
    fullscreenSettings.dmBitsPerPel       = colourBits;
    fullscreenSettings.dmDisplayFrequency = refreshRate;
    fullscreenSettings.dmFields           = DM_PELSWIDTH |
                                            DM_PELSHEIGHT |
                                            DM_BITSPERPEL |
                                            DM_DISPLAYFREQUENCY;

    SetWindowLongPtr(hwnd, GWL_EXSTYLE, WS_EX_APPWINDOW | WS_EX_TOPMOST);
    SetWindowLongPtr(hwnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);
    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, fullscreenWidth, fullscreenHeight, SWP_SHOWWINDOW);
//    isChangeSuccessful = ChangeDisplaySettings(&fullscreenSettings, CDS_FULLSCREEN) == DISP_CHANGE_SUCCESSFUL;
    ShowWindow(hwnd, SW_MAXIMIZE);

    return isChangeSuccessful;
}

static int enterFullscreen(HWND hwnd)
{
	int fullscreenWidth;
	int fullscreenHeight;
	int colourBits;
	int refreshRate;
	HDC windowHDC;
	
	windowHDC = GetDC(hwnd);
	fullscreenWidth  = GetDeviceCaps(windowHDC, HORZRES);
	fullscreenHeight = GetDeviceCaps(windowHDC, VERTRES);
	colourBits       = GetDeviceCaps(windowHDC, BITSPIXEL);
	refreshRate      = GetDeviceCaps(windowHDC, VREFRESH);

	return enterFullscreenExt(hwnd, fullscreenWidth, fullscreenHeight, colourBits, refreshRate);
}

static int exitFullscreen(HWND hwnd)
{
    int isChangeSuccessful;

    SetWindowLongPtr(hwnd, GWL_EXSTYLE, WS_EX_LEFT);
    SetWindowLongPtr(hwnd, GWL_STYLE, WS_OVERLAPPEDWINDOW | WS_VISIBLE);
    isChangeSuccessful = ChangeDisplaySettings(NULL, CDS_RESET) == DISP_CHANGE_SUCCESSFUL;
    SetWindowPos(hwnd, HWND_NOTOPMOST, savedXPosition, savedYPosition, savedWidth, savedHeight, SWP_SHOWWINDOW);
    ShowWindow(hwnd, SW_RESTORE);

    return isChangeSuccessful;
}

int isFullScreen = 0;

void glutFullScreen()
{
	if (!isFullScreen)
		enterFullscreen(hWnd);
	isFullScreen = 1;
}

void glutExitFullScreen()
{
	if (isFullScreen)
		exitFullscreen(hWnd);
	isFullScreen = 0;
}

void glutToggleFullScreen()
{
	if (!isFullScreen)
		enterFullscreen(hWnd);
	else
		exitFullscreen(hWnd);
	isFullScreen = !isFullScreen;
}

// Added 2017-02-21
void glutPositionWindow(int x, int y)
{
	RECT r;
	GetWindowRect(hWnd, &r);
	MoveWindow(hWnd, x, y, r.right-r.left, r.bottom-r.top, TRUE);
}

void glutReshapeWindow(int width, int height)
{
	RECT r;
	GetWindowRect(hWnd, &r);
	MoveWindow(hWnd, r.left, r.top, width, height, TRUE);
}

char glutMouseIsDown(unsigned int c)
{
	return gButtonPressed[c];
}
