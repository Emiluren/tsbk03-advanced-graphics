# Bonsai-Simulator Xtrem
**Procedurell generation av trädgrafik för kursen TSBK03.**  
Erik Mansén - erima668, Emil Segerbäck - emise935

## Introduction
Our goal was to create a simulation of a growing bonsai tree. The user was supposed to be able to cut branches to control the growth of the tree. Our features we picked as mandatory were: WebGL graphics, procedural generation of the tree structure, a generated mesh for that skeleton, some texture covering the mesh, procedural generation of leaves, ability to cut off branches without creating holes in the mesh, 3D camera controls, a day-night cycle, wind animation and shadows.

We underestimated the challenges we would face concerning the tree structure generation and so tree shadows which we said we would have in the final result were not implemented. We also forgot to avoid the creation of holes in the mesh so when branches are cut off, they reveal the mesh's hollow inside. A simple wind animation was implemented in a shader but that code was never merged with our master branch.

At the start of the project we also made a list of optional features that we could work on in case that all the mandatory features were completed. These included: sunlight-seeking tree growth, shading objects that influence the tree's growth, branches falling after being cut off and collision with other branches, water simulation and watering of the tree, birds who collect small branches and build nests, procedural texture generation, a neural network for texture generation, advanced shadows with self shading and more trees. The only one of these that were implemented was a simple procedural generation of textures.

## Background information.
Trees in the natural world can come in a large number of complicated shapes and sizes. Modelling a tree from scratch is a complicated procedure as any given tree may consist of a large number of branches, sub-branches and leaves all with their own distinctive positions and orientations, not even mentioning the coloration of the differing components. All of these elements must also be made to fit together in such a way that the tree ends up looking natural and "organic". The challenge we attempted to overcome was therefore to create a program which would automatically create a realistic-looking tree mesh.

Being able to procedurally generate a single tree is not good enough however, as populating an entire forest with hundreds of identical trees will tend to look very unnatural. By varying the geometry of the tree over a series a of parameters it is possible to create any number of completely unique trees. If implemented correctly, this also allows the same program to create different variants and species of tree by carefully selecting the correct parameters.

All of this relies upon having a good enough model that ensures the resulting trees will always look more or less natural and correct. This is provided by Jason Weber and Joseph Penn who, in their paper "Creation and Rendering of Trees" describe a model for creating natural-looking trees by varying a set of parameters.

## About your implementation
Tools used, program structure.

## Interesting problems
Did you run into any particular problems during the work?

## Conclusions
How did it come out? How could it have been done better?

## References
List references.
