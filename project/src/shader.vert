attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 mvp;
uniform mat4 world;

varying vec3 v_normal;

void main() {
    gl_Position = mvp * vec4(a_position, 1.0);
    v_normal = (world * vec4(a_normal, 0.0)).xyz;
}
