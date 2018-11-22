attribute vec4 a_position;

uniform mat4 mat;

void main() {
    gl_Position = mat * a_position;
}
