#version 150

uniform sampler2D texUnit;
in vec2 outTexCoord;
out vec4 fragColor;

void main() {
    fragColor = texture(texUnit, outTexCoord) - vec4(1);
}
