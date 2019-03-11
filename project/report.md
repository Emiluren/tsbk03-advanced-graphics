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
Tools used, program structure.

## Interesting problems
Did you run into any particular problems during the work?

## Conclusions
How did it come out? How could it have been done better?
