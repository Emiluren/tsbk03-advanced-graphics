attribute vec3 a_position;
uniform mat4 mvp;

varying vec3 v_normal;

void main() {
    gl_Position = mvp * vec4(a_position, 1.0);
}
