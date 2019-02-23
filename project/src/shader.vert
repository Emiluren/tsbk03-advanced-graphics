#version 300 es

in vec3 a_position;
in vec3 a_normal;

uniform mat4 mvp;
uniform mat4 world;

out vec3 v_normal;
out vec3 v_position;

void main() {
    gl_Position = mvp * vec4(a_position, 1.0);
    v_normal = (world * vec4(a_normal, 0.0)).xyz;
    v_position = (world * vec4(a_position, 1.0)).xyz;
}
