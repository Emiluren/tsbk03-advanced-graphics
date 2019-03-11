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

### Feature creep
We were sadly not able to completely implement all the features stated in our specification. Problems with implementing the Weber-Penn model meant we had to abandon any shadow-rendering more complicated than that offered by the basic Phong-model used to color our polygons. This naturally meant we also did not have time to implement any of the more advanced features originally listed as optional features, with the exception of procedural textures. The general lack of time left towards the end of the course also lead to a few oversights, such as cut branches leaving holes in the mesh.

### Generator, not simulator
As the name of the project implies, we initially intended to simulate the growth of a plant with the user being able to control said growth by cutting specific branches. As we eventually chose to pursue the model described by Weber and Penn however, this idea was scrapped in favor of generating static, fully grown trees, retaining the ability to cut their branches after the fact.

### Trees are home to a large part of the worlds' bug population<sup>[2]</sup>
Our implementation of the Weber-Penn model is far from perfect. Especially for complex trees it seems that the program fails to properly populate every branch with a correct number of leaves, leaving some completely barren. Certain parts of the Weber-Penn model are available via their parameters, but do not recommend using these as their results end up looking very weird, for example when using the BRANCHES-parameter to generate sub-branches.

### Results
Even with these problems in mind it is the opinion of this author that you can create some fairly good-looking (if somewhat basic) trees using our program. And these trees can be varied to an almost infinite degree by way of slight parameter shifts.

![Image](weber_penn_tree.png)

### Future work
It would potentially be interesting to enable the program to export generated trees into .obj files to be used in other projects. The relative simplicity of the generated trees would make them suitable for prototyping or where ever the quantity of trees is more important than their respective quality.

One of the highest performance drains in this project is the way the leaves are generated. If the leaves' textures could be instantiated once and then rendered using some high-performance method such as instancing (or perhaps replaced using a particle system) the program should be able to generate much more lush and thick foliage in its trees.

Lastly it would of course be interesting to properly implement some of the still-missing features described by the Weber-Penn model, such as fixing the generation of sub-branches. Seeing as the model has frequently been more trouble than it's been worth however, it may be pertinent to use it as more of a guide than something to be followed precisely.

## References
List references.
