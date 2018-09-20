// LoadOBJ
// by Ingemar Ragnemalm 2005, 2008
// Developed with CodeWarrior and Lightweight IDE on Mac OS/Mac OSX

// Extended version with LoadModelPlus
// 120913: Revised LoadModelPlus/DrawModel by Jens.
// Partially corrected formatting. (It is a mess!)
// 130227: Error reporting in DrawModel
// 130422: Added ScaleModel
// 150909: Frees up temporary "Mesh" memory i LoadModel. Thanks to Simon Keisala for finding this!
// Added DisposeModel. Limited the number of error printouts, thanks to Rasmus Hytter for this suggestion!
// 160302: Uses fopen_s on Windows, as suggested by Jesper Post. Should reduce warnings a bit.
// 160510: Uses calloc instead of malloc (for safety) in many places where it could possibly cause problems.
// 170406: Added "const" to string arguments to make C++ happier.

#include "loadobj.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define PI 3.141592


typedef struct Mesh
{
	GLfloat	*vertices;
	int		vertexCount;
	GLfloat	*vertexNormals;
	int		normalsCount; // Same as vertexCount for generated normals
	GLfloat	*textureCoords;
	int		texCount;
	
	int		*coordIndex;
	int		*normalsIndex;
	int		*textureIndex;
	int		coordCount; // Number of indices in each index struct
	
//	int		*triangleCountList;
//	int		**vertexToTriangleTable;

	// Borders between groups
	int		*coordStarts;
	int		groupCount;
//	int		*normalStarts;
//	int		*texStarts;

	GLfloat radius; // Enclosing sphere
	GLfloat radiusXZ; // For cylindrical tests
} Mesh, *MeshPtr;



#define vToken			1
#define vnToken			2
#define vtToken			3
#define kReal			4
#define kInt			5
#define tripletToken	6
#define fToken			7
#define crlfToken		8
#define kEOF			9
#define kUnknown		10
#define gToken		11
#define mtllibToken		12
#define usemtlToken		13


static FILE *fp;

static int intValue[3];
static float floatValue[3];
static int vertCount, texCount, normalsCount, coordCount;
//static int groupCount; // Number of "g" found.

#ifndef false
#define false 0
#endif
#ifndef true
#define true 1
#endif
#ifndef bool
#define bool char
#endif

static bool hasPositionIndices;
static bool hasNormalIndices;
static bool hasTexCoordIndices;

static bool atLineEnd; // Helps SkipToCRLF


static void OBJGetToken(int * tokenType)
{
	char c;
	char s[255];
	int i;
	
	// 1. skip space. Check for #, skip line when found
	c = getc(fp);
	while (c == 32 || c == 9 || c == '#')
	{
		while (c == '#')
			while (c != 13 && c != 10 && c != EOF)
				c = getc(fp); // Skip comment
		c = getc(fp);
	}
	
	// Inspect first character. Bracket, number, other?
	
	if (c == 13 || c == 10)
	{
		*tokenType = crlfToken;
		//		while (c == 13 && c == 10)
		//				c = getc(fp);
	}
	else
	if ((c >= '0' && c <= '9') || c == '-' || c == '.') // Numerical value
	{
		*tokenType = kInt;
		i = 0;
		while (c != 13 && c != 10 && c != 32 && c != 9 && c != '/' && c != EOF)
		{
			if (c == '.' || c == 'E')
				*tokenType = kReal;
			s[i++] = c;
			c = getc(fp);
		}
		s[i] = 0;
		sscanf(s, "%f", &floatValue[0]);
		sscanf(s, "%d", &intValue[0]);
		// Check for /
		if (c == '/') // parse another number
		{
			c = getc(fp);
			i = 0;
			while (c != 13 && c != 10 && c != 32 && c != 9 && c != '/' && c != EOF)
			{
				s[i++] = c;
				c = getc(fp);
			}
			s[i] = 0;
			
			if (i == 0)
			{
				floatValue[1] = -1;
				intValue[1] = -1;
			}
			else
			{
				sscanf(s, "%f", &floatValue[1]);
				sscanf(s, "%d", &intValue[1]);
			}
			*tokenType = tripletToken;
		}
		if (c == '/') // parse one more number
		{
			c = getc(fp);
			i = 0;
			while (c != 13 && c != 10 && c != 32 && c != 9 && c != '/' && c != EOF)
			{
				s[i++] = c;
				c = getc(fp);
			}
			s[i] = 0;

			if (i == 0)
			{
				floatValue[2] = -1;
				intValue[2] = -1;
			}
			else
			{
				sscanf(s, "%f", &floatValue[2]);
				sscanf(s, "%i", &intValue[2]);
			}
			*tokenType = tripletToken;
		}
	}
	else
	if (c == EOF)
	{
		*tokenType = kEOF;
	}
	else // Other
	{
		i = 0;
		while (c != 13 && c != 10 && c != 32 && c != 9 && c != EOF)
		{
			s[i++] = c;
			c = getc(fp);
		}
		s[i] = 0;
		
		*tokenType = kUnknown;
		// Compare string to symbols
		
		if (strcmp(s, "v") == 0)
			*tokenType = vToken;
		if (strcmp(s, "vn") == 0)
			*tokenType = vnToken;
		if (strcmp(s, "vt") == 0)
			*tokenType = vtToken;
		if (strcmp(s, "f") == 0)
			*tokenType = fToken;
		if (strcmp(s, "g") == 0) // group
			*tokenType = gToken;
		if (strcmp(s, "mtllib") == 0)
			*tokenType = mtllibToken;
		if (strcmp(s, "usemtl") == 0)
			*tokenType = usemtlToken;
//		if (strcmp(s, "o") == 0) // "o" means...?
//			*tokenType = oToken;
	}
	atLineEnd = (c == 13 || c == 10);
} // ObjGetToken

static void SkipToCRLF()
{
	char c = 0;
	
	if (!atLineEnd)
		while (c != 10 && c != 13 && c != EOF)
			c = getc(fp);
}

static void ReadOneVertex(MeshPtr theMesh)
{
	GLfloat x, y, z;
	int tokenType;

	// Three floats expected
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		x = floatValue[0];
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		y = floatValue[0];
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		z = floatValue[0];
	SkipToCRLF();
	
	// Write to array if it exists
	if (theMesh->vertices != NULL)
		{
			theMesh->vertices[vertCount++] = x;
			theMesh->vertices[vertCount++] = y;
			theMesh->vertices[vertCount++] = z;
		}
	else
		vertCount = vertCount + 3;
}

static void ReadOneTexture(MeshPtr theMesh)
{
	int tokenType;
	GLfloat s, t;

	// Two floats expected
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		s = floatValue[0];
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		t = floatValue[0];
	SkipToCRLF();
	
	// Write to array if it exists
	if (theMesh->textureCoords != NULL)
	{
		theMesh->textureCoords[texCount++] = s;
		theMesh->textureCoords[texCount++] = t;
	}
	else
		texCount = texCount + 2;
}

static void ReadOneNormal(MeshPtr theMesh)
{
	int tokenType;
	GLfloat x, y, z;

	// Three floats expected
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		x = floatValue[0];
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		y = floatValue[0];
	OBJGetToken(&tokenType);
	if (tokenType == kInt || tokenType == kReal)
		z = floatValue[0];
	SkipToCRLF();
	
	// Write to array if it exists
	if (theMesh->vertexNormals != NULL)
	{
		theMesh->vertexNormals[normalsCount++] = x;
		theMesh->vertexNormals[normalsCount++] = y;
		theMesh->vertexNormals[normalsCount++] = z;
	}
	else
		normalsCount = normalsCount + 3;
}

static void ReadOneFace(MeshPtr theMesh)
{
	int tokenType;
	bool triplets = false;

	// OBS! Unknown number! Can be one single vertex index or a triplet
	do
	{
		OBJGetToken(&tokenType);
	
		switch (tokenType)
		{
		case kReal: // Real should not happen
		case kInt:
			if (intValue[0] != 0)
			{
				hasPositionIndices = true;

				// Single index
				if (theMesh->coordIndex != NULL)
				{
					if (intValue[0] >= 0)
						theMesh->coordIndex[coordCount] = intValue[0]-1;
					else
						theMesh->coordIndex[coordCount] =
							vertCount / 3 + intValue[0];
				}
			}
		break;
		case tripletToken:
		// Triplet (out of which some may be missing)

		if (intValue[0] != 0)
		{
			hasPositionIndices = true;

			if (theMesh->coordIndex != NULL)
			{
				if (intValue[0] > 0)
					theMesh->coordIndex[coordCount] = intValue[0]-1;
				else
					theMesh->coordIndex[coordCount] =
						vertCount+intValue[0];
			}
		}
		if (intValue[1] != 0)
		{
			hasTexCoordIndices = true;

			if (theMesh->textureIndex != NULL)
			{
				if (intValue[1] > 0)
					theMesh->textureIndex[coordCount] = intValue[1]-1;
				else
					theMesh->textureIndex[coordCount] =
						texCount / 2 + intValue[1];
			}
			}
		if (intValue[2] != 0)
		{
			hasNormalIndices = true;

			if (theMesh->normalsIndex != NULL)
			{
				if (intValue[2] >= 0)
					theMesh->normalsIndex[coordCount] = intValue[2]-1;
				else
					theMesh->normalsIndex[coordCount] = 
						normalsCount / 3 + intValue[2];
				}
			}
			triplets = true;
			break;
		}

		coordCount++;
	}
	while ((tokenType != kEOF) && (tokenType != crlfToken) && !atLineEnd);

	// Terminate polygon with -1 (like VRML)
	if (theMesh->coordIndex != NULL)
	{
		theMesh->coordIndex[coordCount] = -1;
	}
	if (triplets)
	{
		if (theMesh->textureIndex != NULL)
		{
			theMesh->textureIndex[coordCount] = -1;
		}
		if (theMesh->normalsIndex != NULL)
		{
			theMesh->normalsIndex[coordCount] = -1;
		}
	}

	coordCount++;
}

static void ParseOBJ(MeshPtr theMesh)
{
	int tokenType;
	
	tokenType = 0;
	while (tokenType != kEOF)
	{
		OBJGetToken(&tokenType);
		switch (tokenType)
		{
		case vToken:
			ReadOneVertex(theMesh);
			break;
		case vnToken:
			ReadOneNormal(theMesh);
			break;
		case vtToken:
			ReadOneTexture(theMesh);
			break;
		case fToken:
			ReadOneFace(theMesh);
			break;
		case kReal:
			// Ignore
			break;
		case crlfToken:
			break;
		case kUnknown:
			SkipToCRLF();
			//while (tokenType != crlfToken && tokenType != kEOF)
			//	OBJGetToken(&tokenType);
			break;
		case gToken: // New part!
			// Expand the index start lists
			printf("Found part\n");
			if (coordCount > 0) // If no data has been seen, this must be the first group!
			{
				theMesh->groupCount += 1;
				if (theMesh->coordStarts != NULL) // NULL if we are just counting
				{
					theMesh->coordStarts = realloc(theMesh->coordStarts, (theMesh->groupCount+1)*sizeof(int));
					theMesh->coordStarts[theMesh->groupCount] = coordCount;
				}
				printf("groupCount = %d\n", theMesh->groupCount);
			}
			// May also read group name here!
			SkipToCRLF();
			break;
		case mtllibToken: // Material spec library
			// TO DO
			//ReadMaterialLibrary(???);
			SkipToCRLF();
			break;
		case usemtlToken: // Use material!
			// TO DO
			//ReadMaterial(???);
			// Save to Mesh material data
			SkipToCRLF();
			break;
		}
	}
}

// Load raw, unprocessed OBJ data!
static struct Mesh * LoadOBJ(const char *filename)
{
	// Opens file to fp
	// Reads once to find sizes
	// Reads again to fill buffers
	
	Mesh *theMesh;
	
	// Allocate Mesh but not the buffers
	theMesh = malloc(sizeof(Mesh));
	theMesh->coordIndex = NULL;
	theMesh->vertices = NULL;
	// ProcessMesh may deal with these
//	theMesh->triangleCountList = NULL;
	theMesh->vertexNormals = NULL;
//	theMesh->vertexToTriangleTable = NULL;
	theMesh->textureCoords = NULL;
	theMesh->textureIndex = NULL;
	theMesh->normalsIndex = NULL;

	hasPositionIndices = true;
	hasTexCoordIndices = false;
	hasNormalIndices = false;

	theMesh->coordStarts = NULL;
	theMesh->groupCount = 0;

	vertCount=0;
	texCount=0;
	normalsCount=0;
	coordCount=0;
	
	// It seems Windows/VS doesn't like fopen any more, but fopen_s is not on the others.
	#if defined(_WIN32)
		fopen_s(&fp, filename, "r");
	#else
		fp = fopen(filename, "rb"); // rw works everywhere except Windows?
	#endif
	if (fp == NULL)
	{
		fprintf(stderr, "Unable to open file '%s'\n", filename);
		fflush(stderr);
		return NULL;
	}
	// Parse for size
	ParseOBJ(theMesh);
	fclose(fp);

	// Allocate arrays!
	if (vertCount > 0)
		theMesh->vertices = malloc(sizeof(GLfloat) * vertCount);
	if (texCount > 0)
		theMesh->textureCoords = malloc(sizeof(GLfloat) * texCount);
	if (normalsCount > 0)
		theMesh->vertexNormals = malloc(sizeof(GLfloat) * normalsCount);
	if (hasPositionIndices)
//		theMesh->coordIndex = malloc(sizeof(int) * coordCount);
		theMesh->coordIndex = calloc(coordCount, sizeof(int));
	if (hasNormalIndices)
//		theMesh->normalsIndex = malloc(sizeof(int) * coordCount);
		theMesh->normalsIndex = calloc(coordCount, sizeof(int));
	if (hasTexCoordIndices)
//		theMesh->textureIndex = malloc(sizeof(int) * coordCount);
		theMesh->textureIndex = calloc(coordCount, sizeof(int));

	theMesh->coordStarts = malloc(sizeof(int));
	theMesh->coordStarts[0] = 0;
	theMesh->groupCount = 0;

	// Zero again
	vertCount=0;
	texCount=0;
	normalsCount=0;
	coordCount=0;

	// It seems Windows/VS doesn't like fopen any more, but fopen_s is not on the others.
	#if defined(_WIN32)
		fopen_s(&fp, filename, "r");
	#else
		fp = fopen(filename, "rb"); // rw works everywhere except Windows?
	#endif
//	fp = fopen(filename, "rb");
	if (fp == NULL) return NULL;
	// Parse again for filling buffers
	ParseOBJ(theMesh);
	fclose(fp);
	
	theMesh->vertexCount = vertCount/3;
	theMesh->coordCount = coordCount;
	
	// Counters for tex and normals, texCount and normalsCount
	theMesh->texCount = texCount/2;
	theMesh->normalsCount = normalsCount/3; // Should be the same as vertexCount!
	// This assumption could make handling of some models break!
	
	// Add a finish to coordStarts
	if (theMesh->coordStarts != NULL)
	{
		theMesh->coordStarts = realloc(theMesh->coordStarts, (theMesh->groupCount+1)*sizeof(int));
		theMesh->coordStarts[theMesh->groupCount+1] = coordCount;
}

	return theMesh;
}

void DecomposeToTriangles(struct Mesh *theMesh)
{
	int i, vertexCount, triangleCount;
	int *newCoords, *newNormalsIndex, *newTextureIndex;
	int newIndex = 0; // Index in newCoords
	int first = 0;

	// 1. Bygg om hela modellen till trianglar
	// 1.1 Calculate how big the list will become
	
	vertexCount = 0; // Number of vertices in current polygon
	triangleCount = 0; // Resulting number of triangles
	for (i = 0; i < theMesh->coordCount; i++)
	{
		if (theMesh->coordIndex[i] == -1)
		{
		if (vertexCount > 2) triangleCount += vertexCount - 2;
			vertexCount = 0;
		}
		else
		{
			vertexCount = vertexCount + 1;
		}
	}
	
	fprintf(stderr, "Found %d triangles\n", triangleCount);
	
//	newCoords = malloc(sizeof(int) * triangleCount * 3);
	newCoords = calloc(triangleCount * 3, sizeof(int));
	if (theMesh->normalsIndex != NULL)
//		newNormalsIndex = malloc(sizeof(int) * triangleCount * 3);
		newNormalsIndex = calloc(triangleCount * 3, sizeof(int));
	if (theMesh->textureIndex != NULL)
//		newTextureIndex = malloc(sizeof(int) * triangleCount * 3);
		newTextureIndex = calloc(triangleCount * 3, sizeof(int));
	
	// 1.2 Loop through old list and write the new one
	// Almost same loop but now it has space to write the result
	vertexCount = 0;
	for (i = 0; i < theMesh->coordCount; i++)
	{
		if (theMesh->coordIndex[i] == -1)
		{
			first = i + 1;
			vertexCount = 0;
		}
		else
		{
			vertexCount = vertexCount + 1;

			if (vertexCount > 2)
			{
				newCoords[newIndex++] = theMesh->coordIndex[first];
				newCoords[newIndex++] = theMesh->coordIndex[i-1];
				newCoords[newIndex++] = theMesh->coordIndex[i];
				
				if (theMesh->normalsIndex != NULL)
				{
					newNormalsIndex[newIndex-3] = theMesh->normalsIndex[first];
					newNormalsIndex[newIndex-2] = theMesh->normalsIndex[i-1];
					newNormalsIndex[newIndex-1] = theMesh->normalsIndex[i];
				}
				
				// Dito for textures
				if (theMesh->textureIndex != NULL)
				{
					newTextureIndex[newIndex-3] = theMesh->textureIndex[first];
					newTextureIndex[newIndex-2] = theMesh->textureIndex[i-1];
					newTextureIndex[newIndex-1] = theMesh->textureIndex[i];
				}
			
			}
		}
	}
	
	free(theMesh->coordIndex);
	theMesh->coordIndex = newCoords;
	theMesh->coordCount = triangleCount * 3;
	if (theMesh->normalsIndex != NULL)
	{
		free(theMesh->normalsIndex);
		theMesh->normalsIndex = newNormalsIndex;
	}
	if (theMesh->textureIndex != NULL)
	{
		free(theMesh->textureIndex);
		theMesh->textureIndex = newTextureIndex;
	}
} // DecomposeToTriangles


static void GenerateNormals(Mesh* mesh)
{
	// If model has vertices but no vertexnormals, generate normals
	if (mesh->vertices && !mesh->vertexNormals)
	{
		int face;
		int normalIndex;

		mesh->vertexNormals = malloc(3 * sizeof(GLfloat) * mesh->vertexCount);
		memset(mesh->vertexNormals, 0, 3 * sizeof(GLfloat) * mesh->vertexCount);

		mesh->normalsCount = mesh->vertexCount;

//		mesh->normalsIndex = malloc(sizeof(GLuint) * mesh->coordCount);
		mesh->normalsIndex = calloc(mesh->coordCount, sizeof(GLuint));
		memcpy(mesh->normalsIndex, mesh->coordIndex,
			sizeof(GLuint) * mesh->coordCount);

		for (face = 0; face * 3 < mesh->coordCount; face++)
		{
			int i0 = mesh->coordIndex[face * 3 + 0];
			int i1 = mesh->coordIndex[face * 3 + 1];
			int i2 = mesh->coordIndex[face * 3 + 2];
			
			GLfloat* vertex0 = &mesh->vertices[i0 * 3];
			GLfloat* vertex1 = &mesh->vertices[i1 * 3];
			GLfloat* vertex2 = &mesh->vertices[i2 * 3];

			float v0x = vertex1[0] - vertex0[0];
			float v0y = vertex1[1] - vertex0[1];
			float v0z = vertex1[2] - vertex0[2];

			float v1x = vertex2[0] - vertex0[0];
			float v1y = vertex2[1] - vertex0[1];
			float v1z = vertex2[2] - vertex0[2];

			float v2x = vertex2[0] - vertex1[0];
			float v2y = vertex2[1] - vertex1[1];
			float v2z = vertex2[2] - vertex1[2];

			float sqrLen0 = v0x * v0x + v0y * v0y + v0z * v0z;
			float sqrLen1 = v1x * v1x + v1y * v1y + v1z * v1z;
			float sqrLen2 = v2x * v2x + v2y * v2y + v2z * v2z;

			float len0 = (sqrLen0 >= 1e-6) ? sqrt(sqrLen0) : 1e-3;
			float len1 = (sqrLen1 >= 1e-6) ? sqrt(sqrLen1) : 1e-3;
			float len2 = (sqrLen2 >= 1e-6) ? sqrt(sqrLen2) : 1e-3;

			float influence0 = (v0x * v1x + v0y * v1y + v0z * v1z) / (len0 * len1);
			float influence1 = -(v0x * v2x + v0y * v2y + v0z * v2z) / (len0 * len2);
			float influence2 = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);

			float angle0 = (influence0 >= 1.f) ? 0 : 
				(influence0 <= -1.f) ? PI : acos(influence0);
			float angle1 = (influence1 >= 1.f) ? 0 : 
				(influence1 <= -1.f) ? PI : acos(influence1);
			float angle2 = (influence2 >= 1.f) ? 0 : 
				(influence2 <= -1.f) ? PI : acos(influence2);

			float normalX = v1z * v0y - v1y * v0z;
			float normalY = v1x * v0z - v1z * v0x;
			float normalZ = v1y * v0x - v1x * v0y;

			GLfloat* normal0 = &mesh->vertexNormals[i0 * 3];
			GLfloat* normal1 = &mesh->vertexNormals[i1 * 3];
			GLfloat* normal2 = &mesh->vertexNormals[i2 * 3];

			normal0[0] += normalX * angle0;
			normal0[1] += normalY * angle0;
			normal0[2] += normalZ * angle0;

			normal1[0] += normalX * angle1;
			normal1[1] += normalY * angle1;
			normal1[2] += normalZ * angle1;

			normal2[0] += normalX * angle2;
			normal2[1] += normalY * angle2;
			normal2[2] += normalZ * angle2;
		}

		for (normalIndex = 0; normalIndex < mesh->normalsCount; normalIndex++)
		{
			GLfloat* normal = &mesh->vertexNormals[normalIndex * 3];
			float length = sqrt(normal[0] * normal[0] + normal[1] * normal[1]
							+ normal[2] * normal[2]);
			float reciprocalLength = 1.f;

			if (length > 0.01f)
				reciprocalLength = 1.f / length;

			normal[0] *= reciprocalLength;
			normal[1] *= reciprocalLength;
			normal[2] *= reciprocalLength;
		}
	}
}


static Model* GenerateModel(Mesh* mesh)
{
	// Convert from Mesh format (multiple index lists) to Model format
	// (one index list) by generating a new set of vertices/indices
	// and where new vertices have been created whenever necessary

	typedef struct
	{
		int positionIndex;
		int normalIndex;
		int texCoordIndex;
		int newIndex;
	} IndexTriplet;

	int hashGap = 6;

	int indexHashMapSize = (mesh->vertexCount * hashGap + mesh->coordCount);

	IndexTriplet* indexHashMap = malloc(sizeof(IndexTriplet)
							* indexHashMapSize);

	int numNewVertices = 0;
	int index;

	int maxValue = 0;
		
	Model* model = malloc(sizeof(Model));
	memset(model, 0, sizeof(Model));

	model->indexArray = malloc(sizeof(GLuint) * mesh->coordCount);
	model->numIndices = mesh->coordCount;

	memset(indexHashMap, 0xff, sizeof(IndexTriplet) * indexHashMapSize);

	for (index = 0; index < mesh->coordCount; index++)
	{
		IndexTriplet currentVertex = { -1, -1, -1, -1 };
		int insertPos = 0;
		if (mesh->coordIndex)
			currentVertex.positionIndex = mesh->coordIndex[index];
		if (mesh->normalsIndex)
			currentVertex.normalIndex = mesh->normalsIndex[index];
		if (mesh->textureIndex)
			currentVertex.texCoordIndex = mesh->textureIndex[index];

		if (maxValue < currentVertex.texCoordIndex)
			maxValue = currentVertex.texCoordIndex;
 
		if (currentVertex.positionIndex >= 0)
			insertPos = currentVertex.positionIndex * hashGap;

		while (1)
		{
			if (indexHashMap[insertPos].newIndex == -1)
				{
					currentVertex.newIndex = numNewVertices++;
					indexHashMap[insertPos] = currentVertex;
					break;
				}
			else if (indexHashMap[insertPos].positionIndex
				 == currentVertex.positionIndex
				 && indexHashMap[insertPos].normalIndex
				 == currentVertex.normalIndex
				 && indexHashMap[insertPos].texCoordIndex
				 == currentVertex.texCoordIndex)
				{
					currentVertex.newIndex = indexHashMap[insertPos].newIndex;
					break;
				}
			else
				insertPos++;
		} 

		model->indexArray[index] = currentVertex.newIndex;
	}

	if (mesh->vertices)
		model->vertexArray = malloc(sizeof(GLfloat) * 3 * numNewVertices);
	if (mesh->vertexNormals)
		model->normalArray = malloc(sizeof(GLfloat) * 3 * numNewVertices);
	if (mesh->textureCoords)
		model->texCoordArray = malloc(sizeof(GLfloat) * 2 * numNewVertices);
	
	model->numVertices = numNewVertices;

	for (index = 0; index < indexHashMapSize; index++)
	{
		if (indexHashMap[index].newIndex != -1)
		{
			if (mesh->vertices)
				memcpy(&model->vertexArray[3 * indexHashMap[index].newIndex],
					&mesh->vertices[3 * indexHashMap[index].positionIndex],
					3 * sizeof(GLfloat));

			if (mesh->vertexNormals)
				memcpy(&model->normalArray[3 * indexHashMap[index].newIndex],
					&mesh->vertexNormals[3 * indexHashMap[index].normalIndex],
					3 * sizeof(GLfloat));

			if (mesh->textureCoords)
			{
				model->texCoordArray[2 * indexHashMap[index].newIndex + 0]
					= mesh->textureCoords[2 * indexHashMap[index].texCoordIndex + 0];
				model->texCoordArray[2 * indexHashMap[index].newIndex + 1]
					= 1 - mesh->textureCoords[2 * indexHashMap[index].texCoordIndex + 1];
			}
		}
	}

	free(indexHashMap);

	return model;
}


// Print out the mesh contents
// "all" prints out everything; this can be huge for large models!
void PrintMesh(Mesh *mesh, char all)
{
	int i;
	if (mesh == NULL)
	{
		printf("NULL mesh!\n");
		return;
	}
	printf("vertices: (%d)\n", mesh->vertexCount);
	if (all)
		for (i = 0; i < mesh->vertexCount*3; i+=3)
			printf(" %d %f %f %f\n", i/3, mesh->vertices[i], mesh->vertices[i+1], mesh->vertices[i+2]);
	printf("vertexNormals: (%d)\n", mesh->normalsCount);
	if (all)
		for (i = 0; i < mesh->normalsCount*3; i+=3)
			printf(" %d %f %f %f\n", i/3, mesh->vertexNormals[i], mesh->vertexNormals[i+1], mesh->vertexNormals[i+2]);
	printf("textureCoords: (%d)\n", mesh->texCount);
	if (all)
		for (i = 0; i < mesh->texCount*2; i+=2)
			printf(" %d %f %f\n", i/2, mesh->textureCoords[i], mesh->textureCoords[i+1]);
	printf("coordsIndex: (%d)\n", mesh->coordCount);
	if (all)
		for (i = 0; i < mesh->coordCount; i++)
			printf(" %d %d\n", i, mesh->coordIndex[i]);
	printf("normalsIndex: (%d)\n", mesh->coordCount);
	if (all)
		for (i = 0; i < mesh->coordCount; i++)
			printf(" %d %d\n", i, mesh->normalsIndex[i]);
	printf("textureIndex: (%d)\n", mesh->coordCount);
	if (all)
		for (i = 0; i < mesh->coordCount; i++)
			printf(" %d %d\n", i, mesh->textureIndex[i]);
	printf("coordStarts (groups): (%d)\n", mesh->groupCount);
	if (mesh->coordStarts != NULL)
	for (i = 0; i < mesh->groupCount+1; i++)
		printf(" %d %d\n", i, mesh->coordStarts[i]);
}

// Split multi-model OBJ data to multiple separate, independent ones
Mesh **SplitToMeshes(Mesh *m)
{
	int * mapc = (int *)malloc(m->vertexCount * sizeof(int));
	int * mapt = (int *)malloc(m->texCount * sizeof(int));
	int * mapn = (int *)malloc(m->normalsCount * sizeof(int));
		int newCoordIndexCount = 0; // Number of coords put in mm[i]->coordIndex
		int newNormalsIndexCount = 0; // Number of normals put in mm[i]->normalsIndex
		int newTexIndexCount = 0; // Number of coords put in mm[i]->textureIndex
	
	Mesh **mm = (Mesh **)calloc(sizeof(Mesh *), m->groupCount+2);
	int j = 0;
	int i, ii;
	for (i = 0; i < m->groupCount+1; i++)
	{
		printf("Building mesh number %d\n", i);// sleep(1);
		mm[i] = (Mesh *)malloc(sizeof(Mesh));
		// allocate c1, t1, n1, mapc, mapt, mapn, coordIndex, textureIndex, normalsIndex
		mm[i]->vertices = malloc(m->vertexCount * sizeof(GLfloat) * 3);
		if (m->normalsCount > 0)
			mm[i]->vertexNormals = malloc(m->normalsCount * sizeof(GLfloat) * 3);
		else
			mm[i]->vertexNormals = NULL;
		if (m->texCount > 0)
			mm[i]->textureCoords = malloc(m->texCount * sizeof(GLfloat) * 2);
		else
			mm[i]->textureCoords = NULL;
		mm[i]->coordIndex = malloc(m->coordCount * sizeof(int));
		mm[i]->normalsIndex = malloc(m->coordCount * sizeof(int));
		mm[i]->textureIndex = malloc(m->coordCount * sizeof(int));
		mm[i]->coordStarts = NULL; // No coord starts for separated parts!
		// zero counters for new Mesh
		mm[i]->vertexCount = 0;
		mm[i]->normalsCount = 0;
		mm[i]->texCount = 0;
		mm[i]->coordCount = 0;
		mm[i]->groupCount = 0;
		
		printf("Filling maps with %d\n", m->vertexCount);
		// Fill mapc, mapt, mapn with -1 (illegal index)
		for (ii = 0; ii < m->vertexCount; ii++)
			mapc[ii] = -1;
		for (ii = 0; ii < m->texCount; ii++)
			mapt[ii] = -1;
		for (ii = 0; ii < m->normalsCount; ii++)
			mapn[ii] = -1;
		
		// OBSOLETE! Use mm[i]->normalsCount etc instead! No, that is data, not indices!
		// These should all equal to mm[i]->coordCount in the end but must be separate in the mean time!
//		int newCoordIndexCount = 0; // Number of coords put in mm[i]->coordIndex
//		int newNormalsIndexCount = 0; // Number of normals put in mm[i]->normalsIndex
//		int newTexIndexCount = 0; // Number of coords put in mm[i]->textureIndex
		
//		if (m->coordStarts == NULL)
//			printf("Oh shit!\n");
//		printf("Walking the dog from %d to %d\n", j, m->groupCount);
//		printf("Walking the dog up to %d\n", m->coordStarts[i+1]);
		for (; j < m->coordStarts[i+1]; j++)
		{
//			printf("Keep walking at %d\n", j);
			// mapc[index] is new position for vertices[index]
			int ix = m->coordIndex[j]; // get next index
			if (ix == -1) // Is it a separator?
			{
//				printf("Separator at %d\n", j);
				// Save -1, which is a separator
				mm[i]->coordIndex[newCoordIndexCount++] = ix;
			}
			else
			{
				// is it mapped?
				if (mapc[ix] == -1) // No mapping
				{
//					printf("Upmapped at %d\n", j);
					// If not, copy data!
					mapc[ix] = mm[i]->vertexCount++;
					mm[i]->vertices[mapc[ix]*3] = m->vertices[ix*3];
					mm[i]->vertices[mapc[ix]*3+1] = m->vertices[ix*3+1];
					mm[i]->vertices[mapc[ix]*3+2] = m->vertices[ix*3+2];
				}
				// Save index to new coordIndex!
				mm[i]->coordIndex[newCoordIndexCount++] = mapc[ix];
			}

			if (m->textureIndex != NULL)
			{
//				printf("Walk T at %d\n", j);
				// mapt[index] is new position for textureCoords[index]
				ix = m->textureIndex[j]; // get next index
				if (ix == -1) // Is it a separator?
				{
					// Save -1, which is a separator
					mm[i]->textureIndex[newTexIndexCount++] = ix;
				}
				else
				{
					// is it mapped?
					if (mapt[ix] == -1) // No mapping
					{
//						printf("Upmapped T at %d\n", j);
						// If not, copy data!
						mapt[ix] = mm[i]->texCount++;
						mm[i]->textureCoords[mapt[ix]*2] = m->textureCoords[ix*2];
						mm[i]->textureCoords[mapt[ix]*2+1] = m->textureCoords[ix*2+1];
					}
					// Save index to new coordIndex!
					mm[i]->textureIndex[newTexIndexCount++] = mapt[ix];
				}
			}

			// mapn[index] is new position for vertexNormals[index]
			// BUG BELOW!
			if (m->normalsIndex != NULL)
			{
//				printf("Walk N at %d\n", j);
				ix = m->normalsIndex[j]; // get next index
				if (ix == -1) // Is it a separator?
				{
//					printf("N separator at %d\n", j); sleep(1);
					// Save -1, which is a separator
					mm[i]->normalsIndex[newNormalsIndexCount++] = ix;
				}
				else
				{
					// is it mapped?
					if (mapn[ix] == -1) // No mapping
					{
//						printf("Upmapped N at %d\n", j);
						// If not, copy data!
						mapn[ix] = mm[i]->normalsCount++;
						mm[i]->vertexNormals[mapn[ix]*3] = m->vertexNormals[ix*3];
						mm[i]->vertexNormals[mapn[ix]*3+1] = m->vertexNormals[ix*3+1];
						mm[i]->vertexNormals[mapn[ix]*3+2] = m->vertexNormals[ix*3+2];
					}
					// Save index to new coordIndex!
					mm[i]->normalsIndex[newNormalsIndexCount++] = mapn[ix];
				}
			}
//			printf("Done with %d\n", j);
		}
//		if (newNormalsIndexCount != newTexIndexCount)
//			printf("Not same!\n");
//		if (newNormalsIndexCount != newCoordIndexCount)
//			printf("Not same!\n");
		mm[i]->coordCount = newCoordIndexCount;
		printf("Part %d with %d v, %d t, %d n!\n", i, mm[i]->vertexCount++, mm[i]->texCount, mm[i]->normalsCount++);
		printf("And %d coords!\n", mm[i]->coordCount);
	}
	return mm;
}


Model* LoadModel(const char* name)
{
	Model* model = 0;
	Mesh* mesh = LoadOBJ(name);
	
	DecomposeToTriangles(mesh);

	GenerateNormals(mesh);
	
	model = GenerateModel(mesh);

// Free the mesh!
	if (mesh->vertices != NULL)
		free(mesh->vertices);
	if (mesh->vertexNormals != NULL)
		free(mesh->vertexNormals);
	if (mesh->textureCoords != NULL)
		free(mesh->textureCoords);
	if (mesh->coordIndex != NULL)
		free(mesh->coordIndex);
	if (mesh->normalsIndex != NULL)
		free(mesh->normalsIndex);
	if (mesh->textureIndex != NULL)
		free(mesh->textureIndex);
	free(mesh);
	
	return model;
}


void CenterModel(Model *m)
{
	int i;
	float maxx = -1e10, maxy = -1e10, maxz = -1e10, minx = 1e10, miny = 1e10, minz = 1e10;
	
	for (i = 0; i < m->numVertices; i++)
	{
		if (m->vertexArray[3 * i] < minx) minx = m->vertexArray[3 * i];
		if (m->vertexArray[3 * i] > maxx) maxx = m->vertexArray[3 * i];
		if (m->vertexArray[3 * i+1] < miny) miny = m->vertexArray[3 * i+1];
		if (m->vertexArray[3 * i+1] > maxy) maxy = m->vertexArray[3 * i+1];
		if (m->vertexArray[3 * i+2] < minz) minz = m->vertexArray[3 * i+2];
		if (m->vertexArray[3 * i+2] > maxz) maxz = m->vertexArray[3 * i+2];
	}
	
	fprintf(stderr, "maxx %f minx %f \n", maxx, minx);
	fprintf(stderr, "maxy %f miny %f \n", maxy, miny);
	fprintf(stderr, "maxz %f minz %f \n", maxz, minz);

	for (i = 0; i < m->numVertices; i++)
	{
		m->vertexArray[3 * i] -= (maxx + minx)/2.0;
		m->vertexArray[3 * i+1] -= (maxy + miny)/2.0;
		m->vertexArray[3 * i+2] -= (maxz + minz)/2.0;
	}
}

void ScaleModel(Model *m, float sx, float sy, float sz)
{
	long i;
	for (i = 0; i < m->numVertices; i++)
	{
		m->vertexArray[3 * i] *= sx;
		m->vertexArray[3 * i+1] *= sy;
		m->vertexArray[3 * i+2] *= sz;
	}
}

void ReportRerror(const char *caller, const char *name)
{
	static unsigned int draw_error_counter = 0; 
	// Report error - but not more than NUM_DRAWMODEL_ERROR
   if(draw_error_counter < NUM_DRAWMODEL_ERROR)
   {
		    fprintf(stderr, "%s warning: '%s' not found in shader!\n", caller, name);
		    draw_error_counter++;
   }
   else if(draw_error_counter == NUM_DRAWMODEL_ERROR)
   {
		    fprintf(stderr, "%s: Number of error bigger than %i. No more vill be printed.\n", caller, NUM_DRAWMODEL_ERROR);
		    draw_error_counter++;
   }
}


// NEW for lab 2 2012
// Modified 2013, to do decent error reporting
// This code makes a lot of calls for rebinding variables just in case,
// and to get attribute locations. This is clearly not optimal, but the
// goal is stability.

void DrawModel(Model *m, GLuint program, const char* vertexVariableName, const char* normalVariableName, const char* texCoordVariableName)
{
	if (m != NULL)
	{
		GLint loc;
		
		glBindVertexArray(m->vao);	// Select VAO

		glBindBuffer(GL_ARRAY_BUFFER, m->vb);
		loc = glGetAttribLocation(program, vertexVariableName);
		if (loc >= 0)
		{
			glVertexAttribPointer(loc, 3, GL_FLOAT, GL_FALSE, 0, 0); 
			glEnableVertexAttribArray(loc);
		}
		else
			ReportRerror("DrawModel", vertexVariableName);
		
		if (normalVariableName!=NULL)
		{
			loc = glGetAttribLocation(program, normalVariableName);
			if (loc >= 0)
			{
				glBindBuffer(GL_ARRAY_BUFFER, m->nb);
				glVertexAttribPointer(loc, 3, GL_FLOAT, GL_FALSE, 0, 0);
				glEnableVertexAttribArray(loc);
			}
			else
				ReportRerror("DrawModel", normalVariableName);
		}
	
		// VBO for texture coordinate data NEW for 5b
		if ((m->texCoordArray != NULL)&&(texCoordVariableName != NULL))
		{
			loc = glGetAttribLocation(program, texCoordVariableName);
			if (loc >= 0)
			{
				glBindBuffer(GL_ARRAY_BUFFER, m->tb);
				glVertexAttribPointer(loc, 2, GL_FLOAT, GL_FALSE, 0, 0);
				glEnableVertexAttribArray(loc);
			}
			else
				ReportRerror("DrawModel", texCoordVariableName);
		}

		glDrawElements(GL_TRIANGLES, m->numIndices, GL_UNSIGNED_INT, 0L);
	}
}

void DrawWireframeModel(Model *m, GLuint program, const char* vertexVariableName, const char* normalVariableName, const char* texCoordVariableName)
{
	if (m != NULL)
	{
		GLint loc;
		
		glBindVertexArray(m->vao);	// Select VAO

		glBindBuffer(GL_ARRAY_BUFFER, m->vb);
		loc = glGetAttribLocation(program, vertexVariableName);
		if (loc >= 0)
		{
			glVertexAttribPointer(loc, 3, GL_FLOAT, GL_FALSE, 0, 0); 
			glEnableVertexAttribArray(loc);
		}
		else
			ReportRerror("DrawWireframeModel", vertexVariableName);
		
		if (normalVariableName!=NULL)
		{
			loc = glGetAttribLocation(program, normalVariableName);
			if (loc >= 0)
			{
				glBindBuffer(GL_ARRAY_BUFFER, m->nb);
				glVertexAttribPointer(loc, 3, GL_FLOAT, GL_FALSE, 0, 0);
				glEnableVertexAttribArray(loc);
			}
			else
				ReportRerror("DrawWireframeModel", normalVariableName);
		}
	
		// VBO for texture coordinate data NEW for 5b
		if ((m->texCoordArray != NULL)&&(texCoordVariableName != NULL))
		{
			loc = glGetAttribLocation(program, texCoordVariableName);
			if (loc >= 0)
			{
				glBindBuffer(GL_ARRAY_BUFFER, m->tb);
				glVertexAttribPointer(loc, 2, GL_FLOAT, GL_FALSE, 0, 0);
				glEnableVertexAttribArray(loc);
			}
			else
				ReportRerror("DrawWireframeModel", texCoordVariableName);
		}
		glDrawElements(GL_LINE_STRIP, m->numIndices, GL_UNSIGNED_INT, 0L);
	}
}
	
// BuildModelVAO2

// Called from LoadModelPlus and LoadDataToModel
// VAO and VBOs must already exist!
// Useful by its own when the model changes on CPU
void ReloadModelData(Model *m)
{
	glBindVertexArray(m->vao);
	
	// VBO for vertex data
	glBindBuffer(GL_ARRAY_BUFFER, m->vb);
	glBufferData(GL_ARRAY_BUFFER, m->numVertices*3*sizeof(GLfloat), m->vertexArray, GL_STATIC_DRAW);
	//glVertexAttribPointer(glGetAttribLocation(program, vertexVariableName), 3, GL_FLOAT, GL_FALSE, 0, 0); 
	//glEnableVertexAttribArray(glGetAttribLocation(program, vertexVariableName));
	
	// VBO for normal data
	glBindBuffer(GL_ARRAY_BUFFER, m->nb);
	glBufferData(GL_ARRAY_BUFFER, m->numVertices*3*sizeof(GLfloat), m->normalArray, GL_STATIC_DRAW);
	//glVertexAttribPointer(glGetAttribLocation(program, normalVariableName), 3, GL_FLOAT, GL_FALSE, 0, 0);
	//glEnableVertexAttribArray(glGetAttribLocation(program, normalVariableName));
	
	// VBO for texture coordinate data NEW for 5b
	if (m->texCoordArray != NULL)
	{
		glBindBuffer(GL_ARRAY_BUFFER, m->tb);
		glBufferData(GL_ARRAY_BUFFER, m->numVertices*2*sizeof(GLfloat), m->texCoordArray, GL_STATIC_DRAW);
		//glVertexAttribPointer(glGetAttribLocation(program, texCoordVariableName), 2, GL_FLOAT, GL_FALSE, 0, 0);
		//glEnableVertexAttribArray(glGetAttribLocation(program, texCoordVariableName));
	}
	
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, m->ib);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, m->numIndices*sizeof(GLuint), m->indexArray, GL_STATIC_DRAW);
}

Model* LoadModelPlus(const char* name/*,
			GLuint program,
			char* vertexVariableName,
			char* normalVariableName,
			char* texCoordVariableName*/)
{
	Model *m;
	
	m = LoadModel(name);
	
	glGenVertexArrays(1, &m->vao);
	glGenBuffers(1, &m->vb);
	glGenBuffers(1, &m->ib);
	glGenBuffers(1, &m->nb);
	if (m->texCoordArray != NULL)
		glGenBuffers(1, &m->tb);
		
	ReloadModelData(m);
	
	return m;
}

// Loader for inline data to Model (almost same as LoadModelPlus)
Model* LoadDataToModel(
			GLfloat *vertices,
			GLfloat *normals,
			GLfloat *texCoords,
			GLfloat *colors,
			GLuint *indices,
			int numVert,
			int numInd)
{
	Model* m = malloc(sizeof(Model));
	memset(m, 0, sizeof(Model));
	
	m->vertexArray = vertices;
	m->texCoordArray = texCoords;
	m->normalArray = normals;
	m->indexArray = indices;
	m->numVertices = numVert;
	m->numIndices = numInd;
	
	glGenVertexArrays(1, &m->vao);
	glGenBuffers(1, &m->vb);
	glGenBuffers(1, &m->ib);
	glGenBuffers(1, &m->nb);
	if (m->texCoordArray != NULL)
		glGenBuffers(1, &m->tb);

	ReloadModelData(m);
	
	return m;
}

// Cleanup function, not tested!
void DisposeModel(Model *m)
{
	if (m != NULL)
	{
		if (m->vertexArray != NULL)
			free(m->vertexArray);
		if (m->normalArray != NULL)
			free(m->normalArray);
		if (m->texCoordArray != NULL)
			free(m->texCoordArray);
		if (m->colorArray != NULL) // obsolete?
			free(m->colorArray);
		if (m->indexArray != NULL)
			free(m->indexArray);
			
		// Lazy error checking heter since "glDeleteBuffers silently ignores 0's and names that do not correspond to existing buffer objects."
		glDeleteBuffers(1, &m->vb);
		glDeleteBuffers(1, &m->ib);
		glDeleteBuffers(1, &m->nb);
		glDeleteBuffers(1, &m->tb);
		glDeleteBuffers(1, &m->vao);
	}
	free(m);
}
