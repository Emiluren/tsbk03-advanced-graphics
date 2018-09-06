#version 150

in vec3 in_Position;
in vec3 in_Normal;
in vec2 in_TexCoord;
in vec3 Vs;
in vec3 Vt;

uniform mat4 viewMatrix;
uniform mat4 projMatrix;

out vec2 outTexCoord;
out vec3 out_Normal;
out vec3 Ps;
out vec3 Pt;
out vec3 pixPos;  // Needed for specular reflections

void main(void)
{
    outTexCoord = in_TexCoord;
    out_Normal = mat3(viewMatrix) * in_Normal; // Cheated normal matrix, OK with no non-uniform scaling
    pixPos = vec3(viewMatrix * vec4(in_Position, 1.0));

    Ps = normalize( mat3(viewMatrix) * Vs );
    Pt = normalize( mat3(viewMatrix) * Vt );

    gl_Position = projMatrix * viewMatrix * vec4(in_Position, 1.0);
}
