attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 mvp;
uniform mat4 world;

uniform float time;

varying vec3 v_normal;

void main() {
    float sway_scale = a_position.y * a_position.y * 0.1;
    vec4 pos = mvp * vec4(a_position, 1.0);
    pos.x += sin(time) * sway_scale;
    //pos.z += sin(time) * sway_scale;
    pos.y += sin(time * 0.1 + pos.x * 0.2) * sway_scale;
    gl_Position = pos;
    v_normal = (world * vec4(a_normal, 0.0)).xyz;
}
