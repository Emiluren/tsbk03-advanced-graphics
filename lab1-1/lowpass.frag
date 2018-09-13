#version 150

uniform sampler2D texUnit;
uniform float texSize;
in vec2 outTexCoord;
out vec4 fragColor;

void main() {
    float offset = 1.0 / texSize;
    vec4 center = texture(texUnit, outTexCoord);
    vec4 left = texture(texUnit, outTexCoord + vec2(offset, 0.0));
    vec4 right = texture(texUnit, outTexCoord + vec2(-offset, 0.0));
    fragColor = (center * 2 + left + right) * 0.25;
}
