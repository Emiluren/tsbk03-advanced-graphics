#version 150

uniform sampler2D texUnit;
uniform vec2 offset;
in vec2 outTexCoord;
out vec4 fragColor;

void main() {
    vec4 center = texture(texUnit, outTexCoord);
    vec4 left = texture(texUnit, outTexCoord - offset);
    vec4 right = texture(texUnit, outTexCoord + offset);
    fragColor = (center * 2 + left + right) * 0.25;
}
