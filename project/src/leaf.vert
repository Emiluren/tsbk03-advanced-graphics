#version 300 es

in vec3 a_position;
in vec3 a_normal;
in vec2 a_tex_coords;

uniform mat4 mvp;
uniform mat4 world;

out vec3 v_normal;
out vec2 v_tex_coords;

void main() {
    gl_Position = mvp * vec4(a_position, 1.0);
    v_normal = (world * vec4(a_normal, 0.0)).xyz;
    v_tex_coords = a_tex_coords;
}
