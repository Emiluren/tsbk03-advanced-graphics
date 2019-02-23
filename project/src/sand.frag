#version 300 es
precision mediump float;

in vec3 v_normal;
in vec3 v_position;
out vec4 fragColor;

void main() {
    vec3 lightdir = normalize(vec3(1, 1, 1));
    float diffuse_factor = max(0.2, dot(normalize(v_normal), lightdir));
    fragColor = vec4(vec3(diffuse_factor), 1);
}
