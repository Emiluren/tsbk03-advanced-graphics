# Bonsai-Simulator Xtrem
#### Procedurell generation av trädgrafik för kursen TSBK03
=======
Erik Mansén - erima668s
Emil Segerbäck - emise935

## Introduction
Our goal was to create a simulation of a growing bonsai tree. The user was supposed to be able to cut branches to control the growth of the tree. Our features we picked as mandatory were: WebGL graphics, procedural generation of the tree structure, a generated mesh for that skeleton, some texture covering the mesh, procedural generation of leaves, ability to cut off branches without creating holes in the mesh, 3D camera controls, a day-night cycle, wind animation and shadows.

We underestimated the challenges we would face concerning the tree structure generation and so tree shadows which we said we would have in the final result were not implemented. We also forgot to avoid the creation of holes in the mesh so when branches are cut off, they reveal the mesh's hollow inside. A simple wind animation was implemented in a shader but that code was never merged with our master branch.

At the start of the project we also made a list of optional features that we could work on in case that all the mandatory features were completed. These included: sunlight seeking tree growth, shading objects that influence the tree's growth, falling branches after beeing cut off and collision with other branches, water simulation and watering of the tree, birds who collect small branches and build nests, procedural texture generation, a neural network for texture generation, advanced shadows with self shading and more trees. The only one of these that were implemented was a simple procedural generation of textures.

## Background information.
Any information about the kind of problem you solved that is needed to follow the rest of the report.

## About your implementation
We wrote the game using WebGL and Typescript which compiles to JavaScript. For the 3D math we found a library called tsm. To load our shader source at the same time as our compiled JavaScript we used the program Webpack to bundle them into a single file. The code was mostly split into two parts: the generation of the abstract tree structure and the generation of a mesh from that tree structure.

### Tree structure greneration

### Mesh generation
The so called segments generated from the tree algorithm were treated as the ends cylinder like parts of the tree's branches. The mesh generation started at the root segment and generated a cylinder shell of triangles to each of its child segments. This algorithm was then executed recursively for each of the children to generate the mesh parts for the grandchildren. Each leaf was generated as two triangles in a quad formation for all the generated leaf locations.

To cut branches of the tree a ray was cast from the cameras position in the direction of the mouse cursor where the user clicked. The tree was traversed to find any branch that intersected with the ray. The first ray that was hit was removed from the structure and then the mesh was regenerated.

### Texture generation
All of the textures used in the project were procedurally generated in shaders. The bark of the tree was created using a 3-dimensional worley noise, which gives a sort of voronoi pattern. The exact coordinates of the closest points were used instead of just the distances to be able to create a thin edge line. The coordinates used for this noise were slightly offset with a psuedo perlin noise to give more irregular edges.

The texture for the ground used a simple perlin noise and the leaves used a procedural texture shader we found online so we cannot take any credit for that.

## Interesting problems
Did you run into any particular problems during the work?

## Conclusions
How did it come out? How could it have been done better?
