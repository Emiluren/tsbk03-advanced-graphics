precision mediump float;

varying vec3 v_normal;

void main() {
    vec3 lightdir = normalize(vec3(1, 1, 1));
    float diffuse_factor = max(0.1, dot(normalize(v_normal), lightdir));
    gl_FragColor = vec4(diffuse_factor, diffuse_factor, diffuse_factor, 1);
}
