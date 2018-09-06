/*
 * random comment here
 * makes syntax highlight appaer
 * colors like springs sprouts
 */

#version 150

in float shade;
in vec3 position;

out vec4 out_Color;

void main(void)
{
    vec3 col = vec3(sin(position.x), sin(position.y), sin(position.z)) * 0.5 + vec3(0.5);
    out_Color=vec4(shade * col.r,shade * col.g,shade * col.b,1.0);
}


