all :  lab0

lab0: lab0.c ../common/GL_utilities.c ../common/VectorUtils3.c ../common/LoadTGA.c ../common/loadobj.c ../common/Linux/MicroGlut.c
	gcc -Wall -o lab0 -DGL_GLEXT_PROTOTYPES lab0.c ../common/GL_utilities.c ../common/VectorUtils3.c ../common/LoadTGA.c ../common/loadobj.c ../common/Linux/MicroGlut.c -I../common -I../common/Linux -lm -lGL -lX11

clean :
	rm lab0

