# set this variable to the director in which you saved the common files
commondir = ../common/

all : lab3

lab3 : lab3.c $(commondir)GL_utilities.c $(commondir)VectorUtils3.c $(commondir)loadobj.c $(commondir)LoadTGA.c $(commondir)zpr.c $(commondir)Linux/MicroGlut.c
	gcc -Wall -o lab3 -I$(commondir) -I../common/Linux -DGL_GLEXT_PROTOTYPES lab3.c $(commondir)GL_utilities.c $(commondir)loadobj.c $(commondir)VectorUtils3.c $(commondir)LoadTGA.c $(commondir)zpr.c $(commondir)Linux/MicroGlut.c -lXt -lX11 -lGL -lm

clean :
	rm lab3

